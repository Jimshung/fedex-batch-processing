#!/bin/bash

# 🚀 一鍵部署 FedEx 訂單處理系統到 GCP Cloud Run

set -e

echo "🎯 開始一鍵部署到 GCP..."

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "intl-shipping-serena")
REGION="asia-east1"
SERVICE_NAME="intl-shipping-serena"

echo "📍 專案: $PROJECT_ID"
echo "📍 地區: $REGION"
echo "📍 服務名稱: $SERVICE_NAME"

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo "❌ 錯誤：找不到 .env 檔案"
    exit 1
fi

export $(grep -v '^#' .env | grep -E '^(SHOPIFY|GOOGLE|SESSION|FEDEX)' | xargs)

# 檢查必要變數
if [ -z "$SHOPIFY_SHOP_NAME" ] || [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CALLBACK_URL" ]; then
    echo "❌ 錯誤：.env 檔案中缺少 Shopify 或 Google 相關設定"
    exit 1
fi

echo "✅ 環境變數檢查通過"

# 設定 GCP 專案
echo "🔧 設定 GCP 專案..."
gcloud config set project $PROJECT_ID

# 啟用必要的 API（靜默模式）
echo "⚙️ 啟用 GCP API 服務..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

echo "☁️  正在部署到 Cloud Run..."
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
  --set-env-vars "FEDEX_API_BASE_URL=${FEDEX_API_BASE_URL}" \
  --set-env-vars "FEDEX_CLIENT_ID=${FEDEX_CLIENT_ID}" \
  --set-env-vars "FEDEX_CLIENT_SECRET=${FEDEX_CLIENT_SECRET}" \
  --set-env-vars "FEDEX_ACCOUNT_NUMBER=${FEDEX_ACCOUNT_NUMBER}" \
  --set-env-vars "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
  --set-env-vars "SESSION_SECRET=${SESSION_SECRET}" \
  --set-env-vars "GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}" \
  --set-env-vars "JWT_SECRET=${JWT_SECRET}"

# ... (獲取服務 URL 並印出的部分維持不變) ...
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
