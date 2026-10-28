import type { CustomPart, HwKind, ProductSpec, Vec3 } from "../types";
import { boxOf } from "../plan/custom";
import { buildPlan } from "../plan";
import { checkScan, clean, hwKind, parseScan, pose, tool, warn } from "../scan/parse";
import { encodeSpec } from "../scan/share";
import { kitExtras } from "./extras";

/**
 * A kit is a guide a maker writes for their own product: the same parts and steps a scan produces, written by hand.
 * It goes through the scan's checks, but nothing is dropped quietly: every change is reported so the maker can fix the file.
 */
export interface KitResult {
  spec: ProductSpec | null;
  issues: string[]; // blocking: no guide
  warnings: string[]; // dropped, cut, moved or read as something else
}

const TOP = ["kit", "name", "brand", "variant", "category", "minutes", "people", "difficulty", "support", "parts", "steps", "tips", "watchOut"];
const PART_KEYS = ["id", "label", "name", "size", "pos", "shape", "material"];
const STEP_KEYS = ["title", "detail", "add", "fix", "tools", "people", "pose", "warnings"];
const FIX_KEYS = ["kind", "count", "len", "dia", "to"];
const MATERIALS = ["board", "fiber", "wood", "metal", "soft"];
// the fittings a kit can name; anything else is read as the nearest of these
const HW_KINDS: HwKind[] = ["dowel", "camScrew", "cam", "screw", "nail", "pin", "legScrew", "bolt", "plate", "bracket", "knob", "handle", "hinge", "glide"];
const MAX_PARTS = 80, MAX_STEPS = 40, MAX_FIX = 48;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const vec3 = (v: unknown): Vec3 | null => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => Number.isFinite(Number(n))) ? (v.slice(0, 3).map(Number) as Vec3) : null);
const extra = (o: Obj, known: string[]) => Object.keys(o).filter((k) => !known.includes(k));
const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? clean(String(v)) : "");

export function parseKit(raw: unknown): KitResult {
  const issues: string[] = [], warnings: string[] = [];
  const w = (s: string) => warnings.push(s);
  if (!isObj(raw)) return { spec: null, issues: ["A kit is a JSON object with name, parts and steps."], warnings };
  if (raw.kit !== 1) w(`kit should be 1 (the format version), got ${JSON.stringify(raw.kit ?? null)}.`);
  for (const k of extra(raw, TOP)) w(`${k} is not a kit field and was ignored.`);
  const name = text(raw.name);
  if (!name) issues.push("name is missing.");
  else if (name.length > 40) w(`name was cut to 40 characters.`);
  for (const k of ["brand", "category"] as const) if (text(raw[k]).length > 40) w(`${k} was cut to 40 characters.`);
  if (text(raw.variant).length > 60) w(`variant was cut to 60 characters.`);
  if (!Array.isArray(raw.parts) || !raw.parts.length) issues.push("parts is missing or empty.");
  if (!Array.isArray(raw.steps) || !raw.steps.length) issues.push("steps is missing or empty.");
  if (issues.length) return { spec: null, issues, warnings };

  // parts, as the scan will read them
  const rawParts = raw.parts as unknown[];
  if (rawParts.length > MAX_PARTS) w(`Only the first ${MAX_PARTS} of ${rawParts.length} parts are kept.`);
  const kept: { id: string; size: Vec3; pos: Vec3 }[] = [];
  const seen = new Set<string>();
  rawParts.slice(0, MAX_PARTS).forEach((p, i) => {
    const at = `Part ${i + 1}${isObj(p) && p.id !== undefined ? ` (${String(p.id)})` : ""}`;
    if (!isObj(p)) return w(`${at} was dropped: it isn't an object.`);
    const size = vec3(p.size), pos = vec3(p.pos);
    if (p.id === undefined || !size || !pos) return w(`${at} was dropped: it needs id, size [w, h, d] and pos [x, y, z] in mm.`);
    const id = String(p.id).trim();
    if (seen.has(id.toLowerCase())) w(`${at}: the id is used twice, steps can only reach the first one.`);
    seen.add(id.toLowerCase());
    if (!text(p.name)) w(`${at} has no name, it shows as "Part".`);
    else if (text(p.name).length > 40) w(`${at}: name was cut to 40 characters.`);
    if (p.label !== undefined && String(p.label).trim().length > 3) w(`${at}: label is over 3 characters and was dropped.`);
    if (p.shape !== undefined && p.shape !== "box" && p.shape !== "cyl") w(`${at}: shape must be box or cyl, it is drawn as a box.`);
    if (p.material !== undefined && !MATERIALS.includes(String(p.material))) w(`${at}: material must be one of ${MATERIALS.join(", ")}, it was dropped.`);
    if (size.some((n) => Math.abs(n) < 2 || Math.abs(n) > 3200)) w(`${at}: sizes are kept between 2 and 3200 mm.`);
    for (const k of extra(p, PART_KEYS)) w(`${at}: ${k} is not supported in kits and was ignored.`);
    kept.push({ id, size, pos });
  });
  const ids = new Map(kept.map((p) => [p.id.toLowerCase(), p.id]));

  // steps, as the scan will read them
  const rawSteps = raw.steps as unknown[];
  if (rawSteps.length > MAX_STEPS) w(`Only the first ${MAX_STEPS} of ${rawSteps.length} steps are kept.`);
  const added = new Set<string>();
  rawSteps.slice(0, MAX_STEPS).forEach((s, i) => {
    const at = `Step ${i + 1}`;
    if (!isObj(s)) return w(`${at} was dropped: it isn't an object.`);
    if (!text(s.title)) w(`${at} has no title, it shows as "Next step".`);
    else if (text(s.title).length > 80) w(`${at}: title was cut to 80 characters.`);
    if (text(s.detail).length > 240) w(`${at}: detail was cut to 240 characters.`);
    for (const k of extra(s, STEP_KEYS)) w(`${at}: ${k} is not supported in kits and was ignored.`);
    for (const a of list(s.add)) {
      const id = ids.get(a.trim().toLowerCase());
      if (!id) w(`${at}: add names part ${a}, which isn't in parts.`);
      else added.add(id);
    }
    for (const t of list(s.tools)) if (!tool(t)) w(`${at}: tool "${t}" isn't one we draw and was dropped.`);
    for (const x of list(s.warnings)) if (!warn(x)) w(`${at}: warning "${x}" isn't one we know and was dropped.`);
    if (s.pose !== undefined && !pose(String(s.pose))) w(`${at}: pose "${String(s.pose)}" wasn't understood, the build stays as it was.`);
    if (s.fix !== undefined && !Array.isArray(s.fix)) w(`${at}: fix must be a list.`);
    (Array.isArray(s.fix) ? s.fix : []).forEach((f, j) => {
      const fat = `${at}, fitting ${j + 1}`;
      if (!isObj(f) || f.kind === undefined) return w(`${fat} was dropped: it needs a kind.`);
      const said = String(f.kind);
      const kind = hwKind(said);
      if (!kind) return w(`${fat}: "${said}" is a small loose piece we don't draw, it was dropped.`);
      if (kind.toLowerCase() !== said.trim().toLowerCase()) w(`${fat}: "${said}" is drawn as ${kind}. Use one of ${HW_KINDS.join(", ")} to choose.`);
      const count = Math.round(Number(f.count ?? 1));
      if (!(count > 0)) w(`${fat} was dropped: count must be 1 or more.`);
      else if (count > MAX_FIX) w(`${fat}: count was cut to ${MAX_FIX}.`);
      for (const t of list(f.to)) if (!ids.has(t.trim().toLowerCase())) w(`${fat}: to names part ${t}, which isn't in parts.`);
      for (const k of extra(f, FIX_KEYS)) w(`${fat}: ${k} is not supported in kits and was ignored.`);
    });
  });
  for (const p of kept) if (!added.has(p.id)) w(`Part ${p.id} isn't added in any step.`);

  // the size the parts span, so the scan never rescales a small product as if it were written in cm
  const boxes = kept.map((p) => boxOf({ size: p.size.map((n) => Math.min(3200, Math.max(2, Math.abs(n)))) as Vec3, pos: p.pos }));
  const span = (k: number) => (boxes.length ? Math.max(...boxes.map((b) => b.max[k])) - Math.min(...boxes.map((b) => b.min[k])) : 0) / 10;
  const r = parseScan({ ...raw, name, size: { w: span(0), h: span(1), d: span(2) }, archetype: "custom" });
  if (!r.spec?.custom) return { spec: null, issues: r.check.issues.length ? r.check.issues : ["No usable parts."], warnings };

  // parts the scan nudged to close a gap: the whole build moves to the floor together, anything else moved on its own
  const out = r.spec.custom.parts;
  const byId = new Map(kept.map((p) => [p.id, p]));
  const moves = out.map((p) => ({ p, d: byId.get(p.id) ? sub(p.pos, byId.get(p.id)!.pos) : null }));
  const shift = common(moves.map((m) => m.d).filter((d): d is Vec3 => !!d));
  for (const { p, d } of moves) {
    if (!d) continue;
    const off = sub(d, shift).map(Math.abs);
    const far = Math.max(...off);
    if (far > 0.5) w(`Part ${p.id} was moved ${Math.round(far * 10) / 10} mm to touch its neighbour. Check its pos.`);
  }

  const check = checkScan(out as CustomPart[]);
  if (!check.ok) issues.push(...check.issues);
  else warnings.push(...check.issues);
  const watch = Array.isArray(raw.watchOut) ? raw.watchOut.length : 0;
  if (watch > 2) w(`Only the first 2 of ${watch} watchOut lines are kept.`);

  const spec: ProductSpec = { ...r.spec, ...kitExtras(raw, w) };
  try {
    if (!buildPlan(spec).steps.length) issues.push("The guide came out with no steps.");
  } catch (e) {
    issues.push(`The guide can't be built: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { spec: issues.length ? null : spec, issues, warnings };
}

/** Where a kit's guide lives: its own address, apart from the catalog and from scans. */
export function kitSlug(spec: ProductSpec): string {
  const s = spec.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/, "");
  return `kit-${s || "build"}`;
}

/** A link that opens the guide anywhere, with the whole kit packed into it. */
export async function kitLink(spec: ProductSpec, origin = ""): Promise<string> {
  return `${origin}/build/${kitSlug(spec)}#g=${await encodeSpec(spec)}`;
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** The offset most parts share. */
function common(ds: Vec3[]): Vec3 {
  const tally = new Map<string, { d: Vec3; n: number }>();
  for (const d of ds) {
    const k = d.map((n) => Math.round(n)).join(",");
    const t = tally.get(k) ?? { d, n: 0 };
    t.n++;
    tally.set(k, t);
  }
  return [...tally.values()].sort((a, b) => b.n - a.n)[0]?.d ?? [0, 0, 0];
}
