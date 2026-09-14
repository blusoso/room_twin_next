// lib/three/zoneBounds.ts
import * as THREE from "three";
import { zoneBoundaryGroup } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { footprintOf } from "./placement";

export function getZoneMetaLocal(zuid: string) {
  const { zoneMeta, placedItems } = useRoomTwin.getState();
  const ov = zoneMeta.get(zuid) || {};
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
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  items.forEach((it) => {
    const fp = footprintOf(it.params, it.rotY || 0);
    minX = Math.min(minX, it.x! - fp.w / 2);
    maxX = Math.max(maxX, it.x! + fp.w / 2);
    minZ = Math.min(minZ, it.z! - fp.d / 2);
    maxZ = Math.max(maxZ, it.z! + fp.d / 2);
  });
  const pad = 0.15;
  return {
    minX: minX - pad, maxX: maxX + pad,
    minZ: minZ - pad, maxZ: maxZ + pad,
    cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
  };
}

export function buildZoneBoundary() {
  while (zoneBoundaryGroup.children.length) {
    const c = zoneBoundaryGroup.children[0];
    zoneBoundaryGroup.remove(c);
    if ((c as any).geometry) (c as any).geometry.dispose();
    if ((c as any).material) (c as any).material.dispose();
  }
  const { selectedZoneUid, selectedUid, placedItems } = useRoomTwin.getState();
  let z = selectedZoneUid;
  if (!z && selectedUid) {
    const it = placedItems.find((i) => i.uid === selectedUid);
    if (it && it.zoneUid) z = it.zoneUid;
  }
  if (!z) {
    zoneBoundaryGroup.visible = false;
    return;
  }
  const b = getZoneBounds(z);
  if (!b) {
    zoneBoundaryGroup.visible = false;
    return;
  }
  zoneBoundaryGroup.visible = true;
  const meta = getZoneMetaLocal(z);
  const isSel = !!selectedZoneUid;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;

  const fillMat = new THREE.MeshBasicMaterial({
    color: meta.color, transparent: true,
    opacity: isSel ? 0.14 : 0.06,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fillMat);
  fillMesh.rotation.x = -Math.PI / 2;
  fillMesh.position.set(b.cx, 0.004, b.cz);
  fillMesh.renderOrder = 8;
  zoneBoundaryGroup.add(fillMesh);

  const pts = [
    new THREE.Vector3(b.minX, 0.01, b.minZ),
    new THREE.Vector3(b.maxX, 0.01, b.minZ),
    new THREE.Vector3(b.maxX, 0.01, b.maxZ),
    new THREE.Vector3(b.minX, 0.01, b.maxZ),
    new THREE.Vector3(b.minX, 0.01, b.minZ),
  ];
  const borderGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const borderMat = new THREE.LineDashedMaterial({
    color: meta.color, dashSize: 0.13, gapSize: 0.09,
    transparent: true, opacity: isSel ? 1 : 0.55, depthTest: false,
  });
  const borderLine = new THREE.Line(borderGeo, borderMat);
  borderLine.computeLineDistances();
  borderLine.renderOrder = 9;
  zoneBoundaryGroup.add(borderLine);
}