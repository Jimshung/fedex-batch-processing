// shopifyService.js - Shopify API 相關服務
const axios = require('axios');
const config = require('../config/config');
const addressSplitter = require('../utils/addressSplitter');
const databaseService = require('./databaseService');
const logger = require('../utils/logger');

class ShopifyService {
  constructor() {
    this.baseUrl = `https://${config.shopify.shopName}.myshopify.com/admin/api/${config.shopify.apiVersion}`;
    this.databaseService = databaseService;
  }

  async getUnfulfilledOrders(params = {}) {
    try {
      let allOrders = [];
      let nextPageUrl = null;
      let isFirstRequest = true;

      // 使用分頁機制取得所有未出貨訂單
      while (isFirstRequest || nextPageUrl) {
        let requestUrl;
        const requestConfig = {
          headers: {
            'X-Shopify-Access-Token': config.shopify.accessToken,
            'Content-Type': 'application/json',
          },
        };

        if (isFirstRequest) {
          // 第一次請求
          requestUrl = `${this.baseUrl}/orders.json`;
          requestConfig.params = {
            ...params,
            fulfillment_status: 'unfulfilled',
            status: 'open',
            limit: 250,
            fields:
              'id,order_number,customer,line_items,shipping_address,total_price,currency',
          };
          isFirstRequest = false;
        } else {
          // 後續分頁請求
          requestUrl = nextPageUrl;
        }

        const response = await axios.get(requestUrl, requestConfig);
        const orders = response.data.orders || [];
        allOrders = allOrders.concat(orders);

        // 檢查是否有下一頁
        const linkHeader = response.headers.link;
        nextPageUrl = null;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          // 解析 Link header 取得下一頁 URL
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
          }
        }

        logger.info(`已取得 ${allOrders.length} 筆訂單...`);

        // 安全機制：避免無限循環
        if (allOrders.length > 5000) {
          logger.warn('訂單數量超過 5000，停止分頁請求');
          break;
        }
      }

      // 在這裡直接過濾亞洲國家的訂單
      const asiaCountries = config.asiaCountries || [
        'JP',
        'KR',
        'SG',
        'PH',
        'AU',
        'NZ',
        'TH',
      ];
      const filteredOrders = allOrders.filter((order) => {
        const countryCode = order.shipping_address?.country_code;
        return countryCode && asiaCountries.includes(countryCode);
      });

      logger.info(`過濾後剩餘 ${filteredOrders.length} 筆亞洲地區訂單`);
      return filteredOrders;
    } catch (error) {
      logger.error(`取得訂單時發生錯誤: ${error.message}`);
      throw this.handleError(error);
    }
  }

  /**
   * 根據國家代碼過濾訂單
   * @param {Array} orders 訂單陣列
   * @param {Array} countryCodes 國家代碼陣列
   * @returns {Array} 過濾後的訂單陣列
   */
  filterOrdersByCountry(orders, countryCodes) {
    return orders.filter((order) =>
      countryCodes.includes(order.shipping_address?.country_code)
    );
  }

  /**
   * 計算訂單中 Neuralli MP 商品的報關金額
   * @param {Array} lineItems 商品項目陣列
   * @returns {number} 報關金額
   */
  calculateCustomsValue(lineItems) {
    if (!Array.isArray(lineItems)) return 0;

    const CUSTOM_VALUE_PER_BOTTLE = 28; // 每瓶 Neuralli MP 固定報關金額為 28 USD

    // 計算所有 Neuralli MP 商品的總報關金額
    let totalQuantity = 0;

    lineItems.forEach((item) => {
      // 檢查商品標題或 SKU 是否含有 Neuralli MP 字樣
      if (
        (item.title && item.title.toLowerCase().includes('neuralli mp')) ||
        (item.sku && item.sku.toLowerCase().includes('neuralli_mp'))
      ) {
        totalQuantity += item.quantity || 1;
      }
    });

    return totalQuantity * CUSTOM_VALUE_PER_BOTTLE;
  }

  /**
   * 處理訂單資料，將 Shopify 訂單轉換為系統需要的格式
   * @param {Object} order Shopify 訂單
   * @returns {Object} 處理後的訂單資料
   */
  processOrderData(order) {
    // 取得客戶資料
    const customer = order.customer || {};
    const shippingAddress = order.shipping_address || {};

    // 處理地址分行
    const addressFields = {
      address1: shippingAddress.address1 || '',
      address2: shippingAddress.address2 || '',
      province: shippingAddress.province || '',
      country: shippingAddress.country || '',
      zip: shippingAddress.zip || '',
    };

    const splitAddressResult = addressSplitter.splitAddress(addressFields);

    // 計算報關金額
    const customsValue = this.calculateCustomsValue(order.line_items);

    // 構建商品資料
    const items = Array.isArray(order.line_items)
      ? order.line_items.map((item) => ({
          sku: item.sku || '',
          name: item.title || '',
          quantity: item.quantity || 1,
          price: item.price || '0',
        }))
      : [];

    // 返回標準化的訂單資料
    return {
      shopify_order_id: order.id,
      order_number: order.order_number,
      customer_name:
        `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
        shippingAddress.name ||
        'Unknown',
      original_total_price: order.total_price || '0', // 保留原始總金額作為參考
      total_price: customsValue.toString(), // 使用報關金額作為總金額
      currency: 'USD', // 統一使用 USD
      customs_value: customsValue,
      original_address_1: shippingAddress.address1 || '',
      original_address_2: shippingAddress.address2 || '',
      processed_address_1: splitAddressResult.address1,
      processed_address_2: splitAddressResult.address2,
      processed_address_3: splitAddressResult.address3,
      country_code: shippingAddress.country_code || '',
      city: shippingAddress.city || '',
      postal_code: shippingAddress.zip || '',
      province: shippingAddress.province || '',
      items,
      status: 'pending_review', // 初始狀態: pending_review, approved, processing, completed, failed
      created_at: new Date().toISOString(),
    };
  }

  /**
   * 取得並處理所有未出貨訂單
   * @returns {Promise<Array>} 處理後的訂單陣列
   */
  async fetchAndProcessOrders() {
    try {
      logger.info('開始從 Shopify 獲取未出貨訂單...');
      // 1. 僅獲取 fulfillment_status=unfulfilled 的訂單
      const orders = await this.getUnfulfilledOrders();
      if (orders.length === 0) {
        logger.info('目前沒有未出貨訂單');
        return [];
      }
      logger.success(`成功獲取 ${orders.length} 筆未出貨訂單`);
      // 2. 處理訂單資料（可依需求篩選國家）
      const processedOrders = orders.map((order) =>
        this.processOrderData(order)
      );
      // 將處理後的訂單更新至 Firestore
      await this.updateOrdersInFirestore(processedOrders);
      return processedOrders;
    } catch (error) {
      logger.error(`取得並處理訂單時發生錯誤: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新訂單到 Firestore
   * @param {Array} processedOrders 處理後的訂單陣列
   */
  async updateOrdersInFirestore(processedOrders) {
    try {
      logger.info(`開始更新 ${processedOrders.length} 筆訂單到 Firestore...`);

      // 批次處理訂單
      const batchSize = 10;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < processedOrders.length; i += batchSize) {
        const batch = processedOrders.slice(i, i + batchSize);

        for (const order of batch) {
          try {
            // 轉換為 Firestore 格式
            const firestoreOrder = this.transformToFirestoreFormat(order);
            await this.databaseService.upsertOrder(firestoreOrder);
            successCount++;
          } catch (error) {
            errorCount++;
            logger.error(
              `更新訂單 ${order.shopify_order_id} 失敗: ${error.message}`
            );
          }
        }

        // 批次間稍作延遲
        if (i + batchSize < processedOrders.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      logger.success(
        `Firestore 更新完成：${successCount} 成功，${errorCount} 失敗`
      );
    } catch (error) {
      logger.error(`更新訂單到 Firestore 失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 轉換訂單資料為 Firestore 格式
   * @param {Object} order 原始訂單資料
   * @returns {Object} Firestore 格式的訂單資料
   */
  transformToFirestoreFormat(order) {
    return {
      // === Shopify 原始資料 ===
      shopify_order_id: order.shopify_order_id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      phone: order.phone,

      // === 地址資訊 ===
      original_address: {
        address1: order.original_address_1 || '',
        address2: order.original_address_2 || '',
        city: order.city || '',
        province: order.province || '',
        postal_code: order.postal_code || '',
        country_code: order.country_code || '',
      },

      // === 處理後地址 ===
      processed_address: {
        address1: order.processed_address_1 || '',
        address2: order.processed_address_2 || '',
        address3: order.processed_address_3 || '',
      },

      // === 金額資訊 ===
      pricing: {
        original_total: parseFloat(order.original_total_price) || 0,
        customs_value: order.customs_value || 0,
        currency: order.currency || 'USD',
      },

      // === 商品資訊 ===
      items: order.items || [],

      // === 狀態追蹤 ===
      status: {
        current: order.status || 'pending_review',
        shopify_fulfillment: 'unfulfilled',
        fedex_shipment: 'not_created',
      },

      // === FedEx 資訊 ===
      fedex: null,

      // === Shopify Fulfillment 資訊 ===
      shopify_fulfillment: {
        fulfillment_id: null,
        tracking_number: null,
        tracking_url: null,
        status: 'pending',
        error_message: null,
        retry_count: 0,
        last_attempt: null,
      },

      // === 時間戳記 ===
      timestamps: {
        created_at: order.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        failed_at: null,
      },
    };
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

module.exports = new ShopifyService();
