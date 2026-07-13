import { Hono } from 'hono';
import { createDb } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const feed = new Hono();

// ─── GET /api/feed/latest ───────────────────────────────────────────────────
// Cursor-based pagination: pass ?cursor=<created_at ISO> for next page
feed.get('/latest', optionalAuth, async (c) => {
  const db = createDb(c.env);
  try {
    const limit = 20;
    const cursor = c.req.query('cursor') || null;
    const userId = c.get('user')?.id || '00000000-0000-0000-0000-000000000000';

    let rows;
    if (cursor) {
      rows = await db`
        SELECT p.id, p.caption, p.image_url, p.created_at, p.club_id,
               u.id AS author_id, u.username, u.avatar_url,
               COUNT(DISTINCT l.user_id)::int AS like_count,
               COUNT(DISTINCT cm.id)::int AS comment_count,
               EXISTS(SELECT 1 FROM likes WHERE user_id = ${userId} AND post_id = p.id) AS liked
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN likes l ON l.post_id = p.id
        LEFT JOIN comments cm ON cm.post_id = p.id
        WHERE p.created_at < ${cursor}
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await db`
        SELECT p.id, p.caption, p.image_url, p.created_at, p.club_id,
               u.id AS author_id, u.username, u.avatar_url,
               COUNT(DISTINCT l.user_id)::int AS like_count,
               COUNT(DISTINCT cm.id)::int AS comment_count,
               EXISTS(SELECT 1 FROM likes WHERE user_id = ${userId} AND post_id = p.id) AS liked
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN likes l ON l.post_id = p.id
        LEFT JOIN comments cm ON cm.post_id = p.id
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `;
    }

    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null;
    return c.json({ posts: rows, nextCursor });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch latest feed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/feed/foryou ───────────────────────────────────────────────────
// Scoring: (tag_match * 3) + (is_followed * 2) + recency_score
feed.get('/foryou', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const limit = 20;
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const userId = c.get('user').id;

    const rows = await db`
      WITH user_tag_ids AS (
        SELECT tag_id FROM user_interests WHERE user_id = ${userId}
      ),
      followed_ids AS (
        SELECT following_id FROM follows WHERE follower_id = ${userId}
      ),
      scored_posts AS (
        SELECT
          p.id, p.caption, p.image_url, p.created_at, p.club_id,
          u.id AS author_id, u.username, u.avatar_url,
          COUNT(DISTINCT l.user_id)::int AS like_count,
          COUNT(DISTINCT cm.id)::int AS comment_count,
          EXISTS(SELECT 1 FROM likes WHERE user_id = ${userId} AND post_id = p.id) AS liked,
          (SELECT COUNT(*) FROM post_tags pt
           WHERE pt.post_id = p.id AND pt.tag_id IN (SELECT tag_id FROM user_tag_ids))::float * 3 AS tag_score,
          CASE WHEN p.user_id IN (SELECT following_id FROM followed_ids) THEN 2 ELSE 0 END AS follow_score,
          1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0) AS recency_score
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN likes l ON l.post_id = p.id
        LEFT JOIN comments cm ON cm.post_id = p.id
        WHERE p.user_id != ${userId}
        GROUP BY p.id, u.id
      )
      SELECT *, (tag_score + follow_score + recency_score) AS total_score
      FROM scored_posts
      ORDER BY total_score DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const hasMore = rows.length === limit;
    return c.json({ posts: rows, hasMore, nextOffset: offset + limit });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch for-you feed' }, 500);
  } finally {
    await db.end();
  }
});

export default feed;
