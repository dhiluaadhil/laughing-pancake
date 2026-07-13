import postgres from 'postgres';


const connectionString = process.env.DATABASE_URL || process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;

if (!connectionString) {
  console.error("No database connection string found in environment variables.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function migrate() {
  try {
    console.log('Running migration to add role and is_active to users...');
    
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
    console.log('Added role column');
    
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
    console.log('Added is_active column');
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
