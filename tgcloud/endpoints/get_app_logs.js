import { db } from 'sdk';
import { sql } from 'sdk/db';

export default async function (input, ctx) {
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`);

    const limit = parseInt(input?.limit, 10) || 20;
    const logs = await db.all(sql`SELECT * FROM app_logs ORDER BY id DESC LIMIT ${limit}`);
    return { success: true, count: logs.length, logs };
  } catch (err) {
    return { success: false, error: err?.message };
  }
}
