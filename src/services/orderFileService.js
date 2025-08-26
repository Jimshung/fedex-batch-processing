// orderFileService.js - 管理訂單檔案的讀寫
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class OrderFileService {
  constructor() {
    this.filePath = path.join(process.cwd(), 'orders.json');
  }

  /**
   * 讀取所有訂單資料
   * @returns {Promise<Array>} 訂單資料陣列
   */
  async readOrders() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data || '[]');
    } catch (error) {
      // 如果檔案不存在，則返回空陣列
      if (error.code === 'ENOENT') {
        logger.info('orders.json 檔案不存在，將建立新檔案');
        await this.writeOrders([]);
        return [];
      }
      throw error;
    }
  }

  /**
   * 寫入訂單資料
   * @param {Array} orders 訂單資料陣列
   * @returns {Promise<void>}
   */
  async writeOrders(orders) {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(orders, null, 2));
      logger.success(`成功寫入 ${orders.length} 筆訂單到 orders.json`);
    } catch (error) {
      logger.error(`寫入訂單資料失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 合併更新 orders.json，保留本地處理結果
   * @param {Array} newOrders Shopify 未出貨訂單陣列
   * @returns {Promise<number>} 寫入的訂單數量
   */
  async updateOrders(newOrders) {
    try {
      // 讀取現有訂單，保留本地處理結果
      const existingOrders = await this.readOrders();
      const existingMap = new Map(
        existingOrders.map((o) => [o.shopify_order_id.toString(), o])
      );

      // 合併新舊資料，保留本地欄位
      const merged = newOrders.map((order) => {
        // 統一使用 shopify_order_id 欄位
        const orderId = order.shopify_order_id || order.id;
        const old = existingMap.get(orderId.toString());
        const orderWithId = { ...order, shopify_order_id: orderId };
        return old
          ? { ...orderWithId, ...this.pickLocalFields(old) }
          : orderWithId;
      });

      await this.writeOrders(merged);
      logger.info(
        `已合併更新 orders.json，保留本地處理結果，共 ${merged.length} 筆訂單`
      );
      return merged.length;
    } catch (error) {
      logger.error(`更新訂單資料失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 提取需要保留的本地欄位
   * @param {Object} order 現有訂單
   * @returns {Object} 本地欄位
   */
  pickLocalFields(order) {
    return {
      status: order.status,
      fedex_tracking: order.fedex_tracking,
      processing_status: order.processing_status,
      notes_error: order.notes_error,
      notes: order.notes,
      completed_at: order.completed_at,
      failed_at: order.failed_at,
      // 保留其他本地處理欄位
    };
  }

  /**
   * [備註] 合併同步邏輯範例（如需保留本地狀態時可參考）
   *
   * // async updateOrders(newOrders) {
   * //   const existingOrders = await this.readOrders();
   * //   const existingMap = new Map(existingOrders.map(o => [o.shopify_order_id.toString(), o]));
   * //   const merged = newOrders.map(order => {
   * //     const old = existingMap.get(order.shopify_order_id.toString());
   * //     return old ? { ...order, ...pickLocalFields(old) } : order;
   * //   });
   * //   await this.writeOrders(merged);
   * //   return merged.length;
   * // }
   * // function pickLocalFields(order) {
   * //   return {
   * //     fedex_tracking: order.fedex_tracking,
   * //     notes: order.notes,
   * //     ... // 其他本地欄位
   * //   };
   * // }
   */

  /**
   * 更新單一訂單的資料
   * @param {string|number} shopifyOrderId Shopify 訂單 ID
   * @param {Object} updateData 更新的資料
   * @returns {Promise<boolean>} 是否成功更新
   */
  async updateOrder(shopifyOrderId, updateData) {
    try {
      // 讀取現有訂單
      const orders = await this.readOrders();

      // 尋找訂單
      const orderIndex = orders.findIndex(
        (order) =>
          order.shopify_order_id.toString() === shopifyOrderId.toString()
      );

      if (orderIndex === -1) {
        logger.warning(`找不到訂單 ${shopifyOrderId}`);
        return false;
      }

      // 更新訂單
      orders[orderIndex] = { ...orders[orderIndex], ...updateData };

      // 寫入更新後的資料
      await this.writeOrders(orders);
      logger.success(`成功更新訂單 ${shopifyOrderId} 的資料`);
      return true;
    } catch (error) {
      logger.error(`更新訂單 ${shopifyOrderId} 失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 取得所有已核准的訂單
   * @returns {Promise<Array>} 已核准的訂單陣列
   */
  async getApprovedOrders() {
    try {
      const orders = await this.readOrders();
      return orders.filter(
        (order) => order.status === 'approved' && !order.fedex_tracking
      );
    } catch (error) {
      logger.error(`取得已核准訂單失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 取得所有失敗的訂單
   * @returns {Promise<Array>} 失敗的訂單陣列
   */
  async getFailedOrders() {
    try {
      const orders = await this.readOrders();
      return orders.filter((order) => order.status === 'failed');
    } catch (error) {
      logger.error(`取得失敗訂單失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 取得訂單處理統計資訊
   * @returns {Promise<Object>} 統計資訊
   */
  async getStats() {
    try {
      const orders = await this.readOrders();

      return {
        total: orders.length,
        pending: orders.filter((order) => order.status === 'pending_review')
          .length,
        approved: orders.filter((order) => order.status === 'approved').length,
        processing: orders.filter((order) => order.status === 'processing')
          .length,
        completed: orders.filter((order) => order.status === 'completed')
          .length,
        failed: orders.filter((order) => order.status === 'failed').length,
      };
    } catch (error) {
      logger.error(`取得統計資訊失敗: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OrderFileService;
