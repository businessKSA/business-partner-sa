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
//     webhooks <dir>            (بلا شبكة) كل ويبهوك وارد: عنوانه القديم ← الجديد، ومن يناديه، وما يُحدَّث عند
//                               المزوّد (Meta وغيره). يكتب _webhooks.json
//     verify <dir>              يقارن الوجهة بالتصدير ويفحص حالة التفعيل في الجهتين حسب المرحلة
//                               (--phase=prep|cutover|rollback). **يرفض ويُنهي برمز 2** إن وجد مجدولاً فعّالاً في الموضعين
//     probe-webhooks <dir>      يتأكد أن ويبهوكات الوجهة مسجَّلة **بلا تشغيلها**: GET على ويبهوك POST فقط (404 بتلميح)،
//                               ولا يلمس ما مساره GET ولا النماذج ولا المحادثة
//
//   الخيارات:
//     --dry-run                 يقرأ ويحسب ويطبع الخطة، ولا يكتب شيئاً (لا ملفات ولا شبكة كتابة)
//     --only=webhook|stateful|all   (activate/pause/resume) الصنف المعنيّ. الافتراضي: webhook
//     --apply                   مطلوب لتنفيذ activate وpause-source وresume-source وpause-target فعلاً
//     --on-exists=skip|update   (import) سيناريو بالاسم نفسه موجود في الوجهة. الافتراضي: skip
//     --data-table-map=ملف.json  (import) خريطة معرّفات جداول البيانات {القديم: الجديد}
//     --credential-map=ملف.json  (import) خريطة الاعتمادات {"النوع|الاسم": "المعرّف الجديد"}: معرّفات لا أسرار.
//                               export يكتب _credential-map.template.json بالأسماء فارغة القيم؛ انسخه إلى
//                               credential-map.json واملأ المعرّفات (من رابط كل اعتماد في واجهة الوجهة)
//     --phase=prep|cutover|rollback  (verify) أين نحن من القطع. الافتراضي: prep
//     --base=https://…          (webhooks/probe-webhooks) عنوان الوجهة الجديد. الافتراضي: N8N_DST_URL
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
export function transformForTarget(w, { idMap = {}, tableMap = {}, credMap = {}, srcBase = "", dstBase = "" } = {}) {
  const stats = { host: 0, ids: 0, tables: 0, creds: 0, credsUnmapped: [] };
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
  // الاعتمادات: معرّفاتها في Cloud لا تعني شيئاً في الوجهة. إن وُجدت خريطة {"النوع|الاسم": معرّف}
  // أُعيد ربط كل عقدة بالمعرّف الجديد؛ وما لا خريطة له يُسجَّل لتراه الأداة في تقريرها.
  const haveMap = Object.keys(credMap).length > 0;
  for (const n of out.nodes || []) {
    for (const [type, ref] of Object.entries(n.credentials || {})) {
      const name = String(ref?.name || "");
      const id = credMap[`${type}|${name}`];
      if (id) { n.credentials[type] = { id: String(id), name }; stats.creds++; }
      else if (haveMap) stats.credsUnmapped.push(`${type}|${name || "(بلا اسم)"}`);
    }
  }
  return { body: out, stats };
}

// خريطة الاعتمادات من ملف: القيم الفارغة تُهمَل (قالب لم يُملأ بعد). تقبل "معرّف" أو {id}.
export function loadCredentialMap(file) {
  const raw = readJson(file, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`خريطة الاعتمادات غير صالحة أو غير موجودة: ${file}`);
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = typeof v === "object" && v ? v.id : v;
    if (typeof id === "string" && id.trim() && !k.startsWith("_")) out[k] = id.trim();
  }
  return out;
}

// قالب الخريطة: كل (نوع|اسم) ظهر في السيناريوهات، قيمته فارغة، ليملأها المالك بمعرّفات الوجهة.
export function credentialTemplate(analysis) {
  return Object.fromEntries(analysis.credentials.map((c) => [`${c.type}|${c.name}`, ""]));
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
    // تقرير «ما لا يُنقل تلقائياً» محفوظاً بجانب التصدير (أسماء فقط، لا أسرار)، وقالب خريطة الاعتمادات.
    // القالب لا يطغى على خريطة ملأها المالك: تلك تُسمّى credential-map.json ولا تُكتب هنا.
    fs.writeFileSync(path.join(dir, "_report.txt"), formatReport(analysis) + "\n");
    writeJson(path.join(dir, "_report.json"), { counts: analysis.counts, credentials: analysis.credentials.map(({ type, name, oauth, usedByActive }) => ({ type, name, oauth, usedByActive })), env: analysis.env, vars: analysis.vars, dataTables: analysis.dataTables, hosts: analysis.hosts });
    writeJson(path.join(dir, "_credential-map.template.json"), credentialTemplate(analysis));
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

export async function cmdImport({ dst, dir, srcBase = "", dryRun = false, onExists = "skip", tableMap = {}, credMap = {}, includeArchived = false, log = console.log }) {
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
    const { body } = transformForTarget(w, { srcBase, dstBase, tableMap, credMap });
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
  const refs = { ids: 0, host: 0, tables: 0, creds: 0 };
  const unmapped = new Set();
  for (const w of todo) {
    const newId = idMap[w.id];
    if (!newId) continue;
    if (result.skipped.includes(w.name)) continue;
    const { body, stats } = transformForTarget(w, { idMap, srcBase, dstBase, tableMap, credMap });
    refs.ids += stats.ids; refs.host += stats.host; refs.tables += stats.tables; refs.creds += stats.creds;
    for (const u of stats.credsUnmapped) unmapped.add(u);
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
  log(`مراجع مُصلَحة: معرّفات ${refs.ids} · عنوان ${refs.host} · جداول ${refs.tables}${Object.keys(credMap).length ? ` · اعتمادات ${refs.creds}` : ""}`);
  if (unmapped.size) log(`⚠ اعتمادات بلا معرّف في خريطة الاعتمادات (${unmapped.size}) — تُربط يدوياً في الواجهة أو أضفها للخريطة وأعد الاستيراد --on-exists=update:\n  - ${[...unmapped].sort().join("\n  - ")}`);
  if (result.degraded.length) log(`⚠ رفضت الوجهة بعض الإعدادات فاستُورد بالحد الأدنى (راجع إعدادات/ذاكرة): ${result.degraded.join(" · ")}`);
  for (const f of result.failed) log(`✗ ${f.name} — ${f.error}`);
  for (const r of result.residual) log(`⚠ ${r}`);
  log(dryRun
    ? "بروفة فقط. عند الاستيراد الفعلي تُنشأ السيناريوهات **غير مفعّلة**."
    : "السيناريوهات استُوردت **غير مفعّلة**. التالي: أنشئ الاعتمادات (بالأسماء في التقرير)، ثم activate.");
  return { ...result, idMap, refs, credsUnmapped: [...unmapped] };
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

// ───────────────────────── الويبهوكات الواردة ─────────────────────────

// من يناديه — قواعد معروفة من الكود (api/ وgenerate.mjs وagents/ وai-space) ومن docs/n8n-azure-cutover-2026-10-16.md §3.
// ما لا تطابقه قاعدة يُعلَّم «غير معروف» ليفحصه المالك قبل القطع.
export const KNOWN_CONSUMERS = [
  { re: /^website-lead-notify$/, who: "api/book.js · api/requests.js · api/_stage.js · api/_eor.js (الخادم)", via: "N8N_BASE_URL (أو OWNER_WA_WEBHOOK)" },
  { re: /^bp-ats-application$/, who: "api/candidate.js (الخادم)", via: "N8N_BASE_URL (أو N8N_ATS_WEBHOOK)" },
  { re: /^bp-ai\/revenue-intake$/, who: "api/_aiws.js (الخادم)", via: "N8N_BASE_URL (أو BP_REVENUE_INTAKE_URL)" },
  { re: /^f08bf4a4-62e9-4aa6-9a44-bf3080682fb3\/chat$/, who: "api/chat.js احتياطاً + لوحات الفريق (المتصفح)", via: "N8N_BASE_URL وقت التشغيل ووقت البناء" },
  { re: /^(05804653-e4bf-465c-aa1f-69773ea1f86d\/chat|client-intake-web|bp3-portal-9kq4z)$/, who: "لوحة الامتثال وتسكين العمالة (المتصفح)", via: "N8N_BASE_URL وقت البناء" },
  { re: /-intake$/, who: "/dashboard و/portal — مدراء الفريق (المتصفح)", via: "N8N_BASE_URL وقت البناء" },
  { re: /^ss-(login|stats|chat|knowledge|names)$/, who: "بوابة الخدمات المشتركة (المتصفح)", via: "N8N_BASE_URL وقت البناء" },
  { re: /^bp-chat-(monitor|send|suggest|media)-/, who: "/monitor — BP Inbox (المتصفح)", via: "N8N_BASE_URL وقت البناء" },
  { re: /^bp-agent-send$/, who: "agents/azure (فريق الوكلاء)", via: "BP_N8N_BASE في Container Apps Job (+ سرّ GitHub)" },
  { re: /^doc-agent-vault-sync$/, who: "api/_docagent.js", via: "DOC_AGENT_SYNC_URL" },
  { re: /^bp-catalog-changed$/, who: "لوحة العروض quotes/src/lib/catalog-sync.ts", via: "CATALOG_WEBHOOK_URL" },
  { re: /^(bp-ai-control|muin-command-space|muin-health)/, who: "ai-space (لوحة التحكم)", via: "AI_SPACE_CONFIG (سرّ GitHub — المسار سرّي)" },
];

// مزوّدون خارجيون قد يحملون عنوان n8n القديم ويُحدَّث العنوان عندهم (من اسم المسار أو السيناريو).
export const PROVIDER_HINTS = [
  { re: /docusign/i, who: "DocuSign Connect" },
  { re: /moyasar|mysr/i, who: "مُيسّر (Webhooks)" },
  { re: /tamara/i, who: "تمارا (رابط الإشعار)" },
  { re: /resend|bounce/i, who: "Resend (Webhook الارتداد)" },
  { re: /notion/i, who: "Notion (أتمتة/أزرار تُرسل Webhook)" },
  { re: /github/i, who: "GitHub (Webhook)" },
  { re: /whatsapp|(^|[^a-z])wa([^a-z]|$)/i, who: "Meta — WhatsApp" },
];

// مشغّلات تسجّل ردّ نداء عند مزوّد: العنوان يُحدَّث عنده، ومساره عندنا `/webhook/<webhookId>/webhook`
// (تقريبي — الحاكم هو الـProduction URL في العقدة بعد التفعيل).
const CALLBACK_PROVIDER = {
  "n8n-nodes-base.whatsAppTrigger": "Meta — WhatsApp (Callback URL + Verify Token)",
  "n8n-nodes-base.facebookTrigger": "Meta — تطبيق فيسبوك (Webhooks)",
  "n8n-nodes-base.telegramTrigger": "Telegram (setWebhook — يُسجَّل تلقائياً عند التفعيل)",
  "n8n-nodes-base.githubTrigger": "GitHub (يُسجَّل تلقائياً عند التفعيل)",
};

const stripSlash = (p) => String(p || "").replace(/^\/+/, "");
const joinUrl = (base, p) => `${String(base || "").replace(/\/+$/, "")}${p}`;
// مسارات سرّية: لا تُطبع كاملة في الطرفية (تبقى كاملة في _webhooks.json المحلي غير المدفوع).
export const maskPath = (p) => {
  const m = String(p).match(/^(bp-ai-control|muin-command-space|muin-health)/);
  return m ? `${m[1]}…(سرّي)` : p;
};

export function webhookEndpoints(workflows, { srcBase = "", dstBase = "" } = {}) {
  const rows = [];
  for (const w of workflows) {
    for (const n of w.nodes || []) {
      const t = String(n.type || "");
      let kind = "", p = "", method = "", urlPath = "", approx = false;
      if (t === "n8n-nodes-base.webhook") {
        kind = "webhook"; method = n.parameters?.httpMethod || "GET"; p = stripSlash(n.parameters?.path || n.webhookId);
        // مسار فيه معاملات (:id) يُخدَم تحت معرّف العقدة
        urlPath = p.includes(":") && n.webhookId ? `/webhook/${n.webhookId}/${p}` : `/webhook/${p}`;
      } else if (t === "n8n-nodes-base.formTrigger") {
        kind = "form"; method = "GET"; p = stripSlash(n.parameters?.path || n.webhookId); urlPath = `/form/${p}`;
      } else if (t === "@n8n/n8n-nodes-langchain.chatTrigger") {
        kind = "chat"; method = "POST"; p = `${n.webhookId || ""}/chat`; urlPath = `/webhook/${p}`;
      } else if (CALLBACK_PROVIDER[t]) {
        kind = "callback"; method = "GET+POST"; p = `${n.webhookId || ""}/webhook`; urlPath = `/webhook/${p}`; approx = true;
      } else continue;
      if (!p || p === "/chat" || p === "/webhook") continue; // بلا معرّف: لا عنوان يُحسب
      const known = KNOWN_CONSUMERS.find((k) => k.re.test(p)) || null;
      const provider = CALLBACK_PROVIDER[t]
        || (PROVIDER_HINTS.find((h) => h.re.test(p) || h.re.test(w.name || "")) || {}).who
        || null;
      rows.push({
        workflow: w.name, id: w.id, active: !!w.active, kind, method, path: p, approx,
        srcUrl: srcBase ? joinUrl(srcBase, urlPath) : "", dstUrl: dstBase ? joinUrl(dstBase, urlPath) : "",
        consumer: known ? { who: known.who, via: known.via } : null, provider,
      });
    }
  }
  return rows;
}

export function cmdWebhooks({ dir, srcBase = "", dstBase = "", dryRun = false, log = console.log }) {
  const { workflows } = loadExport(dir);
  const rows = webhookEndpoints(workflows, { srcBase, dstBase });
  const active = rows.filter((r) => r.active);
  const orphans = active.filter((r) => !r.consumer && !r.provider && r.kind !== "callback");
  const providers = [...new Set(active.map((r) => r.provider).filter(Boolean))].sort();
  log(`ويبهوكات واردة: ${rows.length} (فعّال ${active.length}) — العنوان الجديد: ${dstBase || "(ضع --base أو N8N_DST_URL)"}`);
  for (const r of active) {
    log(`  [${r.kind}] ${r.method.padEnd(8)} ${maskPath(r.path)}  ← ${r.workflow}`);
    if (r.consumer) log(`        يناديه: ${r.consumer.who}  |  يتبدّل عبر: ${r.consumer.via}`);
    if (r.provider) {
      log(`        عند المزوّد: ${r.provider}${r.approx ? "  — انسخ الـProduction URL من العقدة بعد التفعيل" : ""}`);
      if (dstBase && !/…\(سرّي\)$/.test(maskPath(r.path))) log(`        العنوان الجديد${r.approx ? " (تقريبي)" : ""}: ${r.dstUrl}`);
    }
  }
  if (orphans.length) log(`\n⚠ فعّالة بلا مستهلك معروف في المستودع (${orphans.length}) — اعرف من يناديها قبل القطع، وإلا تبقى تنتظر على العنوان القديم:\n  - ${orphans.map((r) => `${maskPath(r.path)} ← ${r.workflow}`).join("\n  - ")}`);
  if (providers.length) log(`\nمزوّدون يُحدَّث العنوان عندهم (استدلال من أسماء المسارات والمشغّلات — راجع لوحة كلٍّ منهم): ${providers.join(" · ")}`);
  if (!dryRun) writeJson(path.join(dir, "_webhooks.json"), rows);
  return { rows, orphans, providers };
}

// يتأكد أن الويبهوكات مسجَّلة في الوجهة **بلا تشغيلها**: n8n يردّ على GET لمسار ويبهوك POST فقط بـ404 وتلميح
// «Did you mean to make a POST request?» دون أي تنفيذ. أما غير المسجَّل (السيناريو غير فعّال) فيردّ
// «The requested webhook … is not registered». لا نلمس ما مساره GET ولا النماذج ولا المحادثة (قد تُنفَّذ).
// ⚠ سلوك رسائل n8n يتغيّر بين الإصدارات: تحقّق من أول مسار يدوياً قبل الاعتماد على النتيجة.
export async function cmdProbeWebhooks({ dir, base, fetchImpl = globalThis.fetch, timeoutMs = 15000, log = console.log }) {
  if (!base) throw new Error("ضع --base أو N8N_DST_URL");
  const u = new URL(base);
  if (u.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) throw new Error("العنوان يجب أن يكون https");
  const { workflows } = loadExport(dir);
  const rows = webhookEndpoints(workflows, { dstBase: u.origin }).filter((r) => r.active);
  const result = { registered: [], missing: [], unexpected: [], unknown: [], skipped: [] };
  for (const r of rows) {
    const m = String(r.method).toUpperCase();
    if (r.kind !== "webhook" || m === "GET" || m.includes(",") || r.path.includes(":")) { result.skipped.push(`${maskPath(r.path)} (${r.kind} ${r.method})`); continue; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetchImpl(r.dstUrl, { method: "GET", signal: ctrl.signal, headers: { accept: "application/json" } });
      const text = String(await resp.text()).slice(0, 600);
      if (resp.status === 404 && /not registered for GET|Did you mean to make a/i.test(text)) result.registered.push(maskPath(r.path));
      else if (resp.status === 404 && /not registered/i.test(text)) result.missing.push(`${maskPath(r.path)} ← ${r.workflow}`);
      else if (resp.status < 300) result.unexpected.push(`${maskPath(r.path)} ← ${r.workflow} (ردّ ${resp.status} على GET)`);
      else result.unknown.push(`${maskPath(r.path)} ← ${r.workflow} (${resp.status})`);
    } catch (e) { result.unknown.push(`${maskPath(r.path)} ← ${r.workflow} (${e.name === "AbortError" ? "مهلة" : e.message})`); }
    finally { clearTimeout(timer); }
  }
  log(`مسجَّل ${result.registered.length} · غير مسجَّل ${result.missing.length} · غير مفهوم ${result.unknown.length} · استجاب لـGET ${result.unexpected.length} · لم يُفحص ${result.skipped.length}`);
  for (const x of result.missing) log(`✗ غير مسجَّل في الوجهة (السيناريو غير مفعّل؟ أو المسار تغيّر): ${x}`);
  for (const x of result.unexpected) log(`⚠ ${x} — قد يكون نُفّذ؛ راجع Executions`);
  for (const x of result.unknown) log(`? ${x}`);
  if (result.skipped.length) log(`لم يُفحص (مساره GET أو نموذج/محادثة/ردّ نداء — اختبره يدوياً ببيانات المالك): ${result.skipped.length}`);
  return result;
}

// ───────────────────────── التحقق (قبل القطع / بعده / عند التراجع) ─────────────────────────

export const PHASES = ["prep", "cutover", "rollback"];

// ما نتوقعه من حالة التفعيل في كل جهة لكل سيناريو: "must" = يجب أن يكون فعّالاً، "mustnot" = يجب ألا يكون، "any".
// الأصل هو حالته وقت التصدير (manifest.active). قاعدة القطع: لا مجدول (stateful) فعّال في الموضعين أبداً.
export function expectations(m, phase) {
  if (!m.active) return { src: "any", dst: "mustnot" };
  if (m.class === "stateful") {
    return phase === "cutover" ? { src: "mustnot", dst: "must" } : { src: "must", dst: "mustnot" };
  }
  // webhook / passive: الإنتاج يبقى في Cloud حتى القطع، وبعده يصير في الوجهة وCloud صمّام التراجع.
  return phase === "cutover" ? { src: "any", dst: "must" } : { src: "must", dst: "any" };
}

const sameNodes = (a = [], b = []) => a.length === b.length && JSON.stringify(a.map((n) => n.name).sort()) === JSON.stringify(b.map((n) => n.name).sort());

export async function cmdVerify({ dst, src = null, dir, phase = "prep", srcHost = "", log = console.log }) {
  if (!PHASES.includes(phase)) throw new Error(`مرحلة غير معروفة: ${phase} (prep|cutover|rollback)`);
  const { manifest, workflows } = loadExport(dir);
  const idMap = readJson(path.join(dir, "_idmap.json"), null);
  if (!idMap) throw new Error("لا _idmap.json — شغّل import أولاً");
  const byId = new Map(workflows.map((w) => [w.id, w]));
  const errors = [], warnings = [];
  const rows = manifest.filter((m) => !m.archived);
  let checked = 0;
  for (const m of rows) {
    const newId = idMap[m.id];
    if (!newId) { errors.push(`${m.name}: لا مقابل في الوجهة (لم يُستورد)`); continue; }
    let d;
    try { d = await dst.get(`/workflows/${newId}`); }
    catch (e) { errors.push(`${m.name}: تعذّرت قراءته من الوجهة (${e.message})`); continue; }
    checked++;
    const orig = byId.get(m.id);
    if (orig && !sameNodes(orig.nodes, d.nodes)) errors.push(`${m.name}: العقد في الوجهة (${(d.nodes || []).length}) لا تطابق التصدير (${(orig.nodes || []).length})`);
    if (srcHost && JSON.stringify(d.nodes || []).includes(srcHost)) warnings.push(`${m.name}: ما زال يحمل العنوان القديم ${srcHost} في عقدة`);
    const exp = expectations(m, phase);
    const dstActive = !!d.active;
    if (exp.dst === "mustnot" && dstActive) errors.push(`${m.name}: فعّال في الوجهة وهو ${m.active ? "مجدول/استطلاع — ممنوع في هذه المرحلة" : "غير فعّال في المصدر"}`);
    if (exp.dst === "must" && !dstActive) errors.push(`${m.name}: يجب أن يكون فعّالاً في الوجهة في مرحلة ${phase} (غالباً اعتماد ناقص)`);
    if (src) {
      let s;
      try { s = await src.get(`/workflows/${m.id}`); }
      catch (e) { warnings.push(`${m.name}: تعذّر فحص المصدر (${e.message})`); continue; }
      const srcActive = !!s.active;
      if (m.class === "stateful" && srcActive && dstActive) errors.push(`⛔ ${m.name}: فعّال في المصدر والوجهة معاً — يكرّر الرسائل. أوقف الوجهة (pause-target) أو المصدر (pause-source) فوراً`);
      else if (exp.src === "mustnot" && srcActive) errors.push(`${m.name}: ما زال فعّالاً في المصدر وكان يجب أن يُوقَف في مرحلة ${phase}`);
      else if (exp.src === "must" && !srcActive) warnings.push(`${m.name}: غير فعّال في المصدر وكان فعّالاً وقت التصدير (تغيّر منذ ذلك؟ أعد export)`);
    }
  }
  if (!src) warnings.push("لم يُفحص المصدر (لا N8N_SRC_URL/N8N_SRC_API_KEY): التكرار بين الجهتين غير مُتحقَّق منه");
  const ok = errors.length === 0;
  log(`${ok ? "✓" : "✗"} مرحلة ${phase}: فُحص ${checked} من ${rows.length} · أخطاء ${errors.length} · تحذيرات ${warnings.length}`);
  for (const e of errors) log(`✗ ${e}`);
  for (const w of warnings) log(`⚠ ${w}`);
  return { ok, errors, warnings, checked, total: rows.length };
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
  // قيمة --only خاطئة (خطأ مطبعي) كانت تعني «لا شيء» بصمت؛ الآن ترفض.
  const only = (dflt) => {
    const v = flags.only === undefined ? dflt : flags.only;
    if (!["webhook", "stateful", "all"].includes(v)) throw new Error(`--only يقبل webhook أو stateful أو all (وصل: ${v})`);
    return v;
  };
  const dstBaseFor = () => String(flags.base || process.env.N8N_DST_URL || process.env.N8N_BASE_URL || "").replace(/\/+$/, "");

  switch (cmd) {
    case "export": return void await cmdExport({ src: client("SRC", "المصدر"), dir, dryRun, includeArchived: !!flags["include-archived"] });
    case "report": return void cmdReport({ dir, srcHost: process.env.N8N_SRC_URL ? new URL(process.env.N8N_SRC_URL).host : "" });
    case "import": {
      const tableMap = flags["data-table-map"] ? readJson(String(flags["data-table-map"]), {}) : {};
      // خريطة الاعتمادات: صريحة بالعلَم، وإلا credential-map.json داخل مجلد التصدير إن وُجد.
      const credFile = flags["credential-map"] ? String(flags["credential-map"]) : (fs.existsSync(path.join(dir, "credential-map.json")) ? path.join(dir, "credential-map.json") : "");
      const credMap = credFile ? loadCredentialMap(credFile) : {};
      if (credFile) console.log(`خريطة الاعتمادات: ${credFile} (${Object.keys(credMap).length} معرّف)`);
      // بروفة بلا وجهة: --dry-run بلا N8N_DST_* يحسب الخطة على قائمة وجهة فارغة.
      const dstOffline = dryRun && !(process.env.N8N_DST_URL && envKey("DST"));
      const dst = dstOffline
        ? { origin: new URL(process.env.N8N_DST_URL || "https://n8n.example.invalid").origin, listWorkflows: async () => [] }
        : client("DST", "الوجهة");
      return void await cmdImport({
        dst, dir, dryRun, tableMap, credMap, onExists: flags["on-exists"] || "skip",
        includeArchived: !!flags["include-archived"], srcBase: process.env.N8N_SRC_URL || "",
      });
    }
    case "activate":
      return void await cmdActivate({ dst: client("DST", "الوجهة"), src: srcOptional(), dir, only: only("webhook"), apply: !!flags.apply, ignoreSourceState: !!flags["ignore-source-state"] });
    case "pause-target":
      return void await cmdPauseTarget({ dst: client("DST", "الوجهة"), dir, only: only("stateful"), apply: !!flags.apply });
    case "pause-source":
    case "resume-source":
      return void await cmdPauseSource({ src: client("SRC", "المصدر"), dir, only: only("stateful"), apply: !!flags.apply, resume: cmd === "resume-source" });
    case "webhooks":
      return void cmdWebhooks({ dir, srcBase: process.env.N8N_SRC_URL || "https://businesspartnerai.app.n8n.cloud", dstBase: dstBaseFor(), dryRun });
    case "probe-webhooks":
      return void await cmdProbeWebhooks({ dir, base: dstBaseFor() });
    case "verify": {
      const r = await cmdVerify({
        dst: client("DST", "الوجهة"), src: srcOptional(), dir, phase: String(flags.phase || "prep"),
        srcHost: process.env.N8N_SRC_URL ? new URL(process.env.N8N_SRC_URL).host : "",
      });
      if (!r.ok) process.exitCode = 2;
      return;
    }
    default:
      console.error("الاستعمال: export|report|import|activate|pause-source|resume-source|pause-target|webhooks|verify|probe-webhooks <dir> [--dry-run] [--apply] [--only=webhook|stateful|all] [--phase=prep|cutover|rollback] [--base=https://…]\nالتفاصيل في رأس الملف وفي docs/n8n-azure-cutover-2026-10-16.md");
      process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
