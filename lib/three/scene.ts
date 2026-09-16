// lib/three/scene.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== Shared instances =====
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

export const roomGroup = new THREE.Group();
export const floorGroup = new THREE.Group();
export const ceilingGroup = new THREE.Group();
export const ceilingColliderGroup = new THREE.Group();
export const baseboardGroup = new THREE.Group();
export const zoneBoundaryGroup = new THREE.Group();

// ===== Registries =====
export const objectsByUid = new Map<string, THREE.Group>();
export const wallItemMaterials = new Map<string, THREE.Material[]>();
export const surfaceColliders = new Map<string, THREE.Mesh>();
export const meshWallId = new Map<THREE.Mesh, string>();

// ===== Deferred instances =====
export let renderer: THREE.WebGLRenderer;
export let controls: OrbitControls;
export let hemi: THREE.HemisphereLight;
export let sun: THREE.DirectionalLight;
export let fill: THREE.DirectionalLight;

// ===== Shared raycaster =====
export const raycaster = new THREE.Raycaster();
export const pointerNDC = new THREE.Vector2();

let _initialized = false;

export function initScene(holder: HTMLElement) {
  if (_initialized) return;

  scene.background = new THREE.Color(0xede4d2);
  // ⭐ Fog เริ่มที่ 20 จบ 50 — ไกลพอ ไม่บังตอน zoom out
  scene.fog = new THREE.Fog(0xede4d2, 20, 50);

  camera.position.set(2.6, 2.5, 5.6);
  // ⭐ far = 200 → มองไกลได้มาก
  camera.far = 200;
  camera.updateProjectionMatrix();

  // ⭐ preserveDrawingBuffer = true → อ่านภาพจาก canvas ไปทำ thumbnail ได้ตลอดเวลา
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(holder.clientWidth, holder.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // ⭐ ACES tone mapping — ค่าจริง (exposure) ถูกตั้งใน lib/three/lighting.ts ตามโหมดแสง
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.touchAction = "none";
  holder.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  // ⭐ maxDistance = 40 → zoom out ได้ไกลมาก
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = 0.02;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.5;
  controls.update();

  // Lights
  // ⭐ ค่าสี/ความเข้ม/ตำแหน่งจริงถูกตั้งโดย applyLightingMode() (lib/three/lighting.ts)
  //    ค่าตรงนี้เป็นค่าเริ่มต้นของโหมด "วัน" เพื่อให้ฉากใช้ได้แม้ยังไม่ init lighting
  hemi = new THREE.HemisphereLight(0xfff3e0, 0xcfc6b0, 0.75);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xfff2df, 1.05);
  sun.position.set(-3.2, 4.5, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -4.5;
  sun.shadow.camera.right = 4.5;
  sun.shadow.camera.top = 4.5;
  sun.shadow.camera.bottom = -4.5;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  // ⭐ bias น้อยลง + normalBias → ลดรอยหยัก (acne) โดยไม่ทำเงาลอย (peter-panning)
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  fill = new THREE.DirectionalLight(0xd9e3f0, 0.28);
  fill.position.set(3, 2, -2);
  scene.add(fill);

  // Group hierarchy
  scene.add(roomGroup);
  roomGroup.add(floorGroup);
  roomGroup.add(ceilingGroup);
  roomGroup.add(ceilingColliderGroup);
  roomGroup.add(baseboardGroup);
  zoneBoundaryGroup.visible = false;
  roomGroup.add(zoneBoundaryGroup);

  _initialized = true;
}

export function disposeScene() {
  if (!_initialized) return;

  objectsByUid.forEach((obj) => {
    roomGroup.remove(obj);
    obj.traverse((o: any) => {
      if (o.geometry?.dispose) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material))
          o.material.forEach((m: any) => m?.dispose?.());
        else o.material.dispose?.();
      }
    });
  });
  objectsByUid.clear();
  wallItemMaterials.clear();
  surfaceColliders.clear();
  meshWallId.clear();

  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  controls?.dispose();

  _initialized = false;
}

export function isInitialized() {
  return _initialized;
}