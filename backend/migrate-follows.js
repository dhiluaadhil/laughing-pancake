import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL || process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE);

async function migrate() {
  try {
    console.log('Adding status column to follows...');
    await sql`ALTER TABLE follows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'`;
    console.log('Setting default for future to pending...');
    await sql`ALTER TABLE follows ALTER COLUMN status SET DEFAULT 'pending'`;
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
