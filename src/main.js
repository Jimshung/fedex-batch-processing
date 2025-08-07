// main.js - 應用程式入口點
const logger = require('./utils/logger');
const shopifyService = require('./services/shopifyService');
const googleSheetService = require('./services/googleSheetService');
const config = require('./config/config');

async function processOrders() {
  try {
    logger.info('開始處理訂單流程...');

    // 1. 從 Shopify 獲取未出貨訂單
    logger.info('從 Shopify 獲取未出貨訂單...');
    const orders = await shopifyService.getUnfulfilledOrders();

    if (orders.length === 0) {
      logger.info('目前沒有需要處理的未出貨訂單。');
      return;
    }
    logger.success(`成功獲取 ${orders.length} 筆未出貨訂單`);

    // 2. 篩選亞洲國家訂單
    logger.info('篩選亞洲國家訂單...');
    const asiaOrders = shopifyService.filterOrdersByCountry(
      orders,
      config.asiaCountries
    );

    if (asiaOrders.length === 0) {
      logger.info('沒有符合亞洲國家條件的訂單。');
      return;
    }
    logger.success(`篩選完成，共 ${asiaOrders.length} 筆亞洲訂單`);

    // 3. 寫入 Google Sheet (只寫入新訂單，使用新的欄位結構)
    logger.info('開始寫入新訂單至 Google Sheet...');
    const result = await googleSheetService.writeOrdersToSheet(
      asiaOrders,
      config.google.sheetId
    );

    if (result.appendedRows) {
      logger.success(
        `成功追加 ${result.appendedRows} 筆新訂單至工作表: ${result.sheetName}`
      );
    } else {
      logger.info(result.message || '沒有新訂單需要寫入');
    }
    logger.success('訂單處理流程完成！');
  } catch (error) {
    logger.error(`處理訂單時發生錯誤: ${error.message}`);
    process.exit(1);
  }
}

// 執行主程序
processOrders();
