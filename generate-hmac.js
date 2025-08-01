// generate-hmac.js
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const payloadPath = './test-payload.json';

if (
  !SHOPIFY_WEBHOOK_SECRET ||
  SHOPIFY_WEBHOOK_SECRET === 'your_shopify_webhook_shared_secret_here'
) {
  console.error('❌ 請先在 .env 檔案中設定一個測試用的 SHOPIFY_WEBHOOK_SECRET');
  process.exit(1);
}

try {
  // 讀取並格式化 JSON 確保與伺服器接收的格式一致
  const payload = JSON.stringify(
    JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
  );
  const hmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(payload, 'utf-8')
    .digest('base64');

  console.log('✅ 成功產生 HMAC 簽章！');
  console.log('請將此簽章用於您的 curl 請求的 X-Shopify-Hmac-Sha256 標頭中：');
  console.log('\n' + hmac + '\n');
} catch (error) {
  console.error('❌ 產生簽章時發生錯誤:', error.message);
}
