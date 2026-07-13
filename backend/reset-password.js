import postgres from 'postgres';
import { hashPassword } from './lib/crypto.js';

const connectionString = process.env.DATABASE_URL || process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
const sql = postgres(connectionString);

async function run() {
  try {
    const newPassword = 'password123';
    const hash = await hashPassword(newPassword);
    
    await sql`UPDATE users SET password_hash = ${hash} WHERE username = 'Aadhil'`;
    console.log(`Password for Aadhil successfully reset to: ${newPassword}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

run();
