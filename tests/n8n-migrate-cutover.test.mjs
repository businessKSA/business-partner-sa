// اختبار إضافات أداة النقل لأيام القطع (ops/n8n/migrate-workflows.mjs):
// تقرير ما لا يُنقل محفوظاً في ملف، خريطة الاعتمادات، جرد الويبهوكات الواردة (webhooks)،
// التحقق بين الجهتين حسب المرحلة (verify) وأهمه منع المجدول في الموضعين، وفحص التسجيل بلا تشغيل (probe-webhooks).
// لا شبكة ولا خدمة حقيقية: خادم n8n وهمي في الذاكرة يُحقَن مكان fetch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  makeClient, cmdExport, cmdImport, cmdActivate, cmdPauseSource, cmdPauseTarget, cmdVerify, cmdWebhooks,
  cmdProbeWebhooks, webhookEndpoints, expectations, loadCredentialMap, credentialTemplate, transformForTarget,
  analyze, maskPath, main,
} from "../ops/n8n/migrate-workflows.mjs";

const SRC = "https://businesspartnerai.app.n8n.cloud";
const DST = "https://n8n.businesspartner.sa";
const API_KEY_SRC = "KEY-SRC-must-never-be-printed";
const API_KEY_DST = "KEY-DST-must-never-be-printed";
const TOKEN_IN_NODE = "TOKEN-written-in-a-node-header-999";

function fakeN8n({ origin, workflows = [], key }) {
  const db = new Map(workflows.map((w) => [w.id, structuredClone(w)]));
  let seq = 0;
  const writes = [];
  const res = (status, body) => ({ status, ok: status < 300, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.origin, origin, "نداء إلى مضيف غير متوقَّع");
    if (init.headers["X-N8N-API-KEY"] !== key) return res(401, { message: "unauthorized" });
    const m = init.method;
    const p = u.pathname.replace("/api/v1", "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (m === "GET" && p === "/workflows") {
      const all = [...db.values()];
      const start = Number(u.searchParams.get("cursor") || 0);
      const slice = all.slice(start, start + 3);
      return res(200, { data: slice.map(({ id, name, active }) => ({ id, name, active })), nextCursor: start + 3 < all.length ? String(start + 3) : null });
    }
    let mm;
    if (m === "GET" && (mm = p.match(/^\/workflows\/([^/]+)$/))) return db.has(mm[1]) ? res(200, db.get(mm[1])) : res(404, { message: "not found" });
    if (m === "POST" && p === "/workflows") { const id = `NEW${++seq}`; db.set(id, { id, active: false, ...body }); writes.push(p); return res(200, db.get(id)); }
    if (m === "PUT" && (mm = p.match(/^\/workflows\/([^/]+)$/))) { db.set(mm[1], { ...db.get(mm[1]), ...body }); writes.push(p); return res(200, db.get(mm[1])); }
    if (m === "POST" && (mm = p.match(/^\/workflows\/([^/]+)\/(activate|deactivate)$/))) {
      if (!db.has(mm[1])) return res(404, {});
      db.get(mm[1]).active = mm[2] === "activate"; writes.push(p); return res(200, db.get(mm[1]));
    }
    return res(404, { message: `no route ${m} ${p}` });
  };
  const client = makeClient({ baseUrl: origin, apiKey: key, fetchImpl, sleep: async () => {}, label: origin });
  return { client, db, writes, fetchImpl };
}

const node = (name, type, parameters = {}, extra = {}) => ({ id: `id-${name}`, name, type, typeVersion: 1, position: [0, 0], parameters, ...extra });
const fixtures = () => [
  {
    id: "WAmain0000000001", name: "BP-WhatsApp-Main", active: true,
    nodes: [
      node("WA Trigger", "n8n-nodes-base.whatsAppTrigger", {}, { webhookId: "wa-hook-id-1", credentials: { whatsAppTriggerApi: { id: "c1", name: "WhatsApp OAuth" } } }),
      node("Send", "n8n-nodes-base.httpRequest", { url: `${SRC}/webhook/farah-intake`, headers: { "X-Key": TOKEN_IN_NODE } }),
    ],
    connections: {}, settings: { executionOrder: "v1" },
  },
  {
    id: "HOOK000000000002", name: "Website lead notify", active: true,
    nodes: [
      node("Hook", "n8n-nodes-base.webhook", { httpMethod: "POST", path: "website-lead-notify" }, { webhookId: "wh-1" }),
      node("Notion", "n8n-nodes-base.notion", {}, { credentials: { notionOAuth2Api: { id: "c2", name: "Notion — Production" } } }),
      node("Mail", "n8n-nodes-base.gmail", {}, { credentials: { gmailOAuth2: { id: "c9", name: "Gmail" } } }),
    ],
    connections: {}, settings: { executionOrder: "v1" },
  },
  { id: "SUB0000000000003", name: "Sub", active: true, nodes: [node("T", "n8n-nodes-base.executeWorkflowTrigger")], connections: {}, settings: {} },
  {
    id: "CRON000000000005", name: "Hourly sync", active: true,
    nodes: [node("Every hour", "n8n-nodes-base.scheduleTrigger"), node("Panel", "n8n-nodes-base.httpRequest", { url: "https://www.businesspartner.sa/api/simple" })],
    connections: {}, settings: {},
  },
  { id: "DRAFT00000000007", name: "Draft form", active: false, nodes: [node("F", "n8n-nodes-base.formTrigger", {}, { webhookId: "form-1" })], connections: {}, settings: {} },
  {
    id: "PAY0000000000008", name: "Tamara payment events", active: true,
    nodes: [node("Hook", "n8n-nodes-base.webhook", { httpMethod: "POST", path: "tamara-events" }, { webhookId: "wh-2" })],
    connections: {}, settings: {},
  },
  {
    id: "CTRL000000000009", name: "AI Space control", active: true,
    nodes: [node("Hook", "n8n-nodes-base.webhook", { httpMethod: "POST", path: "bp-ai-control-sEcReT123" }, { webhookId: "wh-3" })],
    connections: {}, settings: {},
  },
  {
    id: "CHAT000000000010", name: "Baher chat", active: true,
    nodes: [node("Chat", "@n8n/n8n-nodes-langchain.chatTrigger", {}, { webhookId: "f08bf4a4-62e9-4aa6-9a44-bf3080682fb3" })],
    connections: {}, settings: {},
  },
  {
    id: "MYST000000000011", name: "Mystery hook", active: true,
    nodes: [node("Hook", "n8n-nodes-base.webhook", { httpMethod: "GET", path: "mystery-path" }, { webhookId: "wh-4" })],
    connections: {}, settings: {},
  },
];

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "n8n-cutover-test-"));
const quiet = () => { const lines = []; return { log: (...a) => lines.push(a.join(" ")), lines }; };
const setup = async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dst = fakeN8n({ origin: DST, workflows: [], key: API_KEY_DST });
  const dir = tmp();
  const q = quiet();
  await cmdExport({ src: src.client, dir, log: q.log });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: q.log });
  const idMap = JSON.parse(fs.readFileSync(path.join(dir, "_idmap.json"), "utf8"));
  return { src, dst, dir, idMap, q };
};

// ───────── التقرير محفوظاً + قالب الاعتمادات ─────────
test("export: يحفظ _report.txt و_report.json وقالب الاعتمادات بالأسماء فقط (لا مفتاح ولا سرّ عقدة)", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dir = tmp();
  await cmdExport({ src: src.client, dir, log: () => {} });
  const names = fs.readdirSync(dir);
  for (const f of ["_report.txt", "_report.json", "_credential-map.template.json", "_manifest.json", ".gitignore"]) assert.ok(names.includes(f), `ينقص ${f}`);
  const tpl = JSON.parse(fs.readFileSync(path.join(dir, "_credential-map.template.json"), "utf8"));
  assert.deepEqual(Object.keys(tpl).sort(), ["gmailOAuth2|Gmail", "notionOAuth2Api|Notion — Production", "whatsAppTriggerApi|WhatsApp OAuth"]);
  assert.ok(Object.values(tpl).every((v) => v === ""), "القالب فارغ القيم");
  const report = fs.readFileSync(path.join(dir, "_report.txt"), "utf8");
  assert.match(report, /WhatsApp OAuth/);
  // التقرير والقالب بلا سرّ مكتوب داخل عقدة ولا مفتاح الواجهة
  for (const f of ["_report.txt", "_report.json", "_credential-map.template.json"]) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    assert.ok(!t.includes(TOKEN_IN_NODE), `${f} يسرّب سرّاً`);
    assert.ok(!t.includes(API_KEY_SRC), `${f} يسرّب المفتاح`);
  }
});

test("export --dry-run: لا يكتب شيئاً على القرص", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dir = path.join(tmp(), "out");
  await cmdExport({ src: src.client, dir, dryRun: true, log: () => {} });
  assert.equal(fs.existsSync(dir), false);
});

test("export: إعادة التصدير لا تمسّ credential-map.json الذي ملأه المالك", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dir = tmp();
  await cmdExport({ src: src.client, dir, log: () => {} });
  fs.writeFileSync(path.join(dir, "credential-map.json"), JSON.stringify({ "gmailOAuth2|Gmail": "NEWCRED1" }));
  await cmdExport({ src: src.client, dir, log: () => {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "credential-map.json"), "utf8")), { "gmailOAuth2|Gmail": "NEWCRED1" });
});

// ───────── خريطة الاعتمادات ─────────
test("loadCredentialMap: يهمل الفارغ والمفاتيح التي تبدأ بشرطة سفلية، ويقبل {id}", () => {
  const f = path.join(tmp(), "m.json");
  fs.writeFileSync(f, JSON.stringify({ "a|A": "ID1", "b|B": "", "c|C": { id: "ID3" }, _note: "x", "d|D": 5 }));
  assert.deepEqual(loadCredentialMap(f), { "a|A": "ID1", "c|C": "ID3" });
  assert.throws(() => loadCredentialMap(path.join(tmp(), "none.json")), /غير صالحة|غير موجودة/);
});

test("transformForTarget: يعيد ربط الاعتماد بمعرّف الوجهة بالنوع والاسم، ويسجّل ما بلا معرّف", () => {
  const w = fixtures()[1];
  const { body, stats } = transformForTarget(w, { credMap: { "notionOAuth2Api|Notion — Production": "N-NEW-1" } });
  assert.deepEqual(body.nodes.find((n) => n.name === "Notion").credentials.notionOAuth2Api, { id: "N-NEW-1", name: "Notion — Production" });
  assert.equal(body.nodes.find((n) => n.name === "Mail").credentials.gmailOAuth2.id, "c9", "غير المعرَّف يبقى كما هو");
  assert.equal(stats.creds, 1);
  assert.deepEqual(stats.credsUnmapped, ["gmailOAuth2|Gmail"]);
  // بلا خريطة أصلاً: لا تحذيرات مزعجة
  assert.deepEqual(transformForTarget(w, {}).stats.credsUnmapped, []);
  // والمصدر لم يُعدَّل
  assert.equal(w.nodes.find((n) => n.name === "Notion").credentials.notionOAuth2Api.id, "c2");
});

test("import: بخريطة اعتمادات يُربط ما له معرّف ويُبلَّغ بالباقي؛ و--on-exists=update يعيد الربط لاحقاً", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dst = fakeN8n({ origin: DST, workflows: [], key: API_KEY_DST });
  const dir = tmp();
  await cmdExport({ src: src.client, dir, log: () => {} });
  const q = quiet();
  const r1 = await cmdImport({ dst: dst.client, dir, srcBase: SRC, credMap: { "notionOAuth2Api|Notion — Production": "N-NEW-1" }, log: q.log });
  assert.equal(r1.refs.creds, 1);
  assert.deepEqual(r1.credsUnmapped.sort(), ["gmailOAuth2|Gmail", "whatsAppTriggerApi|WhatsApp OAuth"]);
  assert.match(q.lines.join("\n"), /اعتمادات بلا معرّف/);
  const hook = [...dst.db.values()].find((w) => w.name === "Website lead notify");
  assert.equal(hook.nodes.find((n) => n.name === "Notion").credentials.notionOAuth2Api.id, "N-NEW-1");
  // بعد إنشاء بقية الاعتمادات: إعادة الاستيراد update تربطها دون إنشاء مكرّر
  const before = dst.db.size;
  const full = Object.fromEntries(Object.keys(credentialTemplate(analyze([...src.db.values()]))).map((k, i) => [k, `ID${i}`]));
  const r2 = await cmdImport({ dst: dst.client, dir, srcBase: SRC, onExists: "update", credMap: full, log: () => {} });
  assert.equal(dst.db.size, before, "لا سيناريو مكرّر");
  assert.deepEqual(r2.credsUnmapped, []);
  assert.equal([...dst.db.values()].find((w) => w.name === "Website lead notify").nodes.find((n) => n.name === "Mail").credentials.gmailOAuth2.id.startsWith("ID"), true);
});

// ───────── الويبهوكات الواردة ─────────
test("webhookEndpoints: عناوين القديم والجديد لكل نوع، والمستهلك المعروف، والمزوّد", () => {
  const rows = webhookEndpoints(fixtures(), { srcBase: SRC, dstBase: DST });
  const by = (p) => rows.find((r) => r.path === p);
  assert.equal(by("website-lead-notify").srcUrl, `${SRC}/webhook/website-lead-notify`);
  assert.equal(by("website-lead-notify").dstUrl, `${DST}/webhook/website-lead-notify`);
  assert.match(by("website-lead-notify").consumer.who, /api\/book\.js/);
  assert.match(by("website-lead-notify").consumer.via, /N8N_BASE_URL/);
  assert.equal(by("form-1").dstUrl, `${DST}/form/form-1`);
  assert.equal(by("form-1").active, false);
  assert.equal(by("f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat").dstUrl, `${DST}/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat`);
  const wa = by("wa-hook-id-1/webhook");
  assert.equal(wa.kind, "callback");
  assert.equal(wa.approx, true);
  assert.match(wa.provider, /Meta — WhatsApp/);
  assert.match(by("tamara-events").provider, /تمارا/);
  assert.equal(by("mystery-path").consumer, null);
});

test("webhookEndpoints: مسار بمعاملات يُخدَم تحت معرّف العقدة، ومسار بشرطة أولى تُنزع", () => {
  const w = [{ id: "X", name: "x", active: true, nodes: [node("H", "n8n-nodes-base.webhook", { httpMethod: "POST", path: "/orders/:id" }, { webhookId: "abc-123" })] }];
  const [r] = webhookEndpoints(w, { dstBase: `${DST}/` });
  assert.equal(r.path, "orders/:id");
  assert.equal(r.dstUrl, `${DST}/webhook/abc-123/orders/:id`);
});

test("cmdWebhooks: يعلّم الفعّال بلا مستهلك معروف، ويخفي المسار السرّي في الطرفية فقط، ويكتب _webhooks.json", async () => {
  const { dir } = await setup();
  const q = quiet();
  const r = cmdWebhooks({ dir, srcBase: SRC, dstBase: DST, log: q.log });
  const out = q.lines.join("\n");
  assert.deepEqual(r.orphans.map((o) => o.path), ["mystery-path"]);
  assert.match(out, /بلا مستهلك معروف/);
  assert.ok(!out.includes("sEcReT123"), "المسار السرّي لا يُطبع");
  assert.ok(out.includes(maskPath("bp-ai-control-sEcReT123")));
  assert.match(out, /Meta — WhatsApp/);
  assert.match(out, /تمارا/);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "_webhooks.json"), "utf8"));
  assert.ok(saved.some((x) => x.path === "bp-ai-control-sEcReT123"), "الملف المحلي كامل");
  assert.ok(saved.every((x) => x.dstUrl.startsWith(DST)));
  // --dry-run لا يكتب
  fs.rmSync(path.join(dir, "_webhooks.json"));
  cmdWebhooks({ dir, srcBase: SRC, dstBase: DST, dryRun: true, log: () => {} });
  assert.equal(fs.existsSync(path.join(dir, "_webhooks.json")), false);
});

// ───────── التحقق حسب المرحلة ─────────
test("expectations: جدول التفعيل لكل مرحلة", () => {
  const stateful = { active: true, class: "stateful" };
  const hook = { active: true, class: "webhook" };
  const off = { active: false, class: "stateful" };
  assert.deepEqual(expectations(stateful, "prep"), { src: "must", dst: "mustnot" });
  assert.deepEqual(expectations(stateful, "cutover"), { src: "mustnot", dst: "must" });
  assert.deepEqual(expectations(stateful, "rollback"), { src: "must", dst: "mustnot" });
  assert.deepEqual(expectations(hook, "prep"), { src: "must", dst: "any" });
  assert.deepEqual(expectations(hook, "cutover"), { src: "any", dst: "must" });
  assert.deepEqual(expectations(off, "cutover"), { src: "any", dst: "mustnot" });
});

test("verify prep: بعد الاستيراد (كل شيء غير مفعّل في الوجهة) يمرّ نظيفاً", async () => {
  const { src, dst, dir } = await setup();
  const q = quiet();
  const r = await cmdVerify({ dst: dst.client, src: src.client, dir, phase: "prep", srcHost: "businesspartnerai.app.n8n.cloud", log: q.log });
  assert.equal(r.ok, true, q.lines.join("\n"));
  assert.equal(r.warnings.length, 0, q.lines.join("\n"));
  assert.equal(r.checked, r.total);
});

test("verify: مجدول فعّال في الجهتين = خطأ (⛔) في أي مرحلة، حتى لو فُعِّل بيدٍ بشرية", async () => {
  const { src, dst, dir, idMap } = await setup();
  await dst.client.post(`/workflows/${idMap.CRON000000000005}/activate`); // CRON ما زال فعّالاً في Cloud
  for (const phase of ["prep", "cutover", "rollback"]) {
    const q = quiet();
    const r = await cmdVerify({ dst: dst.client, src: src.client, dir, phase, log: q.log });
    assert.equal(r.ok, false, phase);
    assert.ok(r.errors.some((e) => e.includes("⛔") && e.includes("Hourly sync")), `${phase}: ${r.errors.join(" | ")}`);
  }
});

test("verify cutover: لا يمرّ حتى يُوقَف مجدول المصدر ويُفعَّل ما في الوجهة؛ ثم يمرّ", async () => {
  const { src, dst, dir } = await setup();
  const r0 = await cmdVerify({ dst: dst.client, src: src.client, dir, phase: "cutover", log: () => {} });
  assert.equal(r0.ok, false, "قبل أي خطوة قطع لا يجوز أن ينجح");
  await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  await cmdActivate({ dst: dst.client, src: src.client, dir, only: "all", apply: true, log: () => {} });
  const q = quiet();
  const r = await cmdVerify({ dst: dst.client, src: src.client, dir, phase: "cutover", log: q.log });
  assert.equal(r.ok, true, q.lines.join("\n"));
});

test("verify rollback: بعد التراجع الصحيح يمرّ، وقبل إيقاف الوجهة يفشل", async () => {
  const { src, dst, dir } = await setup();
  await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  await cmdActivate({ dst: dst.client, src: src.client, dir, only: "all", apply: true, log: () => {} });
  // تراجع بترتيب خاطئ (Cloud قبل Azure): تكرار
  await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, resume: true, log: () => {} });
  const bad = await cmdVerify({ dst: dst.client, src: src.client, dir, phase: "rollback", log: () => {} });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("⛔")));
  await cmdPauseTarget({ dst: dst.client, dir, only: "stateful", apply: true, log: () => {} });
  const good = await cmdVerify({ dst: dst.client, src: src.client, dir, phase: "rollback", log: () => {} });
  assert.equal(good.ok, true, good.errors.join(" | "));
});

test("verify: يكشف سيناريو ناقصاً أو عقداً لا تطابق التصدير، ويحذّر إن لم يُفحص المصدر", async () => {
  const { dst, dir, idMap } = await setup();
  const db = dst.db.get(idMap.HOOK000000000002);
  db.nodes = db.nodes.slice(0, 1);
  dst.db.delete(idMap.CRON000000000005);
  const r = await cmdVerify({ dst: dst.client, src: null, dir, phase: "prep", log: () => {} });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("Website lead notify") && e.includes("لا تطابق")));
  assert.ok(r.errors.some((e) => e.includes("Hourly sync") && e.includes("تعذّرت قراءته")));
  assert.ok(r.warnings.some((w) => w.includes("لم يُفحص المصدر")));
});

test("verify: مرحلة غير معروفة ترفض، وبلا _idmap.json يرفض", async () => {
  const { dst, dir } = await setup();
  await assert.rejects(cmdVerify({ dst: dst.client, dir, phase: "later", log: () => {} }), /مرحلة غير معروفة/);
  fs.rmSync(path.join(dir, "_idmap.json"));
  await assert.rejects(cmdVerify({ dst: dst.client, dir, phase: "prep", log: () => {} }), /_idmap/);
});

// ───────── فحص التسجيل بلا تشغيل ─────────
test("probe-webhooks: GET فقط، على ويبهوكات POST فقط، ولا يلمس النماذج والمحادثة ومسارات GET ولا يرسل المفتاح", async () => {
  const { dir } = await setup();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method, headers: init.headers || {} });
    const registered = new Set([`${DST}/webhook/website-lead-notify`]);
    const body = registered.has(url)
      ? { code: 404, message: "This webhook is not registered for GET requests. Did you mean to make a POST request?" }
      : { code: 404, message: `The requested webhook "POST ${new URL(url).pathname}" is not registered.` };
    return { status: 404, ok: false, text: async () => JSON.stringify(body) };
  };
  const q = quiet();
  const r = await cmdProbeWebhooks({ dir, base: DST, fetchImpl, log: q.log });
  assert.ok(calls.length > 0 && calls.every((c) => c.method === "GET"), "GET فقط");
  assert.ok(calls.every((c) => !Object.keys(c.headers).some((h) => /key|authorization/i.test(h))), "لا مفتاح في الفحص");
  assert.deepEqual(r.registered, ["website-lead-notify"]);
  assert.ok(r.missing.some((m) => m.includes("tamara-events")));
  assert.ok(r.missing.some((m) => m.includes("bp-ai-control") && !m.includes("sEcReT123")), "المسار السرّي مقنَّع");
  const urls = calls.map((c) => c.url).join(" ");
  assert.ok(!urls.includes("mystery-path"), "مسار GET لا يُفحص (قد يشغّل السيناريو)");
  assert.ok(!urls.includes("/form/") && !urls.includes("/chat"), "لا نماذج ولا محادثة");
  assert.ok(r.skipped.length >= 3);
  assert.ok(!q.lines.join("\n").includes("sEcReT123"));
});

test("probe-webhooks: ردّ 200 على GET يُعلَّم تحذيراً، وعطل الشبكة يُعدّ غير مفهوم لا انهياراً", async () => {
  const { dir } = await setup();
  let n = 0;
  const fetchImpl = async () => {
    n++;
    if (n === 1) return { status: 200, ok: true, text: async () => "ok" };
    if (n === 2) throw new Error("ECONNRESET");
    return { status: 404, ok: false, text: async () => '{"message":"The requested webhook \\"POST x\\" is not registered."}' };
  };
  const r = await cmdProbeWebhooks({ dir, base: DST, fetchImpl, log: () => {} });
  assert.equal(r.unexpected.length, 1);
  assert.equal(r.unknown.length, 1);
  assert.ok(r.missing.length >= 1);
  await assert.rejects(cmdProbeWebhooks({ dir, base: "http://insecure.example.com", fetchImpl, log: () => {} }), /https/);
  await assert.rejects(cmdProbeWebhooks({ dir, base: "", fetchImpl, log: () => {} }), /--base/);
});

// ───────── سطر الأوامر ─────────
test("main: --only بقيمة خاطئة يرفض بدل أن يعني «لا شيء»، و verify الفاشل يُنهي برمز 2", async () => {
  const { src, dst, dir } = await setup();
  const saved = { fetch: globalThis.fetch, env: { ...process.env }, code: process.exitCode, log: console.log };
  const routes = { [SRC]: src.fetchImpl, [DST]: dst.fetchImpl };
  globalThis.fetch = (url, init) => routes[new URL(url).origin](url, init);
  Object.assign(process.env, { N8N_SRC_URL: SRC, N8N_SRC_API_KEY: API_KEY_SRC, N8N_DST_URL: DST, N8N_DST_API_KEY: API_KEY_DST });
  const out = [];
  console.log = (...a) => out.push(a.join(" "));
  try {
    await assert.rejects(main(["pause-source", dir, "--only=statefull"]), /--only يقبل/);
    process.exitCode = 0;
    await main(["verify", dir, "--phase=cutover"]); // لم يُقطع شيء بعد → يفشل
    assert.equal(process.exitCode, 2);
    process.exitCode = 0;
    await main(["verify", dir, "--phase=prep"]);
    assert.equal(process.exitCode, 0, out.join("\n"));
    const joined = out.join("\n");
    assert.ok(!joined.includes(API_KEY_SRC) && !joined.includes(API_KEY_DST), "المفاتيح لا تُطبع");
  } finally {
    globalThis.fetch = saved.fetch; console.log = saved.log; process.exitCode = saved.code;
    for (const k of ["N8N_SRC_URL", "N8N_SRC_API_KEY", "N8N_DST_URL", "N8N_DST_API_KEY"]) { if (k in saved.env) process.env[k] = saved.env[k]; else delete process.env[k]; }
  }
});

test("main import: يلتقط credential-map.json من مجلد التصدير تلقائياً ويربط به", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures(), key: API_KEY_SRC });
  const dst = fakeN8n({ origin: DST, workflows: [], key: API_KEY_DST });
  const dir = tmp();
  await cmdExport({ src: src.client, dir, log: () => {} });
  fs.writeFileSync(path.join(dir, "credential-map.json"), JSON.stringify({ "gmailOAuth2|Gmail": "G-NEW-1", "whatsAppTriggerApi|WhatsApp OAuth": "" }));
  const saved = { fetch: globalThis.fetch, env: { ...process.env }, log: console.log };
  globalThis.fetch = (url, init) => dst.fetchImpl(url, init);
  Object.assign(process.env, { N8N_SRC_URL: SRC, N8N_DST_URL: DST, N8N_DST_API_KEY: API_KEY_DST });
  console.log = () => {};
  try {
    await main(["import", dir]);
  } finally {
    globalThis.fetch = saved.fetch; console.log = saved.log;
    for (const k of ["N8N_SRC_URL", "N8N_DST_URL", "N8N_DST_API_KEY"]) { if (k in saved.env) process.env[k] = saved.env[k]; else delete process.env[k]; }
  }
  const hook = [...dst.db.values()].find((w) => w.name === "Website lead notify");
  assert.equal(hook.nodes.find((n) => n.name === "Mail").credentials.gmailOAuth2.id, "G-NEW-1");
});
