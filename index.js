// index.js
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

// 在 Cloud Run 環境中，我們期望這個變數由服務設定提供。
// 我們只在它存在時才進行記錄，如果不存在，則在驗證函式中處理。
if (SHOPIFY_WEBHOOK_SECRET) {
  console.log('ℹ️  成功載入 SHOPIFY_WEBHOOK_SECRET。');
} else {
  console.warn(
    '⚠️  警告：未找到 SHOPIFY_WEBHOOK_SECRET 環境變數。Webhook 安全驗證將會失敗。'
  );
}

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

function verifyShopifyWebhook(req, res, next) {
  // 如果沒有設定密鑰，直接拒絕請求，增加安全性。
  if (!SHOPIFY_WEBHOOK_SECRET) {
    console.error('❌ 驗證失敗：伺服器端未設定 Webhook 密鑰。');
    return res.status(500).send('伺服器設定錯誤。');
  }

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

// 注意：verifyShopifyWebhook 依然保留，但你可以根據 Plan B 的說明暫時移除它來進行無金鑰測試。
app.post('/webhook/shopify/new-order', verifyShopifyWebhook, (req, res) => {
  console.log('🎉 收到新的訂單資料！');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send('接收成功');
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器正在監聽 port ${PORT}`);
});
