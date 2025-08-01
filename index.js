// index.js
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

if (!SHOPIFY_WEBHOOK_SECRET) {
  console.error('❌ 嚴重錯誤：找不到 SHOPIFY_WEBHOOK_SECRET 環境變數。');
  // 在 Cloud Run 環境中，我們期望這個變數由服務設定提供，
  // 如果找不到，直接退出是合理的行為。
  process.exit(1);
}
console.log('ℹ️  成功載入 SHOPIFY_WEBHOOK_SECRET。');

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  if (!hmacHeader) {
    console.error('❌ 驗證失敗：找不到 HMAC 標頭。');
    return res.status(401).send('無法驗證來源。');
  }

  const hash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, 'utf-8')
    .digest('base64');

  console.log(`[偵錯] 傳入的 HMAC: ${hmacHeader}`);
  console.log(`[偵錯] 計算的 HMAC: ${hash}`);

  if (hash === hmacHeader) {
    console.log('✅ Webhook 驗證成功！');
    next();
  } else {
    console.error('❌ 驗證失敗：HMAC 簽章不匹配。');
    res.status(403).send('簽章不匹配，禁止存取。');
  }
}

app.get('/', (req, res) => {
  res.send('Shopify Webhook 接收器已準備就緒！');
});

app.post('/webhook/shopify/new-order', verifyShopifyWebhook, (req, res) => {
  console.log('🎉 收到新的訂單資料！');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send('接收成功');
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器正在監聽 port ${PORT}`);
});
