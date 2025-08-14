// syncHelper.js - 智能同步輔助工具
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class SyncHelper {
  constructor() {
    this.syncInfoPath = path.join(process.cwd(), '.sync-info.json');
    this.defaultSyncInterval = 5 * 60 * 1000; // 5分鐘
  }

  /**
   * 讀取同步信息
   */
  async getSyncInfo() {
    try {
      const data = await fs.readFile(this.syncInfoPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // 如果文件不存在，返回默認值
      return {
        lastSyncTime: 0,
        lastOrderCount: 0,
        syncInterval: this.defaultSyncInterval,
      };
    }
  }

  /**
   * 保存同步信息
   */
  async saveSyncInfo(info) {
    try {
      await fs.writeFile(this.syncInfoPath, JSON.stringify(info, null, 2));
    } catch (error) {
      logger.error(`保存同步信息失敗: ${error.message}`);
    }
  }

  /**
   * 檢查是否需要同步數據
   * @param {Object} options 同步選項
   * @returns {Promise<boolean>} 是否需要同步
   */
  async needFreshData(options = {}) {
    const {
      forceSync = false, // 強制同步
      checkOrderCount = true, // 檢查訂單數量變化
      minInterval = 1 * 60 * 1000, // 最小同步間隔（2分鐘）
      maxInterval = 30 * 60 * 1000, // 最大同步間隔（30分鐘）
    } = options;

    // 1. 強制同步
    if (forceSync) {
      logger.info('強制同步模式');
      return true;
    }

    const syncInfo = await this.getSyncInfo();
    const now = Date.now();
    const timeSinceLastSync = now - syncInfo.lastSyncTime;

    // 2. 檢查最小同步間隔
    if (timeSinceLastSync < minInterval) {
      logger.info(
        `距離上次同步時間太短 (${Math.round(timeSinceLastSync / 1000)}s < ${minInterval / 1000}s)`
      );
      return false;
    }

    // 3. 檢查最大同步間隔（超過最大間隔必須同步）
    if (timeSinceLastSync > maxInterval) {
      logger.info(
        `距離上次同步時間過長 (${Math.round(timeSinceLastSync / 1000)}s > ${maxInterval / 1000}s)`
      );
      return true;
    }

    // 4. 檢查訂單數量變化
    if (checkOrderCount) {
      const currentOrderCount = await this.getCurrentOrderCount();
      const orderCountChanged = currentOrderCount !== syncInfo.lastOrderCount;

      if (orderCountChanged) {
        logger.info(
          `訂單數量發生變化 (${syncInfo.lastOrderCount} → ${currentOrderCount})`
        );
        return true;
      }
    }

    // 5. 自適應同步間隔（根據訂單數量調整）
    const adaptiveInterval = this.calculateAdaptiveInterval(
      syncInfo.lastOrderCount
    );
    if (timeSinceLastSync > adaptiveInterval) {
      logger.info(
        `達到自適應同步間隔 (${Math.round(timeSinceLastSync / 1000)}s > ${adaptiveInterval / 1000}s)`
      );
      return true;
    }

    logger.info(
      `無需同步 (距離上次同步 ${Math.round(timeSinceLastSync / 1000)}s)`
    );
    return false;
  }

  /**
   * 獲取當前訂單數量
   */
  async getCurrentOrderCount() {
    try {
      const OrderFileService = require('../services/orderFileService');
      const orderFileService = new OrderFileService();
      const orders = await orderFileService.readOrders();
      return orders.length;
    } catch (error) {
      logger.error(`獲取訂單數量失敗: ${error.message}`);
      return 0;
    }
  }

  /**
   * 計算自適應同步間隔
   * 訂單越多，同步頻率越高
   */
  calculateAdaptiveInterval(orderCount) {
    if (orderCount === 0) {
      return 10 * 60 * 1000; // 無訂單時，10分鐘同步一次
    } else if (orderCount < 10) {
      return 8 * 60 * 1000; // 少量訂單，8分鐘同步一次
    } else if (orderCount < 50) {
      return 5 * 60 * 1000; // 中等訂單，5分鐘同步一次
    } else if (orderCount < 100) {
      return 3 * 60 * 1000; // 較多訂單，3分鐘同步一次
    } else {
      return 2 * 60 * 1000; // 大量訂單，2分鐘同步一次
    }
  }

  /**
   * 更新同步信息
   */
  async updateSyncInfo(orderCount) {
    const syncInfo = await this.getSyncInfo();
    syncInfo.lastSyncTime = Date.now();
    syncInfo.lastOrderCount = orderCount;
    await this.saveSyncInfo(syncInfo);
    logger.info(`同步信息已更新，訂單數量: ${orderCount}`);
  }

  /**
   * 獲取同步狀態信息
   */
  async getSyncStatus() {
    const syncInfo = await this.getSyncInfo();
    const currentOrderCount = await this.getCurrentOrderCount();
    const timeSinceLastSync = Date.now() - syncInfo.lastSyncTime;

    return {
      lastSyncTime: syncInfo.lastSyncTime,
      timeSinceLastSync: Math.round(timeSinceLastSync / 1000),
      lastOrderCount: syncInfo.lastOrderCount,
      currentOrderCount,
      orderCountChanged: currentOrderCount !== syncInfo.lastOrderCount,
      nextSyncIn: Math.max(
        0,
        this.calculateAdaptiveInterval(currentOrderCount) - timeSinceLastSync
      ),
    };
  }
}

module.exports = new SyncHelper();
