import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { verifyToken } from '../lib/jwt.js';

const notifications = new Hono();

// ─── GET /api/notifications ─────────────────────────────────────────────────
notifications.get('/', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT n.id, n.type, n.post_id, n.read, n.created_at,
             u.id AS actor_id, u.username AS actor_username, u.avatar_url AS actor_avatar
      FROM notifications n
      JOIN users u ON u.id = n.actor_id
      WHERE n.recipient_id = ${c.get('user').id}
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    const unreadCount = rows.filter(n => !n.read).length;
    return c.json({ notifications: rows, unread_count: unreadCount });
  } catch (err) {
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  } finally {
    await db.end();
  }
});

// ─── PATCH /api/notifications/read-all ─────────────────────────────────────
notifications.patch('/read-all', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    await db`
      UPDATE notifications SET read = true
      WHERE recipient_id = ${c.get('user').id} AND read = false
    `;
    return c.json({ message: 'All notifications marked as read' });
  } catch (err) {
    return c.json({ error: 'Failed to mark notifications read' }, 500);
  } finally {
    await db.end();
  }
});

// ─── PATCH /api/notifications/:id/read ─────────────────────────────────────
notifications.patch('/:id/read', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    await db`
      UPDATE notifications SET read = true
      WHERE id = ${c.req.param('id')} AND recipient_id = ${c.get('user').id}
    `;
    return c.json({ message: 'Notification marked as read' });
  } catch (err) {
    return c.json({ error: 'Failed to mark notification read' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/notifications/stream ──────────────────────────────────────────
// Server-Sent Events — replaces Socket.io for real-time notifications.
// Frontend connects via EventSource, receives new notifications as they arrive.
//
// Auth: JWT via ?token= query param (EventSource cannot set headers).
// Poll strategy: checks DB every 5s for new unread notifications since last check.
notifications.get('/stream', async (c) => {
  // EventSource cannot set Authorization header — use query param token
  const token = c.req.query('token');
  if (!token) return c.json({ error: 'No token provided' }, 401);

  let user;
  try {
    user = await verifyToken(token, c.env.JWT_SECRET);
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }

  return streamSSE(c, async (stream) => {
    const db = createDb(c.env);
    let lastChecked = new Date().toISOString();

    // Send heartbeat immediately so the connection doesn't time out
    await stream.writeSSE({ event: 'connected', data: JSON.stringify({ userId: user.id }) });

    try {
      while (true) {
        await stream.sleep(5000); // poll every 5 seconds

        const newNotifs = await db`
          SELECT n.id, n.type, n.post_id, n.read, n.created_at,
                 u.id AS actor_id, u.username AS actor_username, u.avatar_url AS actor_avatar
          FROM notifications n
          JOIN users u ON u.id = n.actor_id
          WHERE n.recipient_id = ${user.id}
            AND n.created_at > ${lastChecked}
          ORDER BY n.created_at ASC
        `;

        if (newNotifs.length > 0) {
          lastChecked = newNotifs[newNotifs.length - 1].created_at;
          for (const notif of newNotifs) {
            await stream.writeSSE({
              event: 'notification',
              data: JSON.stringify(notif),
              id: notif.id,
            });
          }
        } else {
          // Heartbeat to keep connection alive
          await stream.writeSSE({ event: 'heartbeat', data: '' });
        }
      }
    } catch {
      // Stream closed by client — clean up
    } finally {
      await db.end();
    }
  });
});

export default notifications;
