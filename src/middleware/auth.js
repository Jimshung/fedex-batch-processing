// auth.js - 認證中間件
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';
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
        // 檢查是否為 Benedbiomed 員工
        const email = profile.emails[0].value;
        if (!email.endsWith('@benedbiomed.com')) {
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
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
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
  // 本地開發環境跳過認證
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const token = extractToken(req);
  
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

  if (!req.user || !req.user.email || !req.user.email.endsWith('@benedbiomed.com')) {
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
