import { Hono } from 'hono';
import { createDb } from '../db.js';

const search = new Hono();

// ─── GET /api/search?q= ─────────────────────────────────────────────────────
// Searches users (by username) and posts (by caption) in parallel using GIN indexes
search.get('/', async (c) => {
  const db = createDb(c.env);
  try {
    const q = c.req.query('q');
    if (!q || q.trim().length === 0) {
      return c.json({ users: [], posts: [] });
    }

    const searchTerm = q.trim();
    const likeTerm = `%${searchTerm}%`;
    const tsQuery = searchTerm.split(' ').filter(Boolean).join(' & ');

    const [usersResult, postsResult] = await Promise.all([
      db`
        SELECT u.id, u.username, u.avatar_url, u.bio, u.college,
               COUNT(DISTINCT f.follower_id)::int AS follower_count
        FROM users u
        LEFT JOIN follows f ON f.following_id = u.id
        WHERE to_tsvector('english', u.username) @@ to_tsquery('english', ${tsQuery})
           OR u.username ILIKE ${likeTerm}
        GROUP BY u.id
        LIMIT 20
      `,
      db`
        SELECT p.id, p.caption, p.image_url, p.created_at,
               u.id AS author_id, u.username, u.avatar_url,
               COUNT(DISTINCT l.user_id)::int AS like_count,
               COUNT(DISTINCT cm.id)::int AS comment_count
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN likes l ON l.post_id = p.id
        LEFT JOIN comments cm ON cm.post_id = p.id
        WHERE to_tsvector('english', p.caption) @@ to_tsquery('english', ${tsQuery})
           OR p.caption ILIKE ${likeTerm}
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT 20
      `,
    ]);

    return c.json({ users: usersResult, posts: postsResult });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Search failed' }, 500);
  } finally {
    await db.end();
  }
});

export default search;
