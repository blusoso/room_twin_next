// lib/three/zoneBounds.ts
import * as THREE from "three";
import { zoneBoundaryGroup } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { footprintOf } from "./placement";
import { interactionState, isAnyDragging } from "./interactionState";

export function getZoneMetaLocal(zuid: string) {
  const { zoneMeta, placedItems } = useRoomTwin.getState();
  const ov = zoneMeta.get(zuid) || {};
  const any = placedItems.find((i) => i.zoneUid === zuid);
  return {
    name: ov.name || "โซน",
    icon: ov.icon || "📦",
    color: ov.color !== undefined ? ov.color : 0xb8752e,
  };
}

export function getZoneBounds(zuid: string) {
  const { placedItems } = useRoomTwin.getState();
  const items = placedItems.filter(
    (i) => i.zoneUid === zuid && !i.wallMount && !i.ceilingMount,
  );
  if (items.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  items.forEach((it) => {
    const fp = footprintOf(it.params, it.rotY || 0);
    minX = Math.min(minX, it.x! - fp.w / 2);
    maxX = Math.max(maxX, it.x! + fp.w / 2);
    minZ = Math.min(minZ, it.z! - fp.d / 2);
    maxZ = Math.max(maxZ, it.z! + fp.d / 2);
  });

  const pad = 0.15;
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minZ: minZ - pad,
    maxZ: maxZ + pad,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
  };
}

// ============================================================
// ⭐ Boundary Styles
// ============================================================

type BoundaryMode = "selected" | "item-in-zone" | "hover";

interface BoundaryStyle {
  fillOpacity: number;
  borderOpacity: number;
  dashSize: number;
  gapSize: number;
}

const BOUNDARY_STYLES: Record<BoundaryMode, BoundaryStyle> = {
  selected: {
    fillOpacity: 0.14,
    borderOpacity: 1.0,
    dashSize: 0.13,
    gapSize: 0.09,
  },
  "item-in-zone": {
    fillOpacity: 0.06,
    borderOpacity: 0.55,
    dashSize: 0.13,
    gapSize: 0.09,
  },
  hover: {
    // ⭐ dotted — ต่างจาก selected ชัดเจน
    fillOpacity: 0.10,
    borderOpacity: 0.95,
    dashSize: 0.06,
    gapSize: 0.10,
  },
};

// ============================================================
// Build Zone Boundary (with hover support)
// ============================================================

export function buildZoneBoundary() {
  // Clear existing
  while (zoneBoundaryGroup.children.length) {
    const c = zoneBoundaryGroup.children[0];
    zoneBoundaryGroup.remove(c);
    if ((c as any).geometry) (c as any).geometry.dispose();
    if ((c as any).material) (c as any).material.dispose();
  }

  const { selectedZoneUid, selectedUid, placedItems } = useRoomTwin.getState();

  // ⭐ List ของ zone ที่ต้องวาด
  const zonesToDraw: Array<{ zuid: string; mode: BoundaryMode }> = [];

  // Priority 1: selected zone
  if (selectedZoneUid) {
    zonesToDraw.push({ zuid: selectedZoneUid, mode: "selected" });
  } else if (selectedUid) {
    // Priority 2: zone ของ item ที่เลือกอยู่
    const it = placedItems.find((i) => i.uid === selectedUid);
    if (it && it.zoneUid) {
      zonesToDraw.push({ zuid: it.zoneUid, mode: "item-in-zone" });
    }
  }

  // Priority 3: ⭐ hover zone (ถ้าไม่ได้ drag อะไร)
  if (
    !isAnyDragging() &&
    interactionState.hoveredZoneUid &&
    interactionState.hoveredZoneUid !== selectedZoneUid
  ) {
    zonesToDraw.push({
      zuid: interactionState.hoveredZoneUid,
      mode: "hover",
    });
  }

  if (zonesToDraw.length === 0) {
    zoneBoundaryGroup.visible = false;
    return;
  }

  zoneBoundaryGroup.visible = true;

  // วาดแต่ละโซน
  zonesToDraw.forEach(({ zuid, mode }, idx) => {
    const b = getZoneBounds(zuid);
    if (!b) return;

    const meta = getZoneMetaLocal(zuid);
    const style = BOUNDARY_STYLES[mode];
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;

    // Fill
    const fillMat = new THREE.MeshBasicMaterial({
      color: meta.color,
      transparent: true,
      opacity: style.fillOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fillMat);
    fillMesh.rotation.x = -Math.PI / 2;
    // ⭐ offset เล็กน้อยเพื่อลด z-fighting ระหว่าง zones
    fillMesh.position.set(b.cx, 0.004 + idx * 0.001, b.cz);
    fillMesh.renderOrder = 8;
    zoneBoundaryGroup.add(fillMesh);

    // Border
    const pts = [
      new THREE.Vector3(b.minX, 0.01, b.minZ),
      new THREE.Vector3(b.maxX, 0.01, b.minZ),
      new THREE.Vector3(b.maxX, 0.01, b.maxZ),
      new THREE.Vector3(b.minX, 0.01, b.maxZ),
      new THREE.Vector3(b.minX, 0.01, b.minZ),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const borderMat = new THREE.LineDashedMaterial({
      color: meta.color,
      dashSize: style.dashSize,
      gapSize: style.gapSize,
      transparent: true,
      opacity: style.borderOpacity,
      depthTest: false,
    });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    borderLine.computeLineDistances();
    borderLine.renderOrder = 9 + idx;
    zoneBoundaryGroup.add(borderLine);
  });

  // Debug
  if (process.env.NODE_ENV === "development" && zonesToDraw.length > 1) {
    // console.log("[zoneBoundary] drew", zonesToDraw.map(z => z.mode));
  }
}