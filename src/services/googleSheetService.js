// googleSheetService.js - Google Sheets 相關服務
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const config = require('../config/config');
const logger = require('../utils/logger');

class GoogleSheetService {
  constructor() {
    // 檢查是否在 Cloud Run 環境中（使用 Workload Identity）
    if (process.env.K_SERVICE) {
      // 在 Cloud Run 中，使用預設憑證
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } else {
      // 本地開發，使用金鑰檔案
      this.auth = new GoogleAuth({
        keyFile: config.google.serviceAccountKeyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  // 新的欄位結構常量
  static COLUMNS = {
    APPROVE: 'A',
    PROCESSING_STATUS: 'B',
    FEDEX_TRACKING: 'C',
    NOTES_ERROR: 'D',
    ORDER_ID: 'E',
    ORDER_NUMBER: 'F',
    CUSTOMER_NAME: 'G',
    PROCESSED_ADDRESS1: 'H',
    PROCESSED_ADDRESS2: 'I',
    ORIGINAL_ADDRESS1: 'J',
    ORIGINAL_ADDRESS2: 'K',
    TOTAL_PRICE: 'L',
    CURRENCY: 'M',
    LINE_ITEMS: 'N',
    STATUS: 'O',
  };

  static STATUS = {
    PENDING_REVIEW: '待審核',
    PROCESSING: '處理中',
    COMPLETED: '已完成',
    FAILED: '失敗',
  };

  async initializeSheet(spreadsheetId) {
    try {
      const sheetName = await this.getSheetName(spreadsheetId);

      // 檢查是否已有標題行
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:O1`,
      });

      const headers = response.data.values?.[0] || [];

      // 如果沒有標題行或標題不完整，則建立新的標題行
      if (headers.length === 0 || headers.length < 15) {
        const newHeaders = [
          '核准',
          '處理狀態',
          'FedEx 追蹤號碼',
          '備註/錯誤訊息',
          '訂單ID',
          '訂單編號',
          '客戶名稱',
          '處理後地址1',
          '處理後地址2',
          '原始地址1',
          '原始地址2',
          '總金額',
          '幣別',
          '商品明細',
          '狀態',
        ];

        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:O1`,
          valueInputOption: 'RAW',
          resource: { values: [newHeaders] },
        });

        // 設定 A 欄為核取方塊格式
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: await this.getSheetId(spreadsheetId),
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 1,
                  },
                  rows: {
                    values: [
                      {
                        dataValidation: {
                          condition: {
                            type: 'BOOLEAN',
                          },
                          showCustomUi: true,
                        },
                      },
                    ],
                  },
                  fields: 'dataValidation',
                },
              },
            ],
          },
        });

        logger.success('成功初始化 Google Sheet 標題行');
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSheetName(spreadsheetId) {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    return spreadsheet.data.sheets[0].properties.title;
  }

  async getSheetId(spreadsheetId) {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.sheetId',
    });
    return spreadsheet.data.sheets[0].properties.sheetId;
  }

  async readExistingOrders(spreadsheetId) {
    try {
      const sheetName = await this.getSheetName(spreadsheetId);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:O`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return new Set(); // 只有標題行或空表

      // 提取訂單編號（F列 - 訂單編號）
      const existingOrderNumbers = new Set();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][5]) {
          // F列是訂單編號
          existingOrderNumbers.add(rows[i][5].toString());
        }
      }
      return existingOrderNumbers;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async writeOrdersToSheet(orders, spreadsheetId) {
    try {
      // 初始化 Sheet（確保有正確的標題行）
      await this.initializeSheet(spreadsheetId);

      // 讀取現有訂單
      const existingOrderNumbers = await this.readExistingOrders(spreadsheetId);

      // 過濾出新訂單
      const newOrders = orders.filter(
        (order) => !existingOrderNumbers.has(order.order_number.toString())
      );

      if (newOrders.length === 0) {
        logger.info('沒有新訂單需要寫入');
        return { success: true, sheetName: '', message: '沒有新訂單需要寫入' };
      }

      const sheetName = await this.getSheetName(spreadsheetId);

      // 準備新訂單數據（符合新的欄位結構）
      const rows = newOrders.map((order) => {
        return [
          '', // A: 核准 (初始為空)
          GoogleSheetService.STATUS.PENDING_REVIEW, // B: 處理狀態
          '', // C: FedEx 追蹤號碼
          '', // D: 備註/錯誤訊息
          order.id || order.shopify_order_id, // E: 訂單ID
          order.order_number, // F: 訂單編號
          `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(), // G: 客戶名稱
          order.shipping_address?.address1 || '', // H: 處理後地址1 (初始與原始地址相同)
          order.shipping_address?.address2 || '', // I: 處理後地址2 (初始與原始地址相同)
          order.shipping_address?.address1 || '', // J: 原始地址1
          order.shipping_address?.address2 || '', // K: 原始地址2
          order.total_price, // L: 總金額
          order.currency, // M: 幣別
          JSON.stringify(
            order.line_items?.map((item) => ({
              sku: item.sku,
              name: item.title,
              quantity: item.quantity,
              price: item.price,
            })) || []
          ), // N: 商品明細
          'pending_review', // O: 狀態
        ];
      });

      // 追加新行到工作表
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:O`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rows },
      });

      logger.success(`成功追加 ${rows.length} 筆新訂單至工作表: ${sheetName}`);
      return { success: true, sheetName, appendedRows: rows.length };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 新增：讀取所有訂單數據
  async readAllOrders(spreadsheetId) {
    try {
      const sheetName = await this.getSheetName(spreadsheetId);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:O`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return []; // 只有標題行或空表

      // 將數據轉換為物件格式
      const orders = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 15) {
          orders.push({
            rowIndex: i + 1, // 實際行號（從1開始，標題行是第1行）
            approve: row[0] === 'TRUE' || row[0] === true,
            processingStatus: row[1] || '',
            fedexTracking: row[2] || '',
            notesError: row[3] || '',
            orderId: row[4] || '',
            orderNumber: row[5] || '',
            customerName: row[6] || '',
            processedAddress1: row[7] || '',
            processedAddress2: row[8] || '',
            originalAddress1: row[9] || '',
            originalAddress2: row[10] || '',
            totalPrice: row[11] || '',
            currency: row[12] || '',
            lineItems: row[13] ? JSON.parse(row[13]) : [],
            status: row[14] || '',
          });
        }
      }

      return orders;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 新增：更新訂單狀態
  async updateOrderStatus(
    spreadsheetId,
    rowIndex,
    status,
    fedexTracking = '',
    notesError = ''
  ) {
    try {
      const sheetName = await this.getSheetName(spreadsheetId);

      const updates = [
        {
          range: `${sheetName}!B${rowIndex}`,
          values: [[status]],
        },
      ];

      if (fedexTracking) {
        updates.push({
          range: `${sheetName}!C${rowIndex}`,
          values: [[fedexTracking]],
        });
      }

      if (notesError) {
        updates.push({
          range: `${sheetName}!D${rowIndex}`,
          values: [[notesError]],
        });
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });

      logger.success(`成功更新第 ${rowIndex} 行狀態為: ${status}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 新增：獲取已核准的訂單
  async getApprovedOrders(spreadsheetId) {
    try {
      const allOrders = await this.readAllOrders(spreadsheetId);

      // 篩選出已核准且狀態不是「處理中」或「已完成」的訂單
      return allOrders.filter(
        (order) =>
          order.approve &&
          order.processingStatus !== GoogleSheetService.STATUS.PROCESSING &&
          order.processingStatus !== GoogleSheetService.STATUS.COMPLETED
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.error?.message || error.message,
      };
    }
    return {
      status: 500,
      message: error.message,
    };
  }
}

module.exports = new GoogleSheetService();
