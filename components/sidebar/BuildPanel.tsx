// components/sidebar/BuildPanel.tsx
"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRoomTwin } from "@/lib/state/store";
import {
  MAIN_CATEGORIES,
  ALL_TAB_SECTIONS,
  type MainCategoryDef,
  type SubCategoryDef,
} from "@/lib/data/constants";
import { PRODUCTS, PRODUCT_BY_ID } from "@/lib/data/products";
import { ZONES } from "@/lib/data/zones";
import { THEME_BY_ID, ZONE_THEMES, themeDisplayName } from "@/lib/data/themes";
import { categoryLabel, productsForSub } from "@/lib/data/productSearch";
import { useCatalogSearchResult } from "@/hooks/useCatalogSearchResult";
import { usePlacement } from "@/hooks/usePlacement";
import { useCardDrag } from "@/hooks/useCardDrag";
import ProductCard from "./ProductCard";
import ZoneCard from "./ZoneCard";
import CatalogSearch, { CatalogEmptyState } from "./CatalogSearch";
import { SegmentedControl } from "@/components/ui";

export default function BuildPanel() {
  const activeCat = useRoomTwin((s) => s.activeCat);
  const setActiveCat = useRoomTwin((s) => s.setActiveCat);
  const swapTargetUid = useRoomTwin((s) => s.swapTargetUid);
  const setSwapTarget = useRoomTwin((s) => s.setSwapTarget);
  const placedItems = useRoomTwin((s) => s.placedItems);
  const catalogQuery = useRoomTwin((s) => s.catalogQuery);

  // ⭐ default = "all" → sub "ทั้งหมด" ของ main cat
  const [activeSub, setActiveSub] = useState<string | null>("all");

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

  const { searchMode, hits, zones: zoneHits, resultCount } =
    useCatalogSearchResult();

  const handleSwapSelect = (pid: string) => {
    if (!swapTargetUid) return;
    window.dispatchEvent(
      new CustomEvent("roomtwin:swapSlot", {
        detail: { uid: swapTargetUid, productId: pid },
      }),
    );
    setSwapTarget(null);
  };

  const mainCat = useMemo<MainCategoryDef>(
    () =>
      MAIN_CATEGORIES.find((c) => c.id === activeCat) ??
      MAIN_CATEGORIES[0],
    [activeCat],
  );

  // ⭐ auto-select "all" เมื่อ main เปลี่ยน
  useEffect(() => {
    if (!mainCat.subs || mainCat.subs.length === 0) {
      setActiveSub(null);
      return;
    }
    const stillValid = mainCat.subs.some((s) => s.id === activeSub);
    if (!stillValid) setActiveSub(mainCat.subs[0].id);
  }, [mainCat, activeSub]);

  const currentSub = useMemo<SubCategoryDef | null>(() => {
    if (!mainCat.subs) return null;
    return mainCat.subs.find((s) => s.id === activeSub) ?? null;
  }, [mainCat, activeSub]);

  return (
    <>
      {/* ===== Swap header ===== */}
      {isSwapping && currentItem && (
        <div className="swap-header swapping show" id="swapHeader">
          <div className="swap-title" id="swapTitle">
            ⇄ กำลังเปลี่ยนสินค้า
            <small>
              ตอนนี้:{" "}
              {PRODUCT_BY_ID.get(currentItem.productId)?.name || ""} •
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

      {/* ===== Main category tabs (ชั้นที่ 1) ===== */}
      {!searchMode && (
        <div className="main-cat-row" id="tabs" role="tablist">
          {MAIN_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activeCat === c.id}
              className={`main-cat-card${activeCat === c.id ? " active" : ""}`}
              data-cat={c.id}
              onClick={() => setActiveCat(c.id)}
            >
              <span className="mc-icon" aria-hidden="true">
                {c.icon}
              </span>
              <span className="mc-label">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ===== Sub category row (ชั้นที่ 2) — ผ่าน <SegmentedControl> ===== */}
      {!searchMode && mainCat.subs && mainCat.subs.length > 0 && (
        <SegmentedControl
          containerClass="sub-cat-row"
          optionClass="sub-cat-pill"
          ariaLabel="หมวดย่อย"
          value={activeSub ?? ""}
          onChange={(v) => setActiveSub(v)}
          options={mainCat.subs.map((s) => ({
            value: s.id,
            label: <span className="sc-label">{s.label}</span>,
          }))}
        />
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

      {/* ===== Catalog ===== */}
      <div
        className={`catalog${searchMode ? " search-mode" : ""}`}
        id="catalog"
      >
        {searchMode ? (
          <>
            {zoneHits.length > 0 && (
              <section className="catalog-block">
                <div className="catalog-section-head">
                  <span className="csh-title">
                    🏠 โซนสำเร็จรูป ({zoneHits.length})
                  </span>
                </div>
                <HScroll>
                  {zoneHits.map((z) => (
                    <ZoneCard
                      key={z.id}
                      zone={z}
                      startDrag={startDrag}
                      disabled={isSwapping}
                      query={catalogQuery}
                    />
                  ))}
                </HScroll>
              </section>
            )}

            {hits.length > 0 && (
              <section className="catalog-block">
                <div className="catalog-section-head">
                  <span className="csh-title">
                    🛋️ สินค้า ({hits.length})
                  </span>
                </div>
                <HScroll>
                  {hits.map((h) => (
                    <ProductCard
                      key={`${h.product.id}-${h.themeId ?? "base"}`}
                      product={h.product}
                      startDrag={startDrag}
                      themeId={h.themeId}
                      isSwapping={isSwapping}
                      isCurrent={
                        currentItem?.productId === h.product.id
                      }
                      onSwapClick={() => handleSwapSelect(h.product.id)}
                      catBadge={categoryLabel(h.product.cat)}
                      themeName={
                        h.themeId
                          ? THEME_BY_ID.get(h.themeId)?.name
                          : undefined
                      }
                      query={catalogQuery}
                    />
                  ))}
                </HScroll>
              </section>
            )}

            {resultCount === 0 && (
              <CatalogEmptyState query={catalogQuery} />
            )}
          </>
        ) : activeCat === "all" ? (
          <AllGrid
            startDrag={startDrag}
            isSwapping={isSwapping}
            currentItem={currentItem}
            onSwapSelect={handleSwapSelect}
            onSeeAllZones={() => setActiveCat("zone")}
          />
        ) : activeCat === "zone" ? (
          <ZoneGrid startDrag={startDrag} isSwapping={isSwapping} />
        ) : (
          <SubProductGrid
            startDrag={startDrag}
            isSwapping={isSwapping}
            currentItem={currentItem}
            onSwapSelect={handleSwapSelect}
            sub={currentSub}
            mainCat={mainCat}
          />
        )}
      </div>
    </>
  );
}

/* ============================================================
   ⭐ helper: รวม product ids ของทุก sub ใน main cat
   ============================================================ */

function unionSubProducts(mainCat: MainCategoryDef): string[] {
  if (!mainCat.subs) return [];
  const set = new Set<string>();

  mainCat.subs.forEach((s) => {
    if (s.id === "all") return;
    s.cats?.forEach((c) => {
      PRODUCTS.filter((p) => p.cat === c).forEach((p) =>
        set.add(p.id),
      );
    });
    s.ids?.forEach((id) => set.add(id));
  });

  return Array.from(set);
}

/* ============================================================
   ⭐ SubProductGrid
   ============================================================ */

function SubProductGrid({
  startDrag,
  isSwapping,
  currentItem,
  onSwapSelect,
  sub,
  mainCat,
}: {
  startDrag: ReturnType<typeof useCardDrag>["startDrag"];
  isSwapping: boolean;
  currentItem: any;
  onSwapSelect: (pid: string) => void;
  sub: SubCategoryDef | null;
  mainCat: MainCategoryDef;
}) {
  if (!sub) return null;

  const ids =
    sub.id === "all" ? unionSubProducts(mainCat) : productsForSub(sub);
  const products = PRODUCTS.filter((p) => ids.includes(p.id));

  if (products.length === 0) {
    return (
      <div className="catalog-empty">
        <div className="catalog-empty-title">ยังไม่มีสินค้าในหมวดนี้</div>
        <div className="catalog-empty-sub">
          ลองเลือกหมวดย่อยอื่น หรือค้นหาด้วยชื่อสินค้า
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-grid">
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
    </div>
  );
}

/* ============================================================
   ⭐ ZoneGrid
   ============================================================ */

function ZoneGrid({
  startDrag,
  isSwapping,
}: {
  startDrag: ReturnType<typeof useCardDrag>["startDrag"];
  isSwapping: boolean;
}) {
  return (
    <div className="catalog-grid">
      {ZONES.map((z) => (
        <ZoneCard
          key={z.id}
          zone={z}
          startDrag={startDrag}
          disabled={isSwapping}
        />
      ))}
    </div>
  );
}

/* ============================================================
   HScroll
   ============================================================ */

const OVERFLOW_EPS = 16;

function HScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= OVERFLOW_EPS) {
      setCanLeft(false);
      setCanRight(false);
      return;
    }
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const step = (150 + 12) * 3;
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
        ref={ref}
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

/* ============================================================
   AllGrid
   ============================================================ */

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const pendingScrollRef = useRef<string | null>(null);

  const groups = useMemo(() => {
    return ALL_TAB_SECTIONS.map((c) => ({
      cat: c,
      products: PRODUCTS.filter((p) => p.cat === c.id),
    })).filter((g) => g.products.length > 0);
  }, []);

  useLayoutEffect(() => {
    if (expanded !== null) return;
    const targetId = pendingScrollRef.current;
    if (!targetId) return;
    pendingScrollRef.current = null;

    const container = document.getElementById("catalog");
    if (!container) return;
    const section = container.querySelector<HTMLElement>(
      `[data-section-id="${targetId}"]`,
    );
    if (!section) return;

    const cRect = container.getBoundingClientRect();
    const sRect = section.getBoundingClientRect();
    const offsetInContainer =
      sRect.top - cRect.top + container.scrollTop;

    container.scrollTo({
      top: Math.max(0, offsetInContainer - 8),
      behavior: "auto",
    });
  }, [expanded]);

  const handleExpand = (id: string) => {
    setExpanded(id);
    const container = document.getElementById("catalog");
    if (container) container.scrollTo({ top: 0, behavior: "auto" });
  };

  const handleBack = () => {
    pendingScrollRef.current = expanded;
    setExpanded(null);
  };

  if (expanded) {
    const g = groups.find((x) => x.cat.id === expanded);
    if (!g) {
      setExpanded(null);
      return null;
    }
    return (
      <>
        <div className="catalog-section-head expanded">
          <button
            type="button"
            className="catalog-back"
            onClick={handleBack}
          >
            ‹ ย้อนกลับ
          </button>
          <span className="csh-title">
            {g.cat.label}{" "}
            <span className="catalog-section-count">
              {g.products.length} ชิ้น
            </span>
          </span>
        </div>

        <div className="catalog-grid">
          {g.products.map((p) => (
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
        </div>
      </>
    );
  }

  return (
    <>
      {!isSwapping && ZONES.length > 0 && (
        <section className="catalog-block" data-section-id="zone">
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

          <HScroll>
            {ZONES.map((z) => (
              <ZoneCard
                key={z.id}
                zone={z}
                startDrag={startDrag}
                disabled={isSwapping}
              />
            ))}
          </HScroll>
        </section>
      )}

      {groups.map((g) => (
        <section
          key={g.cat.id}
          className="catalog-block"
          data-section-id={g.cat.id}
        >
          <div className="catalog-section-head">
            <span className="csh-title">
              {g.cat.label}{" "}
              <span className="catalog-section-count">
                {g.products.length}
              </span>
            </span>
            <button
              type="button"
              className="catalog-see-all"
              onClick={() => handleExpand(g.cat.id)}
            >
              ดูทั้งหมด
            </button>
          </div>

          <HScroll>
            {g.products.map((p) => (
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
          </HScroll>
        </section>
      ))}
    </>
  );
}