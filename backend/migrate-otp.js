import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_PdlGnho9qKM8@ep-green-thunder-aqacigaj.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function migrate() {
  try {
    console.log('Adding email_verified to users...');
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    `;

    console.log('Creating email_otps table...');
    await sql`
      CREATE TABLE IF NOT EXISTS email_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Optionally mark existing users as verified since they already registered.
    console.log('Marking existing users as verified...');
    await sql`
      UPDATE users SET email_verified = true WHERE email_verified = false;
    `;

    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
