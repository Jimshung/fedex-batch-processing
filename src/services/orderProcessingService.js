// orderProcessingService.js - 訂單處理業務邏輯
const OrderFileService = require('./orderFileService');
const fedexService = require('./fedexService');
const logger = require('../utils/logger');

class OrderProcessingService {
  constructor() {
    this.orderFileService = new OrderFileService();
    this.fedexService = fedexService;
  }

  /**
   * 處理已核准的訂單
   * @param {Array} orderIds 可選的特定訂單ID陣列
   * @returns {Promise<Object>} 處理結果
   */
  async processApprovedOrders(orderIds = null) {
    try {
      logger.info('開始處理已核准訂單');

      let approvedOrders = await this.orderFileService.getApprovedOrders();

      // 如果有傳入特定訂單ID，則過濾出這些訂單
      if (orderIds && orderIds.length > 0) {
        approvedOrders = approvedOrders.filter((order) =>
          orderIds.includes(order.orderNumber)
        );
      }

      if (approvedOrders.length === 0) {
        return {
          success: true,
          data: { processed: 0, succeeded: 0, failed: 0 },
          message:
            orderIds && orderIds.length > 0
              ? '沒有找到符合的已核准訂單'
              : '沒有已核准的訂單需要處理',
        };
      }

      const results = await this._processOrders(
        approvedOrders,
        'processing',
        '處理中'
      );

      return {
        success: true,
        data: {
          processed: results.length,
          succeeded: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          details: results,
        },
        message: `處理完成：${results.filter((r) => r.success).length} 成功，${results.filter((r) => !r.success).length} 失敗`,
      };
    } catch (error) {
      logger.error(`處理已核准訂單時發生錯誤: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重新處理失敗的訂單
   * @returns {Promise<Object>} 處理結果
   */
  async retryFailedOrders() {
    try {
      logger.info('開始重新處理失敗訂單');

      const failedOrders = await this.orderFileService.getFailedOrders();

      if (failedOrders.length === 0) {
        return {
          success: true,
          data: { processed: 0, succeeded: 0, failed: 0 },
          message: '沒有失敗的訂單需要重新處理',
        };
      }

      const results = await this._processOrders(
        failedOrders,
        'processing',
        '重新處理中'
      );

      return {
        success: true,
        data: {
          processed: results.length,
          succeeded: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          details: results,
        },
        message: `重新處理完成：${results.filter((r) => r.success).length} 成功，${results.filter((r) => !r.success).length} 失敗`,
      };
    } catch (error) {
      logger.error(`重新處理失敗訂單時發生錯誤: ${error.message}`);
      throw error;
    }
  }

  /**
   * 內部方法：處理訂單陣列
   * @param {Array} orders 訂單陣列
   * @param {string} processingStatus 處理狀態
   * @param {string} processingStatusText 處理狀態文字
   * @returns {Promise<Array>} 處理結果陣列
   */
  async _processOrders(orders, processingStatus, processingStatusText) {
    const results = [];
    const documentPaths = [
      // 在這裡放你的固定 PDF 檔案路徑
      // './documents/commercial_invoice.pdf',
      // './documents/customs_declaration.pdf'
    ];

    for (const order of orders) {
      try {
        // 更新狀態為處理中
        await this.orderFileService.updateOrder(order.shopify_order_id, {
          status: processingStatus,
          processing_status: processingStatusText,
        });

        // 呼叫 FedEx API
        const shipmentResult = await this.fedexService.processOrderShipment(
          order,
          documentPaths
        );

        if (shipmentResult.success) {
          // 出貨成功
          await this.orderFileService.updateOrder(order.shopify_order_id, {
            status: 'completed',
            processing_status: '已完成',
            fedex_tracking: shipmentResult.trackingNumber,
            notes_error: '',
            completed_at: new Date().toISOString(),
          });

          results.push({
            orderId: order.shopify_order_id,
            success: true,
            trackingNumber: shipmentResult.trackingNumber,
          });
        } else {
          // 出貨失敗
          await this.orderFileService.updateOrder(order.shopify_order_id, {
            status: 'failed',
            processing_status: '失敗',
            notes_error: shipmentResult.error || '未知錯誤',
            failed_at: new Date().toISOString(),
          });

          results.push({
            orderId: order.shopify_order_id,
            success: false,
            error: shipmentResult.error,
          });
        }
      } catch (error) {
        logger.error(
          `處理訂單 ${order.shopify_order_id} 失敗: ${error.message}`
        );

        await this.orderFileService.updateOrder(order.shopify_order_id, {
          status: 'failed',
          processing_status: '失敗',
          notes_error: error.message,
          failed_at: new Date().toISOString(),
        });

        results.push({
          orderId: order.shopify_order_id,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

module.exports = OrderProcessingService;
