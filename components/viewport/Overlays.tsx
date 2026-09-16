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
import { objectsByUid, camera, renderer } from "@/lib/three/scene";
import { PRODUCT_BY_ID } from "@/lib/data/products";

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

  // ⭐ สลับโหมด "ผนังรอบด้าน" + persist view preference
  const handleToggleAllWalls = () => {
    const next = !showAllWalls;
    toggleAllWalls();
    saveShowAllWallsPref(next);
  };

  // ⭐ สลับโหมด "วัดขนาด" + persist view preference
  const handleToggleMeasure = () => {
    const next = !showMeasure;
    toggleMeasure();
    saveMeasurePref(next);
  };

  // ⭐ โหมดแสง (วัน/เย็น/คืน) + สวิตช์ไฟโคม — persist แยก key
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

  let hintText = "";
  if (placingZoneId) hintText = "แตะจุดบนพื้นเพื่อวางโซนนี้";
  else if (placingProductId) {
    const p = PRODUCT_BY_ID.get(placingProductId);
    if (p?.wallMount) {
      hintText = p.attachToSurface
        ? "แตะบนผนัง/เสา/ฉากกั้น/ประตู/หน้าต่างเพื่อแขวนไอเทมนี้"
        : "แตะบนผนังเพื่อติดไอเทมนี้";
    } else if (p?.ceilingMount)
      hintText = "แตะจุดบนเพดานเพื่อแขวนไอเทมนี้";
    else hintText = "แตะจุดในห้องเพื่อวางไอเทมนี้";
  }

  return (
    <>
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

      {/* ⭐ โหมดแสงในฉาก + สวิตช์ไฟโคม — อยู่ใต้ปุ่มวัดขนาด */}
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
      {/* ⭐ ลบ scaleBadge ออก */}
    </>
  );
}

// ============================================================
// LockBadges — centered on object
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

        // Skip if hidden by parent (e.g., faded wall)
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

        // ⭐ Center of bounding box
        box.getCenter(center);
        ndc.copy(center).project(camera);

        // ⭐ Hide object behind/off the frustum edge
        if (Math.abs(ndc.x) > 1 || ndc.y > 1 || ndc.z > 1) {
          const el = els.get(item.uid);
          if (el) el.style.display = "none";
          return;
        }

        // ⭐ Clamp — badge (30px) อยู่ภายใน viewport เสมอ ไม่ล้นไปทับ sidebar/ขอบจอ
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