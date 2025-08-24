# 🚀 一鍵部署到 GCP 指南

## 最懶人部署方式

### 方法一：超簡單一鍵部署

```bash
./deploy-simple.sh
```

這個腳本會自動處理所有事情，包括：

- 啟用必要的 GCP API
- 建置 Docker 映像
- 部署到 Cloud Run
- 設定環境變數
- 回傳網址給你

### 方法二：完整版部署（如果需要更多控制）

```bash
./deploy-server.sh
```

## 部署前準備

1. **確保已安裝 gcloud CLI**

   ```bash
   # 檢查是否已安裝
   gcloud version

   # 如果沒有安裝，請到 https://cloud.google.com/sdk/docs/install 下載
   ```

2. **登入 GCP**

   ```bash
   gcloud auth login
   gcloud config set project intl-shipping-serena
   ```

3. **確保 .env 檔案完整**
   - 檢查 `.env` 檔案是否包含所有必要設定
   - 特別是 SHOPIFY, GOOGLE, FEDEX 相關設定

## 部署後

部署成功後，你會得到一個像這樣的網址：

```
https://fedex-order-processor-xxxxxxx-xx.a.run.app
```

### 同事使用方式

1. 直接訪問網址
2. 用 @benedbiomed.com 郵箱登入
3. 開始使用系統

### 如果需要更新

只要重新執行部署腳本即可：

```bash
./deploy-simple.sh
```

## 如果出現問題

### 權限問題

如果出現權限錯誤，確保你的 GCP 帳號有以下權限：

- Cloud Run Admin
- Cloud Build Editor
- Service Account User

### API 未啟用

腳本會自動啟用必要的 API，但如果失敗，請手動啟用：

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 環境變數問題

確保 .env 檔案包含所有必要變數：

- SHOPIFY_SHOP_NAME
- SHOPIFY_ACCESS_TOKEN
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- FEDEX_CLIENT_ID
- FEDEX_CLIENT_SECRET
- FEDEX_ACCOUNT_NUMBER
- SESSION_SECRET
- JWT_SECRET

## GCP 頁面操作指南

如果需要手動檢查或設定：

1. **查看 Cloud Run 服務**
   - 訪問：https://console.cloud.google.com/run
   - 選擇專案：intl-shipping-serena
   - 地區：asia-east1

2. **查看建置歷史**
   - 訪問：https://console.cloud.google.com/cloud-build/builds

3. **查看日誌**
   - 在 Cloud Run 服務頁面點擊服務名稱
   - 點擊「日誌」分頁

## 網址分享

部署完成後，直接將得到的網址分享給同事即可。他們不需要任何設定，只要用公司郵箱登入就能使用。
