import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  const users = await sql`SELECT username FROM users`;
  console.log(users);
  await sql.end();
}
run();
