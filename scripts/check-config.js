// check-config.js - 環境設定檢查
const config = require('../src/config/config');
const logger = require('../src/utils/logger');

function checkConfig() {
  logger.info('🔍 檢查環境設定...');

  const requiredConfigs = [
    { name: 'SHOPIFY_SHOP_NAME', value: config.shopify.shopName },
    { name: 'SHOPIFY_ACCESS_TOKEN', value: config.shopify.accessToken },
    { name: 'FEDEX_CLIENT_ID', value: config.fedex.clientId },
    { name: 'FEDEX_CLIENT_SECRET', value: config.fedex.clientSecret },
    { name: 'FEDEX_ACCOUNT_NUMBER', value: config.fedex.accountNumber },
    { name: 'GOOGLE_CLIENT_ID', value: config.google.clientId },
    { name: 'GOOGLE_CLIENT_SECRET', value: config.google.clientSecret },
    { name: 'SESSION_SECRET', value: config.session.secret },
    { name: 'JWT_SECRET', value: config.jwt.secret },
  ];

  let allValid = true;

  requiredConfigs.forEach(({ name, value }) => {
    if (!value) {
      logger.error(`❌ 缺少必要設定: ${name}`);
      allValid = false;
    } else {
      logger.success(
        `✅ ${name}: ${name.includes('TOKEN') || name.includes('SECRET') ? '***已設定***' : value}`
      );
    }
  });

  if (allValid) {
    logger.success('🎉 所有環境設定都正確！');
    return true;
  } else {
    logger.error('❌ 請檢查並設定缺少的環境變數');
    return false;
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  const isValid = checkConfig();
  process.exit(isValid ? 0 : 1);
}

module.exports = { checkConfig };
