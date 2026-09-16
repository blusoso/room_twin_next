// components/viewport/Overlays.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRoomTwin } from "@/lib/state/store";
import { getWallStatusText } from "@/lib/three/roomShell";
import { objectsByUid, camera, renderer } from "@/lib/three/scene";
import { PRODUCT_BY_ID } from "@/lib/data/products";

export default function Overlays() {
  const placingProductId = useRoomTwin((s) => s.placingProductId);
  const placingZoneId = useRoomTwin((s) => s.placingZoneId);
  const cancelPlacing = useRoomTwin((s) => s.cancelPlacing);
  const showLockBadges = useRoomTwin((s) => s.showLockBadges);
  const toggleLockBadges = useRoomTwin((s) => s.toggleLockBadges);

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

  let hintText = "";
  if (placingZoneId) hintText = "แตะจุดบนพื้นเพื่อวางโซนนี้";
  else if (placingProductId) {
    const p = PRODUCT_BY_ID.get(placingProductId);
    if (p?.wallMount) hintText = "แตะบนผนังเพื่อแขวนไอเทมนี้";
    else if (p?.ceilingMount)
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

        if (ndc.z > 1) {
          const el = els.get(item.uid);
          if (el) el.style.display = "none";
          return;
        }

        const sx = (ndc.x * 0.5 + 0.5) * rect.width;
        const sy = (-ndc.y * 0.5 + 0.5) * rect.height;

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