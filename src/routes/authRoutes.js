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
  try {
    // 清除 JWT token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // 清除其他可能的認證相關 cookie
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('session', { path: '/' });

    // 清除 session（如果有的話）
    if (req.session) {
      req.session.destroy();
    }

    // 設置 no-cache headers 防止瀏覽器快取
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    // 在本地開發環境中，設置一個特殊的登出標記
    if (process.env.NODE_ENV !== 'production') {
      res.cookie('dev_logged_out', 'true', {
        httpOnly: false, // 讓前端可以讀取
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 小時
      });
    }

    // 添加一個清除登出標記的端點（僅用於調試）
    if (process.env.NODE_ENV !== 'production') {
      res.cookie('dev_logged_out', 'false', {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 0, // 立即過期
      });
    }

    // 返回 JSON 響應
    res.json({
      success: true,
      message: '登出成功',
      redirectUrl: 'https://www.benedbiomed.com/home',
    });
  } catch (error) {
    console.error('登出時發生錯誤:', error);
    res.status(500).json({
      success: false,
      message: '登出失敗',
    });
  }
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
 * 清除登出標記（僅本地開發環境）
 */
router.get('/clear-logout', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    res.clearCookie('dev_logged_out', { path: '/' });
    res.json({
      success: true,
      message: '登出標記已清除',
      env: process.env.NODE_ENV,
    });
  } else {
    res.status(404).json({
      success: false,
      message: '此端點僅在開發環境可用',
    });
  }
});

module.exports = router;
