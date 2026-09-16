// components/sidebar/RoomTree.tsx
"use client";
import { useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { getProductIcon } from "@/lib/data/icons";
import { getProductThumbnail } from "@/lib/three/thumbnails";
import { getZoneBounds } from "@/lib/three/zoneBounds";
import { controls } from "@/lib/three/scene";
import { flyCameraTo } from "@/lib/three/cameraFlight";
import { openConfirm, openZoneEditDialog } from "@/components/modals";
import { useSaveState } from "@/hooks/useSaveState";
import {
  removeZoneFull,
  moveItemOutOfZoneFull,
} from "@/lib/three/zoneActions";
import type { PlacedItem } from "@/lib/state/types";

// ============================================================
// Root
// ============================================================

export default function RoomTree() {
  const placedItems = useRoomTwin((s) => s.placedItems);

  if (placedItems.length === 0) {
    return (
      <div className="room-tree">
        <div className="room-tree-empty">
          ยังไม่มีของในห้อง
          <br />
          <small>
            ไปที่แท็บ &quot;🛒 สร้างห้อง&quot; แล้วลากไอเทมหรือโซนมาวางก่อน
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="room-tree">
      <RoomTreeContent />
    </div>
  );
}

// ============================================================
// Content (group by zone)
// ============================================================

function RoomTreeContent() {
  const placedItems = useRoomTwin((s) => s.placedItems);
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);

  // group items
  const groups = new Map<string, PlacedItem[]>();
  const standalone: PlacedItem[] = [];

  placedItems.forEach((it) => {
    if (it.zoneUid) {
      if (!groups.has(it.zoneUid)) groups.set(it.zoneUid, []);
      groups.get(it.zoneUid)!.push(it);
    } else {
      standalone.push(it);
    }
  });

  return (
    <>
      {Array.from(groups.entries()).map(([zuid, items]) => {
        const meta = zoneMeta.get(zuid) || {};
        return (
          <ZoneGroup
            key={zuid}
            zuid={zuid}
            items={items}
            meta={meta}
          />
        );
      })}

      {standalone.length > 0 && <StandaloneGroup items={standalone} />}
    </>
  );
}

// ============================================================
// Zone group
// ============================================================

function ZoneGroup({
  zuid,
  items,
  meta,
}: {
  zuid: string;
  items: PlacedItem[];
  meta: any;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selectZone = useRoomTwin((s) => s.selectZone);
  const { saveState } = useSaveState();

  const zoneName = meta.name || "โซน";
  const zoneIcon = meta.icon || "📦";
  const zoneColor = meta.color !== undefined ? meta.color : 0xb8752e;
  const hasTheme = !!meta.themeId;

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectZone(zuid);
    const b = getZoneBounds(zuid);
    if (!b) return;
    flyCameraTo(b.cx + 2.4, 2.4, b.cz + 3.2, 1.1);
    setTimeout(() => {
      if (controls) controls.target.set(b.cx, 1.0, b.cz);
    }, 700);
  };

  const handleTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectZone(zuid);
    window.dispatchEvent(new CustomEvent("roomtwin:openZoneTheme"));
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    openZoneEditDialog(zuid);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    openConfirm(
      `ลบทั้งโซน "${zoneName}" (${items.length} ชิ้น)?`,
      () => {
        removeZoneFull(zuid);
        saveState();
      },
    );
  };

  return (
    <div
      className={`tree-group${collapsed ? " collapsed" : ""}`}
      data-zone-uid={zuid}
    >
      <div
        className="tree-group-head"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest(".tree-action-btn")) return;
          if (
            (e.target as HTMLElement).closest(".chevron") ||
            (e.target as HTMLElement).closest(".group-count")
          ) {
            setCollapsed((c) => !c);
          } else {
            selectZone(zuid);
            setCollapsed(false);
          }
        }}
      >
        <span className="chevron">▼</span>
        <span
          className="group-icon"
          style={{
            background: hexAlpha(zoneColor, 0.13),
            borderColor: hexAlpha(zoneColor, 0.35),
          }}
        >
          {zoneIcon}
        </span>
        <span className="group-name">{zoneName}</span>

        {hasTheme && (
          <span
            style={{ fontSize: 10, color: "var(--ink-soft)" }}
            title="ใช้ธีมอยู่"
          >
            ✨
          </span>
        )}

        <span className="group-count">{items.length}</span>

        <span className="group-actions">
          <button
            type="button"
            className="tree-action-btn"
            data-act="focus"
            title="โฟกัสโซน"
            onClick={handleFocus}
          >
            ◎
          </button>
          <button
            type="button"
            className="tree-action-btn"
            data-act="theme"
            title="เลือกธีม"
            onClick={handleTheme}
          >
            ✨
          </button>
          <button
            type="button"
            className="tree-action-btn"
            data-act="edit"
            title="แก้ไขโซน"
            onClick={handleEdit}
          >
            ✏️
          </button>
          <button
            type="button"
            className="tree-action-btn danger"
            data-act="delzone"
            title="ลบทั้งโซน"
            onClick={handleDelete}
          >
            🗑
          </button>
        </span>
      </div>

      <div className="tree-items">
        {items.map((it) => (
          <TreeItem key={it.uid} item={it} inZone={true} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Standalone group
// ============================================================

function StandaloneGroup({ items }: { items: PlacedItem[] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`tree-group${collapsed ? " collapsed" : ""}`}
      data-standalone="1"
    >
      <div
        className="tree-group-head"
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest(".chevron") ||
            (e.target as HTMLElement).closest(".group-count")
          ) {
            setCollapsed((c) => !c);
          }
        }}
      >
        <span className="chevron">▼</span>
        <span
          className="group-icon"
          style={{ background: "#a39a8922", borderColor: "#a39a8955" }}
        >
          📌
        </span>
        <span className="group-name">ของลอย (ไม่มีโซน)</span>
        <span className="group-count">{items.length}</span>
        <span className="group-actions" />
      </div>

      <div className="tree-items">
        {items.map((it) => (
          <TreeItem key={it.uid} item={it} inZone={false} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Item row
// ============================================================

function TreeItem({
  item,
  inZone,
}: {
  item: PlacedItem;
  inZone: boolean;
}) {
  const selectedUid = useRoomTwin((s) => s.selectedUid);
  const selectItem = useRoomTwin((s) => s.selectItem);
  const removeItem = useRoomTwin((s) => s.removeItem);
  const { saveState } = useSaveState();

  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return null;

  const displayName = item.displayName || product.name;
  const selected = selectedUid === item.uid;

  return (
    <div
      className={`tree-item${selected ? " selected" : ""}`}
      data-uid={item.uid}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".tree-action-btn")) return;
        selectItem(item.uid);
      }}
    >
      <span className="item-icon">
        <ThumbIcon productId={item.productId} />
      </span>

      <span className="item-name">{displayName}</span>

      <span className="item-actions">
        {inZone && (
          <button
            type="button"
            className="tree-action-btn"
            data-act="unzone"
            title="ย้ายออกจากโซน"
            onClick={(e) => {
              e.stopPropagation();
              moveItemOutOfZoneFull(item.uid);
              saveState();
            }}
          >
            ↗
          </button>
        )}

        <button
          type="button"
          className="tree-action-btn danger"
          data-act="del"
          title="ลบ"
          onClick={(e) => {
            e.stopPropagation();
            openConfirm(`ลบ "${displayName}" ออกจากห้อง?`, () => {
              removeItem(item.uid);
              saveState();
            });
          }}
        >
          🗑
        </button>
      </span>
    </div>
  );
}

// ============================================================
// Thumbnail (lazy)
// ============================================================

function ThumbIcon({ productId }: { productId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      const u = getProductThumbnail(productId);
      if (!cancelled) setUrl(u);
    };

    if (typeof (window as any).requestIdleCallback !== "undefined") {
      (window as any).requestIdleCallback(run, { timeout: 1200 });
    } else {
      setTimeout(run, 200);
    }

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (url) return <img src={url} alt="" />;

  const p = PRODUCT_BY_ID.get(productId);
  return (
    <span className="icon-fallback">
      {p ? getProductIcon(p) : "📦"}
    </span>
  );
}

// ============================================================
// Utils
// ============================================================

function hexAlpha(color: number, alpha: number): string {
  const hex = (color >>> 0).toString(16).padStart(6, "0");
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${a}`;
}