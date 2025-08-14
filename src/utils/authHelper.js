// authHelper.js - 認證輔助工具
const { requireAuth, requireBenedbiomed } = require('../middleware/auth');

/**
 * 根據環境返回適當的認證中間件
 * @param {boolean} requireProductionAuth 是否在生產環境要求認證
 * @returns {Array} 中間件陣列
 */
function getAuthMiddleware(requireProductionAuth = true) {
  if (process.env.NODE_ENV === 'production' && requireProductionAuth) {
    return [requireAuth, requireBenedbiomed];
  }
  return [];
}

/**
 * 創建帶認證的路由處理器
 * @param {Function} handler 路由處理函數
 * @param {boolean} requireProductionAuth 是否在生產環境要求認證
 * @returns {Array} 包含認證中間件和處理函數的陣列
 */
function createProtectedRoute(handler, requireProductionAuth = true) {
  return [...getAuthMiddleware(requireProductionAuth), handler];
}

module.exports = {
  getAuthMiddleware,
  createProtectedRoute,
};
