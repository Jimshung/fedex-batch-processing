// fedexService.js - FedEx API 相關服務
const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class FedExService {
  constructor() {
    this.baseUrl = 'https://apis-sandbox.fedex.com'; // 測試環境，生產環境使用 https://apis.fedex.com
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      // 檢查是否已有有效的 token
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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
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
   * 上傳電子貿易文件 (ETD)
   * @param {string[]} documentPaths 文件路徑陣列
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadEtdDocuments(documentPaths) {
    try {
      // 模擬模式 - 直接返回模擬的文件參考號
      logger.info(`模擬上傳 ETD 文件`);

      // 模擬 API 延遲
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 產生隨機參考號
      const documentReferenceNumber =
        'DOC' + Math.random().toString(36).substring(2, 10).toUpperCase();

      logger.success(
        `模擬成功上傳 ETD 文件，參考號: ${documentReferenceNumber}`
      );

      return {
        success: true,
        documentReferenceNumber,
        error: null,
      };

      /* 真實 API 呼叫（已註解）
      const accessToken = await this.getAccessToken();
      
      // 建立 FormData 物件
      const formData = new FormData();
      
      // 加入必要的請求參數
      formData.append('meta', JSON.stringify({
        etdType: 'COMMERCIAL_INVOICE',
        uploaderId: config.fedex.accountNumber,
        shipTimestamp: new Date().toISOString(),
        documentType: 'COMMERCIAL_INVOICE'
      }));
      
      // 加入文件
      for (const documentPath of documentPaths) {
        const fileContent = await fs.readFile(documentPath);
        const fileName = path.basename(documentPath);
        formData.append('documents', fileContent, {
          filename: fileName,
          contentType: 'application/pdf',
        });
      }
      
      // 發送請求
      const response = await axios.post(
        `${this.baseUrl}/documents/v1/etds/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...formData.getHeaders(),
          },
        }
      );
      
      // 取得文件參考號
      const documentReferenceNumber = response.data.output?.uploadId;
      
      logger.success(`成功上傳 ETD 文件，參考號: ${documentReferenceNumber}`);
      
      return {
        success: true,
        documentReferenceNumber,
        error: null,
      };
      */
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      logger.error(`上傳 ETD 文件失敗: ${errorMessage}`);

      return {
        success: false,
        documentReferenceNumber: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 處理訂單出貨
   * @param {Object} orderData 訂單資料
   * @param {string[]} documentPaths 文件路徑陣列
   * @returns {Promise<Object>} 出貨結果
   */
  async processOrderShipment(orderData, documentPaths = []) {
    try {
      logger.info(`處理訂單出貨，訂單號: ${orderData.order_number}`);

      // 1. 上傳電子貿易文件
      let documentReference = null;
      if (documentPaths && documentPaths.length > 0) {
        const uploadResult = await this.uploadEtdDocuments(documentPaths);
        if (uploadResult.success) {
          documentReference = uploadResult.documentReferenceNumber;
        } else {
          logger.warning(`上傳文件失敗，將繼續處理出貨: ${uploadResult.error}`);
        }
      }

      // 2. 創建貨運請求
      const shipmentResult = await this.createShipment(
        orderData,
        documentReference
      );
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
   * 創建貨運標籤
   * @param {Object} orderData 訂單資料
   * @param {string} documentReferenceNumber 文件參考號
   * @returns {Promise<Object>} 創建結果
   */
  async createShipment(orderData, documentReferenceNumber = null) {
    try {
      // 模擬模式 - 不呼叫真實的 FedEx API
      logger.info(`模擬 FedEx API 呼叫，訂單編號: ${orderData.order_number}`);

      // 模擬 API 延遲
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 模擬成功率 80%
      const isSuccess = Math.random() > 0.2;

      if (isSuccess) {
        const trackingNumber =
          'FX' + Math.random().toString(36).substr(2, 9).toUpperCase();

        logger.success(
          `模擬成功建立 FedEx 貨運標籤，訂單編號: ${orderData.order_number}, 追蹤號碼: ${trackingNumber}`
        );

        return {
          success: true,
          trackingNumber: trackingNumber,
          labelUrl: null, // 模擬模式下不提供標籤 URL
          error: null,
        };
      } else {
        const errors = [
          'Invalid postal code',
          'Address not found',
          'Service not available in this area',
          'Package weight exceeds limit',
          'Invalid recipient information',
        ];

        const errorMessage = errors[Math.floor(Math.random() * errors.length)];

        logger.error(
          `模擬 FedEx API 呼叫失敗，訂單編號: ${orderData.order_number}, 錯誤: ${errorMessage}`
        );

        return {
          success: false,
          trackingNumber: null,
          labelUrl: null,
          error: errorMessage,
        };
      }

      /* 真實 API 呼叫（已註解）
      const accessToken = await this.getAccessToken();

      // 準備 FedEx API 請求數據
      const shipmentRequest = this.prepareShipmentRequest(orderData, documentReferenceNumber);

      const response = await axios.post(
        `${this.baseUrl}/ship/v1/shipments`,
        shipmentRequest,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }
      );

      logger.success(
        `成功建立 FedEx 貨運標籤，訂單編號: ${orderData.order_number}`
      );

      return {
        success: true,
        trackingNumber:
          response.data.output?.transactionDetail?.customerTransactionId,
        labelUrl: response.data.output?.labelResults?.[0]?.label,
        error: null,
      };
      */
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
   * 準備貨運請求數據
   * @param {Object} orderData 訂單資料
   * @param {string} documentReferenceNumber 文件參考號
   * @returns {Object} 貨運請求數據
   */
  prepareShipmentRequest(orderData, documentReferenceNumber = null) {
    // 解析地址資訊
    const streetLines = [
      orderData.processed_address_1,
      orderData.processed_address_2,
      orderData.processed_address_3,
    ].filter((line) => line && line.trim().length > 0);

    // 確定收件國家代碼
    const countryCode = orderData.country_code || 'SG';

    // 計算商品重量 (假設每瓶 Neuralli MP 重量為 0.5 磅)
    let totalWeight = 0.5; // 至少 0.5 磅
    if (Array.isArray(orderData.items)) {
      totalWeight = Math.max(
        0.5,
        orderData.items.reduce((sum, item) => {
          return sum + (item.quantity || 1) * 0.5; // 每瓶 0.5 磅
        }, 0)
      );
    }

    // 建構出貨請求
    const requestData = {
      requestedShipment: {
        shipper: {
          contact: {
            personName: 'Benedbiomed Singapore',
            phoneNumber: '6512345678',
            emailAddress: 'shipping@benedbiomed.com',
          },
          address: {
            streetLines: ['1 Harbourfront Avenue', '#03-01 Keppel Bay Tower'],
            city: 'Singapore',
            postalCode: '098632',
            countryCode: 'SG',
          },
        },
        recipients: [
          {
            contact: {
              personName: orderData.customer_name,
              phoneNumber: '1234567890', // 理想情況下應從訂單取得電話
              emailAddress: 'recipient@example.com', // 理想情況下應從訂單取得郵箱
            },
            address: {
              streetLines,
              countryCode,
            },
          },
        ],
        shipDatestamp: new Date().toISOString().split('T')[0],
        serviceType: 'INTERNATIONAL_PRIORITY', // 國際優先
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: 'SENDER',
        },
        labelSpecification: {
          imageType: 'PDF',
          labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
        },
        customsClearanceDetail: {
          dutiesPayment: {
            paymentType: 'SENDER',
          },
          commodities: [
            {
              description: 'Neuralli MP',
              countryOfManufacture: 'US',
              quantity: 1,
              quantityUnits: 'PCS',
              unitPrice: {
                amount: orderData.customs_value || 28,
                currency: 'USD',
              },
              weight: {
                units: 'LB',
                value: totalWeight,
              },
            },
          ],
        },
        requestedPackageLineItems: [
          {
            weight: {
              units: 'LB',
              value: totalWeight,
            },
            dimensions: {
              length: 8,
              width: 6,
              height: 4,
              units: 'IN',
            },
          },
        ],
      },
      accountNumber: {
        value: config.fedex.accountNumber,
      },
    };

    // 如果有文件參考號，加入電子貿易文件資訊
    if (documentReferenceNumber) {
      requestData.requestedShipment.customsClearanceDetail.documentContent =
        'ELECTRONIC_TRADE_DOCUMENTS';
      requestData.requestedShipment.customsClearanceDetail.etdDetail = {
        requestedDocumentTypes: ['COMMERCIAL_INVOICE'],
        documentReferences: [
          {
            documentType: 'COMMERCIAL_INVOICE',
            documentReference: documentReferenceNumber,
          },
        ],
      };
    }

    return requestData;
  }

  extractErrorMessage(error) {
    if (error.response?.data?.errors) {
      return error.response.data.errors.map((err) => err.message).join(', ');
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
    return {
      status: 500,
      message: error.message,
    };
  }
}

module.exports = new FedExService();
