import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const clubs = new Hono();

// ─── GET /api/clubs ─────────────────────────────────────────────────────────
clubs.get('/', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT c.id, c.name, c.description, c.banner_url, c.created_at,
             u.username AS created_by_username,
             COUNT(DISTINCT cm.user_id)::int AS member_count
      FROM clubs c
      JOIN users u ON u.id = c.created_by
      LEFT JOIN club_members cm ON cm.club_id = c.id
      GROUP BY c.id, u.username
      ORDER BY member_count DESC
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch clubs' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/clubs ────────────────────────────────────────────────────────
clubs.post('/', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const clubSchema = z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
    });

    const contentType = c.req.header('Content-Type') || '';
    let body = {};
    let bannerUrl = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      body = { name: formData.get('name'), description: formData.get('description') };

      const bannerFile = formData.get('banner');
      if (bannerFile && bannerFile instanceof File) {
        const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
        const ext = bannerFile.name.split('.').pop() || 'jpg';
        const filename = `banners/${crypto.randomUUID()}.${ext}`;
        const buffer = await bannerFile.arrayBuffer();

        const { error } = await supabase.storage
          .from('campuslink')
          .upload(filename, buffer, { contentType: bannerFile.type || 'image/jpeg', upsert: false });
        if (error) throw new Error(`Supabase upload failed: ${error.message}`);

        const { data } = supabase.storage.from('campuslink').getPublicUrl(filename);
        bannerUrl = data.publicUrl;
      }
    } else {
      body = await c.req.json();
    }

    const parsed = clubSchema.parse(body);
    const user = c.get('user');
    const clubId = crypto.randomUUID();

    await db`
      INSERT INTO clubs (id, name, description, banner_url, created_by)
      VALUES (${clubId}, ${parsed.name}, ${parsed.description || null}, ${bannerUrl}, ${user.id})
    `;

    // Auto-join as admin
    await db`
      INSERT INTO club_members (club_id, user_id, role) VALUES (${clubId}, ${user.id}, 'admin')
    `;

    const [club] = await db`SELECT * FROM clubs WHERE id = ${clubId}`;
    return c.json(club, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Failed to create club' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/clubs/user/suggested ──────────────────────────────────────────
// IMPORTANT: Must be defined BEFORE /:id to avoid route conflict
clubs.get('/user/suggested', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT c.id, c.name, c.description, c.banner_url,
             COUNT(DISTINCT cm.user_id)::int AS member_count
      FROM clubs c
      LEFT JOIN club_members cm ON cm.club_id = c.id
      WHERE c.id NOT IN (
        SELECT club_id FROM club_members WHERE user_id = ${c.get('user').id}
      )
      GROUP BY c.id
      ORDER BY member_count DESC
      LIMIT 5
    `;
    return c.json(rows);
  } catch (err) {
    return c.json({ error: 'Failed to fetch suggested clubs' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/clubs/:id ─────────────────────────────────────────────────────
clubs.get('/:id', async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`
      SELECT c.id, c.name, c.description, c.banner_url, c.created_at,
             u.username AS created_by_username,
             COUNT(DISTINCT cm.user_id)::int AS member_count
      FROM clubs c
      JOIN users u ON u.id = c.created_by
      LEFT JOIN club_members cm ON cm.club_id = c.id
      WHERE c.id = ${c.req.param('id')}
      GROUP BY c.id, u.username
    `;
    if (!rows[0]) return c.json({ error: 'Club not found' }, 404);

    const posts = await db`
      SELECT p.id, p.caption, p.image_url, p.created_at,
             u.id AS author_id, u.username, u.avatar_url,
             COUNT(DISTINCT l.user_id)::int AS like_count,
             COUNT(DISTINCT cm2.id)::int AS comment_count
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments cm2 ON cm2.post_id = p.id
      WHERE p.club_id = ${c.req.param('id')}
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    return c.json({ club: rows[0], posts });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch club' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/clubs/:id/join ───────────────────────────────────────────────
clubs.post('/:id/join', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const club = await db`SELECT id FROM clubs WHERE id = ${c.req.param('id')}`;
    if (!club[0]) return c.json({ error: 'Club not found' }, 404);

    await db`
      INSERT INTO club_members (club_id, user_id, role)
      VALUES (${c.req.param('id')}, ${c.get('user').id}, 'member')
      ON CONFLICT DO NOTHING
    `;
    return c.json({ message: 'Joined club' });
  } catch (err) {
    return c.json({ error: 'Failed to join club' }, 500);
  } finally {
    await db.end();
  }
});

// ─── DELETE /api/clubs/:id/leave ────────────────────────────────────────────
clubs.delete('/:id/leave', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    await db`
      DELETE FROM club_members
      WHERE club_id = ${c.req.param('id')} AND user_id = ${c.get('user').id}
    `;
    return c.json({ message: 'Left club' });
  } catch (err) {
    return c.json({ error: 'Failed to leave club' }, 500);
  } finally {
    await db.end();
  }
});

export default clubs;
