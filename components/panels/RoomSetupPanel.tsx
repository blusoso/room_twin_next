// components/panels/RoomSetupPanel.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";
import { WALL_LABEL_FULL } from "@/lib/data/constants";
import { instantiate } from "@/lib/three/instantiate";
import { deleteItemTree } from "@/lib/three/itemTree";
import { rebuildBaseboards } from "@/lib/three/roomShell";
import { resolveRestHeights } from "@/lib/three/placement";
import { openConfirm } from "@/components/modals";
import { useSaveState } from "@/hooks/useSaveState";
import type { PlacedItem } from "@/lib/state/types";
import { IconButton } from "@/components/ui";

type GroupId = "walls" | "doors" | "windows" | "columns" | "partitions";

interface SetupGroup {
  id: GroupId;
  label: string;
  icon: string;
  items: SetupItem[];
  addable?: boolean;
}

interface SetupItem {
  uid: string;
  label: string;
  sublabel?: string;
  item?: PlacedItem;
  isWall?: boolean;
  wallId?: string;
}

export default function RoomSetupPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>({
    walls: true,
    doors: true,
    windows: true,
    columns: true,
    partitions: true,
  });

  const room = useRoomTwin((s) => s.room);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const selectedUid = useRoomTwin((s) => s.selectedUid);
  const selectItem = useRoomTwin((s) => s.selectItem);
  const { saveState } = useSaveState();

  // ============================================================
  // Group items
  // ============================================================
  const groups: SetupGroup[] = useMemo(() => {
    const doors = placedItems.filter(
      (i) => i.wallMount && i.productId === "door",
    );
    const windows = placedItems.filter(
      (i) => i.wallMount && i.productId === "window",
    );
    const columns = placedItems.filter((i) => i.productId === "column");
    const partitions = placedItems.filter((i) => i.productId === "partition");

    const walls: SetupItem[] = [];
    if (room.shape === "rect") {
      (["back", "front", "side", "right"] as const).forEach((id) => {
        walls.push({
          uid: `wall-${id}`,
          label: WALL_LABEL_FULL[id],
          sublabel: `${room[
            id === "back" || id === "front" ? "w" : "d"
          ].toFixed(1)} ม.`,
          isWall: true,
          wallId: id,
        });
      });
    }

    return [
      {
        id: "walls",
        label: "ผนัง",
        icon: "🧱",
        items: walls,
      },
      {
        id: "doors",
        label: "ประตู",
        icon: "🚪",
        items: doors.map((d) => ({
          uid: d.uid,
          label: d.displayName || "ประตูห้อง",
          sublabel: WALL_LABEL_FULL[d.wallId!] || "ผนัง",
          item: d,
        })),
      },
      {
        id: "windows",
        label: "หน้าต่าง",
        icon: "🪟",
        items: windows.map((w) => ({
          uid: w.uid,
          label: w.displayName || "หน้าต่าง",
          sublabel: WALL_LABEL_FULL[w.wallId!] || "ผนัง",
          item: w,
        })),
      },
      {
        id: "columns",
        label: "เสา",
        icon: "🏛️",
        items: columns.map((c) => ({
          uid: c.uid,
          label: c.displayName || "เสาโครงสร้าง",
          sublabel: `${c.params.w}×${c.params.d} ซม.`,
          item: c,
        })),
        addable: true,
      },
      {
        id: "partitions",
        label: "ฉากกั้น",
        icon: "🚧",
        items: partitions.map((p) => ({
          uid: p.uid,
          label: p.displayName || "ฉากกั้นห้อง",
          sublabel: `${(p.params.w / 100).toFixed(1)}×${(
            p.params.h / 100
          ).toFixed(1)} ม.`,
          item: p,
        })),
        addable: true,
      },
    ];
  }, [placedItems, room]);

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0);

  // ============================================================
  // Handlers
  // ============================================================
  const toggleGroup = (gid: GroupId) => {
    setExpanded((e) => ({ ...e, [gid]: !e[gid] }));
  };

  const handleAdd = useCallback(
    (productId: "column" | "partition") => {
      const p = PRODUCT_BY_ID.get(productId);
      if (!p) return;
      const params = defaultParamsFor(p);
      const uid = "i" + Math.random().toString(36).slice(2, 10);

      const r = useRoomTwin.getState().room;
      const offsetX = (Math.random() - 0.5) * (r.w - 1);
      const offsetZ = (Math.random() - 0.5) * (r.d - 1);

      const item: PlacedItem = {
        uid,
        productId,
        params,
        x: Math.round(offsetX * 10) / 10,
        z: Math.round(offsetZ * 10) / 10,
        rotY: 0,
        parentUid: null,
        restY: 0,
      };

      useRoomTwin.getState().addItem(item);
      instantiate(item);
      selectItem(uid);
      saveState();
    },
    [selectItem, saveState],
  );

  const handleSelect = useCallback(
    (setupItem: SetupItem) => {
      if (setupItem.isWall) {
        useRoomTwin.getState().closeItemPanel();
        return;
      }
      if (setupItem.item) {
        selectItem(setupItem.item.uid);
      }
    },
    [selectItem],
  );

  const handleDelete = useCallback(
    (setupItem: SetupItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!setupItem.item) return;
      const it = setupItem.item;

      openConfirm(`ลบ "${setupItem.label}" ออกจากห้อง?`, () => {
        const isDoor = it.productId === "door";
        // ⭐ ลบของที่แขวนอยู่กับพื้ นผิวของ item นี้ไปด้วยทั้งชุด
        deleteItemTree(it.uid);
        if (isDoor) rebuildBaseboards();
        resolveRestHeights();
        saveState();
      });
    },
    [saveState],
  );

  // ============================================================
  // Custom events + Escape
  // ============================================================
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("roomtwin:openRoomSetup", onOpen);
    window.addEventListener("roomtwin:closeRoomSetup", onClose);
    window.addEventListener("roomtwin:toggleRoomSetup", onToggle);
    return () => {
      window.removeEventListener("roomtwin:openRoomSetup", onOpen);
      window.removeEventListener("roomtwin:closeRoomSetup", onClose);
      window.removeEventListener("roomtwin:toggleRoomSetup", onToggle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <aside
      className={`room-setup-panel${open ? " show" : ""}`}
      aria-hidden={!open}
      style={{
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
      }}
      inert={!open}
    >
      <div className="rsu-head">
        <div className="rsu-title">
          🏗️ Room Setup
          <span className="rsu-count">{totalCount}</span>
        </div>
        <IconButton label="ปิด" size="sm" onClick={() => setOpen(false)}>
          ✕
        </IconButton>
      </div>

      <div className="rsu-body">
        <div className="rsu-root">
          <span className="rsu-root-icon">🏠</span>
          <span className="rsu-root-name">Room</span>
          <span className="rsu-root-size">
            {room.w.toFixed(1)} × {room.d.toFixed(1)} × {room.h.toFixed(1)} ม.
          </span>
        </div>

        {groups.map((group) => {
          const isExpanded = expanded[group.id];
          const count = group.items.length;

          return (
            <div key={group.id} className="rsu-group">
              <div
                className="rsu-group-head"
                onClick={() => toggleGroup(group.id)}
              >
                <span className={`rsu-chevron${isExpanded ? " open" : ""}`}>
                  ▶
                </span>
                <span className="rsu-group-icon">{group.icon}</span>
                <span className="rsu-group-name">{group.label}</span>
                <span className="rsu-group-count">{count}</span>
                {group.addable && (
                  <IconButton
                    label={`เพิ่ม${group.label}`}
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(
                        group.id === "columns" ? "column" : "partition",
                      );
                    }}
                  >
                    +
                  </IconButton>
                )}
              </div>

              {isExpanded && (
                <div className="rsu-items">
                  {count === 0 ? (
                    <div className="rsu-empty">— ยังไม่มี —</div>
                  ) : (
                    group.items.map((si) => (
                      <div
                        key={si.uid}
                        className={`rsu-item${
                          selectedUid === si.uid ? " selected" : ""
                        }${si.isWall ? " wall" : ""}`}
                        onClick={() => handleSelect(si)}
                      >
                        <span className="rsu-item-name">{si.label}</span>
                        {si.sublabel && (
                          <span className="rsu-item-sub">{si.sublabel}</span>
                        )}
                        {si.item && (
                          <IconButton
                            label={`ลบ ${si.label}`}
                            size="xs"
                            tone="danger"
                            onClick={(e) => handleDelete(si, e)}
                          >
                            ✕
                          </IconButton>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
