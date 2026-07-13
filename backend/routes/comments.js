import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const comments = new Hono();

// ─── POST /api/comments/:postId ─────────────────────────────────────────────
comments.post('/:postId', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const { body: bodyText } = z.object({ body: z.string().min(1).max(1000) }).parse(await c.req.json());
    const postId = c.req.param('postId');
    const user = c.get('user');

    const postRes = await db`SELECT user_id FROM posts WHERE id = ${postId}`;
    if (!postRes[0]) return c.json({ error: 'Post not found' }, 404);
    const postOwnerId = postRes[0].user_id;

    const commentId = crypto.randomUUID();
    const [comment] = await db`
      INSERT INTO comments (id, user_id, post_id, body)
      VALUES (${commentId}, ${user.id}, ${postId}, ${bodyText})
      RETURNING id, body, created_at
    `;

    // Notify post owner
    if (postOwnerId !== user.id) {
      const notifId = crypto.randomUUID();
      await db`
        INSERT INTO notifications (id, recipient_id, actor_id, type, post_id)
        VALUES (${notifId}, ${postOwnerId}, ${user.id}, 'comment', ${postId})
      `;
    }

    return c.json({ ...comment, author_id: user.id, username: user.username }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Failed to add comment' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/comments/:postId ──────────────────────────────────────────────
comments.get('/:postId', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT c.id, c.body, c.created_at,
             u.id AS author_id, u.username, u.avatar_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ${c.req.param('postId')}
      ORDER BY c.created_at ASC
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch comments' }, 500);
  } finally {
    await db.end();
  }
});

// ─── DELETE /api/comments/:id ───────────────────────────────────────────────
comments.delete('/:id', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`SELECT user_id FROM comments WHERE id = ${c.req.param('id')}`;
    if (!rows[0]) return c.json({ error: 'Comment not found' }, 404);
    if (rows[0].user_id !== c.get('user').id) return c.json({ error: 'Not authorized' }, 403);
    await db`DELETE FROM comments WHERE id = ${c.req.param('id')}`;
    return c.json({ message: 'Comment deleted' });
  } catch (err) {
    return c.json({ error: 'Failed to delete comment' }, 500);
  } finally {
    await db.end();
  }
});

export default comments;
