// ‏المستشار الذكي في الرئيسية — سلسلة المزوّدين في الاستقبال، والنطاق الاحتياطي،
// وتطابق أسعاره مع الكتالوج. تُستبدل fetch بمُقلِّد: لا Azure ولا n8n ولا شبكة.
//
// WHATSAPP_MODE=live هو وضع الإنتاج الافتراضي (api/_mode.js) — به يكون وكيل n8n
// مفعّلاً في سلسلة الاستقبال، وهو الوضع الذي كان يضعه قبل النموذج. يُضبط قبل الاستيراد
// لأن _mode.js يقرأ البيئة عند التحميل.
process.env.WHATSAPP_MODE = "live";
process.env.AZURE_OPENAI_ENDPOINT = "https://bp-ai.openai.azure.com";
process.env.AZURE_OPENAI_KEY = "test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
delete process.env.APP_ENV;

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const AZ = "https://bp-ai.openai.azure.com/openai/v1/chat/completions";
const N8N = "businesspartnerai.app.n8n.cloud";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const azureOk = (text) => json({ choices: [{ message: { content: text } }] });

function stub(handler) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url && url.url ? url.url : url);
    calls.push({ url: u, body: opts && opts.body ? JSON.parse(opts.body) : null, signal: !!(opts && opts.signal) });
    return handler(u, calls.length);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

async function ask(body) {
  const { default: handler } = await import("../api/chat.js");
  let out = "";
  const res = { statusCode: 0, setHeader() {}, end(s) { out = s; } };
  await handler({ method: "POST", body, headers: {} }, res);
  return { status: res.statusCode, json: JSON.parse(out) };
}

const turn = (role, content) => ({ role, content });

test("الاستقبال: النموذج بتعليماته أولاً، وn8n لا يُنادى ما دام Azure يجيب", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? azureOk("تمام. وش اسم الشركة الأم؟") : json({}, 500)));
  try {
    const r = await ask({ mode: "intake", context: "formation", lang: "ar", messages: [turn("user", "أبغى أفتح فرع لشركة أجنبية")] });
    assert.equal(r.json.provider, "azure");
    assert.equal(f.calls.length, 1);
    assert.ok(f.calls[0].url.startsWith(AZ));
    const sys = f.calls[0].body.messages[0];
    assert.equal(sys.role, "system");
    assert.match(sys.content, /تأسيس شركة في السعودية/, "سياق الباب يصل إلى النموذج");
    assert.match(sys.content, /<<SCOPE>>/, "تعليمات الكتلة تصل إلى النموذج");
    assert.ok(!f.calls.some((c) => c.url.includes(N8N)), "n8n لم يُستدعَ");
  } finally { f.restore(); }
});

test("الاستقبال: ما اختاره العميل من الموقع يُحفظ بنداً أول، ولا أسعار في هذه المحادثة", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? azureOk("تمام.") : json({}, 500)));
  try {
    await ask({ mode: "intake", context: "government", lang: "ar", messages: [turn("user", "التسجيل في التأمينات الاجتماعية (GOSI)")] });
    const sys = f.calls[0].body.messages[0].content;
    assert.match(sys, /خدمة اختارها العميل بنفسه/);
    assert.match(sys, /BP-GOSI-01/, "قائمة الخدمات فيها كود الخدمة المختارة");
    assert.match(sys, /لا تذكر للعميل أي سعر منها/);
  } finally { f.restore(); }
});

test("الاستقبال: سقوط Azure يذهب إلى n8n ثم إلى النطاق الاحتياطي، ولا يظهر العطل للعميل", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? json({ error: "down" }, 500) : u.includes(N8N) ? json({ output: "أهلاً بك" }) : json({}, 404)));
  try {
    const r1 = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "عندي سؤال")] });
    assert.equal(r1.json.provider, "baher-n8n");
    assert.equal(r1.json.reply, "أهلاً بك");
    assert.ok(f.calls.every((c) => c.signal), "كل نداء خارجي له مهلة: وكيلٌ معلّق لا يستهلك الدقيقة فيموت الردّ الاحتياطي");
  } finally { f.restore(); }
  const g = stub(() => json({}, 500));
  try {
    const r2 = await ask({ mode: "intake", context: "consulting", lang: "ar", messages: [turn("user", "عندي سؤال")] });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.provider, "intake-fallback");
  } finally { g.restore(); }
});

test("النطاق الاحتياطي: الخدمة المختارة تبقى بكودها، والملخّص من كل ما كتبه العميل", async () => {
  const f = stub(() => json({}, 500));
  try {
    const r = await ask({
      mode: "intake", context: "government", lang: "ar",
      messages: [
        turn("user", "التسجيل في التأمينات الاجتماعية (GOSI)"),
        turn("assistant", "تمام. وش المنصة؟"),
        turn("user", "شركتي في الرياض عندي ٢٠ موظف"),
      ],
    });
    assert.equal(r.json.provider, "intake-fallback");
    const m = /<<SCOPE>>([\s\S]*?)<<END>>/.exec(r.json.reply);
    assert.ok(m, "كتلة النطاق موجودة");
    const sc = JSON.parse(m[1]);
    assert.equal(sc.items[0].code, "BP-GOSI-01");
    assert.equal(sc.items[0].title, "التسجيل في التأمينات الاجتماعية (GOSI)");
    assert.equal(sc.items.length, 3, "الخدمة + بندان من الباب كما تفعل الواجهة");
    assert.match(sc.summary, /GOSI/);
    assert.match(sc.summary, /٢٠ موظف/);
    assert.ok(sc.needs.length >= 2, "المستندات المطلوبة حاضرة");
  } finally { f.restore(); }
});

test("النطاق الاحتياطي: اختيار متعدد من الكتالوج يحفظ كل الخدمات، ونصٌّ حرٌّ لا يخترع بنداً", async () => {
  const f = stub(() => json({}, 500));
  try {
    const multi = await ask({
      mode: "intake", context: "formation", lang: "ar",
      messages: [turn("user", "حجز اسم شركة، إصدار سجل تجاري جديد"), turn("assistant", "؟"), turn("user", "مستثمر سعودي")],
    });
    const sc = JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(multi.json.reply)[1]);
    assert.deepEqual(sc.items.slice(0, 2).map((i) => i.code), ["BP-SBC-05", "BP-SBC-02"]);

    const free = await ask({
      mode: "intake", context: "formation", lang: "ar",
      messages: [turn("user", "أبغى أفتح فرع لشركة أجنبية"), turn("assistant", "؟"), turn("user", "شركة تقنية من دبي")],
    });
    const sf = JSON.parse(/<<SCOPE>>([\s\S]*?)<<END>>/.exec(free.json.reply)[1]);
    assert.ok(sf.items.every((i) => i.code === ""), "نصٌّ حرٌّ بلا كود");
    assert.match(sf.summary, /فرع لشركة أجنبية/, "الرسالة الأولى لا تضيع");
    assert.match(sf.summary, /من دبي/);
  } finally { f.restore(); }
});

test("الشخصية العامة: الإحالة للسعر والطلب إلى الرقم البشري لا رقم المحادثة الآلية", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? azureOk("أهلاً") : json({}, 500)));
  try {
    await ask({ messages: [turn("user", "كم سعر تأسيس شركة؟")] });
    const sys = f.calls[0].body.messages[0].content;
    assert.ok(sys.includes("wa.me/966530540231"));
    assert.ok(!sys.includes("wa.me/966507034157"), "رقم المحادثة الآلية لا يُعطى كرابط طلب");
  } finally { f.restore(); }
});

test("أسعار المستشار تطابق كتالوج الموقع: كل خدمة ظاهرة، السعر نفسه بالحرف", async () => {
  const { loadCatalog } = await import("../api/_catalog.js");
  const advisor = new Map((await loadCatalog()).services.map((s) => [s.code, s]));
  const site = JSON.parse(readFileSync(new URL("../site/assets/data/catalog.json", import.meta.url), "utf8")).services;
  const norm = (x) => String(x || "").replace(/\s+/g, " ").trim();
  const diffs = [];
  for (const s of site) {
    const a = advisor.get(s.code);
    if (!a) { diffs.push(`${s.code}: غير موجودة عند المستشار`); continue; }
    if (norm(a.priceLabel) !== norm(s.priceLabel)) diffs.push(`${s.code}: المستشار «${a.priceLabel}» والموقع «${s.priceLabel}»`);
  }
  assert.deepEqual(diffs, []);
});

test("طلبان متزامنان: كل نظام يحمل معرفة سؤاله هو، وسقف الإدارة لا يتسرّب إلى العميل", async () => {
  const f = stub((u) => (u.startsWith(AZ) ? azureOk("تمام") : json({}, 500)));
  try {
    const a = ask({ messages: [turn("user", "ما حد التسجيل الإلزامي في ضريبة القيمة المضافة؟")] });
    const b = ask({ messages: [turn("user", "ما شروط شهادة الدواء من الهيئة العامة للغذاء والدواء؟")] });
    await Promise.all([a, b]);
    const sysOf = (needle) => f.calls.map((c) => c.body).find((x) => x.messages.some((m) => m.role === "user" && m.content.includes(needle)));
    const va = sysOf("القيمة المضافة");
    const vb = sysOf("شهادة الدواء");
    assert.match(va.messages[0].content, /375,000/, "نظام الأول فيه حدّ التسجيل في الضريبة");
    assert.doesNotMatch(vb.messages[0].content, /حد التسجيل الإلزامي/, "نظام الثاني لا يحمل معرفة الأول");
    assert.equal(va.max_completion_tokens, 1024);
    assert.equal(vb.max_completion_tokens, 1024);
  } finally { f.restore(); }
});
