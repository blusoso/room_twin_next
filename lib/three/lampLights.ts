// lib/three/lampLights.ts
//
// ⭐ ไฟจริงของโคม (PointLight / SpotLight) ที่ผูกกับ object ของไอเทม
//
//    - ไฟเป็น "ลูกของ lightAnchor" ในกลุ่มของไอเทม (objectsByUid)
//      → ขยับ/หมุน/เปลี่ยนความสูงเพดานตาม object อัตโนมัติ ไม่ต้อง sync เอง
//    - ไม่ castShadow (PointLight shadow = 6 faces/ดวง แพงเกินไปเมื่อมีหลายดวง)
//      ใช้ contact shadow ของสินค้า + เงานุ่มจาก sun แทน
//    - เพดานจำนวนไฟจริง = MAX_LAMP_LIGHTS (เกินแล้วยังมี glow ของหลอด/โป๊ะ)
//
//    แหล่งความจริงของ "ไฟเปิด/ปิด" = store (lampsOn) + item.params.lightOn
//    ไฟล์นี้ไม่เก็บ state ถาวรใด ๆ

import * as THREE from "three";
import { objectsByUid } from "./scene";
import {
  LAMP_LIGHT_SPECS,
  LAMP_PRODUCT_IDS,
  MAX_LAMP_LIGHTS,
  LAMP_BULB_EMISSIVE_ON,
  LAMP_BULB_EMISSIVE_OFF,
  LAMP_SHADE_EMISSIVE_ON,
  LIGHTING_PRESETS,
} from "@/lib/data/lighting";
import { useRoomTwin } from "@/lib/state/store";

interface LampEntry {
  uid: string;
  /** กลุ่มของไอเทมที่ไฟนี้ผูกอยู่ (ใช้ตรวจว่า object ถูกสร้างใหม่หรือยัง) */
  root: THREE.Object3D;
  light: THREE.Light;
  bulbs: THREE.Mesh[];
  shades: THREE.Mesh[];
}

const _entries = new Map<string, LampEntry>();
let _warnedCap = false;

function markedMeshes(root: THREE.Object3D, key: string): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o: any) => {
    if (o.isMesh && o.userData?.[key]) out.push(o as THREE.Mesh);
  });
  return out;
}

/** จำค่า emissive เดิมของวัสดุไว้ (ถ้า builder ยังไม่ได้ตั้ง) */
function ensureBaseEmissive(meshes: THREE.Mesh[]) {
  meshes.forEach((m) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat || mat.userData?.baseEmissiveIntensity !== undefined) return;
    mat.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 1;
    mat.userData.baseEmissive = mat.emissive?.getHex() ?? 0xffffff;
  });
}

/**
 * ⭐ สร้างไฟให้โคม 1 ดวง (เรียกจาก instantiate ทุกเส้นทาง)
 *    - ไม่ใช่โคม → ไม่ทำอะไร
 *    - มีไฟอยู่แล้วและ object เดิม → ไม่ทำซ้ำ
 *    - object ถูกสร้างใหม่ (reinstantiate) → ของเดิมถูก group หายไปแล้ว → สร้างใหม่
 */
export function attachLampLight(uid: string) {
  const item = useRoomTwin
    .getState()
    .placedItems.find((i) => i.uid === uid);
  if (!item || !LAMP_PRODUCT_IDS.has(item.productId)) return;

  const group = objectsByUid.get(uid);
  if (!group) return;

  const spec = LAMP_LIGHT_SPECS[item.productId];
  if (!spec) return;

  const existing = _entries.get(uid);
  if (existing) {
    // ยังผูกกับ object เดิม → ไม่ต้องสร้างใหม่
    if (existing.root === group && existing.light.parent) return;
    detachLampLight(uid);
  }

  if (_entries.size >= MAX_LAMP_LIGHTS) {
    if (!_warnedCap) {
      _warnedCap = true;
      console.warn(
        `[lampLights] มีโคมเกิน ${MAX_LAMP_LIGHTS} ดวง — โคมที่เกินจะไม่มีแสงตก (ยังมี glow)`,
      );
    }
    return;
  }

  const anchor =
    (group.getObjectByName("lightAnchor") as THREE.Object3D | null) ?? group;

  let light: THREE.Light;
  if (spec.kind === "spot") {
    const spot = new THREE.SpotLight(
      spec.color,
      spec.intensity,
      spec.distance,
      spec.angle ?? Math.PI / 4,
      spec.penumbra ?? 0.5,
      spec.decay,
    );
    spot.target.position.set(0, spec.targetY ?? -1, 0);
    anchor.add(spot.target);
    light = spot;
  } else {
    light = new THREE.PointLight(
      spec.color,
      spec.intensity,
      spec.distance,
      spec.decay,
    );
  }
  light.castShadow = false;
  light.name = "lampLight";
  anchor.add(light);

  const bulbs = markedMeshes(group, "lampBulb");
  const shades = markedMeshes(group, "lampShade");
  ensureBaseEmissive(bulbs);

  _entries.set(uid, { uid, root: group, light, bulbs, shades });
  applyLampPowerFor(uid);
}

/** ⭐ ลบไฟของโคม 1 ดวง (เรียกจาก removeInstantiated / dispose) */
export function detachLampLight(uid: string) {
  const entry = _entries.get(uid);
  if (!entry) return;

  if (entry.light instanceof THREE.SpotLight) {
    entry.light.target.parent?.remove(entry.light.target);
  }
  entry.light.parent?.remove(entry.light);
  _entries.delete(uid);
}

/** ⭐ เปิด/ปิดไฟตาม store (lampsOn + params.lightOn) ของทุกโคมที่ลงทะเบียนไว้ */
export function applyLampPower() {
  _entries.forEach((entry) => applyLampPowerFor(entry.uid));
}

function applyLampPowerFor(uid: string) {
  const entry = _entries.get(uid);
  if (!entry) return;

  const { placedItems, lampsOn, lightingMode } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item) return;

  const spec = LAMP_LIGHT_SPECS[item.productId];
  if (!spec) return;

  const preset = LIGHTING_PRESETS[lightingMode] ?? LIGHTING_PRESETS.day;
  const on = lampsOn && item.params.lightOn !== false;

  entry.light.visible = on;
  entry.light.intensity = on ? spec.intensity * preset.lampScale : 0;

  const lightColor = new THREE.Color(spec.color);

  entry.bulbs.forEach((m) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat) return;
    const base =
      mat.userData?.baseEmissiveIntensity ?? mat.emissiveIntensity ?? 1;
    mat.emissiveIntensity = on
      ? base * LAMP_BULB_EMISSIVE_ON
      : base * LAMP_BULB_EMISSIVE_OFF;
  });

  entry.shades.forEach((m) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat) return;
    mat.emissive.copy(lightColor);
    mat.emissiveIntensity = on ? LAMP_SHADE_EMISSIVE_ON : 0;
  });
}

/**
 * ⭐ Reconcile registry กับ store/objectsByUid
 *    safety net หลัง undo-redo / รีเซ็ตห้อง / ลบ object นอกเส้นทางปกติ
 */
export function syncLampLights() {
  const { placedItems } = useRoomTwin.getState();

  const wanted = new Set<string>();
  placedItems.forEach((item) => {
    if (!LAMP_PRODUCT_IDS.has(item.productId)) return;
    const group = objectsByUid.get(item.uid);
    if (!group) return;
    wanted.add(item.uid);
    const entry = _entries.get(item.uid);
    if (!entry || entry.root !== group) attachLampLight(item.uid);
  });

  Array.from(_entries.keys()).forEach((uid) => {
    if (wanted.has(uid)) return;
    const entry = _entries.get(uid);
    const group = objectsByUid.get(uid);
    if (!entry) return;
    if (!group || entry.root !== group) detachLampLight(uid);
  });

  applyLampPower();
}

/** ⭐ ล้างไฟทั้งหมด (ตอน disposeScene) */
export function disposeLampLights() {
  Array.from(_entries.keys()).forEach((uid) => detachLampLight(uid));
  _entries.clear();
  _warnedCap = false;
}

/** จำนวนไฟจริงที่ลงทะเบียนอยู่ (ใช้ตรวจสอบ/ดีบัก) */
export function lampLightCount(): number {
  return _entries.size;
}
