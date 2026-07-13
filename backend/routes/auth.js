import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signToken } from '../lib/jwt.js';
import { sendEmail, generateOTP, getOTPEmailTemplate } from '../lib/email.js';

const auth = new Hono();

// ─── Allowed email domains ──────────────────────────────────────────────────
const isValidCollegeEmail = (email, env) => {
  const domains = (env.ALLOWED_DOMAINS || '@gmail.com').split(',').map(d => d.trim());
  return domains.some(domain => email.endsWith(domain));
};

// ─── Schemas ────────────────────────────────────────────────────────────────
const otpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  purpose: z.string()
});

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  college: z.string().min(2).max(120),
  interests: z.array(z.string().uuid()).min(3, 'Select at least 3 interests'),
  bio: z.string().max(300).optional(),
  otp: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

// ─── POST /api/auth/send-otp ────────────────────────────────────────────────
auth.post('/send-otp', async (c) => {
  const db = createDb(c.env);
  try {
    const { email, purpose = 'register' } = await c.req.json();
    if (!email) return c.json({ error: 'Email is required' }, 400);

    if (!isValidCollegeEmail(email, c.env)) {
      return c.json({ error: 'Only allowed domains (e.g. @gmail.com) can register right now.' }, 400);
    }

    console.log('Generating OTP...');
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('Sending email via Resend...');
    const emailRes = await sendEmail({
      to: email,
      subject: purpose === 'register' ? 'CampusLink Verification Code' : 'CampusLink Password Reset',
      html: getOTPEmailTemplate(otpCode, purpose),
      env: c.env
    });
    console.log('Email send result:', emailRes);

    if (!emailRes.success) {
      return c.json({ error: 'This Gmail address could not be verified. Please enter a valid Gmail address.' }, 400);
    }

    console.log('Inserting into database...');
    await db`
      INSERT INTO email_otps (email, otp_code, purpose, expires_at)
      VALUES (${email}, ${otpCode}, ${purpose}, ${expiresAt})
    `;
    console.log('Database insert complete.');

    return c.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to send OTP' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/auth/verify-otp ──────────────────────────────────────────────
auth.post('/verify-otp', async (c) => {
  const db = createDb(c.env);
  try {
    const { email, otp, purpose } = otpVerifySchema.parse(await c.req.json());

    const otps = await db`
      SELECT * FROM email_otps 
      WHERE email = ${email} 
        AND otp_code = ${otp} 
        AND purpose = ${purpose}
        AND used = FALSE 
        AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;

    if (otps.length === 0) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    return c.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Verification failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/auth/register ────────────────────────────────────────────────
auth.post('/register', async (c) => {
  const db = createDb(c.env);
  try {
    const body = registerSchema.parse(await c.req.json());

    if (!isValidCollegeEmail(body.email, c.env)) {
      return c.json({ error: 'Only allowed domains (e.g. @gmail.com) are allowed' }, 400);
    }

    // Verify OTP
    const otps = await db`
      SELECT * FROM email_otps 
      WHERE email = ${body.email} 
        AND otp_code = ${body.otp} 
        AND purpose = 'register'
        AND used = FALSE 
        AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;

    if (otps.length === 0) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    // Check uniqueness
    const existing = await db`
      SELECT id FROM users WHERE email = ${body.email} OR username = ${body.username}
    `;
    if (existing.length > 0) {
      return c.json({ error: 'Email or username already in use' }, 409);
    }

    // Mark OTP used
    await db`UPDATE email_otps SET used = TRUE WHERE id = ${otps[0].id}`;

    // Hash password + generate UUID
    const password_hash = await hashPassword(body.password);
    const userId = crypto.randomUUID();
    const role = body.email.toLowerCase() === 'naaadhil0509@gmail.com' ? 'admin' : 'user';

    // Insert user
    const [user] = await db`
      INSERT INTO users (id, username, email, password_hash, bio, college, email_verified, role)
      VALUES (${userId}, ${body.username}, ${body.email}, ${password_hash}, ${body.bio || null}, ${body.college}, TRUE, ${role})
      RETURNING id, username, email, bio, college, avatar_url, created_at, role, is_active, email_verified
    `;

    // Validate tag IDs exist
    const validTags = await db`
      SELECT id FROM tags WHERE id = ANY(${body.interests}::uuid[])
    `;
    if (validTags.length !== body.interests.length) {
      return c.json({ error: 'One or more interest tags are invalid' }, 400);
    }

    // Insert interests
    for (const tagId of body.interests) {
      await db`
        INSERT INTO user_interests (user_id, tag_id)
        VALUES (${userId}, ${tagId})
        ON CONFLICT DO NOTHING
      `;
    }

    const token = await signToken(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      c.env.JWT_SECRET
    );

    return c.json({ user, token }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Registration failed: ' + err.message }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────
auth.post('/login', async (c) => {
  const db = createDb(c.env);
  try {
    const { email, password } = loginSchema.parse(await c.req.json());

    const rows = await db`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length === 0) return c.json({ error: 'Invalid credentials' }, 401);
    const user = rows[0];

    if (!user.is_active) {
      return c.json({ error: 'Your account has been deactivated. Contact support.' }, 403);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      if (user.password_hash.startsWith('$2')) {
        return c.json({ error: 'Your account uses an old password format. Please reset your password.' }, 401);
      }
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await signToken(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      c.env.JWT_SECRET
    );

    const { password_hash, ...safeUser } = user;
    return c.json({ user: safeUser, token });
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Login failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
auth.post('/forgot-password', async (c) => {
  const db = createDb(c.env);
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: 'Email is required' }, 400);

    const users = await db`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return c.json({ success: true, message: 'If the email exists, an OTP has been sent.' });
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const emailRes = await sendEmail({
      to: email,
      subject: 'CampusLink Password Reset',
      html: getOTPEmailTemplate(otpCode, 'reset'),
      env: c.env
    });

    if (!emailRes.success) {
      return c.json({ error: 'Failed to send OTP email.' }, 500);
    }

    await db`
      INSERT INTO email_otps (email, otp_code, purpose, expires_at)
      VALUES (${email}, ${otpCode}, 'reset', ${expiresAt})
    `;

    return c.json({ success: true, message: 'If the email exists, an OTP has been sent.' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Forgot password failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
auth.post('/reset-password', async (c) => {
  const db = createDb(c.env);
  try {
    const { email, otp, newPassword } = resetPasswordSchema.parse(await c.req.json());

    const otps = await db`
      SELECT * FROM email_otps 
      WHERE email = ${email} 
        AND otp_code = ${otp} 
        AND purpose = 'reset'
        AND used = FALSE 
        AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;

    if (otps.length === 0) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    const password_hash = await hashPassword(newPassword);

    const users = await db`
      UPDATE users SET password_hash = ${password_hash}
      WHERE email = ${email}
      RETURNING id
    `;

    if (users.length === 0) {
       return c.json({ error: 'User not found' }, 404);
    }

    await db`UPDATE email_otps SET used = TRUE WHERE id = ${otps[0].id}`;

    return c.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return c.json({ error: err.errors }, 400);
    console.error(err);
    return c.json({ error: 'Password reset failed' }, 500);
  } finally {
    await db.end();
  }
});

// ─── GET /api/auth/tags ─────────────────────────────────────────────────────
auth.get('/tags', async (c) => {
  const db = createDb(c.env);
  try {
    const tags = await db`SELECT id, name FROM tags ORDER BY name`;
    return c.json(tags);
  } catch (err) {
    return c.json({ error: 'Failed to fetch tags' }, 500);
  } finally {
    await db.end();
  }
});

export default auth;
