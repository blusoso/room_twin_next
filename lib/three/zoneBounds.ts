// lib/three/zoneBounds.ts
import * as THREE from "three";
import { zoneBoundaryGroup } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { footprintOf } from "./placement";
import { findFloorYAt } from "./roomShell";
import { interactionState, isAnyDragging } from "./interactionState";
import { resolveZoneDisplay } from "@/lib/data/zoneResolve";

/**
 * ⭐ metadata ของโซนสำหรับ 3D — derive จาก definition/override ผ่าน resolver กลางเท่านั้น
 *    (ห้าม hardcode name/icon/color ที่นี่)
 */
export function getZoneMetaLocal(zuid: string) {
  const d = resolveZoneDisplay(zuid);
  return { name: d.name, icon: d.icon, color: d.color };
}

export function getZoneBounds(zuid: string, pad = 0.15) {
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

  // ⭐ pad = 0 ใช้ตอน "วัดระยะ" (ไม้บรรทัด) — padding 0.15 ม. จะทำให้ตัวเลขระยะคลาดเคลื่อน
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

// ⭐ Cache signature — สร้าง/dispose mesh+material ใหม่เฉพาะตอนที่ input เปลี่ยน
//    (เดิมสร้างทิ้งใหม่ทุก frame → GC pressure / jank ตอนโซนถูกเลือก)
let lastSig = "";

interface DrawEntry {
  zuid: string;
  mode: BoundaryMode;
}

function floorSig(): string {
  const { room } = useRoomTwin.getState();
  if (room.shape !== "blocks") return "rect";
  return "blocks" + (room.blocks?.size ?? 0) + "|" + JSON.stringify(room.cellLevels || {});
}

function drawSig(zonesToDraw: DrawEntry[]): string {
  const parts: string[] = [floorSig()];
  zonesToDraw.forEach(({ zuid, mode }) => {
    const b = getZoneBounds(zuid);
    if (!b) return;
    const meta = getZoneMetaLocal(zuid);
    parts.push(
      `${zuid}|${mode}|${meta.color}|${b.minX}|${b.maxX}|${b.minZ}|${b.maxZ}`,
    );
  });
  return parts.join(";");
}

function clearBoundaryGroup() {
  while (zoneBoundaryGroup.children.length) {
    const c = zoneBoundaryGroup.children[0];
    zoneBoundaryGroup.remove(c);
    if ((c as any).geometry) (c as any).geometry.dispose();
    if ((c as any).material) (c as any).material.dispose();
  }
}

export function buildZoneBoundary() {
  const { selectedZoneUid, selectedUid, placedItems } = useRoomTwin.getState();

  // ⭐ List ของ zone ที่ต้องวาด
  const zonesToDraw: DrawEntry[] = [];

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
    if (lastSig !== "") {
      lastSig = "";
      clearBoundaryGroup();
    }
    return;
  }

  // ⭐ ข้าม rebuild ถ้า input ไม่เปลี่ยน (ไม่ต้อง alloc ทุก frame)
  const sig = drawSig(zonesToDraw);
  if (sig === lastSig) {
    zoneBoundaryGroup.visible = true;
    return;
  }
  lastSig = sig;
  clearBoundaryGroup();

  zoneBoundaryGroup.visible = true;

  // วาดแต่ละโซน
  zonesToDraw.forEach(({ zuid, mode }, idx) => {
    const b = getZoneBounds(zuid);
    if (!b) return;

    const meta = getZoneMetaLocal(zuid);
    const style = BOUNDARY_STYLES[mode];
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;

    // ⭐ ความสูงพื้นจริงใต้โซน (rect=0, blocks=ผิวสแลบ) — ใช้สูงสุดของมุมเพื่อไม่ให้จมใต้สแลบยก
    const floorY = Math.max(
      findFloorYAt(b.minX, b.minZ),
      findFloorYAt(b.maxX, b.minZ),
      findFloorYAt(b.minX, b.maxZ),
      findFloorYAt(b.maxX, b.maxZ),
    );

    // Fill
    const fillMat = new THREE.MeshBasicMaterial({
      color: meta.color,
      transparent: true,
      opacity: style.fillOpacity,
      depthWrite: false,
      // ⭐ ปิด depthTest เพื่อให้เห็นเสมอเหนือพื้น (กัน depth-fighting/ถูกพื้นกลบ)
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fillMat);
    fillMesh.rotation.x = -Math.PI / 2;
    // ⭐ ยกสูงเหนือผิวพื้น ~1 ซม. + offset เล็กน้อยระหว่าง zones กัน z-fighting
    fillMesh.position.set(b.cx, floorY + 0.01 + idx * 0.001, b.cz);
    fillMesh.renderOrder = 8;
    zoneBoundaryGroup.add(fillMesh);

    // Border
    const pts = [
      new THREE.Vector3(b.minX, floorY + 0.01, b.minZ),
      new THREE.Vector3(b.maxX, floorY + 0.01, b.minZ),
      new THREE.Vector3(b.maxX, floorY + 0.01, b.maxZ),
      new THREE.Vector3(b.minX, floorY + 0.01, b.maxZ),
      new THREE.Vector3(b.minX, floorY + 0.01, b.minZ),
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