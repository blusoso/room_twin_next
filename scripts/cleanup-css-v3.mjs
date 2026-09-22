// scripts/cleanup-css-v3.mjs
// Safe CSS cleanup — ลบเฉพาะ selector ที่ระบุชัดในลิสต์
// ใช้ findRuleBody() ที่ match {} ให้ถูกต้อง — ไม่ใช้ regex sweep

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "app/roomtwin.css";
let src = readFileSync(PATH, "utf8").replace(/\r\n/g, "\n");
const lines0 = src.split("\n").length;
const removed = [];
const skipped = [];

/**
 * หา rule แรกที่ match selector (ที่ขึ้นบรรทัดใหม่ + ตามด้วย {)
 * return { start, open, close } หรือ null
 */
function findRuleBody(text, selector) {
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf(selector, i);
    if (idx < 0) return null;
    if (idx > 0 && text[idx - 1] !== "\n") {
      i = idx + 1;
      continue;
    }
    let j = idx + selector.length;
    while (j < text.length && (text[j] === " " || text[j] === "\t")) j++;
    if (j >= text.length || text[j] !== "{") {
      i = idx + 1;
      continue;
    }
    // หา close brace โดยนับ depth + ระวัง string/comment
    let depth = 0;
    let close = -1;
    let inStr = false;
    let q = "";
    let inComment = false;
    for (let k = j; k < text.length; k++) {
      const c = text[k];
      const n = text[k + 1];
      if (inComment) {
        if (c === "*" && n === "/") { inComment = false; k++; }
        continue;
      }
      if (inStr) {
        if (c === q && text[k - 1] !== "\\") inStr = false;
        continue;
      }
      if (c === "/" && n === "*") { inComment = true; k++; continue; }
      if (c === '"' || c === "'") { inStr = true; q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { close = k; break; }
      }
    }
    if (close < 0) return null;
    return { start: idx, open: j, close };
  }
  return null;
}

/** ลบ rule ทุกที่ที่ match selector */
function removeRule(selector, label) {
  let count = 0;
  while (true) {
    const r = findRuleBody(src, selector);
    if (!r) break;
    // กิน leading comment (ถ้ามี)
    let start = r.start;
    const before = src.slice(0, r.start);
    const cmt = before.match(/(\/\*\*?[\s\S]*?\*\/\s*)$/);
    if (
      cmt &&
      r.start - cmt[1].length > 0 &&
      src[r.start - cmt[1].length - 1] === "\n"
    ) {
      start = r.start - cmt[1].length;
    }
    let end = r.close + 1;
    if (src[end] === "\n") end++;
    src = src.slice(0, start) + src.slice(end);
    count++;
  }
  if (count > 0) removed.push(`${label} (${count})`);
  else skipped.push(label);
}

/* ═══════════════════════════════════════════════════════════════
   1. Header (Header.tsx ถูก comment) — ลบทั้ง section
   ═══════════════════════════════════════════════════════════════ */
removeRule(".wall-picker", "wall-picker");
removeRule(".wall-picker .lbl", "wall-picker .lbl");
removeRule(".swatch", "swatch");
removeRule(".swatch:hover", "swatch:hover");
removeRule(".swatch.active", "swatch.active");
removeRule(".reset-btn", "reset-btn");
removeRule(".reset-btn:hover", "reset-btn:hover");
removeRule(".cart-btn", "cart-btn");
removeRule(".cart-btn:hover", "cart-btn:hover");
removeRule(".cart-btn .cart-icon", "cart-btn .cart-icon");
removeRule(".cart-btn .cart-count", "cart-btn .cart-count");
removeRule(".cart-btn .cart-total", "cart-btn .cart-total");
removeRule(".history-controls", "history-controls");

/* ═══════════════════════════════════════════════════════════════
   2. Tabs เก่า (ไม่มีที่ใช้)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".tabs", "tabs");
removeRule(".tab", "tab");
removeRule(".tab.active", "tab.active");

/* ═══════════════════════════════════════════════════════════════
   3. Confirm (→ Modal + Button)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".confirm-actions button", "confirm-actions button");
removeRule(".confirm-cancel", "confirm-cancel");
removeRule(".confirm-ok", "confirm-ok");

/* ═══════════════════════════════════════════════════════════════
   4. Zone Edit (→ Button)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".zone-edit-actions button", "zone-edit-actions button");
removeRule(".zone-edit-cancel", "zone-edit-cancel");
removeRule(".zone-edit-save", "zone-edit-save");
removeRule(".zone-edit-save:hover", "zone-edit-save:hover");
removeRule(".zone-edit-save:disabled", "zone-edit-save:disabled");

/* ═══════════════════════════════════════════════════════════════
   5. Cart (→ IconButton + EmptyState)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".cart-close", "cart-close");
removeRule(".cart-close:hover", "cart-close:hover");
removeRule(".cart-empty", "cart-empty");
removeRule(".cart-empty .empty-icon", "cart-empty .empty-icon");

/* ═══════════════════════════════════════════════════════════════
   6. ItemPanel (→ Button + IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".ip-close", "ip-close");
removeRule(".buy-btn", "buy-btn");
removeRule(".buy-btn:hover", "buy-btn:hover");

/* ═══════════════════════════════════════════════════════════════
   7. CornerViews (→ Button)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".corner-view-btn", "corner-view-btn");
removeRule(".corner-view-btn:hover", "corner-view-btn:hover");
removeRule(".corner-view-btn:active", "corner-view-btn:active");
removeRule(".corner-view-btn.wide", "corner-view-btn.wide");

/* ═══════════════════════════════════════════════════════════════
   8. Customize (→ Button + IconButton + SectionLabel)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".cz-close", "cz-close");
removeRule(".cz-close:hover", "cz-close:hover");
removeRule(".cz-close:active", "cz-close:active");
removeRule(".cz-foot button", "cz-foot button");
removeRule(".cz-foot button:active", "cz-foot button:active");
removeRule(".cz-reset", "cz-reset");
removeRule(".cz-reset:hover", "cz-reset:hover");
removeRule(".cz-save", "cz-save");
removeRule(".cz-save:hover", "cz-save:hover");
removeRule(".cz-section-label", "cz-section-label");
removeRule(".cz-section-label::after", "cz-section-label::after");

/* ═══════════════════════════════════════════════════════════════
   9. Zone Theme (→ Button + IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".ztp-reset", "ztp-reset");
removeRule(".ztp-reset:hover", "ztp-reset:hover");
removeRule(".ztp-close", "ztp-close");
removeRule(".ztp-close:hover", "ztp-close:hover");

/* ═══════════════════════════════════════════════════════════════
   10. Room Setup (→ IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".rsu-close", "rsu-close");
removeRule(".rsu-close:hover", "rsu-close:hover");
removeRule(".rsu-add-btn", "rsu-add-btn");
removeRule(".rsu-add-btn:hover", "rsu-add-btn:hover");
removeRule(".rsu-del-btn", "rsu-del-btn");
removeRule(".rsu-item:hover .rsu-del-btn", "rsu-item:hover .rsu-del-btn");
removeRule(".rsu-del-btn:hover", "rsu-del-btn:hover");

/* ═══════════════════════════════════════════════════════════════
   11. Catalog Filter (→ IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".cfp-close", "cfp-close");
removeRule(".cfp-close:hover", "cfp-close:hover");

/* ═══════════════════════════════════════════════════════════════
   12. Blocks Editor (→ Button + IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".blocks-icon-btn", "blocks-icon-btn");
removeRule(".blocks-icon-btn:hover", "blocks-icon-btn:hover");
removeRule(".blocks-icon-btn:disabled", "blocks-icon-btn:disabled");
removeRule(".blocks-icon-btn:disabled:hover", "blocks-icon-btn:disabled:hover");
removeRule(".blocks-ghost-btn", "blocks-ghost-btn");
removeRule(".blocks-ghost-btn:hover", "blocks-ghost-btn:hover");
removeRule(
  '.blocks-ghost-btn[aria-expanded="true"]',
  "blocks-ghost-btn[aria-expanded]",
);
removeRule(".blocks-close", "blocks-close");
removeRule(".blocks-close:hover", "blocks-close:hover");
removeRule(".blocks-apply", "blocks-apply");
removeRule(".blocks-apply:hover:not(:disabled)", "blocks-apply:hover:not");
removeRule(".blocks-apply:disabled", "blocks-apply:disabled");

/* ═══════════════════════════════════════════════════════════════
   13. Room Structure Panel (→ Button + IconButton + SectionLabel)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".rsp-close", "rsp-close");
removeRule(".rsp-close:hover", "rsp-close:hover");
removeRule(".rsp-fb", "rsp-fb");
removeRule(".rsp-fb:hover:not(:disabled)", "rsp-fb:hover:not");
removeRule(".rsp-fb:disabled", "rsp-fb:disabled");
removeRule(".rsp-cta", "rsp-cta");
removeRule(".rsp-cta:hover", "rsp-cta:hover");
removeRule(".rsp-cta:active", "rsp-cta:active");

/* ═══════════════════════════════════════════════════════════════
   14. Save/Share Modal (→ IconButton)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".ss-close", "ss-close");
removeRule(".ss-empty", "ss-empty");

/* ═══════════════════════════════════════════════════════════════
   15. Loading Screen (→ Button)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".rt-btn", "rt-btn");
removeRule(".rt-btn:hover", "rt-btn:hover");
removeRule(".rt-btn.primary", "rt-btn.primary");
removeRule(".rt-btn.primary:hover", "rt-btn.primary:hover");

/* ═══════════════════════════════════════════════════════════════
   16. Room Tree (→ IconButton + EmptyState)
   ═══════════════════════════════════════════════════════════════ */
removeRule(".tree-action-btn", "tree-action-btn");
removeRule(".tree-action-btn:hover", "tree-action-btn:hover");
removeRule(".tree-action-btn.danger:hover", "tree-action-btn.danger:hover");
removeRule(".room-tree-empty", "room-tree-empty");
removeRule(".room-tree-empty small", "room-tree-empty small");

/* ═══════════════════════════════════════════════════════════════
   17. Icon header btn เก่า (radius 50%) — ตัวใหม่ (IconButton section) เก็บไว้
   ═══════════════════════════════════════════════════════════════ */
removeRule(".icon-header-btn", "icon-header-btn (เก่า)");
removeRule(
  ".icon-header-btn:hover:not(:disabled)",
  "icon-header-btn:hover (เก่า)",
);
removeRule(".icon-header-btn:disabled", "icon-header-btn:disabled (เก่า)");
removeRule(
  ".icon-header-btn:focus-visible",
  "icon-header-btn:focus-visible (เก่า)",
);

/* ═══════════════════════════════════════════════════════════════
   จัดระเบียบ
   ═══════════════════════════════════════════════════════════════ */
src = src.replace(/[ \t]+\n/g, "\n");
src = src.replace(/\n{3,}/g, "\n\n").trim() + "\n";

writeFileSync(PATH, src, "utf8");
const lines1 = src.split("\n").length;

console.log("=".repeat(52));
console.log(`✓ Cleanup v3 — ลบ ${removed.length} groups`);
console.log("=".repeat(52));
console.log("\nลบแล้ว:");
removed.forEach((r) => console.log("  ✓ " + r));
if (skipped.length) {
  console.log("\nข้าม (ไม่พบ — ปกติ):");
  skipped.forEach((s) => console.log("  · " + s));
}
console.log("\n" + "=".repeat(52));
console.log(`📄 ${PATH}: ${lines0} → ${lines1} lines (−${lines0 - lines1})`);
console.log("=".repeat(52));