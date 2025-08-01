// FedEx API 認證與訂單獲取腳本 (Node.js)
// 目的：獲取 Access Token 並使用它來獲取貨件列表

// 引入必要的套件
const axios = require('axios'); // 用於發送 HTTP 請求
require('dotenv').config(); // 讀取 .env 檔案中的環境變數

// 設定您的 FedEx API 金鑰
const clientId = process.env.FEDEX_CLIENT_ID;
const clientSecret = process.env.FEDEX_CLIENT_SECRET;
const accountNumber = process.env.FEDEX_ACCOUNT_NUMBER; // 新增：讀取您的 FedEx 帳號

// FedEx API 的認證網址 (測試環境)
const fedexApiBaseUrl = 'https://apis-sandbox.fedex.com';

/**
 * 獲取 Access Token 的函式
 */
async function getAccessToken() {
  console.log('🚀 開始向 FedEx [測試環境] 請求 Access Token...');

  if (!clientId || !clientSecret || clientId === 'YOUR_CLIENT_ID_HERE') {
    throw new Error(
      '❌ 錯誤：請先在 .env 檔案中設定您的 FEDEX_CLIENT_ID 和 FEDEX_CLIENT_SECRET'
    );
  }

  try {
    const response = await axios.post(
      `${fedexApiBaseUrl}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    console.log('✅ 成功獲取 Access Token！');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ 獲取 Access Token 時發生錯誤:');
    if (error.response) {
      console.error('HTTP 狀態:', error.response.status);
      console.error('錯誤詳情:', error.response.data);
    } else {
      console.error(error.message);
    }
    throw error; // 拋出錯誤，中斷執行
  }
}

/**
 * 使用 Access Token 獲取貨件列表
 * @param {string} accessToken - 從 getAccessToken() 獲取的權杖
 */
async function getShipments(accessToken) {
  console.log('\n📦 開始使用 Token 獲取貨件列表...');

  if (!accountNumber) {
    console.error('❌ 錯誤：請在 .env 檔案中設定您的 FEDEX_ACCOUNT_NUMBER');
    return;
  }

  // --- API 端點分析 ---
  // 使用官方提供的公開API端點
  const shipmentsApiUrl = `${fedexApiBaseUrl}/ship/v1/shipments/search`;

  // 設定搜尋條件：搜尋過去30天內建立的貨件
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const beginDate = thirtyDaysAgo.toISOString().split('T')[0]; // 格式：YYYY-MM-DD
  const endDate = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD

  const requestBody = {
    searchCriteria: {
      createDateRange: {
        beginDate: beginDate,
        endDate: endDate,
      },
      accountNumber: {
        value: accountNumber,
      },
    },
    resultsPerPage: 100,
    resultOffset: 0,
  };

  try {
    console.log('🔍 正在搜尋 ' + beginDate + ' 至 ' + endDate + ' 的貨件...');
    console.log('📋 帳戶號碼:', accountNumber);
    console.log('ℹ️ 注意：測試環境可能沒有數據，這是正常現象');

    const response = await axios.post(shipmentsApiUrl, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-locale': 'zh_TW',
      },
    });

    // 檢查是否有數據
    if (
      !response.data ||
      !response.data.shipments ||
      response.data.shipments.length === 0
    ) {
      console.log('ℹ️ 成功呼叫API，但測試環境中沒有找到任何貨件數據');
      console.log('ℹ️ 這可能是因為測試環境是空的，並不代表API有問題');
      return;
    }

    console.log('✅ 成功獲取貨件列表！');
    console.log('📄 API 回應 (JSON):');
    console.log(JSON.stringify(response.data, null, 2)); // 將回傳的 JSON 格式化後印出

    console.log('\n--------------------------------------------------');
    console.log(
      '🎉 太棒了！我們拿到了訂單資料！下一步就是根據這個 JSON 結構來設計我們的資料處理邏輯。'
    );
  } catch (error) {
    console.error('❌ 獲取貨件列表時發生錯誤:');
    if (error.response) {
      console.error('HTTP 狀態:', error.response.status);
      console.error('錯誤詳情:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

/**
 * 主要執行函式
 */
async function main() {
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      // 如果成功拿到 Token，就接著去獲取貨件列表
      await getShipments(accessToken);
    }
  } catch (error) {
    console.error('\n🛑 程式執行中斷，請修正錯誤後再試一次。');
  }
}

// 執行主函式
main();
