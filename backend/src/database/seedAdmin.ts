import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { pool } from "./pool.js";

async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required to seed an admin.",
    );
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await pool.execute(
    `INSERT INTO accounts
      (account_type, full_name, email, password_hash, status, accepted_terms_at)
     VALUES ('admin', ?, ?, ?, 'active', UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       password_hash = VALUES(password_hash),
       account_type = 'admin',
       status = 'active'`,
    [env.ADMIN_NAME.trim(), env.ADMIN_EMAIL.trim().toLowerCase(), passwordHash],
  );
  console.log(`Admin account is ready for ${env.ADMIN_EMAIL.toLowerCase()}.`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
