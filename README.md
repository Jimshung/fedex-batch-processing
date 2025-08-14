# FedEx 訂單處理系統

一個以 Google Sheet 為中心的訂單審核與處理系統，具備 Web 認證界面和完整的訂單管理功能。

## 🎯 系統目標

設計一個清晰、直觀且具備即時反饋的審核與觸發流程，讓團隊可以安全地完成訂單的最終確認與處理。

## 🔐 安全認證

系統採用 Google OAuth 2.0 認證，限制僅 @benedbiomed.com 域名的用戶可以登入，確保系統安全性。

### 認證功能

- ✅ Google OAuth 2.0 登入
- ✅ 域名限制（僅 @benedbiomed.com）
- ✅ Session 管理
- ✅ 自動登出機制

## 🏗️ 系統架構

### 雙重架構：Node.js 主體 + Google Apps Script 輔助

**Node.js Web 應用程式（主要）：**

- 🌐 Web 認證界面
- 📊 訂單管理儀表板
- 🔄 API 服務端點
- 📈 即時統計資訊

**Google Apps Script（輔助）：**

- ⏰ 自動化數據同步
- 📋 Google Sheets 整合

### 核心設計：升級的 Google Sheet

我們將 Google Sheet 從單純的「數據列表」升級為具備狀態的「互動式儀表板」。

#### 新的欄位結構

| A: 核准 | B: 處理狀態 | C: FedEx 追蹤號碼 | D: 備註/錯誤訊息      | E: 訂單編號 | F: 客戶名稱   | G: 處理後地址1            |
| :------ | :---------- | :---------------- | :-------------------- | :---------- | :------------ | :------------------------ |
| `[ ]`   | `待審核`    |                   |                       | 89760       | KF            | 3 CUSCADEN WALK #11-01    |
| `[✓]`   | `已完成`    | `773123456789`    |                       | 89722       | ChanChek Chee | 150 Gul Circle            |
| `[ ]`   | `失敗`      |                   | `Invalid postal code` | 89716       | Keng YongTeo  | 87 COMPASSVALE BOW #02-26 |

## 🔄 優雅的工作流程三部曲

### 第一步：每日自動化「新增訂單」

**執行者：** `fetch-shopify-orders-job`（由 Cloud Scheduler 每日觸發）

**升級邏輯：**

- 腳本不再是「清空並寫入」，而是變得更聰明
- 先讀取 Google Sheet 中已存在的訂單編號
- 從 Shopify 獲取所有未出貨訂單
- 只將 Google Sheet 中不存在的「新訂單」附加到表格最下方
- 對於每一筆新增的訂單，自動將「處理狀態」設為「待審核」

**Serena 的體驗：** 每天早上，她打開 Google Sheet，舊的訂單（無論是已完成還是失敗的）都還在，而新的待辦事項會自動出現在列表下方，狀態清晰，一目了然。

### 第二步：Serena 的「檢視與核准」

**執行者：** Serena（手動操作）

**操作流程：**

1. Serena 檢視所有狀態為「待審核」的訂單
2. 她可以直接在 Google Sheet 上修改任何她認為需要調整的欄位（例如處理後地址1或總金額）
3. 對於確認無誤的訂單，她只需勾選 A 欄的「核准」核取方塊
4. 她可以一次勾選多筆

**Serena 的體驗：** 操作直觀，就像在處理待辦事項清單。她可以完全掌控最終送出給 FedEx 的資料。

### 第三步：一鍵「觸發已核准訂單」

**執行者：** Serena 點擊按鈕，觸發後端的處理服務

**升級邏輯：**

1. 處理服務被觸發後，會去讀取整個 Google Sheet
2. 篩選出所有「核准」欄被勾選，且「處理狀態」不是「處理中」或「已完成」的訂單
3. 對於每一筆篩選出來的訂單，執行以下原子操作：
   - **立即回寫狀態：** 先將該訂單的「處理狀態」更新為「處理中」
   - **呼叫 FedEx API：** 將該列的資料傳送給 FedEx API
   - **處理成功：** 如果 API 成功，則再次回寫 Google Sheet，將「處理狀態」更新為「已完成」，並填上 FedEx 追蹤號碼
   - **處理失敗：** 如果 API 失敗，則將「處理狀態」更新為「失敗」，並將 FedEx 回傳的錯誤訊息填入「備註/錯誤訊息」欄

**Serena 的體驗：** 她點擊按鈕後，會看到她勾選的訂單狀態從「待審核」變成「處理中」，幾秒後再變成「已完成」（並出現追蹤號碼）或「失敗」（並出現原因）。整個過程具備即時的視覺反饋，讓她清楚地知道系統正在做什麼，以及結果如何。

## 🚀 快速開始

### 1. 環境設定

```bash
# 複製環境變數範例
cp env-example.txt .env

# 編輯環境變數，設定以下必要參數：
nano .env
```

**⚠️ 重要安全提醒：**

- 請確保 `.env` 文件已加入 `.gitignore`，不會上傳到 Git
- 不要將真實的 API 金鑰和密碼提交到版本控制
- `orders.json` 包含客戶數據，也不會上傳到 Git

**必要環境變數：**

```bash
# Shopify API
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your-access-token

# Google Sheets API
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./gcp-service-account.json

# FedEx API
FEDEX_CLIENT_ID=your-client-id
FEDEX_CLIENT_SECRET=your-client-secret
FEDEX_ACCOUNT_NUMBER=your-account-number

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
SESSION_SECRET=your-session-secret
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 本地開發

```bash
# 啟動 Web 服務器
npm run server
# 或者使用 npm start（兩者相同）
npm start
```

然後訪問 `http://localhost:8080` 進行 Google OAuth 登入。

### 4. 部署到 Google Cloud

```bash
# 部署 HTTP 伺服器到 Cloud Run
chmod +x deploy-simple.sh
./deploy-simple.sh
```

## 📊 系統功能

### 🌐 Web 儀表板

訪問系統 URL 後，通過 Google OAuth 登入，您將看到：

- 🔐 **安全認證**：Google OAuth 2.0 登入
- 📊 **即時統計**：待審核、已準備、已完成、失敗訂單數量
- 🚀 **一鍵處理**：處理已核准訂單
- 🔄 **失敗重試**：重新處理失敗訂單
- 📋 **訂單列表**：完整訂單清單與狀態
- 🔗 **Google Sheet**：直接連結到原始數據

### 🔌 API 端點（需要認證）

- `GET /health` - 健康檢查（無需認證）
- `GET /api/user` - 獲取用戶信息
- `GET /api/orders` - 獲取所有訂單數據
- `GET /api/stats` - 獲取處理統計資訊
- `POST /api/process-approved-orders` - 處理已核准訂單
- `POST /api/retry-failed-orders` - 重新處理失敗訂單
- `GET /api/processed-orders` - 獲取已處理訂單（供 Google Apps Script 使用）

### 🔒 認證與授權

- **Google OAuth 2.0**：安全的第三方認證
- **域名限制**：僅允許 @benedbiomed.com 域名用戶
- **Session 管理**：24小時有效期
- **自動重定向**：未認證用戶自動導向登入頁面

## 🔧 技術架構

### 核心服務

- **`googleSheetService.js`** - Google Sheets 互動服務
- **`shopifyService.js`** - Shopify API 整合
- **`fedexService.js`** - FedEx API 整合
- **`orderProcessingService.js`** - 訂單處理邏輯
- **`server.js`** - HTTP API 伺服器

### 狀態管理

系統使用以下狀態來追蹤訂單處理進度：

- `待審核` - 新訂單，等待 Serena 審核
- `處理中` - 正在呼叫 FedEx API
- `已完成` - 成功建立貨運標籤
- `失敗` - FedEx API 呼叫失敗

## 🎨 Serena 的使用體驗

### 每日工作流程

1. **早上 9:00** - 打開 Google Sheet，查看新加入的待審核訂單
2. **上午工作時間** - 檢視訂單詳情，必要時修改地址或金額
3. **下午 2:00** - 勾選確認無誤的訂單
4. **下午 2:05** - 點擊 Web 儀表板的「處理已核准訂單」按鈕
5. **下午 2:10** - 查看處理結果，處理失敗的訂單可以修正後重新處理

### 即時反饋

- ✅ 處理成功：立即看到 FedEx 追蹤號碼
- ❌ 處理失敗：立即看到錯誤原因
- 🔄 處理中：即時狀態更新
- 📊 統計資訊：一目了然的處理進度

## 🔒 安全性

- 所有 API 金鑰都透過環境變數管理
- Google Cloud 服務帳戶認證
- CORS 設定確保跨域安全
- 錯誤處理和日誌記錄

## 📝 環境變數

```env
# Shopify 設定
SHOPIFY_SHOP_NAME=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token

# Google Sheets 設定
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./gcp-service-account.json

# FedEx 設定
FEDEX_CLIENT_ID=your-fedex-client-id
FEDEX_CLIENT_SECRET=your-fedex-client-secret
FEDEX_ACCOUNT_NUMBER=your-fedex-account-number
```

## 🤝 貢獻

這個系統專為 Serena 設計，但歡迎提出改進建議！

## 📄 授權

MIT License

---

## 📚 進階文件

- [專案實現狀態與功能清單](docs/IMPLEMENTATION_STATUS.md)
- [專案整理與最佳實踐報告](docs/PROJECT_CLEANUP_REPORT.md)

---
