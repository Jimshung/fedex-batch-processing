// logger.js - 統一日誌記錄
const colors = {
  reset: "\x1b[0m",
  error: "\x1b[31m",
  success: "\x1b[32m",
  info: "\x1b[36m",
  warning: "\x1b[33m",
};

module.exports = {
  error: (message) =>
    console.error(`${colors.error}❌ ${message}${colors.reset}`),
  success: (message) =>
    console.log(`${colors.success}✅ ${message}${colors.reset}`),
  info: (message) => console.info(`${colors.info}ℹ️ ${message}${colors.reset}`),
  warning: (message) =>
    console.warn(`${colors.warning}⚠️ ${message}${colors.reset}`),
  log: (message) => console.log(`${colors.reset}${message}${colors.reset}`),
};
