// components/sidebar/BuildPanel.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { CATEGORIES } from "@/lib/data/constants";
import { PRODUCTS, PRODUCT_BY_ID } from "@/lib/data/products";
import { ZONES } from "@/lib/data/zones";
import { THEME_BY_ID, ZONE_THEMES, themeDisplayName } from "@/lib/data/themes";
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
          {/* แท็บ "ทั้งหมด" อยู่ตัวแรกเสมอ */}
          <button
            type="button"
            className={`tab${activeCat === "all" ? " active" : ""}`}
            data-cat="all"
            onClick={() => setActiveCat("all")}
          >
            ทั้งหมด
          </button>

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

      {/* ===== Tips ===== */}
      <div className="tip">
        <span aria-hidden="true">✋</span>
        <span>
          <b>ลาก</b>ของไปวางในห้อง
        </span>
        <button data-act="tipx" aria-label="ปิดคำแนะนำ">
          ✕
        </button>
      </div>

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
                  <span className="csh-title">
                    🏠 โซนสำเร็จรูป ({zoneHits.length})
                  </span>
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
                <span className="csh-title">🛋️ สินค้า ({hits.length})</span>
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
        ) : activeCat === "all" ? (
          <AllGrid
            startDrag={startDrag}
            isSwapping={isSwapping}
            currentItem={currentItem}
            onSwapSelect={handleSwapSelect}
            onSeeAllZones={() => setActiveCat("zone")}
          />
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
          ZONE_THEMES.filter((t) => themeDisplayName(p.id, t.id)).map(
            (theme) => (
              <ProductCard
                key={`${p.id}-${theme.id}`}
                product={p}
                startDrag={startDrag}
                themeId={theme.id}
                isSwapping={false}
                isCurrent={false}
              />
            ),
          ),
        )}
    </>
  );
}

// ============================================================
// ZoneRail — carousel แนวนอนแบบ Canva (ปุ่ม ‹ › + ซ่อน scrollbar)
// ============================================================

function ZoneRail({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = railRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollBy = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const step = (200 + 12) * 2;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div
      className="zone-rail-wrap"
      data-can-left={canLeft ? "1" : "0"}
      data-can-right={canRight ? "1" : "0"}
    >
      {canLeft && (
        <button
          type="button"
          className="zone-rail-nav prev"
          aria-label="เลื่อนไปทางซ้าย"
          onClick={() => scrollBy(-1)}
        >
          ‹
        </button>
      )}

      <div
        className="zone-rail"
        ref={railRef}
        style={
          {
            "--mask-l": canLeft ? "var(--mask-size)" : "0px",
            "--mask-r": canRight ? "var(--mask-size)" : "0px",
          } as React.CSSProperties
        }
      >
        {children}
      </div>

      {canRight && (
        <button
          type="button"
          className="zone-rail-nav next"
          aria-label="เลื่อนไปทางขวา"
          onClick={() => scrollBy(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}

// ============================================================
// AllGrid — แท็บ "ทั้งหมด": โซนสำเร็จรูป + เฟอร์นิเจอร์ทั้งหมด
// ============================================================

function AllGrid({
  startDrag,
  isSwapping,
  currentItem,
  onSwapSelect,
  onSeeAllZones,
}: {
  startDrag: ReturnType<typeof useCardDrag>["startDrag"];
  isSwapping: boolean;
  currentItem: any;
  onSwapSelect: (pid: string) => void;
  onSeeAllZones: () => void;
}) {
  return (
    <>
      {/* ===== Section: ชุดโซนสำเร็จรูป ===== */}
      {!isSwapping && ZONES.length > 0 && (
        <>
          <div className="catalog-section-head">
            <span className="csh-title">🏠 ชุดโซนสำเร็จรูป</span>
            <button
              type="button"
              className="catalog-see-all"
              onClick={onSeeAllZones}
            >
              ดูทั้งหมด
            </button>
          </div>

          <ZoneRail>
            {ZONES.map((z) => (
              <ZoneCard
                key={z.id}
                zone={z}
                startDrag={startDrag}
                disabled={isSwapping}
              />
            ))}

            {/* ⭐ ปุ่มดูทั้งหมดท้าย carousel */}
            <button
              type="button"
              className="zone-rail-see-all"
              onClick={onSeeAllZones}
              aria-label="ดูโซนทั้งหมด"
            >
              <span className="zr-sa-circle" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </span>
              {/* <span className="zr-sa-label">ดูทั้งหมด</span> */}
            </button>
          </ZoneRail>
        </>
      )}

      {/* ===== Section: เฟอร์นิเจอร์ทั้งหมด ===== */}
      <div className="catalog-section-head">
        <span className="csh-title">
          🛋️ เฟอร์นิเจอร์
        </span>
          <span className="catalog-section-count">{PRODUCTS.length} ชิ้น</span>
      </div>

      {PRODUCTS.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          startDrag={startDrag}
          themeId={null}
          isSwapping={isSwapping}
          isCurrent={currentItem?.productId === p.id}
          onSwapClick={() => onSwapSelect(p.id)}
        />
      ))}
    </>
  );
}
