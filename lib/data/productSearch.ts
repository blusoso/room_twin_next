// lib/data/productSearch.ts
// ⭐ "Smart search & filter" ของแคตตาล็อกสินค้า
//    เป็น pure module — ไม่รู้จัก Zustand / React / localStorage
//    → ไม่กระทบ serialized state, history, Three.js runtime หรือ placement flow เลย
//
//    ที่มาของคะแนน (score) ต่อ 1 คำค้น (token):
//      ชื่อตรงเป๊ะ 100 → ชื่อขึ้นต้น 80 → ชื่อมีคำ 60 → id 40 → tag 30 → ขนาด 20 → ราคาตรงเป๊ะ 18
//    ทุก token ต้อง match อย่างน้อย 1 ฟิลด์ (AND) — กันคำค้นหลายคำได้ผลลัพธ์มั่ว
import { CATEGORIES } from "./constants";
import { PRODUCTS, type ProductDef } from "./products";
import { ZONES, type ZoneDef } from "./zones";
import { THEME_BY_ID, ZONE_THEMES, themeDisplayName } from "./themes";
import { priceStr } from "@/lib/utils/format";

// ============================================================
// Types
// ============================================================

export type PriceBand = "under1k" | "1k-5k" | "5k-10k" | "over10k";
export type MountKind = "floor" | "wall" | "ceiling";
export type ThemeFacet =
  | "all"
  | "base"
  | "scandinavian"
  | "muji"
  | "boho"
  | "coastal";
export type SortKey = "relevance" | "priceAsc" | "priceDesc" | "name";

export interface CatalogFilters {
  /** ว่าง = ทุกหมวด */
  cats: string[];
  price: PriceBand | null;
  /** OR ภายใน facet นี้ */
  mounts: MountKind[];
  theme: ThemeFacet;
  /** ⭐ แสดงเฉพาะสินค้าที่ w/d/h ใส่ในห้องได้ (ยอมรับการหมุน) */
  fitRoom: boolean;
  sort: SortKey;
}

export interface CatalogHit {
  product: ProductDef;
  /** null = สินค้าพื้นฐาน, ไม่งั้นคือ variant ของธีมนั้น */
  themeId: string | null;
  score: number;
}

export interface CatalogSearchResult {
  hits: CatalogHit[];
  zones: ZoneDef[];
}

export interface CatalogSearchOptions {
  query: string;
  filters: CatalogFilters;
  /** ขนาดห้องจริง (เมตร) — ใช้กับตัวกรอง "พอดีกับห้อง" */
  room: { w: number; d: number; h: number };
}

// ============================================================
// ตัวเลือกของตัวกรอง (ป้ายไทย)
// ============================================================

export interface PriceBandDef {
  id: PriceBand;
  label: string;
  /** รวมขอบล่าง */
  min: number;
  /** ไม่รวมขอบบน (null = ไม่จำกัด) */
  maxExclusive: number | null;
}

export const PRICE_BANDS: PriceBandDef[] = [
  { id: "under1k", label: "ต่ำกว่า ฿1,000", min: 0, maxExclusive: 1000 },
  { id: "1k-5k", label: "฿1,000–5,000", min: 1000, maxExclusive: 5000 },
  { id: "5k-10k", label: "฿5,000–10,000", min: 5000, maxExclusive: 10001 },
  { id: "over10k", label: "มากกว่า ฿10,000", min: 10001, maxExclusive: null },
];

export const MOUNT_OPTIONS: { id: MountKind; label: string; icon: string }[] = [
  { id: "floor", label: "วางพื้น", icon: "🟫" },
  { id: "wall", label: "ติดผนัง", icon: "🧱" },
  { id: "ceiling", label: "ติดเพดาน", icon: "⬜" },
];

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "relevance", label: "แนะนำ" },
  { id: "priceAsc", label: "ราคาต่ำ → สูง" },
  { id: "priceDesc", label: "ราคาสูง → ต่ำ" },
  { id: "name", label: "ชื่อ ก → ฮ" },
];

/** ⭐ คำค้นยอดนิยม — แสดงเป็นชิปในสถานะ "ไม่พบสินค้า" */
export const SUGGESTED_QUERIES = [
  "เตียง",
  "โคมไฟ",
  "พรม",
  "ประตู",
  "แอร์",
  "ต้นไม้",
  "เก้าอี้",
  "ตู้เสื้อผ้า",
];

export function themeFacetOptions(): { id: ThemeFacet; label: string }[] {
  return [
    { id: "all", label: "ทั้งหมด" },
    { id: "base", label: "พื้นฐานเท่านั้น" },
    ...ZONE_THEMES.map((t) => ({ id: t.id as ThemeFacet, label: t.name })),
  ];
}

/** ⭐ ชื่อหมวดแบบไม่มีอีโมจิ (ใช้ทำ badge บนการ์ดตอนค้นหา) */
export function categoryLabel(id: string): string {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) return id;
  const i = c.label.indexOf(" ");
  return i >= 0 ? c.label.slice(i + 1).trim() : c.label;
}

// ============================================================
// Defaults / helpers ของ filter
// ============================================================

export function makeDefaultCatalogFilters(): CatalogFilters {
  return {
    cats: [],
    price: null,
    mounts: [],
    theme: "all",
    fitRoom: false,
    sort: "relevance",
  };
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters =
  makeDefaultCatalogFilters();

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.cats.length > 0 ||
    f.price !== null ||
    f.mounts.length > 0 ||
    f.theme !== "all" ||
    f.fitRoom ||
    f.sort !== "relevance"
  );
}

export function activeFilterCount(f: CatalogFilters): number {
  return (
    (f.cats.length > 0 ? 1 : 0) +
    (f.price !== null ? 1 : 0) +
    (f.mounts.length > 0 ? 1 : 0) +
    (f.theme !== "all" ? 1 : 0) +
    (f.fitRoom ? 1 : 0) +
    (f.sort !== "relevance" ? 1 : 0)
  );
}

/** query มีข้อความ หรือมี filter ใดๆ = โหมดค้นหา (ไม่ใช้ tab หมวดหมู่) */
export function isSearchMode(query: string, f: CatalogFilters): boolean {
  return normalizeText(query) !== "" || hasActiveFilters(f);
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ============================================================
// การติดตั้ง / ราคา / ขนาด
// ============================================================

/**
 * ⭐ ประเภทการติดตั้งของสินค้า (ใช้กับ facet "การติดตั้ง")
 *    - ติดเพดาน  = ceilingMount
 *    - ติดผนัง   = wallMount
 *    - วางพื้น   = groundAnchor หรือสินค้าที่ไม่ติดผนัง/เพดานเลย
 *      (ประตู/ม่าน/ประตูเลื่อน เป็นได้ทั้งผนังและพื้น)
 */
export function mountsOf(p: ProductDef): MountKind[] {
  const m: MountKind[] = [];
  if (p.ceilingMount) m.push("ceiling");
  if (p.wallMount) m.push("wall");
  if (p.groundAnchor || (!p.wallMount && !p.ceilingMount)) m.push("floor");
  return m;
}

export function inPriceBand(price: number, band: PriceBand): boolean {
  const b = PRICE_BANDS.find((x) => x.id === band);
  if (!b) return true;
  if (price < b.min) return false;
  if (b.maxExclusive !== null && price >= b.maxExclusive) return false;
  return true;
}

/**
 * ⭐ สินค้าใส่ในห้องได้ไหม (หน่วย dims = ซม. / room = เมตร)
 *    ยอมรับการหมุน 90° → สลับ w/d ได้ และ h ต้องไม่เกินความสูงห้อง
 */
export function fitsRoom(
  dims: { w: number; d: number; h: number },
  room: { w: number; d: number; h: number },
): boolean {
  const rw = room.w * 100;
  const rd = room.d * 100;
  const rh = room.h * 100;
  const plan = (dims.w <= rw && dims.d <= rd) || (dims.d <= rw && dims.w <= rd);
  return plan && dims.h <= rh;
}

// ============================================================
// Candidate index (สร้างครั้งเดียวตอน import)
// ============================================================

interface Candidate {
  product: ProductDef;
  themeId: string | null;
  /** ลำดับใน PRODUCTS (tiebreak ให้ผลคงที่) */
  order: number;
  /** -1 = base, ไม่งั้นคือลำดับใน ZONE_THEMES */
  themeOrder: number;
  /** ชื่อที่ใช้ให้คะแนน (ชื่อสินค้า + ชื่อ variant/ธีม) */
  names: string[];
  ids: string[];
  tags: string[];
  dims: string;
  price: string;
}

const CANDIDATES: Candidate[] = buildCandidates();

function buildCandidates(): Candidate[] {
  const out: Candidate[] = [];
  PRODUCTS.forEach((p, i) => {
    const dims = `${p.dims.w}x${p.dims.d}x${p.dims.h}`;
    const price = String(p.price);
    const tags = (p.tags ?? []).map(normalizeText);

    out.push({
      product: p,
      themeId: null,
      order: i,
      themeOrder: -1,
      names: [normalizeText(p.name)],
      ids: [normalizeText(p.id)],
      tags,
      dims,
      price,
    });

    ZONE_THEMES.forEach((t, ti) => {
      const display = themeDisplayName(p.id, t.id);
      if (!display) return; // ธีมนี้ไม่มี variant ของสินค้านี้ (เหมือน BuildPanel เดิม)
      out.push({
        product: p,
        themeId: t.id,
        order: i,
        themeOrder: ti,
        names: [normalizeText(display), normalizeText(t.name)],
        ids: [normalizeText(p.id), normalizeText(t.id)],
        tags,
        dims,
        price,
      });
    });
  });
  return out;
}

// ============================================================
// Scoring
// ============================================================

/** match ราคา/ขนาด เฉพาะคำค้นยาว ≥ 2 ตัวอักษร (กัน "8" ไปโดนของทั้งร้าน) */
const SHORT_FIELD_MIN_LEN = 2;

function scoreToken(c: Candidate, token: string): number {
  let s = 0;

  for (const n of c.names) {
    if (n === token) return 100;
    if (n.startsWith(token)) s = Math.max(s, 80);
    else if (n.includes(token)) s = Math.max(s, 60);
  }

  for (const id of c.ids) {
    if (id === token) s = Math.max(s, 45);
    else if (id.includes(token)) s = Math.max(s, 40);
  }

  if (c.tags.some((t) => t.includes(token))) s = Math.max(s, 30);

  if (s === 0 && token.length >= SHORT_FIELD_MIN_LEN) {
    if (c.dims.includes(token)) s = 20;
    else if (c.price === token) s = 18;
  }

  return s;
}

function themeFacetAllows(themeId: string | null, facet: ThemeFacet): boolean {
  if (facet === "all") return true;
  if (facet === "base") return themeId === null;
  if (!THEME_BY_ID.has(facet)) return true; // facet ที่ไม่รู้จัก → ไม่กรอง
  return themeId === null || themeId === facet;
}

// ============================================================
// Search
// ============================================================

export function searchCatalog({
  query,
  filters,
  room,
}: CatalogSearchOptions): CatalogSearchResult {
  const q = normalizeText(query);
  const tokens = q ? q.split(" ") : [];

  const scored: { c: Candidate; score: number }[] = [];

  for (const c of CANDIDATES) {
    if (!themeFacetAllows(c.themeId, filters.theme)) continue;
    if (filters.cats.length > 0 && !filters.cats.includes(c.product.cat)) {
      continue;
    }
    if (filters.price && !inPriceBand(c.product.price, filters.price)) continue;
    if (filters.mounts.length > 0) {
      const m = mountsOf(c.product);
      if (!filters.mounts.some((x) => m.includes(x))) continue;
    }
    if (filters.fitRoom && !fitsRoom(c.product.dims, room)) continue;

    let score = 0;
    let ok = true;
    for (const token of tokens) {
      const s = scoreToken(c, token);
      if (s === 0) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;

    scored.push({ c, score });
  }

  scored.sort((a, b) => compare(a, b, filters.sort));

  const hits: CatalogHit[] = scored.map(({ c, score }) => ({
    product: c.product,
    themeId: c.themeId,
    score,
  }));

  const zones =
    tokens.length === 0
      ? []
      : ZONES.filter((z) => {
          const name = normalizeText(z.name);
          const id = normalizeText(z.id);
          return tokens.every((t) => name.includes(t) || id.includes(t));
        });

  return { hits, zones };
}

function compare(
  a: { c: Candidate; score: number },
  b: { c: Candidate; score: number },
  sort: SortKey,
): number {
  const base = (c: Candidate) => (c.themeId ? 1 : 0);

  if (sort === "priceAsc") {
    return (
      a.c.product.price - b.c.product.price ||
      a.c.order - b.c.order ||
      a.c.themeOrder - b.c.themeOrder
    );
  }
  if (sort === "priceDesc") {
    return (
      b.c.product.price - a.c.product.price ||
      a.c.order - b.c.order ||
      a.c.themeOrder - b.c.themeOrder
    );
  }
  if (sort === "name") {
    return (
      a.c.product.name.localeCompare(b.c.product.name, "th") ||
      a.c.order - b.c.order ||
      a.c.themeOrder - b.c.themeOrder
    );
  }

  // relevance: คะแนนมาก่อน แล้วสินค้าพื้นฐานก่อน variant (เหมือนลำดับเดิมของแคตตาล็อก)
  return (
    b.score - a.score ||
    base(a.c) - base(b.c) ||
    a.c.order - b.c.order ||
    a.c.themeOrder - b.c.themeOrder
  );
}
