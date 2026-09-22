// components/viewport/Overlays.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRoomTwin } from "@/lib/state/store";
import { getWallStatusText } from "@/lib/three/roomShell";
import {
  saveShowAllWallsPref,
  saveMeasurePref,
  saveLightingPref,
} from "@/lib/state/storage";
import {
  LIGHTING_MODES,
  LIGHTING_MODE_LABELS,
  LIGHTING_MODE_TITLES,
  type LightingMode,
} from "@/lib/data/lighting";
import { objectsByUid, camera, renderer, roomGroup } from "@/lib/three/scene";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { useSaveState } from "@/hooks/useSaveState";
import { openConfirm, openSaveShareDialog } from "@/components/modals";
import ThemeToggle from "../ThemeToggle";

/* ⭐ Theme — persist + sync <html data-theme> */
const THEME_KEY = "roomtwin_theme";
type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function Overlays() {
  const placingProductId = useRoomTwin((s) => s.placingProductId);
  const placingZoneId = useRoomTwin((s) => s.placingZoneId);
  const cancelPlacing = useRoomTwin((s) => s.cancelPlacing);
  const showLockBadges = useRoomTwin((s) => s.showLockBadges);
  const toggleLockBadges = useRoomTwin((s) => s.toggleLockBadges);
  const showAllWalls = useRoomTwin((s) => s.showAllWalls);
  const toggleAllWalls = useRoomTwin((s) => s.toggleAllWalls);
  const showMeasure = useRoomTwin((s) => s.showMeasure);
  const toggleMeasure = useRoomTwin((s) => s.toggleMeasure);
  const lightingMode = useRoomTwin((s) => s.lightingMode);
  const setLightingMode = useRoomTwin((s) => s.setLightingMode);
  const lampsOn = useRoomTwin((s) => s.lampsOn);
  const toggleLamps = useRoomTwin((s) => s.toggleLamps);

  /* ⭐ Toolbar (ย้ายมาจาก Header) */
  const history = useRoomTwin((s) => s.history);
  const historyIndex = useRoomTwin((s) => s.historyIndex);
  const { saveState } = useSaveState();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  /* ⭐ Theme — state + sync ตอน mount + sync 3D lighting */
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = readInitialTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;

    /* ⭐ sync 3D lighting ตาม theme ตอนบูต
     - dark → night
     - light → day
     (เฉพาะกรณีที่ lightingMode เป็นค่า default "day" อยู่
      เพื่อไม่ให้ทับ pref ที่ user ตั้งไว้เอง) */
    const s = useRoomTwin.getState();
    const wantNight = initial === "dark";
    if (wantNight && s.lightingMode === "day") {
      setLightingMode("night");
      saveLightingPref({ mode: "night", lampsOn: s.lampsOn });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}

    /* ⭐ sync 3D lighting ตาม theme
     - เข้า dark → ตั้ง lightingMode = "night" (3D จะเป็นกลางคืน มืดๆ อบอุ่น)
     - ออก dark → ตั้ง lightingMode = "day"   (3D จะเป็นกลางวัน สว่าง) */
    const nextLighting: LightingMode = next === "dark" ? "night" : "day";
    setLightingMode(nextLighting);

    // ⭐ persist lighting pref ให้สอดคล้องกัน
    const s = useRoomTwin.getState();
    saveLightingPref({ mode: nextLighting, lampsOn: s.lampsOn });
  };

  const [wallStatus, setWallStatus] = useState("");
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({
    msg: "",
    show: false,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setWallStatus(getWallStatusText());
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail?.msg || "";
      setToast({ msg, show: true });
      setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
    };
    window.addEventListener("roomtwin:toast", onToast);
    return () => window.removeEventListener("roomtwin:toast", onToast);
  }, []);

  const showHint = !!placingProductId || !!placingZoneId;

  const handleToggleAllWalls = () => {
    const next = !showAllWalls;
    toggleAllWalls();
    saveShowAllWallsPref(next);
  };

  const handleToggleMeasure = () => {
    const next = !showMeasure;
    toggleMeasure();
    saveMeasurePref(next);
  };

  const persistLighting = () => {
    const s = useRoomTwin.getState();
    saveLightingPref({ mode: s.lightingMode, lampsOn: s.lampsOn });
  };

  const handleSetLightingMode = (m: LightingMode) => {
    setLightingMode(m);
    persistLighting();
  };

  const handleToggleLamps = () => {
    toggleLamps();
    persistLighting();
  };

  /* ⭐ Handlers — ย้ายมาจาก Header */

  const handleUndo = () => {
    const store = useRoomTwin.getState();
    const snapshot = store.undo();
    if (snapshot) {
      window.dispatchEvent(
        new CustomEvent("roomtwin:restore", { detail: snapshot }),
      );
    }
  };

  const handleRedo = () => {
    const store = useRoomTwin.getState();
    const snapshot = store.redo();
    if (snapshot) {
      window.dispatchEvent(
        new CustomEvent("roomtwin:restore", { detail: snapshot }),
      );
    }
  };

  const handleReset = () => {
    openConfirm(
      "ลบเฟอร์นิเจอร์และของแต่งทั้งหมดออก? " +
        "(ขนาดห้อง สี และประตู/หน้าต่างจะคงอยู่)",
      async () => {
        const store = useRoomTwin.getState();

        const openings: typeof store.placedItems = [];
        const toRemove: typeof store.placedItems = [];

        store.placedItems.forEach((item) => {
          if (item.productId === "door" || item.productId === "window") {
            openings.push(item);
          } else {
            toRemove.push(item);
          }
        });

        toRemove.forEach((item) => {
          const obj = objectsByUid.get(item.uid);
          if (obj) {
            roomGroup.remove(obj);
            obj.traverse((child: any) => {
              child.geometry?.dispose?.();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m: any) => m?.dispose?.());
                } else {
                  child.material.dispose?.();
                }
              }
            });
          }
          objectsByUid.delete(item.uid);
        });

        const keptRoom = store.room;
        const keptSurface = store.surface;

        store.resetAll();

        useRoomTwin.setState({
          room: keptRoom,
          surface: keptSurface,
          placedItems: openings,
        });

        await new Promise((r) => setTimeout(r, 0));

        const {
          rebuildRoomShell,
          applySurface: apply,
          rebuildBaseboards,
        } = await import("@/lib/three/roomShell");
        rebuildRoomShell();
        apply();

        const { instantiate } = await import("@/lib/three/instantiate");
        const { objectsByUid: objMap } = await import("@/lib/three/scene");

        openings.forEach((item) => {
          if (!objMap.has(item.uid)) {
            instantiate(item);
          }
        });

        rebuildBaseboards();
        saveState();
      },
    );
  };

  const handleSave = () => {
    openSaveShareDialog();
  };

  let hintText = "";
  if (placingZoneId) hintText = "แตะจุดบนพื้นเพื่อวางโซนนี้";
  else if (placingProductId) {
    const p = PRODUCT_BY_ID.get(placingProductId);
    if (p?.wallMount) {
      hintText = p.attachToSurface
        ? "แตะบนผนัง/เสา/ฉากกั้น/ประตู/หน้าต่างเพื่อแขวนไอเทมนี้"
        : "แตะบนผนังเพื่อติดไอเทมนี้";
    } else if (p?.ceilingMount) hintText = "แตะจุดบนเพดานเพื่อแขวนไอเทมนี้";
    else hintText = "แตะจุดในห้องเพื่อวางไอเทมนี้";
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
    ⭐ Viewport Toolbar
    - ซ้ายบน: undo / redo / reset
    - ขวาบน: theme / save
    ═══════════════════════════════════════════════════════ */}

      <div className="viewport-toolbar viewport-toolbar-left">
        <button
          type="button"
          className="vpt-btn vpt-btn-reset"
          onClick={handleReset}
          title="ลบเฟอร์นิเจอร์และของแต่งทั้งหมดออก"
        >
          🔄 <span className="vpt-btn-label">รีเซ็ต</span>
        </button>
        <button
          type="button"
          className="vpt-btn"
          title="ย้อนกลับ (Ctrl+Z)"
          disabled={!canUndo}
          onClick={handleUndo}
          aria-label="ย้อนกลับ"
        >
          ↩
        </button>
        <button
          type="button"
          className="vpt-btn"
          title="ทำซ้ำ (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={handleRedo}
          aria-label="ทำซ้ำ"
        >
          ↪
        </button>
        
      </div>

      <div className="viewport-toolbar viewport-toolbar-right">
        {/* ⭐ ปุ่ม toggle dark mode */}
        <ThemeToggle/>

        {/* ⭐ ปุ่ม save */}
        <button
          type="button"
          className="vpt-btn vpt-btn-save"
          onClick={handleSave}
          title="บันทึก / แชร์ลิงก์"
        >
          💾 <span className="vpt-btn-label">บันทึก</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          🕐 ของเดิม — comment ไว้ทั้งหมด รอ redesign ทีหลัง
          ═══════════════════════════════════════════════════════
      {showHint && (
        <div className="floating-hint show" id="placeHint">
          {hintText}
        </div>
      )}

      {showHint && (
        <button
          type="button"
          className="cancel-place show"
          id="cancelPlace"
          onClick={cancelPlacing}
        >
          ยกเลิกการวาง ✕
        </button>
      )}

      <button
        type="button"
        className={`lock-toggle-btn${showLockBadges ? "" : " off"}`}
        id="lockToggleBtn"
        title={showLockBadges ? "ซ่อนไอคอนกุญแจ" : "แสดงไอคอนกุญแจ"}
        onClick={toggleLockBadges}
      >
        🔒
      </button>

      <div className="wall-status" id="wallStatus">
        {wallStatus}
      </div>

      <button
        type="button"
        className={`wall-all-toggle${showAllWalls ? " active" : ""}`}
        id="wallAllToggle"
        title={
          showAllWalls
            ? "ปิด: กลับไปซ่อนผนังที่บังกล้องอัตโนมัติ"
            : "เปิด: แสดงผนังทุกด้านพร้อมกัน (ปิดการซ่อนผนังที่บังกล้อง)"
        }
        aria-pressed={showAllWalls}
        onClick={handleToggleAllWalls}
      >
        🧱 ผนังรอบด้าน
      </button>

      <button
        type="button"
        className={`measure-toggle${showMeasure ? " active" : ""}`}
        id="measureToggle"
        title={
          showMeasure
            ? "ปิด: ซ่อนไม้บรรทัดห้องและเส้นไกด์"
            : "เปิด: แสดงไม้บรรทัดวัดขนาดห้อง + ตีเส้นไกด์ระยะจากผนังตอนลาก object"
        }
        aria-pressed={showMeasure}
        onClick={handleToggleMeasure}
      >
        📏 วัดขนาด
      </button>

      <div className="lighting-control" id="lightingControl">
        {LIGHTING_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`lo-btn${lightingMode === m ? " active" : ""}`}
            title={LIGHTING_MODE_TITLES[m]}
            aria-pressed={lightingMode === m}
            onClick={() => handleSetLightingMode(m)}
          >
            {LIGHTING_MODE_LABELS[m]}
          </button>
        ))}
        <span className="lo-sep" />
        <button
          type="button"
          className={`lo-btn${lampsOn ? " active" : ""}`}
          id="lampsToggle"
          title={
            lampsOn
              ? "ปิดไฟทุกดวงในห้อง (โคมที่ปิดไว้ยังคงปิด)"
              : "เปิดไฟทุกดวงในห้อง"
          }
          aria-pressed={lampsOn}
          onClick={handleToggleLamps}
        >
          💡 ไฟ
        </button>
      </div>

      {showLockBadges && <LockBadges />}

      {toast.show && (
        <div
          className="placement-toast show"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 26,
            transform: "translateX(-50%)",
            maxWidth: "min(86%, 420px)",
            background: "var(--danger)",
            color: "#fff",
            fontSize: 12.5,
            lineHeight: 1.45,
            padding: "10px 16px",
            borderRadius: 12,
            boxShadow: "0 6px 18px rgba(42, 35, 48, 0.22)",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          ⚠️ {toast.msg}
        </div>
      )}
      */}
    </>
  );
}

// ============================================================
// LockBadges — คงไว้เหมือนเดิม
// ============================================================

function LockBadges() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const els = new Map<string, HTMLElement>();

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const ndc = new THREE.Vector3();

    let raf = 0;
    const tick = () => {
      const rect = renderer.domElement.getBoundingClientRect();
      const { placedItems } = useRoomTwin.getState();
      const seen = new Set<string>();

      placedItems.forEach((item) => {
        if (!item.locked) return;

        const obj = objectsByUid.get(item.uid);
        if (!obj || obj.visible === false) return;

        let p: THREE.Object3D | null = obj.parent;
        let hidden = false;
        while (p) {
          if (!p.visible) {
            hidden = true;
            break;
          }
          p = p.parent;
        }
        if (hidden) return;

        obj.updateMatrixWorld(true);
        box.makeEmpty();
        obj.traverse((child: any) => {
          if (!child.isMesh) return;
          if (child.visible === false) return;
          const mat = child.material as any;
          if (mat?.transparent && (mat.opacity ?? 1) < 0.05) return;
          const b = new THREE.Box3().setFromObject(child);
          if (isFinite(b.min.x)) box.union(b);
        });
        if (box.isEmpty()) return;

        seen.add(item.uid);

        box.getCenter(center);
        ndc.copy(center).project(camera);

        if (Math.abs(ndc.x) > 1 || ndc.y > 1 || ndc.z > 1) {
          const el = els.get(item.uid);
          if (el) el.style.display = "none";
          return;
        }

        const MARGIN = 18;
        const sx = Math.min(
          rect.width - MARGIN,
          Math.max(MARGIN, (ndc.x * 0.5 + 0.5) * rect.width),
        );
        const sy = Math.min(
          rect.height - MARGIN,
          Math.max(MARGIN, (-ndc.y * 0.5 + 0.5) * rect.height),
        );

        let el = els.get(item.uid);
        if (!el) {
          el = document.createElement("div");
          el.className = "lock-badge";
          el.textContent = "🔒";
          container.appendChild(el);
          els.set(item.uid, el);
        }

        el.style.display = "flex";
        el.style.left = sx + "px";
        el.style.top = sy + "px";
      });

      els.forEach((el, uid) => {
        if (!seen.has(uid)) {
          el.remove();
          els.delete(uid);
        }
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      els.forEach((el) => el.remove());
      els.clear();
    };
  }, []);

  return <div className="lock-badges" id="lockBadges" ref={containerRef} />;
}
