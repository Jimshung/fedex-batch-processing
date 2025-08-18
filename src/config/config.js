// config.js - 集中管理環境變數和配置
// 只在非生產環境載入 dotenv
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

module.exports = {
  shopify: {
    shopName: process.env.SHOPIFY_SHOP_NAME,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2024-07',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  session: {
    secret: process.env.SESSION_SECRET,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  fedex: {
    apiBaseUrl:
      process.env.FEDEX_API_BASE_URL || 'https://apis-sandbox.fedex.com',
    clientId: process.env.FEDEX_CLIENT_ID,
    clientSecret: process.env.FEDEX_CLIENT_SECRET,
    accountNumber: process.env.FEDEX_ACCOUNT_NUMBER,
  },
  asiaCountries: ['JP', 'KR', 'SG', 'PH', 'AU', 'NZ', 'TH'],
};
