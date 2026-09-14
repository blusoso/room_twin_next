// hooks/useAnimationLoop.ts
"use client";
import { useEffect } from "react";
import { renderer, scene, camera, controls, isInitialized } from "@/lib/three/scene";
import { updateWallVisibility } from "@/lib/three/roomShell";
import { updateRotateGizmo } from "@/lib/three/gizmo";
import { buildZoneBoundary } from "@/lib/three/zoneBounds";

export function useAnimationLoop() {
  useEffect(() => {
    if (!isInitialized()) return;
    let raf = 0;

    const tick = () => {
      controls.update();
      updateWallVisibility();
      updateRotateGizmo();
      buildZoneBoundary();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}