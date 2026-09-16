// lib/three/materialQuality.ts
//
// ⭐ คุมคุณภาพวัสดุ PBR ที่ผูกกับ environment map (IBL) ของฉาก
//
//    three r160 ไม่มี scene.environmentIntensity → ต้องคุมความเข้มการสะท้อน
//    สภาพแวดล้อมด้วย material.envMapIntensity เป็นรายวัสดุ
//    โมดูลนี้เป็น "leaf" (ไม่ import โมดูลอื่นใน lib/three) เพื่อกัน import cycle
//
//    ค่าจริงถูกตั้งจาก lib/three/lighting.ts ตามโหมดแสง (LIGHTING_PRESETS)

import * as THREE from "three";

let _roomEnv = 0.35;
let _itemEnv = 0.6;

export function setEnvIntensities(room: number, item: number) {
  _roomEnv = room;
  _itemEnv = item;
}

export function getRoomEnvIntensity(): number {
  return _roomEnv;
}

export function getItemEnvIntensity(): number {
  return _itemEnv;
}

/** ตั้ง envMapIntensity ให้ material เดียว/หลายตัว (รองรับ array ของ material) */
function setEnvOnMaterial(material: any, value: number) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => setEnvOnMaterial(m, value));
    return;
  }
  // MeshPhysicalMaterial สืบทอด MeshStandardMaterial → isMeshStandardMaterial = true
  if (material.isMeshStandardMaterial) {
    material.envMapIntensity = value;
  }
}

/** ตั้ง envMapIntensity ของวัสดุ "เฟอร์นิเจอร์/ไอเทม" ให้ทั้ง subtree */
export function applyItemEnvIntensity(root: THREE.Object3D | undefined) {
  if (!root) return;
  root.traverse((o: any) => {
    if (o.isMesh) setEnvOnMaterial(o.material, _itemEnv);
  });
}

/** ตั้ง envMapIntensity ให้ material เตี่ยว (ใช้กับวัสดุห้องที่รู้จักตรง ๆ) */
export function applyRoomEnvIntensityToMaterial(material: any) {
  setEnvOnMaterial(material, _roomEnv);
}
