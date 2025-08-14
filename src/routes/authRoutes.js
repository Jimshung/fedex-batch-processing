// authRoutes.js - 認證相關路由
const express = require('express');
const router = express.Router();
const path = require('path');
const { passport, generateToken } = require('../middleware/auth');
const { createProtectedRoute } = require('../utils/authHelper');

/**
 * Google OAuth 登入
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * Google OAuth 回調
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // 生成 JWT token
    const token = generateToken(req.user);

    // 設置 JWT token 到 cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 小時
    });

    // 成功認證，重定向到儀表板
    res.redirect('/dashboard');
  }
);

/**
 * 登出
 */
router.get('/logout', (req, res) => {
  // 清除 JWT token cookie
  res.clearCookie('token');
  res.redirect('/');
});

/**
 * 登入失敗頁面
 */
router.get('/login-failed', (req, res) => {
  res.send(`
    <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
      <h2>❌ 登入失敗</h2>
      <p>僅限 Benedbiomed 員工使用此系統</p>
      <p>請使用 @benedbiomed.com 郵箱登入</p>
      <a href="/auth/google" style="color: #007cba;">重新登入</a>
    </div>
  `);
});

/**
 * 用戶資訊 API
 */
router.get(
  '/user',
  ...createProtectedRoute((req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.json({
        success: true,
        user: {
          email: req.user.email,
          name: req.user.name,
          avatar: req.user.avatar,
        },
      });
    } else {
      // 本地開發環境提供模擬用戶信息
      res.json({
        success: true,
        user: {
          email: 'dev@benedbiomed.com',
          name: '開發者',
          avatar: '',
        },
      });
    }
  })
);

module.exports = router;
