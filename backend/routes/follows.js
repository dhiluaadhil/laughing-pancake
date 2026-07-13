import { Hono } from 'hono';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const follows = new Hono();

// ─── POST /api/follows/:id ──────────────────────────────────────────────────
follows.post('/:id', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const followingId = c.req.param('id');
    const followerId = c.get('user').id;

    if (followingId === followerId) {
      return c.json({ error: 'Cannot follow yourself' }, 400);
    }

    const target = await db`SELECT id, username FROM users WHERE id = ${followingId}`;
    if (!target[0]) return c.json({ error: 'User not found' }, 404);

    await db`
      INSERT INTO follows (follower_id, following_id)
      VALUES (${followerId}, ${followingId})
      ON CONFLICT DO NOTHING
    `;

    // Persist notification
    const notifId = crypto.randomUUID();
    await db`
      INSERT INTO notifications (id, recipient_id, actor_id, type)
      VALUES (${notifId}, ${followingId}, ${followerId}, 'follow_request')
    `;

    return c.json({ message: `Requested to follow ${target[0].username}` });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Follow failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── DELETE /api/follows/:id ────────────────────────────────────────────────
follows.delete('/:id', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    await db`
      DELETE FROM follows
      WHERE follower_id = ${c.get('user').id} AND following_id = ${c.req.param('id')}
    `;
    return c.json({ message: 'Unfollowed' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Unfollow failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/follows/check/:id ─────────────────────────────────────────────
follows.get('/check/:id', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT status FROM follows
      WHERE follower_id = ${c.get('user').id} AND following_id = ${c.req.param('id')}
    `;
    const status = rows.length > 0 ? rows[0].status : 'none';
    return c.json({ following: status === 'accepted', status });
  } catch (err) {
    return c.json({ error: 'Check failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/follows/accept/:followerId ───────────────────────────────────
follows.post('/accept/:followerId', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const followingId = c.get('user').id;
    const followerId = c.req.param('followerId');

    const [updated] = await db`
      UPDATE follows SET status = 'accepted'
      WHERE follower_id = ${followerId} AND following_id = ${followingId}
      RETURNING *
    `;

    if (!updated) return c.json({ error: 'Follow request not found' }, 404);

    // Persist notification to tell them they were accepted
    const notifId = crypto.randomUUID();
    await db`
      INSERT INTO notifications (id, recipient_id, actor_id, type)
      VALUES (${notifId}, ${followerId}, ${followingId}, 'follow_accepted')
    `;

    // Optionally mark the follow_request notification as read
    await db`
      UPDATE notifications SET read = TRUE
      WHERE recipient_id = ${followingId} AND actor_id = ${followerId} AND type = 'follow_request'
    `;

    return c.json({ message: 'Follow request accepted' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to accept follow' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/follows/decline/:followerId ──────────────────────────────────
follows.post('/decline/:followerId', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const followingId = c.get('user').id;
    const followerId = c.req.param('followerId');

    await db`
      DELETE FROM follows
      WHERE follower_id = ${followerId} AND following_id = ${followingId} AND status = 'pending'
    `;

    // Mark the notification as read so it goes away
    await db`
      UPDATE notifications SET read = TRUE
      WHERE recipient_id = ${followingId} AND actor_id = ${followerId} AND type = 'follow_request'
    `;

    return c.json({ message: 'Follow request declined' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to decline follow' }, 500);
  } finally {
    await db.end();
  }
});

export default follows;
