import { Hono } from 'hono';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const likes = new Hono();

// ─── POST /api/likes/:postId ────────────────────────────────────────────────
likes.post('/:postId', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const postId = c.req.param('postId');
    const user = c.get('user');

    const postRes = await db`SELECT user_id FROM posts WHERE id = ${postId}`;
    if (!postRes[0]) return c.json({ error: 'Post not found' }, 404);
    const postOwnerId = postRes[0].user_id;

    await db`
      INSERT INTO likes (user_id, post_id) VALUES (${user.id}, ${postId})
      ON CONFLICT DO NOTHING
    `;

    // Notify post owner (not self)
    if (postOwnerId !== user.id) {
      const notifId = crypto.randomUUID();
      await db`
        INSERT INTO notifications (id, recipient_id, actor_id, type, post_id)
        VALUES (${notifId}, ${postOwnerId}, ${user.id}, 'like', ${postId})
      `;
    }

    const [countRow] = await db`
      SELECT COUNT(*)::int AS like_count FROM likes WHERE post_id = ${postId}
    `;
    return c.json({ liked: true, like_count: countRow.like_count });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to like post' }, 500);
  } finally {
    await db.end();
  }
});

// ─── DELETE /api/likes/:postId ──────────────────────────────────────────────
likes.delete('/:postId', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const postId = c.req.param('postId');
    await db`
      DELETE FROM likes WHERE user_id = ${c.get('user').id} AND post_id = ${postId}
    `;
    const [countRow] = await db`
      SELECT COUNT(*)::int AS like_count FROM likes WHERE post_id = ${postId}
    `;
    return c.json({ liked: false, like_count: countRow.like_count });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to unlike post' }, 500);
  } finally {
    await db.end();
  }
});

export default likes;
