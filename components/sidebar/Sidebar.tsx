// components/sidebar/Sidebar.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import BuildPanel from "./BuildPanel";
import RoomPanel from "./RoomPanel";

export default function Sidebar() {
  const activePanel = useRoomTwin((s) => s.activePanel);
  const setActivePanel = useRoomTwin((s) => s.setActivePanel);
  const drawerExpanded = useRoomTwin((s) => s.drawerExpanded);
  const toggleDrawer = useRoomTwin((s) => s.toggleDrawer);
  const closeItemPanel = useRoomTwin((s) => s.closeItemPanel);

  return (
    <aside id="asideEl" className={drawerExpanded ? "expanded" : ""}>
      {/* ===== Drawer handle (mobile) ===== */}
      <div
        className="drawer-handle"
        onClick={() => {
          toggleDrawer();
          closeItemPanel();
        }}
      >
        <span>🛋️ ของแต่งห้อง</span>
        <span className="chevron">▲</span>
      </div>

      {/* ===== Main panel tabs ===== */}
      <div className="panel-main-tabs" id="panelMainTabs">
        <button
          type="button"
          className={`panel-main-tab${activePanel === "build" ? " active" : ""}`}
          data-panel="build"
          onClick={() => setActivePanel("build")}
        >
          <span className="tab-icon">🛒</span>
          <span className="tab-label">สร้างห้อง</span>
        </button>
        <button
          type="button"
          className={`panel-main-tab${activePanel === "room" ? " active" : ""}`}
          data-panel="room"
          onClick={() => setActivePanel("room")}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">ห้องของฉัน</span>
        </button>
      </div>

      {/* ===== Panel body ===== */}
      <div
        className={`panel-body build-panel${
          activePanel === "build" ? " active" : ""
        }`}
        id="buildPanel"
      >
        {activePanel === "build" && <BuildPanel />}
      </div>

      <div
        className={`panel-body room-panel${
          activePanel === "room" ? " active" : ""
        }`}
        id="roomPanel"
      >
        {activePanel === "room" && <RoomPanel />}
      </div>

      {/* ===== Hint ===== */}
      <div className="sidebar-hint">
        💡 ลาก item ไปวางในโซนอื่นได้เลย • แตะ header โซนเพื่อโฟกัส • คลิกโซน →
        เลือกธีมได้เลย
      </div>
    </aside>
  );
}