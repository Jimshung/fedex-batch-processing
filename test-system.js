// test-system.js - 系統功能測試
const logger = require('./src/utils/logger');
const googleSheetService = require('./src/services/googleSheetService');
const shopifyService = require('./src/services/shopifyService');
const fedexService = require('./src/services/fedexService');
const orderProcessingService = require('./src/services/orderProcessingService');
const config = require('./src/config/config');

async function testSystem() {
  try {
    logger.info('🧪 開始系統功能測試...');

    // 1. 測試 Google Sheets 服務
    logger.info('📊 測試 Google Sheets 服務...');
    try {
      const existingOrders = await googleSheetService.readExistingOrders(
        config.google.sheetId
      );
      logger.success(
        `✅ Google Sheets 服務正常，現有訂單數: ${existingOrders.size}`
      );
    } catch (error) {
      logger.error(`❌ Google Sheets 服務測試失敗: ${error.message}`);
    }

    // 2. 測試 Shopify 服務
    logger.info('🛍️ 測試 Shopify 服務...');
    try {
      const orders = await shopifyService.getUnfulfilledOrders({ limit: 5 });
      logger.success(
        `✅ Shopify 服務正常，獲取到 ${orders.length} 筆未出貨訂單`
      );
    } catch (error) {
      logger.error(`❌ Shopify 服務測試失敗: ${error.message}`);
    }

    // 3. 測試 FedEx 服務
    logger.info('🚚 測試 FedEx 服務...');
    try {
      const accessToken = await fedexService.getAccessToken();
      logger.success(`✅ FedEx 服務正常，成功獲取存取權杖`);
    } catch (error) {
      logger.error(`❌ FedEx 服務測試失敗: ${error.message}`);
    }

    // 4. 測試訂單處理服務
    logger.info('⚙️ 測試訂單處理服務...');
    try {
      const stats = await orderProcessingService.getProcessingStats();
      logger.success(`✅ 訂單處理服務正常，統計資訊: ${JSON.stringify(stats)}`);
    } catch (error) {
      logger.error(`❌ 訂單處理服務測試失敗: ${error.message}`);
    }

    // 5. 測試 Google Sheet 初始化
    logger.info('📋 測試 Google Sheet 初始化...');
    try {
      await googleSheetService.initializeSheet(config.google.sheetId);
      logger.success(`✅ Google Sheet 初始化成功`);
    } catch (error) {
      logger.error(`❌ Google Sheet 初始化失敗: ${error.message}`);
    }

    logger.success('🎉 系統功能測試完成！');
  } catch (error) {
    logger.error(`❌ 系統測試過程中發生錯誤: ${error.message}`);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  testSystem();
}

module.exports = { testSystem };
