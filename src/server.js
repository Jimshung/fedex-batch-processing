// server.js - Express 伺服器
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');
const { passport } = require('./middleware/auth');
const { getAuthMiddleware } = require('./utils/authHelper');

// 路由
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

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

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 生產環境限制更嚴格
  message: {
    success: false,
    error: '請求過於頻繁',
    message: '請稍後再試',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 中間件
app.use(limiter);
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://intl-shipping-serena-*.run.app', 'https://*.run.app']
        : true, // 本地開發允許所有 origins
    credentials: true, // 允許 cookies
  })
);
app.use(express.json());
app.use(cookieParser());
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

// 調試端點（僅本地開發環境可用）
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', (req, res) => {
    res.json({
      status: 'debug',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      user: req.user || null,
      message: '僅在本地開發環境可用',
    });
  });
}

// 註冊路由
app.use('/auth', authRoutes);
app.use('/api', orderRoutes);

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
app.get('/dashboard', ...getAuthMiddleware(), (req, res) => {
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
  logger.info(
    `重新處理失敗訂單端點: POST http://localhost:${PORT}/api/retry-failed-orders`
  );
  logger.info(`獲取所有訂單端點: GET http://localhost:${PORT}/api/orders`);
  logger.info(`同步訂單端點: POST http://localhost:${PORT}/api/sync-orders`);
});

module.exports = app;
