// components/sidebar/RoomTree.tsx
"use client";
import { useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { deleteItemTree } from "@/lib/three/itemTree";
import { rebuildBaseboards } from "@/lib/three/roomShell";
import { getZoneBounds } from "@/lib/three/zoneBounds";
import { resolveZoneDisplay } from "@/lib/data/zoneResolve";
import { flyCameraTo } from "@/lib/three/cameraFlight";
import { openConfirm, openZoneEditDialog } from "@/components/modals";
import { useSaveState } from "@/hooks/useSaveState";
import { useTreeItemDrag } from "@/hooks/useTreeItemDrag";
import ThumbIcon from "./ThumbIcon";
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
        return <ZoneGroup key={zuid} zuid={zuid} items={items} />;
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
}: {
  zuid: string;
  items: PlacedItem[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selectZone = useRoomTwin((s) => s.selectZone);
  // ⭐ subscribe zoneMeta เพื่อ re-render เมื่อ user แก้ชื่อ/ไอคอน/สี
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);
  const { saveState } = useSaveState();

  // ⭐ name/icon/color มาจาก definition + override ผ่าน resolver กลางเท่านั้น
  const display = resolveZoneDisplay(zuid, { placedItems: items, zoneMeta });
  const zoneName = display.name;
  const zoneIcon = display.icon;
  const zoneColor = display.color;
  const hasTheme = !!zoneMeta.get(zuid)?.themeId;

  // ⭐ ขยายกลุ่มเมื่อ item ถูกลากมาวางในโซนนี้ (จาก useTreeItemDrag)
  useEffect(() => {
    const onExpand = (e: Event) => {
      const detail = (e as CustomEvent<{ zuid?: string }>).detail;
      if (detail?.zuid === zuid) setCollapsed(false);
    };
    window.addEventListener("roomtwin:treeExpandZone", onExpand);
    return () =>
      window.removeEventListener("roomtwin:treeExpandZone", onExpand);
  }, [zuid]);

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectZone(zuid);
    const b = getZoneBounds(zuid);
    if (!b) return;
    // ⭐ โฟกัสตรงจุดกึ่งกลางโซน — target วิ่งเข้าใกล้โซนพร้อม camera (กัน snap ตอนจบ flight)
    flyCameraTo(b.cx + 2.4, 2.4, b.cz + 3.2, b.cx, 1.0, b.cz);
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
      style={{ "--zc": hexAlpha(zoneColor, 1) } as React.CSSProperties}
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
        <span className="group-icon">{zoneIcon}</span>
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
      style={{ "--zc": "#A39A89" } as React.CSSProperties}
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
        <span className="group-icon">📌</span>
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
  const { saveState } = useSaveState();
  const { startDrag } = useTreeItemDrag();

  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return null;

  const displayName = item.displayName || product.name;
  const selected = selectedUid === item.uid;

  return (
    <div
      className={`tree-item${selected ? " selected" : ""}`}
      data-uid={item.uid}
      onPointerDown={(e) =>
        // ⭐ ลาก = ย้ายโซน/จัดลำดับ, tap = select (จัดการบน pointerup ใน hook)
        startDrag(e, item.uid, e.currentTarget, () => selectItem(item.uid))
      }
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
              const wasDoor = item.productId === "door";
              // ⭐ ลบ item + ของที่แขวนอยู่กับพื้ นผิวของมัน (3D + state)
              deleteItemTree(item.uid);
              if (wasDoor) rebuildBaseboards();
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
// Utils
// ============================================================

function hexAlpha(color: number, alpha: number): string {
  const hex = (color >>> 0).toString(16).padStart(6, "0");
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${a}`;
}