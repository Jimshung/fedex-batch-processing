# FedEx 訂單處理系統

一個智能的訂單審核與處理系統，具備 Web 認證界面和完整的訂單管理功能。

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

### 現代化 Node.js Web 應用程式

**核心功能：**

- 🌐 Web 認證界面（Google OAuth 2.0）
- 📊 智能訂單管理儀表板
- 🔄 RESTful API 服務端點
- 📈 即時統計資訊
- 🧠 智能同步機制

### 核心設計：智能訂單管理系統

我們實現了一個智能的訂單管理系統，具備本地文件存儲和智能同步機制。

#### 智能同步策略

系統採用多層次的智能同步策略，確保數據新鮮度與性能的最佳平衡：

**同步觸發條件：**

- 🔄 **強制同步**：用戶手動觸發
- ⏰ **時間間隔**：最小 1 分鐘，最大 30 分鐘
- 📊 **數量變化**：檢測訂單數量變化
- 🧠 **自適應間隔**：根據訂單數量動態調整

**自適應同步間隔：**
| 訂單數量 | 同步間隔 | 邏輯 |
|----------|----------|------|
| 0 訂單 | 10分鐘 | 無訂單時降低頻率 |
| 1-9 訂單 | 8分鐘 | 少量訂單，適中頻率 |
| 10-49 訂單 | 5分鐘 | 中等訂單，正常頻率 |
| 50-99 訂單 | 3分鐘 | 較多訂單，提高頻率 |
| 100+ 訂單 | 2分鐘 | 大量訂單，最高頻率 |

## 🔄 智能工作流程

### 第一步：智能訂單同步

**執行者：** 智能同步系統（自動觸發）

**智能邏輯：**

- 🧠 **自適應同步**：根據訂單數量動態調整同步頻率
- 📊 **變化檢測**：自動檢測訂單數量變化
- ⏰ **時間控制**：避免過於頻繁的 API 調用
- 💾 **本地優先**：大部分請求直接讀取本地文件，響應極快

**Serena 的體驗：** 系統會智能地從 Shopify 同步最新訂單，同時保持極快的響應速度。她可以隨時查看最新的訂單狀態，無需等待。

### 第二步：Serena 的「檢視與核准」

**執行者：** Serena（Web 界面操作）

**操作流程：**

1. Serena 登入 Web 儀表板，查看所有待審核訂單
2. 她可以直接在界面上修改任何需要調整的欄位（例如地址或金額）
3. 對於確認無誤的訂單，她可以選擇單個或多個訂單進行處理
4. 系統提供即時的訂單狀態和統計信息

**Serena 的體驗：** 現代化的 Web 界面，操作直觀，響應迅速。她可以完全掌控最終送出給 FedEx 的資料。

### 第三步：一鍵「觸發已核准訂單」

**執行者：** Serena 點擊按鈕，觸發智能處理服務

**智能處理邏輯：**

1. 處理服務被觸發後，會讀取本地訂單數據
2. 篩選出所有已核准且狀態不是「處理中」或「已完成」的訂單
3. 對於每一筆篩選出來的訂單，執行以下原子操作：
   - **立即更新狀態：** 先將該訂單的狀態更新為「處理中」
   - **呼叫 FedEx API：** 將訂單資料傳送給 FedEx API
   - **處理成功：** 如果 API 成功，則更新狀態為「已完成」，並記錄 FedEx 追蹤號碼
   - **處理失敗：** 如果 API 失敗，則更新狀態為「失敗」，並記錄錯誤訊息

**Serena 的體驗：** 她點擊按鈕後，會看到選中的訂單狀態即時更新，從「待審核」變成「處理中」，然後變成「已完成」（顯示追蹤號碼）或「失敗」（顯示錯誤原因）。整個過程具備即時的視覺反饋和詳細的處理結果。

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

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback

# FedEx API
FEDEX_CLIENT_ID=your-client-id
FEDEX_CLIENT_SECRET=your-client-secret
FEDEX_ACCOUNT_NUMBER=your-account-number

# Session 和 JWT
SESSION_SECRET=your-session-secret-key
JWT_SECRET=your-jwt-secret-key
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
- 🧠 **智能同步**：自動檢測數據變化，保持最新狀態

### 🔌 API 端點（需要認證）

- `GET /health` - 健康檢查（無需認證）
- `GET /api/user` - 獲取用戶信息
- `GET /api/orders` - 獲取所有訂單數據（智能同步）
- `GET /api/orders?forceSync=true` - 強制同步訂單數據
- `GET /api/sync-status` - 獲取同步狀態信息
- `POST /api/sync-orders` - 手動同步訂單
- `POST /api/process-approved-orders` - 處理已核准訂單
- `POST /api/retry-failed-orders` - 重新處理失敗訂單

### 🔒 認證與授權

- **Google OAuth 2.0**：安全的第三方認證
- **域名限制**：僅允許 @benedbiomed.com 域名用戶
- **Session 管理**：24小時有效期
- **自動重定向**：未認證用戶自動導向登入頁面

## 🔧 技術架構

### 核心服務

- **`shopifyService.js`** - Shopify API 整合
- **`fedexService.js`** - FedEx API 整合
- **`orderProcessingService.js`** - 訂單處理業務邏輯
- **`orderFileService.js`** - 本地訂單文件管理
- **`syncHelper.js`** - 智能同步機制
- **`server.js`** - HTTP API 伺服器

### 📋 FedEx API 整合狀態

#### ✅ 已實作功能

- **運單建立 API** (`/ship/v1/shipments`) - 完全正常運作
- **OAuth 認證** - 成功獲取存取權杖
- **地址處理** - 支援多行地址分割（35字元限制）
- **報關金額計算** - 自動計算 Neuralli MP 產品價值
- **追蹤號碼提取** - 成功獲取 FedEx 追蹤號碼
- **多國家支援** - 支援韓國、菲律賓、紐西蘭等國家

#### ⚠️ ETD 文件上傳功能

**當前狀態：** 使用模擬模式

**原因：**

- FedEx API 端點 `/documents/v1/etds/upload` 在測試環境中不可用
- 可能需要生產環境或特殊的 API 權限
- 不影響核心的運單建立功能

**PDF 文件選擇邏輯：**

- 🇳🇿 **紐西蘭 (NZ)**：使用 `Bened_Neuralli MP_Ingredient list.pdf`
- 🇵🇭 **菲律賓 (PH)**：使用 `Neuralli MP_MSDS.pdf`
- 🌍 **其他國家**：不需要特殊文件

**影響：** 系統可以正常建立運單和獲取追蹤號碼，ETD 文件上傳功能不影響核心業務流程。

### 狀態管理

系統使用以下狀態來追蹤訂單處理進度：

- `待審核` - 新訂單，等待 Serena 審核
- `處理中` - 正在呼叫 FedEx API
- `已完成` - 成功建立貨運標籤
- `失敗` - FedEx API 呼叫失敗

## 🎨 Serena 的使用體驗

### 每日工作流程

1. **早上 9:00** - 登入 Web 儀表板，查看智能同步的最新訂單
2. **上午工作時間** - 檢視訂單詳情，必要時修改地址或金額
3. **下午 2:00** - 選擇確認無誤的訂單
4. **下午 2:05** - 點擊「處理已核准訂單」按鈕
5. **下午 2:10** - 查看即時處理結果，失敗的訂單可以修正後重新處理

### 即時反饋

- ✅ 處理成功：立即看到 FedEx 追蹤號碼
- ❌ 處理失敗：立即看到錯誤原因
- 🔄 處理中：即時狀態更新
- 📊 統計資訊：一目了然的處理進度
- 🧠 智能同步：自動檢測數據變化，保持最新狀態
- ⚡ 快速響應：本地文件讀取，毫秒級響應

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

# FedEx 設定
FEDEX_CLIENT_ID=your-fedex-client-id
FEDEX_CLIENT_SECRET=your-fedex-client-secret
FEDEX_ACCOUNT_NUMBER=your-fedex-account-number

# Google OAuth 2.0 設定
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback

# Session 和 JWT 設定
SESSION_SECRET=your-session-secret-key
JWT_SECRET=your-jwt-secret-key
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
