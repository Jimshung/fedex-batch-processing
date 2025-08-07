// orderProcessingService.js - 訂單處理服務
const googleSheetService = require('./googleSheetService');
const fedexService = require('./fedexService');
const config = require('../config/config');
const logger = require('../utils/logger');

class OrderProcessingService {
  async processApprovedOrders() {
    try {
      logger.info('開始處理已核准的訂單...');

      // 1. 獲取已核准的訂單
      const approvedOrders = await googleSheetService.getApprovedOrders(
        config.google.sheetId
      );

      if (approvedOrders.length === 0) {
        logger.info('目前沒有已核准的訂單需要處理');
        return {
          success: true,
          processedCount: 0,
          successCount: 0,
          failedCount: 0,
          message: '沒有已核准的訂單需要處理',
        };
      }

      logger.info(`找到 ${approvedOrders.length} 筆已核准的訂單`);

      let successCount = 0;
      let failedCount = 0;
      const results = [];

      // 2. 逐一處理每個已核准的訂單
      for (const order of approvedOrders) {
        try {
          logger.info(`開始處理訂單: ${order.orderNumber}`);

          // 2a. 立即更新狀態為「處理中」
          await googleSheetService.updateOrderStatus(
            config.google.sheetId,
            order.rowIndex,
            '處理中'
          );

          // 2b. 呼叫 FedEx API
          const fedexResult = await fedexService.createShipment(order);

          if (fedexResult.success) {
            // 2c. 處理成功：更新狀態為「已完成」並填入追蹤號碼
            await googleSheetService.updateOrderStatus(
              config.google.sheetId,
              order.rowIndex,
              '已完成',
              fedexResult.trackingNumber
            );

            logger.success(
              `訂單 ${order.orderNumber} 處理成功，追蹤號碼: ${fedexResult.trackingNumber}`
            );
            successCount++;

            results.push({
              orderNumber: order.orderNumber,
              status: 'success',
              trackingNumber: fedexResult.trackingNumber,
              error: null,
            });
          } else {
            // 2d. 處理失敗：更新狀態為「失敗」並填入錯誤訊息
            await googleSheetService.updateOrderStatus(
              config.google.sheetId,
              order.rowIndex,
              '失敗',
              '',
              fedexResult.error
            );

            logger.error(
              `訂單 ${order.orderNumber} 處理失敗: ${fedexResult.error}`
            );
            failedCount++;

            results.push({
              orderNumber: order.orderNumber,
              status: 'failed',
              trackingNumber: null,
              error: fedexResult.error,
            });
          }
        } catch (error) {
          // 處理過程中發生意外錯誤
          logger.error(
            `處理訂單 ${order.orderNumber} 時發生意外錯誤: ${error.message}`
          );

          await googleSheetService.updateOrderStatus(
            config.google.sheetId,
            order.rowIndex,
            '失敗',
            '',
            `系統錯誤: ${error.message}`
          );

          failedCount++;
          results.push({
            orderNumber: order.orderNumber,
            status: 'failed',
            trackingNumber: null,
            error: `系統錯誤: ${error.message}`,
          });
        }
      }

      // 3. 記錄處理結果
      const summary = {
        success: true,
        processedCount: approvedOrders.length,
        successCount,
        failedCount,
        results,
      };

      logger.success(
        `訂單處理完成！成功: ${successCount}, 失敗: ${failedCount}`
      );
      return summary;
    } catch (error) {
      logger.error(`處理已核准訂單時發生錯誤: ${error.message}`);
      throw error;
    }
  }

  // 新增：獲取處理統計資訊
  async getProcessingStats() {
    try {
      const allOrders = await googleSheetService.readAllOrders(
        config.google.sheetId
      );

      const stats = {
        total: allOrders.length,
        pendingReview: allOrders.filter(
          (order) => order.processingStatus === '待審核'
        ).length,
        processing: allOrders.filter(
          (order) => order.processingStatus === '處理中'
        ).length,
        completed: allOrders.filter(
          (order) => order.processingStatus === '已完成'
        ).length,
        failed: allOrders.filter((order) => order.processingStatus === '失敗')
          .length,
        approved: allOrders.filter((order) => order.approve).length,
      };

      return stats;
    } catch (error) {
      logger.error(`獲取處理統計資訊時發生錯誤: ${error.message}`);
      throw error;
    }
  }

  // 新增：重新處理失敗的訂單
  async retryFailedOrders() {
    try {
      logger.info('開始重新處理失敗的訂單...');

      const allOrders = await googleSheetService.readAllOrders(
        config.google.sheetId
      );
      const failedOrders = allOrders.filter(
        (order) =>
          order.processingStatus === '失敗' &&
          order.approve
      );

      if (failedOrders.length === 0) {
        logger.info('沒有失敗的訂單需要重新處理');
        return {
          success: true,
          retriedCount: 0,
          message: '沒有失敗的訂單需要重新處理',
        };
      }

      logger.info(`找到 ${failedOrders.length} 筆失敗的訂單需要重新處理`);

      // 將失敗的訂單狀態重置為「待審核」，讓它們可以重新被處理
      for (const order of failedOrders) {
        await googleSheetService.updateOrderStatus(
          config.google.sheetId,
          order.rowIndex,
          '待審核',
          '',
          '' // 清除錯誤訊息
        );
      }

      logger.success(`成功重置 ${failedOrders.length} 筆失敗訂單的狀態`);

      return {
        success: true,
        retriedCount: failedOrders.length,
        message: `成功重置 ${failedOrders.length} 筆失敗訂單的狀態`,
      };
    } catch (error) {
      logger.error(`重新處理失敗訂單時發生錯誤: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new OrderProcessingService();
