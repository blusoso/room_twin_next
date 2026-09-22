// components/sidebar/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useCatalogSearchShortcut } from "@/hooks/useCatalogSearchShortcut";

import BuildPanel from "./BuildPanel";
import RoomPanel from "./RoomPanel";
import RoomStructurePanel from "@/components/panels/RoomStructurePanel";
import Pill from "../ui/Pill";
import { SegmentedControl, type SegmentOption } from "@/components/ui";

type SidebarTab = "setup" | "browse" | "room";

export default function Sidebar() {
  const activePanel = useRoomTwin((s) => s.activePanel);
  const setActivePanel = useRoomTwin((s) => s.setActivePanel);

  const drawerExpanded = useRoomTwin((s) => s.drawerExpanded);
  const toggleDrawer = useRoomTwin((s) => s.toggleDrawer);
  const closeItemPanel = useRoomTwin((s) => s.closeItemPanel);

  /*
   * ============================================================
   * Main Sidebar Tab
   * ============================================================
   *
   * setup  = ตั้งค่าห้อง
   * browse = เลือกของ
   * room   = ของในห้อง
   *
   * ใช้ state แยกจาก activePanel เดิม
   * เพื่อไม่กระทบ logic ภายในระบบ catalog / room
   */
  const room = useRoomTwin((s) => s.room);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("browse");

  /*
   * Keyboard shortcut:
   * "/" หรือ Ctrl/Cmd + K
   *
   * hook เดิมจะเปลี่ยน activePanel เป็น build
   * ดังนั้นเราตรวจจับ activePanel แล้วเปลี่ยน sidebar
   * ไปยัง tab "เลือกของ" ด้วย
   */
  useEffect(() => {
    if (activePanel === "build" && sidebarTab === "room") {
      setSidebarTab("browse");
    }
    if (activePanel === "room" && sidebarTab === "browse") {
      setSidebarTab("room");
    }
  }, [activePanel, sidebarTab]);

  useCatalogSearchShortcut();

  useEffect(() => {
    if (sidebarTab === "setup") {
      window.dispatchEvent(new CustomEvent("roomtwin:openRoomSetup"));
    } else {
      window.dispatchEvent(new CustomEvent("roomtwin:closeRoomSetup"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("roomtwin:closeRoomSetup"));
    };
  }, [sidebarTab]);

  const handleSetupTab = () => {
    closeItemPanel();
    setSidebarTab("setup");
    window.dispatchEvent(new CustomEvent("roomtwin:openRoomSetup"));
  };

  const handleBrowseTab = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:closeRoomSetup"));
    closeItemPanel();
    setSidebarTab("browse");
    setActivePanel("build");
  };

  const handleRoomTab = () => {
    window.dispatchEvent(new CustomEvent("roomtwin:closeRoomSetup"));
    setSidebarTab("room");
    setActivePanel("room");
  };

  const handleDrawerToggle = () => {
    toggleDrawer();
    closeItemPanel();
  };

  // ⭐ label ของขนาดห้อง (ทศนิยม 1 ตำแหน่ง)
  const roomSizeLabel = `${room.w.toFixed(1)} × ${room.d.toFixed(1)} ม.`;

  return (
    <aside
      id="asideEl"
      className={`sidebar${drawerExpanded ? " expanded" : ""}`}
    >
      <div className="flex px-4 pt-3">
        <div className="brand flex items-center z-10">
          <img
            src="/assets/roomtwin_logo.png"
            alt="RoomTwin Logo"
            className="h-11 md:h-13 object-contain"
          />
        </div>
        <div className="ml-auto flex items-center justify-content gap-2 z-10">
          {/* ⭐ Pill แสดงขนาดจริง + กดไปแท็บ "สร้างห้อง" */}
          <Pill
            size="md"
            icon="📐"
            title="ปรับขนาดห้อง"
            onClick={handleSetupTab}
            aria-label={`ขนาดห้อง ${roomSizeLabel} — คลิกเพื่อแก้ไข`}
          >
            {roomSizeLabel}
          </Pill>
        </div>
      </div>

      {/* ======================================================
          Mobile Drawer Handle
          ====================================================== */}
      <div
        className="drawer-handle"
        onClick={handleDrawerToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDrawerToggle();
          }
        }}
      >
        <span>🛋️ ของแต่งห้อง</span>

        <span className="chevron">{drawerExpanded ? "▼" : "▲"}</span>
      </div>

      {/* ======================================================
          Main 3 Tabs
          ====================================================== */}
      <SegmentedControl
        containerClass="panel-main-tabs"
        optionClass="panel-main-tab"
        ariaLabel="เมนูห้อง"
        value={sidebarTab}
        onChange={(v) => {
          if (v === "setup") handleSetupTab();
          else if (v === "browse") handleBrowseTab();
          else handleRoomTab();
        }}
        options={[
          {
            value: "setup",
            label: (
              <>
                <span className="tab-icon">📐</span>
                <span className="tab-label">สร้างห้อง</span>
              </>
            ),
          },
          {
            value: "browse",
            label: (
              <>
                <span className="tab-icon">🛋️</span>
                <span className="tab-label">เลือกของ</span>
              </>
            ),
          },
          {
            value: "room",
            label: (
              <>
                <span className="tab-icon">📦</span>
                <span className="tab-label">ของในห้อง</span>
              </>
            ),
          },
        ]}
      />

      {/* ======================================================
          SETUP TAB
          ====================================================== */}
      {sidebarTab === "setup" && (
        <div
          className="panel-body setup-panel active"
          id="setupPanel"
          role="tabpanel"
        >
          {/* ⭐ ส่ง onDone → กด "เสร็จแล้ว ไปเลือกของ" ที่ step 4
              → สลับไปแท็บ "เลือกของ" ทันที */}
          <RoomStructurePanel embedded onDone={handleBrowseTab} />
        </div>
      )}

      {/* ======================================================
          BROWSE / CATALOG TAB
          ====================================================== */}
      {sidebarTab === "browse" && (
        <div
          className="panel-body build-panel active"
          id="buildPanel"
          role="tabpanel"
        >
          <BuildPanel />
        </div>
      )}

      {/* ======================================================
          ROOM TAB
          ====================================================== */}
      {sidebarTab === "room" && (
        <div
          className="panel-body room-panel active"
          id="roomPanel"
          role="tabpanel"
        >
          <RoomPanel />
        </div>
      )}

      {/* ======================================================
          Bottom Hint
          ====================================================== */}
      {sidebarTab === "browse" && (
        <div className="sidebar-hint">
          💡 เลือกชุดโซนเพื่อความสะดวกและรวดเร็ว • คลิกโซนเพื่อเลือกธีม •
          กดเลือกสิ่งของและเปลี่ยนได้ด้วยกดปุ่ม replace
        </div>
      )}

      {sidebarTab === "setup" && (
        <div className="sidebar-hint">
          💡 ตั้งค่าขนาดห้อง ผนัง ประตู หน้าต่าง และโครงสร้างห้อง
        </div>
      )}

      {sidebarTab === "room" && (
        <div className="sidebar-hint">
          💡 ดูและจัดการของทั้งหมดที่อยู่ภายในห้อง
        </div>
      )}
    </aside>
  );
}
