import { Hono } from 'hono';
import { createDb } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { z } from 'zod';

const admin = new Hono();

// All routes in this file require admin privileges
admin.use('*', authenticate, requireAdmin);

// ─── GET /api/admin/stats ───────────────────────────────────────────────────
admin.get('/stats', async (c) => {
  const db = createDb(c.env);
  try {
    const [[{ total_users }], [{ active_users }], [{ total_posts }]] = await Promise.all([
      db`SELECT COUNT(*)::int AS total_users FROM users`,
      db`SELECT COUNT(*)::int AS active_users FROM users WHERE is_active = true`,
      db`SELECT COUNT(*)::int AS total_posts FROM posts`
    ]);

    return c.json({ total_users, active_users, total_posts });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch admin stats' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/admin/users ───────────────────────────────────────────────────
admin.get('/users', async (c) => {
  const db = createDb(c.env);
  try {
    // Basic unpaginated list for now
    const users = await db`
      SELECT id, username, email, role, is_active, created_at, avatar_url, college 
      FROM users 
      ORDER BY created_at DESC
    `;
    return c.json(users);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch users' }, 500);
  } finally {
    await db.end();
  }
});

// ─── PATCH /api/admin/users/:id/status ──────────────────────────────────────
const statusSchema = z.object({
  is_active: z.boolean()
});

admin.patch('/users/:id/status', async (c) => {
  const db = createDb(c.env);
  try {
    const body = statusSchema.parse(await c.req.json());
    const userId = c.req.param('id');
    
    // Prevent self-deactivation
    if (userId === c.get('user').id) {
      return c.json({ error: 'Cannot deactivate your own admin account' }, 400);
    }

    const [user] = await db`
      UPDATE users 
      SET is_active = ${body.is_active} 
      WHERE id = ${userId}
      RETURNING id, username, is_active
    `;

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ message: 'User status updated', user });
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Failed to update user status' }, 500);
  } finally {
    await db.end();
  }
});

export default admin;
