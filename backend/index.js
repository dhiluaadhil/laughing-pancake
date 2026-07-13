import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes          from './routes/auth.js';
import userRoutes          from './routes/users.js';
import postRoutes          from './routes/posts.js';
import feedRoutes          from './routes/feed.js';
import followRoutes        from './routes/follows.js';
import likeRoutes          from './routes/likes.js';
import commentRoutes       from './routes/comments.js';
import searchRoutes        from './routes/search.js';
import clubRoutes          from './routes/clubs.js';
import notificationRoutes  from './routes/notifications.js';
import adminRoutes         from './routes/admin.js';

const app = new Hono();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use('*', logger());
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CLIENT_URL || '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route('/api/auth',          authRoutes);
app.route('/api/users',         userRoutes);
app.route('/api/posts',         postRoutes);
app.route('/api/feed',          feedRoutes);
app.route('/api/follows',       followRoutes);
app.route('/api/likes',         likeRoutes);
app.route('/api/comments',      commentRoutes);
app.route('/api/search',        searchRoutes);
app.route('/api/clubs',         clubRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/admin',         adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ─── Error Handler ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
