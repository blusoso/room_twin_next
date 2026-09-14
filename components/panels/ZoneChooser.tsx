// components/panels/ZoneChooser.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import { hexOf } from "@/lib/utils/format";
import { getZoneBounds } from "@/lib/three/zoneBounds";

interface ZoneOption {
  zoneUid: string;
  name: string;
  icon: string;
  color: number;
}

function findNearbyZonesAt(
  x: number,
  z: number,
  maxDist: number,
): ZoneOption[] {
  const { placedItems } = useRoomTwin.getState();
  const seen = new Set<string>();
  const results: Array<ZoneOption & { dist: number }> = [];

  placedItems.forEach((i) => {
    if (!i.zoneUid || seen.has(i.zoneUid)) return;
    seen.add(i.zoneUid);
    const b = getZoneBounds(i.zoneUid);
    if (!b) return;
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    const dist = Math.hypot(dx, dz);
    if (dist > maxDist) return;

    const meta = useRoomTwin.getState().zoneMeta.get(i.zoneUid) || {};
    results.push({
      zoneUid: i.zoneUid,
      name: meta.name || "โซน",
      icon: meta.icon || "📦",
      color: meta.color !== undefined ? meta.color : 0xb8752e,
      dist,
    });
  });

  results.sort((a, b) => a.dist - b.dist);
  return results;
}

export default function ZoneChooser() {
  const pendingUid = useRoomTwin((s) => s.pendingZoneChooserUid);
  const setPending = useRoomTwin((s) => s.setPendingZoneChooser);
  const placedItems = useRoomTwin((s) => s.placedItems);

  if (!pendingUid) {
    return (
      <div className="zone-chooser" aria-hidden="true">
        <div className="zone-chooser-label">วางไว้ที่โซนไหน?</div>
        <div className="zone-chooser-list" />
      </div>
    );
  }

  const item = placedItems.find((i) => i.uid === pendingUid);
  if (!item || item.x === undefined || item.z === undefined) {
    return (
      <div className="zone-chooser show" aria-hidden="false">
        <div className="zone-chooser-label">วางไว้ที่โซนไหน?</div>
        <div className="zone-chooser-list">
          <button
            type="button"
            className="zone-chooser-btn skip"
            onClick={() => setPending(null)}
          >
            <span className="zc-icon">📌</span>
            <span>ปิด</span>
          </button>
        </div>
      </div>
    );
  }

  const zones = findNearbyZonesAt(item.x, item.z, 0.7);

  const assign = (zuid: string | null) => {
    const store = useRoomTwin.getState();
    if (zuid) {
      const any = store.placedItems.find(
        (i) => i.zoneUid === zuid && i.zoneDefId,
      );
      store.updateItem(pendingUid, {
        zoneUid: zuid,
        zoneDefId: any ? any.zoneDefId : null,
        slotId: undefined,
      });
    } else {
      store.updateItem(pendingUid, {
        zoneUid: null,
        zoneDefId: null,
        slotId: undefined,
      });
    }
    setPending(null);
  };

  return (
    <div className="zone-chooser show" aria-hidden="false">
      <div className="zone-chooser-label">วางไว้ที่โซนไหน?</div>
      <div className="zone-chooser-list">
        {zones.map((z) => (
          <button
            key={z.zoneUid}
            type="button"
            className="zone-chooser-btn"
            style={
              {
                "--zc-color": hexOf(z.color),
              } as React.CSSProperties
            }
            onClick={() => assign(z.zoneUid)}
          >
            <span className="zc-icon">{z.icon}</span>
            <span>{z.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="zone-chooser-btn skip"
          onClick={() => assign(null)}
        >
          <span className="zc-icon">📌</span>
          <span>ลอย (ไม่มีโซน)</span>
        </button>
      </div>
    </div>
  );
}