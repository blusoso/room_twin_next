export function priceStr(n: number) {
  return "฿" + n.toLocaleString("th-TH");
}

export function hexOf(num: number) {
  return "#" + (num >>> 0).toString(16).padStart(6, "0");
}

export function numOf(hex: string) {
  return parseInt(hex.replace("#", ""), 16);
}

export function affiliateUrl(p: { id: string }) {
  return `https://example-shop.com/product/${p.id}?ref=roomtwin_aff`;
}

// ============================================================
// ⭐ หน่วยวัด (โหมด 📏 ไม้บรรทัดห้อง)
// ============================================================

/** "45 ซม." — ระยะเส้นไกด์จาก object ถึงผนัง (เซนติเมตร) */
export function cmStr(m: number) {
  return Math.round(m * 100) + " ซม.";
}
