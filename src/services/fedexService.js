// fedexService.js - FedEx API 相關服務
const axios = require('axios');
const fs = require('fs').promises;
const FormData = require('form-data');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class FedExService {
  constructor() {
    // 從配置讀取 API 端點
    this.baseUrl = config.fedex.apiBaseUrl;
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
   * 準備商業發票資料
   * @param {Object} orderData 訂單資料
   * @param {Object} fileReferences 文件引用（信頭和簽名）
   * @returns {Object} 商業發票配置
   */
  prepareCommercialInvoice(orderData, fileReferences = {}) {
    const countryCode = orderData.country_code || 'US';

    // 根據國家代碼設定不同的商業發票配置
    let commercialInvoice = {
      originatorName: 'Bened Life',
      paymentTerms: 'Prepaid',
      termsOfSale: 'FCA',
      shipmentPurpose: 'COMMERCIAL',
      specialInstructions: 'Handle with care. Temperature sensitive product.',
      emailNotificationDetail: {
        emailAddress: 'shipping@benedbiomed.com',
        type: 'EMAILED',
        recipientType: 'SHIPPER',
      },
    };

    // 如果有信頭和簽名引用，加入商業發票配置
    if (fileReferences.letterheadReference) {
      commercialInvoice.letterheadReference =
        fileReferences.letterheadReference;
    }

    if (fileReferences.signatureReference) {
      commercialInvoice.signatureReference = fileReferences.signatureReference;
    }

    // 根據國家代碼調整特殊配置
    if (countryCode === 'PH') {
      // 菲律賓特殊配置
      commercialInvoice.comments = [
        'Neuralli MP - Medical Device',
        'For personal use only',
        'Contains probiotics',
      ];
      commercialInvoice.shipmentPurpose = 'COMMERCIAL';
    } else if (countryCode === 'NZ') {
      // 紐西蘭特殊配置
      commercialInvoice.comments = [
        'Neuralli MP - Dietary Supplement',
        'Contains beneficial bacteria',
        'For personal consumption',
      ];
      commercialInvoice.shipmentPurpose = 'COMMERCIAL';
    }

    return commercialInvoice;
  }

  /**
   * 上傳信頭和簽名文件到 FedEx
   * @param {string} letterheadPath 信頭文件路徑
   * @param {string} signaturePath 簽名文件路徑
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadLetterheadAndSignature(letterheadPath, signaturePath) {
    try {
      logger.info('開始上傳信頭和簽名文件到 FedEx');

      const accessToken = await this.getAccessToken();

      // 建立 FormData 物件
      const formData = new FormData();

      // 加入信頭文件
      if (letterheadPath) {
        try {
          const letterheadContent = await fs.readFile(letterheadPath);
          const letterheadFileName = path.basename(letterheadPath);

          logger.info(`準備上傳信頭文件: ${letterheadFileName}`);

          formData.append('letterhead', letterheadContent, {
            filename: letterheadFileName,
            contentType: 'image/png', // 或 'image/jpeg', 'image/gif'
          });
        } catch (fileError) {
          logger.error(
            `讀取信頭文件失敗: ${letterheadPath}, 錯誤: ${fileError.message}`
          );
        }
      }

      // 加入簽名文件
      if (signaturePath) {
        try {
          const signatureContent = await fs.readFile(signaturePath);
          const signatureFileName = path.basename(signaturePath);

          logger.info(`準備上傳簽名文件: ${signatureFileName}`);

          formData.append('signature', signatureContent, {
            filename: signatureFileName,
            contentType: 'image/png', // 或 'image/jpeg', 'image/gif'
          });
        } catch (fileError) {
          logger.error(
            `讀取簽名文件失敗: ${signaturePath}, 錯誤: ${fileError.message}`
          );
        }
      }

      // 發送請求到 FedEx 文件上傳端點
      // 注意：這個端點可能需要根據實際的 FedEx API 文檔調整
      const response = await axios.post(
        `${this.baseUrl}/documents/v1/letterhead-signature/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 秒超時
        }
      );

      logger.success('成功上傳信頭和簽名文件');

      return {
        success: true,
        letterheadReference: response.data.output?.letterheadReference,
        signatureReference: response.data.output?.signatureReference,
        error: null,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      logger.error(`上傳信頭和簽名文件失敗: ${errorMessage}`);

      // 如果 API 端點不存在，記錄警告並繼續
      if (error.response?.status === 404) {
        logger.warning('信頭和簽名文件上傳端點不存在，將使用預設配置');
        return {
          success: true,
          letterheadReference: null,
          signatureReference: null,
          error: null,
        };
      }

      return {
        success: false,
        letterheadReference: null,
        signatureReference: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 處理訂單出貨
   * @param {Object} orderData 訂單資料
   * @param {string[]} documentPaths 文件路徑陣列（保留參數以維持相容性）
   * @returns {Promise<Object>} 出貨結果
   */
  async processOrderShipment(orderData, documentPaths = []) {
    try {
      logger.info(`處理訂單出貨，訂單號: ${orderData.order_number}`);

      // 記錄文件路徑（用於調試）
      if (documentPaths && documentPaths.length > 0) {
        logger.info(
          `訂單 ${orderData.order_number} 附加文件: ${documentPaths.join(', ')}`
        );
      }

      // 1. 上傳信頭和簽名文件（如果存在）
      let letterheadReference = null;
      let signatureReference = null;

      // 在 Production 環境中，信頭和簽名已經在 FedEx 偏好設定中配置
      // 不需要通過 API 上傳文件，直接使用商業發票配置
      logger.info('Production 環境：信頭和簽名已在 FedEx 偏好設定中配置');
      logger.info(
        '將直接使用 commercialInvoice 配置，FedEx 會自動套用偏好設定'
      );

      // 2. 創建貨運請求（包含信頭和簽名引用）
      const shipmentResult = await this.createShipment(orderData, {
        letterheadReference,
        signatureReference,
      });
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
   * @param {Object} fileReferences 文件引用（信頭和簽名）
   * @returns {Promise<Object>} 創建結果
   */
  async createShipment(orderData, fileReferences = {}) {
    try {
      // 真實 API 呼叫
      logger.info(
        `開始呼叫 FedEx Ship API，訂單編號: ${orderData.order_number}`
      );

      const accessToken = await this.getAccessToken();

      // 準備 FedEx API 請求數據
      const shipmentRequest = this.prepareShipmentRequest(
        orderData,
        fileReferences
      );

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

      return {
        success: true,
        trackingNumber:
          response.data.output?.transactionShipments?.[0]?.masterTrackingNumber,
        labelUrl: response.data.output?.labelResults?.[0]?.label,
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
   * 準備貨運請求數據
   * @param {Object} orderData 訂單資料
   * @param {Object} fileReferences 文件引用（信頭和簽名）
   * @returns {Object} 貨運請求數據
   */
  prepareShipmentRequest(orderData, fileReferences = {}) {
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
        // 加入商業發票配置
        commercialInvoice: this.prepareCommercialInvoice(
          orderData,
          fileReferences
        ),
        recipients: [
          {
            contact: {
              personName: orderData.customer_name,
              phoneNumber: '1234567890', // 理想情況下應從訂單取得電話
            },
            address: {
              streetLines,
              city: orderData.city || 'Unknown',
              stateOrProvinceCode: orderData.province || '',
              postalCode: orderData.postal_code || '00000',
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
        labelSpecification: {},
        customsClearanceDetail: {
          dutiesPayment: {
            paymentType: 'SENDER',
          },
          totalCustomsValue: {
            amount: orderData.customs_value || 28,
            currency: 'USD',
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
            groupPackageCount: 1,
          },
        ],
      },
      accountNumber: {
        value: config.fedex.accountNumber,
      },
      labelResponseOptions: 'URL_ONLY',
    };

    // 移除 ETD 相關配置，因為我們使用 commercialInvoice 配置

    return requestData;
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
    return {
      status: 500,
      message: error.message,
    };
  }
}

module.exports = new FedExService();
