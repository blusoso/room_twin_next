// lib/three/interactionState.ts
// Shared mutable state ระหว่าง pointer hooks กับ gizmo/zone visuals

export const interactionState = {
  itemDragging: false,
  zoneDragging: false,
  hoveredZoneUid: null as string | null,
};

export function setItemDragging(v: boolean) {
  interactionState.itemDragging = v;
}

export function setZoneDragging(v: boolean) {
  interactionState.zoneDragging = v;
}

export function setHoveredZone(uid: string | null) {
  interactionState.hoveredZoneUid = uid;
}

export function isAnyDragging(): boolean {
  return interactionState.itemDragging || interactionState.zoneDragging;
}