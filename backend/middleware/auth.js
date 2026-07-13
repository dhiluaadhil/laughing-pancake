import { verifyToken } from '../lib/jwt.js';

/**
 * Hono middleware: verify JWT from Authorization header.
 * Sets c.set('user', { id, email, username }) on success.
 */
export async function authenticate(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verifyToken(token, c.env.JWT_SECRET);
      c.set('user', { id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role });
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Helper: optionally extract user from JWT (no error if missing/invalid).
 * Used for public endpoints that show liked-status when logged in.
 */
export async function optionalAuth(c, next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await verifyToken(authHeader.split(' ')[1], c.env.JWT_SECRET);
        c.set('user', { id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role });
    } catch { /* ignore */ }
  }
  await next();
}

/**
 * Middleware: ensure the authenticated user is an admin.
 * Must be used AFTER authenticate.
 */
export async function requireAdmin(c, next) {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admins only' }, 403);
  }
  await next();
}
