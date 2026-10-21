#!/usr/bin/env node
// ‏مجموعة قياس المستشار الدائمة — تشغّل golden.json على نموذجٍ حيّ وتطبع تقرير نجاح/فشل وتكتب JSON.
//
//   npm run chat:eval                                   ← على http://localhost:3000 (npm run dev)
//   CHAT_EVAL_BASE=https://azure.businesspartner.sa npm run chat:eval
//   CHAT_EVAL_ONLY=C26,X06 npm run chat:eval            ← حالات بعينها
//   CHAT_EVAL_REPLAY=.chat-eval/report-….json npm run chat:eval   ← يعيد تقييم تقرير محفوظ دون نداء النموذج
//
// ليس ضمن `npm test` (يحتاج نموذجاً وشبكة). يقرأ فقط من /api/chat ولا يكتب في أي قاعدة، ولا يحفظ
// المحادثات إلا في ملف التقرير المحلي (.chat-eval/، خارج git). الشرح الكامل: docs/chat-eval.md.
//
// رموز الخروج: 0 كل الحالات نجحت · 1 فشلت حالة أو أكثر · 2 تعذّر الوصول إلى النموذج في حالة أو أكثر.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCase, resolveCase, tally, checkedOf, view } from "./checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
export const GOLDEN = JSON.parse(readFileSync(resolve(HERE, "golden.json"), "utf8"));

/** ‏نداء /api/chat بالجسم نفسه الذي ترسله واجهة الرئيسية. */
export async function postChat(base, body, { timeoutMs = 75000 } = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, json: j, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, json: null, ms: Date.now() - t0, error: String((e && e.message) || e) };
  }
}

/**
 * ‏يشغّل محادثة واحدة. «@optN|نص» = اضغط الخيار N من خيارات الرد السابق، وإلا اكتب النص بعد «|».
 * @param {object} c  حالة golden
 * @param {{post: (body: object) => Promise<{status:number, json:any, ms:number, error?:string}>, retries?: number}} io
 */
export async function runCase(c, { post, retries = 1 }) {
  const history = [], turns = [];
  let lastOpts = null, error = null;
  for (const raw of c.turns) {
    let user = raw;
    if (typeof raw === "string" && raw.startsWith("@opt")) {
      const [spec, ...rest] = raw.split("|");
      const idx = Number(spec.slice(4)) || 0;
      user = (lastOpts && lastOpts[idx]) || rest.join("|");
    }
    if (!user) break;
    history.push({ role: "user", content: user });
    const body = c.mode === "public" ? { messages: history.slice(-12) } : { mode: "intake", context: c.context, lang: c.lang, messages: history.slice(-12) };
    let res = await post(body);
    for (let i = 0; i < retries && !(res.json && res.json.reply); i++) res = await post(body);
    const reply = (res.json && res.json.reply) || "";
    turns.push({ user, reply, status: res.status, ms: res.ms, provider: (res.json && res.json.provider) || null });
    if (!reply) { error = res.error || `HTTP ${res.status} بلا رد`; break; }
    history.push({ role: "assistant", content: reply });
    lastOpts = view(reply).opts;
  }
  return { id: c.id, turns, error };
}

/** ‏تقييم نتائج محادثات على golden: يعيد صفوف التقرير. */
export function evaluateAll(golden, runs) {
  const byId = new Map(golden.cases.map((c) => [c.id, c]));
  return runs.map((r) => {
    const c = resolveCase(golden, byId.get(r.id));
    const ev = evaluateCase(c, r.turns);
    return {
      id: r.id, title: c.title, category: c.category, mode: c.mode,
      pass: !r.error && ev.pass, error: r.error || null,
      checked: checkedOf(c), failures: ev.failures, scopeAt: ev.scopeAt, turns: r.turns,
    };
  });
}

export function summarize(rows) {
  const done = rows.filter((r) => !r.error);
  return {
    cases: rows.length,
    passed: rows.filter((r) => r.pass).length,
    failed: done.filter((r) => !r.pass).length,
    errors: rows.filter((r) => r.error).length,
    byCheck: tally(done),
  };
}

export function formatReport(rows, sum, meta) {
  const L = [];
  L.push(`مجموعة قياس المستشار — ${meta.base}${meta.replay ? " (إعادة تقييم)" : ""} — ${meta.at}`);
  L.push("");
  for (const r of rows) {
    const mark = r.error ? "!" : r.pass ? "✓" : "✗";
    L.push(`${mark} ${r.id.padEnd(4)} ${r.title}${r.error ? `  [خطأ: ${r.error}]` : ""}`);
    for (const f of r.failures) L.push(`      ↳ ${f.check} (رسالة ${f.turn}): ${f.detail}`);
  }
  L.push("");
  L.push("النتيجة بحسب الفحص:");
  for (const [k, v] of Object.entries(sum.byCheck).sort()) L.push(`  ${k.padEnd(20)} ${String(v.pass).padStart(3)} نجح  ${String(v.fail).padStart(3)} فشل`);
  L.push("");
  L.push(`الحالات: ${sum.cases} · نجحت ${sum.passed} · فشلت ${sum.failed} · تعذّرت ${sum.errors}`);
  return L.join("\n");
}

async function main() {
  const env = process.env;
  const base = env.CHAT_EVAL_BASE || "http://localhost:3000";
  const only = (env.CHAT_EVAL_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cases = GOLDEN.cases.filter((c) => !only.length || only.includes(c.id));
  if (process.argv.includes("--list")) { for (const c of cases) console.log(c.id, c.title); return 0; }

  let runs;
  if (env.CHAT_EVAL_REPLAY) {
    const saved = JSON.parse(readFileSync(resolve(ROOT, env.CHAT_EVAL_REPLAY), "utf8"));
    runs = saved.cases.filter((r) => cases.some((c) => c.id === r.id)).map((r) => ({ id: r.id, turns: r.turns, error: r.error }));
  } else {
    const conc = Math.max(1, Number(env.CHAT_EVAL_CONCURRENCY) || 3);
    const timeoutMs = Number(env.CHAT_EVAL_TIMEOUT_MS) || 75000;
    const post = (body) => postChat(base, body, { timeoutMs });
    runs = new Array(cases.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(conc, cases.length) }, async () => {
      while (next < cases.length) {
        const i = next++;
        runs[i] = await runCase(cases[i], { post });
        process.stderr.write(`· ${cases[i].id}\n`);
      }
    }));
  }

  const rows = evaluateAll(GOLDEN, runs);
  const sum = summarize(rows);
  const meta = { base, at: new Date().toISOString(), replay: env.CHAT_EVAL_REPLAY || null, goldenVersion: GOLDEN.version };
  console.log(formatReport(rows, sum, meta));

  const out = resolve(ROOT, env.CHAT_EVAL_OUT || `.chat-eval/report-${meta.at.replace(/[:.]/g, "-")}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ meta, summary: sum, cases: rows }, null, 1));
  console.log(`\nالتقرير: ${out}`);
  return sum.errors ? 2 : sum.failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
}
