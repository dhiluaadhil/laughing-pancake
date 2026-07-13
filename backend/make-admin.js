import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;

if (!connectionString) {
  console.error("No database connection string found in environment variables.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function makeAdmin() {
  try {
    const result = await sql`UPDATE users SET role = 'admin' WHERE username ILIKE 'aadhil' RETURNING id, username, role`;
    console.log('Made admin:', result);
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await sql.end();
  }
}

makeAdmin();
