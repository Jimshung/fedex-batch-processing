// googleSheetService.js - Google Sheets 相關服務
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const config = require('../config/config');

class GoogleSheetService {
  constructor() {
    this.auth = new GoogleAuth({
      keyFile: config.google.serviceAccountKeyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async writeOrdersToSheet(orders, spreadsheetId) {
    try {
      // 獲取第一個工作表的名稱
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });
      const sheetName = spreadsheet.data.sheets[0].properties.title;

      // 準備表頭和資料
      const headerRow = [
        'Shopify Order ID',
        'Order Number',
        'Customer Name',
        'Total Price',
        'Currency',
        'Original Address 1',
        'Original Address 2',
        'Processed Address 1',
        'Processed Address 2',
        'Items',
        'Status',
      ];
      const rows = orders.map((order) => [
        order.id || order.shopify_order_id,
        order.order_number,
        `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
        order.total_price,
        order.currency,
        order.shipping_address?.address1 || '',
        order.shipping_address?.address2 || '',
        order.shipping_address?.address1 || '', // 初始與原始地址相同
        order.shipping_address?.address2 || '', // 初始與原始地址相同
        JSON.stringify(
          order.line_items?.map((item) => ({
            sku: item.sku,
            name: item.title,
            quantity: item.quantity,
            price: item.price,
          })) || []
        ),
        'pending_review', // 初始狀態
      ]);

      // 寫入資料
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [headerRow, ...rows] },
      });

      return { success: true, sheetName };
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
