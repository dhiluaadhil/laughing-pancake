/**
 * supabase.js — LEGACY FILE (no longer imported by the Workers backend)
 *
 * Supabase Storage uploads are now handled inline in each route that needs them
 * (routes/posts.js, routes/users.js, routes/clubs.js) using:
 *   import { createClient } from '@supabase/supabase-js';
 *   const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
 *
 * This file is kept only as reference and can be deleted safely.
 */
