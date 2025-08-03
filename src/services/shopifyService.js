// shopifyService.js - Shopify API 相關服務
const axios = require('axios');
const config = require('../config/config');

class ShopifyService {
  constructor() {
    this.baseUrl = `https://${config.shopify.shopName}.myshopify.com/admin/api/${config.shopify.apiVersion}`;
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

  filterOrdersByCountry(orders, countryCodes) {
    return orders.filter((order) =>
      countryCodes.includes(order.shipping_address?.country_code)
    );
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
