/**
 * Set a known password for all users (for local/testing only).
 * Run: npx tsx server/db/setDemoPasswords.ts
 * Then log in with any seeded user email and password: password123
 */
import { config } from "dotenv";
config();

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcrypt";

const DEMO_PASSWORD = "password123";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function setDemoPasswords() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await sql`
    UPDATE users SET password_hash = ${hash} WHERE is_active = 'true'
  `;
  console.log(`✅ All active users can now log in with password: ${DEMO_PASSWORD}`);
  process.exit(0);
}

setDemoPasswords().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
