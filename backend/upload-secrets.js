import { execSync } from 'child_process';
import fs from 'fs';

const vars = `
JWT_SECRET=campuslink_secret_2024_aadhil
SUPABASE_URL=https://xduqzrkfbcqexdrquddu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXF6cmtmYmNxZXhkcnF1ZGR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjA2MTEsImV4cCI6MjA5NjM5NjYxMX0.L7JixLue5_bkO1FJ7STyzfXjRMi6Nuj1PtUuKcfSqpw
ALLOWED_DOMAINS=@gmail.com
RESEND_API_KEY=re_PQdpm86p_A9AX6w6BtntK6QfHfosXapue
FROM_EMAIL=CampusLink <onboarding@resend.dev>
`;

const lines = vars.trim().split('\n');
for (const line of lines) {
  if (!line) continue;
  const [key, ...rest] = line.split('=');
  const value = rest.join('=');
  console.log(`Uploading ${key}...`);
  try {
    execSync(`npx wrangler secret put ${key}`, { input: value, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`Successfully uploaded ${key}`);
  } catch (e) {
    console.error(`Failed to upload ${key}:`, e.stderr.toString());
  }
}
