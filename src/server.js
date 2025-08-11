// server.js - Express 伺服器
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const OrderFileService = require('./services/orderFileService');
const shopifyService = require('./services/shopifyService');
const logger = require('./utils/logger');
const config = require('./config/config');
const {
  passport,
  requireAuth,
  requireBenedbiomed,
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8080; // Cloud Run 會自動設定 PORT 環境變數

// 【關鍵修改】
// 告訴 Express.js 應用程式，它正運行在一個反向代理後面。
// 這將允許 req.protocol 正確地回傳 'https'。
app.set('trust proxy', 1);

// Session 配置
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-default-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: 24 * 60 * 60 * 1000, // 24 小時
    },
    // 【建議新增】確保 session cookie 能在代理後正常運作
    proxy: true,
  })
);

// 初始化 Passport
app.use(passport.initialize());
app.use(passport.session());

// 中間件
app.use(
  cors({
    origin: true, // 允許所有 origins，但可以根據需要限制
    credentials: true, // 允許 cookies
  })
);
app.use(express.json());
app.use(express.static('public'));

// 健康檢查端點（無需認證）
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 簡單測試端點（無需認證）
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 調試端點（無需認證）
app.get('/debug', (req, res) => {
  res.json({
    status: 'debug',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    authenticated: req.isAuthenticated
      ? req.isAuthenticated()
      : 'function not available',
    user: req.user || null,
    sessionID: req.sessionID || 'no session',
  });
});

// Google OAuth 路由
app.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // 成功認證，重定向到儀表板
    res.redirect('/dashboard');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error(`登出錯誤: ${err.message}`);
    }
    res.redirect('/');
  });
});

// 登入失敗頁面
app.get('/login-failed', (req, res) => {
  res.send(`
    <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
      <h2>❌ 登入失敗</h2>
      <p>僅限 Benedbiomed 員工使用此系統</p>
      <p>請使用 @benedbiomed.com 郵箱登入</p>
      <a href="/auth/google" style="color: #007cba;">重新登入</a>
    </div>
  `);
});

// 用戶資訊 API
app.get('/api/user', requireAuth, requireBenedbiomed, (req, res) => {
  res.json({
    success: true,
    user: {
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
    },
  });
});

// 觸發已核准訂單處理
app.post(
  '/api/process-approved-orders',
  requireAuth,
  requireBenedbiomed,
  async (req, res) => {
    try {
      logger.info('收到處理已核准訂單的請求');
      const { orderIds } = req.body;
      logger.log('🚀 ~ orderIds:', orderIds);

      const orderFileService = new OrderFileService();
      let approvedOrders = await orderFileService.getApprovedOrders();

      // 如果有傳入特定訂單ID，則過濾出這些訂單
      if (orderIds && orderIds.length > 0) {
        approvedOrders = approvedOrders.filter((order) =>
          orderIds.includes(order.orderNumber)
        );
      }

      if (approvedOrders.length === 0) {
        return res.json({
          success: true,
          data: { processed: 0, succeeded: 0, failed: 0 },
          message:
            orderIds && orderIds.length > 0
              ? '沒有找到符合的已核准訂單'
              : '沒有已核准的訂單需要處理',
        });
      }

      const results = [];
      const FedExService = require('./services/fedexService');
      const fedexService = new FedExService();
      const documentPaths = [
        // 在這裡放你的固定 PDF 檔案路徑
        // './documents/commercial_invoice.pdf',
        // './documents/customs_declaration.pdf'
      ];

      for (const order of approvedOrders) {
        try {
          // 更新狀態為處理中
          await orderFileService.updateOrder(order.shopify_order_id, {
            status: 'processing',
            processing_status: '處理中',
          });

          // 呼叫 FedEx API
          const shipmentResult = await fedexService.processOrderShipment(
            order,
            documentPaths
          );

          if (shipmentResult.success) {
            // 出貨成功
            await orderFileService.updateOrder(order.shopify_order_id, {
              status: 'completed',
              processing_status: '已完成',
              fedex_tracking: shipmentResult.trackingNumber,
              notes_error: '',
              completed_at: new Date().toISOString(),
            });

            results.push({
              orderId: order.shopify_order_id,
              success: true,
              trackingNumber: shipmentResult.trackingNumber,
            });
          } else {
            // 出貨失敗
            await orderFileService.updateOrder(order.shopify_order_id, {
              status: 'failed',
              processing_status: '失敗',
              notes_error: shipmentResult.error || '未知錯誤',
              failed_at: new Date().toISOString(),
            });

            results.push({
              orderId: order.shopify_order_id,
              success: false,
              error: shipmentResult.error,
            });
          }
        } catch (error) {
          logger.error(
            `處理訂單 ${order.shopify_order_id} 失敗: ${error.message}`
          );

          await orderFileService.updateOrder(order.shopify_order_id, {
            status: 'failed',
            processing_status: '失敗',
            notes_error: error.message,
            failed_at: new Date().toISOString(),
          });

          results.push({
            orderId: order.shopify_order_id,
            success: false,
            error: error.message,
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      res.json({
        success: true,
        data: {
          processed: results.length,
          succeeded,
          failed,
          details: results,
        },
        message: `處理完成：${succeeded} 成功，${failed} 失敗`,
      });
    } catch (error) {
      logger.error(`處理已核准訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '處理已核准訂單時發生錯誤',
      });
    }
  }
);

// 重新處理失敗的訂單
app.post(
  '/api/retry-failed-orders',
  requireAuth,
  requireBenedbiomed,
  async (req, res) => {
    try {
      logger.info('收到重新處理失敗訂單的請求');

      const orderFileService = new OrderFileService();
      const failedOrders = await orderFileService.getFailedOrders();

      if (failedOrders.length === 0) {
        return res.json({
          success: true,
          data: { processed: 0, succeeded: 0, failed: 0 },
          message: '沒有失敗的訂單需要重新處理',
        });
      }

      const results = [];
      const FedExService = require('./services/fedexService');
      const fedexService = new FedExService();
      const documentPaths = [
        // 在這裡放你的固定 PDF 檔案路徑
        // './documents/commercial_invoice.pdf',
        // './documents/customs_declaration.pdf'
      ];

      for (const order of failedOrders) {
        try {
          // 重置狀態為處理中
          await orderFileService.updateOrder(order.shopify_order_id, {
            status: 'processing',
            processing_status: '重新處理中',
            notes_error: '',
          });

          // 呼叫 FedEx API
          const shipmentResult = await fedexService.processOrderShipment(
            order,
            documentPaths
          );

          if (shipmentResult.success) {
            // 出貨成功
            await orderFileService.updateOrder(order.shopify_order_id, {
              status: 'completed',
              processing_status: '已完成',
              fedex_tracking: shipmentResult.trackingNumber,
              notes_error: '',
              completed_at: new Date().toISOString(),
            });

            results.push({
              orderId: order.shopify_order_id,
              success: true,
              trackingNumber: shipmentResult.trackingNumber,
            });
          } else {
            // 出貨失敗
            await orderFileService.updateOrder(order.shopify_order_id, {
              status: 'failed',
              processing_status: '失敗',
              notes_error: shipmentResult.error || '未知錯誤',
              failed_at: new Date().toISOString(),
            });

            results.push({
              orderId: order.shopify_order_id,
              success: false,
              error: shipmentResult.error,
            });
          }
        } catch (error) {
          logger.error(
            `重新處理訂單 ${order.shopify_order_id} 失敗: ${error.message}`
          );

          await orderFileService.updateOrder(order.shopify_order_id, {
            status: 'failed',
            processing_status: '失敗',
            notes_error: error.message,
            failed_at: new Date().toISOString(),
          });

          results.push({
            orderId: order.shopify_order_id,
            success: false,
            error: error.message,
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      res.json({
        success: true,
        data: {
          processed: results.length,
          succeeded,
          failed,
          details: results,
        },
        message: `重新處理完成：${succeeded} 成功，${failed} 失敗`,
      });
    } catch (error) {
      logger.error(`重新處理失敗訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '重新處理失敗訂單時發生錯誤',
      });
    }
  }
);

// 獲取所有訂單數據 (僅未出貨、篩選過國家)
app.get('/api/orders', requireAuth, requireBenedbiomed, async (req, res) => {
  try {
    // 直接從 Shopify 獲取未出貨訂單（已在 shopifyService 中過濾亞洲國家）
    const allOrders = await shopifyService.getUnfulfilledOrders();

    if (allOrders.length === 0) {
      return res.json({
        success: true,
        orders: [],
        message: '目前沒有亞洲地區的未出貨訂單',
      });
    }

    // 處理訂單資料（不需要再次過濾國家，因為 shopifyService 已經過濾了）
    const processedOrders = allOrders.map((order) =>
      shopifyService.processOrderData(order)
    );

    // 動態 import camelcase-keys (ESM only)
    const camelcaseKeys = (await import('camelcase-keys')).default;
    const camelOrders = camelcaseKeys(processedOrders, { deep: true });

    res.json({
      success: true,
      orders: camelOrders,
      message: `成功獲取 ${camelOrders.length} 筆亞洲地區未出貨訂單`,
    });
  } catch (error) {
    logger.error(`獲取訂單數據時發生錯誤: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '獲取訂單數據失敗',
    });
  }
});

// 錯誤處理中間件
app.use((error, req, res, next) => {
  logger.error(`伺服器錯誤: ${error.message}`);
  res.status(500).json({
    success: false,
    error: '內部伺服器錯誤',
    message: error.message,
  });
});

// 根路徑重定向（暫時移除認證）
app.get('/', (req, res) => {
  res.json({
    message: 'FedEx Order Processor API',
    status: 'running',
    endpoints: {
      health: '/health',
      test: '/test',
      login: '/auth/google',
    },
  });
});

// 儀表板頁面（需要認證）
app.get('/dashboard', requireAuth, requireBenedbiomed, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 處理
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: '端點不存在',
      message: `找不到端點: ${req.method} ${req.path}`,
    });
  } else {
    res.status(404).send(`
      <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
        <h2>404 - 頁面不存在</h2>
        <a href="/" style="color: #007cba;">返回首頁</a>
      </div>
    `);
  }
});

// 新增同步訂單端點
app.post(
  '/api/sync-orders',
  requireAuth,
  requireBenedbiomed,
  async (req, res) => {
    try {
      logger.info('收到同步訂單請求');

      await shopifyService.fetchAndProcessOrders();
      res.json({
        success: true,
        message: '訂單同步完成，已更新本地 orders.json',
      });
    } catch (error) {
      logger.error(`同步訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '同步訂單失敗',
      });
    }
  }
);

// 啟動伺服器
app.listen(PORT, () => {
  logger.success(`伺服器已啟動，監聽端口: ${PORT}`);
  logger.info(`健康檢查端點: http://localhost:${PORT}/health`);
  logger.info(
    `處理已核准訂單端點: POST http://localhost:${PORT}/api/process-approved-orders`
  );
  logger.info(
    `重新處理失敗訂單端點: POST http://localhost:${PORT}/api/retry-failed-orders`
  );
  logger.info(`獲取所有訂單端點: GET http://localhost:${PORT}/api/orders`);
  logger.info(`同步訂單端點: POST http://localhost:${PORT}/api/sync-orders`);
});

module.exports = app;
