// اختبار أداة نقل السيناريوهات (ops/n8n/migrate-workflows.mjs) وعنوان n8n الموحّد (api/_n8n.js).
// لا شبكة ولا خدمة حقيقية: خادم n8n وهمي في الذاكرة يُحقَن مكان fetch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  makeClient, analyze, formatReport, transformForTarget, cmdExport, cmdImport, cmdActivate,
  cmdPauseSource, cmdPauseTarget, cmdReport, parseArgs, main, triggerClass,
} from "../ops/n8n/migrate-workflows.mjs";
import { n8nBase, n8nWebhookUrl, n8nFormUrl, N8N_LEGACY_BASE } from "../api/_n8n.js";

const SRC = "https://businesspartnerai.app.n8n.cloud";
const DST = "https://bp-n8n.example.azurecontainerapps.io";
const SECRET = "SECRET-VALUE-do-not-print-123";

// ───────── خادم n8n وهمي ─────────
function fakeN8n({ origin, workflows = [], pageSize = 2, rejectStaticData = false, key = "k-test" }) {
  const db = new Map(workflows.map((w) => [w.id, structuredClone(w)]));
  let seq = 0;
  const writes = [];
  const calls = [];
  const res = (status, body) => ({ status, ok: status < 300, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.origin, origin, "نداء إلى مضيف غير متوقَّع");
    calls.push({ method: init.method, path: u.pathname + u.search, key: init.headers["X-N8N-API-KEY"] });
    if (init.headers["X-N8N-API-KEY"] !== key) return res(401, { message: "unauthorized" });
    const m = init.method;
    const p = u.pathname.replace("/api/v1", "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (m === "GET" && p === "/workflows") {
      const all = [...db.values()];
      const start = Number(u.searchParams.get("cursor") || 0);
      const slice = all.slice(start, start + pageSize);
      // القائمة بلا عقد عمداً: يجب أن يجلب العميل كل سيناريو كاملاً
      return res(200, { data: slice.map(({ id, name, active }) => ({ id, name, active })), nextCursor: start + pageSize < all.length ? String(start + pageSize) : null });
    }
    let mm;
    if (m === "GET" && (mm = p.match(/^\/workflows\/([^/]+)$/))) return db.has(mm[1]) ? res(200, db.get(mm[1])) : res(404, { message: "not found" });
    if (m === "POST" && p === "/workflows") {
      writes.push({ m, p });
      if (rejectStaticData && body.staticData) return res(400, { message: "request/body must NOT have additional properties" });
      const id = `NEW${++seq}`;
      db.set(id, { id, active: false, ...body });
      return res(200, db.get(id));
    }
    if (m === "PUT" && (mm = p.match(/^\/workflows\/([^/]+)$/))) {
      writes.push({ m, p });
      if (!db.has(mm[1])) return res(404, {});
      if (rejectStaticData && body.staticData) return res(400, { message: "additional properties" });
      db.set(mm[1], { ...db.get(mm[1]), ...body });
      return res(200, db.get(mm[1]));
    }
    if (m === "POST" && (mm = p.match(/^\/workflows\/([^/]+)\/(activate|deactivate)$/))) {
      writes.push({ m, p });
      if (!db.has(mm[1])) return res(404, {});
      db.get(mm[1]).active = mm[2] === "activate";
      return res(200, db.get(mm[1]));
    }
    return res(404, { message: `no route ${m} ${p}` });
  };
  const client = makeClient({ baseUrl: origin, apiKey: key, fetchImpl, sleep: async () => {}, label: origin });
  return { client, db, writes, calls, fetchImpl };
}

// ───────── سيناريوهات وهمية تشبه ما عندنا ─────────
const node = (name, type, parameters = {}, extra = {}) => ({ id: `id-${name}`, name, type, typeVersion: 1, position: [0, 0], parameters, ...extra });
const fixtures = () => [
  {
    id: "WAmain0000000001", name: "BP-WhatsApp-Main", active: true,
    nodes: [
      node("WA Trigger", "n8n-nodes-base.whatsAppTrigger", {}, { credentials: { whatsAppTriggerApi: { id: "c1", name: "WhatsApp OAuth" } } }),
      node("Call Farah", "n8n-nodes-base.httpRequest", { url: `${SRC}/webhook/farah-intake`, headers: { "X-Key": SECRET } }),
      node("Run Sub", "n8n-nodes-base.executeWorkflow", { workflowId: { __rl: true, value: "SUB0000000000003", mode: "list", cachedResultName: "Sub" } }),
      node("Note", "n8n-nodes-base.stickyNote", { content: "constructor" }),
    ],
    connections: {},
    settings: { executionOrder: "v1", errorWorkflow: "ERR0000000000004", availableInMCP: true, timezone: "Asia/Riyadh" },
    staticData: { global: { lastSeen: 42 } },
  },
  {
    id: "HOOK000000000002", name: "Website lead notify", active: true,
    nodes: [
      node("Hook", "n8n-nodes-base.webhook", { httpMethod: "POST", path: "website-lead-notify" }, { webhookId: "wh-1" }),
      node("Notion", "n8n-nodes-base.notion", {}, { credentials: { notionOAuth2Api: { id: "c2", name: "Notion — Production" } } }),
      node("Code", "n8n-nodes-base.code", { jsCode: "return [{k:$env.BP_PANEL_KEY, v:$vars.OLD_SETTING}]" }),
      node("Table", "n8n-nodes-base.dataTable", { dataTableId: { __rl: true, value: "TBL1", mode: "id", cachedResultName: "BP_AI_Tasks" } }),
    ],
    connections: {}, settings: { executionOrder: "v1" },
  },
  { id: "SUB0000000000003", name: "Sub", active: true, nodes: [node("T", "n8n-nodes-base.executeWorkflowTrigger")], connections: {}, settings: {} },
  { id: "ERR0000000000004", name: "Error handler", active: true, nodes: [node("T", "n8n-nodes-base.errorTrigger")], connections: {}, settings: {} },
  {
    id: "CRON000000000005", name: "Hourly sync", active: true,
    nodes: [
      node("Every hour", "n8n-nodes-base.scheduleTrigger"),
      node("Panel", "n8n-nodes-base.httpRequest", { url: "https://bp-quotes-three.vercel.app/quotes/api/catalog/sync" }, { credentials: { httpHeaderAuth: { id: "c3", name: "BP — مفتاح مزامنة" } } }),
    ],
    connections: {}, settings: {},
  },
  { id: "OLD0000000000006", name: "Old archived", active: false, isArchived: true, nodes: [node("T", "n8n-nodes-base.manualTrigger")], connections: {}, settings: {} },
  { id: "DRAFT00000000007", name: "Draft form", active: false, nodes: [node("F", "n8n-nodes-base.formTrigger", {}, { webhookId: "form-1" })], connections: {}, settings: {} },
];

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "n8n-migrate-test-"));
const quiet = () => { const lines = []; return { log: (...a) => lines.push(a.join(" ")), lines }; };

// ───────── api/_n8n.js ─────────
test("api/_n8n.js: الافتراضي هو العنوان الحالي حرفياً (لا تغيير سلوك قبل القطع)", () => {
  assert.equal(n8nBase({}), "https://businesspartnerai.app.n8n.cloud");
  assert.equal(N8N_LEGACY_BASE, "https://businesspartnerai.app.n8n.cloud");
  assert.equal(n8nWebhookUrl("website-lead-notify", {}), "https://businesspartnerai.app.n8n.cloud/webhook/website-lead-notify");
  assert.equal(n8nWebhookUrl("f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat", {}), "https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat");
  assert.equal(n8nFormUrl("abc", {}), "https://businesspartnerai.app.n8n.cloud/form/abc");
});

test("api/_n8n.js: N8N_BASE_URL يغلب، بلا شرطة أخيرة، وقيمة معطوبة تُهمَل", () => {
  assert.equal(n8nBase({ N8N_BASE_URL: "https://n8n.businesspartner.sa/" }), "https://n8n.businesspartner.sa");
  assert.equal(n8nBase({ N8N_BASE_URL: "  https://x.test///  " }), "https://x.test");
  assert.equal(n8nWebhookUrl("/p", { N8N_BASE_URL: "https://x.test" }), "https://x.test/webhook/p");
  for (const bad of ["", "   ", "n8n.businesspartner.sa", "ftp://x", "https://"]) assert.equal(n8nBase({ N8N_BASE_URL: bad }), N8N_LEGACY_BASE, `«${bad}» يجب ألا يُقبل`);
});

test("لا عنوان n8n Cloud مكتوباً حرفياً في api/ ولا في مولّد الصفحات إلا في المساعد", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const hits = [];
  for (const f of fs.readdirSync(path.join(root, "api")).filter((x) => x.endsWith(".js") && x !== "_n8n.js")) {
    if (fs.readFileSync(path.join(root, "api", f), "utf8").includes("n8n.cloud")) hits.push(`api/${f}`);
  }
  if (fs.readFileSync(path.join(root, "site/scripts/generate.mjs"), "utf8").includes("n8n.cloud")) hits.push("site/scripts/generate.mjs");
  assert.deepEqual(hits, [], "استعمل api/_n8n.js (n8nWebhookUrl) أو N8N_BASE_URL في المولّد");
});

test("catalog-sync: عقدة Vercel القديمة باقية بجانب مسار Azure حتى القطع", () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, "../ops/n8n/catalog-sync.workflow.js"), "utf8");
  assert.match(src, /api\.vercel\.com\/v1\/integrations\/deploy\//);
  assert.match(src, /actions\/workflows\/\$\{SITE_DEPLOY_WORKFLOW\}\/dispatches/);
  assert.match(src, /promote: 'false'/); // لا ترقية آلية: النشر بإذن المالك
});

// ───────── العميل ─────────
test("makeClient: يرفض http غير المحلي، ويعيد المحاولة على 503، ولا يُسرّب المفتاح في الخطأ", async () => {
  assert.throws(() => makeClient({ baseUrl: "http://n8n.example.com", apiKey: "k" }), /https/);
  assert.throws(() => makeClient({ baseUrl: SRC, apiKey: "" }), /ينقص/);
  makeClient({ baseUrl: "http://localhost:5678", apiKey: "k", fetchImpl: async () => ({}) }); // محلي مسموح

  let n = 0;
  const flaky = async () => (++n < 3 ? { status: 503, ok: false, text: async () => "busy" } : { status: 200, ok: true, text: async () => '{"ok":1}' });
  const c = makeClient({ baseUrl: SRC, apiKey: "KEY-XYZ", fetchImpl: flaky, sleep: async () => {} });
  assert.deepEqual(await c.get("/x"), { ok: 1 });
  assert.equal(n, 3);

  const bad = makeClient({ baseUrl: SRC, apiKey: "KEY-XYZ", fetchImpl: async () => ({ status: 401, ok: false, text: async () => "nope" }), sleep: async () => {} });
  await assert.rejects(() => bad.get("/workflows"), (e) => e.status === 401 && !e.message.includes("KEY-XYZ"));
});

// ───────── التحليل ─────────
test("analyze: يصنّف المشغّلات ويستخرج الاعتمادات بالأسماء فقط", () => {
  const a = analyze(fixtures(), { srcHost: "businesspartnerai.app.n8n.cloud" });
  const by = Object.fromEntries(a.workflows.map((w) => [w.name, w]));
  assert.equal(by["BP-WhatsApp-Main"].class, "stateful");
  assert.equal(by["BP-WhatsApp-Main"].hasCallback, true);
  assert.equal(by["Website lead notify"].class, "webhook");
  assert.deepEqual(by["Website lead notify"].webhooks, [{ kind: "webhook", method: "POST", path: "website-lead-notify" }]);
  assert.equal(by["Sub"].class, "passive");
  assert.equal(by["Error handler"].class, "passive");
  assert.equal(by["Hourly sync"].class, "stateful");
  assert.equal(by["Draft form"].class, "webhook");
  assert.equal(by["Old archived"].archived, true);

  const names = a.credentials.map((c) => c.name);
  assert.deepEqual(names.sort(), ["BP — مفتاح مزامنة", "Notion — Production", "WhatsApp OAuth"].sort());
  assert.equal(a.credentials.find((c) => c.name === "Notion — Production").oauth, true);
  assert.equal(a.credentials.find((c) => c.name === "BP — مفتاح مزامنة").oauth, false);
  assert.deepEqual(a.env, ["BP_PANEL_KEY"]);
  assert.deepEqual(a.vars, ["OLD_SETTING"]);
  assert.deepEqual(a.dataTables.map((t) => [t.id, t.name]), [["TBL1", "BP_AI_Tasks"]]);
  assert.ok(a.hosts.find((h) => h.host === "bp-quotes-three.vercel.app" && h.note === "vercel"));

  const rep = formatReport(a);
  assert.ok(rep.includes("Notion — Production") && rep.includes("OLD_SETTING") && rep.includes("vercel.app"));
  assert.ok(!rep.includes(SECRET), "التقرير يجب ألا يطبع قيماً من العقد");
  assert.ok(!rep.includes("c2"), "ولا معرّفات الاعتمادات");
});

test("triggerClass: واتساب وGmail والمؤقّت stateful، والويبهوك آمن", () => {
  assert.equal(triggerClass({ type: "n8n-nodes-base.whatsAppTrigger" }), "stateful");
  assert.equal(triggerClass({ type: "n8n-nodes-base.gmailTrigger" }), "stateful");
  assert.equal(triggerClass({ type: "n8n-nodes-base.scheduleTrigger" }), "stateful");
  assert.equal(triggerClass({ type: "n8n-nodes-base.webhook" }), "webhook");
  assert.equal(triggerClass({ type: "@n8n/n8n-nodes-langchain.chatTrigger" }), "webhook");
  assert.equal(triggerClass({ type: "n8n-nodes-base.httpRequest" }), null);
});

// ───────── التحويل ─────────
test("transformForTarget: العنوان والمعرّفات بمطابقة كاملة، وإعدادات مسموحة فقط، وstaticData تُحفظ", () => {
  const w = fixtures()[0];
  const { body, stats } = transformForTarget(w, {
    idMap: { SUB0000000000003: "NEW3", ERR0000000000004: "NEW4" }, srcBase: SRC, dstBase: DST,
  });
  assert.equal(body.nodes[1].parameters.url, `${DST}/webhook/farah-intake`);
  assert.equal(body.nodes[2].parameters.workflowId.value, "NEW3");
  assert.equal(body.settings.errorWorkflow, "NEW4");
  assert.equal(body.settings.availableInMCP, undefined, "إعداد غير مسموح يُسقَط");
  assert.equal(body.settings.timezone, "Asia/Riyadh");
  assert.equal(body.nodes[3].parameters.content, "constructor", "كلمة كـ constructor لا تُمَسّ");
  assert.deepEqual(body.staticData, { global: { lastSeen: 42 } });
  assert.equal(body.nodes[0].credentials.whatsAppTriggerApi.id, "c1", "الاعتمادات لا تُمَسّ");
  assert.ok(stats.host >= 1 && stats.ids === 2);
  assert.ok(!JSON.stringify(body).includes("businesspartnerai.app.n8n.cloud"));
  // الأصل لا يتغيّر
  assert.equal(w.nodes[1].parameters.url, `${SRC}/webhook/farah-intake`);
});

test("transformForTarget: خريطة جداول البيانات ورابط /workflow/ داخل النصوص", () => {
  const w = fixtures()[1];
  w.nodes.push(node("Link", "n8n-nodes-base.stickyNote", { content: `${SRC}/workflow/SUB0000000000003` }));
  const { body, stats } = transformForTarget(w, { idMap: { SUB0000000000003: "NEW3" }, tableMap: { TBL1: "TBLNEW" }, srcBase: SRC, dstBase: DST });
  assert.equal(body.nodes[3].parameters.dataTableId.value, "TBLNEW");
  assert.equal(body.nodes[4].parameters.content, `${DST}/workflow/NEW3`);
  assert.equal(stats.tables, 1);
});

// ───────── تصدير ─────────
test("export: يجلب كل صفحة كاملةً، يتجاهل المؤرشف، ويحفظ manifest و.gitignore", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures() });
  const dir = path.join(tmp(), "exp");
  const { log } = quiet();
  const a = await cmdExport({ src: src.client, dir, log });
  assert.equal(a.counts.total, 6, "٧ ناقص مؤرشف");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "_manifest.json"), "utf8"));
  assert.equal(manifest.length, 6);
  assert.ok(!manifest.find((m) => m.archived));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "_active.json"), "utf8")).sort(), ["CRON000000000005", "ERR0000000000004", "HOOK000000000002", "SUB0000000000003", "WAmain0000000001"]);
  assert.equal(fs.readFileSync(path.join(dir, ".gitignore"), "utf8").trim(), "*");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "WAmain0000000001.json"), "utf8")).nodes.length, 4, "العقد كاملة رغم أن القائمة بلا عقد");
  assert.ok(src.calls.every((c) => c.method === "GET"), "التصدير قراءة فقط");
});

test("export --dry-run: لا ملفات تُكتب", async () => {
  const src = fakeN8n({ origin: SRC, workflows: fixtures() });
  const dir = path.join(tmp(), "never");
  const { log, lines } = quiet();
  await cmdExport({ src: src.client, dir, dryRun: true, log });
  assert.equal(fs.existsSync(dir), false);
  assert.ok(lines[0].includes("لم يُكتب شيء"));
});

// ───────── استيراد ─────────
async function exported() {
  const src = fakeN8n({ origin: SRC, workflows: fixtures() });
  const dir = path.join(tmp(), "exp");
  await cmdExport({ src: src.client, dir, log: () => {} });
  return { src, dir };
}

test("import: كل شيء يُنشأ غير مفعّل، والمراجع تُصلَح، وخريطة المعرّفات تُحفظ", async () => {
  const { dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  const { log, lines } = quiet();
  const r = await cmdImport({ dst: dst.client, dir, srcBase: SRC, log });
  assert.equal(r.created.length, 6);
  assert.equal(r.failed.length, 0);
  assert.ok([...dst.db.values()].every((w) => w.active === false), "لا شيء يُفعَّل عند الاستيراد");
  const idMap = JSON.parse(fs.readFileSync(path.join(dir, "_idmap.json"), "utf8"));
  const main = dst.db.get(idMap.WAmain0000000001);
  assert.equal(main.nodes[1].parameters.url, `${DST}/webhook/farah-intake`);
  assert.equal(main.nodes[2].parameters.workflowId.value, idMap.SUB0000000000003);
  assert.equal(main.settings.errorWorkflow, idMap.ERR0000000000004);
  assert.deepEqual(main.staticData, { global: { lastSeen: 42 } });
  assert.ok(lines.some((l) => l.includes("غير مفعّلة")));
});

test("import --dry-run: صفر كتابة على الوجهة ولا _idmap", async () => {
  const { dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, dryRun: true, log: () => {} });
  assert.deepEqual(dst.writes, []);
  assert.equal(dst.db.size, 0);
  assert.equal(fs.existsSync(path.join(dir, "_idmap.json")), false);
});

test("import: السيناريو الموجود بالاسم يُتخطّى افتراضياً (إعادة التشغيل آمنة) ويُحدَّث مع --on-exists=update", async () => {
  const { dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  const before = dst.db.size;
  const again = await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  assert.equal(dst.db.size, before, "لا نسخ مكرّرة");
  assert.equal(again.skipped.length, 6);
  const upd = await cmdImport({ dst: dst.client, dir, srcBase: SRC, onExists: "update", log: () => {} });
  assert.equal(upd.updated.length, 6);
  assert.equal(dst.db.size, before);
});

test("import: وجهة ترفض staticData بـ400 تُقبَل بالحد الأدنى ويُبلَّغ عنها", async () => {
  const { dir } = await exported();
  const dst = fakeN8n({ origin: DST, rejectStaticData: true });
  const { log, lines } = quiet();
  const r = await cmdImport({ dst: dst.client, dir, srcBase: SRC, log });
  assert.equal(r.failed.length, 0);
  assert.deepEqual(r.degraded, ["BP-WhatsApp-Main"]);
  assert.ok(lines.some((l) => l.includes("BP-WhatsApp-Main") && l.includes("بالحد الأدنى")));
});

test("import: بقايا المعرّفات القديمة داخل تعبير تُبلَّغ", async () => {
  const wf = fixtures();
  wf[1].nodes.push(node("Expr", "n8n-nodes-base.set", { value: "={{ 'SUB0000000000003' + $json.x }}" }));
  const src = fakeN8n({ origin: SRC, workflows: wf });
  const dir = path.join(tmp(), "exp");
  await cmdExport({ src: src.client, dir, log: () => {} });
  const dst = fakeN8n({ origin: DST });
  const r = await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  assert.ok(r.residual.some((x) => x.startsWith("Website lead notify") && x.includes("SUB0000000000003")));
});

// ───────── التفعيل والإيقاف (حماية التكرار) ─────────
test("activate: webhook آمن مسبقاً، وstateful يُرفض ما دام المصدر فعّالاً، ولا تنفيذ بلا --apply", async () => {
  const { src, dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  const idMap = JSON.parse(fs.readFileSync(path.join(dir, "_idmap.json"), "utf8"));

  // تجربة بلا --apply: لا شيء يتغيّر
  const dry = await cmdActivate({ dst: dst.client, src: src.client, dir, only: "webhook", log: () => {} });
  assert.equal(dry.activated.length, 0);
  assert.ok([...dst.db.values()].every((w) => !w.active));

  // webhook + passive: يُفعَّل بلا فحص المصدر
  const safe = await cmdActivate({ dst: dst.client, src: null, dir, only: "webhook", apply: true, log: () => {} });
  assert.equal(safe.activated.length, 3, "الويبهوك + الفرعي + معالج الأخطاء");
  assert.equal(dst.db.get(idMap.CRON000000000005).active, false);
  assert.equal(dst.db.get(idMap.WAmain0000000001).active, false);

  // stateful والمصدر فعّال: مرفوض
  const refused = await cmdActivate({ dst: dst.client, src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  assert.deepEqual(refused.activated, []);
  assert.deepEqual(refused.blocked.sort(), ["BP-WhatsApp-Main", "Hourly sync"]);
  assert.equal(dst.db.get(idMap.CRON000000000005).active, false);

  // بلا اتصال بالمصدر وبلا تجاوز صريح: خطأ لا تفعيل
  await assert.rejects(() => cmdActivate({ dst: dst.client, src: null, dir, only: "stateful", apply: true, log: () => {} }), /فحص المصدر/);
});

test("pause-source → activate(stateful) → resume-source: مجدول واحد في كل لحظة", async () => {
  const { src, dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  const idMap = JSON.parse(fs.readFileSync(path.join(dir, "_idmap.json"), "utf8"));
  const srcActive = () => [...src.db.values()].filter((w) => w.active).map((w) => w.id);
  const dstActive = () => [...dst.db.entries()].filter(([, w]) => w.active).map(([id]) => id);

  // إيقاف المصدر بلا --apply: لا يمسّه
  const before = srcActive().length;
  await cmdPauseSource({ src: src.client, dir, only: "stateful", log: () => {} });
  assert.equal(srcActive().length, before);

  // الإيقاف فعلاً: stateful فقط
  const paused = await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  assert.deepEqual(paused.ok.sort(), ["CRON000000000005", "WAmain0000000001"]);
  assert.equal(src.db.get("HOOK000000000002").active, true, "الويبهوك يبقى في المصدر للتراجع");

  // الآن يُسمح بالتفعيل في الوجهة
  const act = await cmdActivate({ dst: dst.client, src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  assert.deepEqual(act.activated.sort(), [idMap.CRON000000000005, idMap.WAmain0000000001].sort());
  // لا سيناريو stateful فعّال في الموضعين معاً
  const bothOn = ["CRON000000000005", "WAmain0000000001"].filter((id) => src.db.get(id).active && dst.db.get(idMap[id]).active);
  assert.deepEqual(bothOn, []);
  assert.ok(dstActive().length >= 2);

  // التراجع: أوقف الوجهة بيدك ثم أعد المصدر
  const back = await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, resume: true, log: () => {} });
  assert.equal(back.ok.length, 2);
  assert.equal(src.db.get("WAmain0000000001").active, true);
});

test("التراجع: pause-target يوقف الوجهة (بخريطة المعرّفات) ثم resume-source يعيد المصدر", async () => {
  const { src, dir } = await exported();
  const dst = fakeN8n({ origin: DST });
  await cmdImport({ dst: dst.client, dir, srcBase: SRC, log: () => {} });
  const idMap = JSON.parse(fs.readFileSync(path.join(dir, "_idmap.json"), "utf8"));
  await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  await cmdActivate({ dst: dst.client, src: src.client, dir, only: "stateful", apply: true, log: () => {} });
  assert.equal(dst.db.get(idMap.CRON000000000005).active, true);

  // بروفة: لا تغيير
  await cmdPauseTarget({ dst: dst.client, dir, only: "stateful", log: () => {} });
  assert.equal(dst.db.get(idMap.CRON000000000005).active, true);

  await cmdPauseTarget({ dst: dst.client, dir, only: "stateful", apply: true, log: () => {} });
  assert.equal(dst.db.get(idMap.CRON000000000005).active, false);
  assert.equal(dst.db.get(idMap.WAmain0000000001).active, false);
  await cmdPauseSource({ src: src.client, dir, only: "stateful", apply: true, resume: true, log: () => {} });
  assert.equal(src.db.get("CRON000000000005").active, true);

  // بلا خريطة معرّفات لا يُخمَّن شيء
  fs.rmSync(path.join(dir, "_idmap.json"));
  await assert.rejects(() => cmdPauseTarget({ dst: dst.client, dir, apply: true, log: () => {} }), /_idmap/);
});

// ───────── تقرير من الملفات ─────────
test("report: من الملفات المحفوظة بلا شبكة", async () => {
  const { dir } = await exported();
  const { log, lines } = quiet();
  const a = cmdReport({ dir, log, srcHost: "businesspartnerai.app.n8n.cloud" });
  assert.equal(a.counts.stateful, 2);
  assert.ok(lines.join("\n").includes("WhatsApp OAuth"));
  assert.throws(() => cmdReport({ dir: path.join(tmp(), "none"), log }), /غير موجود/);
});

// ───────── سطر الأوامر ─────────
test("parseArgs و main: الأعلام تُفكَّك، والمفاتيح تُقرأ من البيئة فقط", async () => {
  const p = parseArgs(["import", "./d", "--dry-run", "--only=stateful", "--on-exists=update"]);
  assert.equal(p.cmd, "import");
  assert.deepEqual(p.pos, ["./d"]);
  assert.deepEqual(p.flags, { "dry-run": true, only: "stateful", "on-exists": "update" });

  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (k.startsWith("N8N_")) delete process.env[k];
  try {
    await assert.rejects(() => main(["export", "./d"]), /ينقص/);
    process.env.N8N_SRC_URL = SRC; // العنوان وحده بلا مفتاح لا يكفي
    await assert.rejects(() => main(["export", "./d"]), /ينقص/);
  } finally { Object.assign(process.env, saved); for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; }
});
