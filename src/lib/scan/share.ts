import type { ProductSpec } from "../types";
import { parseScan } from "./parse";
import { kitExtras } from "../kit/extras";

/** Pack a scanned guide into a link, so it opens on another device without a server copy. */
export async function encodeSpec(spec: ProductSpec): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function decodeSpec(s: string): Promise<ProductSpec | null> {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const raw = JSON.parse(await new Response(ds).text()) as ProductSpec;
    if (!raw || raw.archetype !== "custom" || !raw.custom?.parts?.length) return null;
    // a link is someone else's data: run it through the same checks as a fresh scan
    const r = parseScan({ ...raw, parts: raw.custom.parts, steps: raw.custom.steps, fromCover: raw.custom.fromCover });
    return r.spec ? { ...r.spec, variant: raw.variant ?? r.spec.variant, ...kitExtras(raw) } : null;
  } catch {
    return null;
  }
}
