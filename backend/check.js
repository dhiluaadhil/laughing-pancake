import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_PdlGnho9qKM8@ep-green-thunder-aqacigaj.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  const users = await sql`SELECT id, email, role, password_hash FROM users;`;
  console.log(users);
  await sql.end();
}

check();
