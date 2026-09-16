// lib/three/lighting.ts
//
// ⭐ ระบบแสงของฉาก (imperative — ไม่ใช่ React)
//    - initLighting()      : สร้าง environment map (IBL) + ตั้งค่าแสงรอบแรก
//    - applyLightingMode() : ใช้ค่า LIGHTING_PRESETS ตามโหมด (วัน/เย็น/คืน)
//    - disposeLighting()   : คืนทรัพยากรทั้งหมด
//
//    โหมดแสงเป็น view preference ใน store (transient) — ไฟล์นี้ไม่เก็บ state เอง
//    ใครเป็นคนเรียก: components/viewport/Canvas3D.tsx (init/dispose/หลัง rebuild)
//                   hooks/useLighting.ts (subscribe store → applyLightingMode)

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  scene,
  renderer,
  hemi,
  sun,
  fill,
  objectsByUid,
  baseboardGroup,
} from "./scene";
import {
  floorMat,
  blockFloorMat,
  wallMat,
  sideWallMat,
  rightWallMat,
  frontWallMat,
  ceilingMat,
  WALLS,
  getPolyWalls,
  setShellRebuildListener,
} from "./roomShell";
import {
  setEnvIntensities,
  applyItemEnvIntensity,
  applyRoomEnvIntensityToMaterial,
} from "./materialQuality";
import { LIGHTING_PRESETS } from "@/lib/data/lighting";
import { applyLampPower, disposeLampLights } from "./lampLights";
import { useRoomTwin } from "@/lib/state/store";

let _envRT: THREE.WebGLRenderTarget | null = null;
let _initialized = false;

/**
 * ⭐ สร้าง environment map จาก RoomEnvironment (PMREM)
 *    ให้วัสดุ PBR มีแสงสะท้อนนุ่ม ๆ รอบทิศ — ภาพดูมีมิติขึ้นมาก
 *    ถ้าสร้างไม่สำเร็จ (เช่น GPU/RenderTarget ล้ม) ให้ใช้งานต่อโดยไม่มี env
 */
export function initLighting() {
  if (_initialized) return;
  if (!renderer) return;

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment(renderer);
    _envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = _envRT.texture;
    envScene.dispose();
    pmrem.dispose();
  } catch (err) {
    _envRT = null;
    scene.environment = null;
    console.warn("[lighting] สร้าง environment map ไม่สำเร็จ — ใช้แสงเดิมต่อ", err);
  }

  // ⭐ ACES tone mapping ให้ภาพดูเป็นฟิล์ม (เดิมไม่ได้ตั้ง → สีแข็ง/ไหม้)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // ⭐ rebuild shell ทุกครั้ง (ขนาดห้อง/รูปทรง/blocks) → วัสดุใหม่ต้องได้ envMapIntensity
  setShellRebuildListener(() => applyRoomEnvIntensity());

  applyLightingMode();
  _initialized = true;
}

/** ⭐ ตั้งแสงทั้งฉากตามโหมดปัจจุบัน (อ่านค่าจาก store) */
export function applyLightingMode() {
  if (!renderer) return;

  const { lightingMode } = useRoomTwin.getState();
  const preset = LIGHTING_PRESETS[lightingMode] ?? LIGHTING_PRESETS.day;

  // ===== background + fog =====
  if (scene.background instanceof THREE.Color) {
    scene.background.setHex(preset.background);
  } else {
    scene.background = new THREE.Color(preset.background);
  }
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(preset.background);
    scene.fog.near = preset.fog.near;
    scene.fog.far = preset.fog.far;
  }

  // ===== exposure =====
  renderer.toneMappingExposure = preset.exposure;

  // ===== ไฟหลัก 3 ดวง =====
  if (hemi) {
    hemi.color.setHex(preset.hemi.sky);
    hemi.groundColor.setHex(preset.hemi.ground);
    hemi.intensity = preset.hemi.intensity;
  }
  if (sun) {
    sun.color.setHex(preset.sun.color);
    sun.intensity = preset.sun.intensity;
    sun.position.set(preset.sun.pos[0], preset.sun.pos[1], preset.sun.pos[2]);
  }
  if (fill) {
    fill.color.setHex(preset.fill.color);
    fill.intensity = preset.fill.intensity;
    fill.position.set(preset.fill.pos[0], preset.fill.pos[1], preset.fill.pos[2]);
  }

  // ===== env map intensity ต่อชนิดวัสดุ =====
  setEnvIntensities(preset.envRoom, preset.envItem);
  applyRoomEnvIntensity();
  objectsByUid.forEach((group) => applyItemEnvIntensity(group));

  // ===== ไฟของโคม =====
  applyLampPower();
}

/**
 * ⭐ ตั้ง envMapIntensity ให้วัสดุ "พื้นผิวห้อง" ทุกตัว
 *    ต้องเรียกซ้ำหลัง rebuild shell ทุกครั้ง (วัสดุบางตัวถูกสร้างใหม่)
 *    ตั้งบนวัสดุที่รู้จักตรง ๆ เพื่อไม่ให้ไปโดนวัสดุของไอเทมใน roomGroup
 */
export function applyRoomEnvIntensity() {
  applyRoomEnvIntensityToMaterial(floorMat);
  applyRoomEnvIntensityToMaterial(blockFloorMat);
  applyRoomEnvIntensityToMaterial(wallMat);
  applyRoomEnvIntensityToMaterial(sideWallMat);
  applyRoomEnvIntensityToMaterial(rightWallMat);
  applyRoomEnvIntensityToMaterial(frontWallMat);
  applyRoomEnvIntensityToMaterial(ceilingMat);

  Object.values(WALLS).forEach((w) => applyRoomEnvIntensityToMaterial(w?.mat));
  getPolyWalls().forEach((w) => applyRoomEnvIntensityToMaterial(w?.mat));
  baseboardGroup.traverse((o: any) => {
    if (o.isMesh) applyRoomEnvIntensityToMaterial(o.material);
  });
}

/** ⭐ คืนทรัพยากรของระบบแสง (เรียกก่อน disposeScene) */
export function disposeLighting() {
  setShellRebuildListener(null);
  disposeLampLights();

  if (_envRT) {
    _envRT.dispose();
    _envRT = null;
  }
  scene.environment = null;
  _initialized = false;
}

export function isLightingInitialized() {
  return _initialized;
}
