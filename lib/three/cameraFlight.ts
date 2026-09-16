// lib/three/cameraFlight.ts
// Shared "fly camera to" helper — เดิม copy อยู่ใน CornerViews.tsx (local flyToken cancel
// รุ่นแก้ความเข้าใจเบื้องต้น) ขยับมาแชร์ให้ทั้ง CornerViews + RoomTree (โฟกัสโซน จากห้องของฉัน)
// Reference behavior (roomtwin_combined.html:11219–11247) — 650ms ease-in-out quad,
// lerp camera.position + controls.target, disable/enable controls, flyToken เพื่อ cancel
// flight เก่าที่ค้าง mid-flight

import * as THREE from "three";
import { isInitialized } from "./scene";
import { camera, controls } from "./scene";

let flyToken = 0;

export function flyCameraTo(
  x: number,
  y: number,
  z: number,
  targetX: number,
  targetY: number,
  targetZ: number,
) {
  if (!isInitialized()) return;
  const myToken = ++flyToken;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(x, y, z);
  const endTarget = new THREE.Vector3(targetX, targetY, targetZ);
  const dur = 650,
    t0 = performance.now();
  controls.enabled = false;

  function step(now: number) {
    if (myToken !== flyToken) return;
    const t = Math.min(1, (now - t0) / dur);
    // ease-in-out quad
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();

    if (t < 1) requestAnimationFrame(step);
    else controls.enabled = true;
  }

  requestAnimationFrame(step);
}