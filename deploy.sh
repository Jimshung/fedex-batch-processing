#!/bin/bash
# deploy.sh (v6 - 移除檢查並硬編碼 SA)

# 啟用更嚴格的錯誤處理
set -e

# --- 專案設定 ---
GCP_PROJECT_ID=$(gcloud config get-value project)
REGION="asia-east1"
JOB_NAME="fetch-shopify-orders-job"
SCHEDULER_NAME="trigger-fetch-shopify-job"

# 服務帳戶 Email 已直接指定
SERVICE_ACCOUNT_EMAIL="shopify-poller-sa@shopify-webhook-handler-467707.iam.gserviceaccount.com"

# --- 從 .env 檔案讀取環境變數 ---
if [ ! -f .env ]; then echo "❌ 錯誤：找不到 .env 檔案。"; exit 1; fi
SHOPIFY_SHOP_NAME=$(grep SHOPIFY_SHOP_NAME .env | cut -d '=' -f2)
SHOPIFY_ACCESS_TOKEN=$(grep SHOPIFY_ACCESS_TOKEN .env | cut -d '=' -f2)
if [ -z "$SHOPIFY_SHOP_NAME" ] || [ -z "$SHOPIFY_ACCESS_TOKEN" ]; then echo "❌ 錯誤：.env 檔案中缺少 Shopify 相關變數。"; exit 1; fi

echo "🚀 開始部署專案：$GCP_PROJECT_ID"
echo "📍 地區：$REGION"
echo "🤖 將使用服務帳戶：$SERVICE_ACCOUNT_EMAIL"

# --- 步驟 0: 更新 gcloud CLI (確保指令為最新) ---
echo "🔄 正在更新 gcloud components..."
gcloud components update --quiet

# --- 步驟 1: 啟用必要的 API 服務 ---
echo "⚙️  正在啟用必要的 API 服務..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com artifactregistry.googleapis.com

# --- 步驟 2: 使用 Cloud Build 建置容器映像檔 ---
echo "📦 正在使用 Cloud Build 建置容器映像檔..."
gcloud builds submit --region=$REGION --tag "${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/cloud-run-source-deploy/${JOB_NAME}"

# --- 步驟 3: 部署到 Cloud Run Jobs ---
echo "🏃‍♂️ 正在部署到 Cloud Run Jobs..."
gcloud run jobs deploy $JOB_NAME \
  --region=$REGION \
  --image="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/cloud-run-source-deploy/${JOB_NAME}" \
  --set-env-vars="SHOPIFY_SHOP_NAME=${SHOPIFY_SHOP_NAME}" \
  --set-env-vars="SHOPIFY_ACCESS_TOKEN=${SHOPIFY_ACCESS_TOKEN}"

# --- 步驟 4: 建立 Cloud Scheduler 工作 ---
echo "⏰ 正在建立 Cloud Scheduler 工作..."
# 先刪除可能已存在的同名工作，避免建立失敗
gcloud scheduler jobs delete $SCHEDULER_NAME --location=$REGION --quiet || true

# 建立 HTTP 請求來觸發 Cloud Run Job
gcloud scheduler jobs create http $SCHEDULER_NAME \
  --location=$REGION \
  --schedule="*/15 * * * *" \
  --time-zone="Asia/Taipei" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${GCP_PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="$SERVICE_ACCOUNT_EMAIL" \
  --headers="Content-Type=application/json"

echo "✅ 部署完成！"
echo "你可以前往 Cloud Scheduler 頁面，手動觸發 '$SCHEDULER_NAME' 來進行第一次測試。"