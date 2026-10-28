/**
 * Checks kit files, the guides makers write for their own products, and prints a link to each guide.
 *
 *   npm run kit:check -- my-kit.json [more.json]
 *
 * Fails when a kit can't become a guide. Warnings are things that were dropped, cut or moved on the way.
 */
import { readFileSync } from "node:fs";
import { kitLink, parseKit } from "@/lib/kit";
import { buildPlan } from "@/lib/plan";

const ORIGIN = "https://www.usebygga.com";
// the examples folder lists its kits in index.json, which is not a kit itself
const files = process.argv.slice(2).filter((f) => !/(^|\/)index\.json$/.test(f));
if (!files.length) {
  console.error("Usage: npm run kit:check -- kit.json [more.json]");
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  console.log(`\n${file}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`  issue: can't read it as JSON: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
    continue;
  }
  const { spec, issues, warnings } = parseKit(raw);
  if (spec) {
    const plan = buildPlan(spec);
    console.log(`  ${spec.brand ? spec.brand + " " : ""}${spec.name}, ${spec.variant}`);
    console.log(`  ${spec.custom?.parts.length ?? 0} parts, ${plan.steps.length} steps, about ${spec.minutes} minutes, ${spec.people === 2 ? "two people" : "one person"}`);
    console.log(`  tools: ${plan.tools.map((t) => t.id + (t.optional ? " (optional)" : "")).join(", ") || "none"}`);
  }
  for (const s of issues) console.log(`  issue: ${s}`);
  for (const s of warnings) console.log(`  warning: ${s}`);
  if (issues.length || !spec) {
    failed++;
    continue;
  }
  console.log(`  link: ${await kitLink(spec, ORIGIN)}`);
}

console.log(failed ? `\n${failed} of ${files.length} kits failed.` : `\nAll ${files.length} kits build.`);
process.exit(failed ? 1 : 0);
