// FedEx API 認證入門腳本 (Node.js)
// 目的：使用您的 FedEx 開發者帳號，成功獲取 API 存取權杖 (Access Token)。
// 這是與 FedEx API 溝通的第一步。

// 引入必要的套件
const axios = require('axios'); // 用於發送 HTTP 請求
require('dotenv').config(); // 讀取 .env 檔案中的環境變數

// 設定您的 FedEx API 金鑰
const clientId = process.env.FEDEX_CLIENT_ID;
const clientSecret = process.env.FEDEX_CLIENT_SECRET;

// FedEx API 的認證網址 (測試環境)
const fedexAuthUrl = 'https://apis-sandbox.fedex.com/oauth/token';

/**
 * 主要執行函式
 */
async function main() {
  console.log('🚀 開始向 FedEx [測試環境] 請求 Access Token...');

  // 檢查金鑰是否存在
  if (!clientId || !clientSecret || clientId === 'YOUR_CLIENT_ID_HERE') {
    console.error(
      '❌ 錯誤：請先在 .env 檔案中設定您的 FEDEX_CLIENT_ID 和 FEDEX_CLIENT_SECRET'
    );
    return;
  }

  try {
    // 發送 POST 請求以獲取 Access Token
    const response = await axios.post(
      fedexAuthUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // 從回應中取得 access_token
    const accessToken = response.data.access_token;

    console.log('✅ 成功獲取 Access Token！');
    console.log('🔑 Token:', accessToken);
    console.log('--------------------------------------------------');
    console.log('下一步：您現在可以使用這個 Token 去呼叫其他的 FedEx API。');
  } catch (error) {
    console.error('❌ 獲取 Access Token 時發生錯誤:');
    if (error.response) {
      // API 回傳了錯誤訊息
      console.error('HTTP 狀態:', error.response.status);
      console.error('錯誤詳情:', error.response.data);
    } else {
      // 其他錯誤 (例如網路問題)
      console.error(error.message);
    }
  }
}

// 執行主函式
main();
