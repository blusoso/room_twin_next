// lib/three/ruler.ts
// ⭐ โหมด 📏 ไม้บรรทัดห้อง (คอนเซปต์แบบ ruler + guide ใน Photoshop)
//
//    - ไม้บรรทัดวางบนพื้นห้องตามขอบ 2 ด้าน (หลัง + ซ้าย) + ไม้บรรทัดความสูงที่มุม
//    - ตอน "ลาก object" จะตีเส้นไกด์ 2 เส้น ไปยังผนังที่ใกล้ที่สุดต่อแกน พร้อมระยะเป็น ซม.
//    - ตอน "ลากย้ายโซน" จะตีเส้นไกด์จากกรอบโซน (bbox) พร้อมป้ายขนาดโซนเป็น ม.
//
//    เป็น view-only ล้วน ๆ — ไม่แตะ state ที่ persist (ไม่เข้า serialize/history)
import * as THREE from "three";
import { floorGroup, isInitialized } from "./scene";
import { findFloorYAt } from "./roomShell";
import { footprintOf } from "./placement";
import { getZoneBounds } from "./zoneBounds";
import { interactionState } from "./interactionState";
import { useRoomTwin } from "@/lib/state/store";
import { cmStr } from "@/lib/utils/format";

// ============================================================
// ค่าคงที่ของไม้บรรทัด
// ============================================================

/** ระยะที่วางไม้บรรทัดออกไปนอกขอบห้อง (เมตร) */
const RULER_GAP = 0.08;
/** ความยาวขีดเล็ก (ทุก 10 ซม.) */
const TICK_MINOR = 0.02;
/** ความยาวขีดใหญ่ (ทุก 50 ซม.) */
const TICK_MAJOR = 0.05;
/** ระยะขีดระยะ 10 ซม. */
const STEP_MINOR = 0.1;
/** ขีดใหญ่ทุก 50 ซม. */
const STEP_MAJOR = 0.5;
/** ตัวเลขไม้บรรทัดพื้นทุก 1 ม. */
const STEP_LABEL = 1.0;
/** ตัวเลขไม้บรรทัดความสูงทุก 50 ซม. */
const STEP_LABEL_Y = 0.5;
/** ระยะ label ออกจากเส้นฐาน */
const LABEL_GAP = 0.05;
/** ความหนืดกันค่าคลาดเคลื่อนทศนิยม */
const EPS = 1e-6;

export type RulerAxis = "x" | "z" | "y";

export interface RulerSegment {
  id: string;
  group: RulerAxis;
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** ขีดใหญ่ (ทุก 50 ซม.) — ใช้แยกสไตล์ */
  major: boolean;
}

export interface RulerLabel {
  id: string;
  group: RulerAxis;
  pos: THREE.Vector3;
  text: string;
  major: boolean;
}

export interface GuideLine {
  id: string;
  a: THREE.Vector3;
  b: THREE.Vector3;
  label: string;
  /** จุดกึ่งกลาง footprint บนพื้น (สำหรับวาดป้ายระยะ) */
  labelPos: THREE.Vector3;
}

export interface RulerRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  /** Y ของระนาบพื้นจริง (เผื่อพื้นยก) */
  floorY: number;
}

/** ป้ายข้อความลอยกลางพื้นที่ (ใช้โชว์ขนาดโซนตอนลากย้ายโซน) */
export interface RulerBadge {
  id: string;
  pos: THREE.Vector3;
  text: string;
}

export interface RulerModel {
  rect: RulerRect | null;
  baselines: RulerSegment[];
  ticks: RulerSegment[];
  labels: RulerLabel[];
  guides: GuideLine[];
  badges: RulerBadge[];
  marker: THREE.Vector3 | null;
}

// ============================================================
// Helpers
// ============================================================

/** ตัวเลขบนไม้บรรทัด: 0 → "0", ลงตัวเมตร → "1 ม.", ที่เหลือ → เลข ซม. */
function meterLabel(v: number) {
  const cm = Math.round(v * 100);
  if (cm === 0) return "0";
  if (cm % 100 === 0) return cm / 100 + " ม.";
  return String(cm);
}

function isMultiple(v: number, step: number) {
  return Math.abs(v / step - Math.round(v / step)) < EPS;
}

/**
 * สร้างขีด + ตัวเลขตามแนวเส้นฐานหนึ่งเส้น
 * @param along ทิศทางของเส้นฐาน (หน่วย, ในระนาบ XZ)
 * @param into  ทิศทางที่ขีดชี้ (เข้าหาห้อง)
 */
function addFloorScale(
  group: RulerAxis,
  startX: number,
  startZ: number,
  alongX: number,
  alongZ: number,
  intoX: number,
  intoZ: number,
  length: number,
  offX: number,
  offZ: number,
  y: number,
  ticks: RulerSegment[],
  labels: RulerLabel[],
) {
  const n = Math.floor(length / STEP_MINOR + EPS);
  for (let k = 0; k <= n; k++) {
    const v = k * STEP_MINOR;
    if (v > length + EPS) break;

    const bx = startX + alongX * v;
    const bz = startZ + alongZ * v;
    const major = isMultiple(v, STEP_MAJOR);
    const len = major ? TICK_MAJOR : TICK_MINOR;

    ticks.push({
      id: `${group}t${k}`,
      group,
      major,
      a: new THREE.Vector3(bx, y, bz),
      b: new THREE.Vector3(bx + intoX * len, y, bz + intoZ * len),
    });

    if (isMultiple(v, STEP_LABEL)) {
      const m = Math.round(v / STEP_LABEL);
      labels.push({
        id: `${group}l${m}`,
        group,
        text: meterLabel(v),
        major: true,
        pos: new THREE.Vector3(bx + offX, y, bz + offZ),
      });
    }
  }
}

const EMPTY: RulerModel = {
  rect: null,
  baselines: [],
  ticks: [],
  labels: [],
  guides: [],
  badges: [],
  marker: null,
};

// ============================================================
// Public API
// ============================================================

/**
 * คำนวณโมเดลไม้บรรทัด ณ ขณะนั้น
 * ⭐ เรียกซ้ำได้เรื่อย ๆ (overlay เรียกทุก ~100ms) — อ่าน store/scene สดทุกครั้ง
 */
export function computeRuler(): RulerModel {
  if (!isInitialized()) return EMPTY;

  const floorBox = new THREE.Box3().setFromObject(floorGroup);
  if (floorBox.isEmpty() || !isFinite(floorBox.min.x)) return EMPTY;

  const room = useRoomTwin.getState().room;

  const minX = floorBox.min.x;
  const maxX = floorBox.max.x;
  const minZ = floorBox.min.z;
  const maxZ = floorBox.max.z;

  // ⭐ ระนาบพื้น: ใช้ค่าสูงสุดของมุมทั้ง 4 (แบบเดียวกับ getZoneBounds) กันไม้บรรทัดจมใต้สแลบยก
  const floorY = Math.max(
    findFloorYAt(minX, minZ),
    findFloorYAt(maxX, minZ),
    findFloorYAt(minX, maxZ),
    findFloorYAt(maxX, maxZ),
  );
  const y = floorY + 0.01;

  const rect: RulerRect = { minX, maxX, minZ, maxZ, h: room.h, floorY };

  const baselines: RulerSegment[] = [];
  const ticks: RulerSegment[] = [];
  const labels: RulerLabel[] = [];

  const backZ = minZ - RULER_GAP;
  const leftX = minX - RULER_GAP;

  // ===== ไม้บรรทัดแกน X (กว้าง) — วางที่ขอบหลัง =====
  baselines.push({
    id: "base-x",
    group: "x",
    major: true,
    a: new THREE.Vector3(minX, y, backZ),
    b: new THREE.Vector3(maxX, y, backZ),
  });
  addFloorScale(
    "x",
    minX,
    backZ,
    1,
    0, // ไล่ตาม +X
    0,
    1, // ขีดชี้เข้าห้อง (+Z)
    maxX - minX,
    0,
    -LABEL_GAP, // label อยู่นอกห้อง
    y,
    ticks,
    labels,
  );

  // ===== ไม้บรรทัดแกน Z (ลึก) — วางที่ขอบซ้าย =====
  baselines.push({
    id: "base-z",
    group: "z",
    major: true,
    a: new THREE.Vector3(leftX, y, minZ),
    b: new THREE.Vector3(leftX, y, maxZ),
  });
  addFloorScale(
    "z",
    leftX,
    minZ,
    0,
    1, // ไล่ตาม +Z
    1,
    0, // ขีดชี้เข้าห้อง (+X)
    maxZ - minZ,
    -LABEL_GAP,
    0,
    y,
    ticks,
    labels,
  );

  // ===== ไม้บรรทัดความสูง — ตั้งที่มุมหลังซ้าย =====
  const vertX = minX - RULER_GAP - 0.06;
  baselines.push({
    id: "base-y",
    group: "y",
    major: true,
    a: new THREE.Vector3(vertX, 0, backZ),
    b: new THREE.Vector3(vertX, room.h, backZ),
  });
  {
    const n = Math.floor(room.h / STEP_MINOR + EPS);
    for (let k = 0; k <= n; k++) {
      const v = k * STEP_MINOR;
      if (v > room.h + EPS) break;

      const major = isMultiple(v, STEP_MAJOR);
      const len = major ? TICK_MAJOR : TICK_MINOR;

      ticks.push({
        id: `yt${k}`,
        group: "y",
        major,
        a: new THREE.Vector3(vertX, v, backZ),
        b: new THREE.Vector3(vertX + len, v, backZ),
      });

      if (isMultiple(v, STEP_LABEL_Y) && v > EPS) {
        const m = Math.round(v / STEP_LABEL_Y);
        labels.push({
          id: `yl${m}`,
          group: "y",
          text: meterLabel(v),
          major: true,
          pos: new THREE.Vector3(vertX - LABEL_GAP, v, backZ),
        });
      }
    }
  }

  // ===== เส้นไกด์ตอนลาก object / ลากโซน =====
  const guides: GuideLine[] = [];
  const badges: RulerBadge[] = [];
  let marker: THREE.Vector3 | null = null;

  /** ⭐ ป้ายระยะวางกึ่งกลางเส้นไกด์ (บนระนาบพื้น) — ไม่ทับตัวเลขบนไม้บรรทัด */
  const addGuide = (
    id: string,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    label: string,
  ) => {
    guides.push({
      id,
      a: new THREE.Vector3(ax, y, az),
      b: new THREE.Vector3(bx, y, bz),
      label,
      labelPos: new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2),
    });
  };

  /**
   * ⭐ ไกด์ 2 เส้น (แกนละเส้น) จากขอบพื้นที่ที่วัด → ผนังที่ใกล้ที่สุดต่อแกน
   *    area = footprint ของ item หรือ bbox ของโซน
   *    throughX/throughZ = แนวที่เส้นไกด์ตีผ่าน (กลางพื้นที่ที่วัด)
   */
  const addWallGuides = (
    prefix: string,
    eMinX: number,
    eMaxX: number,
    eMinZ: number,
    eMaxZ: number,
    throughX: number,
    throughZ: number,
  ) => {
    // แกน X: เลือกผนังซ้าย/ขวา ที่ใกล้กว่า
    const gapLeft = eMinX - minX;
    const gapRight = maxX - eMaxX;
    if (gapLeft <= gapRight) {
      addGuide(
        `${prefix}-x`,
        eMinX,
        throughZ,
        eMinX,
        backZ,
        `ซ้าย ${cmStr(Math.max(0, gapLeft))}`,
      );
    } else {
      addGuide(
        `${prefix}-x`,
        eMaxX,
        throughZ,
        eMaxX,
        backZ,
        `ขวา ${cmStr(Math.max(0, gapRight))}`,
      );
    }

    // แกน Z: เลือกผนังหลัง/หน้า ที่ใกล้กว่า
    const gapBack = eMinZ - minZ;
    const gapFront = maxZ - eMaxZ;
    if (gapBack <= gapFront) {
      addGuide(
        `${prefix}-z`,
        throughX,
        eMinZ,
        leftX,
        eMinZ,
        `หลัง ${cmStr(Math.max(0, gapBack))}`,
      );
    } else {
      addGuide(
        `${prefix}-z`,
        throughX,
        eMaxZ,
        leftX,
        eMaxZ,
        `หน้า ${cmStr(Math.max(0, gapFront))}`,
      );
    }
  };

  /** ขนาดเป็นเมตร ทศนิยมไม่เกิน 2 ตำแหน่ง */
  const m2 = (v: number) => Math.round(v * 100) / 100 + " ม.";

  const zoneUid = interactionState.zoneDragging
    ? interactionState.draggingZoneUid
    : null;

  if (zoneUid) {
    // ===== ลากย้ายโซน → วัดกรอบโซน (bbox) ทั้งชุด =====
    // ⭐ pad = 0 เพื่อให้ตัวเลขระยะ/ขนาดตรงกับกรอบ dashed ที่วาดอยู่จริง
    const b = getZoneBounds(zoneUid, 0);

    if (b) {
      addWallGuides("zone-guide", b.minX, b.maxX, b.minZ, b.maxZ, b.cx, b.cz);
      marker = new THREE.Vector3(b.cx, y, b.cz);
      badges.push({
        id: "zone-size",
        pos: new THREE.Vector3(b.cx, y, b.cz),
        text: `${m2(b.maxX - b.minX)} × ${m2(b.maxZ - b.minZ)}`,
      });
    }
  } else {
    const uid = interactionState.itemDragging
      ? interactionState.draggingUid
      : null;

    if (uid) {
      const item = useRoomTwin
        .getState()
        .placedItems.find((i) => i.uid === uid);

      if (item && item.x !== undefined && item.z !== undefined) {
        const fp = footprintOf(item.params, item.rotY || 0);
        const eMinX = item.x - fp.w / 2;
        const eMaxX = item.x + fp.w / 2;
        const eMinZ = item.z - fp.d / 2;
        const eMaxZ = item.z + fp.d / 2;

        addWallGuides("guide", eMinX, eMaxX, eMinZ, eMaxZ, item.x, item.z);
        marker = new THREE.Vector3(item.x, y, item.z);
      }
    }
  }

  return { rect, baselines, ticks, labels, guides, badges, marker };
}
