// auth.js - 認證中間件
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT 配置
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';
const JWT_EXPIRES_IN = '24h';

// 初始化 Passport
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 檢查是否為 Benedbiomed 員工或特定開發者
        const email = profile.emails[0].value;
        const allowedEmails = ['jim40513@gmail.com'];

        if (
          !email.endsWith('@benedbiomed.com') &&
          !allowedEmails.includes(email)
        ) {
          return done(null, false, { message: '僅限 Benedbiomed 員工使用' });
        }

        // 創建用戶對象（不包含敏感信息）
        const user = {
          id: profile.id,
          email: email,
          name: profile.displayName,
          avatar: profile.photos[0]?.value || '',
        };

        return done(null, user);
      } catch (error) {
        logger.error(`Google OAuth 錯誤: ${error.message}`);
        return done(error);
      }
    }
  )
);

// 序列化用戶（簡化，只存必要信息）
passport.serializeUser((user, done) => {
  done(null, { id: user.id, email: user.email, name: user.name });
});

// 反序列化用戶
passport.deserializeUser((user, done) => {
  done(null, user);
});

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 驗證 JWT Token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 從請求中提取 JWT Token
function extractToken(req) {
  // 優先從 Authorization header 提取
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return req.headers.authorization.substring(7);
  }

  // 從 cookie 提取
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

// 認證中間件
function requireAuth(req, res, next) {
  const token = extractToken(req);

  // 本地開發環境：檢查是否已登出
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 認證檢查 - Cookies:', req.cookies);
    console.log('🔍 認證檢查 - Token:', token ? '存在' : '不存在');
    console.log('🔍 認證檢查 - dev_logged_out:', req.cookies?.dev_logged_out);

    // 檢查是否已登出（優先檢查）
    if (req.cookies && req.cookies.dev_logged_out === 'true') {
      console.log('🚫 檢測到登出標記，拒絕訪問');
      return res.status(401).json({
        success: false,
        error: '已登出',
        message: '您已登出，請重新登入',
        loginUrl: '/auth/google',
      });
    }

    // 調試：顯示所有 cookies
    console.log('🔍 所有 Cookies:', JSON.stringify(req.cookies, null, 2));

    // 如果沒有 token，提供模擬用戶
    if (!token) {
      console.log('👤 本地開發環境：使用模擬用戶');
      req.user = {
        id: 'dev-user',
        email: 'dev@benedbiomed.com',
        name: '開發者',
      };
      return next();
    }

    // 如果有 token，驗證它
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('❌ Token 無效，清除並使用模擬用戶');
      // 清除無效的 token
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      req.user = {
        id: 'dev-user',
        email: 'dev@benedbiomed.com',
        name: '開發者',
      };
      return next();
    }

    console.log('✅ Token 有效，使用解碼的用戶信息');
    req.user = decoded;
    return next();
  }

  // 生產環境的認證邏輯
  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未授權',
      message: '請先登入',
      loginUrl: '/auth/google',
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Token 無效',
      message: '登入已過期，請重新登入',
      loginUrl: '/auth/google',
    });
  }

  req.user = decoded;
  next();
}

// Benedbiomed 員工檢查
function requireBenedbiomed(req, res, next) {
  // 本地開發環境跳過檢查
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const allowedEmails = ['jim40513@gmail.com'];

  if (
    !req.user ||
    !req.user.email ||
    (!req.user.email.endsWith('@benedbiomed.com') &&
      !allowedEmails.includes(req.user.email))
  ) {
    return res.status(403).json({
      success: false,
      error: '權限不足',
      message: '僅限 Benedbiomed 員工使用此系統',
    });
  }
  next();
}

module.exports = {
  passport,
  requireAuth,
  requireBenedbiomed,
  generateToken,
  verifyToken,
};
