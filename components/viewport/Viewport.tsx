// components/viewport/Viewport.tsx
"use client";
import Canvas3D from "./Canvas3D";
import ItemPanel from "./ItemPanel";
import FloatingToolbar from "./FloatingToolbar";
import Overlays from "./Overlays";
import RulerOverlay from "./RulerOverlay";
import CornerViews from "./CornerViews";
import {
  RoomStructurePanel,
  CustomizePanel,
  ZoneThemePanel,
  ZoneChooser,
  BlocksEditor,
  CatalogFilterPanel,
} from "@/components/panels";
import { usePointerInteraction } from "@/hooks/usePointerInteraction";
import { useSwapHighlight } from "@/hooks/useSwapHighlight";
import { useLighting } from "@/hooks/useLighting";

export default function Viewport() {
  usePointerInteraction();
  useSwapHighlight();
  useLighting();

  return (
    <div className="viewport-wrap" id="viewportWrap">
      <Canvas3D />
      <Overlays />
      {/* ⭐ โหมด 📏 ไม้บรรทัดห้อง — ไม้บรรทัด + เส้นไกด์ ลอยเหนือ canvas (pointer-events: none) */}
      <RulerOverlay />
      <ItemPanel />
      <FloatingToolbar />
      {/* ⭐ badge ของโหมด "เปลี่ยนสินค้า" — อัปเดตตำแหน่งจาก lib/three/swapHighlight */}
      <div className="swap-badge" id="swapBadge" />
      <CornerViews />
      <RoomStructurePanel />
      {/* ⭐ ลบ <RoomSetupPanel /> ออก */}
      {/* ⭐ floating filter panel — ลอยข้าง sidebar (mount ก่อน CustomizePanel เพื่อให้ panel อื่นทับด้านบนได้) */}
      <CatalogFilterPanel />
      <CustomizePanel />
      <ZoneThemePanel />
      <ZoneChooser />
      <BlocksEditor />
    </div>
  );
}