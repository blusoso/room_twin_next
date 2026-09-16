// components/sidebar/BuildPanel.tsx
"use client";
import { useRoomTwin } from "@/lib/state/store";
import { CATEGORIES } from "@/lib/data/constants";
import { PRODUCTS, PRODUCT_BY_ID } from "@/lib/data/products";
import { ZONES } from "@/lib/data/zones";
import {
  THEME_BY_ID,
  ZONE_THEMES,
  themeDisplayName,
} from "@/lib/data/themes";
import { categoryLabel } from "@/lib/data/productSearch";
import { useCatalogSearchResult } from "@/hooks/useCatalogSearchResult";
import { usePlacement } from "@/hooks/usePlacement";
import { useCardDrag } from "@/hooks/useCardDrag";
import ProductCard from "./ProductCard";
import ZoneCard from "./ZoneCard";
import CatalogSearch, { CatalogEmptyState } from "./CatalogSearch";

export default function BuildPanel() {
  const activeCat = useRoomTwin((s) => s.activeCat);
  const setActiveCat = useRoomTwin((s) => s.setActiveCat);
  const swapTargetUid = useRoomTwin((s) => s.swapTargetUid);
  const setSwapTarget = useRoomTwin((s) => s.setSwapTarget);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const catalogQuery = useRoomTwin((s) => s.catalogQuery);

  const { placeProduct, placeThemedProduct, placeZone } = usePlacement();
  const { startDrag } = useCardDrag({
    placeProduct,
    placeThemedProduct,
    placeZone,
  });

  const isSwapping = !!swapTargetUid;
  const currentItem = isSwapping
    ? placedItems.find((i) => i.uid === swapTargetUid)
    : null;

  const {
    searchMode,
    hits,
    zones: zoneHits,
    resultCount,
  } = useCatalogSearchResult();

  const handleSwapSelect = (pid: string) => {
    if (!swapTargetUid) return;
    window.dispatchEvent(
      new CustomEvent("roomtwin:swapSlot", {
        detail: { uid: swapTargetUid, productId: pid },
      }),
    );
    setSwapTarget(null);
  };

  return (
    <>
      {/* ===== Swap header ===== */}
      {isSwapping && currentItem && (
        <div className="swap-header swapping show" id="swapHeader">
          <div className="swap-title" id="swapTitle">
            ⇄ กำลังเปลี่ยนสินค้า
            <small>
              ตอนนี้: {PRODUCT_BY_ID.get(currentItem.productId)?.name || ""} •
              แตะการ์ดเพื่อแทนที่
            </small>
            <span className="swap-tip">
              คลิก object อื่นในแบบ 3D เพื่อออกจากโหมดนี้
            </span>
          </div>
          <button
            type="button"
            className="swap-cancel"
            onClick={() => setSwapTarget(null)}
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* ===== Smart search & filter ===== */}
      <CatalogSearch />

      {/* ===== Category tabs (แสดงเฉพาะโหมดเลือกดูปกติ) ===== */}
      {!searchMode && (
        <div className="tabs" id="tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`tab${activeCat === c.id ? " active" : ""}`}
              data-cat={c.id}
              onClick={() => setActiveCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ===== Catalog grid ===== */}
      <div
        className={`catalog${searchMode ? " search-mode" : ""}`}
        id="catalog"
      >
        {searchMode ? (
          <>
            {zoneHits.length > 0 && (
              <>
                <div className="catalog-section-head">
                  🏠 โซนสำเร็จรูป <span>({zoneHits.length})</span>
                </div>
                {zoneHits.map((z) => (
                  <ZoneCard
                    key={z.id}
                    zone={z}
                    startDrag={startDrag}
                    disabled={isSwapping}
                    query={catalogQuery}
                  />
                ))}
              </>
            )}

            {hits.length > 0 && (
              <div className="catalog-section-head">
                🛋️ สินค้า <span>({hits.length})</span>
              </div>
            )}

            {hits.map((h) => (
              <ProductCard
                key={`${h.product.id}-${h.themeId ?? "base"}`}
                product={h.product}
                startDrag={startDrag}
                themeId={h.themeId}
                isSwapping={isSwapping}
                isCurrent={currentItem?.productId === h.product.id}
                onSwapClick={() => handleSwapSelect(h.product.id)}
                catBadge={categoryLabel(h.product.cat)}
                themeName={
                  h.themeId ? THEME_BY_ID.get(h.themeId)?.name : undefined
                }
                query={catalogQuery}
              />
            ))}

            {resultCount === 0 && <CatalogEmptyState query={catalogQuery} />}
          </>
        ) : activeCat === "zone" ? (
          <ZoneGrid startDrag={startDrag} isSwapping={isSwapping} />
        ) : (
          <ProductGrid
            cat={activeCat}
            startDrag={startDrag}
            isSwapping={isSwapping}
            currentItem={currentItem}
            onSwapSelect={handleSwapSelect}
          />
        )}
      </div>
    </>
  );
}

// ============================================================
// Grids
// ============================================================

function ZoneGrid({
  startDrag,
  isSwapping,
}: {
  startDrag: ReturnType<typeof useCardDrag>["startDrag"];
  isSwapping: boolean;
}) {
  return (
    <>
      {ZONES.map((z) => (
        <ZoneCard
          key={z.id}
          zone={z}
          startDrag={startDrag}
          disabled={isSwapping}
        />
      ))}
    </>
  );
}

function ProductGrid({
  cat,
  startDrag,
  isSwapping,
  currentItem,
  onSwapSelect,
}: {
  cat: string;
  startDrag: ReturnType<typeof useCardDrag>["startDrag"];
  isSwapping: boolean;
  currentItem: any;
  onSwapSelect: (pid: string) => void;
}) {
  const products = PRODUCTS.filter((p) => p.cat === cat);

  return (
    <>
      {products.map((p) => {
        const isCurrent = currentItem?.productId === p.id;

        return (
          <ProductCard
            key={p.id}
            product={p}
            startDrag={startDrag}
            themeId={null}
            isSwapping={isSwapping}
            isCurrent={isCurrent}
            onSwapClick={() => onSwapSelect(p.id)}
          />
        );
      })}

      {/* Themed variants */}
      {!isSwapping &&
        products.flatMap((p) =>
          ZONE_THEMES.filter((t) =>
            themeDisplayName(p.id, t.id),
          ).map((theme) => (
            <ProductCard
              key={`${p.id}-${theme.id}`}
              product={p}
              startDrag={startDrag}
              themeId={theme.id}
              isSwapping={false}
              isCurrent={false}
            />
          )),
        )}
    </>
  );
}
