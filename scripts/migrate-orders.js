#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const databaseService = require('../src/services/databaseService');
const logger = require('../src/utils/logger');

/**
 * 轉換現有訂單資料格式為 Firestore 格式
 */
function transformOrderData(order) {
  // 確保有必要的欄位
  const transformedOrder = {
    // === Shopify 原始資料 ===
    shopify_order_id: order.shopify_order_id || order.id,
    order_number: order.order_number || order.name?.replace('#', ''),
    customer_name: order.customer?.first_name + ' ' + order.customer?.last_name,
    customer_email: order.customer?.email,
    phone: order.customer?.phone,

    // === 地址資訊 ===
    original_address: {
      address1: order.shipping_address?.address1 || '',
      address2: order.shipping_address?.address2 || '',
      city: order.shipping_address?.city || '',
      province: order.shipping_address?.province || '',
      postal_code: order.shipping_address?.zip || '',
      country_code: order.shipping_address?.country_code || '',
    },

    // === 處理後地址（如果存在） ===
    processed_address: order.processed_address || {
      address1: '',
      address2: '',
      address3: '',
    },

    // === 金額資訊 ===
    pricing: {
      original_total: parseFloat(order.total_price) || 0,
      customs_value: order.customs_value || 0,
      currency: order.currency || 'USD',
    },

    // === 商品資訊 ===
    items:
      order.line_items?.map((item) => ({
        sku: item.sku || '',
        name: item.name || '',
        quantity: item.quantity || 0,
        price: parseFloat(item.price) || 0,
      })) || [],

    // === 狀態追蹤 ===
    status: {
      current: order.status || 'pending_review',
      shopify_fulfillment: order.fulfillment_status || 'unfulfilled',
      fedex_shipment: order.fedex_tracking ? 'created' : 'not_created',
    },

    // === FedEx 資訊（如果存在） ===
    fedex: order.fedex_tracking
      ? {
          tracking_number: order.fedex_tracking,
          transaction_id: order.fedex_transaction_id || '',
          service_type: order.fedex_service_type || 'INTERNATIONAL_PRIORITY',
          service_name: order.fedex_service_name || 'International Priority®',
          ship_datestamp: order.fedex_ship_datestamp || '',
          service_category: order.fedex_service_category || 'EXPRESS',
          created_at: order.fedex_created_at || new Date().toISOString(),
        }
      : null,

    // === Shopify Fulfillment 資訊 ===
    shopify_fulfillment: {
      fulfillment_id: null,
      tracking_number: order.fedex_tracking || null,
      tracking_url: order.fedex_tracking
        ? `https://www.fedex.com/fedextrack/?trknbr=${order.fedex_tracking}`
        : null,
      status: 'pending',
      error_message: null,
      retry_count: 0,
      last_attempt: null,
    },

    // === 時間戳記 ===
    timestamps: {
      created_at: order.created_at || new Date().toISOString(),
      updated_at: order.updated_at || new Date().toISOString(),
      completed_at: order.completed_at || null,
      failed_at: order.failed_at || null,
    },
  };

  return transformedOrder;
}

/**
 * 遷移訂單資料
 */
async function migrateOrders() {
  console.log('🔄 開始遷移訂單資料...\n');

  try {
    // 讀取現有的 orders.json
    const ordersFilePath = path.join(__dirname, '..', 'orders.json');

    if (!fs.existsSync(ordersFilePath)) {
      console.log('❌ orders.json 檔案不存在');
      return;
    }

    const ordersData = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
    const orders = Array.isArray(ordersData) ? ordersData : [ordersData];

    console.log(`📊 找到 ${orders.length} 筆訂單資料`);

    // 批次處理訂單
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      console.log(
        `\n🔄 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(orders.length / batchSize)} (${batch.length} 筆訂單)`
      );

      for (const order of batch) {
        try {
          const transformedOrder = transformOrderData(order);
          await databaseService.upsertOrder(transformedOrder);
          successCount++;
          console.log(
            `  ✅ 訂單 ${transformedOrder.shopify_order_id} 遷移成功`
          );
        } catch (error) {
          errorCount++;
          const errorInfo = {
            orderId: order.shopify_order_id || order.id,
            error: error.message,
          };
          errors.push(errorInfo);
          console.log(
            `  ❌ 訂單 ${errorInfo.orderId} 遷移失敗: ${error.message}`
          );
        }
      }

      // 批次間稍作延遲，避免 API 限制
      if (i + batchSize < orders.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 輸出遷移結果
    console.log('\n📈 遷移結果統計:');
    console.log(`  - 總訂單數: ${orders.length}`);
    console.log(`  - 成功遷移: ${successCount}`);
    console.log(`  - 遷移失敗: ${errorCount}`);
    console.log(
      `  - 成功率: ${((successCount / orders.length) * 100).toFixed(2)}%`
    );

    if (errors.length > 0) {
      console.log('\n❌ 遷移失敗的訂單:');
      errors.forEach((error) => {
        console.log(`  - 訂單 ${error.orderId}: ${error.error}`);
      });
    }

    // 驗證遷移結果
    console.log('\n🔍 驗證遷移結果...');
    const migratedOrders = await databaseService.getAllOrders(orders.length);
    console.log(`  - Firestore 中的訂單數: ${migratedOrders.length}`);
    console.log(
      `  - 資料一致性: ${migratedOrders.length === successCount ? '✅' : '❌'}`
    );

    if (migratedOrders.length === successCount) {
      console.log('\n🎉 遷移完成！所有訂單資料已成功遷移到 Firestore');
    } else {
      console.log('\n⚠️  遷移完成，但資料數量不一致，請檢查錯誤日誌');
    }
  } catch (error) {
    console.error('❌ 遷移過程中發生錯誤:', error.message);
    logger.error('訂單遷移失敗', { error: error.message });
    process.exit(1);
  }
}

/**
 * 驗證遷移結果
 */
async function validateMigration() {
  console.log('🔍 驗證遷移結果...\n');

  try {
    // 讀取原始資料
    const ordersFilePath = path.join(__dirname, '..', 'orders.json');
    const originalOrders = JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
    const originalCount = Array.isArray(originalOrders)
      ? originalOrders.length
      : 1;

    // 讀取 Firestore 資料
    const migratedOrders = await databaseService.getAllOrders(originalCount);

    console.log('📊 資料比對:');
    console.log(`  - 原始訂單數: ${originalCount}`);
    console.log(`  - 遷移後訂單數: ${migratedOrders.length}`);
    console.log(
      `  - 資料完整性: ${migratedOrders.length === originalCount ? '✅' : '❌'}`
    );

    // 檢查狀態分佈
    const statusCounts = {};
    migratedOrders.forEach((order) => {
      const status = order.status?.current || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('\n📈 狀態分佈:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} 筆`);
    });

    return migratedOrders.length === originalCount;
  } catch (error) {
    console.error('❌ 驗證失敗:', error.message);
    return false;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'validate') {
    validateMigration().then((success) => {
      process.exit(success ? 0 : 1);
    });
  } else {
    migrateOrders().then(() => {
      console.log('\n✅ 遷移腳本執行完成');
    });
  }
}

module.exports = {
  migrateOrders,
  validateMigration,
  transformOrderData,
};
