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
import { resolveRestHeights, bottomOffsetFor } from "@/lib/three/placement";
import { reclampAllToRoom } from "@/lib/three/reclamp";
import {
  ensureDefaultOpenings,
  captureOpeningsRelative,
  restoreOpeningsRelative,
} from "@/hooks/useRoomTwinInit";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { useRoomTwin } from "@/lib/state/store";
import { initLighting, disposeLighting } from "@/lib/three/lighting";
import { saveLightingPref } from "@/lib/state/storage";
import type { LightingMode } from "@/lib/data/lighting";

/**
 * ⭐ อ่าน theme ปัจจุบันจาก <html data-theme="...">
 * - ถ้ามี data-theme → ใช้ค่านั้น (user เลือกเอง)
 * - ถ้าไม่มี        → ตาม system preference
 */
function readThemeFromDom(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

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
    initLighting();
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
      disposeLighting();
      disposeScene();
      setSceneReady(false);
    };
  }, []);

  // ============================================================
  // ⭐ 1.5 Theme → 3D lighting sync (single source of truth)
  //   - เฝ้า <html data-theme="dark|light"> ด้วย MutationObserver
  //   - dark  → lightingMode = "night"  (แสงมืด + เปิดไฟโคม)
  //   - light → lightingMode = "day"    (แสงสว่าง)
  //   - sync ครั้งแรกตอน mount ด้วย (รองรับ restore จาก localStorage
  //     + system preference + FOUC script)
  // ============================================================
  useEffect(() => {
    if (!sceneReady) return;

    const applyThemeToLighting = (fromTheme?: "light" | "dark") => {
      const t = fromTheme ?? readThemeFromDom();
      const target: LightingMode = t === "dark" ? "night" : "day";

      const s = useRoomTwin.getState();
      if (s.lightingMode !== target) {
        // ⭐ setLightingMode("night") จะเปิด lampsOn ให้อัตโนมัติ (ตาม store logic)
        s.setLightingMode(target);

        // persist lighting pref ให้ตรงกับ theme ใหม่
        const after = useRoomTwin.getState();
        saveLightingPref({ mode: after.lightingMode, lampsOn: after.lampsOn });
      }
    };

    // ─── sync ครั้งแรก ───
    applyThemeToLighting();

    // ─── เฝ้า attribute changes ───
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          const t = document.documentElement.dataset.theme as
            | "light"
            | "dark"
            | undefined;
          if (t === "light" || t === "dark") {
            applyThemeToLighting(t);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // ─── เฝ้า system preference ตอน user ยังไม่ได้เลือก theme ───
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!document.documentElement.dataset.theme) {
        applyThemeToLighting();
      }
    };
    mql.addEventListener("change", onSystemChange);

    return () => {
      observer.disconnect();
      mql.removeEventListener("change", onSystemChange);
    };
  }, [sceneReady]);

  // ===== 2. Rebuild + Capture/Restore openings =====
  useEffect(() => {
    if (!sceneReady) return;

    const prev = prevRoomRef.current;
    const curr = { w: room.w, d: room.d, h: room.h, shape: room.shape };

    let capture = false;
    if (prev) {
      const sizeChanged =
        Math.abs(prev.w - curr.w) > 0.01 ||
        Math.abs(prev.d - curr.d) > 0.01 ||
        Math.abs(prev.h - curr.h) > 0.01;
      const shapeChanged = prev.shape !== curr.shape;
      if (sizeChanged || shapeChanged) capture = true;
    }

    let snapshots: ReturnType<typeof captureOpeningsRelative> = [];
    if (capture) {
      snapshots = captureOpeningsRelative();
    }

    console.log(
      "[Canvas3D] Effect 2: rebuild shell",
      prev ? "(changed)" : "(init)",
    );
    rebuildRoomShell();

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
        obj.position.set(
          item.x ?? 0,
          (item.restY ?? 0) - bottomOffsetFor(item.uid),
          item.z ?? 0,
        );
        obj.rotation.y = item.rotY ?? 0;
      }
    });
  }, [sceneReady, placedItems]);

  useAnimationLoop();

  return <div id="canvas-holder" ref={holderRef} />;
}