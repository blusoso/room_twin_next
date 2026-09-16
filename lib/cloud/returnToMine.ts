// lib/cloud/returnToMine.ts
//
// ⭐ "กลับไปห้องของฉัน" จากโหมดดูห้องที่แชร์ — แบบ client-side
//    (เดิมใช้ window.location.assign("/") = reload ทั้งหน้าและโหลด bundle ใหม่)
//
//    ผลลัพธ์เท่ากับการเปิด "/" ใหม่: อ่านห้องของเจ้าของเครื่องจาก localStorage
//    แล้ว restore เข้า store + สร้างฉากใหม่ โดยไม่ reload หน้า
import { useRoomTwin } from "@/lib/state/store";
import { loadFromStorage } from "@/lib/state/storage";
import { restoreSerializedState } from "@/lib/state/restore";
import { getStoredActiveRoomId } from "./activeRoom";
import { clearPendingSharedRoom } from "./sharedRoomBoot";
import { serializeSnapshotOf } from "@/lib/shared/roomShare";
import { ROOM_DEFAULT, WALL_COLORS, CELL_SIZE } from "@/lib/data/constants";
import type { SerializedState } from "@/lib/state/types";

/** ห้องเปล่ามาตรฐาน — ใช้เมื่อเครื่องนี้ยังไม่เคยมีห้องของตัวเอง */
function emptySerializedState(): SerializedState {
  return {
    wall: 0,
    items: [],
    zoneMeta: [],
    surface: {
      floor: "wood",
      wallUniform: true,
      wallAll: WALL_COLORS[0],
      walls: {},
      ceiling: 0xf7f3ea,
    },
    room: {
      w: ROOM_DEFAULT.w,
      d: ROOM_DEFAULT.d,
      h: ROOM_DEFAULT.h,
      shape: ROOM_DEFAULT.shape,
      blocks: null,
      cellSize: CELL_SIZE,
      cellLevels: {},
    },
  };
}

export function returnToOwnRoom(): void {
  // ⭐ ยกเลิก boot ของลิงก์แชร์ (ถ้ากำลังโหลด/ล้มเหลวอยู่) ไม่งั้น useSaveState จะไม่เขียน localStorage
  clearPendingSharedRoom();
  useRoomTwin.getState().exitSharedRoom();

  const state = loadFromStorage() ?? emptySerializedState();

  restoreSerializedState(state);
  useRoomTwin.getState().resetHistory(serializeSnapshotOf(state));
  useRoomTwin.getState().setActiveCloudRoomId(getStoredActiveRoomId());

  // ออกจาก URL /r/<id> เพื่อไม่ให้ refresh แล้วโหลดห้องเดิมซ้ำ
  window.history.replaceState({}, "", "/");
}
