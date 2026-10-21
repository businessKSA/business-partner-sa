// ‏فحوص مجموعة القياس الدائمة (tests/chat-eval/): دوالّ نقيّة تقيس ما يصل إلى العميل فعلاً.
//
// ‏تُحلَّل الردود كما تفعل واجهة الرئيسية (simple-v1.mjs): تُنزع كتلتا <<OPTS>> و<<SCOPE>> فيبقى النثر
// الذي يراه العميل، وتُقرأ الكتلة كما تقرؤها الواجهة. وتُستعمل من api/_chat-guards.js الدوالُّ التي
// تعرّف «ورد حرفياً» و«الكود يصلح للبند» حتى لا يختلف تعريف الحارس عن تعريف القياس.
//
// ‏كل فحص يعيد قائمة إخفاقات [{check, turn, detail}] — فارغة = نجح. أسماء الفحوص ثابتة لأن golden.json
// يشير إليها: لا تُغيَّر دون تحديثه ودون docs/chat-eval.md.
import { readFileSync } from "node:fs";
import * as G from "../../api/_chat-guards.js";
import { pickKnowledge } from "../../api/_knowledge.js";

const CATALOG = JSON.parse(readFileSync(new URL("../../site/assets/data/catalog.json", import.meta.url), "utf8"));
export const SERVICES = CATALOG.services;
const BY_CODE = new Map(SERVICES.map((s) => [s.code, s]));

export const CHECKS = [
  "noPrice", "singleQuestion", "scopeBy", "noInventedDuration", "lang", "validCodes", "scopeType",
  "noRawTags", "noHiddenService", "noCredentialAsk", "humanContact", "noOtherPhone", "noOrphanHeading", "gateNoticeOnce",
  "mustMatch", "mustNotMatch",
];

// ───────────── قراءة الرد كما تقرؤه الواجهة ─────────────

export function parseOpts(text) {
  const m = /<*\s*OPTS\s*>>/i.exec(text);
  if (!m) return { text, opts: null };
  const i = m.index, after = i + m[0].length;
  const e = /<*\s*END\s*>>/i.exec(text.slice(after));
  const raw = e ? text.slice(after, after + e.index) : text.slice(after);
  let list = null;
  try { list = JSON.parse(raw); } catch {
    const b = raw.indexOf("["), d = raw.lastIndexOf("]");
    if (b >= 0 && d > b) { try { list = JSON.parse(raw.slice(b, d + 1)); } catch { /* مكسورة */ } }
  }
  const clean = (text.slice(0, i) + (e ? text.slice(after + e.index + e[0].length) : "")).replace(/<*\s*(?:OPTS|END)\s*>>/gi, "").trim();
  if (!Array.isArray(list)) return { text: clean, opts: null };
  const all = list.map((x) => String(x == null ? "" : x).trim()).filter((x) => x && x.length <= 60).slice(0, 4);
  return { text: clean, opts: all.length ? all : null };
}
export function parseScope(text) {
  const m = /<*\s*SCOPE\s*>>/i.exec(text);
  if (!m) return { text: text.trim(), scope: null, scopeRaw: null };
  const i = m.index, after = i + m[0].length;
  const e = /<*\s*END\s*>>/i.exec(text.slice(after));
  const raw = e ? text.slice(after, after + e.index) : text.slice(after);
  const o = G.parseScopeBlock(text);
  const clean = (text.slice(0, i) + (e ? text.slice(after + e.index + e[0].length) : "")).replace(/<*\s*(?:SCOPE|END)\s*>>/gi, "").trim();
  return { text: clean, scope: o && o.ready ? o : null, scopeRaw: raw };
}
/** ‏ما يراه العميل: {shown, opts, scope}. */
export function view(reply) {
  const ps = parseScope(String(reply || ""));
  const po = parseOpts(ps.text);
  return { shown: po.text, opts: po.opts, scope: ps.scope, hadScopeTag: /SCOPE/i.test(reply || "") };
}
const scopeStrings = (sc) => {
  if (!sc) return [];
  const out = [sc.title, sc.summary];
  for (const it of sc.items || []) out.push(it && it.title, it && it.why);
  for (const n of sc.needs || []) out.push(typeof n === "string" ? n : n && n.title, n && n.note);
  return out.filter((x) => typeof x === "string" && x);
};

// ───────────── تعريفات مشتركة ─────────────

const AMT = "(?:[0-9٠-٩][0-9٠-٩٬,.٫]*|(?:ألف|الف|آلاف|مليون|مئة|مائة)\\s)";
const CUR = "(?:﷼|ر\\.?\\s?س\\.?|ريال(?:ا|ات)?|ريالين|SAR|SR|riyals?|rials?|euros?|€|dollars?|USD|\\$|¥|元)";
const MONEY = new RegExp(`${AMT}\\s*${CUR}(?![\\p{L}])|(?:﷼|SAR|SR|\\$|€)\\s*[0-9٠-٩]`, "iu");
const GOV = /حكوم|government|\bgov\b|رسوم\s+(?:الجهة|الوزارة|المنصة)|مقابل\s+مالي|gouvernement|政府/i;
const OURS = /أتعاب|اتعاب|باقة|باقات|اشتراك|خدمتنا|Business Partner|بيزنس بارتنر|\bBP\b|our fees?|package|subscription|\bplan\b|we charge|nos honoraires/i;
const PHONE_RE = /(?<![\d])(?:\+?966[\s-]?|0)?5(?:[\s-]?\d){8}(?!\d)/g;
const OK_PHONES = ["530540231", "507034157"];
const HIDDEN_RE = /Revenue\s*-?\s*OS|\bREV-[A-Z]+|BDaaS|نظام\s+تشغيل\s+(?:ال)?[إا]يرادات|تطوير\s+(?:ال)?[أا]عمال\s+كخدمة/i;
const NEG = /(?<![\p{L}])(?:لا|لن|ممنوع|دون|بدون|بلا|عدم|ليس|never|not|without|jamais|sans|ne)(?![\p{L}])|n't|不要|无需|不用/iu;

function langOf(s0) {
  const s = String(s0).replace(/https?:\/\/\S+/g, " ").replace(/\b[A-Z]{2,}-[A-Z0-9-]+\b/g, " ");   // ‏الروابط والأكواد ليست لغة الرد
  const ar = (s.match(/[؀-ۿ]/g) || []).length, la = (s.match(/[A-Za-z]/g) || []).length, cj = (s.match(/[一-鿿]/g) || []).length;
  const tot = ar + la + cj || 1;
  if (ar + la + cj === 0) return "none";
  if (cj / tot > 0.3) return "zh";
  if (ar / tot > 0.5) return "ar";
  return "latin";
}
const sentencesOf = (t) => String(t).split(/\n+/).flatMap((ln) => ln.split(/(?<=[.!?؟؛])\s+(?=\S)/)).filter((x) => x.trim());
const priceSegments = (t) => sentencesOf(t).filter((seg) => MONEY.test(seg) && !(GOV.test(seg) && !OURS.test(seg)));

/** ‏المقاطع المرفقة بالنموذج لهذا الدور — نسخة محلية من منطق api/chat.js (آخر رسالتين، ميزانية 9000). */
export function knowledgeFor(messages, context) {
  return pickKnowledge(G.focusOf(messages), 9000, context === "bizdev" ? { door: "bizdev" } : {});
}

// ───────────── تقييم حالة كاملة ─────────────

/**
 * @param {object} c       حالة من golden.json (بعد دمج الافتراضيات)
 * @param {Array<{user: string, reply: string, status?: number}>} turns
 * @returns {{pass: boolean, failures: Array<{check: string, turn: number, detail: string}>, scopeAt: number|null}}
 */
export function evaluateCase(c, turns) {
  const ex = c.expect || {};
  const fails = [];
  const fail = (check, turn, detail) => fails.push({ check, turn, detail: String(detail).slice(0, 240) });
  const messages = [];
  let scopeAt = null;
  const firstUser = (turns[0] && turns[0].user) || "";
  const picked = new Set(SERVICES.filter((s) => [s.nameAr, s.nameEn].some((n) => n && firstUser.toLowerCase().includes(String(n).toLowerCase()))).map((s) => s.code));

  turns.forEach((t, idx) => {
    const n = idx + 1;
    messages.push({ role: "user", content: t.user });
    const v = view(t.reply);
    const all = [v.shown, ...scopeStrings(v.scope)].join("\n");
    const userText = G.userTextOf(messages);
    if (v.scope && scopeAt == null) scopeAt = n;

    if (ex.noPrice) {
      const hits = priceSegments(all);
      if (hits.length) fail("noPrice", n, hits[0]);
    }
    if (ex.singleQuestion && c.mode === "intake" && !v.scope) {
      const q = (v.shown.match(/[؟?？]/g) || []).length;
      if (q > 1) fail("singleQuestion", n, `${q} علامات استفهام: ${v.shown.slice(0, 160)}`);
      else if (G.oneQuestion(v.shown).hit) fail("singleQuestion", n, `سؤالان في جملة: ${v.shown.slice(0, 160)}`);
    }
    if (ex.noInventedDuration) {
      const allow = G.allowedDurations(knowledgeFor(messages, c.context), userText);
      const bad = G.durationsIn(all).filter((d) => !(allow.keys.has(d.key) || (!d.range && allow.ends.get(d.fam) && allow.ends.get(d.fam).has(d.lo))));
      if (bad.length) fail("noInventedDuration", n, `${bad.map((d) => d.key).join(", ")} ← «${all.slice(Math.max(0, bad[0].start - 20), bad[0].end + 10).replace(/\n/g, " ")}»`);
    }
    if (ex.lang && v.shown.trim() && langOf(v.shown) !== "none") {
      const got = langOf(v.shown), want = ex.lang;
      const ok = want === "ar" ? got === "ar" : want === "zh" ? got === "zh" : got === "latin";
      if (!ok) fail("lang", n, `المتوقع ${want} والمقروء ${got}: ${v.shown.slice(0, 80)}`);
    }
    if (ex.noRawTags && /<<|>>|OPTS|SCOPE|<END|\{"ready"/.test(v.shown)) fail("noRawTags", n, v.shown.slice(0, 160));
    if (ex.noHiddenService && HIDDEN_RE.test(all)) fail("noHiddenService", n, (all.match(HIDDEN_RE) || [""])[0]);
    if (ex.noCredentialAsk) {
      const bad = [v.shown, ...scopeStrings(v.scope)].filter((s) => G.asksCredentials(s) && !NEG.test(s));
      if (bad.length) fail("noCredentialAsk", n, bad[0]);
    }
    if (ex.noOtherPhone) {
      const bad = [...all.matchAll(PHONE_RE)].map((m) => m[0]).filter((p) => !OK_PHONES.some((ok) => p.replace(/\D/g, "").endsWith(ok)));
      if (bad.length) fail("noOtherPhone", n, bad.join(", "));
    }
    if (ex.noOrphanHeading) {
      const lines = v.shown.split("\n");
      lines.forEach((ln, i) => {
        if (!/[:：]\s*$/.test(ln) || /^\s*(?:[-*•–]|\d+[.)])\s/.test(ln)) return;
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        const next = lines[j];
        if (next === undefined) fail("noOrphanHeading", n, `عنوان في آخر الرد: ${ln.trim().slice(0, 100)}`);
        else if (PRICE_GATE.test(next) && (j === i + 1 || !lines[i + 1].trim())) fail("noOrphanHeading", n, `عنوان تليه جملة الحجب: ${ln.trim().slice(0, 100)}`);
        else if (/[:：]\s*$/.test(next) && !/^\s*(?:[-*•–]|\d+[.)])\s/.test(next)) fail("noOrphanHeading", n, `عنوان يتبعه عنوان: ${ln.trim().slice(0, 100)}`);
      });
    }
    if (ex.gateNoticeOnce && (v.shown.match(PRICE_GATE_G) || []).length > 1) fail("gateNoticeOnce", n, "جملة الحجب تكررت");
    if (ex.gateNoticeOnce && PRICE_GATE.test(v.shown)) {
      // ‏تُقبل جملة الحجب في آخر الرد فقط؛ ما بعدها شرحٌ يعني أنها قطعت الكلام في وسطه.
      const lines = v.shown.split("\n");
      const at = lines.findIndex((ln) => PRICE_GATE.test(ln));
      if (lines.slice(at + 1).some((ln) => ln.trim() && !/^(?:https?:\/\/\S+)$/.test(ln.trim()))) fail("gateNoticeOnce", n, "جملة الحجب وسط الشرح");
    }
    if (ex.humanContact && (ex.humanContact === "all" || (ex.humanContact === "last" && idx === turns.length - 1))) {
      const ok = /0530540231/.test(all) && /wa\.me\/966530540231/.test(all);
      if (!ok) fail("humanContact", n, "لا رقم باهر الرسمي ورابط واتساب في الرد");
      if (G.stripFalsePromises(v.shown).hit) fail("humanContact", n, `وعد لا يملكه المستشار: ${v.shown.slice(0, 140)}`);
    }
    if (c.mode === "intake" && v.scope) {
      const sc = v.scope;
      if (ex.scopeType) {
        if (!G.SCOPE_TYPES.includes(sc.type)) fail("scopeType", n, `type=${JSON.stringify(sc.type)}`);
      }
      if (ex.validCodes) {
        for (const it of sc.items || []) {
          if (!it || !it.code) continue;
          const svc = BY_CODE.get(it.code);
          if (!svc) fail("validCodes", n, `كود غير موجود في الكتالوج: ${it.code}`);
          else if (!picked.has(it.code) && !G.codeFits(it, svc, { scopeTitle: sc.title })) fail("validCodes", n, `${it.code} (${svc.nameAr}) لبند «${it.title}»`);
        }
      }
    }
    for (const [list, want] of [[ex.mustMatch, true], [ex.mustNotMatch, false]]) {
      for (const m of list || []) {
        if (m.turn && m.turn !== n) continue;
        const hit = new RegExp(m.re, m.flags || "u").test(all);
        if (hit !== want) fail(want ? "mustMatch" : "mustNotMatch", n, `${want ? "غاب" : "ظهر"}: /${m.re}/`);
      }
    }
    messages.push({ role: "assistant", content: t.reply });
  });

  if (ex.scopeBy) {
    const userTurns = turns.length;
    if (userTurns >= ex.scopeBy && (scopeAt == null || scopeAt > ex.scopeBy)) fail("scopeBy", ex.scopeBy, scopeAt == null ? "لم تخرج كتلة نطاق إطلاقاً" : `خرجت عند الرسالة ${scopeAt}`);
  }
  return { pass: fails.length === 0, failures: fails, scopeAt };
}

const PRICE_GATE_LINE = /(?:السعر يظهر بعد تسجيل الدخول|Prices are shown after you sign in)[^\n]*/;
const PRICE_GATE = new RegExp(PRICE_GATE_LINE.source);
const PRICE_GATE_G = /(?:السعر يظهر بعد تسجيل الدخول|Prices are shown after you sign in)/g;

/** ‏الافتراضيات من golden.json ثم ما تفرضه الحالة (null يُسقط فحصاً افتراضياً). */
export function resolveCase(golden, c) {
  const expect = { ...(golden.defaults || {}), ...(c.expect || {}) };
  for (const k of Object.keys(expect)) if (expect[k] === null || expect[k] === false) delete expect[k];
  if (c.mode === "public") { delete expect.validCodes; delete expect.scopeType; delete expect.singleQuestion; }
  if (!expect.lang) expect.lang = c.lang || "ar";
  return { ...c, expect };
}

/** ‏تجميع نتائج حالات متعددة بحسب الفحص: {check: {pass, fail}}. */
export function tally(results) {
  const by = {};
  for (const r of results) {
    const failed = new Set((r.failures || []).map((f) => f.check));
    for (const k of r.checked || []) {
      by[k] = by[k] || { pass: 0, fail: 0 };
      failed.has(k) ? by[k].fail++ : by[k].pass++;
    }
  }
  return by;
}
/** ‏الفحوص التي طُبّقت على حالة (لتجميع نسب النجاح). */
export const checkedOf = (c) => {
  const e = c.expect || {};
  const out = [];
  for (const k of CHECKS) {
    if (k === "mustMatch" || k === "mustNotMatch") { if ((e[k] || []).length) out.push(k); }
    else if (k === "scopeBy") { if (e.scopeBy) out.push(k); }
    else if (k === "lang") { if (e.lang) out.push(k); }
    else if (e[k]) out.push(k);
  }
  return out;
};
