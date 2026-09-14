// components/viewport/Canvas3D.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import {
  initScene,
  disposeScene,
  camera,
  renderer,
  isInitialized,
  objectsByUid,
} from "@/lib/three/scene";
import {
  initRoomShell,
  rebuildRoomShell,
  applySurface,
} from "@/lib/three/roomShell";
import { instantiate } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { useRoomTwin } from "@/lib/state/store";

export default function Canvas3D() {
  const holderRef = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const room = useRoomTwin((s) => s.room);
  const surface = useRoomTwin((s) => s.surface);
  const placedItems = useRoomTwin((s) => s.placedItems);

  // ===== 1. Init scene =====
  useEffect(() => {
    if (!holderRef.current) return;

    if (isInitialized()) {
      setSceneReady(true);
      return;
    }

    initScene(holderRef.current);
    initRoomShell();
    setSceneReady(true);

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
      setSceneReady(false);
    };
  }, []);

  // ===== 2. Instantiate items หลัง sceneReady ⭐ =====
  useEffect(() => {
    if (!sceneReady) return;

    const items = useRoomTwin.getState().placedItems;
    let changed = false;

    items.forEach((item) => {
      if (!objectsByUid.has(item.uid)) {
        console.log("[Canvas3D] instantiate", item.productId, item.uid);
        instantiate(item);
        changed = true;
      }
    });

    if (changed) {
      resolveRestHeights();
      console.log("[Canvas3D] total objects:", objectsByUid.size);
    }
  }, [sceneReady, placedItems.length]);

  // ===== 3. Rebuild shell + reclamp เมื่อ room เปลี่ยน =====
  useEffect(() => {
    if (!sceneReady) return;
    rebuildRoomShell();
    reclampAllToRoom();
  }, [
    sceneReady,
    room.w,
    room.d,
    room.h,
    room.shape,
    room.cellSize,
    room.blocks?.size,
  ]);

  // ===== 4. Re-apply surface =====
  useEffect(() => {
    if (!sceneReady) return;
    applySurface();
  }, [
    sceneReady,
    surface.floor,
    surface.wallUniform,
    surface.wallAll,
    surface.ceiling,
    JSON.stringify(surface.walls),
  ]);

  // ===== 5. Sync transforms =====
  useEffect(() => {
    if (!sceneReady) return;

    placedItems.forEach((item) => {
      const obj = objectsByUid.get(item.uid);
      if (!obj) return;

      if (item.wallMount) return;
      if (item.ceilingMount) {
        obj.position.set(
          item.x ?? 0,
          useRoomTwin.getState().room.h,
          item.z ?? 0,
        );
        obj.rotation.y = item.rotY ?? 0;
      } else {
        obj.position.set(item.x ?? 0, item.restY ?? 0, item.z ?? 0);
        obj.rotation.y = item.rotY ?? 0;
      }
    });
  }, [sceneReady, placedItems]);

  useAnimationLoop();

  return <div id="canvas-holder" ref={holderRef} />;
}