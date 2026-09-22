// components/panels/ZoneThemePanel.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { ZONE_THEMES, THEME_BY_ID } from "@/lib/data/themes";
import { resolveZoneDisplay } from "@/lib/data/zoneResolve";
import { hexOf } from "@/lib/utils/format";
import { reinstantiateItem } from "@/lib/three/instantiate";
import { applyThemeToItem } from "@/lib/three/themeApply";
import { resolveRestHeights } from "@/lib/three/placement";
import { useSaveState } from "@/hooks/useSaveState";
import { Button, IconButton } from "@/components/ui";

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
  const openedForRef = useRef<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Auto-open/close ตาม selectedZoneUid
  useEffect(() => {
    if (!selectedZoneUid) {
      setOpen(false);
      openedForRef.current = null;
      return;
    }
    if (openedForRef.current !== selectedZoneUid) {
      openedForRef.current = selectedZoneUid;
      setOpen(true);
    }
  }, [selectedZoneUid]);

  // Escape
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

  const meta = resolveZoneDisplay(selectedZoneUid);
  const currentMeta = zoneMeta.get(selectedZoneUid) || {};
  const current = currentMeta.themeId || null;
  const showReset = !!(currentMeta.themeBaseline || current);

  return (
    <>
      {/* ⭐ ZoneThemePanel ไม่มี backdrop — user ต้องการให้ปิดเมื่อ deselect zone เท่านั้น */}

      <aside
        className={`zone-theme-panel${open ? " show" : ""}`}
        aria-hidden={!open}
        // ⭐ Inline styles — บังคับแม้ CSS ไม่โหลด
        style={{
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        // ⭐ inert — block ทุก interaction เมื่อปิด
        {...(!open ? { inert: "" as any } : {})}
      >
        <div className="ztp-head">
          <div className="ztp-title">
            ✨ ธีมสำหรับ{" "}
            <span>
              "{meta.icon} {meta.name}"
            </span>
          </div>
          {showReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetZoneTheme(selectedZoneUid);
                saveState();
              }}
            >
              ↺ คืนค่าเดิม
            </Button>
          )}
          <IconButton label="ปิด" size="sm" onClick={close}>
            ✕
          </IconButton>
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
