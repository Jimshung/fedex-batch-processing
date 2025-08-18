#!/bin/bash

# 🚀 Production 環境部署 FedEx 訂單處理系統到 GCP Cloud Run

set -e

echo "🎯 開始 Production 環境部署到 GCP..."

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "shopify-webhook-handler")
REGION="asia-east1"
SERVICE_NAME="shopify-webhook-handler-production"

echo "📍 專案: $PROJECT_ID"
echo "📍 地區: $REGION"
echo "📍 服務名稱: $SERVICE_NAME"

# 檢查 .env.prod 檔案
if [ ! -f ".env.prod" ]; then
    echo "❌ 錯誤：找不到 .env.prod 檔案"
    echo "請先創建 .env.prod 檔案並填入 Production 環境變數"
    exit 1
fi

echo "📋 使用 .env.prod 檔案進行 Production 部署"

# 讀取 .env.prod 檔案
export $(grep -v '^#' .env.prod | grep -E '^(SHOPIFY|GOOGLE|SESSION|FEDEX)' | xargs)

# 檢查必要變數
if [ -z "$SHOPIFY_SHOP_NAME" ] || [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CALLBACK_URL" ]; then
    echo "❌ 錯誤：.env.prod 檔案中缺少 Shopify 或 Google 相關設定"
    exit 1
fi

# 檢查 FedEx Production 配置
if [ -z "$FEDEX_API_BASE_URL" ] || [ -z "$FEDEX_CLIENT_ID" ] || [ -z "$FEDEX_CLIENT_SECRET" ] || [ -z "$FEDEX_ACCOUNT_NUMBER" ]; then
    echo "❌ 錯誤：.env.prod 檔案中缺少 FedEx Production 相關設定"
    exit 1
fi

# 確認是否為 Production 環境
if [[ "$FEDEX_API_BASE_URL" != *"apis.fedex.com"* ]]; then
    echo "⚠️  警告：FEDEX_API_BASE_URL 不是 Production 環境"
    echo "當前設定: $FEDEX_API_BASE_URL"
    echo "預期設定: https://apis.fedex.com"
    read -p "是否繼續部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 1
    fi
fi

echo "✅ Production 環境變數檢查通過"
echo "🔗 FedEx API: $FEDEX_API_BASE_URL"

# 設定 GCP 專案
echo "🔧 設定 GCP 專案..."
gcloud config set project $PROJECT_ID

# 啟用必要的 API（靜默模式）
echo "⚙️ 啟用 GCP API 服務..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

echo "☁️  正在部署 Production 版本到 Cloud Run..."
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

# 獲取服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo ""
echo "🎉 Production 部署成功！"
echo "🌐 你的應用程式網址: $SERVICE_URL"
echo "🔗 直接點擊就能使用: $SERVICE_URL"
echo ""
echo "📋 重要資訊："
echo "• 健康檢查: $SERVICE_URL/health"
echo "• 主頁面: $SERVICE_URL"
echo "• API 文件: $SERVICE_URL/api"
echo ""
echo "🧪 測試 Production 環境："
echo "• 本地測試配置: node scripts/test-production-config.js"
echo "• 本地測試訂單: node scripts/test-production-order-env.js"
echo "• 線上測試: 訪問 $SERVICE_URL 並登入測試"

echo ""
