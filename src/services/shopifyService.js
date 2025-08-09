// shopifyService.js - Shopify API 相關服務
const axios = require('axios');
const config = require('../config/config');
const addressSplitter = require('../utils/addressSplitter');
const OrderFileService = require('./orderFileService');
const logger = require('../utils/logger');

class ShopifyService {
  constructor() {
    this.baseUrl = `https://${config.shopify.shopName}.myshopify.com/admin/api/${config.shopify.apiVersion}`;
    this.orderFileService = new OrderFileService();
  }

  async getUnfulfilledOrders(params = {}) {
    try {
      const response = await axios.get(`${this.baseUrl}/orders.json`, {
        headers: {
          'X-Shopify-Access-Token': config.shopify.accessToken,
          'Content-Type': 'application/json',
        },
        params: {
          fulfillment_status: 'unfulfilled',
          status: 'open',
          limit: 250,
          fields:
            'id,order_number,customer,line_items,shipping_address,total_price,currency',
          ...params,
        },
      });
      return response.data.orders || [];
    } catch (error) {
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

      // 1. 獲取所有未出貨訂單
      const orders = await this.getUnfulfilledOrders();

      if (orders.length === 0) {
        logger.info('目前沒有未出貨訂單');
        return [];
      }

      logger.success(`成功獲取 ${orders.length} 筆未出貨訂單`);

      // 2. 篩選亞洲國家訂單
      const asiaOrders = this.filterOrdersByCountry(
        orders,
        config.asiaCountries
      );

      if (asiaOrders.length === 0) {
        logger.info('沒有符合亞洲國家條件的訂單');
        return [];
      }

      logger.success(`篩選完成，共 ${asiaOrders.length} 筆亞洲訂單`);

      // 3. 處理訂單資料
      const processedOrders = asiaOrders.map((order) =>
        this.processOrderData(order)
      );

      // 4. 將處理好的訂單存入 orders.json
      const addedCount =
        await this.orderFileService.updateOrders(processedOrders);

      logger.success(`成功更新訂單資料，新增了 ${addedCount} 筆新訂單`);

      return processedOrders;
    } catch (error) {
      logger.error(`取得並處理訂單時發生錯誤: ${error.message}`);
      throw error;
    }
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
