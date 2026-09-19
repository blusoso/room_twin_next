// components/sidebar/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { useCatalogSearchShortcut } from "@/hooks/useCatalogSearchShortcut";

import BuildPanel from "./BuildPanel";
import RoomPanel from "./RoomPanel";
import RoomStructurePanel from "@/components/panels/RoomStructurePanel";

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

  /*
   * Catalog shortcut
   */
  useCatalogSearchShortcut();

  /*
   * ============================================================
   * Room Setup Panel
   * ============================================================
   *
   * RoomSetupPanel เดิมมีระบบ open/close ของตัวเอง
   * เราจึงสั่งผ่าน CustomEvent ที่ component เดิมรองรับอยู่แล้ว
   */
  useEffect(() => {
    if (sidebarTab === "setup") {
      window.dispatchEvent(
        new CustomEvent("roomtwin:openRoomSetup"),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("roomtwin:closeRoomSetup"),
      );
    }

    return () => {
      window.dispatchEvent(
        new CustomEvent("roomtwin:closeRoomSetup"),
      );
    };
  }, [sidebarTab]);

  /*
   * ============================================================
   * Tab handlers
   * ============================================================
   */

  const handleSetupTab = () => {
    closeItemPanel();

    setSidebarTab("setup");

    // ไม่ต้องเปลี่ยน activePanel
    // เพราะ setup เป็น panel ใหม่แยกจาก build/room
    window.dispatchEvent(
      new CustomEvent("roomtwin:openRoomSetup"),
    );
  };

  const handleBrowseTab = () => {
    window.dispatchEvent(
      new CustomEvent("roomtwin:closeRoomSetup"),
    );

    closeItemPanel();

    setSidebarTab("browse");
    setActivePanel("build");
  };

  const handleRoomTab = () => {
    window.dispatchEvent(
      new CustomEvent("roomtwin:closeRoomSetup"),
    );

    setSidebarTab("room");
    setActivePanel("room");
  };

  /*
   * ============================================================
   * Drawer
   * ============================================================
   */

  const handleDrawerToggle = () => {
    toggleDrawer();
    closeItemPanel();
  };

  return (
    <aside
      id="asideEl"
      className={`sidebar${drawerExpanded ? " expanded" : ""}`}
    >
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

        <span className="chevron">
          {drawerExpanded ? "▼" : "▲"}
        </span>
      </div>

      {/* ======================================================
          Main 3 Tabs
          ====================================================== */}
      <div
        className="panel-main-tabs"
        id="panelMainTabs"
        role="tablist"
        aria-label="เมนูห้อง"
      >
        {/* ----------------------------------------------------
            Tab 1: ตั้งค่าห้อง
            ---------------------------------------------------- */}
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "setup"}
          className={`panel-main-tab${
            sidebarTab === "setup" ? " active" : ""
          }`}
          onClick={handleSetupTab}
        >
          <span className="tab-icon">📐</span>
          <span className="tab-label">สร้างห้อง</span>
        </button>

        {/* ----------------------------------------------------
            Tab 2: เลือกของ
            ---------------------------------------------------- */}
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "browse"}
          className={`panel-main-tab${
            sidebarTab === "browse" ? " active" : ""
          }`}
          onClick={handleBrowseTab}
        >
          <span className="tab-icon">🛋️</span>
          <span className="tab-label">เลือกของ</span>
        </button>

        {/* ----------------------------------------------------
            Tab 3: ของในห้อง
            ---------------------------------------------------- */}
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "room"}
          className={`panel-main-tab${
            sidebarTab === "room" ? " active" : ""
          }`}
          onClick={handleRoomTab}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">ของในห้อง</span>
        </button>
      </div>

      {/* ======================================================
          SETUP TAB
          ====================================================== */}
      {sidebarTab === "setup" && (
        <div
          className="panel-body setup-panel active"
          id="setupPanel"
          role="tabpanel"
        >
           <RoomStructurePanel embedded />
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
          💡 ลาก item ไปวางในโซนอื่นได้เลย • แตะ header โซนเพื่อโฟกัส
          • คลิกโซนเพื่อเลือกธีม
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