// server.js - Express 伺服器
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const orderProcessingService = require('./services/orderProcessingService');
const googleSheetService = require('./services/googleSheetService');
const logger = require('./utils/logger');
const config = require('./config/config');
const {
  passport,
  requireAuth,
  requireBenedbiomed,
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8080;

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

      const result = await orderProcessingService.processApprovedOrders();

      res.json({
        success: true,
        data: result,
        message: `處理完成！成功: ${result.successCount}, 失敗: ${result.failedCount}`,
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

// 獲取處理統計資訊
app.get('/api/stats', requireAuth, requireBenedbiomed, async (req, res) => {
  try {
    const stats = await orderProcessingService.getProcessingStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`獲取統計資訊時發生錯誤: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '獲取統計資訊時發生錯誤',
    });
  }
});

// 重新處理失敗的訂單
app.post(
  '/api/retry-failed-orders',
  requireAuth,
  requireBenedbiomed,
  async (req, res) => {
    try {
      logger.info('收到重新處理失敗訂單的請求');

      const result = await orderProcessingService.retryFailedOrders();

      res.json({
        success: true,
        data: result,
        message: result.message,
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

// 獲取所有訂單數據
app.get('/api/orders', requireAuth, requireBenedbiomed, async (req, res) => {
  try {
    const orders = await googleSheetService.readAllOrders(
      config.google.sheetId
    );

    res.json({
      success: true,
      orders: orders,
      message: `成功獲取 ${orders.length} 筆訂單`,
    });
  } catch (error) {
    logger.error(`獲取訂單數據時發生錯誤: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '獲取訂單數據時發生錯誤',
    });
  }
});

// 新增：獲取處理過的訂單數據（供 Google Apps Script 使用）
app.get(
  '/api/processed-orders',
  requireAuth,
  requireBenedbiomed,
  async (req, res) => {
    try {
      logger.info('收到獲取處理過訂單的請求');

      // 從 Shopify 獲取未出貨訂單
      const shopifyService = require('./services/shopifyService');
      const allOrders = await shopifyService.getUnfulfilledOrders();

      if (allOrders.length === 0) {
        res.json({
          success: true,
          orders: [],
          message: '目前沒有未出貨訂單',
        });
        return;
      }

      // 篩選亞洲國家訂單
      const asiaOrders = shopifyService.filterOrdersByCountry(
        allOrders,
        config.asiaCountries
      );

      if (asiaOrders.length === 0) {
        res.json({
          success: true,
          orders: [],
          message: '沒有符合亞洲國家條件的訂單',
        });
        return;
      }

      // 轉換為 Google Apps Script 需要的格式
      const processedOrders = asiaOrders.map((order) => {
        const shippingAddress = order.shipping_address || {};
        const customer = order.customer || {};

        return {
          id: order.id?.toString() || '',
          order_number: order.order_number?.toString() || '',
          customer_name:
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
            '未知客戶',
          processed_address1: shippingAddress.address1 || '',
          processed_address2: shippingAddress.address2 || '',
          original_address1: shippingAddress.address1 || '',
          original_address2: shippingAddress.address2 || '',
          total_price: order.total_price || '',
          currency: order.currency || '',
          line_items: order.line_items || [],
          status: order.fulfillment_status || 'unfulfilled',
        };
      });

      res.json({
        success: true,
        orders: processedOrders,
        message: `成功獲取 ${processedOrders.length} 筆亞洲訂單`,
      });
    } catch (error) {
      logger.error(`獲取處理過訂單時發生錯誤: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        message: '獲取處理過訂單時發生錯誤',
      });
    }
  }
);

// 錯誤處理中間件
app.use((error, req, res, next) => {
  logger.error(`伺服器錯誤: ${error.message}`);
  res.status(500).json({
    success: false,
    error: '內部伺服器錯誤',
    message: error.message,
  });
});

// 根路徑重定向
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, '../public/login.html'));
  }
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

// 啟動伺服器
app.listen(PORT, () => {
  logger.success(`伺服器已啟動，監聽端口: ${PORT}`);
  logger.info(`健康檢查端點: http://localhost:${PORT}/health`);
  logger.info(
    `處理已核准訂單端點: POST http://localhost:${PORT}/api/process-approved-orders`
  );
  logger.info(`獲取統計資訊端點: GET http://localhost:${PORT}/api/stats`);
  logger.info(
    `重新處理失敗訂單端點: POST http://localhost:${PORT}/api/retry-failed-orders`
  );
  logger.info(`獲取所有訂單端點: GET http://localhost:${PORT}/api/orders`);
});

module.exports = app;
