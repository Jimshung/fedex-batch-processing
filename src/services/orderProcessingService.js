// orderProcessingService.js - 訂單處理業務邏輯
const databaseService = require('./databaseService');
const fedexService = require('./fedexService');
const logger = require('../utils/logger');

class OrderProcessingService {
  constructor() {
    this.databaseService = databaseService;
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

      let ordersToProcess = [];

      // 如果有傳入特定訂單ID，則處理這些訂單
      if (orderIds && orderIds.length > 0) {
        const allOrders = await this.databaseService.getAllOrders(1000);
        ordersToProcess = allOrders.filter((order) => {
          // 支援同時使用 shopify_order_id 和 order_number
          return (
            (order.shopify_order_id &&
              orderIds.includes(order.shopify_order_id.toString())) ||
            (order.order_number &&
              orderIds.includes(order.order_number.toString()))
          );
        });

        // 調試：檢查過濾結果
        logger.info(`總訂單數: ${allOrders.length}`);
        logger.info(`要查找的訂單編號: ${orderIds.join(', ')}`);
        logger.info(
          `找到的訂單: ${ordersToProcess.map((o) => `${o.order_number}(${o.shopify_order_id})`).join(', ')}`
        );
        logger.info(`找到 ${ordersToProcess.length} 筆指定訂單進行處理`);
      } else {
        // 否則處理所有已核准且未處理的訂單
        ordersToProcess =
          await this.databaseService.getOrdersByStatus('approved');
        logger.info(`找到 ${ordersToProcess.length} 筆已核准訂單進行處理`);
      }

      if (ordersToProcess.length === 0) {
        return {
          success: true,
          data: { processed: 0, succeeded: 0, failed: 0 },
          message:
            orderIds && orderIds.length > 0
              ? '沒有找到符合的訂單'
              : '沒有已核准的訂單需要處理',
        };
      }

      const results = await this._processOrders(
        ordersToProcess,
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

      const failedOrders =
        await this.databaseService.getOrdersByStatus('failed');

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
   * 處理訂單的核心邏輯
   * @private
   */
  async _processOrders(orders, processingStatus, processingStatusText) {
    const results = [];

    for (const order of orders) {
      try {
        // 根據國家代碼選擇對應的PDF文件（暫時註解）
        let documentPaths = [];
        const countryCode =
          order.original_address?.country_code || order.country_code;

        // TODO: 暫時註解 PDF 文件選擇邏輯，專注於 ETD 功能
        /*
        if (countryCode === 'NZ') {
          documentPaths = ['./documents/Bened_Neuralli MP_Ingredient list.pdf'];
          logger.info(
            `紐西蘭訂單 ${order.order_number}，使用 Bened_Neuralli MP_Ingredient list.pdf`
          );
        } else if (countryCode === 'PH') {
          documentPaths = ['./documents/Neuralli MP_MSDS.pdf'];
          logger.info(
            `菲律賓訂單 ${order.order_number}，使用 Neuralli MP_MSDS.pdf`
          );
        } else {
          logger.info(
            `訂單 ${order.order_number} 國家代碼 ${countryCode}，不需要特殊文件`
          );
        }
        */

        logger.info(
          `訂單 ${order.order_number} 國家代碼 ${countryCode}，使用 ETD 商業發票`
        );

        // 更新狀態為處理中
        await this.databaseService.updateOrderStatus(order.shopify_order_id, {
          ...order.status,
          current: processingStatus,
          processing_status: processingStatusText,
        });

        // 呼叫 FedEx API
        const shipmentResult = await this.fedexService.processOrderShipment(
          order,
          documentPaths
        );

        if (shipmentResult.success) {
          // 出貨成功
          const updatedOrder = {
            ...order,
            status: {
              ...order.status,
              current: 'completed',
              processing_status: '已完成',
              fedex_shipment: 'created',
            },
            fedex: {
              tracking_number: shipmentResult.trackingNumber,
              transaction_id: shipmentResult.transactionId || '',
              service_type:
                shipmentResult.serviceType || 'INTERNATIONAL_PRIORITY',
              service_name:
                shipmentResult.serviceName || 'International Priority®',
              ship_datestamp: shipmentResult.shipDatestamp || '',
              service_category: shipmentResult.serviceCategory || 'EXPRESS',
              created_at: new Date().toISOString(),
            },
            shopify_fulfillment: {
              ...order.shopify_fulfillment,
              tracking_number: shipmentResult.trackingNumber,
              tracking_url: `https://www.fedex.com/fedextrack/?trknbr=${shipmentResult.trackingNumber}`,
            },
            timestamps: {
              ...order.timestamps,
              completed_at: new Date().toISOString(),
            },
          };

          await this.databaseService.upsertOrder(updatedOrder);

          results.push({
            orderId: order.shopify_order_id,
            success: true,
            trackingNumber: shipmentResult.trackingNumber,
          });
        } else {
          // 出貨失敗
          const updatedOrder = {
            ...order,
            status: {
              ...order.status,
              current: 'failed',
              processing_status: '失敗',
            },
            timestamps: {
              ...order.timestamps,
              failed_at: new Date().toISOString(),
            },
          };

          await this.databaseService.upsertOrder(updatedOrder);

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

        const updatedOrder = {
          ...order,
          status: {
            ...order.status,
            current: 'failed',
            processing_status: '失敗',
          },
          timestamps: {
            ...order.timestamps,
            failed_at: new Date().toISOString(),
          },
        };

        await this.databaseService.upsertOrder(updatedOrder);

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
