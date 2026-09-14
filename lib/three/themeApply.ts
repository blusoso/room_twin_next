// lib/three/themeApply.ts
import { THEME_BY_ID, THEME_COLOR_MAP, WOOD_MAIN_PRODUCTS, themeDisplayName } from "@/lib/data/themes";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { PARAM_SCHEMA } from "@/lib/data/schemas";
import type { PlacedItem } from "@/lib/state/types";

export function applyThemeToItem(item: PlacedItem, tid: string) {
  const theme = THEME_BY_ID.get(tid);
  if (!theme) return;
  const p = PRODUCT_BY_ID.get(item.productId);
  if (!p) return;

  item.themeOverride = tid;
  const tn = themeDisplayName(item.productId, tid);
  item.displayName = tn || null;

  const schema = PARAM_SCHEMA[item.productId];
  if (schema && schema.colors) {
    const isWoodMain = WOOD_MAIN_PRODUCTS.has(item.productId);
    schema.colors.forEach((cd) => {
      const role = THEME_COLOR_MAP[cd.key];
      if (!role) return;
      if (cd.key === "color" && isWoodMain) {
        item.params.color = theme.wood;
        return;
      }
      const val = (theme as any)[role];
      if (val === undefined) return;
      item.params[cd.key] = val;
    });
  }
}