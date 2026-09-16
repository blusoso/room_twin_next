// components/sidebar/CatalogSearch.tsx
// ⭐ แถบค้นหาสินค้าในแคตตาล็อก (อยู่ใน sidebar)
//    ตัวกรอง (facet) ทั้งหมดอยู่ใน floating panel: components/panels/CatalogFilterPanel.tsx
//    state ทั้งหมดอยู่ใน Zustand แบบ transient (ไม่เข้า serialize/history)
"use client";
import { useEffect, useRef } from "react";
import { useRoomTwin } from "@/lib/state/store";
import { CATALOG_SEARCH_INPUT_ID } from "@/lib/data/constants";
import {
  SUGGESTED_QUERIES,
  activeFilterCount,
  isSearchMode,
} from "@/lib/data/productSearch";
import { useCatalogSearchResult } from "@/hooks/useCatalogSearchResult";

export default function CatalogSearch() {
  const query = useRoomTwin((s) => s.catalogQuery);
  const filters = useRoomTwin((s) => s.catalogFilters);
  const filtersOpen = useRoomTwin((s) => s.catalogFiltersOpen);
  const setCatalogQuery = useRoomTwin((s) => s.setCatalogQuery);
  const toggleCatalogFilters = useRoomTwin((s) => s.toggleCatalogFilters);
  const clearCatalogSearch = useRoomTwin((s) => s.clearCatalogSearch);
  const focusNonce = useRoomTwin((s) => s.catalogSearchFocusNonce);

  const { resultCount } = useCatalogSearchResult();

  const inputRef = useRef<HTMLInputElement | null>(null);

  // ⭐ โฟกัสช่องค้นหาเมื่อถูกขอจาก keyboard shortcut (/ หรือ Ctrl+K)
  useEffect(() => {
    if (focusNonce === 0) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [focusNonce]);

  const filterCount = activeFilterCount(filters);
  const searching = isSearchMode(query, filters);

  return (
    <div className="catalog-search" role="search">
      <div className="catalog-search-row">
        <span className="catalog-search-icon" aria-hidden>
          🔍
        </span>

        <input
          id={CATALOG_SEARCH_INPUT_ID}
          ref={inputRef}
          className="catalog-search-input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          maxLength={60}
          autoComplete="off"
          placeholder="ค้นหาสินค้า เช่น เตียง, โคมไฟ, โซฟา"
          aria-label="ค้นหาสินค้า"
          onChange={(e) => setCatalogQuery(e.target.value)}
        />

        {query !== "" && (
          <button
            type="button"
            className="catalog-search-clear"
            title="ล้างคำค้นหา"
            aria-label="ล้างคำค้นหา"
            onClick={() => setCatalogQuery("")}
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className={`catalog-filter-btn${filtersOpen ? " open" : ""}`}
          aria-expanded={filtersOpen}
          aria-controls="catalogFilterPanel"
          title="ตัวกรองสินค้า"
          onClick={toggleCatalogFilters}
        >
          ⚙ ตัวกรอง
          {filterCount > 0 && <span className="count">{filterCount}</span>}
        </button>
      </div>

      {searching && (
        <div className="catalog-status">
          <span className="catalog-status-text">
            พบ {resultCount} รายการ
            {query.trim() !== "" ? ` สำหรับ “${query.trim()}”` : ""}
          </span>
          <button type="button" onClick={clearCatalogSearch}>
            ล้างการค้นหา
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// สถานะ "ไม่พบสินค้า" — วางใน grid ของ BuildPanel
// ============================================================

export function CatalogEmptyState({ query }: { query: string }) {
  const setCatalogQuery = useRoomTwin((s) => s.setCatalogQuery);
  const clearCatalogSearch = useRoomTwin((s) => s.clearCatalogSearch);

  return (
    <div className="catalog-empty">
      <div className="catalog-empty-title">
        ไม่พบสินค้าที่ตรงกับ “{query.trim() || "ตัวกรองที่เลือก"}”
      </div>
      <div className="catalog-empty-sub">
        ลองพิมพ์คำอื่น หรือลดตัวกรองลง — หรือเลือกจากคำยอดนิยมด้านล่าง
      </div>

      <div className="catalog-empty-chips">
        {SUGGESTED_QUERIES.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            onClick={() => {
              clearCatalogSearch();
              setCatalogQuery(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="catalog-empty-chips">
        <button type="button" className="chip" onClick={clearCatalogSearch}>
          ล้างการค้นหา
        </button>
      </div>
    </div>
  );
}
