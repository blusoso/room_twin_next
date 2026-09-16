// components/panels/CatalogFilterPanel.tsx
// ⭐ Floating filter panel — ลอยอยู่ในพื้นที่ viewport (ข้างขวาของ sidebar)
//    mount จาก components/viewport/Viewport.tsx ใน .viewport-wrap
//    → ไม่มีทางทับ sidebar หรือ drawer บนมือถือ (ถูกจำกัดขอบเขตโดยโครงสร้าง layout)
//    state ทั้งหมดเป็น transient ใน Zustand (ไม่เข้า serialize/history)
"use client";
import { useCallback, useEffect } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { CATEGORIES } from "@/lib/data/constants";
import {
  MOUNT_OPTIONS,
  PRICE_BANDS,
  SORT_OPTIONS,
  activeFilterCount,
  categoryLabel,
  makeDefaultCatalogFilters,
  themeFacetOptions,
  toggleInList,
  type SortKey,
  type ThemeFacet,
} from "@/lib/data/productSearch";
import { useCatalogSearchResult } from "@/hooks/useCatalogSearchResult";

export default function CatalogFilterPanel() {
  const filtersOpen = useRoomTwin((s) => s.catalogFiltersOpen);
  const activePanel = useRoomTwin((s) => s.activePanel);
  const filters = useRoomTwin((s) => s.catalogFilters);
  const setCatalogFilters = useRoomTwin((s) => s.setCatalogFilters);
  const setCatalogFiltersOpen = useRoomTwin((s) => s.setCatalogFiltersOpen);
  const isSwapping = useRoomTwin((s) => !!s.swapTargetUid);
  const room = useRoomTwin((s) => s.room);

  const { resultCount } = useCatalogSearchResult();

  // ⭐ แสดงเฉพาะแท็บ "สร้างห้อง" (แท็บห้องของฉันไม่มีอะไรให้กรอง)
  const open = filtersOpen && activePanel === "build";

  const close = useCallback(() => {
    setCatalogFiltersOpen(false);
  }, [setCatalogFiltersOpen]);

  // ⭐ คลิกนอกแผง = ปิด
  //    ยกเว้นคลิกในแผงเอง และคลิกใน sidebar (#asideEl) ซึ่งต้องใช้งานได้เต็มที่
  //    ราวกับไม่มีแผงอยู่ — รวมถึงปุ่ม ⚙ ที่ toggle อยู่ (อยู่ใน .catalog-search)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(".catalog-filter-panel")) return;
      if (t.closest("#asideEl")) return;
      if (t.closest(".catalog-search")) return;
      setCatalogFiltersOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, setCatalogFiltersOpen]);

  const setThemeFacet = (id: ThemeFacet) => {
    // เลือกซ้ำ = กลับไป "ทั้งหมด"
    setCatalogFilters({ theme: filters.theme === id ? "all" : id });
  };

  const filterCount = activeFilterCount(filters);

  return (
    <aside
      id="catalogFilterPanel"
      role="region"
      aria-label="ตัวกรองสินค้า"
      className={`catalog-filter-panel${open ? " show" : ""}`}
      aria-hidden={!open}
      // ⭐ ปิดอยู่ = inert (React 19 รับ boolean) → โฟกัส/คลิกเข้าไม่ได้
      //    หมายเหตุ: ห้ามใช้ inert="" (React 19 ตีความเป็น false + เตือนใน console)
      inert={!open}
      // ⭐ Inline styles — บังคับแม้ CSS ไม่โหลด (แพทเทิร์นเดียวกับ CustomizePanel)
      style={{
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div className="cfp-head">
        <div className="cfp-title">
          ⚙ ตัวกรองสินค้า
          <span className="cfp-count">พบ {resultCount} รายการ</span>
        </div>
        <button
          type="button"
          className="cfp-close"
          onClick={close}
          title="ปิดตัวกรอง"
          aria-label="ปิดตัวกรอง"
        >
          ✕
        </button>
      </div>

      <div className="cfp-body">
        {/* ===== หมวดหมู่ ===== */}
        <div className="filter-group">
          <span className="filter-label">หมวดหมู่</span>
          <div className="filter-chips">
            {CATEGORIES.filter((c) => c.id !== "zone").map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${filters.cats.includes(c.id) ? " active" : ""}`}
                aria-pressed={filters.cats.includes(c.id)}
                onClick={() =>
                  setCatalogFilters({ cats: toggleInList(filters.cats, c.id) })
                }
              >
                {categoryLabel(c.id)}
              </button>
            ))}
          </div>
        </div>

        {/* ===== ช่วงราคา ===== */}
        <div className="filter-group">
          <span className="filter-label">ช่วงราคา</span>
          <div className="filter-chips">
            {PRICE_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`chip${filters.price === b.id ? " active" : ""}`}
                aria-pressed={filters.price === b.id}
                onClick={() =>
                  setCatalogFilters({
                    price: filters.price === b.id ? null : b.id,
                  })
                }
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== การติดตั้ง ===== */}
        <div className="filter-group">
          <span className="filter-label">การติดตั้ง</span>
          <div className="filter-chips">
            {MOUNT_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip${
                  filters.mounts.includes(m.id) ? " active" : ""
                }`}
                aria-pressed={filters.mounts.includes(m.id)}
                onClick={() =>
                  setCatalogFilters({
                    mounts: toggleInList(filters.mounts, m.id),
                  })
                }
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== ธีม ===== */}
        <div className="filter-group">
          <span className="filter-label">ธีม</span>
          {isSwapping && (
            <span className="filter-note">
              โหมดเปลี่ยนสินค้าแสดงเฉพาะสินค้าพื้นฐาน
            </span>
          )}
          <div className="filter-chips">
            {themeFacetOptions().map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip${filters.theme === t.id ? " active" : ""}`}
                aria-pressed={filters.theme === t.id}
                disabled={isSwapping && t.id !== "base"}
                onClick={() => setThemeFacet(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== พอดีกับห้อง ===== */}
        <div className="filter-group">
          <span className="filter-label">ขนาด</span>
          <div className="filter-chips">
            <button
              type="button"
              className={`chip${filters.fitRoom ? " active" : ""}`}
              aria-pressed={filters.fitRoom}
              onClick={() => setCatalogFilters({ fitRoom: !filters.fitRoom })}
            >
              ✅ พอดีกับห้อง ({room.w.toFixed(1)}×{room.d.toFixed(1)}×
              {room.h.toFixed(1)} ม.)
            </button>
          </div>
        </div>

        {/* ===== เรียงลำดับ ===== */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="catalogSort">
            เรียงลำดับ
          </label>
          <select
            id="catalogSort"
            value={filters.sort}
            onChange={(e) =>
              setCatalogFilters({ sort: e.target.value as SortKey })
            }
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cfp-foot">
        <button
          type="button"
          className="chip"
          disabled={filterCount === 0}
          title="ล้างตัวกรอง (คำค้นหายังอยู่)"
          onClick={() =>
            setCatalogFilters(makeDefaultCatalogFilters())
          }
        >
          ล้างตัวกรอง
        </button>
        <button type="button" className="chip" onClick={close}>
          ปิด
        </button>
      </div>
    </aside>
  );
}
