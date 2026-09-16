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

// ============================================================
// ⭐ เวลา (ใช้แสดง "แก้ไขล่าสุด" ในรายการห้อง)
// ============================================================

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 นาทีที่แล้ว" — เวลาแบบสัมพัทธ์เป็นภาษาไทย */
export function relativeTimeTh(ts: number, now = Date.now()): string {
  if (!ts || !Number.isFinite(ts)) return "";

  const diff = now - ts;
  if (diff < MINUTE) return "เมื่อสักครู่";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} นาทีที่แล้ว`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} ชั่วโมงที่แล้ว`;

  const days = Math.floor(diff / DAY);
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;

  try {
    return new Date(ts).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "";
  }
}

/** "12 มี.ค. 2568 14:30" — ใช้เป็น tooltip ของเวลาสัมพัทธ์ */
export function absoluteTimeTh(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return "";
  try {
    return new Date(ts).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

