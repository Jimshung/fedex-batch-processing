#!/usr/bin/env node

const gcpService = require('../src/services/gcpService');
const config = require('../src/config/config');
const logger = require('../src/utils/logger');

async function checkGCPSetup() {
  console.log('🔍 檢查 GCP 設置...\n');

  // 檢查配置
  console.log('📋 配置檢查:');
  console.log(`  - GCP Project ID: ${config.gcp.projectId || '❌ 未設置'}`);
  console.log(`  - Key File: ${config.gcp.keyFilename || '❌ 未設置'}`);
  console.log(`  - Firestore Collections:`);
  console.log(`    - Orders: ${config.gcp.firestore.collectionPrefix}orders`);
  console.log(
    `    - Documents: ${config.gcp.firestore.collectionPrefix}documents`
  );
  console.log(`  - Cloud Storage Bucket: ${config.gcp.storage.bucketName}`);
  console.log('');

  // 檢查必要配置
  const missingConfigs = [];
  if (!config.gcp.projectId) missingConfigs.push('GCP_PROJECT_ID');
  if (!config.gcp.keyFilename) missingConfigs.push('GCP_KEY_FILENAME');
  if (!config.gcp.storage.bucketName) missingConfigs.push('GCS_BUCKET_NAME');

  if (missingConfigs.length > 0) {
    console.log('❌ 缺少必要配置:');
    missingConfigs.forEach((config) => {
      console.log(`  - ${config}`);
    });
    console.log('\n請在 .env 檔案中設置這些環境變數');
    process.exit(1);
  }

  // 測試 GCP 連接
  console.log('🔗 測試 GCP 連接...');
  try {
    const connectionResult = await gcpService.testConnection();

    if (connectionResult.firestore && connectionResult.storage) {
      console.log('✅ GCP 連接測試成功');
      console.log('  - Firestore: ✅');
      console.log('  - Cloud Storage: ✅');
    } else {
      console.log('⚠️  GCP 連接測試部分成功');
      console.log(`  - Firestore: ${connectionResult.firestore ? '✅' : '❌'}`);
      console.log(
        `  - Cloud Storage: ${connectionResult.storage ? '✅' : '❌'}`
      );
    }
  } catch (error) {
    console.log('❌ GCP 連接測試失敗');
    console.log(`  錯誤: ${error.message}`);

    if (error.message.includes('authentication')) {
      console.log('\n💡 可能的解決方案:');
      console.log('  1. 確認 service account key 檔案存在且有效');
      console.log('  2. 確認 service account 有足夠權限');
      console.log('  3. 確認 GCP Project ID 正確');
    } else if (error.message.includes('permission')) {
      console.log('\n💡 可能的解決方案:');
      console.log('  1. 確認 service account 有 Firestore 讀寫權限');
      console.log('  2. 確認 service account 有 Cloud Storage 讀寫權限');
      console.log('  3. 確認 Firestore 和 Cloud Storage API 已啟用');
    }

    process.exit(1);
  }

  // 檢查 Firestore 索引
  console.log('\n📊 檢查 Firestore 索引...');
  try {
    const db = gcpService.getFirestore();

    // 測試常用查詢
    const testQueries = [
      {
        name: '狀態查詢',
        query: () =>
          db
            .collection('orders')
            .where('status.current', '==', 'pending_review')
            .limit(1)
            .get(),
      },
      {
        name: '複合查詢',
        query: () =>
          db
            .collection('orders')
            .where('status.current', '==', 'completed')
            .where('status.shopify_fulfillment', '==', 'unfulfilled')
            .limit(1)
            .get(),
      },
    ];

    for (const testQuery of testQueries) {
      try {
        await testQuery.query();
        console.log(`  - ${testQuery.name}: ✅`);
      } catch (error) {
        if (error.message.includes('index')) {
          console.log(`  - ${testQuery.name}: ⚠️  需要建立索引`);
          console.log(`    錯誤: ${error.message}`);
        } else {
          console.log(`  - ${testQuery.name}: ❌ ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`  ❌ 索引檢查失敗: ${error.message}`);
  }

  console.log('\n✅ GCP 設置檢查完成！');
  console.log('\n📝 下一步:');
  console.log('  1. 如果看到索引警告，請在 GCP Console 中建立必要的複合索引');
  console.log('  2. 執行 npm run migrate-orders 來遷移現有訂單資料');
  console.log('  3. 更新現有服務以使用新的資料庫服務');
}

// 如果直接執行此腳本
if (require.main === module) {
  checkGCPSetup().catch((error) => {
    console.error('檢查失敗:', error);
    process.exit(1);
  });
}

module.exports = checkGCPSetup;
