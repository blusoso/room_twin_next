// lib/three/paramEdit.ts
// ⭐ แก้ params ของไอเทม 1 จุดเดียว (single owner) — ใช้ร่วมกันระหว่าง
//    - สไลเดอร์/สี/ตัวเลือกใน CustomizePanel
//    - ขนาดสำเร็จรูป (size presets) บน floating toolbar / chip ในแผงปรับแต่ง
//
// ทำไมต้องอยู่ lib/three: การแก้ params ไม่ใช่แค่เขียน state — ต้องสร้าง object ใหม่
// (reinstantiate) + clamp ตำแหน่งใหม่ (resolvePlacement/resolveWallPlacement/resolveCeilingPlacement)
// + ประสานกับของที่แขวนอยู่บนพื้นผิว (reclampAttachmentsOf) ซึ่งเป็นงาน imperative ของ scene

import { PRODUCT_BY_ID } from "@/lib/data/products";
import { useRoomTwin } from "@/lib/state/store";
import { reinstantiateItem } from "./instantiate";
import { rebuildBaseboards } from "./roomShell";
import { resolveRestHeights } from "./placement";
import type { PlacedItem, Params } from "@/lib/state/types";

/** ⭐ แก้ค่าทีละ key (สไลเดอร์/สี/ตัวเลือก) — signature เดิมที่ CustomizePanel ใช้ */
export function applyParamEdit(item: PlacedItem, key: string, value: any) {
  applyParamsPatch(item, { [key]: value });
}

/**
 * ⭐ แก้ params หลาย key พร้อมกัน (ใช้กับ size preset ที่ตั้ง w/d พร้อมกัน)
 *    ลำดับเหมือนเดิมเป๊ะ: เขียน store (synchronous) → แล้วค่อยจัดตำแหน่ง/สร้าง object ใหม่
 */
export function applyParamsPatch(item: PlacedItem, patch: Partial<Params>) {
  const product = PRODUCT_BY_ID.get(item.productId);
  if (!product) return;

  const newParams: Params = { ...item.params, ...patch };
  useRoomTwin.getState().updateItem(item.uid, { params: newParams });

  const isDim = "w" in patch || "d" in patch || "h" in patch;

  if (isDim) {
    resolveRestHeights();
    import("@/lib/three/placement").then(
      ({ footprintOf, resolvePlacement, resolveRestHeights: rrh }) => {
        const { placedItems, updateItem } = useRoomTwin.getState();
        const it = placedItems.find((i) => i.uid === item.uid);
        if (!it) return;
        const fp = footprintOf(newParams, it.rotY || 0);

        if (it.wallMount) {
          import("@/lib/three/wallPlacement").then(
            ({ resolveWallPlacement, wallFootprint, targetOfItem }) => {
              const target = targetOfItem(it);
              if (!target) return;
              const { halfU, halfV } = wallFootprint(
                newParams,
                it.rotZ || 0,
              );
              const c = resolveWallPlacement(
                it.uid,
                target,
                it.u!,
                it.v!,
                halfU,
                halfV,
                product.groundAnchor || false,
              );
              updateItem(it.uid, { u: c.u, v: c.v });
              reinstantiateItem(it.uid);
              if (product.id === "door") rebuildBaseboards();
              // ⭐ ประตู/หน้าต่างเปลี่ยนขนาด → ของที่แขวนอยู่บนพื้ นผิวตามขนาดใหม่
              import("@/lib/three/reclamp").then(({ reclampAttachmentsOf }) =>
                reclampAttachmentsOf(it.uid),
              );
            },
          );
          return;
        }

        if (it.ceilingMount) {
          import("@/lib/three/ceilingPlacement").then(
            ({ resolveCeilingPlacement }) => {
              const c = resolveCeilingPlacement(
                it.uid,
                it.x!,
                it.z!,
                fp,
                newParams.h / 100,
              );
              updateItem(it.uid, { x: c.x, z: c.z });
              reinstantiateItem(it.uid);
            },
          );
          return;
        }

        const c = resolvePlacement(
          it.uid,
          it.x!,
          it.z!,
          fp,
          it.parentUid,
          product.rug,
        );
        updateItem(it.uid, { x: c.x, z: c.z });
        reinstantiateItem(it.uid);
        rrh();
        // ⭐ เสา/ฉากกั้นเปลี่ยนขนาด → ของที่แขวนอยู่บนพื้ นผิวตามพื้ นผิวใหม่
        import("@/lib/three/reclamp").then(({ reclampAttachmentsOf }) =>
          reclampAttachmentsOf(it.uid),
        );
      },
    );
    return;
  }

  reinstantiateItem(item.uid);
  import("@/lib/three/reclamp").then(({ reclampAttachmentsOf }) =>
    reclampAttachmentsOf(item.uid),
  );
}
