import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const posts = new Hono();

// ─── Helper: fetch a single post with counts ────────────────────────────────
async function fetchPost(db, postId, requestingUserId = null) {
  const rows = await db`
    SELECT p.id, p.caption, p.image_url, p.created_at, p.club_id,
           u.id AS author_id, u.username, u.avatar_url,
           COUNT(DISTINCT l.user_id)::int AS like_count,
           COUNT(DISTINCT c.id)::int AS comment_count,
           EXISTS(
             SELECT 1 FROM likes
             WHERE user_id = ${requestingUserId || '00000000-0000-0000-0000-000000000000'}
               AND post_id = p.id
           ) AS liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN likes l ON l.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id
    WHERE p.id = ${postId}
    GROUP BY p.id, u.id
  `;
  return rows[0] || null;
}

// ─── POST /api/posts ────────────────────────────────────────────────────────
posts.post('/', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const postSchema = z.object({
      caption: z.string().min(1).max(2000),
      club_id: z.string().uuid().optional().nullable(),
      tag_ids: z.array(z.string().uuid()).optional(),
    });

    const formData = await c.req.formData();
    const body = postSchema.parse({
      caption: formData.get('caption'),
      club_id: formData.get('club_id') || null,
      tag_ids: formData.get('tag_ids') ? JSON.parse(formData.get('tag_ids')) : [],
    });

    let imageUrl = null;
    const imageFile = formData.get('image');
    if (imageFile && imageFile instanceof File) {
      const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const filename = `posts/${crypto.randomUUID()}.${ext}`;
      const buffer = await imageFile.arrayBuffer();

      const { error } = await supabase.storage
        .from('campuslink')
        .upload(filename, buffer, { contentType: imageFile.type || 'image/jpeg', upsert: false });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);

      const { data } = supabase.storage.from('campuslink').getPublicUrl(filename);
      imageUrl = data.publicUrl;
    }

    const user = c.get('user');
    const postId = crypto.randomUUID();

    await db`
      INSERT INTO posts (id, user_id, caption, image_url, club_id)
      VALUES (${postId}, ${user.id}, ${body.caption}, ${imageUrl}, ${body.club_id})
    `;

    if (body.tag_ids && body.tag_ids.length > 0) {
      for (const tagId of body.tag_ids) {
        await db`
          INSERT INTO post_tags (post_id, tag_id) VALUES (${postId}, ${tagId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const post = await fetchPost(db, postId, user.id);
    return c.json(post, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Failed to create post' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/posts/:id ─────────────────────────────────────────────────────
posts.get('/:id', optionalAuth, async (c) => {
  const db = createDb(c.env);
  try {
    const userId = c.get('user')?.id || null;
    const post = await fetchPost(db, c.req.param('id'), userId);
    if (!post) return c.json({ error: 'Post not found' }, 404);
    return c.json(post);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch post' }, 500);
  } finally {
    await db.end();
  }
});

// ─── DELETE /api/posts/:id ──────────────────────────────────────────────────
posts.delete('/:id', authenticate, async (c) => {
  const db = createDb(c.env);
  try {
    const rows = await db`SELECT user_id FROM posts WHERE id = ${c.req.param('id')}`;
    if (!rows[0]) return c.json({ error: 'Post not found' }, 404);
    const user = c.get('user');
    if (rows[0].user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Not authorized' }, 403);
    }
    await db`DELETE FROM posts WHERE id = ${c.req.param('id')}`;
    return c.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to delete post' }, 500);
  } finally {
    await db.end();
  }
});

export default posts;
