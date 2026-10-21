// تدقيق لوحة العميل /my (2026-10-11): ستة أعطال وُجدت بمتصفح حقيقي، وهنا حارسٌ لكل واحد.
//
// حدود هذا الاختبار معلنة: لا متصفح ولا تخطيط. هو يقرأ السكربت الذي يبنيه buildSimpleMy فعلاً (لا نسخة منه)
// ويمسك ما يمكن إمساكه بلا متصفح — خطأٌ نحوي في القالب النصّي، ومفتاحٌ يرسله العميل ولا يقرؤه الخادم،
// ورمزُ خطأ من الخادم بلا نصٍّ للعميل، وزرٌّ يفشل صامتاً. ما يخصّ الألوان والعرض فُحص بمتصفح Chromium
// على الجوال 390 وسطح المكتب 1280 (انظر docs/site-audit-2026-10-11/client-portal.md).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSimpleMy } from "../site/scripts/simple-v1-my.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["ar", "en", "fr", "zh"];

function build(lang) {
  let out = { css: "", script: "" };
  const sv1 = {
    href: (p) => p, header: () => "", footer: () => "",
    shell: (o) => { out = { css: o.body, script: o.script }; return o.script; },
  };
  buildSimpleMy(sv1, { lang: () => lang });
  return out;
}
const PAGES = Object.fromEntries(LANGS.map((l) => [l, build(l)]));
const inner = (s) => s.replace(/<\/script>\s*<script>/g, "\n").replace(/^<script>/, "").replace(/<\/script>$/, "");

test("السكربت يُحلَّل نحوياً بالأربع لغات (القالب النصّي يلتهم الشرطة المائلة)", () => {
  for (const l of LANGS) assert.doesNotThrow(() => new vm.Script(inner(PAGES[l].script)), `lang ${l}`);
});

test("بيانات الشركة: المفاتيح التي يرسلها /my هي التي يقرؤها الخادم (كان السجل التجاري يضيع بصمت)", () => {
  const src = fs.readFileSync(path.join(ROOT, "api/requests.js"), "utf8");
  const at = src.indexOf('b.action === "my-org-update"');
  assert.ok(at > 0, "معالج my-org-update موجود");
  const block = src.slice(at, at + 2500);
  const read = new Set([...block.matchAll(/\bb\.(\w+)/g)].map((m) => m[1]));
  const sent = /action:'my-org-update',([^}]*)\}/.exec(PAGES.ar.script);
  assert.ok(sent, "نداء my-org-update موجود في الصفحة");
  const keys = new Set([...sent[1].matchAll(/(\w+):/g)].map((m) => m[1]));
  for (const k of ["name_ar", "name_en"]) assert.ok(keys.has(k) && read.has(k), k);
  assert.ok(read.has("cr"), "الخادم يقرأ cr");
  assert.ok(keys.has("cr"), "الصفحة ترسل cr لا cr_number وحده");
});

test("كل رمز خطأ يعيده الخادم لحجز الموعد له نصٌّ للعميل بلغته (كان يظهر friday وbad_datetime كما هما)", () => {
  const src = fs.readFileSync(path.join(ROOT, "api/_simple.js"), "utf8");
  const at = src.indexOf('action === "appointment-book"');
  assert.ok(src.slice(at, at + 1200).includes("validateSlot("), "الفحص بقواعد الحجز المشتركة (api/_booking.js) لا بنسخةٍ ثانية");
  // الرموز يقولها validateSlot (ساعات الجلسات، يوم العطلة، الماضي، مهلة الساعة) وapi/book.js (التعارض والسقف والإكثار)
  const bk = fs.readFileSync(path.join(ROOT, "api/_booking.js"), "utf8");
  const vAt = bk.indexOf("export function validateSlot");
  const codes = [...bk.slice(vAt, vAt + 1800).matchAll(/error: "(\w+)"/g)].map((m) => m[1]);
  for (const c of ["bad_datetime", "off_day", "out_of_hours", "past", "too_soon", "too_far"]) assert.ok(codes.includes(c), `الخادم يعيد ${c}`);
  for (const l of LANGS) {
    const s = PAGES[l].script;
    for (const c of [...codes, "friday", "slot_taken", "too_many_active", "rate_limited"]) assert.ok(s.includes(`'${c}'`), `${l}: المعالجة لـ ${c}`);
    const tx = JSON.parse(/TX=(\{.*?\}),ST=/s.exec(s)[1]);
    const KEYS = ["apptBad", "apptFri", "apptPast", "apptOut", "apptSoon", "apptFar", "apptTaken", "apptMany", "apptRate"];
    for (const k of KEYS) assert.ok(tx[k] && tx[k].length > 8, `${l}: ${k}`);
    // لا نصّ عربي في لغة غير عربية
    if (l !== "ar") for (const k of [...KEYS, "sessEnd", "provCard", "actAi", "actSys", "actTeam"]) assert.ok(!/[؀-ۿ]/.test(tx[k]), `${l}.${k} بلا حروف عربية`);
  }
});

test("لا زرّ يفشل صامتاً: كل نداء فعلٍ للعميل فيه فرع إخبار", () => {
  const s = inner(PAGES.ar.script);
  for (const a of ["request-message", "quote-approve", "quote-reject", "appointment-cancel", "checkout-start", "pay-test"]) {
    const at = s.indexOf(`api('${a}'`);
    assert.ok(at > 0, a);
    // الفرع الفاشل يستدعي toast قبل نداء الفعل التالي
    const next = s.indexOf("api('", at + 10);
    const seg = s.slice(at, next > 0 ? next : at + 900);
    assert.ok(seg.includes("toast(") || (a === "quote-reject" && seg.includes("err.textContent=")), `${a} يُخبر العميل عند الفشل`);
  }
});

test("الجلسة المنتهية وسط الزيارة تُرجع العميل إلى الدخول برسالة، والشبكة المقطوعة لا ترمي", () => {
  const s = inner(PAGES.en.script);
  const api = /function api\(action,data\)\{[^\n]*\n/.exec(s)[0];
  assert.ok(api.includes("'no_session'") && api.includes("sessionEnded()"), "api() ينتهي بالدخول عند no_session");
  assert.ok(api.includes(".catch(function(){return {ok:false,error:'network'}})"), "api() لا ترفض الوعد");
  assert.match(s, /function renderLogin\(note\)/);
});

test("الرموز الخام لا تصل العميل: مزوّد الدفع واسم الفاعل بلغة الصفحة", () => {
  for (const l of LANGS) {
    const tx = JSON.parse(/TX=(\{.*?\}),ST=/s.exec(PAGES[l].script)[1]);
    for (const k of ["provCard", "provTamara", "provBank", "actAi", "actSys", "actTeam"]) assert.ok(tx[k], `${l}.${k}`);
  }
  const s = inner(PAGES.ar.script);
  assert.ok(s.includes("provName(r.payment.provider)"), "بطاقة الدفع تمرّ بـprovName");
  assert.ok(s.includes("actorName(e)"), "الخط الزمني يمرّ بـactorName");
});

test("Enter يعمل في خانات الدخول ورسالة الطلب (على الجوال كان زرّ «Go» لا يفعل شيئاً)", () => {
  const s = inner(PAGES.ar.script);
  assert.match(s, /function onEnter\(inp,btn\)\{inp\.addEventListener\('keydown'/);
  for (const call of ["onEnter(e3,b3)", "onEnter(inp,sb)"]) assert.ok(s.includes(call), call);
  // خانتا البريد والرمز في باب الدخول الجديد تعالجان Enter مباشرةً
  assert.ok(s.includes("e1.addEventListener('keydown'") && s.includes("e2.addEventListener('keydown'"));
});

test("الألوان والعرض: قواعد CSS التي أصلحت زرّاً بلا نصّ مقروء واسماً أبيض على أبيض وفيضاً أفقياً على الجوال", () => {
  const css = PAGES.ar.css;
  assert.match(css, /\.my a\.btn:not\(\.ghost\):not\(\.danger\)\{color:#fff\}/);
  assert.match(css, /\.my-side \.who b\{display:block;color:var\(--ink\)\}/);
  assert.match(css, /@media\(max-width:900px\)\{\.my\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.list\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.row\{flex-wrap:wrap\}/);
});
