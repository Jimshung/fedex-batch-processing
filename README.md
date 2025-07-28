# FedEx API 認證測試

這是一個簡單的測試程式，用於驗證 FedEx API 認證功能，獲取 Access Token。

## 功能特色

- 🔑 **API 認證測試**：測試 FedEx API 金鑰是否有效
- 🧪 **簡單易用**：只需設定環境變數即可執行
- 📝 **詳細錯誤訊息**：提供清楚的錯誤說明

## 系統架構

```
FedEx API → 認證請求 → Access Token
```

## 安裝與設定

### 1. 安裝依賴套件

```bash
npm install
```

### 2. 設定環境變數

建立 `.env` 檔案並填入以下資訊：

```env
# FedEx API 設定
FEDEX_CLIENT_ID=your_client_id_here
FEDEX_CLIENT_SECRET=your_client_secret_here
FEDEX_ACCOUNT_NUMBER=your_account_number
FEDEX_ACCESS_TOKEN=
```

**test.http 專用變數格式**:

- 使用 `{{$變數名}}` 語法引用
- 範例: `{{$FEDEX_CLIENT_ID}}`

**⚠️ 重要資安提醒：**

- 請將 `.env` 檔案加入 `.gitignore`，避免敏感資訊被提交到版本控制
- 不要在任何公開的地方分享您的 API 金鑰
- 定期更換您的 API 金鑰

## 使用方法

### 測試 FedEx API 認證

```bash
npm test
```

或者直接執行：

```bash
node test.js
```

### 使用 test.http 進行 API 測試

#### 方法一：使用環境變數（推薦）

1. 確保已安裝 [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VSCode 擴展
2. 設定 REST Client 環境變數：
   - 複製 `.vscode/settings.example.json` 為 `.vscode/settings.json`
   - 在 `settings.json` 中填入您的實際 API 金鑰
3. 在 test.http 檔案中:
   - 使用 `{{變數名}}` 語法引用環境變數
   - 範例: `client_id={{FEDEX_CLIENT_ID}}`
4. 點擊 "Send Request" 按鈕執行請求

#### 方法二：直接測試（簡單快速）

1. 使用 `test-direct.http` 檔案（包含實際 API 金鑰）
2. 直接點擊 "Send Request" 按鈕執行請求
3. ⚠️ 注意：此檔案包含敏感資訊，僅供本地測試使用

**注意**: 如果環境變數無法正常運作，請使用方法二進行快速測試

## API 端點說明

### FedEx API

系統使用以下 FedEx API 端點：

- **認證**：`/oauth/token` (測試環境：`https://apis-sandbox.fedex.com/oauth/token`)

## 故障排除

### 常見問題

1. **FedEx API 認證失敗**

   - 檢查 `FEDEX_CLIENT_ID` 和 `FEDEX_CLIENT_SECRET` 是否正確
   - 確認帳戶號碼是否有效
   - 確認使用的是測試環境端點

2. **環境變數設定錯誤**
   - 確認 `.env` 檔案存在且格式正確
   - 確認沒有多餘的空格或引號

## 開發者資訊

### 專案結構

```
fedex-batch-processing/
├── test.js           # 測試程式
├── package.json      # 專案設定
├── README.md         # 說明文件
├── env-example.txt   # 環境變數範例
├── .env              # 環境變數（需自行建立）
└── .gitignore        # Git 忽略檔案
```

## 授權

MIT License

## 支援

如有問題，請檢查環境變數設定或聯絡開發團隊。
