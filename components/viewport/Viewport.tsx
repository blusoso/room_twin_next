// components/viewport/Viewport.tsx
"use client";
import Canvas3D from "./Canvas3D";
import ItemPanel from "./ItemPanel";
import FloatingToolbar from "./FloatingToolbar";
import Overlays from "./Overlays";
import CornerViews from "./CornerViews";
import {
  RoomStructurePanel,
  CustomizePanel,
  ZoneThemePanel,
  ZoneChooser,
  BlocksEditor,
} from "@/components/panels";
import { usePointerInteraction } from "@/hooks/usePointerInteraction";

export default function Viewport() {
  usePointerInteraction();

  return (
    <div className="viewport-wrap" id="viewportWrap">
      <Canvas3D />
      <Overlays />
      <ItemPanel />
      <FloatingToolbar />
      <CornerViews />
      <RoomStructurePanel />
      <CustomizePanel />
      <ZoneThemePanel />
      <ZoneChooser />
      <BlocksEditor />
    </div>
  );
}