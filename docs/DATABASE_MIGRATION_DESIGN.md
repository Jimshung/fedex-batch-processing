# 資料庫遷移設計方案

## 概述

本文檔詳細記錄將 `orders.json` 文件存儲遷移到 Cloud Firestore 的完整設計方案，包括資料結構、狀態管理、API 整合等各個方面。

## 🎯 設計目標

### 1. 核心需求

- 將 `orders.json` 文件存儲遷移到 NoSQL 資料庫
- 保持現有業務邏輯不變
- 支援 Shopify Fulfillment API 整合
- 存儲 FedEx 文件（Base64 編碼的 PDF）
- 簡化狀態管理，提高查詢效能

### 2. 技術選擇

- **資料庫**: Cloud Firestore (NoSQL)
- **文件存儲**: Google Cloud Storage
- **狀態管理**: 三層狀態追蹤系統
- **API 整合**: Shopify Fulfillment API

## 📊 資料庫設計

### Firestore Collections 結構

#### 1. Orders Collection（訂單集合）

**文檔 ID**: `shopify_order_id` (字串)

```javascript
{
  // === Shopify 原始資料 ===
  shopify_order_id: 5988838506555,
  order_number: 91096,
  customer_name: "Eileen Ho",
  customer_email: "eileen@example.com",
  phone: "+65 91234567",

  // === 地址資訊 ===
  original_address: {
    address1: "27 HAZEL PARK TERRACE #13-03",
    address2: "HAZEL PARK CONDOMINIUM",
    city: "Singapore",
    province: "",
    postal_code: "678949",
    country_code: "SG"
  },

  // === 處理後地址（FedEx 格式） ===
  processed_address: {
    address1: "27 HAZEL PARK TERRACE #13-03, HAZEL",
    address2: "PARK CONDOMINIUM",
    address3: ""
  },

  // === 金額資訊 ===
  pricing: {
    original_total: 229.41,
    customs_value: 84,
    currency: "USD"
  },

  // === 商品資訊 ===
  items: [
    {
      sku: "neuralli_mp",
      name: "Neuralli MP - (SG) International",
      quantity: 3,
      price: 117.65
    }
  ],

  // === 狀態追蹤 ===
  status: {
    current: "pending_review",           // 本地處理狀態
    shopify_fulfillment: "unfulfilled",  // Shopify 出貨狀態
    fedex_shipment: "not_created"        // FedEx 貨運狀態
  },

  // === FedEx 資訊 ===
  fedex: {
    tracking_number: "883807866949",
    transaction_id: "502d1900-e1fb-4321-9a6c-f9ec6d04c0cd",
    customer_transaction_id: "90084",
    service_type: "INTERNATIONAL_PRIORITY",
    service_name: "International Priority®",
    ship_datestamp: "2025-08-25",
    service_category: "EXPRESS",



    // === 包裹資訊 ===
    package: {
      sequence_number: 1,
      signature_option: "SERVICE_DEFAULT",
      barcodes: {
        fedex_1d: "1071447373761167209400883807866949",
        common_2d: "Wyk+HjAxHTAyNTg4OTk2HTcwMh0wMR04ODM4MDc4NjY5NDkwNDMwHUZERR03MDkzNTcyMzkdMjM3HR0xLzEdMC4wNktHHU4dMSBKYWxhbiBBbmFrIEJ1a2l0LCAjMDgtMTQgU2hlcndvb2QdU2luZ2Fwb3JlHSAgHVRlcmVzYSBUZXN0HjA2HTEwWkVJSTA4HTExWlJlY2lwaWVudCBDb21wYW55IE5hbWUdMTJaMTIzNDU2Nzg5MB0xNFpUb3dlcnMgKExvdy1SaXNlKR0xNVoyNjE1OTc0MDkdMzFaMTA3MTQ0NzM3Mzc2MTE2NzIwOTQwMDg4MzgwNzg2Njk0OR0zMlowMjU0HTM5WlRTQUEdOTlaRUkwMDA2HFRXHDI4HFVTRBxOZXVyYWxsaSBNUCAtIEFzaWEcHDcwOTM1NzIzOR0eMDkdRkRYHXodOB06OAUlPx1/QB4E"
      }
    },

    // === ETD 資訊 ===
    etd: {
      folder_id: "oMqtDqpPlTrqauLo",
      type: "ELECTRONIC_DOCUMENTS_ONLY",
      documents: [
        {
          document_type: "ETD_LABEL",
          document_id: "RSOifv6SCUG7doyz"
        },
        {
          document_type: "COMMERCIAL_INVOICE",
          document_id: "PpMAWCiqbyLpiRQg"
        }
      ]
    },

    // === 文件需求 ===
    document_requirements: {
      required_documents: ["COMMERCIAL_OR_PRO_FORMA_INVOICE", "AIR_WAYBILL"],
      prohibited_documents: ["USMCA_COMMERCIAL_INVOICE_CERTIFICATION_OF_ORIGIN", "USMCA_CERTIFICATION_OF_ORIGIN"]
    },

    created_at: "2025-08-18T16:45:18.464Z"
  },

  // === Shopify Fulfillment 資訊 ===
  shopify_fulfillment: {
    fulfillment_id: null,
    tracking_number: null,
    tracking_url: null,
    status: "pending",  // pending, success, failed
    error_message: null,
    retry_count: 0,
    last_attempt: null
  },

  // === 時間戳記 ===
  timestamps: {
    created_at: "2025-08-18T16:44:41.845Z",
    updated_at: "2025-08-18T16:45:18.464Z",
    completed_at: null,
    failed_at: null
  }
}
```

#### 2. Documents Collection（文件集合）

**文檔 ID**: 自動生成

```javascript
{
  // === 關聯資訊 ===
  order_id: 5988838506555,
  order_number: 91096,

  // === 文件資訊 ===
  document_type: "shipping_label",  // shipping_label, commercial_invoice, air_waybill
  content_type: "application/pdf",
  file_name: "91096_shipping_label.pdf",
  file_size: 12510,  // bytes

  // === FedEx 文件資訊 ===
  fedex_document: {
    content_key: "PpMAWCiqbyLpiRQg",  // FedEx 文件 ID
    doc_type: "PDF",
    copies_to_print: 1,
    tracking_number: "883807866949"
  },

  // === 存儲資訊 ===
  storage: {
    bucket: "fedex-documents",
    path: "shipping-labels/2025/08/91096_label.pdf",
    url: "https://storage.googleapis.com/fedex-documents/shipping-labels/2025/08/91096_label.pdf"
  },

  // === Base64 備份（可選，用於快速預覽） ===
  encoded_content: "JVBERi0xLjQKJcOkw7zDtsO...",  // Base64 編碼的 PDF

  // === 時間戳記 ===
  created_at: "2025-08-18T16:45:18.464Z"
}
```

## 🔄 狀態管理重新設計

### 1. 三層狀態追蹤系統

```javascript
status: {
  current: "completed",              // 本地處理狀態
  shopify_fulfillment: "fulfilled",  // Shopify 出貨狀態
  fedex_shipment: "created"         // FedEx 貨運狀態
}
```

### 2. 狀態對應關係

| 本地狀態         | FedEx 狀態    | Shopify 狀態  | 說明               |
| ---------------- | ------------- | ------------- | ------------------ |
| `pending_review` | `not_created` | `unfulfilled` | 新訂單，等待審核   |
| `approved`       | `not_created` | `unfulfilled` | 已核准，等待處理   |
| `processing`     | `creating`    | `unfulfilled` | 正在呼叫 FedEx API |
| `completed`      | `created`     | `fulfilled`   | 成功建立貨運標籤   |
| `failed`         | `failed`      | `unfulfilled` | FedEx API 呼叫失敗 |

### 3. 狀態轉換流程

```
1. 訂單同步 → status.current: "pending_review"
2. 用戶核准 → status.current: "approved"
3. 開始處理 → status.current: "processing"
4. FedEx 成功 → status.current: "completed", fedex_shipment: "created"
5. Shopify 回寫 → shopify_fulfillment: "fulfilled"
```

## 📋 Shopify Fulfillment API 整合

### 1. 最小必要資料

```javascript
// 呼叫 Shopify Fulfillment API 只需要這些資料
{
  tracking_number: "794901371704",
  tracking_company: "FedEx",
  tracking_url: "https://www.fedex.com/fedextrack/?trknbr=794901371704",
  line_items: [
    {
      id: 123456789,  // Shopify line item ID
      quantity: 3
    }
  ]
}
```

### 2. API 端點

```javascript
// 建立 Fulfillment
POST / admin / api / 2024 - 07 / orders / { order_id } / fulfillments.json;

// 更新 Fulfillment
PUT / admin / api / 2024 -
  07 / orders / { order_id } / fulfillments / { fulfillment_id }.json;
```

### 3. 錯誤處理策略

```javascript
shopify_fulfillment: {
  status: "pending",        // pending, success, failed
  error_message: null,      // 錯誤訊息
  retry_count: 0,          // 重試次數
  last_attempt: null,      // 最後嘗試時間
  fulfillment_id: null     // Shopify fulfillment ID
}
```

## 🔍 查詢優化設計

### 1. Firestore 索引設計

```javascript
// 複合索引 1: 查詢待處理的訂單
Collection: orders;
Fields: -status.current(Ascending) -
  status.shopify_fulfillment(Ascending) -
  timestamps.created_at(Ascending);

// 複合索引 2: 查詢失敗的訂單
Collection: orders;
Fields: -status.current(Ascending) - timestamps.failed_at(Descending);

// 複合索引 3: 查詢特定國家的訂單
Collection: orders;
Fields: -original_address.country_code(Ascending) -
  status.current(Ascending) -
  timestamps.created_at(Descending);
```

### 2. 常用查詢模式

```javascript
// 查詢待處理的訂單
db.collection('orders')
  .where('status.current', '==', 'completed')
  .where('status.shopify_fulfillment', '==', 'unfulfilled')
  .orderBy('timestamps.created_at')
  .limit(50);

// 查詢失敗的訂單
db.collection('orders')
  .where('status.current', '==', 'failed')
  .orderBy('timestamps.failed_at', 'desc')
  .limit(20);

// 查詢特定國家的訂單
db.collection('orders')
  .where('original_address.country_code', '==', 'SG')
  .where('status.current', '==', 'pending_review')
  .orderBy('timestamps.created_at', 'desc');
```

## 📁 文件存儲設計

### 1. Google Cloud Storage 結構

```
gs://fedex-documents/
├── shipping-labels/
│   ├── 2025/
│   │   ├── 08/
│   │   │   ├── 91096_label.pdf
│   │   │   └── 91097_label.pdf
│   │   └── 09/
│   └── 2024/
├── commercial-invoices/
│   ├── 2025/
│   │   ├── 08/
│   │   │   ├── 91096_invoice.pdf
│   │   │   └── 91097_invoice.pdf
│   │   └── 09/
│   └── 2024/
└── temp/
    └── {timestamp}_temp.pdf
```

### 2. 文件處理流程

#### 文件提取路徑

**商業發票 (Commercial Invoice):**

- 路徑：`output.transactionShipments[0].shipmentDocuments[0].encodedLabel`
- 條件：`contentType === 'COMMERCIAL_INVOICE'`
- 儲存位置：`commercial-invoices/{year}/{month}/{orderNumber}_invoice.pdf`

**貨運標籤 (Shipping Label):**

- 路徑：`output.transactionShipments[0].pieceResponses[0].packageDocuments[0].encodedLabel`
- 條件：`contentType === 'LABEL'`
- 儲存位置：`shipping-labels/{year}/{month}/{orderNumber}_label.pdf`

#### 處理步驟

1. **Base64 解碼**：將 FedEx API 回應的 `encodedLabel` 轉換為 PDF Buffer
2. **文件上傳**：上傳到 Google Cloud Storage 並設為公開存取
3. **記錄儲存**：將文件資訊儲存到 Firestore 的 `documents` collection
4. **URL 回傳**：返回公開可訪問的 GCS URL

#### 已實作功能

✅ **文件提取邏輯**：正確從 FedEx API 回應中提取商業發票和貨運標籤  
✅ **公開存取設定**：上傳的文件自動設為公開，可直接訪問  
✅ **錯誤處理**：完整的錯誤處理和日誌記錄  
✅ **文件分類**：按年份/月份組織文件結構

## 🔄 遷移策略

### 1. 資料遷移流程

```javascript
// 步驟 1: 讀取現有 orders.json
const orders = JSON.parse(fs.readFileSync('orders.json', 'utf8'));

// 步驟 2: 轉換資料結構
const transformedOrders = orders.map((order) => transformOrderData(order));

// 步驟 3: 批次寫入 Firestore
const batch = db.batch();
transformedOrders.forEach((order) => {
  const docRef = db.collection('orders').doc(order.shopify_order_id.toString());
  batch.set(docRef, order);
});
await batch.commit();
```

### 2. 並行運行策略

**階段 1: 準備階段**

- 實現 Firestore 版本
- 保持 orders.json 作為備份
- 建立資料同步機制

**階段 2: 測試階段**

- 並行運行兩個版本
- 比較結果一致性
- 修正任何差異

**階段 3: 切換階段**

- 逐步切換到 Firestore
- 監控系統穩定性
- 驗證功能正常

**階段 4: 清理階段**

- 移除 orders.json 依賴
- 清理舊代碼
- 更新文檔

### 3. 資料驗證

```javascript
// 驗證資料完整性
const validationChecks = [
  '所有必要欄位都存在',
  '狀態值在有效範圍內',
  '時間戳記格式正確',
  '地址資訊完整',
  '商品資訊正確',
];

// 驗證業務邏輯
const businessChecks = [
  '已完成的訂單有 FedEx 追蹤號碼',
  '失敗的訂單有錯誤訊息',
  '狀態轉換符合業務規則',
  '金額計算正確',
];
```

## 🚀 效能考量

### 1. 讀取優化

- 使用複合索引加速查詢
- 實作資料快取機制
- 批次讀取減少 API 呼叫

### 2. 寫入優化

- 使用批次寫入減少網路請求
- 實作重試機制處理失敗
- 非同步處理文件上傳

### 3. 成本優化

- 合理設計索引避免過度索引
- 實作資料生命週期管理
- 監控讀寫操作成本

## 🔒 安全性考量

### 1. 資料保護

- 加密敏感資料
- 實作存取控制
- 定期備份資料

### 2. API 安全

- 驗證 API 金鑰
- 實作速率限制
- 記錄安全事件

### 3. 文件安全

- 設定適當的 GCS 權限
- 實作文件存取控制
- 監控異常存取

## 📈 監控和維護

### 1. 關鍵指標

- 訂單處理成功率
- API 響應時間
- 資料庫查詢效能
- 文件上傳成功率

### 2. 日誌記錄

- 業務操作日誌
- 錯誤日誌
- 效能日誌
- 安全事件日誌

### 3. 警報機制

- 處理失敗警報
- 效能下降警報
- 安全事件警報
- 成本超標警報

## 📝 實施計劃

### 階段 1: 基礎建設（1-2 週）

- 設置 Cloud Firestore
- 設置 Google Cloud Storage
- 建立基礎索引
- 實作資料遷移工具

### 階段 2: 核心功能（2-3 週）

- 實作 Firestore 服務層
- 更新現有 API 端點
- 實作文件上傳功能
- 測試核心功能

### 階段 3: Shopify 整合（1-2 週）

- 實作 Shopify Fulfillment API
- 實作錯誤處理和重試
- 測試完整流程
- 優化效能

### 階段 4: 遷移和清理（1 週）

- 執行資料遷移
- 並行測試
- 切換到新系統
- 清理舊代碼

## 🎯 成功標準

### 功能標準

- ✅ 所有現有功能正常運作
- ✅ 新增 Shopify Fulfillment 功能
- ✅ 文件存儲和檢索正常
- ✅ 狀態管理準確

### 效能標準

- ✅ 查詢響應時間 < 500ms
- ✅ 文件上傳時間 < 5s
- ✅ 系統可用性 > 99.9%
- ✅ 資料一致性 100%

### 成本標準

- ✅ Firestore 讀寫成本 < $50/月
- ✅ GCS 存儲成本 < $20/月
- ✅ 總成本控制在預算內

## 🔄 設計更新記錄

### 版本 1.2 (2025-08-25) - 簡化設計，專注業務流程

#### 設計簡化

- **移除費率資訊**: 專注於完成業務流程，移除成本分析相關欄位
- **保留核心功能**: 只保留完成 "Shopify 訂單 → 本地處理 → FedEx API → 文件存儲 → Shopify 回寫" 流程所需的欄位

#### 保留的重要欄位

**FedEx 資訊增強：**

- `customer_transaction_id`: 客戶交易 ID
- `service_name`: 服務名稱（如 "International Priority®"）
- `ship_datestamp`: 出貨日期
- `service_category`: 服務類別（如 "EXPRESS"）

**包裹資訊 (`fedex.package`):**

- `sequence_number`: 包裹序號
- `signature_option`: 簽名選項
- `barcodes`: 條碼資訊（1D 和 2D）

**ETD 資訊 (`fedex.etd`):**

- `folder_id`: ETD 資料夾 ID
- `type`: ETD 類型
- `documents`: 相關文件清單

**文件需求 (`fedex.document_requirements`):**

- `required_documents`: 必要文件清單
- `prohibited_documents`: 禁止文件清單

#### 文件處理增強

**支援多種文件類型：**

- 商業發票 (Commercial Invoice)
- 貨運標籤 (Shipping Label)
- 空運提單 (Air Waybill)

**FedEx 文件資訊 (`fedex_document`):**

- `content_key`: FedEx 文件 ID
- `doc_type`: 文件類型
- `copies_to_print`: 列印份數
- `tracking_number`: 追蹤號碼

#### 業務價值

1. **完整的追蹤資訊**: 可以追蹤和分析貨運狀態
2. **條碼資訊**: 支援條碼掃描和追蹤
3. **ETD 整合**: 完整的電子文件追蹤
4. **文件合規**: 清楚記錄文件需求和限制
5. **多文件支援**: 支援商業發票和貨運標籤的完整處理

---

**文檔版本**: 1.2  
**最後更新**: 2025-08-25  
**作者**: Jim Wu  
**審核狀態**: 待審核
