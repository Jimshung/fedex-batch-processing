#!/bin/bash
# 專案初始化與設定腳本

echo "🚀 開始設定 FedEx 批次處理系統..."

# 1. 安裝依賴
echo "🔧 安裝 Node.js 依賴..."
npm install

# 2. 設定環境變數
echo "🔧 設定環境變數..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠️ 請編輯 .env 檔案設定您的認證資訊"
else
  echo "ℹ️ .env 檔案已存在，跳過建立"
fi

# 3. 設定 GCP 服務帳號
echo "🔧 設定 GCP 服務帳號..."
if [ ! -f "service-account.json" ]; then
  echo "⚠️ 請將 GCP 服務帳號金鑰檔案命名為 service-account.json 並放在專案根目錄"
else
  echo "ℹ️ GCP 服務帳號設定完成"
fi

echo "✅ 設定完成！請執行以下指令啟動系統："
echo "npm start"
