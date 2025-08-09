// main.js - 應用程式入口點
const logger = require('./utils/logger');
const shopifyService = require('./services/shopifyService');
const config = require('./config/config');

async function processOrders() {
  try {
    logger.info('開始處理訂單流程...');

    // 1. 從 Shopify 獲取並處理訂單，保存到 orders.json
    logger.info('從 Shopify 獲取並處理訂單...');
    const processedOrders = await shopifyService.fetchAndProcessOrders();

    if (processedOrders.length === 0) {
      logger.info('目前沒有新訂單需要處理。');
      return;
    }

    logger.success(
      `成功處理並保存 ${processedOrders.length} 筆新訂單到 orders.json`
    );

    logger.success('訂單處理流程完成！');
  } catch (error) {
    logger.error(`處理訂單時發生錯誤: ${error.message}`);
    process.exit(1);
  }
}

// 執行主程序
processOrders();
