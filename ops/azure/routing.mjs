// Business Partner — محرّك التوجيه على Azure (يقرأ vercel.json كما هو).
//
// السبب: الاستضافة على Azure لا تملك لغة redirects/rewrites تعادل لغة Vercel
// (Static Web Apps مثلاً: ملف إعداد ≤ 20KB، ويمين المسار فقط يقبل wildcard، ولا
// تُوجَّه الطلبات حسب المضيف ولا إلى أصل خارجي). ولو نسخنا vercel.json إلى صيغةٍ
// أخرى لانحرفت النسختان عند أول تعديل. فالخادم على Azure (server.mjs) يقرأ
// vercel.json نفسه، وهذا الملف هو المترجم: مصدر الحقيقة واحد، ولا ملف مولَّد
// يمكن أن يتقادم. ما يغيّره `site/scripts/hidden.mjs` في vercel.json (أسطر الـ302
// المُدارة) يصل Azure في البناء التالي بلا أي خطوة إضافية.
//
// ما يدعمه (وهو كل ما يستعمله vercel.json اليوم، ويرمي خطأً صريحاً لما عداه
// بدل أن يتجاهله بصمت — الاختبار tests/azure-routing.test.mjs يمسك ذلك):
//   • مصادر على طريقة path-to-regexp v6:  :name  :name(a|b)  (a|b)  :name*  :name+  :name?
//   • redirects:  permanent:true → 308، permanent:false → 307، أو statusCode صريح
//   • rewrites: داخلية أو إلى أصل خارجي (https://…)، مع شرط has (host/header/cookie/query)
//   • headers: مفاتيح وقيم لكل مصدر
//   • functions[*].maxDuration · crons · cleanUrls · trailingSlash
//
// الدلالات التي تحققنا منها على الموقع الحيّ (2026-10-11، GET فقط):
//   • المطابقة حسّاسة لحالة الأحرف  (/Revenue-OS → 404)
//   • الاستعلام الأصلي يُلحَق بوجهة التحويل  (/ar/revenue-os?x=1 → …?x=1)
//   • التحويل 308 للمسارات المنقولة دائماً و307 للمؤقتة

const DEFAULT_PATTERN = "[^\\/#\\?]+?";
const PREFIXES = "./";
const escapeLiteral = (s) => s.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");

// يقرأ مجموعة (...) بما فيها المتداخل، ويعيد النص الداخلي ومكان ما بعد الإغلاق.
function readGroup(str, start) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (ch === "\\") { i++; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return { body: str.slice(start + 1, i), end: i + 1 };
    }
  }
  throw new Error(`routing: مجموعة غير مغلقة في «${str}»`);
}

// path-to-regexp v6 parse، مختصراً: يرمي لكل صيغة غير مدعومة.
export function parsePattern(str) {
  const tokens = [];
  let i = 0, key = 0, pending = "";
  const flush = () => { if (pending) { tokens.push(pending); pending = ""; } };
  const pushParam = (name, pattern) => {
    let prefix = "";
    if (pending && PREFIXES.includes(pending[pending.length - 1])) {
      prefix = pending[pending.length - 1];
      pending = pending.slice(0, -1);
    }
    flush();
    let modifier = "";
    if (i < str.length && "*+?".includes(str[i])) modifier = str[i++];
    tokens.push({ name, prefix, pattern, modifier });
  };
  while (i < str.length) {
    const ch = str[i];
    if (ch === "\\") { pending += str[i + 1] || ""; i += 2; continue; }
    if (ch === ":") {
      let j = i + 1, name = "";
      while (j < str.length && /[A-Za-z0-9_]/.test(str[j])) name += str[j++];
      if (!name) throw new Error(`routing: «:» بلا اسم في «${str}»`);
      let pattern = DEFAULT_PATTERN;
      if (str[j] === "(") { const g = readGroup(str, j); pattern = g.body; j = g.end; }
      i = j;
      pushParam(name, pattern);
    } else if (ch === "(") {
      const g = readGroup(str, i);
      i = g.end;
      pushParam(String(key++), g.body);
    } else if ("{}*+?".includes(ch)) {
      throw new Error(`routing: الصيغة «${ch}» غير مدعومة في «${str}»`);
    } else { pending += ch; i++; }
  }
  flush();
  return tokens;
}

export function compileSource(source) {
  const tokens = parsePattern(source);
  let route = "^";
  const keys = [];
  for (const t of tokens) {
    if (typeof t === "string") { route += escapeLiteral(t); continue; }
    keys.push(t);
    const prefix = escapeLiteral(t.prefix);
    if (t.modifier === "+" || t.modifier === "*") {
      route += `(?:${prefix}((?:${t.pattern})(?:${prefix}(?:${t.pattern}))*))${t.modifier === "*" ? "?" : ""}`;
    } else if (t.modifier === "?") {
      route += `(?:${prefix}(${t.pattern}))?`;
    } else {
      route += `${prefix}(${t.pattern})`;
    }
  }
  route += "\\/?$";
  return { source, re: new RegExp(route), keys };
}

export function matchSource(compiled, pathname) {
  const m = compiled.re.exec(pathname);
  if (!m) return null;
  const params = {};
  compiled.keys.forEach((k, idx) => { if (m[idx + 1] !== undefined) params[k.name] = m[idx + 1]; });
  return params;
}

// يملأ قالب وجهة (`/:lang/catalog` أو `https://h/x/:path*?a=:b`) من القيم الملتقطة.
export function fillTemplate(template, params) {
  const m = /^(https?:\/\/[^/?#]+)?([^?#]*)(\?[^#]*)?(#.*)?$/.exec(template);
  const origin = m[1] || "";
  const pathPart = m[2] || "";
  const query = m[3] || "";
  const fill = (str) => {
    const toks = parsePattern(str.replace(/%/g, "%25"));
    return toks.map((t) => {
      if (typeof t === "string") return t;
      const v = params[t.name];
      if (v === undefined || v === "") {
        if (t.modifier === "*" || t.modifier === "?") return "";
        return t.prefix; // معامل مطلوب غائب: يُترك فارغاً بدل أن ينفجر الطلب
      }
      return t.prefix + v;
    }).join("").replace(/%25/g, "%");
  };
  return origin + fill(pathPart) + (query ? "?" + fill(query.slice(1)) : "");
}

// دمج الاستعلام: الوجهة تغلب. (الطلب الذي يحمل __route= لا يغيّر الدالة التي
// اختارها rewrite — اختلاف مقصود عن devserver.mjs الذي كان يترك الطلب يغلب.)
export function mergeQuery(destination, originalSearch) {
  const orig = new URLSearchParams(String(originalSearch || "").replace(/^\?/, ""));
  const qi = destination.indexOf("?");
  const base = qi < 0 ? destination : destination.slice(0, qi);
  const dest = new URLSearchParams(qi < 0 ? "" : destination.slice(qi + 1));
  const out = new URLSearchParams();
  for (const [k, v] of dest) out.append(k, v);
  for (const [k, v] of orig) if (!dest.has(k)) out.append(k, v);
  const s = out.toString();
  return s ? `${base}?${s}` : base;
}

const lc = (s) => String(s == null ? "" : s).toLowerCase();

// شرط has/missing. ctx: { host, headers, query (URLSearchParams), cookies }
function conditionHolds(cond, ctx) {
  const test = (actual) => {
    if (actual === undefined || actual === null) return false;
    if (cond.value === undefined) return true;
    const want = String(cond.value);
    if (lc(actual) === lc(want)) return true;
    try { return new RegExp(`^(?:${want})$`, "i").test(String(actual)); } catch { return false; }
  };
  switch (cond.type) {
    case "host": return test(ctx.host);
    case "header": return test(ctx.headers[lc(cond.key)]);
    case "cookie": return test(ctx.cookies[cond.key]);
    case "query": return test(ctx.query.get(cond.key));
    default: throw new Error(`routing: نوع شرط غير مدعوم «${cond.type}»`);
  }
}
const hasOk = (rule, ctx) =>
  (!rule.has || rule.has.every((c) => conditionHolds(c, ctx))) &&
  (!rule.missing || !rule.missing.some((c) => conditionHolds(c, ctx)));

export function statusOf(rule) {
  if (rule.statusCode) return rule.statusCode;
  return rule.permanent ? 308 : 307;
}

export const isExternal = (dest) => /^https?:\/\//i.test(dest);

// يحمّل vercel.json ويجهّز القواعد. يرمي عند أي مصدر لا يفهمه.
export function loadRouting(config) {
  const compile = (list, kind) => (list || []).map((r, idx) => {
    try { return { ...r, _c: compileSource(r.source) }; }
    catch (e) { throw new Error(`${kind}[${idx}] (${r.source}): ${e.message}`); }
  });
  return {
    cleanUrls: config.cleanUrls === true,
    trailingSlash: config.trailingSlash,
    redirects: compile(config.redirects, "redirects"),
    rewrites: compile(config.rewrites, "rewrites"),
    headers: compile(config.headers, "headers"),
    functions: config.functions || {},
    crons: config.crons || [],
    raw: config,
  };
}

// أول redirect مطابق → { status, location } أو null.
export function findRedirect(routing, { pathname, search, host, headers = {}, cookies = {} }) {
  const ctx = { host, headers, cookies, query: new URLSearchParams(search || "") };
  for (const r of routing.redirects) {
    const params = matchSource(r._c, pathname);
    if (!params || !hasOk(r, ctx)) continue;
    const dest = fillTemplate(r.destination, params);
    return { status: statusOf(r), location: mergeQuery(dest, search), rule: r };
  }
  return null;
}

// أول rewrite مطابق → { destination, external } أو null. destination يحمل الاستعلام مدموجاً.
export function findRewrite(routing, { pathname, search, host, headers = {}, cookies = {} }) {
  const ctx = { host, headers, cookies, query: new URLSearchParams(search || "") };
  for (const r of routing.rewrites) {
    const params = matchSource(r._c, pathname);
    if (!params || !hasOk(r, ctx)) continue;
    const dest = fillTemplate(r.destination, params);
    return { destination: mergeQuery(dest, search), external: isExternal(dest), rule: r };
  }
  return null;
}

// كل ترويسات headers المطابقة، بالترتيب (اللاحق يغلب السابق).
export function findHeaders(routing, pathname) {
  const out = {};
  for (const r of routing.headers) {
    if (!matchSource(r._c, pathname)) continue;
    for (const h of r.headers || []) out[lc(h.key)] = h.value;
  }
  return out;
}

// مهلة الدالة بالثواني: vercel.json أولاً (يغلب `export const config` داخل الملف كما
// عند Vercel)، ثم تصريح الملف نفسه، ثم الافتراضي.
export function maxDurationFor(routing, fnFile, fileConfig, fallback) {
  const k = `api/${fnFile}`;
  const entry = routing.functions[k] || routing.functions[`${k}.js`];
  if (entry && Number(entry.maxDuration) > 0) return Number(entry.maxDuration);
  if (fileConfig && Number(fileConfig.maxDuration) > 0) return Number(fileConfig.maxDuration);
  return fallback;
}
