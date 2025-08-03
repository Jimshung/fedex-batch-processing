// processOrders.js (v2 - 整合 Google Sheets)
// 這是一個在本地端執行的腳本，用於：
// 1. 從 Shopify 獲取所有未出貨訂單。
// 2. 篩選出運送到指定亞洲國家的訂單。
// 3. 對篩選後的訂單進行初步處理 (例如：地址分行)。
// 4. 將處理結果直接寫入指定的 Google Sheet 中。

require('dotenv').config();
const axios = require('axios');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs/promises');

// --- 從環境變數讀取設定 ---
const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
const API_VERSION = '2024-07';

const ASIA_FEDEX_COUNTRY_CODES = ['JP', 'KR', 'SG', 'PH', 'AU', 'NZ', 'TH'];

// 檢查必要的環境變數
if (
  !SHOPIFY_SHOP_NAME ||
  !SHOPIFY_ACCESS_TOKEN ||
  !GOOGLE_SHEET_ID ||
  !GOOGLE_SERVICE_ACCOUNT_KEY_PATH
) {
  console.error('❌ 錯誤：請檢查 .env 檔案中的必要設定');
  process.exit(1);
}

const shopifyApiUrl = `https://${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/${API_VERSION}/orders.json`;

async function initGoogleSheets() {
  try {
    const auth = new GoogleAuth({
      keyFile: GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('❌ Google Sheets 初始化失敗:', error.message);
    process.exit(1);
  }
}

async function writeToGoogleSheet(orders, sheets) {
  console.log('\n🔄 開始將資料寫入 Google Sheet...');

  try {
    // 獲取第一個工作表的名稱
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      fields: 'sheets.properties.title',
    });
    const sheetName = spreadsheet.data.sheets[0].properties.title;
    console.log(`📊 工作表名稱: ${sheetName}`);

    // 定義表頭和資料
    const headerRow = [
      'Shopify Order ID',
      '訂單編號',
      '客戶名稱',
      '總金額',
      '貨幣',
    ];
    const rows = orders.map((order) => [
      order.shopify_order_id,
      order.order_number,
      order.customer_name,
      order.total_price,
      order.currency,
    ]);

    // 寫入資料
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headerRow, ...rows] },
    });

    console.log(`✅ 成功寫入 ${orders.length} 筆訂單資料至 Google Sheet！`);
  } catch (error) {
    console.error('❌ 寫入 Google Sheet 失敗:');
    if (error.response) {
      console.error(`HTTP 狀態: ${error.response.status}`);
      console.error('錯誤詳情:', error.response.data.error.message);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

async function main() {
  const sheets = await initGoogleSheets();

  try {
    // 獲取並處理 Shopify 訂單
    const response = await axios.get(shopifyApiUrl, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      params: { fulfillment_status: 'unfulfilled', status: 'open', limit: 250 },
    });

    const orders = response.data.orders || [];
    if (orders.length === 0) {
      console.log('ℹ️ 目前沒有需要處理的未出貨訂單。');
      return;
    }

    // 篩選亞洲訂單
    const asiaOrders = orders.filter((order) =>
      ASIA_FEDEX_COUNTRY_CODES.includes(order.shipping_address?.country_code)
    );

    if (asiaOrders.length === 0) {
      console.log('ℹ️ 沒有符合亞洲國家條件的訂單。');
      return;
    }

    // 寫入 Google Sheet
    await writeToGoogleSheet(asiaOrders, sheets);
    console.log('✅ 處理完成！請檢查 Google Sheet 確認資料。');
  } catch (error) {
    console.error('❌ 處理訂單時發生錯誤:', error.message);
  }
}

main();
