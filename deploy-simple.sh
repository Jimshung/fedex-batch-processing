#!/bin/bash

# 🚀 一鍵部署 FedEx 訂單處理系統到 GCP Cloud Run
# 這是最懶人的版本，只需要執行這個檔案就好！

set -e

echo "🎯 開始一鍵部署到 GCP..."

# 自動偵測或設定專案 ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "shopify-webhook-handler")
REGION="asia-east1"
SERVICE_NAME="shopify-webhook-handler"

echo "📍 專案: $PROJECT_ID"
echo "📍 地區: $REGION"
echo "📍 服務名稱: $SERVICE_NAME"

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo "❌ 錯誤：找不到 .env 檔案"
    echo "請先確保 .env 檔案存在並包含所有必要的設定"
    exit 1
fi

# 從 .env 檔案讀取重要變數
export $(grep -v '^#' .env | grep -E '^(SHOPIFY|GOOGLE|SESSION)' | xargs)

# 檢查必要變數
if [ -z "$SHOPIFY_SHOP_NAME" ] || [ -z "$SHOPIFY_ACCESS_TOKEN" ]; then
    echo "❌ 錯誤：.env 檔案中缺少 Shopify 設定"
    exit 1
fi

echo "✅ 環境變數檢查通過"

# 設定 GCP 專案
echo "🔧 設定 GCP 專案..."
gcloud config set project $PROJECT_ID

# 啟用必要的 API（靜默模式）
echo "⚙️ 啟用 GCP API 服務..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

# 一鍵建置並部署
echo "🚀 開始建置與部署..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 3600 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "SHOPIFY_SHOP_NAME=${SHOPIFY_SHOP_NAME}" \
  --set-env-vars "SHOPIFY_ACCESS_TOKEN=${SHOPIFY_ACCESS_TOKEN}" \
  --set-env-vars "FEDEX_CLIENT_ID=${FEDEX_CLIENT_ID}" \
  --set-env-vars "FEDEX_CLIENT_SECRET=${FEDEX_CLIENT_SECRET}" \
  --set-env-vars "FEDEX_ACCOUNT_NUMBER=${FEDEX_ACCOUNT_NUMBER}" \
  --set-env-vars "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
  --set-env-vars "SESSION_SECRET=${SESSION_SECRET}"

# 獲取服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo ""
echo "🎉 部署成功！"
echo "🌐 你的應用程式網址: $SERVICE_URL"
echo "🔗 直接點擊就能使用: $SERVICE_URL"
echo ""
echo "📋 重要資訊："
echo "• 健康檢查: $SERVICE_URL/health"
echo "• 主頁面: $SERVICE_URL"
echo "• API 文件: $SERVICE_URL/api"
echo ""
echo "👥 同事可以直接使用這個網址: $SERVICE_URL"
echo "📝 請將這個網址分享給需要使用的同事"
echo ""
echo "🔧 重要：首次部署需要更新 Google OAuth 設定"
echo "請到 Google Cloud Console 更新 OAuth 授權網域："
echo "1. 訪問: https://console.cloud.google.com/apis/credentials"
echo "2. 找到你的 OAuth 2.0 客戶端 ID"
echo "3. 在「已授權的重新導向 URI」中新增: ${SERVICE_URL}/auth/google/callback"
echo "4. 在「已授權的 JavaScript 來源」中新增: $SERVICE_URL"
echo ""
echo "🔧 如果需要修改設定，請："
echo "1. 修改 .env 檔案"
echo "2. 重新執行: ./deploy-simple.sh"
