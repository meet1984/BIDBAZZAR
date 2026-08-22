import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export class SettingsRepository {
  async getSetting(key: string, fallback: string): Promise<string> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1",
        [key],
      );
      if (rows[0] && typeof rows[0].setting_value === "string") {
        return rows[0].setting_value;
      }
      return fallback;
    } catch {
      // Fallback if table doesn't exist yet in unmigrated dev environment
      return fallback;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value],
    );
  }
}

export const settingsRepository = new SettingsRepository();
