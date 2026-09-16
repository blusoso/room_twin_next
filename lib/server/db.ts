// lib/server/db.ts
//
// ⭐ SQLite ผ่านโมดูล built-in `node:sqlite` (Node >= 22.5) — ไม่เพิ่ม dependency
//    ไฟล์ DB อยู่ที่ data/roomtwin.db (override ได้ด้วย env ROOMTWIN_DB_PATH)
//
//    ⚠️ ใช้ได้กับ Node runtime เท่านั้น (Route Handler ต้องตั้ง runtime = "nodejs")
//    ⚠️ โมดูลนี้เป็น experimental ของ Node → อาจมี ExperimentalWarning ใน log (ไม่กระทบการทำงาน)
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  name        TEXT NOT NULL,
  data        TEXT NOT NULL,
  item_count  INTEGER NOT NULL DEFAULT 0,
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  preview     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_rooms_owner    ON rooms(owner_token, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_template ON rooms(is_template, updated_at DESC);
`;

// ⭐ เก็บ handle ไว้บน globalThis เพื่อไม่ให้ Next dev (hot reload) เปิด DB ซ้ำหลายตัว
//    __roomtwinDbMigrated = migration รอบล่าสุดของโค้ดนี้รันบน handle นั้นแล้วหรือยัง
//    (hot reload ใหม่แล้ว handle เดิมยังอยู่ → ต้อง migrate ให้ด้วย)
const globalForDb = globalThis as unknown as {
  __roomtwinDb?: DatabaseSync;
  __roomtwinDbMigrated?: boolean;
};

export function getDbPath(): string {
  return (
    process.env.ROOMTWIN_DB_PATH ||
    path.join(process.cwd(), "data", "roomtwin.db")
  );
}

/**
 * ⭐ migration สำหรับ DB ที่สร้างไว้ก่อนมีคอลัมน์ preview
 *    (CREATE TABLE IF NOT EXISTS ไม่เพิ่มคอลัมน์ให้ตารางเดิม)
 */
function migrate(db: DatabaseSync) {
  const cols = db
    .prepare("PRAGMA table_info(rooms)")
    .all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "preview")) {
    db.exec("ALTER TABLE rooms ADD COLUMN preview TEXT NOT NULL DEFAULT ''");
  }
}

export function getDb(): DatabaseSync {
  const cached = globalForDb.__roomtwinDb;
  if (cached) {
    if (!globalForDb.__roomtwinDbMigrated) {
      migrate(cached);
      globalForDb.__roomtwinDbMigrated = true;
    }
    return cached;
  }

  const file = getDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);

  globalForDb.__roomtwinDb = db;
  globalForDb.__roomtwinDbMigrated = true;
  return db;
}
