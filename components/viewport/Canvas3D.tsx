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
  rebuildBaseboards,
} from "@/lib/three/roomShell";
import { instantiate } from "@/lib/three/instantiate";
import { resolveRestHeights } from "@/lib/three/placement";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import {
  ensureDefaultOpenings,
  captureOpeningsRelative,
  restoreOpeningsRelative,
} from "@/hooks/useRoomTwinInit";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { useRoomTwin } from "@/lib/state/store";

export default function Canvas3D() {
  const holderRef = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const room = useRoomTwin((s) => s.room);
  const surface = useRoomTwin((s) => s.surface);
  const placedItems = useRoomTwin((s) => s.placedItems);

  // ⭐ Ref เก็บ room ก่อนหน้า เพื่อตรวจการเปลี่ยนแปลง
  const prevRoomRef = useRef<{
    w: number;
    d: number;
    h: number;
    shape: string;
  } | null>(null);

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

  // ===== 2. Rebuild + Capture/Restore openings =====
  useEffect(() => {
    if (!sceneReady) return;

    const prev = prevRoomRef.current;
    const curr = { w: room.w, d: room.d, h: room.h, shape: room.shape };

    // ตรวจว่ามีการเปลี่ยนหรือไม่
    let capture = false;
    if (prev) {
      const sizeChanged =
        Math.abs(prev.w - curr.w) > 0.01 ||
        Math.abs(prev.d - curr.d) > 0.01 ||
        Math.abs(prev.h - curr.h) > 0.01;
      const shapeChanged = prev.shape !== curr.shape;
      if (sizeChanged || shapeChanged) capture = true;
    }

    // ⭐ Capture snapshot ก่อน
    let snapshots: ReturnType<typeof captureOpeningsRelative> = [];
    if (capture) {
      snapshots = captureOpeningsRelative();
    }

    // ⭐ Rebuild shell
    console.log(
      "[Canvas3D] Effect 2: rebuild shell",
      prev ? "(changed)" : "(init)",
    );
    rebuildRoomShell();

    // ⭐ Restore openings หลัง rebuild
    if (snapshots.length > 0) {
      restoreOpeningsRelative(snapshots);
    }

    prevRoomRef.current = curr;
  }, [
    sceneReady,
    room.shape,
    room.w,
    room.d,
    room.h,
    room.blocks?.size,
    // ⭐ Detect cellLevels change by size + JSON-stringified check
    Object.keys(room.cellLevels || {}).length,
    JSON.stringify(room.cellLevels),
  ]);

  // ===== 3. Seed (กรณีไม่มีเลย) =====
  useEffect(() => {
    if (!sceneReady) return;
    const r = useRoomTwin.getState().room;
    if (r.shape === "rect" || r.shape === "blocks") {
      ensureDefaultOpenings();
    }
  }, [sceneReady, room.shape, room.blocks?.size]);

  // ===== 4. Reclamp =====
  useEffect(() => {
    if (!sceneReady) return;
    reclampAllToRoom();
  }, [
    sceneReady,
    room.shape,
    room.w,
    room.d,
    room.h,
    room.blocks?.size,
    // ⭐ Detect cellLevels change by size + JSON-stringified check
    Object.keys(room.cellLevels || {}).length,
    JSON.stringify(room.cellLevels),
  ]);

  // ===== 5. Instantiate =====
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
      rebuildBaseboards();
    }
  }, [sceneReady, placedItems.length]);

  // ===== 6. Surface =====
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

  // ===== 7. Sync transforms (เฉพาะ floor/ceiling) =====
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
