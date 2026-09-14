// components/panels/ZoneThemePanel.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { ZONE_THEMES, THEME_BY_ID } from "@/lib/data/themes";
import { hexOf } from "@/lib/utils/format";
import { reinstantiateItem } from "@/lib/three/instantiate";
import { applyThemeToItem } from "@/lib/three/themeApply";
import { resolveRestHeights } from "@/lib/three/placement";
import { useSaveState } from "@/hooks/useSaveState";

interface ZoneMetaLocal {
  name: string;
  icon: string;
  color: number;
}

function getZoneMeta(zuid: string): ZoneMetaLocal {
  const { zoneMeta, placedItems } = useRoomTwin.getState();
  const ov = zoneMeta.get(zuid) || {};
  const any = placedItems.find((i) => i.zoneUid === zuid);
  return {
    name: ov.name || "โซน",
    icon: ov.icon || "📦",
    color: ov.color !== undefined ? ov.color : 0xb8752e,
  };
}

// ============================================================
// Theme Apply / Reset
// ============================================================

function applyThemeToZone(zuid: string, themeId: string) {
  const store = useRoomTwin.getState();
  const items = store.placedItems.filter((i) => i.zoneUid === zuid);
  if (items.length === 0) return;

  const existing = store.zoneMeta.get(zuid) || {};

  if (!existing.themeBaseline) {
    const bl: Record<string, { params: any; displayName: string | null }> = {};
    items.forEach((it) => {
      bl[it.uid] = {
        params: JSON.parse(JSON.stringify(it.params)),
        displayName: it.displayName || null,
      };
    });
    store.setZoneMeta(zuid, { themeBaseline: bl });
  }

  const theme = THEME_BY_ID.get(themeId);
  if (!theme) return;

  items.forEach((it) => {
    const cloned = { ...it, params: { ...it.params } };
    applyThemeToItem(cloned, themeId);
    store.updateItem(it.uid, {
      params: cloned.params,
      themeOverride: cloned.themeOverride,
      displayName: cloned.displayName,
    });
    reinstantiateItem(it.uid);
  });

  store.setZoneMeta(zuid, { themeId });
  resolveRestHeights();
}

function resetZoneTheme(zuid: string) {
  const store = useRoomTwin.getState();
  const meta = store.zoneMeta.get(zuid);
  if (!meta || !meta.themeBaseline) return;

  Object.entries(meta.themeBaseline).forEach(([uid, snap]) => {
    const item = store.placedItems.find((i) => i.uid === uid);
    if (!item) return;
    store.updateItem(uid, {
      params: JSON.parse(JSON.stringify(snap.params)),
      themeOverride: undefined,
      displayName: snap.displayName || null,
    });
    reinstantiateItem(uid);
  });

  store.setZoneMeta(zuid, { themeId: undefined });
  resolveRestHeights();
}

// ============================================================
// Panel
// ============================================================

export default function ZoneThemePanel() {
  const selectedZoneUid = useRoomTwin((s) => s.selectedZoneUid);
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);
  const deselectZone = useRoomTwin((s) => s.deselectZone);
  const { saveState } = useSaveState();

  const [open, setOpen] = useState(false);

  // ⭐ useRef แทน state — ไม่ trigger re-render
  const openedForRef = useRef<string | null>(null);

  // ⭐ ปิด panel (ผู้ใช้กด ✕)
  const close = useCallback(() => {
    setOpen(false);
    // ⚠️ ไม่ reset openedForRef → ป้องกัน effect loop
    // ⚠️ ไม่ deselect zone → ผู้ใช้ยังเลือกโซนอยู่ได้
  }, []);

  // ⭐⭐⭐ Auto-open เมื่อ selectedZoneUid เปลี่ยน
  //        + Auto-close เมื่อ selectedZoneUid = null
  useEffect(() => {
    if (!selectedZoneUid) {
      // Zone ถูก deselect → ปิด panel
      setOpen(false);
      openedForRef.current = null;
      return;
    }

    // Zone ใหม่ (ไม่ใช่โซนเดิมที่เคยเปิด) → เปิด
    if (openedForRef.current !== selectedZoneUid) {
      openedForRef.current = selectedZoneUid;
      setOpen(true);
    }
  }, [selectedZoneUid]);

  // Escape key → close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Custom events
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener("roomtwin:openZoneTheme", onOpen);
    window.addEventListener("roomtwin:closeZoneTheme", onClose);
    return () => {
      window.removeEventListener("roomtwin:openZoneTheme", onOpen);
      window.removeEventListener("roomtwin:closeZoneTheme", onClose);
    };
  }, []);

  if (!selectedZoneUid) return null;

  const meta = getZoneMeta(selectedZoneUid);
  const currentMeta = zoneMeta.get(selectedZoneUid) || {};
  const current = currentMeta.themeId || null;
  const showReset = !!(currentMeta.themeBaseline || current);

  return (
    <>
      {/* ⭐⭐⭐ ไม่มี backdrop แล้ว — ไม่มีอะไรมาปิด panel เวลาคลิกนอก */}

      <aside
        className={`zone-theme-panel${open ? " show" : ""}`}
        aria-hidden={!open}
      >
        <div className="ztp-head">
          <div className="ztp-title">
            ✨ ธีมสำหรับ{" "}
            <span>
              "{meta.icon} {meta.name}"
            </span>
          </div>
          {showReset && (
            <button
              type="button"
              className="ztp-reset"
              onClick={() => {
                resetZoneTheme(selectedZoneUid);
                saveState();
              }}
            >
              ↺ คืนค่าเดิม
            </button>
          )}
          <button
            type="button"
            className="ztp-close"
            onClick={close}
            title="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="ztp-themes">
          {ZONE_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`ztp-card${current === theme.id ? " active" : ""}`}
              onClick={() => {
                applyThemeToZone(selectedZoneUid, theme.id);
                saveState();
              }}
            >
              <div
                className="ztp-swatch"
                style={
                  {
                    "--c1": hexOf(theme.swatch[0]),
                    "--c2": hexOf(theme.swatch[1]),
                    "--c3": hexOf(theme.swatch[2]),
                    "--c4": hexOf(theme.swatch[3]),
                  } as React.CSSProperties
                }
              >
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="ztp-card-name">{theme.name}</div>
              <div className="ztp-card-desc">{theme.desc}</div>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}