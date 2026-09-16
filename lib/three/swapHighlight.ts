// lib/three/swapHighlight.ts
// ⭐ visual indicator ของโหมด "เปลี่ยนสินค้า" (swap mode)
//    - กรอบ dashed wireframe 2 ชั้น pulse รอบ object ที่กำลังถูกเปลี่ยน
//    - badge ลอยเหนือ object บอกว่ากำลังเปลี่ยนเป็นสินค้าอะไร
//    ไม่แตะ material ของ object จริง (กัน UI ของสินค้าพัง / material restore ผิดจังหวะ)
import * as THREE from "three";
import { roomGroup, objectsByUid, camera, renderer } from "./scene";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";

// ============================================================
// Box wireframe (singleton — สร้างครั้งเดียว ใช้ซ้ำทุก object)
// ============================================================

const _geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

function makeWire(color: number, opacity: number, renderOrder: number) {
  const lines = new THREE.LineSegments(
    _geo,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
    }),
  );
  lines.visible = false;
  lines.renderOrder = renderOrder;
  lines.frustumCulled = false;
  roomGroup.add(lines);
  return lines;
}

const wireA = makeWire(0xb8752e, 0.75, 12);
const wireB = makeWire(0x8f5a21, 0.3, 13);

// ============================================================
// State
// ============================================================

let swapTargetUid: string | null = null;
let lastBadgeProduct: string | null = null;

const _box = new THREE.Box3();
const _childBox = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _top = new THREE.Vector3();

// ============================================================
// Public API
// ============================================================

/** ตั้ง/ล้าง object ที่กำลังถูกเปลี่ยน — เรียกจาก useSwapHighlight (store subscription) */
export function setSwapHighlight(uid: string | null) {
  swapTargetUid = uid;
}

/** ซ่อนทุกอย่าง — เรียกตอนออกจากโหมด / unmount / dispose */
export function clearSwapHighlight() {
  swapTargetUid = null;
  lastBadgeProduct = null;
  wireA.visible = false;
  wireB.visible = false;
  const badge = getBadge();
  if (badge) badge.classList.remove("show");
}

/**
 * อัปเดตกรอบ + badge ต่อเฟรม — เรียกจาก useAnimationLoop
 * อ่านค่าจาก store เพื่อกัน stale หลัง undo/redo/ลบ item
 */
export function updateSwapHighlight() {
  const uid = useRoomTwin.getState().swapTargetUid;
  if (uid !== swapTargetUid) {
    swapTargetUid = uid;
    lastBadgeProduct = null;
  }

  const store = useRoomTwin.getState();
  const item = uid
    ? store.placedItems.find((i) => i.uid === uid)
    : null;
  const obj = uid ? objectsByUid.get(uid) : null;

  if (!item || !obj || !renderer) {
    hideVisuals();
    return;
  }

  // ===== Bounding box (ข้าม mesh ที่โปร่งใสใช้เป็น collider) =====
  obj.updateMatrixWorld(true);
  _box.makeEmpty();
  obj.traverse((child: any) => {
    if (!child.isMesh) return;
    if (child.visible === false) return;
    const mat = child.material as any;
    if (mat?.transparent && (mat.opacity ?? 1) < 0.05) return;
    _childBox.setFromObject(child);
    if (isFinite(_childBox.min.x)) _box.union(_childBox);
  });

  if (_box.isEmpty()) {
    hideVisuals();
    return;
  }

  _box.getCenter(_center);
  _box.getSize(_size);

  // ===== Pulse wireframe 2 ชั้น =====
  const t = performance.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.4);

  placeWire(wireA, 0.02);
  placeWire(wireB, 0.055 + 0.035 * pulse);
  wireA.visible = true;
  wireB.visible = true;

  const matA = wireA.material as THREE.LineBasicMaterial;
  const matB = wireB.material as THREE.LineBasicMaterial;
  matA.opacity = 0.45 + 0.35 * pulse;
  matB.opacity = 0.16 + 0.3 * pulse;

  // ===== Badge =====
  const badge = getBadge();
  if (!badge) return;

  if (lastBadgeProduct !== item.productId) {
    lastBadgeProduct = item.productId;
    badge.innerHTML = `<b>⇄ กำลังเปลี่ยน: ${
      PRODUCT_BY_ID.get(item.productId)?.name || item.productId
    }</b><small>เลือกการ์ดในแถบด้านข้างเพื่อแทนที่</small>`;
  }

  _top.set(_center.x, _box.max.y, _center.z).project(camera);
  if (
    _top.z > 1 ||
    Math.abs(_top.x) > 1.2 ||
    _top.y > 1.2 ||
    obj.visible === false
  ) {
    badge.classList.remove("show");
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  // ⭐ clamp ให้ badge อยู่ใน viewport เสมอ (ไม่ล้นทับ sidebar/ขอบจอ)
  const MARGIN = 70;
  const sx = Math.min(
    rect.width - MARGIN,
    Math.max(MARGIN, (_top.x * 0.5 + 0.5) * rect.width),
  );
  const sy = Math.max(56, (-_top.y * 0.5 + 0.5) * rect.height);

  badge.style.left = sx + "px";
  badge.style.top = sy + "px";
  badge.classList.add("show");
}

// ============================================================
// Internal
// ============================================================

function placeWire(lines: THREE.LineSegments, grow: number) {
  lines.position.set(_center.x, _center.y, _center.z);
  lines.scale.set(_size.x + grow, _size.y + grow, _size.z + grow);
}

function hideVisuals() {
  wireA.visible = false;
  wireB.visible = false;
  const badge = getBadge();
  if (badge) badge.classList.remove("show");
}

function getBadge(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("swapBadge");
}
