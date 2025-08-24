const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const config = require('../config/config');
const logger = require('../utils/logger');

class GCPService {
  constructor() {
    this.projectId = config.gcp.projectId;
    this.keyFilename = config.gcp.keyFilename;

    // 初始化 Firestore
    this.firestore = new Firestore({
      projectId: this.projectId,
      keyFilename: this.keyFilename,
      databaseId: 'fedex-orders', // 指定使用 fedex-orders 資料庫
    });

    // 初始化 Cloud Storage
    this.storage = new Storage({
      projectId: this.projectId,
      keyFilename: this.keyFilename,
    });

    // 取得 bucket
    this.bucket = this.storage.bucket(config.gcp.storage.bucketName);

    // 設定 collection 名稱
    this.ordersCollection = `${config.gcp.firestore.collectionPrefix}orders`;
    this.documentsCollection = `${config.gcp.firestore.collectionPrefix}documents`;

    logger.info('GCP 服務初始化完成', {
      projectId: this.projectId,
      ordersCollection: this.ordersCollection,
      documentsCollection: this.documentsCollection,
      bucketName: config.gcp.storage.bucketName,
    });
  }

  /**
   * 測試 GCP 連接
   */
  async testConnection() {
    try {
      // 測試 Firestore 連接
      const testDoc = this.firestore.collection('test').doc('connection');
      await testDoc.set({ timestamp: new Date(), test: true });
      await testDoc.delete();

      // 測試 Cloud Storage 連接
      const [exists] = await this.bucket.exists();

      logger.info('GCP 連接測試成功');
      return { firestore: true, storage: exists };
    } catch (error) {
      logger.error('GCP 連接測試失敗', error);
      throw error;
    }
  }

  /**
   * 取得 Firestore 實例
   */
  getFirestore() {
    return this.firestore;
  }

  /**
   * 取得 Cloud Storage 實例
   */
  getStorage() {
    return this.storage;
  }

  /**
   * 取得 bucket 實例
   */
  getBucket() {
    return this.bucket;
  }

  /**
   * 取得 orders collection
   */
  getOrdersCollection() {
    return this.firestore.collection(this.ordersCollection);
  }

  /**
   * 取得 documents collection
   */
  getDocumentsCollection() {
    return this.firestore.collection(this.documentsCollection);
  }
}

// 建立單例實例
const gcpService = new GCPService();

module.exports = gcpService;
