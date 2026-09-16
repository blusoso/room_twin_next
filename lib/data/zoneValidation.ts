// lib/data/zoneValidation.ts
//
// ⭐ ตรวจ uniqueness ของ "available zone definitions" (developer-facing)
//    - duplicate id / name / icon / color
//    - ตรวจว่าไอคอนของทุก def เลือกได้จริงใน ZONE_ICON_CATEGORIES
//
//    หลักการ: production ห้าม crash — log เท่านั้น
//             dev throw ให้ developer รู้ทันที (เรียกจาก useRoomTwinInit)

import { ZONE_DEFINITIONS, type ZoneDef } from "./zones";
import { ZONE_ICON_CATEGORIES } from "./icons";

export interface ZoneDefinitionIssue {
  kind: "id" | "name" | "icon" | "color";
  value: string;
  ids: string[];
}

function hexOf(color: number): string {
  return "#" + (color >>> 0).toString(16).padStart(6, "0");
}

function collectDuplicates<T>(
  defs: readonly ZoneDef[],
  key: (d: ZoneDef) => T,
): Array<{ value: T; ids: string[] }> {
  const map = new Map<T, string[]>();
  defs.forEach((d) => {
    const v = key(d);
    const list = map.get(v);
    if (list) list.push(d.id);
    else map.set(v, [d.id]);
  });
  const dupes: Array<{ value: T; ids: string[] }> = [];
  map.forEach((ids, value) => {
    if (ids.length > 1) dupes.push({ value, ids });
  });
  return dupes;
}

export function findZoneDefinitionIssues(
  defs: readonly ZoneDef[] = ZONE_DEFINITIONS,
): ZoneDefinitionIssue[] {
  const issues: ZoneDefinitionIssue[] = [];

  collectDuplicates(defs, (d) => d.id).forEach(({ value, ids }) =>
    issues.push({ kind: "id", value: String(value), ids }),
  );
  collectDuplicates(defs, (d) => d.name.trim().toLowerCase()).forEach(
    ({ value, ids }) =>
      issues.push({ kind: "name", value: String(value), ids }),
  );
  collectDuplicates(defs, (d) => d.icon).forEach(({ value, ids }) =>
    issues.push({ kind: "icon", value: String(value), ids }),
  );
  collectDuplicates(defs, (d) => d.color).forEach(({ value, ids }) =>
    issues.push({ kind: "color", value: hexOf(Number(value)), ids }),
  );

  return issues;
}

/** ไอคอนของ def ที่ไม่มีใน picker → user เลือกผ่าน UI ไม่ได้ */
export function findZoneIconPoolGaps(
  defs: readonly ZoneDef[] = ZONE_DEFINITIONS,
): string[] {
  const pool = new Set<string>();
  ZONE_ICON_CATEGORIES.forEach((cat) => {
    cat.icons.forEach((i) => pool.add(i));
  });
  return defs.filter((d) => !pool.has(d.icon)).map((d) => d.id);
}

/**
 * เรียกครั้งเดียวตอน startup (dev) — ดู call site ใน hooks/useRoomTwinInit.ts
 */
export function validateZoneDefinitions(
  defs: readonly ZoneDef[] = ZONE_DEFINITIONS,
): void {
  const gaps = findZoneIconPoolGaps(defs);
  if (gaps.length > 0) {
    console.warn(
      `[zones] ไอคอนของโซนต่อไปนี้ไม่อยู่ใน ZONE_ICON_CATEGORIES (แก้ผ่าน UI ไม่ได้): ${gaps.join(
        ", ",
      )}`,
    );
  }

  const issues = findZoneDefinitionIssues(defs);
  if (issues.length === 0) return;

  const msg =
    "[zones] ZONE_DEFINITIONS มีข้อมูลซ้ำ — " +
    issues
      .map((i) => `${i.kind} "${i.value}" (${i.ids.join(", ")})`)
      .join(" | ");

  console.error(msg);

  // dev เท่านั้น — production log แล้วไปต่อ ไม่ crash
  if (process.env.NODE_ENV !== "production") {
    throw new Error(msg);
  }
}
