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
import {
  IconButton,
  Panel,
  SectionLabel,
  EmptyState,
  Chip,
} from "@/components/ui";

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
    <Panel
      open={open}
      onClose={close}
      panelClass="catalog-filter-panel"
      backdropClass=""
    >
      <div className="cfp-head">
        <div className="cfp-title">
          ⚙ ตัวกรองสินค้า
          <span className="cfp-count">พบ {resultCount} รายการ</span>
        </div>
        <IconButton label="ปิดตัวกรอง" size="sm" onClick={close}>
          ✕
        </IconButton>
      </div>

      <div className="cfp-body">
        {/* ===== หมวดหมู่ ===== */}
        <div className="filter-group">
          <SectionLabel>หมวดหมู่</SectionLabel>
          <div className="filter-chips">
            {CATEGORIES.filter((c) => c.id !== "zone").map((c) => (
              <Chip
                key={c.id}
                active={filters.cats.includes(c.id)}
                onClick={() =>
                  setCatalogFilters({ cats: toggleInList(filters.cats, c.id) })
                }
              >
                {categoryLabel(c.id)}
              </Chip>
            ))}
          </div>
        </div>

        {/* ===== ช่วงราคา ===== */}
        <div className="filter-group">
          <SectionLabel>ช่วงราคา</SectionLabel>
          <div className="filter-chips">
            {PRICE_BANDS.map((b) => (
              <Chip
                key={b.id}
                active={filters.price === b.id}
                onClick={() =>
                  setCatalogFilters({
                    price: filters.price === b.id ? null : b.id,
                  })
                }
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ===== การติดตั้ง ===== */}
        <div className="filter-group">
          <SectionLabel>การติดตั้ง</SectionLabel>
          <div className="filter-chips">
            {MOUNT_OPTIONS.map((m) => (
              <Chip
                key={m.id}
                active={filters.mounts.includes(m.id)}
                icon={m.icon}
                onClick={() =>
                  setCatalogFilters({
                    mounts: toggleInList(filters.mounts, m.id),
                  })
                }
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ===== ธีม ===== */}
        <div className="filter-group">
          <SectionLabel>ธีม</SectionLabel>
          {isSwapping && (
            <span className="filter-note">
              โหมดเปลี่ยนสินค้าแสดงเฉพาะสินค้าพื้นฐาน
            </span>
          )}
          <div className="filter-chips">
            {themeFacetOptions().map((t) => (
              <Chip
                key={t.id}
                active={filters.theme === t.id}
                disabled={isSwapping && t.id !== "base"}
                onClick={() => setThemeFacet(t.id)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ===== พอดีกับห้อง ===== */}
        <div className="filter-group">
          <SectionLabel>ขนาด</SectionLabel>
          <div className="filter-chips">
            <Chip
              active={filters.fitRoom}
              onClick={() => setCatalogFilters({ fitRoom: !filters.fitRoom })}
            >
              ✅ พอดีกับห้อง ({room.w.toFixed(1)}×{room.d.toFixed(1)}×
              {room.h.toFixed(1)} ม.)
            </Chip>
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
        <Chip
          disabled={filterCount === 0}
          title="ล้างตัวกรอง (คำค้นหายังอยู่)"
          onClick={() => setCatalogFilters(makeDefaultCatalogFilters())}
        >
          ล้างตัวกรอง
        </Chip>
        <Chip onClick={close}>ปิด</Chip>
      </div>
    </Panel>
  );
}
