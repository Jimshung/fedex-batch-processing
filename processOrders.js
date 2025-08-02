// processOrders.js
// 這是一個在本地端執行的腳本，用於：
// 1. 從 Shopify 獲取所有未出貨訂單。
// 2. 篩選出運送到指定亞洲國家的訂單。
// 3. 對篩選後的訂單進行初步處理 (例如：地址分行)。
// 4. 將處理結果儲存為一個 JSON 檔案。

require('dotenv').config();
const axios = require('axios');
const fs = require('fs/promises'); // 引入 Node.js 的檔案系統模組

// --- 從環境變數讀取 Shopify 設定 ---
const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-07';

// --- 新增：定義我們要篩選的國家代碼 ---
// 根據你的要求更新
const ASIA_FEDEX_COUNTRY_CODES = [
  'JP', // 日本
  'KR', // 韓國
  'SG', // 新加坡
  'PH', // 菲律賓
  'AU', // 澳洲
  'NZ', // 紐西蘭
  'TH', // 泰國
];

// 檢查必要的環境變數
if (!SHOPIFY_SHOP_NAME || !SHOPIFY_ACCESS_TOKEN) {
  console.error(
    '❌ 錯誤：請在 .env 檔案中設定 SHOPIFY_SHOP_NAME 和 SHOPIFY_ACCESS_TOKEN。'
  );
  process.exit(1);
}

const shopifyApiUrl = `https://${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}/orders.json`;

/**
 * 商業邏輯 1：處理地址分行
 * @param {object} address - Shopify 訂單中的地址物件
 * @returns {object} 包含 address1 和 address2 的新地址物件
 */
function processAddress(address) {
  if (!address || !address.address1) {
    return { address1: '', address2: '' };
  }

  const MAX_LENGTH = 35;
  let address1 = address.address1;
  let address2 = address.address2 || ''; // 如果原本就有 address2，就沿用

  if (address1.length > MAX_LENGTH) {
    console.log(`  -> 地址過長，嘗試分行: "${address1}"`);
    // 簡單的分行邏輯：從後面找到第一個空格或逗號
    let splitIndex = address1.substring(0, MAX_LENGTH).lastIndexOf(' ');
    if (splitIndex === -1) {
      splitIndex = address1.substring(0, MAX_LENGTH).lastIndexOf(',');
    }

    if (splitIndex !== -1) {
      const part1 = address1.substring(0, splitIndex).trim();
      const part2 = address1.substring(splitIndex + 1).trim();
      address1 = part1;
      address2 = `${part2} ${address2}`.trim(); // 將切出來的部分與原有的 address2 合併
      console.log(`     分行結果: "${address1}" | "${address2}"`);
    }
  }
  return { address1, address2 };
}

/**
 * 主要執行函式
 */
async function main() {
  console.log('🚀 開始執行本地任務：從 Shopify 獲取並處理訂單...');

  try {
    // 步驟 1: 獲取所有未出貨的 Shopify 訂單
    const response = await axios.get(shopifyApiUrl, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      params: {
        fulfillment_status: 'unfulfilled',
        status: 'open',
        limit: 250, // 增加 limit 以確保能一次性獲取所有訂單
      },
    });
    const allUnfulfilledOrders = response.data.orders;

    if (!allUnfulfilledOrders || allUnfulfilledOrders.length === 0) {
      console.log('ℹ️  目前沒有需要處理的未出貨訂單。');
      return;
    }
    console.log(
      `✅ 成功獲取 ${allUnfulfilledOrders.length} 筆未出貨訂單，現在開始進行篩選...`
    );

    // 步驟 1.5: 在我們的程式碼中，根據國家代碼進行篩選
    const filteredOrders = allUnfulfilledOrders.filter((order) => {
      const countryCode = order.shipping_address?.country_code;
      return countryCode && ASIA_FEDEX_COUNTRY_CODES.includes(countryCode);
    });

    if (filteredOrders.length === 0) {
      console.log(
        `ℹ️  在 ${allUnfulfilledOrders.length} 筆未出貨訂單中，沒有找到符合指定國家篩選條件的訂單。`
      );
      return;
    }
    console.log(
      `✅ 篩選完成！找到 ${filteredOrders.length} 筆符合條件的訂單。`
    );

    // 步驟 2: 處理每一筆篩選後的訂單，並轉換成我們需要的格式
    const processedOrders = filteredOrders.map((order) => {
      console.log(`處理中... 訂單 #${order.order_number}`);
      const { address1, address2 } = processAddress(order.shipping_address);

      // 回傳一個更簡潔、更符合我們需求的物件結構
      return {
        shopify_order_id: order.id,
        order_number: order.order_number,
        customer_name: `${order.shipping_address?.last_name || ''}${
          order.shipping_address?.first_name || ''
        }`,
        total_price: order.total_price,
        currency: order.currency,
        original_address_1: order.shipping_address?.address1 || '',
        original_address_2: order.shipping_address?.address2 || '',
        processed_address_1: address1, // 處理後的新地址
        processed_address_2: address2, // 處理後的新地址
        items: order.line_items.map((item) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        status: 'pending_review', // 為 Serena 的審核流程設定初始狀態
      };
    });

    // 步驟 3: 將處理結果寫入本地檔案
    await fs.writeFile('orders.json', JSON.stringify(processedOrders, null, 2));
    console.log(
      '\n✅ 處理完成！所有符合條件的訂單資料已儲存至 `orders.json` 檔案。'
    );
    console.log('下一步：你可以打開 `orders.json` 檢查處理結果是否符合預期。');
  } catch (error) {
    console.error('❌ 處理訂單時發生錯誤:');
    if (error.response) {
      console.error(`HTTP 狀態: ${error.response.status}`);
      console.error('錯誤詳情:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// 執行主函式
main();
