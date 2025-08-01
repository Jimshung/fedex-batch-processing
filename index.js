// index.js
require('dotenv').config();
const axios = require('axios');

// --- 從環境變數讀取 Shopify 設定 ---
const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-07'; // 建議使用最新的穩定版本

// 檢查必要的環境變數
if (!SHOPIFY_SHOP_NAME || !SHOPIFY_ACCESS_TOKEN) {
  console.error(
    '❌ 錯誤：請在環境變數中設定 SHOPIFY_SHOP_NAME 和 SHOPIFY_ACCESS_TOKEN。'
  );
  process.exit(1);
}

// 建構 Shopify API 的基礎 URL
const shopifyApiUrl = `https://${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}/orders.json`;

/**
 * 主要執行函式：獲取未出貨的訂單
 */
async function fetchUnfulfilledOrders() {
  console.log('🚀 開始執行輪詢任務：從 Shopify 獲取未出貨訂單...');

  try {
    const response = await axios.get(shopifyApiUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      params: {
        // 這是關鍵的篩選條件
        fulfillment_status: 'unfulfilled',
        status: 'open', // 只獲取開啟的訂單
        limit: 50, // 每次最多獲取 50 筆
      },
    });

    const orders = response.data.orders;

    if (orders && orders.length > 0) {
      console.log(`✅ 成功獲取 ${orders.length} 筆未出貨訂單！`);

      // 為了方便我們設計後續流程，將第一筆訂單的完整資料印出來
      console.log('📄 第一筆訂單的範例資料 (JSON):');
      console.log(JSON.stringify(orders[0], null, 2));

      // 在這裡，我們未來會加入將這些訂單存入 Firestore 的邏輯
      // for (const order of orders) { ... }
    } else {
      console.log('ℹ️  目前沒有需要處理的未出貨訂單。');
    }

    console.log('✅ 輪詢任務執行完畢。');
  } catch (error) {
    console.error('❌ 獲取 Shopify 訂單時發生錯誤:');
    if (error.response) {
      console.error(`HTTP 狀態: ${error.response.status}`);
      console.error('錯誤詳情:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// 執行主函式
fetchUnfulfilledOrders();
