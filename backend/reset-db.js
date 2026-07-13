import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const sql = postgres('postgresql://neondb_owner:npg_PdlGnho9qKM8@ep-green-thunder-aqacigaj.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function resetDB() {
  try {
    console.log('Dropping public schema...');
    await sql`DROP SCHEMA IF EXISTS public CASCADE;`;
    await sql`CREATE SCHEMA public;`;
    await sql`GRANT ALL ON SCHEMA public TO public;`;

    console.log('Running schema.sql...');
    await sql.file('schema.sql');

    console.log('Database successfully reset and schema applied!');
  } catch (err) {
    console.error('Reset failed:', err);
  } finally {
    await sql.end();
  }
}

resetDB();
