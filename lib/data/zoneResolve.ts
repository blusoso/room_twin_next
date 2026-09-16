// lib/data/zoneResolve.ts
//
// ⭐ Single resolver ของข้อมูลที่ "แสดง" ของ Zone (name / emoji / color)
//    ทุก UI และ 3D ต้องอ่านผ่านไฟล์นี้เท่านั้น — ห้าม hardcode metadata ซ้ำที่อื่น
//
//    Precedence (ชัดเจน):
//      1) user override ใน zoneMeta  — เฉพาะฟิลด์ที่ user แก้จริงใน ZoneEditModal
//      2) ZoneDef ของ zoneDefId ที่ resolve ได้ (lib/data/zones.ts)
//      3) ZONE_FALLBACK              — โซนที่ไม่มี zoneDefId (ข้อมูลเก่า / ย้ายโซน)
//
//    หมายเหตุ: zone เป็น concept ที่ derive จาก items (ไม่มี record ของตัวเอง)
//    ดังนั้นตัวเชื่อม instance → definition คือ PlacedItem.zoneDefId

import { useRoomTwin } from "@/lib/state/store";
import { ZONE_BY_ID, ZONE_FALLBACK, type ZoneDef } from "./zones";
import type { PlacedItem, ZoneMeta } from "@/lib/state/types";

export interface ZoneDisplay {
  /** id ของ ZoneDef ที่ใช้เป็นฐาน (null = ไม่มี → ใช้ ZONE_FALLBACK) */
  defId: string | null;
  name: string;
  icon: string;
  color: number;
  /** ฟิลด์ใดเป็น user override (ไม่ใช่ค่าจาก definition) */
  isOverride: { name: boolean; icon: boolean; color: boolean };
}

type PlacedItems = readonly PlacedItem[];

/** slice ของ state ที่ resolver ต้องใช้ — ส่งเข้ามาได้เมื่อ component subscribe อยู่แล้ว */
export interface ZoneStateSlice {
  placedItems: PlacedItems;
  zoneMeta: Map<string, ZoneMeta>;
}

// ============================================================
// Resolve
// ============================================================

/** defId ของโซน — อ่านจาก item ตัวแรกในโซนที่มี zoneDefId */
export function getZoneDefIdForZone(
  zuid: string,
  placedItems?: PlacedItems,
): string | null {
  const items = placedItems ?? useRoomTwin.getState().placedItems;
  for (const it of items) {
    if (it.zoneUid === zuid && it.zoneDefId) return it.zoneDefId;
  }
  return null;
}

export function getZoneDefForZone(
  zuid: string,
  placedItems?: PlacedItems,
): ZoneDef | null {
  const defId = getZoneDefIdForZone(zuid, placedItems);
  return defId ? ZONE_BY_ID.get(defId) ?? null : null;
}

/**
 * ค่าที่ต้องแสดงของโซน — ใช้ร่วมกันทั้ง UI และ 3D
 * @param slice ส่ง state ที่ component subscribe อยู่แล้ว (ถ้าไม่ส่ง จะอ่านจาก store ตรง ๆ)
 */
export function resolveZoneDisplay(
  zuid: string,
  slice?: ZoneStateSlice,
): ZoneDisplay {
  const s = slice ?? useRoomTwin.getState();
  const meta: ZoneMeta = s.zoneMeta.get(zuid) || {};
  const def = getZoneDefForZone(zuid, s.placedItems);

  const nameOverride = (meta.name ?? "").trim();
  const iconOverride = (meta.icon ?? "").trim();
  const colorOverride = meta.color;

  return {
    defId: def?.id ?? null,
    name: nameOverride || def?.name || ZONE_FALLBACK.name,
    icon: iconOverride || def?.icon || ZONE_FALLBACK.icon,
    color:
      colorOverride !== undefined
        ? colorOverride
        : def
          ? def.color
          : ZONE_FALLBACK.color,
    isOverride: {
      name: !!nameOverride,
      icon: !!iconOverride,
      color: colorOverride !== undefined,
    },
  };
}

// ============================================================
// Uniqueness (runtime — user action)
// ============================================================

export function collectZoneUids(placedItems?: PlacedItems): string[] {
  const items = placedItems ?? useRoomTwin.getState().placedItems;
  const seen = new Set<string>();
  items.forEach((i) => {
    if (i.zoneUid) seen.add(i.zoneUid);
  });
  return Array.from(seen);
}

function normName(n: string): string {
  return n.trim().toLowerCase();
}

/**
 * ⭐ ชื่อโซนห้ามซ้ำ — เทียบกับชื่อที่ "resolve แล้ว" (definition หรือ override)
 * ไม่ใช่ zoneMeta.name ดิบ (ซึ่งว่างเปล่าสำหรับโซนที่ยังไม่ถูกแก้)
 */
export function isZoneNameTaken(
  name: string,
  excludeZuid: string | null,
): boolean {
  const norm = normName(name);
  if (!norm) return false;
  return collectZoneUids().some(
    (z) => z !== excludeZuid && normName(resolveZoneDisplay(z).name) === norm,
  );
}

/**
 * ⭐ ไอคอนห้ามซ้ำ — ยกเว้นโซนที่มาจาก ZoneDef เดียวกัน (โซนชนิดเดียวกันใช้ไอคอนร่วมกันได้)
 */
export function isZoneIconTaken(
  icon: string,
  excludeZuid: string | null,
): boolean {
  const value = (icon ?? "").trim();
  if (!value) return false;
  const selfDefId = excludeZuid ? getZoneDefIdForZone(excludeZuid) : null;
  return collectZoneUids().some((z) => {
    if (z === excludeZuid) return false;
    if (selfDefId && getZoneDefIdForZone(z) === selfDefId) return false;
    return resolveZoneDisplay(z).icon === value;
  });
}

/**
 * ⭐ สีห้ามซ้ำ — ยกเว้นโซนที่มาจาก ZoneDef เดียวกัน (เหตุผลเดียวกับ isZoneIconTaken)
 */
export function isZoneColorTaken(
  color: number,
  excludeZuid: string | null,
): boolean {
  const selfDefId = excludeZuid ? getZoneDefIdForZone(excludeZuid) : null;
  return collectZoneUids().some((z) => {
    if (z === excludeZuid) return false;
    if (selfDefId && getZoneDefIdForZone(z) === selfDefId) return false;
    return resolveZoneDisplay(z).color === color;
  });
}

/**
 * ⭐ ตรวจ uniqueness ของ name / icon / color ของโซน — ใช้ร่วมกันทั้ง ZoneEditModal
 *    และ ZoneAddModal (ข้อความ error ต้องมาจากที่เดียว)
 *    - name: ห้ามซ้ำกับโซนใด ๆ (เทียบชื่อที่ resolve แล้ว)
 *    - icon/color: ห้ามซ้ำกับโซนชนิดอื่น (โซนที่มาจาก ZoneDef เดียวกันใช้ค่าร่วมกันได้)
 * @param opts.live true = ตรวจแบบ live (ชื่อว่างยังไม่ถือเป็น error)
 */
export function validateZoneIdentity(
  draft: { name: string; icon: string; color: number },
  excludeZuid: string | null,
  opts?: { live?: boolean },
): string {
  const name = draft.name.trim();
  const live = !!opts?.live;

  if (!name) return live ? "" : "กรุณากรอกชื่อโซน";
  if (isZoneNameTaken(name, excludeZuid)) {
    return `ชื่อ "${name}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่ออื่น`;
  }
  if (isZoneIconTaken(draft.icon, excludeZuid)) {
    return `ไอคอน ${draft.icon} ถูกใช้ในโซนอื่นแล้ว — กรุณาเลือกไอคอนอื่น`;
  }
  if (isZoneColorTaken(draft.color, excludeZuid)) {
    return "สีนี้ถูกใช้ในโซนอื่นแล้ว — กรุณาเลือกสีอื่น";
  }
  return "";
}

/**
 * ⭐ หาชื่อที่ไม่ซ้ำให้โซนใหม่ — "โซนนอน", "โซนนอน 2", "โซนนอน 3" ...
 */
export function pickUniqueZoneName(
  baseName: string,
  excludeZuid: string | null,
): string {
  const base = baseName.trim() || ZONE_FALLBACK.name;
  if (!isZoneNameTaken(base, excludeZuid)) return base;
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base} ${n}`;
    if (!isZoneNameTaken(candidate, excludeZuid)) return candidate;
  }
  return base;
}
