// Google Apps Script for FedEx Order Processing
// 將此代碼複製到 Google Apps Script 編輯器中

// 配置變數 - 請根據您的設定修改
const CONFIG = {
  // Node.js 服務 API 設定
  API: {
    BASE_URL: 'https://your-deployed-service-url.run.app', // 請替換為您的 Node.js 服務 URL
    ENDPOINTS: {
      ORDERS: '/api/orders',
      PROCESS_ORDER: '/api/process-order',
    },
  },
  SHEET_NAME: '訂單處理', // 工作表名稱
  COLUMNS: {
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
  },
  STATUS: {
    PENDING_REVIEW: '待審核',
    PROCESSING: '處理中',
    COMPLETED: '已完成',
    FAILED: '失敗',
  },
};

/**
 * 建立觸發按鈕
 */
function createTriggerButton() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 在 A1 位置建立文字按鈕（不使用圖片，避免 URL 錯誤）
  const range = sheet.getRange('A1');
  range.setValue('處理已核准訂單');
  range.setBackground('#667eea');
  range.setFontColor('white');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');

  // 設定按鈕樣式
  range.setBorder(true, true, true, true, true, true);

  Logger.log('觸發按鈕已建立 - 請點擊 A1 儲存格來處理訂單');
}

/**
 * 處理已核准訂單 - 主要函數
 */
function processApprovedOrders() {
  try {
    Logger.log('開始處理已核准訂單...');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      showAlert('沒有訂單數據');
      return;
    }

    // 篩選已核准且未完成的訂單
    const approvedOrders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isApproved = row[0] === true || row[0] === 'TRUE';
      const status = row[1] || '';
      const isNotCompleted =
        status !== CONFIG.STATUS.PROCESSING &&
        status !== CONFIG.STATUS.COMPLETED;

      if (isApproved && isNotCompleted) {
        approvedOrders.push({
          rowIndex: i + 1,
          orderNumber: row[5] || '',
          customerName: row[6] || '',
          processedAddress1: row[7] || '',
          processedAddress2: row[8] || '',
          originalAddress1: row[9] || '',
          originalAddress2: row[10] || '',
          totalPrice: row[11] || '',
          currency: row[12] || '',
          lineItems: row[13] || '[]',
        });
      }
    }

    if (approvedOrders.length === 0) {
      showAlert('沒有已核准的訂單需要處理');
      return;
    }

    Logger.log(`找到 ${approvedOrders.length} 筆已核准訂單`);

    // 逐一處理每個訂單
    let successCount = 0;
    let failedCount = 0;

    for (const order of approvedOrders) {
      try {
        // 立即更新狀態為「處理中」
        updateOrderStatus(sheet, order.rowIndex, CONFIG.STATUS.PROCESSING);

        // 模擬 FedEx API 呼叫
        const result = simulateFedExAPI(order);

        if (result.success) {
          // 處理成功
          updateOrderStatus(
            sheet,
            order.rowIndex,
            CONFIG.STATUS.COMPLETED,
            result.trackingNumber
          );
          successCount++;
          Logger.log(`訂單 ${order.orderNumber} 處理成功`);
        } else {
          // 處理失敗
          updateOrderStatus(
            sheet,
            order.rowIndex,
            CONFIG.STATUS.FAILED,
            '',
            result.error
          );
          failedCount++;
          Logger.log(`訂單 ${order.orderNumber} 處理失敗: ${result.error}`);
        }

        // 添加延遲避免 API 限制
        Utilities.sleep(1000);
      } catch (error) {
        Logger.log(
          `處理訂單 ${order.orderNumber} 時發生錯誤: ${error.message}`
        );
        updateOrderStatus(
          sheet,
          order.rowIndex,
          CONFIG.STATUS.FAILED,
          '',
          `系統錯誤: ${error.message}`
        );
        failedCount++;
      }
    }

    const message = `處理完成！成功: ${successCount}, 失敗: ${failedCount}`;
    showAlert(message);
    Logger.log(message);
  } catch (error) {
    Logger.log(`處理已核准訂單時發生錯誤: ${error.message}`);
    showAlert(`處理失敗: ${error.message}`);
  }
}

/**
 * 更新訂單狀態
 */
function updateOrderStatus(
  sheet,
  rowIndex,
  status,
  trackingNumber = '',
  errorMessage = ''
) {
  const updates = [{ column: 'B', value: status }];

  if (trackingNumber) {
    updates.push({ column: 'C', value: trackingNumber });
  }

  if (errorMessage) {
    updates.push({ column: 'D', value: errorMessage });
  }

  for (const update of updates) {
    const columnIndex = update.column.charCodeAt(0) - 65; // A=0, B=1, etc.
    sheet.getRange(rowIndex, columnIndex + 1).setValue(update.value);
  }
}

/**
 * 模擬 FedEx API 呼叫
 * 在實際環境中，這裡會呼叫真實的 FedEx API
 */
function simulateFedExAPI(orderData) {
  // 模擬 API 延遲
  Utilities.sleep(2000);

  // 模擬成功率 80%
  const isSuccess = Math.random() > 0.2;

  if (isSuccess) {
    return {
      success: true,
      trackingNumber:
        'FX' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      error: null,
    };
  } else {
    const errors = [
      'Invalid postal code',
      'Address not found',
      'Service not available in this area',
      'Package weight exceeds limit',
      'Invalid recipient information',
    ];

    return {
      success: false,
      trackingNumber: null,
      error: errors[Math.floor(Math.random() * errors.length)],
    };
  }
}

/**
 * 顯示警告訊息
 */
function showAlert(message) {
  SpreadsheetApp.getUi().alert(
    'FedEx 訂單處理',
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 重新處理失敗的訂單
 */
function retryFailedOrders() {
  try {
    Logger.log('開始重新處理失敗訂單...');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    let retriedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isApproved = row[0] === true || row[0] === 'TRUE';
      const status = row[1] || '';

      if (isApproved && status === CONFIG.STATUS.FAILED) {
        // 重置為待審核狀態
        updateOrderStatus(sheet, i + 1, CONFIG.STATUS.PENDING_REVIEW, '', '');
        retriedCount++;
      }
    }

    const message = `成功重置 ${retriedCount} 筆失敗訂單的狀態`;
    showAlert(message);
    Logger.log(message);
  } catch (error) {
    Logger.log(`重新處理失敗訂單時發生錯誤: ${error.message}`);
    showAlert(`重新處理失敗: ${error.message}`);
  }
}

/**
 * 從 Node.js 服務獲取處理過的訂單數據
 */
function fetchOrdersFromAPI() {
  try {
    Logger.log('開始從 Node.js 服務獲取處理過的訂單...');

    const url = `${CONFIG.API.BASE_URL}/api/processed-orders`;
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`成功獲取 ${data.orders?.length || 0} 筆處理過的訂單`);
      return data.orders || [];
    } else {
      Logger.log(`API 錯誤: ${responseCode} - ${response.getContentText()}`);
      return [];
    }
  } catch (error) {
    Logger.log(`獲取訂單時發生錯誤: ${error.message}`);
    return [];
  }
}

/**
 * 將 API 訂單轉換為表格格式
 */
function convertOrdersToSheetData(orders) {
  return orders.map((order) => {
    return [
      false, // 核准 (A)
      CONFIG.STATUS.PENDING_REVIEW, // 處理狀態 (B)
      '', // FedEx 追蹤 (C)
      '', // 錯誤訊息 (D)
      order.id || '', // 訂單ID (E)
      order.order_number || '', // 訂單編號 (F)
      order.customer_name || '未知客戶', // 客戶名稱 (G)
      order.processed_address1 || '', // 處理後地址1 (H)
      order.processed_address2 || '', // 處理後地址2 (I)
      order.original_address1 || '', // 原始地址1 (J)
      order.original_address2 || '', // 原始地址2 (K)
      order.total_price || '', // 總價 (L)
      order.currency || '', // 幣別 (M)
      JSON.stringify(order.line_items || []), // 商品明細 (N)
      order.status || 'unfulfilled', // 狀態 (O)
    ];
  });
}

/**
 * 建立選單 - 在 Google Sheets 開啟時自動執行
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('FedEx 訂單處理')
      .addItem('同步訂單', 'syncOrdersFromAPI')
      .addSeparator()
      .addItem('處理已核准訂單', 'processApprovedOrders')
      .addItem('重新處理失敗訂單', 'retryFailedOrders')
      .addSeparator()
      .addItem('建立觸發按鈕', 'createTriggerButton')
      .addItem('初始化表格結構', 'initializeSheetStructure')
      .addToUi();

    Logger.log('FedEx 訂單處理選單已建立');
  } catch (error) {
    Logger.log(`建立選單時發生錯誤: ${error.message}`);
    // 如果無法建立選單，至少記錄錯誤
  }
}

/**
 * 初始化表格結構 - 當表格空白時使用
 */
function initializeSheetStructure() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 檢查是否為空白表格
    const data = sheet.getDataRange().getValues();
    const isEmpty =
      data.length === 0 ||
      (data.length === 1 && data[0].every((cell) => cell === ''));

    if (isEmpty) {
      // 建立標題列
      const headers = [
        '核准', // A
        '處理狀態', // B
        'FedEx 追蹤', // C
        '錯誤訊息', // D
        '訂單ID', // E
        '訂單編號', // F
        '客戶名稱', // G
        '處理後地址1', // H
        '處理後地址2', // I
        '原始地址1', // J
        '原始地址2', // K
        '總價', // L
        '幣別', // M
        '商品明細', // N
        '狀態', // O
      ];

      // 設定標題
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);

      // 格式化標題
      headerRange.setBackground('#f3f3f3');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');

      // 設定欄寬
      sheet.setColumnWidth(1, 60); // 核准欄
      sheet.setColumnWidth(2, 100); // 處理狀態欄
      sheet.setColumnWidth(3, 120); // FedEx 追蹤欄
      sheet.setColumnWidth(4, 200); // 錯誤訊息欄
      sheet.setColumnWidth(5, 100); // 訂單ID欄
      sheet.setColumnWidth(6, 100); // 訂單編號欄
      sheet.setColumnWidth(7, 120); // 客戶名稱欄
      sheet.setColumnWidth(8, 200); // 處理後地址1欄
      sheet.setColumnWidth(9, 200); // 處理後地址2欄
      sheet.setColumnWidth(10, 200); // 原始地址1欄
      sheet.setColumnWidth(11, 200); // 原始地址2欄
      sheet.setColumnWidth(12, 80); // 總價欄
      sheet.setColumnWidth(13, 60); // 幣別欄
      sheet.setColumnWidth(14, 300); // 商品明細欄
      sheet.setColumnWidth(15, 80); // 狀態欄

      // 凍結標題列
      sheet.setFrozenRows(1);

      Logger.log('表格結構初始化完成');
    } else {
      showAlert('表格已有數據，無需初始化');
    }
  } catch (error) {
    Logger.log(`初始化表格結構時發生錯誤: ${error.message}`);
    showAlert(`初始化失敗: ${error.message}`);
  }
}

/**
 * 從 Node.js 服務同步訂單到 Google Sheets
 */
function syncOrdersFromAPI() {
  try {
    Logger.log('開始同步訂單...');

    // 檢查 API 配置
    if (CONFIG.API.BASE_URL === 'https://your-deployed-service-url.run.app') {
      showAlert(
        '⚠️ 請先設定 API 配置！\n\n請在 CONFIG.API.BASE_URL 中設定您的 Node.js 服務 URL'
      );
      return;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 從 Node.js 服務獲取訂單
    const orders = fetchOrdersFromAPI();
    if (orders.length === 0) {
      showAlert('沒有從 API 獲取到訂單數據');
      return;
    }

    // 轉換為表格格式
    const sheetData = convertOrdersToSheetData(orders);

    // 寫入表格（從第二行開始，保留標題）
    if (sheetData.length > 0) {
      const dataRange = sheet.getRange(
        2,
        1,
        sheetData.length,
        sheetData[0].length
      );
      dataRange.setValues(sheetData);

      showAlert(
        `✅ 成功同步 ${sheetData.length} 筆訂單！\n\n您可以：\n1. 勾選要核准的訂單\n2. 點擊「處理已核准訂單」`
      );

      Logger.log(`成功同步 ${sheetData.length} 筆訂單`);
    }
  } catch (error) {
    Logger.log(`同步訂單時發生錯誤: ${error.message}`);
    showAlert(`同步失敗: ${error.message}`);
  }
}

/**
 * 自動觸發（可設定為定時執行）
 */
function autoProcessApprovedOrders() {
  Logger.log('自動處理已核准訂單...');
  processApprovedOrders();
}
