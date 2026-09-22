// components/viewport/CornerViews.tsx
"use client";
import { useCallback } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { flyCameraTo } from "@/lib/three/cameraFlight";
import { Button } from "@/components/ui";

const CORNER_VIEWS: Record<
  string,
  { x: number; y: number; z: number; targetY: number }
> = {
  bl: { x: 2.6, y: 2.5, z: 5.6, targetY: 1.1 },
  br: { x: -2.6, y: 2.5, z: 5.6, targetY: 1.1 },
  fl: { x: 2.6, y: 2.5, z: -5.6, targetY: 1.1 },
  fr: { x: -2.6, y: 2.5, z: -5.6, targetY: 1.1 },
};

export default function CornerViews() {
  const room = useRoomTwin((s) => s.room);

  const handleCorner = useCallback(
    (corner: string) => {
      let v: { x: number; y: number; z: number; targetY: number };

      if (corner === "top") {
        v = { x: 0, y: room.h + 5.0, z: 0, targetY: room.h / 2 };
      } else {
        v = CORNER_VIEWS[corner];
      }

      if (v) flyCameraTo(v.x, v.y, v.z, 0, v.targetY, 0);
    },
    [room.h],
  );

  return (
    <div className="corner-views">
      <Button
        variant="floating"
        size="sm"
        icon="🎥"
        onClick={() => handleCorner("bl")}
      >
        มุม 1
      </Button>
      <Button
        variant="floating"
        size="sm"
        icon="🎥"
        onClick={() => handleCorner("br")}
      >
        มุม 2
      </Button>
      <Button
        variant="floating"
        size="sm"
        icon="🎥"
        onClick={() => handleCorner("fl")}
      >
        มุม 3
      </Button>
      <Button
        variant="floating"
        size="sm"
        icon="🎥"
        onClick={() => handleCorner("fr")}
      >
        มุม 4
      </Button>
      <Button
        variant="floating"
        size="sm"
        icon="🗺️"
        className="corner-view-wide"
        onClick={() => handleCorner("top")}
      >
        มุมบน / ผังพื้น
      </Button>
    </div>
  );
}