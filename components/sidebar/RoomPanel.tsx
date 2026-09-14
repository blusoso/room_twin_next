// components/sidebar/RoomPanel.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import RoomTree from "./RoomTree";

export default function RoomPanel() {
  const setActivePanel = useRoomTwin((s) => s.setActivePanel);
  const setActiveCat = useRoomTwin((s) => s.setActiveCat);
  const expandDrawer = useRoomTwin((s) => s.expandDrawer);
  const closeSwapPanel = useRoomTwin((s) => s.setSwapTarget);

  const handleAddZone = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeSwapPanel(null);
    setActivePanel("build");
    setActiveCat("zone");
    expandDrawer();
  };

  return (
    <>
      <RoomTree />
      <button
        type="button"
        className="add-zone-btn"
        id="addZoneBtn"
        onClick={handleAddZone}
      >
        + เพิ่มโซน
      </button>
    </>
  );
}