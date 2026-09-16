// lib/server/rooms.ts
//
// ⭐ Repository ของ "ห้องที่บันทึกบนเซิร์ฟเวอร์" — ใช้เฉพาะฝั่ง server (Node runtime)
import { getDb } from "./db";
import type { SerializedState } from "@/lib/state/types";
import {
  MAX_DATA_BYTES,
  MAX_ITEMS,
  isStorablePreview,
  newShareId,
  normalizeRoomName,
  type CloudRoomSummary,
} from "@/lib/shared/roomShare";

export interface RoomRow {
  id: string;
  owner_token: string;
  name: string;
  data: string;
  item_count: number;
  is_template: number;
  created_at: number;
  updated_at: number;
  preview: string;
}

export interface ValidRoomInput {
  name: string;
  data: SerializedState;
  isTemplate: boolean;
  /** ⭐ data URL ของภาพ preview — "" เมื่อไม่มี/ใช้ไม่ได้ */
  preview: string;
}

export type ValidateResult =
  | { ok: true; value: ValidRoomInput }
  | { ok: false; error: string };

// ============================================================
// Validation
// ============================================================

/**
 * ตรวจ payload ของห้องก่อนเขียนลง DB
 * เช็คโครงสร้างหยาบ ๆ พอ (schema จริงเป็นของ client) + เพดานขนาด/จำนวนชิ้น
 *
 * ⭐ preview ไม่ทำให้ request ล้ม — ถ้าใหญ่เกินหรือไม่ใช่ data URL ของรูป
 *    จะถอยไปใช้ `fallbackPreview` (ปกติคือ "" หรือค่าที่มีอยู่เดิมใน DB)
 */
export function validateRoomInput(
  body: unknown,
  fallbackPreview = "",
): ValidateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "ข้อมูลห้องไม่ถูกต้อง" };
  }

  const b = body as Record<string, unknown>;
  const data = b.data as SerializedState | undefined;

  if (!data || typeof data !== "object") {
    return { ok: false, error: "ไม่พบข้อมูลห้อง (data)" };
  }
  if (!data.room || typeof data.room !== "object") {
    return { ok: false, error: "ข้อมูลห้องไม่ครบ (room)" };
  }
  if (!Array.isArray(data.items)) {
    return { ok: false, error: "ข้อมูลห้องไม่ครบ (items)" };
  }
  if (!data.surface || typeof data.surface !== "object") {
    return { ok: false, error: "ข้อมูลห้องไม่ครบ (surface)" };
  }
  if (data.items.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `ของในห้องเยอะเกินไป (สูงสุด ${MAX_ITEMS} ชิ้น)`,
    };
  }

  let json: string;
  try {
    json = JSON.stringify(data);
  } catch {
    return { ok: false, error: "ข้อมูลห้องไม่ถูกต้อง (JSON)" };
  }
  if (Buffer.byteLength(json, "utf8") > MAX_DATA_BYTES) {
    return { ok: false, error: "ข้อมูลห้องใหญ่เกินไป" };
  }

  return {
    ok: true,
    value: {
      name: normalizeRoomName(b.name),
      data,
      isTemplate: b.isTemplate === true,
      preview: isStorablePreview(b.preview) ? b.preview : fallbackPreview,
    },
  };
}

// ============================================================
// Row helpers
// ============================================================

function toSummary(row: RoomRow): CloudRoomSummary {
  return {
    id: row.id,
    name: row.name,
    isTemplate: row.is_template === 1,
    updatedAt: row.updated_at,
    itemCount: row.item_count,
    preview: row.preview ?? "",
  };
}

const SUMMARY_COLS =
  "id, name, item_count, is_template, updated_at, preview";

// ============================================================
// Queries
// ============================================================

export function createRoom(
  ownerToken: string,
  input: ValidRoomInput,
): CloudRoomSummary {
  const db = getDb();
  const now = Date.now();
  const id = newShareId();

  db.prepare(
    `INSERT INTO rooms
       (id, owner_token, name, data, item_count, is_template, created_at, updated_at, preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    ownerToken,
    input.name,
    JSON.stringify(input.data),
    input.data.items.length,
    input.isTemplate ? 1 : 0,
    now,
    now,
    input.preview,
  );

  return {
    id,
    name: input.name,
    isTemplate: input.isTemplate,
    updatedAt: now,
    itemCount: input.data.items.length,
    preview: input.preview,
  };
}

export function listOwnedRooms(ownerToken: string): CloudRoomSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${SUMMARY_COLS} FROM rooms
        WHERE owner_token = ?
        ORDER BY updated_at DESC`,
    )
    .all(ownerToken) as unknown as RoomRow[];
  return rows.map(toSummary);
}

export function listTemplateRooms(): CloudRoomSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${SUMMARY_COLS} FROM rooms
        WHERE is_template = 1
        ORDER BY updated_at DESC`,
    )
    .all() as unknown as RoomRow[];
  return rows.map(toSummary);
}

export function getRoomRow(id: string): RoomRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM rooms WHERE id = ?")
    .get(id) as unknown as RoomRow | undefined;
  return row ?? null;
}

export function updateRoom(
  id: string,
  ownerToken: string,
  patch: Partial<ValidRoomInput>,
): { ok: true; summary: CloudRoomSummary } | { ok: false; status: 403 | 404 } {
  const db = getDb();
  const row = getRoomRow(id);
  if (!row) return { ok: false, status: 404 };
  if (row.owner_token !== ownerToken) return { ok: false, status: 403 };

  const now = Date.now();
  const name = patch.name ?? row.name;
  const data = patch.data ?? null;
  const json = data ? JSON.stringify(data) : row.data;
  const itemCount = data ? data.items.length : row.item_count;
  const isTemplate =
    patch.isTemplate === undefined
      ? row.is_template
      : patch.isTemplate
        ? 1
        : 0;
  // ⭐ patch.preview undefined = คงค่าเดิม, "" = ลบภาพทิ้ง
  const preview = patch.preview === undefined ? row.preview : patch.preview;

  db.prepare(
    `UPDATE rooms
        SET name = ?, data = ?, item_count = ?, is_template = ?, updated_at = ?, preview = ?
      WHERE id = ?`,
  ).run(
    name,
    json,
    itemCount,
    isTemplate,
    now,
    preview,
    id,
  );

  return {
    ok: true,
    summary: {
      id,
      name,
      isTemplate: isTemplate === 1,
      updatedAt: now,
      itemCount,
      preview,
    },
  };
}

export function deleteRoom(
  id: string,
  ownerToken: string,
): { ok: true } | { ok: false; status: 403 | 404 } {
  const db = getDb();
  const row = getRoomRow(id);
  if (!row) return { ok: false, status: 404 };
  if (row.owner_token !== ownerToken) return { ok: false, status: 403 };

  db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  return { ok: true };
}
