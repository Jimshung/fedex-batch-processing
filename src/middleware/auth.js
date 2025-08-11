// auth.js - Google OAuth 認證中間件
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const logger = require('../utils/logger');

// 配置 Google OAuth 策略
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // 使用相對路徑，讓 Cloud Run 自動處理網域
      callbackURL: '/auth/google/callback',
      // 【關鍵修改】信任反向代理
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 檢查 email domain
        const email = profile.emails[0].value;

        if (!email.endsWith('@benedbiomed.com')) {
          logger.warn(`未授權的登入嘗試: ${email}`);
          return done(null, false, { message: '僅限 Benedbiomed 員工使用' });
        }

        const user = {
          id: profile.id,
          email: email,
          name: profile.displayName,
          avatar: profile.photos[0]?.value,
          accessToken: accessToken,
        };

        logger.info(`用戶登入成功: ${email}`);
        return done(null, user);
      } catch (error) {
        logger.error(`OAuth 認證錯誤: ${error.message}`);
        return done(error, null);
      }
    }
  )
);

// 序列化用戶
passport.serializeUser((user, done) => {
  done(null, user);
});

// 反序列化用戶
passport.deserializeUser((user, done) => {
  done(null, user);
});

// 檢查是否已認證的中間件
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  // 如果是 API 請求，返回 JSON 錯誤
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      error: '未授權',
      message: '請先登入',
      loginUrl: '/auth/google',
    });
  }

  // 否則重定向到登入頁面
  res.redirect('/auth/google');
}

// 檢查 Benedbiomed email domain 的中間件
function requireBenedbiomed(req, res, next) {
  if (!req.user || !req.user.email.endsWith('@benedbiomed.com')) {
    logger.warn(`未授權訪問嘗試: ${req.user?.email || 'unknown'}`);

    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        error: '權限不足',
        message: '此系統僅供 Benedbiomed 員工使用',
        contact: 'jimwu@benedbiomed.com',
      });
    }

    return res.status(403).send(`
      <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
        <h2>❌ 權限不足</h2>
        <p>此系統僅供 Benedbiomed 員工使用</p>
        <p>請使用 @benedbiomed.com 郵箱登入</p>
        <p>如有疑問，請聯繫 <a href="mailto:jimwu@benedbiomed.com">jimwu@benedbiomed.com</a></p>
        <a href="/auth/logout" style="color: #007cba;">重新登入</a>
      </div>
    `);
  }

  next();
}

module.exports = {
  passport,
  requireAuth,
  requireBenedbiomed,
};
