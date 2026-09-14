// components/viewport/CornerViews.tsx
"use client";
import { useCallback } from "react";
import * as THREE from "three";
import { camera, controls, isInitialized } from "@/lib/three/scene";
import { useRoomTwin } from "@/lib/state/store";

const CORNER_VIEWS: Record<
  string,
  { x: number; y: number; z: number; targetY: number }
> = {
  bl: { x: 2.6, y: 2.5, z: 5.6, targetY: 1.1 },
  br: { x: -2.6, y: 2.5, z: 5.6, targetY: 1.1 },
  fl: { x: 2.6, y: 2.5, z: -5.6, targetY: 1.1 },
  fr: { x: -2.6, y: 2.5, z: -5.6, targetY: 1.1 },
};

let flyToken = 0;

function flyCameraTo(
  x: number,
  y: number,
  z: number,
  targetY: number,
) {
  if (!isInitialized()) return;
  const myToken = ++flyToken;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(x, y, z);
  const endTarget = new THREE.Vector3(0, targetY, 0);
  const duration = 650;
  const t0 = performance.now();

  controls.enabled = false;

  function step(now: number) {
    if (myToken !== flyToken) return;
    const t = Math.min(1, (now - t0) / duration);
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

export default function CornerViews() {
  const room = useRoomTwin((s) => s.room);

  const handleCorner = useCallback(
    (corner: string) => {
      let v: { x: number; y: number; z: number; targetY: number };

      if (corner === "top") {
        v = {
          x: 0,
          y: room.h + 5.0,
          z: 0,
          targetY: room.h / 2,
        };
      } else {
        v = CORNER_VIEWS[corner];
      }

      if (v) flyCameraTo(v.x, v.y, v.z, v.targetY);
    },
    [room.h],
  );

  return (
    <div className="corner-views" id="cornerViews">
      <button
        type="button"
        className="corner-view-btn"
        data-corner="bl"
        onClick={() => handleCorner("bl")}
      >
        🎥 มุม 1
      </button>
      <button
        type="button"
        className="corner-view-btn"
        data-corner="br"
        onClick={() => handleCorner("br")}
      >
        🎥 มุม 2
      </button>
      <button
        type="button"
        className="corner-view-btn"
        data-corner="fl"
        onClick={() => handleCorner("fl")}
      >
        🎥 มุม 3
      </button>
      <button
        type="button"
        className="corner-view-btn"
        data-corner="fr"
        onClick={() => handleCorner("fr")}
      >
        🎥 มุม 4
      </button>
      <button
        type="button"
        className="corner-view-btn wide"
        data-corner="top"
        onClick={() => handleCorner("top")}
      >
        🗺️ มุมบน / ผังพื้น
      </button>
    </div>
  );
}