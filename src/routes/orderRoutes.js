// orderRoutes.js - 訂單相關路由
const express = require('express');
const router = express.Router();
const OrderProcessingService = require('../services/orderProcessingService');
const shopifyService = require('../services/shopifyService');
const logger = require('../utils/logger');
const { createProtectedRoute } = require('../utils/authHelper');
const syncHelper = require('../utils/syncHelper');

const orderProcessingService = new OrderProcessingService();

/**
 * 處理已核准訂單
 */
router.post(
  '/process-approved-orders',
  ...createProtectedRoute(async (req, res) => {
    try {
      logger.info('收到處理已核准訂單的請求');
      const { orderIds } = req.body;
      logger.log('🚀 ~ orderIds:', orderIds);

      const result =
        await orderProcessingService.processApprovedOrders(orderIds);
      res.json(result);
    } catch (error) {
      logger.error(`處理已核准訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '處理已核准訂單時發生錯誤',
      });
    }
  })
);

/**
 * 重新處理失敗的訂單
 */
router.post(
  '/retry-failed-orders',
  ...createProtectedRoute(async (req, res) => {
    try {
      logger.info('收到重新處理失敗訂單的請求');

      const result = await orderProcessingService.retryFailedOrders();
      res.json(result);
    } catch (error) {
      logger.error(`重新處理失敗訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '重新處理失敗訂單時發生錯誤',
      });
    }
  })
);

/**
 * 獲取所有訂單數據 (智能同步 + 本地讀取)
 */
router.get(
  '/orders',
  ...createProtectedRoute(async (req, res) => {
    try {
      const { forceSync = false } = req.query;

      // 檢查是否需要同步數據
      const needSync = await syncHelper.needFreshData({
        forceSync: forceSync === 'true',
        checkOrderCount: true,
        minInterval: 2 * 60 * 1000, // 2分鐘最小間隔
        maxInterval: 30 * 60 * 1000, // 30分鐘最大間隔
      });

      // 如果需要同步，先從 Shopify 獲取最新數據
      if (needSync) {
        logger.info('開始智能同步訂單數據...');
        await shopifyService.fetchAndProcessOrders();
        const orderCount = await syncHelper.getCurrentOrderCount();
        await syncHelper.updateSyncInfo(orderCount);
      }

      // 從本地文件讀取訂單數據
      const OrderFileService = require('../services/orderFileService');
      const orderFileService = new OrderFileService();
      const allOrders = await orderFileService.readOrders();

      if (allOrders.length === 0) {
        return res.json({
          success: true,
          orders: [],
          message: '目前沒有訂單數據',
          syncInfo: await syncHelper.getSyncStatus(),
        });
      }

      // 動態 import camelcase-keys (ESM only)
      const camelcaseKeys = (await import('camelcase-keys')).default;
      const camelOrders = camelcaseKeys(allOrders, { deep: true });

      res.json({
        success: true,
        orders: camelOrders,
        message: `成功獲取 ${camelOrders.length} 筆訂單`,
        syncInfo: await syncHelper.getSyncStatus(),
        synced: needSync,
      });
    } catch (error) {
      logger.error(`獲取訂單數據時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        message: '獲取訂單數據失敗',
      });
    }
  })
);

/**
 * 同步訂單 (強制同步)
 */
router.post(
  '/sync-orders',
  ...createProtectedRoute(async (req, res) => {
    try {
      logger.info('收到強制同步訂單請求');

      await shopifyService.fetchAndProcessOrders();
      const orderCount = await syncHelper.getCurrentOrderCount();
      await syncHelper.updateSyncInfo(orderCount);

      res.json({
        success: true,
        message: '訂單同步完成，已更新本地 orders.json',
        orderCount,
        syncInfo: await syncHelper.getSyncStatus(),
      });
    } catch (error) {
      logger.error(`同步訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '同步訂單失敗',
      });
    }
  })
);

/**
 * 獲取同步狀態
 */
router.get(
  '/sync-status',
  ...createProtectedRoute(async (req, res) => {
    try {
      const syncStatus = await syncHelper.getSyncStatus();
      res.json({
        success: true,
        syncStatus,
      });
    } catch (error) {
      logger.error(`獲取同步狀態時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '獲取同步狀態失敗',
      });
    }
  })
);

module.exports = router;
