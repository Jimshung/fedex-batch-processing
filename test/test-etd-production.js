// 載入 .env.prod 環境變數
require('dotenv').config({ path: '.env.prod' });

const OrderProcessingService = require('../src/services/orderProcessingService');
const logger = require('../src/utils/logger');

async function testEtdProduction() {
  try {
    logger.info('=== 開始測試 ETD 貨運功能（正式環境） ===');

    const orderProcessingService = new OrderProcessingService();

    // 測試訂單資料（使用訂單 #90084）
    const testOrder = {
      shopify_order_id: 5963279499323,
      order_number: '90084',
      customer_name: 'Teresa Test',
      original_address_1:
        '1 Jalan Anak Bukit, #08-14 Sherwood Towers (Low-Rise)',
      original_address_2: '',
      processed_address_1: '1 Jalan Anak Bukit, #08-14 Sherwood',
      processed_address_2: 'Towers (Low-Rise)',
      processed_address_3: '',
      country_code: 'SG',
      city: 'Singapore',
      postal_code: '588996',
      province: '',
      customs_value: 28,
      items: [
        {
          name: 'Neuralli MP - Asia',
          quantity: 1,
          price: 28,
        },
      ],
      status: 'approved',
    };

    logger.info(`準備處理訂單 #${testOrder.order_number}`);

    // 直接測試貨運建立流程（使用固定的 IMAGE_1 和 IMAGE_2 引用）
    logger.info('測試貨運建立流程');

    const shipmentResult =
      await orderProcessingService.fedexService.processOrderShipment(testOrder);

    if (shipmentResult.success) {
      logger.success(`✅ 貨運建立成功！`);
      logger.info(`📦 追蹤號碼: ${shipmentResult.trackingNumber}`);
      logger.info(`🏷️ 標籤 URL: ${shipmentResult.labelUrl ? '已生成' : '無'}`);
    } else {
      logger.error(`❌ 貨運建立失敗: ${shipmentResult.error}`);
    }

    logger.info('=== 測試完成 ===');
  } catch (error) {
    logger.error(`測試過程中發生錯誤: ${error.message}`);
    console.error(error);
  }
}

// 執行測試
testEtdProduction();
