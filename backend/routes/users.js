import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const users = new Hono();

// ─── GET /api/users/:id ─────────────────────────────────────────────────────
users.get('/:id', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT u.id, u.username, u.email, u.avatar_url, u.bio, u.college, u.created_at,
             COUNT(DISTINCT f1.follower_id)::int AS follower_count,
             COUNT(DISTINCT f2.following_id)::int AS following_count,
             COUNT(DISTINCT p.id)::int AS post_count
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id AND f1.status = 'accepted'
      LEFT JOIN follows f2 ON f2.follower_id = u.id AND f2.status = 'accepted'
      LEFT JOIN posts p ON p.user_id = u.id
      WHERE ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.req.param('id')) ? db`u.id = ${c.req.param('id')} OR ` : db``} u.username = ${c.req.param('id')}
      GROUP BY u.id
    `;
    if (!rows[0]) return c.json({ error: 'User not found' }, 404);
    return c.json(rows[0]);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch user' }, 500);
  } finally {
    await db.end();
  }
});

// ─── PUT /api/users/me ──────────────────────────────────────────────────────
users.put('/me', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const updateSchema = z.object({
      bio: z.string().max(300).optional(),
      college: z.string().max(120).optional(),
    });

    // Handle multipart (avatar upload) or JSON
    const contentType = c.req.header('Content-Type') || '';
    let body = {};
    let avatarUrl;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      body = Object.fromEntries(
        [...formData.entries()].filter(([k]) => k !== 'avatar')
      );

      const avatarFile = formData.get('avatar');
      if (avatarFile && avatarFile instanceof File) {
        const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const filename = `avatars/${crypto.randomUUID()}.${ext}`;
        const buffer = await avatarFile.arrayBuffer();

        const { error } = await supabase.storage
          .from('campuslink')
          .upload(filename, buffer, { contentType: avatarFile.type || 'image/jpeg', upsert: false });
        if (error) throw new Error(`Supabase upload failed: ${error.message}`);

        const { data } = supabase.storage.from('campuslink').getPublicUrl(filename);
        avatarUrl = data.publicUrl;
      }
    } else {
      body = await c.req.json();
    }

    const parsed = updateSchema.parse(body);
    const user = c.get('user');

    const fields = [];
    const values = [];

    if (parsed.bio !== undefined)     { fields.push('bio');        values.push(parsed.bio); }
    if (parsed.college !== undefined) { fields.push('college');    values.push(parsed.college); }
    if (avatarUrl)                    { fields.push('avatar_url'); values.push(avatarUrl); }

    if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

    // Build dynamic SET clause safely
    const setClauses = fields.map((f, i) => db`${db(f)} = ${values[i]}`);
    const [updated] = await db`
      UPDATE users SET ${setClauses.reduce((acc, s) => db`${acc}, ${s}`)}
      WHERE id = ${user.id}
      RETURNING id, username, email, avatar_url, bio, college
    `;
    return c.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Failed to update profile' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/users/:id/followers ──────────────────────────────────────────
users.get('/:id/followers', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT u.id, u.username, u.avatar_url, u.bio
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${c.req.param('id')} AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch followers' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/users/:id/following ──────────────────────────────────────────
users.get('/:id/following', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT u.id, u.username, u.avatar_url, u.bio
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ${c.req.param('id')} AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch following' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/users/:id/posts ───────────────────────────────────────────────
users.get('/:id/posts', async (c) => {
  const db = createDb(c.env);
  try {
    const limit = 20;
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const rows = await db`
      SELECT p.id, p.caption, p.image_url, p.created_at,
             u.id AS author_id, u.username, u.avatar_url,
             COUNT(DISTINCT l.user_id)::int AS like_count,
             COUNT(DISTINCT cm.id)::int AS comment_count
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments cm ON cm.post_id = p.id
      WHERE ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.req.param('id')) ? db`u.id = ${c.req.param('id')} OR ` : db``} u.username = ${c.req.param('id')}
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch user posts' }, 500);
  } finally {
    await db.end();
  }
});

export default users;
