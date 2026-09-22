// components/viewport/ItemPanel.tsx
"use client";
import { useEffect, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { matchSizePreset } from "@/lib/data/sizePresets";
import { resolveZoneDisplay } from "@/lib/data/zoneResolve";
import { priceStr, hexOf, affiliateUrl } from "@/lib/utils/format";
import { trackAffiliateClick } from "@/lib/state/storage";
import { Button, IconButton } from "@/components/ui";

export default function ItemPanel() {
  const selectedUid = useRoomTwin((s) => s.selectedUid);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const zoneMeta = useRoomTwin((s) => s.zoneMeta);
  const closeItemPanel = useRoomTwin((s) => s.closeItemPanel);
  const setCustomizeTarget = useRoomTwin((s) => s.setCustomizeTarget);
  const selectedZoneUid = useRoomTwin((s) => s.selectedZoneUid);
  const room = useRoomTwin((s) => s.room);

  const [clearanceText, setClearanceText] = useState("");
  const [clearanceWarn, setClearanceWarn] = useState(false);

  const item = selectedUid
    ? placedItems.find((i) => i.uid === selectedUid)
    : null;

  const visible = !!item && !selectedZoneUid;

  // ===== Clearance (ceiling items) =====
  useEffect(() => {
    if (!item || !item.ceilingMount) {
      setClearanceText("");
      setClearanceWarn(false);
      return;
    }
    const dropH = item.params.h / 100;
    const bottomCm = Math.round((room.h - dropH) * 100);
    setClearanceText(
      `ห้อยลงมาถึง ${bottomCm} ซม. จากพื้น (เพดานสูง ${Math.round(room.h * 100)} ซม.)`,
    );
    setClearanceWarn(false);
  }, [item, room.h]);

  if (!item) {
    return <div className="item-panel" id="itemPanel" />;
  }

  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return null;

  const p = item.params;
  const locked = !!item.locked;
  // ⭐ ชื่อขนาดสำเร็จรูป (ถ้าตรงกับ preset) — ยืนยันผลหลังเลือกขนาดจาก toolbar
  const sizePreset = matchSizePreset(item.productId, p);

  // zone info — ⭐ ใช้ resolver กลาง (definition + override)
  const zone = item.zoneUid
    ? resolveZoneDisplay(item.zoneUid, { placedItems, zoneMeta })
    : null;
  const zoneInfo = zone ? ` • ${zone.icon} ${zone.name}` : "";

  const handleOpenStore = () => {
    trackAffiliateClick();
    const url = affiliateUrl(product);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className={`item-panel${visible ? " show" : ""}`} id="itemPanel">
      <div className="ip-top">
        <div className="ip-swatch" style={{ background: hexOf(p.color) }} />

        <div className="ip-info">
          <div className="ip-name">
            {(locked ? "🔒 " : "") + (item.displayName || product.name)}
          </div>
          <div className="ip-meta">
            {sizePreset ? `${sizePreset.label} • ` : ""}
            {p.w}×{p.d}×{p.h} ซม.{zoneInfo}
          </div>
          <div className="ip-price">{priceStr(product.price)}</div>
        </div>

        <IconButton label="ปิด" size="sm" onClick={closeItemPanel}>
          ✕
        </IconButton>
      </div>

      {clearanceText && (
        <div
          className={`ip-clearance${clearanceWarn ? " warn" : ""}`}
          style={{ display: "block" }}
        >
          {clearanceText}
        </div>
      )}

      <div className="ip-actions">
        <Button
          variant="sage"
          size="md"
          icon="🎨"
          onClick={() => setCustomizeTarget(item.uid)}
        >
          ปรับแต่ง
        </Button>

        <Button variant="copper" size="md" block onClick={handleOpenStore}>
          ไปดูที่ร้าน
        </Button>
      </div>
    </div>
  );
}
