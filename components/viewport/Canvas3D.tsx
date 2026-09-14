// components/viewport/Canvas3D.tsx
"use client";
import { useEffect, useRef } from "react";
import {
  initScene,
  disposeScene,
  camera,
  renderer,
  isInitialized,
} from "@/lib/three/scene";
import {
  initRoomShell,
  rebuildRoomShell,
  applySurface,
  getWallStatusText,
} from "@/lib/three/roomShell";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { useRoomTwin } from "@/lib/state/store";
import { useSaveState } from "@/hooks/useSaveState";

export default function Canvas3D() {
  const holderRef = useRef<HTMLDivElement>(null);
  const room = useRoomTwin((s) => s.room);
  const surface = useRoomTwin((s) => s.surface);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const { saveState } = useSaveState();

  // ===== Init scene ครั้งแรก =====
  useEffect(() => {
    if (!holderRef.current) return;
    if (isInitialized()) return;

    initScene(holderRef.current);
    initRoomShell();

    const onResize = () => {
      if (!holderRef.current) return;
      const w = holderRef.current.clientWidth;
      const h = holderRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      disposeScene();
    };
  }, []);

  // ===== Rebuild room shell เมื่อ room เปลี่ยน =====
  useEffect(() => {
    if (!isInitialized()) return;
    rebuildRoomShell();
  }, [
    room.w,
    room.d,
    room.h,
    room.shape,
    room.cellSize,
    // blocks เป็น Set → ใช้ size เป็น proxy
    room.blocks?.size,
  ]);

  // ===== Re-apply surface เมื่อ surface เปลี่ยน =====
  useEffect(() => {
    if (!isInitialized()) return;
    applySurface();
  }, [
    surface.floor,
    surface.wallUniform,
    surface.wallAll,
    surface.ceiling,
    // walls (object) — JSON stringify check
    JSON.stringify(surface.walls),
  ]);

  // ===== Update Three.js objects เมื่อ items เปลี่ยนตำแหน่ง =====
  useEffect(() => {
    if (!isInitialized()) return;
    // reload three.js object transforms เพื่อ sync กับ state
    // (ไม่ reinstantiate ทั้งหมด — แค่ update position/rotation)
    import("@/lib/three/scene").then(({ objectsByUid }) => {
      placedItems.forEach((item) => {
        const obj = objectsByUid.get(item.uid);
        if (!obj) return;

        if (item.wallMount) {
          // wall items — update ที่ position/rotation
          import("@/lib/three/wallPlacement").then(
            ({ wallItemWorldXZ }) => {
              const w = wallItemWorldXZ(item);
              obj.position.set(w.x, item.v ?? 0, w.z);
              obj.rotation.y = item.rotY ?? 0;
              if (obj.children[0]) {
                obj.children[0].rotation.z = item.rotZ ?? 0;
              }
            },
          );
        } else if (item.ceilingMount) {
          obj.position.set(
            item.x ?? 0,
            useRoomTwin.getState().room.h,
            item.z ?? 0,
          );
          obj.rotation.y = item.rotY ?? 0;
        } else {
          obj.position.set(
            item.x ?? 0,
            item.restY ?? 0,
            item.z ?? 0,
          );
          obj.rotation.y = item.rotY ?? 0;
        }
      });
    });
  }, [placedItems]);

  useAnimationLoop();

  return <div id="canvas-holder" ref={holderRef} />;
}