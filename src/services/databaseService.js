const gcpService = require('./gcpService');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.ordersCollection = gcpService.getOrdersCollection();
    this.documentsCollection = gcpService.getDocumentsCollection();
  }

  /**
   * 建立或更新訂單
   */
  async upsertOrder(orderData) {
    try {
      const orderId = orderData.shopify_order_id.toString();
      const docRef = this.ordersCollection.doc(orderId);

      // 加入時間戳記
      const now = new Date().toISOString();
      const dataToSave = {
        ...orderData,
        timestamps: {
          ...orderData.timestamps,
          updated_at: now,
          created_at: orderData.timestamps?.created_at || now,
        },
      };

      await docRef.set(dataToSave, { merge: true });

      logger.info('訂單已儲存到 Firestore', { orderId });
      return { success: true, orderId };
    } catch (error) {
      logger.error('儲存訂單到 Firestore 失敗', {
        error: error.message,
        orderId: orderData.shopify_order_id,
      });
      throw error;
    }
  }

  /**
   * 根據 ID 取得訂單
   */
  async getOrder(orderId) {
    try {
      const docRef = this.ordersCollection.doc(orderId.toString());
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('從 Firestore 取得訂單失敗', {
        error: error.message,
        orderId,
      });
      throw error;
    }
  }

  /**
   * 取得所有訂單
   */
  async getAllOrders(limit = 100) {
    try {
      const snapshot = await this.ordersCollection
        .orderBy('timestamps.created_at', 'desc')
        .limit(limit)
        .get();

      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return orders;
    } catch (error) {
      logger.error('從 Firestore 取得所有訂單失敗', { error: error.message });
      throw error;
    }
  }

  /**
   * 根據狀態查詢訂單
   */
  async getOrdersByStatus(status, limit = 50) {
    try {
      const snapshot = await this.ordersCollection
        .where('status.current', '==', status)
        .orderBy('timestamps.created_at', 'desc')
        .limit(limit)
        .get();

      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return orders;
    } catch (error) {
      logger.error('根據狀態查詢訂單失敗', { error: error.message, status });
      throw error;
    }
  }

  /**
   * 取得待處理的訂單（已完成 FedEx 但未回寫 Shopify）
   */
  async getPendingFulfillmentOrders(limit = 50) {
    try {
      const snapshot = await this.ordersCollection
        .where('status.current', '==', 'completed')
        .where('status.shopify_fulfillment', '==', 'unfulfilled')
        .orderBy('timestamps.created_at', 'asc')
        .limit(limit)
        .get();

      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return orders;
    } catch (error) {
      logger.error('取得待處理出貨訂單失敗', { error: error.message });
      throw error;
    }
  }

  /**
   * 儲存文件記錄
   */
  async saveDocument(documentData) {
    try {
      const docRef = this.documentsCollection.doc();
      const dataToSave = {
        ...documentData,
        created_at: new Date().toISOString(),
      };

      await docRef.set(dataToSave);

      logger.info('文件記錄已儲存到 Firestore', {
        documentId: docRef.id,
        orderId: documentData.order_id,
        documentType: documentData.document_type,
      });

      return { success: true, documentId: docRef.id };
    } catch (error) {
      logger.error('儲存文件記錄到 Firestore 失敗', {
        error: error.message,
        orderId: documentData.order_id,
      });
      throw error;
    }
  }

  /**
   * 取得訂單的所有文件
   */
  async getOrderDocuments(orderId) {
    try {
      const snapshot = await this.documentsCollection
        .where('order_id', '==', orderId)
        .orderBy('created_at', 'desc')
        .get();

      const documents = [];
      snapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return documents;
    } catch (error) {
      logger.error('取得訂單文件失敗', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * 更新訂單狀態
   */
  async updateOrderStatus(orderId, statusUpdate) {
    try {
      const docRef = this.ordersCollection.doc(orderId.toString());

      const updateData = {
        status: statusUpdate,
        'timestamps.updated_at': new Date().toISOString(),
      };

      await docRef.update(updateData);

      logger.info('訂單狀態已更新', { orderId, statusUpdate });
      return { success: true };
    } catch (error) {
      logger.error('更新訂單狀態失敗', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * 批次更新多個訂單
   */
  async batchUpdateOrders(updates) {
    try {
      const batch = this.ordersCollection.firestore.batch();

      updates.forEach(({ orderId, data }) => {
        const docRef = this.ordersCollection.doc(orderId.toString());
        batch.update(docRef, {
          ...data,
          'timestamps.updated_at': new Date().toISOString(),
        });
      });

      await batch.commit();

      logger.info('批次更新訂單完成', { count: updates.length });
      return { success: true, count: updates.length };
    } catch (error) {
      logger.error('批次更新訂單失敗', { error: error.message });
      throw error;
    }
  }
}

module.exports = new DatabaseService();
