#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const shopifyService = require('../src/services/shopifyService');
const databaseService = require('../src/services/databaseService');
const logger = require('../src/utils/logger');

/**
 * 同步 Shopify 訂單資料
 */
async function syncShopifyOrders() {
  console.log('🔄 開始同步 Shopify 訂單資料...\n');

  try {
    // 取得未出貨的訂單
    const unfulfilledOrders = await shopifyService.getUnfulfilledOrders();
    console.log(`✅ 成功獲取 ${unfulfilledOrders.length} 筆未出貨訂單`);

    if (unfulfilledOrders.length === 0) {
      console.log('📭 沒有找到未出貨的訂單');
      return;
    }

    // 更新到 Firestore
    await shopifyService.updateOrdersInFirestore(
      unfulfilledOrders.map((order) => shopifyService.processOrderData(order))
    );

    console.log('✅ Shopify 訂單同步完成！');
  } catch (error) {
    console.error('❌ 同步過程中發生錯誤:', error.message);
    logger.error('Shopify 訂單同步失敗', { error: error.message });
    process.exit(1);
  }
}

/**
 * 顯示訂單詳細資訊
 */
async function showOrderDetails() {
  try {
    const orders = await databaseService.getAllOrders(1000);

    console.log('\n📋 訂單詳細資訊:');
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. 訂單 #${order.order_number}`);
      console.log(`   - 客戶: ${order.customer_name}`);
      console.log(`   - 狀態: ${order.status?.current || 'unknown'}`);
      console.log(
        `   - 國家: ${order.original_address?.country_code || 'unknown'}`
      );
      console.log(
        `   - 總金額: ${order.pricing?.original_total || 0} ${order.pricing?.currency || 'USD'}`
      );
      if (order.fedex?.tracking_number) {
        console.log(`   - FedEx 追蹤號: ${order.fedex.tracking_number}`);
      }
    });
  } catch (error) {
    console.error('❌ 顯示訂單詳細資訊失敗:', error.message);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'details') {
    showOrderDetails();
  } else {
    syncShopifyOrders();
  }
}

module.exports = {
  syncShopifyOrders,
  showOrderDetails,
};
