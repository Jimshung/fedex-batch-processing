#!/bin/bash

# 部署 FedEx 訂單處理系統的 HTTP 伺服器到 Cloud Run

set -e

# 配置變數
PROJECT_ID="shopify-webhook-handler-467707"
REGION="asia-east1"
SERVICE_NAME="fedex-order-processor"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
SERVICE_ACCOUNT="sheets-writer-sa@shopify-webhook-handler-467707.iam.gserviceaccount.com"

echo "🚀 開始部署 FedEx 訂單處理系統..."

# 檢查環境變數檔案
if [ ! -f ".env" ]; then
    echo "❌ 錯誤：找不到 .env 檔案"
    echo "請先複製 env-example.txt 為 .env 並填入正確的環境變數"
    exit 1
fi

# 從 .env 文件讀取環境變數
export $(grep -v '^#' .env | xargs)

# 檢查必要的環境變數
if [ -z "$SHOPIFY_SHOP_NAME" ] || [ -z "$SHOPIFY_ACCESS_TOKEN" ] || [ -z "$GOOGLE_SHEET_ID" ] || [ -z "$FEDEX_CLIENT_ID" ] || [ -z "$FEDEX_CLIENT_SECRET" ] || [ -z "$FEDEX_ACCOUNT_NUMBER" ]; then
    echo "❌ 錯誤：.env 檔案中缺少必要的環境變數"
    echo "請確保 .env 檔案包含所有必要的設定"
    exit 1
fi

# 1. 建立 Docker 映像
echo "📦 建立 Docker 映像..."
docker build -t $IMAGE_NAME .

# 2. 推送到 Google Container Registry
echo "📤 推送映像到 Google Container Registry..."
docker push $IMAGE_NAME

# 3. 部署到 Cloud Run
echo "🌐 部署到 Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --service-account $SERVICE_ACCOUNT \
  --set-env-vars "NODE_ENV=production" \
  --update-env-vars "SHOPIFY_SHOP_NAME=${SHOPIFY_SHOP_NAME},SHOPIFY_ACCESS_TOKEN=${SHOPIFY_ACCESS_TOKEN},GOOGLE_SHEET_ID=${GOOGLE_SHEET_ID},FEDEX_CLIENT_ID=${FEDEX_CLIENT_ID},FEDEX_CLIENT_SECRET=${FEDEX_CLIENT_SECRET},FEDEX_ACCOUNT_NUMBER=${FEDEX_ACCOUNT_NUMBER}"

# 4. 獲取服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format "value(status.url)")

echo "✅ 部署完成！"
echo "🌐 服務 URL: $SERVICE_URL"
echo "📊 儀表板: $SERVICE_URL"
echo "🔧 API 端點:"
echo "  - 健康檢查: $SERVICE_URL/health"
echo "  - 處理已核准訂單: POST $SERVICE_URL/api/process-approved-orders"
echo "  - 獲取統計資訊: GET $SERVICE_URL/api/stats"
echo "  - 重新處理失敗訂單: POST $SERVICE_URL/api/retry-failed-orders"
echo "  - 獲取所有訂單: GET $SERVICE_URL/api/orders"

# 5. 設定 Cloud Scheduler 來觸發處理（可選）
echo ""
echo "📅 是否要設定 Cloud Scheduler 來定期觸發處理？(y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "設定 Cloud Scheduler..."
    gcloud scheduler jobs create http process-approved-orders-job \
      --schedule="*/15 * * * *" \
      --uri="$SERVICE_URL/api/process-approved-orders" \
      --http-method=POST \
      --location=$REGION \
      --project=$PROJECT_ID \
      --description="每15分鐘自動處理已核准的訂單"
    
    echo "✅ Cloud Scheduler 已設定！"
fi

echo ""
echo "🎉 部署完成！Serena 現在可以透過以下方式使用系統："
echo "1. 開啟瀏覽器訪問: $SERVICE_URL"
echo "2. 在 Google Sheet 中勾選要核准的訂單"
echo "3. 點擊「處理已核准訂單」按鈕"
echo "4. 查看即時處理狀態和結果" 