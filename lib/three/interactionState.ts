// lib/three/interactionState.ts
// Shared mutable state ระหว่าง pointer hooks กับ gizmo
// ใช้เพื่อบอก gizmo ว่า item/zone กำลังถูก drag อยู่หรือไม่

export const interactionState = {
  itemDragging: false,
  zoneDragging: false,
};

export function setItemDragging(v: boolean) {
  interactionState.itemDragging = v;
}

export function setZoneDragging(v: boolean) {
  interactionState.zoneDragging = v;
}

export function isAnyDragging(): boolean {
  return interactionState.itemDragging || interactionState.zoneDragging;
}