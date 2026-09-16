// lib/three/interactionState.ts
// Shared mutable state ระหว่าง pointer hooks กับ gizmo/zone visuals

export const interactionState = {
  itemDragging: false,
  zoneDragging: false,
  hoveredZoneUid: null as string | null,
  /** uid ของ item ที่กำลังถูกลากอยู่ (null = ไม่ได้ลาก) — ใช้โดยไม้บรรทัดห้องตอนตีเส้นไกด์ */
  draggingUid: null as string | null,
  /** uid ของโซนที่กำลังถูกลากอยู่ (null = ไม่ได้ลาก) — ใช้โดยไม้บรรทัดห้องตอนตีเส้นไกด์กรอบโซน */
  draggingZoneUid: null as string | null,
};

export function setItemDragging(v: boolean, uid: string | null = null) {
  interactionState.itemDragging = v;
  interactionState.draggingUid = v ? uid : null;
}

export function setZoneDragging(v: boolean, uid: string | null = null) {
  interactionState.zoneDragging = v;
  interactionState.draggingZoneUid = v ? uid : null;
}

export function setHoveredZone(uid: string | null) {
  interactionState.hoveredZoneUid = uid;
}

export function isAnyDragging(): boolean {
  return interactionState.itemDragging || interactionState.zoneDragging;
}