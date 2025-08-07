// create-google-apps-script.js - 生成 Google Apps Script 代碼
const fs = require('fs');
const path = require('path');

function createGoogleAppsScript() {
  // 讀取最新的 google-apps-script.js 文件
  const scriptPath = path.join(__dirname, 'google-apps-script.js');

  if (fs.existsSync(scriptPath)) {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    console.log('✅ 已從 scripts/google-apps-script.js 生成最新版本');
    console.log('');
    console.log('📋 使用說明：');
    console.log('1. 複製 scripts/google-apps-script.js 的內容');
    console.log('2. 在 Google Sheet 中點擊「擴充功能」→「Apps Script」');
    console.log('3. 貼上代碼並儲存');
    console.log('4. 重新整理 Google Sheet，會出現「FedEx 訂單處理」選單');
    console.log('5. 點擊「初始化表格結構」建立基本結構');
    console.log('6. 設定 Shopify 配置後點擊「同步 Shopify 訂單」');
    console.log('');
    console.log('🎯 重要設定：');
    console.log('- 請在 CONFIG.SHOPIFY 中設定您的 Shopify 商店資訊');
    console.log('- SHOP_NAME: 您的商店名稱（例如：my-shop）');
    console.log('- ACCESS_TOKEN: 您的 Shopify Access Token');
    console.log('');
    console.log('🚀 功能說明：');
    console.log('- 自動從 Shopify 獲取未出貨訂單');
    console.log('- 篩選亞洲國家訂單');
    console.log('- 在 Google Sheets 中處理訂單');
    console.log('- 模擬 FedEx API 處理（可替換為真實 API）');
    console.log('');
    console.log('📝 代碼內容：');
    console.log('='.repeat(50));
    console.log(scriptContent);
    console.log('='.repeat(50));
  } else {
    console.log('❌ 找不到 scripts/google-apps-script.js 文件');
    console.log('請先確保該文件存在');
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  createGoogleAppsScript();
}

module.exports = { createGoogleAppsScript };
