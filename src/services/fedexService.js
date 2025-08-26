// fedexService.js - FedEx API 相關服務
const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');
const { splitAddress } = require('../utils/addressSplitter');
const documentStorageService = require('./documentStorageService');
const databaseService = require('./databaseService');

class FedExService {
  constructor() {
    this.baseUrl = config.fedex.apiBaseUrl;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      if (
        this.accessToken &&
        this.tokenExpiry &&
        Date.now() < this.tokenExpiry
      ) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: config.fedex.clientId,
          client_secret: config.fedex.clientSecret,
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      logger.success('成功獲取 FedEx API 存取權杖');
      return this.accessToken;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 上傳圖片文件到 FedEx
   * @param {string} imagePath 圖片文件路徑
   * @param {string} imageType 圖片類型 ('SIGNATURE' 或 'LETTER_HEAD')
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadImage(imagePath, imageType) {
    try {
      logger.info(`開始上傳圖片文件到 FedEx，類型: ${imageType}`);

      const accessToken = await this.getAccessToken();
      const imageContent = await fs.readFile(imagePath);
      const imageFileName = path.basename(imagePath);
      const formData = new FormData();

      formData.append('attachment', imageContent, {
        filename: imageFileName,
        contentType: this.getContentType(imageFileName),
      });

      const documentMetadata = {
        document: {
          referenceId: `BENED-LIFE-${imageType.toUpperCase()}-${Date.now()}`,
          name: imageFileName,
          contentType: this.getContentType(imageFileName),
          meta: {
            imageType: imageType === 'LETTER_HEAD' ? 'LETTERHEAD' : 'SIGNATURE',
            imageIndex: imageType === 'LETTER_HEAD' ? 'IMAGE_2' : 'IMAGE_1',
          },
        },
        rules: { workflowName: 'LetterheadSignature' },
      };

      formData.append('document', JSON.stringify(documentMetadata), {
        contentType: 'application/json',
      });

      logger.info(`準備上傳圖片: ${imageFileName} (${imageType})`);

      const response = await axios.post(
        `${this.baseUrl}/documents/v1/lhsimages/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...formData.getHeaders(),
          },
          timeout: 30000,
        }
      );

      logger.success(`成功上傳圖片文件: ${imageFileName}`);

      return {
        success: true,
        imageIndex: response.data.output?.meta?.imageIndex,
        error: null,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      logger.error(`上傳圖片文件失敗: ${errorMessage}`);

      if (error.response?.status === 404) {
        logger.warning('圖片上傳端點不存在，將使用預設配置');
        return {
          success: true,
          imageId: null,
          imageReference: null,
          error: null,
        };
      }

      return {
        success: false,
        imageId: null,
        imageReference: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 獲取文件內容類型
   * @param {string} fileName 文件名
   * @returns {string} 內容類型
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      default:
        return 'image/png';
    }
  }

  /**
   * 處理訂單出貨（支援 ETD 功能）
   * @param {Object} orderData 訂單資料
   * @param {string[]} documentPaths 文件路徑陣列（保留參數以維持相容性）
   * @returns {Promise<Object>} 出貨結果
   */
  async processOrderShipment(orderData, documentPaths = []) {
    try {
      logger.info(`處理訂單出貨，訂單號: ${orderData.order_number}`);

      if (documentPaths && documentPaths.length > 0) {
        logger.info(
          `訂單 ${orderData.order_number} 附加文件: ${documentPaths.join(', ')}`
        );
      }

      logger.info('使用固定的 IMAGE_1 和 IMAGE_2 引用進行貨運建立');
      const shipmentResult = await this.createShipment(orderData);
      return shipmentResult;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      logger.error(
        `處理訂單出貨失敗，訂單號: ${orderData.order_number}, 錯誤: ${errorMessage}`
      );

      return {
        success: false,
        trackingNumber: null,
        labelUrl: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 創建貨運標籤（支援 ETD 功能）
   * @param {Object} orderData 訂單資料
   * @returns {Promise<Object>} 創建結果
   */
  async createShipment(orderData) {
    try {
      logger.info(
        `開始呼叫 FedEx Ship API，訂單編號: ${orderData.order_number}`
      );

      const accessToken = await this.getAccessToken();
      const shipmentRequest = this.prepareShipmentRequest(orderData);

      // 顯示實際發送的請求內容
      logger.info('📤 發送到 FedEx API 的請求內容:');
      console.log('=== FEDEX API REQUEST ===');
      console.log('URL:', `${this.baseUrl}/ship/v1/shipments`);
      console.log('Headers:', {
        Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      });
      console.log('Body:', JSON.stringify(shipmentRequest, null, 2));
      console.log('=== END REQUEST ===');

      const response = await axios.post(
        `${this.baseUrl}/ship/v1/shipments`,
        shipmentRequest,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }
      );

      logger.success(
        `成功建立 FedEx 貨運標籤，訂單編號: ${orderData.order_number}`
      );

      // 處理文件存儲
      const trackingNumber =
        response.data.output?.transactionShipments?.[0]?.masterTrackingNumber;

      // 正確取得 encodedLabel
      const pieceResponses =
        response.data.output?.transactionShipments?.[0]?.pieceResponses;
      const packageDocuments = pieceResponses?.[0]?.packageDocuments;
      const labelData = packageDocuments?.[0]?.encodedLabel;

      let gcsLabelUrl = null;
      let gcsInvoiceUrl = null;

      // 上傳貨運標籤到 GCS
      if (labelData) {
        try {
          const labelResult = await documentStorageService.uploadShippingLabel(
            orderData.order_number,
            labelData
          );
          gcsLabelUrl = labelResult.publicUrl;
          logger.success(`貨運標籤已上傳到 GCS: ${gcsLabelUrl}`);
        } catch (uploadError) {
          logger.error(`上傳貨運標籤到 GCS 失敗: ${uploadError.message}`);
        }
      }

      // 上傳商業發票到 GCS（如果有的話）
      const invoiceData = response.data.output?.documentResults?.[0]?.document;
      if (invoiceData) {
        try {
          const invoiceResult =
            await documentStorageService.uploadCommercialInvoice(
              orderData.order_number,
              invoiceData
            );
          gcsInvoiceUrl = invoiceResult.publicUrl;
          logger.success(`商業發票已上傳到 GCS: ${gcsInvoiceUrl}`);
        } catch (uploadError) {
          logger.error(`上傳商業發票到 GCS 失敗: ${uploadError.message}`);
        }
      }

      // 儲存文件記錄到 Firestore
      if (gcsLabelUrl || gcsInvoiceUrl) {
        try {
          const documentData = {
            order_id: orderData.shopify_order_id,
            order_number: orderData.order_number,
            tracking_number: trackingNumber,
            documents: {
              shipping_label: gcsLabelUrl
                ? {
                    url: gcsLabelUrl,
                    type: 'shipping-label',
                    uploaded_at: new Date().toISOString(),
                  }
                : null,
              commercial_invoice: gcsInvoiceUrl
                ? {
                    url: gcsInvoiceUrl,
                    type: 'commercial-invoice',
                    uploaded_at: new Date().toISOString(),
                  }
                : null,
            },
            created_at: new Date().toISOString(),
          };

          await databaseService.saveDocument(documentData);
          logger.success(`文件記錄已儲存到 Firestore`);
        } catch (dbError) {
          logger.error(`儲存文件記錄到 Firestore 失敗: ${dbError.message}`);
        }
      }

      return {
        success: true,
        trackingNumber,
        labelUrl: gcsLabelUrl || labelData, // 優先返回 GCS URL
        invoiceUrl: gcsInvoiceUrl,
        error: null,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      logger.error(
        `FedEx API 呼叫失敗，訂單編號: ${orderData.order_number}, 錯誤: ${errorMessage}`
      );

      return {
        success: false,
        trackingNumber: null,
        labelUrl: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 準備貨運請求數據（支援 ETD 功能）
   * @param {Object} orderData 訂單資料
   * @returns {Object} 貨運請求數據
   */
  prepareShipmentRequest(orderData) {
    // 資料驗證和預設值處理
    if (!orderData) throw new Error('訂單資料不能為空');
    if (!orderData.order_number) throw new Error('訂單編號不能為空');

    // 處理地址 - 使用 Firestore 格式
    const originalAddress = orderData.original_address || {};

    const addressFields = {
      address1: originalAddress.address1 || '',
      address2: originalAddress.address2 || '',
      city: originalAddress.city || '',
      province: originalAddress.province || '',
      country: originalAddress.country_code || '',
      zip: originalAddress.postal_code || '',
    };

    const splitAddressResult = splitAddress(addressFields);

    // 過濾空行並確保至少有一行地址
    const streetLines = [
      splitAddressResult.address1,
      splitAddressResult.address2,
      splitAddressResult.address3,
    ].filter((line) => line && line.trim().length > 0);

    // 如果沒有地址行，使用預設值
    if (streetLines.length === 0) {
      streetLines.push('Address not provided');
    }

    const countryCode = orderData.country_code || 'SG';

    // 計算商品資訊
    let totalWeight = 0.07;
    let totalQuantity = 1;
    let productDescription = 'Neuralli MP - Asia';

    if (Array.isArray(orderData.items) && orderData.items.length > 0) {
      totalQuantity = orderData.items.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      );
      totalWeight = Math.max(0.07, totalQuantity * 0.07);

      // 使用第一個商品的描述，如果沒有則使用預設值
      if (orderData.items[0].name) {
        productDescription = orderData.items[0].name;
      }
    }

    // 確保海關申報值使用 USD 格式
    const customsValue = orderData.customs_value || 28;
    const customsValueUSD =
      typeof customsValue === 'string'
        ? parseFloat(customsValue.replace(/[^\d.]/g, ''))
        : customsValue;

    // 動態計算單價（總價值除以數量）
    const unitPrice =
      totalQuantity > 0 ? customsValueUSD / totalQuantity : customsValueUSD;

    // 記錄處理的訂單資訊
    logger.info(
      `處理訂單 ${orderData.order_number}: 數量=${totalQuantity}, 重量=${totalWeight}kg, 價值=$${customsValueUSD}`
    );

    // 建構出貨請求
    return {
      labelResponseOptions: 'LABEL',
      customerTransactionId: orderData.order_number,
      accountNumber: { value: config.fedex.accountNumber },
      requestedShipment: {
        shipper: {
          contact: {
            personName: "Int'l Shipment Bened",
            phoneNumber: '225111122',
            companyName: 'Bened Life',
          },
          address: {
            streetLines: ['8F, No. 508, Sec. 7,', 'Zhongxiao E. Road'],
            city: 'TAIPEI CITY',
            stateOrProvinceCode: '',
            postalCode: '115',
            countryCode: 'TW',
          },
        },
        recipients: [
          {
            contact: {
              personName: orderData.customer_name || 'Unknown Recipient',
              phoneNumber: orderData.phone || '1234567890',
              companyName: orderData.company || 'Recipient Company Name',
            },
            address: {
              streetLines,
              city: originalAddress.city || 'Unknown',
              stateOrProvinceCode: originalAddress.province || '',
              postalCode: originalAddress.postal_code || '00000',
              countryCode,
            },
          },
        ],
        shipDatestamp: new Date().toISOString().split('T')[0],
        serviceType: 'INTERNATIONAL_PRIORITY',
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'USE_SCHEDULED_PICKUP',
        blockInsightVisibility: false,
        // ETD 特殊服務配置
        shippingChargesPayment: { paymentType: 'SENDER' },
        shipmentSpecialServices: {
          specialServiceTypes: ['ELECTRONIC_TRADE_DOCUMENTS'],
          // 商業發票文件規格
          etdDetail: { requestedDocumentTypes: ['COMMERCIAL_INVOICE'] },
        },
        shippingDocumentSpecification: {
          shippingDocumentTypes: ['COMMERCIAL_INVOICE'],
          commercialInvoiceDetail: {
            documentFormat: { docType: 'PDF', stockType: 'PAPER_LETTER' },
            customerImageUsages: [
              {
                id: 'IMAGE_1',
                type: 'SIGNATURE',
                providedImageType: 'SIGNATURE',
              },
              {
                id: 'IMAGE_2',
                type: 'LETTER_HEAD',
                providedImageType: 'LETTER_HEAD',
              },
            ],
          },
        },
        labelSpecification: { imageType: 'PDF', labelStockType: 'STOCK_4X6' },
        customsClearanceDetail: {
          dutiesPayment: { paymentType: 'SENDER' },
          documentContent: 'COMMODITY',
          commodities: [
            {
              description: productDescription,
              countryOfManufacture: 'US',
              quantity: totalQuantity,
              quantityUnits: 'PCS',
              unitPrice: { amount: unitPrice, currency: 'USD' },
              customsValue: { amount: customsValueUSD, currency: 'USD' },
              weight: { units: 'KG', value: totalWeight },
            },
          ],
        },
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: totalWeight },
            dimensions: { length: 26, width: 21, height: 17, units: 'CM' },
            groupPackageCount: 1,
          },
        ],
      },
    };
  }

  extractErrorMessage(error) {
    console.log(
      'FedEx API Error Response:',
      JSON.stringify(error.response?.data, null, 2)
    );

    if (error.response?.data?.errors) {
      const errorDetails = error.response.data.errors
        .map(
          (err) =>
            `${err.message} (${err.code || 'NO_CODE'}) - Field: ${err.field || 'UNKNOWN'}`
        )
        .join(', ');
      return `${error.response.data.message || 'Validation failed'}: ${errorDetails}`;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    return error.message || '未知錯誤';
  }

  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.error || error.message,
      };
    }
    return { status: 500, message: error.message };
  }
}

module.exports = new FedExService();
