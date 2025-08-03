// config.js - 集中管理環境變數和配置
require("dotenv").config();

module.exports = {
  shopify: {
    shopName: process.env.SHOPIFY_SHOP_NAME,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: "2024-07",
  },
  google: {
    sheetId: process.env.GOOGLE_SHEET_ID,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  },
  fedex: {
    clientId: process.env.FEDEX_CLIENT_ID,
    clientSecret: process.env.FEDEX_CLIENT_SECRET,
    accountNumber: process.env.FEDEX_ACCOUNT_NUMBER,
  },
  asiaCountries: ["JP", "KR", "SG", "PH", "AU", "NZ", "TH"],
};
