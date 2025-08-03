#!/bin/bash
# setup-gcp-for-sheets.sh
# 這個指令碼會自動化設定 Google Sheets API 所需的 GCP 資源。

set -e

# --- 設定 ---
GCP_PROJECT_ID=$(gcloud config get-value project)
SERVICE_ACCOUNT_NAME="sheets-writer-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="gcp-service-account.json"

echo "🚀 開始自動化設定 Google Sheets API..."
echo "📍 專案 ID: ${GCP_PROJECT_ID}"

# --- 步驟 1: 啟用 Google Sheets API ---
echo "⚙️  正在啟用 Google Sheets API..."
gcloud services enable sheets.googleapis.com

# --- 步驟 2: 建立服務帳戶 (如果不存在) ---
echo "🤖 正在建立服務帳戶: ${SERVICE_ACCOUNT_NAME}..."
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} >/dev/null 2>&1; then
    echo "ℹ️  服務帳戶 ${SERVICE_ACCOUNT_EMAIL} 已存在，跳過建立步驟。"
else
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --display-name="Service Account for Writing to Google Sheets"
    echo "✅ 成功建立服務帳戶。"
    
    # 等待服務帳戶完全建立
    echo "⏳ 等待服務帳戶傳播完成 (10秒)..."
    sleep 10
fi

# --- 步驟 3: 建立並下載服務帳戶金鑰 (含重試機制) ---
echo "🔑 正在建立並下載金鑰檔案: ${KEY_FILE}..."
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 ${MAX_RETRIES}); do
    if gcloud iam service-accounts keys create ${KEY_FILE} \
        --iam-account=${SERVICE_ACCOUNT_EMAIL} 2>/dev/null; then
        echo "✅ 成功建立金鑰檔案。"
        break
    else
        echo "⚠️ 嘗試 ${i}/${MAX_RETRIES}: 建立金鑰失敗，等待 ${RETRY_DELAY} 秒後重試..."
        sleep ${RETRY_DELAY}
    fi
done

if [ ! -f "${KEY_FILE}" ]; then
    echo "❌ 錯誤：無法建立金鑰檔案，請手動檢查服務帳戶狀態。"
    exit 1
fi

# --- 步驟 4: 將金鑰檔案加入 .gitignore ---
if ! grep -q "${KEY_FILE}" .gitignore; then
    echo "🔒 正在將 ${KEY_FILE} 加入 .gitignore..."
    echo "" >> .gitignore
    echo "# Google Service Account Key" >> .gitignore
    echo "${KEY_FILE}" >> .gitignore
    echo "✅ 已成功加入 .gitignore。"
else
    echo "ℹ️  ${KEY_FILE} 已存在於 .gitignore 中。"
fi

echo -e "\n🎉 GCP 設定完成！"
echo "下一步請執行以下手動操作："
echo "1. 建立一個 Google Sheet。"
echo "2. 點擊『共用』，並將以下 Email 加入為『編輯者』："
echo "   -> ${SERVICE_ACCOUNT_EMAIL}"
echo "3. 將你建立的 Google Sheet ID 填入 .env 檔案的 GOOGLE_SHEET_ID 變數中。"
