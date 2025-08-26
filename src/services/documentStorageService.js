const gcpService = require('./gcpService');
const logger = require('../utils/logger');

class DocumentStorageService {
  constructor() {
    this.bucket = gcpService.getBucket();
    this.bucketName = gcpService.bucket.name;
  }

  /**
   * 上傳貨運標籤到 GCS
   * @param {string} orderNumber 訂單編號
   * @param {string} encodedLabel Base64 編碼的標籤
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadShippingLabel(orderNumber, encodedLabel) {
    try {
      logger.info(`開始上傳貨運標籤到 GCS，訂單編號: ${orderNumber}`);

      // 1. Base64 解碼
      const pdfBuffer = Buffer.from(encodedLabel, 'base64');

      // 2. 生成文件路徑
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const fileName = `${orderNumber}_label.pdf`;
      const filePath = `shipping-labels/${year}/${month}/${fileName}`;

      // 3. 上傳到 GCS
      const file = this.bucket.file(filePath);
      await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
          orderNumber,
          documentType: 'shipping-label',
          uploadedAt: new Date().toISOString(),
        },
      });

      // 4. 設為公開存取
      await file.makePublic();

      // 5. 取得公開 URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      logger.success(`貨運標籤上傳成功: ${publicUrl}`);

      return {
        success: true,
        filePath,
        publicUrl,
        fileName,
      };
    } catch (error) {
      logger.error(`上傳貨運標籤失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 上傳商業發票到 GCS
   * @param {string} orderNumber 訂單編號
   * @param {string} encodedInvoice Base64 編碼的發票
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadCommercialInvoice(orderNumber, encodedInvoice) {
    try {
      logger.info(`開始上傳商業發票到 GCS，訂單編號: ${orderNumber}`);

      // 1. Base64 解碼
      const pdfBuffer = Buffer.from(encodedInvoice, 'base64');

      // 2. 生成文件路徑
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const fileName = `${orderNumber}_invoice.pdf`;
      const filePath = `commercial-invoices/${year}/${month}/${fileName}`;

      // 3. 上傳到 GCS
      const file = this.bucket.file(filePath);
      await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
          orderNumber,
          documentType: 'commercial-invoice',
          uploadedAt: new Date().toISOString(),
        },
      });

      // 4. 設為公開存取
      await file.makePublic();

      // 5. 取得公開 URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      logger.success(`商業發票上傳成功: ${publicUrl}`);

      return {
        success: true,
        filePath,
        publicUrl,
        fileName,
      };
    } catch (error) {
      logger.error(`上傳商業發票失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 上傳臨時文件到 GCS
   * @param {string} fileName 文件名
   * @param {Buffer} fileBuffer 文件緩衝區
   * @param {string} contentType 內容類型
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadTempFile(fileName, fileBuffer, contentType = 'application/pdf') {
    try {
      logger.info(`開始上傳臨時文件到 GCS: ${fileName}`);

      // 生成文件路徑
      const timestamp = Date.now();
      const filePath = `temp/${timestamp}_${fileName}`;

      // 上傳到 GCS
      const file = this.bucket.file(filePath);
      await file.save(fileBuffer, {
        contentType,
        metadata: {
          fileName,
          documentType: 'temp',
          uploadedAt: new Date().toISOString(),
        },
      });

      // 設為公開存取
      await file.makePublic();

      // 取得公開 URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      logger.success(`臨時文件上傳成功: ${publicUrl}`);

      return {
        success: true,
        filePath,
        publicUrl,
        fileName,
      };
    } catch (error) {
      logger.error(`上傳臨時文件失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 刪除文件
   * @param {string} filePath 文件路徑
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteFile(filePath) {
    try {
      const file = this.bucket.file(filePath);
      await file.delete();
      logger.info(`文件刪除成功: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`文件刪除失敗: ${error.message}`);
      return false;
    }
  }

  /**
   * 取得文件公開 URL
   * @param {string} filePath 文件路徑
   * @returns {string} 公開 URL
   */
  getPublicUrl(filePath) {
    return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
  }

  /**
   * 檢查文件是否存在
   * @param {string} filePath 文件路徑
   * @returns {Promise<boolean>} 是否存在
   */
  async fileExists(filePath) {
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error(`檢查文件存在失敗: ${error.message}`);
      return false;
    }
  }
}

module.exports = new DocumentStorageService();
