// fedexService.js - FedEx API 相關服務
const axios = require('axios');
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

  async createShipment(orderData) {
    try {
      // 模擬模式 - 不呼叫真實的 FedEx API
      logger.info(`模擬 FedEx API 呼叫，訂單編號: ${orderData.orderNumber}`);

      // 模擬 API 延遲
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 模擬成功率 80%
      const isSuccess = Math.random() > 0.2;

      if (isSuccess) {
        const trackingNumber =
          'FX' + Math.random().toString(36).substr(2, 9).toUpperCase();

        logger.success(
          `模擬成功建立 FedEx 貨運標籤，訂單編號: ${orderData.orderNumber}, 追蹤號碼: ${trackingNumber}`
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
          `模擬 FedEx API 呼叫失敗，訂單編號: ${orderData.orderNumber}, 錯誤: ${errorMessage}`
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
      const shipmentRequest = this.prepareShipmentRequest(orderData);

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
        `成功建立 FedEx 貨運標籤，訂單編號: ${orderData.orderNumber}`
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
        `FedEx API 呼叫失敗，訂單編號: ${orderData.orderNumber}, 錯誤: ${errorMessage}`
      );

      return {
        success: false,
        trackingNumber: null,
        labelUrl: null,
        error: errorMessage,
      };
    }
  }

  prepareShipmentRequest(orderData) {
    // 解析地址資訊
    const address1 =
      orderData.processedAddress1 || orderData.originalAddress1 || '';
    const address2 =
      orderData.processedAddress2 || orderData.originalAddress2 || '';

    // 解析商品明細
    const lineItems = Array.isArray(orderData.lineItems) ? orderItems : [];

    return {
      requestedShipment: {
        shipper: {
          contact: {
            personName: 'Your Company Name',
            phoneNumber: '1234567890',
            emailAddress: 'shipper@example.com',
          },
          address: {
            streetLines: ['123 Main St'],
            city: 'Your City',
            stateOrProvinceCode: 'CA',
            postalCode: '12345',
            countryCode: 'US',
          },
        },
        recipient: {
          contact: {
            personName: orderData.customerName,
            phoneNumber: '1234567890',
            emailAddress: 'recipient@example.com',
          },
          address: {
            streetLines: [address1, address2].filter((addr) => addr),
            city: 'Recipient City', // 這裡需要從地址中解析或從其他欄位獲取
            stateOrProvinceCode: 'CA', // 這裡需要從地址中解析
            postalCode: '12345', // 這裡需要從地址中解析
            countryCode: 'US', // 這裡需要根據國家代碼設定
          },
        },
        shipDatestamp: new Date().toISOString().split('T')[0],
        serviceType: 'PRIORITY_OVERNIGHT',
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        rateRequestType: ['LIST'],
        requestedPackageLineItems: [
          {
            weight: {
              units: 'LB',
              value: 1.0,
            },
            dimensions: {
              length: 10,
              width: 10,
              height: 10,
              units: 'IN',
            },
          },
        ],
      },
      accountNumber: {
        value: config.fedex.accountNumber,
      },
    };
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
