// sync-shopify-orders.js - 同步 Shopify 訂單
require('dotenv').config();
const shopifyService = require('../src/services/shopifyService');
const logger = require('../src/utils/logger');

async function syncShopifyOrders() {
  try {
    logger.info('開始同步 Shopify 訂單...');

    const processedOrders = await shopifyService.fetchAndProcessOrders();

    if (processedOrders.length > 0) {
      logger.success(`成功同步 ${processedOrders.length} 筆訂單`);
    } else {
      logger.info('沒有新訂單需要同步');
    }
  } catch (error) {
    logger.error(`同步 Shopify 訂單失敗: ${error.message}`);
    process.exit(1);
  }
}

// 執行同步
syncShopifyOrders();
