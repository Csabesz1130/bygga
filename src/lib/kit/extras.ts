import type { ProductSpec, TipKey } from "../types";
import { clean } from "../scan/parse";

const TIP_KEYS: TipKey[] = ["general", "frame", "back", "shelves", "drawers", "doors", "legs", "slats", "cushions", "anchor"];

/** What a kit carries beyond a scan: a link to the maker's help and its own tips. Read again whenever a kit arrives from a link. */
export function kitExtras(raw: unknown, note?: (s: string) => void): Pick<ProductSpec, "support" | "tips"> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Pick<ProductSpec, "support" | "tips"> = {};
  if (r.support !== undefined) {
    const url = httpsUrl(r.support);
    if (url) out.support = url;
    else note?.(`support was dropped: it must be an https:// link.`);
  }
  if (r.tips && typeof r.tips === "object") {
    const tips: Partial<Record<TipKey, string>> = {};
    for (const [k, v] of Object.entries(r.tips as Record<string, unknown>)) {
      if (!TIP_KEYS.includes(k as TipKey) || typeof v !== "string" || !clean(v)) {
        note?.(`tips.${k} was dropped: tips are text under one of ${TIP_KEYS.join(", ")}.`);
        continue;
      }
      if (clean(v).length > 220) note?.(`tips.${k} was cut to 220 characters.`);
      tips[k as TipKey] = clean(v).slice(0, 220);
    }
    if (Object.keys(tips).length) out.tips = tips;
  }
  return out;
}

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
