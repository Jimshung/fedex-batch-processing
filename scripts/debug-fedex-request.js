#!/usr/bin/env node

// debug-fedex-request.js - 調試 FedEx API 請求
require('dotenv').config();
const OrderFileService = require('../src/services/orderFileService');
const fedexService = require('../src/services/fedexService');
const logger = require('../src/utils/logger');

async function debugFedexRequest() {
  try {
    logger.info('=== 調試 FedEx API 請求 ===');

    const orderFileService = new OrderFileService();

    // 取得訂單 #90086
    const allOrders = await orderFileService.readOrders();
    const order = allOrders.find((o) => o.order_number === 90086);

    if (!order) {
      logger.error('找不到訂單 #90086');
      return;
    }

    logger.info('訂單資料:');
    console.log(JSON.stringify(order, null, 2));

    // 準備 FedEx 請求
    const shipmentRequest = fedexService.prepareShipmentRequest(order);

    logger.info('\nFedEx API 請求內容:');
    console.log(JSON.stringify(shipmentRequest, null, 2));

    // 檢查 labelResponseOptions 是否存在
    const hasLabelResponseOptions =
      shipmentRequest.requestedShipment.hasOwnProperty('labelResponseOptions');
    logger.info(`\nlabelResponseOptions 存在: ${hasLabelResponseOptions}`);

    if (hasLabelResponseOptions) {
      logger.info(
        `labelResponseOptions 值: ${shipmentRequest.requestedShipment.labelResponseOptions}`
      );
    }
  } catch (error) {
    logger.error(`調試過程中發生錯誤: ${error.message}`);
    console.error(error.stack);
  }
}

// 執行調試
if (require.main === module) {
  debugFedexRequest()
    .then(() => {
      logger.info('=== 調試完成 ===');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`調試失敗: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { debugFedexRequest };
