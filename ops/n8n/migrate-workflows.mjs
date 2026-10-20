#!/usr/bin/env node
// نقل السيناريوهات من n8n Cloud إلى n8n على Azure (قرار المالك 2026-10-16).
//
// يعمل عبر الواجهة العامة REST (/api/v1) فقط. لا شيء يُكتب في المصدر إلا بأمرٍ
// صريح (--apply) في ثلاثة أوامر: pause-source وresume-source وactivate (والأخير على الوجهة)،
// وpause-target للتراجع.
//
//   المفاتيح تُقرأ من متغيّرات البيئة (لا من ملف ولا من سطر الأوامر ولا من المحادثة):
//     N8N_SRC_URL      https://businesspartnerai.app.n8n.cloud
//     N8N_SRC_API_KEY  مفتاح n8n API للمصدر   (n8n → Settings → n8n API)
//     N8N_DST_URL      https://<fqdn أو n8n.businesspartner.sa>
//     N8N_DST_API_KEY  مفتاح n8n API للوجهة
//
//   الأوامر:
//     export <dir>              يقرأ كل السيناريوهات من المصدر ويحفظها محلياً (+ تقرير)
//     report <dir>              تقرير من الملفات المحفوظة (بلا شبكة): الاعتمادات والمتغيّرات
//                               وجداول البيانات والمشغّلات — بالأسماء فقط
//     import <dir>              ينشئ السيناريوهات في الوجهة **غير مفعّلة** ويصلح المراجع
//                               الداخلية (معرّفات السيناريوهات والعنوان القديم)
//     activate <dir>            يفعّل في الوجهة ما كان فعّالاً في المصدر (يحمي من التكرار)
//     pause-source <dir>        يوقف في المصدر ما سيُفعَّل في الوجهة (يوم القطع)
//     resume-source <dir>       يعيد تفعيل ما أوقفه pause-source (التراجع)
//     pause-target <dir>        يوقف في الوجهة ما فُعِّل فيها (التراجع: يُنفَّذ قبل resume-source)
//
//   الخيارات:
//     --dry-run                 يقرأ ويحسب ويطبع الخطة، ولا يكتب شيئاً (لا ملفات ولا شبكة كتابة)
//     --only=webhook|stateful|all   (activate/pause/resume) الصنف المعنيّ. الافتراضي: webhook
//     --apply                   مطلوب لتنفيذ activate وpause-source وresume-source وpause-target فعلاً
//     --on-exists=skip|update   (import) سيناريو بالاسم نفسه موجود في الوجهة. الافتراضي: skip
//     --data-table-map=ملف.json  (import) خريطة معرّفات جداول البيانات {القديم: الجديد}
//     --include-archived        (export/import) يشمل المؤرشف (الافتراضي: يُتجاهل)
//     --ignore-source-state     (activate) لا يفحص المصدر. لا تستعمله إلا وأنت أوقفت المصدر بيدك
//
// ⚠ ما لا ينتقل عبر الواجهة، وهذه الأداة تُبلّغ عنه ولا تنقله:
//     ١) الاعتمادات (Credentials): أسرارها لا تُصدَّر. تُنشأ يدوياً في الوجهة بالاسم والنوع نفسيهما.
//     ٢) المتغيّرات ($vars في Cloud) — ميزة مدفوعة غير موجودة في المجتمعية: تتحوّل إلى $env.
//     ٣) بيانات جداول البيانات (Data tables): تُنسخ صفوفها يدوياً، ثم تُمرَّر خريطة المعرّفات.
//     ٤) سجلّ التنفيذات والوسوم والمجلدات.
//
// مبدأ القطع: لا مجدول في الموضعين. الاستيراد لا يفعّل شيئاً، والتفعيل نوعان:
//   webhook  — آمن مسبقاً (مسار مختلف في الموقعين).
//   stateful — مؤقّتات وأي مشغّل يستطلع أو يسجّل ردّ نداء (واتساب، Gmail، Notion…) فلا
//              يُفعَّل في الوجهة إلا بعد أن يكون موقوفاً في المصدر.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ───────────────────────── تصنيف المشغّلات ─────────────────────────

// مشغّلات تنتظر نداءً من الخارج على عنوانٍ يخصّ الاستضافة نفسها: تفعيلها في الوجهة
// لا يمسّ المصدر ولا يكرّر شيئاً.
export const WEBHOOK_TRIGGERS = new Set([
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.formTrigger",
  "@n8n/n8n-nodes-langchain.chatTrigger",
  "@n8n/n8n-nodes-langchain.mcpTrigger",
]);
// مشغّلات لا تعمل بنفسها (تُستدعى من سيناريو آخر أو يدوياً أو عند خطأ).
export const PASSIVE_TRIGGERS = new Set([
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.executeWorkflowTrigger",
  "n8n-nodes-base.errorTrigger",
  "n8n-nodes-base.start",
  "@n8n/n8n-nodes-langchain.manualChatTrigger",
]);
// مشغّلات تسجّل ردّ نداء عند Meta/Telegram… حين تُفعَّل — تفعيلها في الوجهة يخطف الحركة.
export const CALLBACK_REGISTERING = new Set([
  "n8n-nodes-base.whatsAppTrigger",
  "n8n-nodes-base.telegramTrigger",
  "n8n-nodes-base.facebookTrigger",
  "n8n-nodes-base.githubTrigger",
]);

export function triggerClass(node) {
  const t = String(node.type || "");
  if (WEBHOOK_TRIGGERS.has(t)) return "webhook";
  if (PASSIVE_TRIGGERS.has(t)) return "passive";
  if (/trigger$/i.test(t) || /\.(cron|emailReadImap|poll)/i.test(t)) return "stateful";
  return null; // ليست مشغّلاً
}

// ───────────────────────── عميل REST ─────────────────────────

export function makeClient({ baseUrl, apiKey, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), label = "n8n" }) {
  if (!baseUrl || !apiKey) throw new Error(`ينقص عنوان ${label} أو مفتاحه (متغيّرات البيئة)`);
  const u = new URL(baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !local) throw new Error(`${label}: العنوان يجب أن يكون https`);
  const origin = u.origin;
  async function call(method, p, body) {
    let attempt = 0;
    for (;;) {
      attempt++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      let r, text;
      try {
        r = await fetchImpl(`${origin}/api/v1${p}`, {
          method,
          headers: { "X-N8N-API-KEY": apiKey, accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        });
        text = await r.text();
      } finally { clearTimeout(timer); }
      if ([429, 502, 503, 504].includes(r.status) && attempt < 4) {
        await sleep(500 * attempt);
        continue;
      }
      if (!r.ok) {
        const err = new Error(`${label} ${method} ${p} → ${r.status} ${String(text).replace(/\s+/g, " ").slice(0, 200)}`);
        err.status = r.status;
        throw err;
      }
      return text ? JSON.parse(text) : {};
    }
  }
  return {
    origin,
    host: u.host,
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b === undefined ? {} : b),
    put: (p, b) => call("PUT", p, b),
    // كل السيناريوهات كاملة (القائمة قد لا تحمل العقد في كل الإصدارات).
    async listWorkflows() {
      const out = [];
      let cursor = "";
      do {
        const page = await call("GET", `/workflows?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        for (const w of page.data || []) out.push(Array.isArray(w.nodes) ? w : await call("GET", `/workflows/${w.id}`));
        cursor = page.nextCursor || "";
      } while (cursor);
      return out;
    },
  };
}

// ───────────────────────── التحليل (دوال خالصة) ─────────────────────────

const walkStrings = (v, fn) => {
  if (typeof v === "string") fn(v);
  else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, fn));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => walkStrings(x, fn));
};

const isOAuth = (type) => /OAuth[12]Api$/i.test(type);

export function analyze(workflows, { srcHost = "" } = {}) {
  const creds = new Map();        // type|name -> {type,name,ids,usedBy:Map(workflow->nodes)}
  const env = new Set();
  const vars = new Set();
  const tables = new Map();       // id -> {id,name,usedBy:Set}
  const hosts = new Map();
  const list = [];

  for (const w of workflows) {
    const triggers = [];
    const webhooks = [];
    let hasCallback = false;
    const classes = new Set();
    for (const n of w.nodes || []) {
      const cls = triggerClass(n);
      if (cls) {
        classes.add(cls);
        triggers.push(n.type);
        if (CALLBACK_REGISTERING.has(n.type)) hasCallback = true;
        if (n.type === "n8n-nodes-base.webhook") webhooks.push({ kind: "webhook", method: n.parameters?.httpMethod || "GET", path: n.parameters?.path || n.webhookId || "" });
        if (n.type === "n8n-nodes-base.formTrigger") webhooks.push({ kind: "form", path: n.webhookId || n.parameters?.path || "" });
        if (n.type === "@n8n/n8n-nodes-langchain.chatTrigger") webhooks.push({ kind: "chat", path: `${n.webhookId || ""}/chat` });
      }
      for (const [type, ref] of Object.entries(n.credentials || {})) {
        const name = String(ref?.name || "(بلا اسم)");
        const key = `${type}|${name}`;
        const c = creds.get(key) || { type, name, ids: new Set(), usedBy: new Map(), oauth: isOAuth(type) };
        if (ref?.id) c.ids.add(String(ref.id));
        const nodes = c.usedBy.get(w.id) || { workflow: w.name, active: !!w.active, nodes: [] };
        nodes.nodes.push(n.name);
        c.usedBy.set(w.id, nodes);
        creds.set(key, c);
      }
      if (/dataTable/i.test(String(n.type))) {
        const ref = n.parameters?.dataTableId;
        const id = String((ref && typeof ref === "object" ? ref.value : ref) || "");
        if (id) {
          const t = tables.get(id) || { id, name: (ref && ref.cachedResultName) || "", usedBy: new Set() };
          if (!t.name && ref && ref.cachedResultName) t.name = ref.cachedResultName;
          t.usedBy.add(w.name);
          tables.set(id, t);
        }
      }
    }
    walkStrings({ nodes: w.nodes, settings: w.settings }, (s) => {
      for (const m of s.matchAll(/\$env\.([A-Za-z_][A-Za-z0-9_]*)/g)) env.add(m[1]);
      for (const m of s.matchAll(/\$env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g)) env.add(m[1]);
      for (const m of s.matchAll(/\$vars\.([A-Za-z_][A-Za-z0-9_]*)/g)) vars.add(m[1]);
      for (const m of s.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        const h = m[1].toLowerCase();
        hosts.set(h, (hosts.get(h) || 0) + 1);
      }
    });
    const cls = classes.has("stateful") ? "stateful" : classes.has("webhook") ? "webhook" : classes.size ? "passive" : "none";
    list.push({
      id: w.id, name: w.name, active: !!w.active, archived: !!(w.isArchived || w.archived),
      class: cls, triggers: [...new Set(triggers)], webhooks, hasCallback,
    });
  }

  const hostRows = [...hosts].map(([host, count]) => ({
    host, count,
    note: /\.vercel\.app$|(^|\.)vercel\.com$/.test(host) ? "vercel" : srcHost && host === srcHost ? "n8n-cloud" : "",
  })).sort((a, b) => b.count - a.count);

  return {
    workflows: list,
    credentials: [...creds.values()].map((c) => ({
      type: c.type, name: c.name, oauth: c.oauth, ids: [...c.ids],
      usedByActive: [...c.usedBy.values()].some((u) => u.active),
      usedBy: [...c.usedBy.values()],
    })).sort((a, b) => a.name.localeCompare(b.name)),
    env: [...env].sort(),
    vars: [...vars].sort(),
    dataTables: [...tables.values()].map((t) => ({ id: t.id, name: t.name, usedBy: [...t.usedBy] })),
    hosts: hostRows,
    counts: {
      total: list.length,
      active: list.filter((x) => x.active).length,
      webhook: list.filter((x) => x.class === "webhook").length,
      stateful: list.filter((x) => x.class === "stateful").length,
      passive: list.filter((x) => x.class === "passive").length,
      none: list.filter((x) => x.class === "none").length,
    },
  };
}

export function formatReport(a) {
  const L = [];
  L.push(`السيناريوهات: ${a.counts.total} (فعّال ${a.counts.active}) — webhook ${a.counts.webhook} · مؤقّت/استطلاع ${a.counts.stateful} · فرعي/يدوي ${a.counts.passive} · بلا مشغّل ${a.counts.none}`);
  const cb = a.workflows.filter((w) => w.hasCallback);
  if (cb.length) L.push(`⚠ تسجّل ردّ نداء عند Meta/غيرها عند التفعيل (لا تُفعَّل في الوجهة قبل إيقاف المصدر): ${cb.map((w) => w.name).join(" · ")}`);
  L.push("", `الاعتمادات التي تُنشأ يدوياً في الوجهة بالاسم والنوع نفسيهما (${a.credentials.length}) — الأسماء فقط، لا أسرار:`);
  for (const c of a.credentials) {
    L.push(`  - ${c.name}  [${c.type}]${c.oauth ? "  ← OAuth: يحتاج تسجيل دخول من المتصفح" : ""}  ← ${c.usedBy.length} سيناريو${c.usedByActive ? " (منها فعّال)" : ""}`);
  }
  if (a.vars.length) L.push("", `⛔ متغيّرات $vars (ميزة مدفوعة غير موجودة في n8n المجتمعية) — حوّلها إلى $env.NAME وأضف القيم في Container App: ${a.vars.join(", ")}`);
  if (a.env.length) L.push("", `متغيّرات بيئة $env يجب أن توجد في Container App (الأسماء فقط): ${a.env.join(", ")}`);
  if (a.dataTables.length) {
    L.push("", `جداول البيانات (Data tables) — الصفوف لا تنتقل؛ انسخها يدوياً ثم مرّر --data-table-map (${a.dataTables.length}):`);
    for (const t of a.dataTables) L.push(`  - ${t.id}  ${t.name || "(بلا اسم مخبّأ)"}  ← ${t.usedBy.length} سيناريو`);
  }
  const flagged = a.hosts.filter((h) => h.note === "vercel");
  if (flagged.length) L.push("", `⚠ نداءات إلى Vercel داخل السيناريوهات (تنكسر يوم إيقاف Vercel — وجّهها إلى نطاق الموقع على Azure): ${flagged.map((h) => `${h.host}×${h.count}`).join(", ")}`);
  const wh = a.workflows.filter((w) => w.webhooks.length && w.active);
  if (wh.length) {
    L.push("", `ويبهوكات السيناريوهات الفعّالة (${wh.length}) — المسارات تنتقل كما هي، ويتغيّر العنوان وحده:`);
    for (const w of wh) for (const h of w.webhooks) L.push(`  - ${h.kind === "form" ? "/form/" : "/webhook/"}${h.path}${h.method ? `  [${h.method}]` : ""}  ← ${w.name}`);
  }
  return L.join("\n");
}

// ───────────────────────── التحويل للوجهة ─────────────────────────

const SETTINGS_OK = ["executionOrder", "timezone", "saveDataErrorExecution", "saveDataSuccessExecution",
  "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow", "callerPolicy", "callerIds"];

const origin = (u) => new URL(u).origin;

// يعيد نسخة معدَّلة: العنوان القديم ← الجديد، ومعرّفات السيناريوهات وجداول البيانات
// القديمة ← الجديدة. المطابقة للمعرّف **كاملاً** (لا مقطعاً) فلا تُلمَس نصوص أخرى.
export function transformForTarget(w, { idMap = {}, tableMap = {}, srcBase = "", dstBase = "" } = {}) {
  const stats = { host: 0, ids: 0, tables: 0 };
  const srcOrigin = srcBase ? origin(srcBase) : "";
  const dstOrigin = dstBase ? origin(dstBase) : "";
  const srcHost = srcOrigin ? new URL(srcOrigin).host : "";
  const dstHost = dstOrigin ? new URL(dstOrigin).host : "";
  const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idRe = Object.keys(idMap).length ? new RegExp(`/workflow/(${Object.keys(idMap).map(esc).join("|")})(?![A-Za-z0-9])`, "g") : null;
  const fix = (s) => {
    if (Object.hasOwn(idMap, s)) { stats.ids++; return idMap[s]; }
    if (Object.hasOwn(tableMap, s)) { stats.tables++; return tableMap[s]; }
    let t = s;
    if (srcOrigin && dstOrigin && t.includes(srcOrigin)) { t = t.split(srcOrigin).join(dstOrigin); stats.host++; }
    if (srcHost && dstHost && t.includes(srcHost)) { t = t.split(srcHost).join(dstHost); stats.host++; }
    if (idRe) t = t.replace(idRe, (_, id) => { stats.ids++; return `/workflow/${idMap[id]}`; });
    return t;
  };
  const deep = (v) => {
    if (typeof v === "string") return fix(v);
    if (Array.isArray(v)) return v.map(deep);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]));
    return v;
  };
  const out = deep({
    name: w.name, nodes: w.nodes, connections: w.connections,
    settings: Object.fromEntries(Object.entries(w.settings || {}).filter(([k]) => SETTINGS_OK.includes(k))),
    ...(w.staticData && Object.keys(w.staticData).length ? { staticData: w.staticData } : {}),
  });
  return { body: out, stats };
}

// أقلّ جسم يقبله أي إصدار (يُستعمل إن رُفض الجسم الكامل بـ400).
export const minimalBody = (b) => ({ name: b.name, nodes: b.nodes, connections: b.connections, settings: { executionOrder: b.settings?.executionOrder || "v1" } });

// بقايا: نصوص ما زالت تشير إلى المصدر أو إلى معرّف سيناريو قديم داخل نصّ أكبر.
export function residuals(body, { srcHost = "", oldIds = [] } = {}) {
  const found = new Set();
  walkStrings(body, (s) => {
    if (srcHost && s.includes(srcHost)) found.add(`المضيف القديم ${srcHost}`);
    for (const id of oldIds) if (s !== id && s.includes(id)) found.add(`معرّف سيناريو قديم ${id} داخل نصّ أو تعبير — راجعه يدوياً`);
  });
  return [...found];
}

// ───────────────────────── القراءة والكتابة المحلية ─────────────────────────

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

export function loadExport(dir) {
  if (!fs.existsSync(dir)) throw new Error(`المجلد غير موجود: ${dir}`);
  const manifest = readJson(path.join(dir, "_manifest.json"), null);
  if (!manifest) throw new Error(`لا _manifest.json في ${dir} — شغّل export أولاً`);
  const workflows = manifest.map((m) => readJson(path.join(dir, m.file), null)).filter(Boolean);
  return { manifest, workflows };
}

// ───────────────────────── الأوامر ─────────────────────────

export async function cmdExport({ src, dir, dryRun = false, includeArchived = false, log = console.log }) {
  const all = await src.listWorkflows();
  const kept = all.filter((w) => includeArchived || !(w.isArchived || w.archived));
  const skipped = all.length - kept.length;
  const analysis = analyze(kept, { srcHost: src.host });
  if (!dryRun) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ".gitignore"), "*\n"); // السيناريوهات قد تحمل مفاتيح مكتوبة داخل عقد — لا تُدفع إلى git
    for (const w of kept) fs.writeFileSync(path.join(dir, `${w.id}.json`), JSON.stringify(w));
    const manifest = analysis.workflows.map((x) => ({ id: x.id, name: x.name, active: x.active, archived: x.archived, class: x.class, file: `${x.id}.json` }));
    writeJson(path.join(dir, "_manifest.json"), manifest);
    writeJson(path.join(dir, "_active.json"), manifest.filter((m) => m.active).map((m) => m.id));
  }
  log(`${dryRun ? "[تجربة — لم يُكتب شيء] " : ""}صُدِّر ${kept.length} سيناريو${skipped ? ` (تُجوهل ${skipped} مؤرشف)` : ""}${dryRun ? "" : ` → ${dir}`}`);
  log(formatReport(analysis));
  return analysis;
}

export function cmdReport({ dir, log = console.log, srcHost = "" }) {
  const { workflows } = loadExport(dir);
  const a = analyze(workflows, { srcHost });
  log(formatReport(a));
  return a;
}

export async function cmdImport({ dst, dir, srcBase = "", dryRun = false, onExists = "skip", tableMap = {}, includeArchived = false, log = console.log }) {
  const { manifest, workflows } = loadExport(dir);
  const todo = workflows.filter((w, i) => includeArchived || !manifest[i]?.archived);
  const existing = new Map((await dst.listWorkflows()).map((w) => [w.name, w.id]));
  const dstBase = dst.origin;
  const idMap = {};
  const result = { created: [], updated: [], skipped: [], failed: [], degraded: [], residual: [] };

  // المرور الأول: إنشاء (أو مطابقة بالاسم) لتُعرف المعرّفات الجديدة.
  for (const w of todo) {
    const dup = existing.get(w.name);
    if (dup && onExists === "skip") { idMap[w.id] = dup; result.skipped.push(w.name); continue; }
    if (dup && onExists === "update") { idMap[w.id] = dup; continue; }
    if (dryRun) { idMap[w.id] = `NEW:${w.name}`; result.created.push(w.name); continue; }
    const { body } = transformForTarget(w, { srcBase, dstBase, tableMap });
    delete body.settings.errorWorkflow; // معرّفه الجديد غير معروف بعد — يُضبط في المرور الثاني
    try {
      let made;
      try { made = await dst.post("/workflows", body); }
      catch (e) {
        if (e.status !== 400) throw e;
        made = await dst.post("/workflows", minimalBody(body)); // رفض إعداداً لا يعرفه
        result.degraded.push(w.name);
      }
      idMap[w.id] = made.id;
      result.created.push(w.name);
    } catch (e) { result.failed.push({ name: w.name, error: e.message }); }
  }

  // المرور الثاني: إصلاح المراجع الداخلية (Execute Workflow وerrorWorkflow وروابط /workflow/ والعنوان).
  const refs = { ids: 0, host: 0, tables: 0 };
  for (const w of todo) {
    const newId = idMap[w.id];
    if (!newId) continue;
    if (result.skipped.includes(w.name)) continue;
    const { body, stats } = transformForTarget(w, { idMap, srcBase, dstBase, tableMap });
    refs.ids += stats.ids; refs.host += stats.host; refs.tables += stats.tables;
    for (const r of residuals(body, { srcHost: srcBase ? new URL(srcBase).host : "", oldIds: Object.keys(idMap) })) result.residual.push(`${w.name}: ${r}`);
    if (dryRun) continue;
    try {
      try { await dst.put(`/workflows/${newId}`, body); }
      catch (e) { if (e.status !== 400) throw e; await dst.put(`/workflows/${newId}`, minimalBody(body)); if (!result.degraded.includes(w.name)) result.degraded.push(w.name); }
      if (onExists === "update" && !result.created.includes(w.name)) result.updated.push(w.name);
    } catch (e) { result.failed.push({ name: w.name, error: `تحديث المراجع: ${e.message}` }); }
  }

  if (!dryRun) writeJson(path.join(dir, "_idmap.json"), idMap);
  log(`${dryRun ? "[تجربة — لم يُكتب شيء] " : ""}أُنشئ ${result.created.length} · حُدِّث ${result.updated.length} · تُخطّي (موجود) ${result.skipped.length} · فشل ${result.failed.length}`);
  log(`مراجع مُصلَحة: معرّفات ${refs.ids} · عنوان ${refs.host} · جداول ${refs.tables}`);
  if (result.degraded.length) log(`⚠ رفضت الوجهة بعض الإعدادات فاستُورد بالحد الأدنى (راجع إعدادات/ذاكرة): ${result.degraded.join(" · ")}`);
  for (const f of result.failed) log(`✗ ${f.name} — ${f.error}`);
  for (const r of result.residual) log(`⚠ ${r}`);
  log(dryRun
    ? "بروفة فقط. عند الاستيراد الفعلي تُنشأ السيناريوهات **غير مفعّلة**."
    : "السيناريوهات استُوردت **غير مفعّلة**. التالي: أنشئ الاعتمادات (بالأسماء في التقرير)، ثم activate.");
  return { ...result, idMap, refs };
}

// الصنف المعنيّ بأمرٍ ما.
// webhook = ما ينتظر نداءً أو يُستدعى من سيناريو آخر (آمن مسبقاً)؛ stateful = مؤقّتات واستطلاع وردّ نداء.
export const pick = (manifest, only) =>
  manifest.filter((m) => !m.archived && m.active && (only === "all" || (only === "webhook" ? m.class === "webhook" || m.class === "passive" : m.class === only)));

async function toggle(client, ids, action, log) {
  const ok = [], fail = [];
  for (const id of ids) {
    try { await client.post(`/workflows/${id}/${action}`); ok.push(id); }
    catch (e) { fail.push({ id, error: e.message }); log(`✗ ${action} ${id} — ${e.message}`); }
  }
  return { ok, fail };
}

export async function cmdActivate({ dst, src = null, dir, only = "webhook", apply = false, ignoreSourceState = false, log = console.log }) {
  const { manifest } = loadExport(dir);
  const idMap = readJson(path.join(dir, "_idmap.json"), null);
  if (!idMap) throw new Error("لا _idmap.json — شغّل import أولاً");
  const wanted = pick(manifest, only);
  const blocked = [];
  if (only !== "webhook" && !ignoreSourceState) {
    if (!src) throw new Error("فحص المصدر يحتاج N8N_SRC_URL/N8N_SRC_API_KEY (أو --ignore-source-state وأنت أوقفت المصدر بيدك)");
    for (const m of wanted) {
      if (m.class === "webhook" || m.class === "passive") continue; // مسارها مختلف أو تُستدعى فقط — لا تكرار
      try { const cur = await src.get(`/workflows/${m.id}`); if (cur.active) blocked.push(m.name); }
      catch (e) { blocked.push(`${m.name} (تعذّر فحص المصدر: ${e.message})`); }
    }
  }
  if (blocked.length) {
    log(`⛔ رُفض: هذه السيناريوهات ما زالت فعّالة في المصدر — تفعيلها في الوجهة يكرّر الرسائل:\n  - ${blocked.join("\n  - ")}\nأوقفها أولاً: pause-source --only=${only} --apply`);
    return { activated: [], blocked };
  }
  const ids = wanted.map((m) => idMap[m.id]).filter(Boolean);
  log(`${apply ? "" : "[تجربة — أضف --apply للتنفيذ] "}تفعيل ${ids.length} في الوجهة (الصنف: ${only}):\n  ${wanted.map((m) => m.name).join("\n  ")}`);
  if (!apply) return { activated: [], planned: ids, blocked };
  const r = await toggle(dst, ids, "activate", log);
  log(`فُعِّل ${r.ok.length} · فشل ${r.fail.length} (الفشل غالباً اعتماد ناقص — أنشئه ثم أعد الأمر)`);
  return { activated: r.ok, failed: r.fail, blocked };
}

export async function cmdPauseSource({ src, dir, only = "stateful", apply = false, log = console.log, resume = false }) {
  const { manifest } = loadExport(dir);
  const wanted = pick(manifest, only);
  const action = resume ? "activate" : "deactivate";
  log(`${apply ? "" : "[تجربة — أضف --apply للتنفيذ] "}${resume ? "إعادة تفعيل" : "إيقاف"} ${wanted.length} في المصدر (الصنف: ${only}):\n  ${wanted.map((m) => m.name).join("\n  ")}`);
  if (!apply) return { planned: wanted.map((m) => m.id) };
  const r = await toggle(src, wanted.map((m) => m.id), action, log);
  log(`${resume ? "أُعيد تفعيل" : "أُوقف"} ${r.ok.length} · فشل ${r.fail.length}`);
  return r;
}

// التراجع: يوقف في **الوجهة** ما كان مفعّلاً في المصدر (مُترجَماً بخريطة المعرّفات).
export async function cmdPauseTarget({ dst, dir, only = "stateful", apply = false, log = console.log }) {
  const { manifest } = loadExport(dir);
  const idMap = readJson(path.join(dir, "_idmap.json"), null);
  if (!idMap) throw new Error("لا _idmap.json — لا يُعرف أي سيناريو في الوجهة يقابل أيّاً");
  const wanted = pick(manifest, only).filter((m) => idMap[m.id]);
  log(`${apply ? "" : "[تجربة — أضف --apply للتنفيذ] "}إيقاف ${wanted.length} في الوجهة (الصنف: ${only}):\n  ${wanted.map((m) => m.name).join("\n  ")}`);
  if (!apply) return { planned: wanted.map((m) => idMap[m.id]) };
  const r = await toggle(dst, wanted.map((m) => idMap[m.id]), "deactivate", log);
  log(`أُوقف ${r.ok.length} · فشل ${r.fail.length}`);
  return r;
}

// ───────────────────────── سطر الأوامر ─────────────────────────

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {}; const pos = [];
  for (const a of rest) {
    if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); flags[k] = v === undefined ? true : v; }
    else pos.push(a);
  }
  return { cmd, flags, pos };
}

const envKey = (side) => process.env[`N8N_${side}_API_KEY`] || process.env[`N8N_${side}_KEY`] || "";

export async function main(argv = process.argv.slice(2)) {
  const { cmd, flags, pos } = parseArgs(argv);
  const dir = pos[0] || "./n8n-export";
  const dryRun = !!flags["dry-run"];
  const client = (side, label) => makeClient({ baseUrl: process.env[`N8N_${side}_URL`], apiKey: envKey(side), label });
  const srcOptional = () => (process.env.N8N_SRC_URL && envKey("SRC") ? client("SRC", "المصدر") : null);

  switch (cmd) {
    case "export": return void await cmdExport({ src: client("SRC", "المصدر"), dir, dryRun, includeArchived: !!flags["include-archived"] });
    case "report": return void cmdReport({ dir, srcHost: process.env.N8N_SRC_URL ? new URL(process.env.N8N_SRC_URL).host : "" });
    case "import": {
      const tableMap = flags["data-table-map"] ? readJson(String(flags["data-table-map"]), {}) : {};
      // بروفة بلا وجهة: --dry-run بلا N8N_DST_* يحسب الخطة على قائمة وجهة فارغة.
      const dstOffline = dryRun && !(process.env.N8N_DST_URL && envKey("DST"));
      const dst = dstOffline
        ? { origin: new URL(process.env.N8N_DST_URL || "https://n8n.example.invalid").origin, listWorkflows: async () => [] }
        : client("DST", "الوجهة");
      return void await cmdImport({
        dst, dir, dryRun, tableMap, onExists: flags["on-exists"] || "skip",
        includeArchived: !!flags["include-archived"], srcBase: process.env.N8N_SRC_URL || "",
      });
    }
    case "activate":
      return void await cmdActivate({ dst: client("DST", "الوجهة"), src: srcOptional(), dir, only: flags.only || "webhook", apply: !!flags.apply, ignoreSourceState: !!flags["ignore-source-state"] });
    case "pause-target":
      return void await cmdPauseTarget({ dst: client("DST", "الوجهة"), dir, only: flags.only || "stateful", apply: !!flags.apply });
    case "pause-source":
    case "resume-source":
      return void await cmdPauseSource({ src: client("SRC", "المصدر"), dir, only: flags.only || "stateful", apply: !!flags.apply, resume: cmd === "resume-source" });
    default:
      console.error("الاستعمال: export|report|import|activate|pause-source|resume-source|pause-target <dir> [--dry-run] [--apply] [--only=webhook|stateful|all]\nالتفاصيل في رأس الملف وفي docs/n8n-azure-cutover-2026-10-16.md");
      process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
