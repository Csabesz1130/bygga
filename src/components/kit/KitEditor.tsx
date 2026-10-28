"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildPlan } from "@/lib/plan";
import { kitLink, kitSlug, parseKit } from "@/lib/kit";
import { GITHUB_URL } from "@/lib/site";
import { cacheSpec } from "@/lib/store";
import Thumb from "../Thumb";
import { IAlert, IArrowRight, ICheck, IDoc, IShare, IUpload } from "../art/Icons";

interface Example {
  file: string;
  name: string;
}

type Read = { ok: true; data: unknown } | { ok: false; error: string };

function readJson(text: string): Read | null {
  if (!text.trim()) return null;
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: `This isn't valid JSON yet: ${(e as Error).message}` };
  }
}

/** A short stable id for the text, so the preview redraws when the kit changes. */
function hashOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export default function KitEditor() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [examples, setExamples] = useState<Example[]>([]);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/kits/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => {
        if (alive && Array.isArray(j)) setExamples(j.filter((x): x is Example => !!x && typeof x.file === "string" && typeof x.name === "string"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const read = useMemo(() => readJson(text), [text]);
  const kit = useMemo(() => (read?.ok ? parseKit(read.data) : null), [read]);
  const spec = kit?.spec ?? null;
  const plan = useMemo(() => {
    if (!spec) return null;
    try {
      return buildPlan(spec);
    } catch {
      return null;
    }
  }, [spec]);
  const issues = read && !read.ok ? [read.error] : (kit?.issues ?? []);
  const ready = !!(spec && plan);

  async function load(f: string) {
    const r = await fetch(`/kits/${f}`).catch(() => null);
    if (r?.ok) setText(JSON.stringify(await r.json(), null, 2));
  }

  async function take(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
  }

  async function link() {
    if (!spec) return null;
    const href = await kitLink(spec, location.origin);
    // opened here, it is also saved in this browser
    cacheSpec(kitSlug(spec), { ...spec, slug: kitSlug(spec) });
    return href;
  }

  async function open() {
    const href = await link();
    if (href) router.push(href.slice(location.origin.length));
  }

  async function copy(what: "link" | "embed") {
    const href = await link();
    if (!href) return;
    const out = what === "link" ? href : `<iframe src="${href}" width="100%" height="640" allow="microphone; autoplay" loading="lazy"></iframe>`;
    try {
      await navigator.clipboard.writeText(out);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="scan kit">
      <header className="scan-head">
        <h1>Ship your assembly manual as a 3D guide</h1>
        <p className="lead">For makers of anything that comes in a box. Write one kit file with your parts and steps, and Bygga draws every step in 3D, reads it out loud, prints it and works offline. Share it as a link or embed it on your own site.</p>
      </header>

      <div className="scan-form">
        <section className="sf-row">
          <span className="sf-n">1</span>
          <div className="sf-body">
            <h2>Your kit file</h2>
            <p className="sf-help">
              JSON with name, parts (each with size and pos in mm) and steps. See <a href={`${GITHUB_URL}/blob/main/docs/kits.md`} target="_blank" rel="noreferrer">the kit format</a>.
            </p>
            {examples.length > 0 && (
              <div className="kit-examples" role="list" aria-label="Example kits">
                {examples.map((x) => (
                  <button key={x.file} className="chip" role="listitem" onClick={() => load(x.file)}>
                    <IDoc size={14} /> {x.name}
                  </button>
                ))}
              </div>
            )}
            <div
              className={"drop kit-drop" + (drag ? " over" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                take(e.dataTransfer.files[0]);
              }}
            >
              <textarea className="kit-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder='{ "kit": 1, "name": "...", "parts": [...], "steps": [...] }' aria-label="Kit JSON" />
              <div className="kit-drop-foot">
                <span>Drop a .json file here, or</span>
                <button className="link-btn" onClick={() => file.current?.click()}>
                  <IUpload size={14} /> choose one
                </button>
                <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => take(e.target.files?.[0])} />
              </div>
            </div>
          </div>
        </section>

        <section className="sf-row">
          <span className="sf-n">2</span>
          <div className="sf-body">
            <h2>Check it</h2>
            {!read && <p className="sf-help">Paste a kit or pick an example to see it drawn.</p>}
            {issues.length > 0 && (
              <ul className="kit-notes bad">
                {issues.map((s, i) => (
                  <li key={i}>
                    <IAlert size={15} /> {s}
                  </li>
                ))}
              </ul>
            )}
            {kit && kit.warnings.length > 0 && (
              <ul className="kit-notes">
                {kit.warnings.map((s, i) => (
                  <li key={i}>
                    <IAlert size={15} /> {s}
                  </li>
                ))}
              </ul>
            )}
            {spec && !plan && <p className="sf-help bad">The parts were read, but no guide could be drawn from them. Check the sizes and positions.</p>}
            {ready && (
              <div className="sw-done kit-preview">
                <Thumb id={"kit-" + hashOf(text)} plan={plan} mode={{ kind: "assembled" }} w={520} h={380} className="sw-thumb" alt={spec.name} />
                <div className="sw-done-text">
                  <span className="sw-ok">
                    <ICheck size={16} strokeWidth={2.6} /> {kit?.warnings.length ? "Guide ready, with notes" : "Guide ready"}
                  </span>
                  <h2>{spec.name}</h2>
                  <p>
                    {[spec.brand, spec.variant].filter(Boolean).join(", ")}. {plan.steps.length} steps, {plan.parts.reduce((s, p) => s + p.qty, 0)} parts, about {spec.minutes} minutes.
                  </p>
                  <div className="sw-actions">
                    <button className="btn primary" onClick={open}>
                      Open guide <IArrowRight size={18} />
                    </button>
                    <button className="btn ghost" onClick={() => copy("link")}>
                      {copied === "link" ? <ICheck size={16} /> : <IShare size={16} />} {copied === "link" ? "Copied" : "Copy link"}
                    </button>
                    <button className="btn ghost" onClick={() => copy("embed")}>
                      {copied === "embed" ? <ICheck size={16} /> : <IDoc size={16} />} {copied === "embed" ? "Copied" : "Copy embed"}
                    </button>
                  </div>
                  <p className="sw-note">The whole guide travels in the link: nothing is uploaded or stored on our side.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
