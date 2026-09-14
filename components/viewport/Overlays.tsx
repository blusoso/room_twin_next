// components/viewport/Overlays.tsx
"use client";
import { useEffect, useState, useRef } from "react";
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

  // ===== Wall status text =====
  useEffect(() => {
    const id = setInterval(() => {
      setWallStatus(getWallStatusText());
    }, 250);
    return () => clearInterval(id);
  }, []);

  // ===== Toast event listener =====
  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail?.msg || "";
      setToast({ msg, show: true });
      setTimeout(() => {
        setToast((t) => ({ ...t, show: false }));
      }, 3200);
    };
    window.addEventListener("roomtwin:toast", onToast);
    return () => {
      window.removeEventListener("roomtwin:toast", onToast);
    };
  }, []);

  const showHint = !!placingProductId || !!placingZoneId;

  let hintText = "";
  if (placingZoneId) {
    hintText = "แตะจุดบนพื้นเพื่อวางโซนนี้";
  } else if (placingProductId) {
    const p = PRODUCT_BY_ID.get(placingProductId);
    if (p?.wallMount) hintText = "แตะบนผนังเพื่อแขวนไอเทมนี้";
    else if (p?.ceilingMount) hintText = "แตะจุดบนเพดานเพื่อแขวนไอเทมนี้";
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

      <div className="placement-toast" id="placementToast" role="alert">
        {/* ใช้ render message ตรงๆ แทนการควบคุมด้วย class */}
      </div>

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

      {/* Toast */}
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
            zIndex: 20,
            textAlign: "center",
          }}
        >
          ⚠️ {toast.msg}
        </div>
      )}
    </>
  );
}

// ============================================================
// Lock Badges
// ============================================================

function LockBadges() {
  const placedItems = useRoomTwin((s) => s.placedItems);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    const els = new Map<string, HTMLElement>();

    let raf = 0;
    const tick = () => {
      const rect = renderer.domElement.getBoundingClientRect();
      const seen = new Set<string>();

      placedItems.forEach((item) => {
        if (!item.locked) return;
        const obj = objectsByUid.get(item.uid);
        if (!obj || !obj.visible) return;

        seen.add(item.uid);
        box.setFromObject(obj);
        const anchorY = item.ceilingMount ? box.min.y : box.max.y;

        point.set(
          (box.min.x + box.max.x) / 2,
          anchorY,
          (box.min.z + box.max.z) / 2,
        );
        point.project(camera);

        let el = els.get(item.uid);
        if (point.z > 1) {
          if (el) el.style.display = "none";
          return;
        }

        if (!el) {
          el = document.createElement("div");
          el.className = "lock-badge";
          el.textContent = "🔒";
          container.appendChild(el);
          els.set(item.uid, el);
        }

        el.style.display = "block";
        el.style.left = (point.x * 0.5 + 0.5) * rect.width + "px";
        el.style.top = (point.y * 0.5 + 0.5) * rect.height - 6 + "px";
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
  }, [placedItems]);

  return <div className="lock-badges" id="lockBadges" ref={containerRef} />;
}