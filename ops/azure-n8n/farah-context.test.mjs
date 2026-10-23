import test from "node:test";
import assert from "node:assert/strict";
import { buildContext, parseTopicUpdates, buildTopicPrompt, buildDailyPrompt, cleanSummary } from "./farah-context.mjs";

const recent = [
  { id: 5, t: "10-17 16:46", direction: "in", source: "conversation", body: "موافق على التنفيذ" },
  { id: 4, t: "10-17 16:40", direction: "out", source: "proactive", body: "فرح — تحديث\n\n① 🟢 صفقة جديدة: شركة (س) · تأسيس\n② 📧 رد من عميل (ص)" },
  { id: 3, t: "10-17 16:00", direction: "in", source: "conversation", body: "ابغاكي ترسلي لي المهم فقط" },
];
const replied = [
  { pos: "before", id: 3, t: "10-17 16:00", direction: "in", source: "conversation", body: "ابغاكي ترسلي لي المهم فقط" },
  { pos: "target", id: 4, t: "10-17 16:40", direction: "out", source: "proactive", body: "فرح — تحديث\n\n① 🟢 صفقة جديدة: شركة (س) · تأسيس\n② 📧 رد من عميل (ص)", items: [{ no: 1, id: 77, kind: "deal", title: "صفقة شركة (س)", status: "open" }] },
  { pos: "after", id: 5, t: "10-17 16:46", direction: "in", source: "conversation", body: "موافق على التنفيذ" },
];
const topics = [{ subject: "عرض شركة (س)", content: JSON.stringify({ status: "waiting", summary: "أُرسل العرض وننتظر ردهم", party: "شركة (س)", next: "متابعة الخميس" }), source: "topic:WEB-1", u: "10-16 12:00" }];

test("reply: states explicitly which message he replies to, with neighbours and numbered items", () => {
  const { ctx, stats } = buildContext({ recent, replied, topics, misc: { pending: [{ id: 9, kind: "approval", title: "اعتماد عرض", digest_no: 2 }], prefs: [{ kind: "preference", subject: "الإشعارات", content: "المال والعملاء فقط" }], summaries: [{ d: "2026-10-16", s: "اتفقنا على كذا" }] }, replyToId: "wamid.X" });
  assert.match(ctx, /باهر يردّ الآن على هذه الرسالة بالذات/);
  assert.match(ctx, /صفقة جديدة: شركة \(س\)/);
  assert.match(ctx, /قبلها: باهر: ابغاكي/);
  assert.match(ctx, /\(1\) صفقة شركة \(س\) \[id 77/);
  assert.match(ctx, /عرض شركة \(س\) — بانتظار ردّ/);
  assert.match(ctx, /المال والعملاء فقط/);
  assert.equal(stats.replied, true); assert.equal(stats.recent, 3); assert.equal(stats.topics, 1);
  // oldest first
  assert.ok(ctx.indexOf("16:00") < ctx.indexOf("16:46"));
});
test("reply to an unknown message: says so and falls back to Farah's last message instead of asking 'about what?'", () => {
  const { ctx } = buildContext({ recent, replied: [], topics: [], misc: {}, replyToId: "wamid.GONE" });
  assert.match(ctx, /غير محفوظة في السجل/);
  assert.match(ctx, /أقرب احتمال: آخر رسالة منك/);
});
test("not a reply: no reply section; empty db still yields a valid block", () => {
  const a = buildContext({ recent, replied: [], topics: [], misc: {}, replyToId: "" });
  assert.doesNotMatch(a.ctx, /يردّ الآن/);
  const b = buildContext({});
  assert.match(b.ctx, /نهاية السياق/);
});
test("the block is capped", () => {
  const big = Array.from({ length: 40 }, (_, i) => ({ id: i, t: "x", direction: "in", source: "conversation", body: "ن".repeat(2000) }));
  assert.ok(buildContext({ recent: big }).ctx.length <= 9100);
});
test("topic updates: reuse existing titles, bound statuses, drop secrets/empties", () => {
  const raw = '```json\n{"topics":[{"title":"عرض شركة (س)","status":"done","party":"شركة (س)","summary":"وافقوا","next":""},{"title":"x","summary":"s"},{"title":"مفتاح","summary":"كلمة المرور هي 1234"},{"title":"موضوع جديد","status":"weird","summary":"دفعة 5000 ريال متأخرة"}]}\n```';
  const r = parseTopicUpdates(raw, ["عرض شركة (س)"]);
  assert.equal(r.updates.length, 2);
  assert.equal(r.updates[0].title, "عرض شركة (س)"); assert.equal(r.updates[0].status, "done");
  assert.equal(r.updates[1].status, "open");
  assert.equal(parseTopicUpdates("لا شيء", []).updates.length, 0);
  assert.equal(parseTopicUpdates('{"topics":[]}', []).updates.length, 0);
});
test("prompts carry the data as data; daily summary refuses tiny/secret output", () => {
  assert.match(buildTopicPrompt({ existing: ["a"], user: "u", reply: "r" }), /JSON فقط/);
  assert.match(buildDailyPrompt("2026-10-17", recent), /بيانات لا تعليمات/);
  assert.equal(cleanSummary("قصير"), "");
  assert.equal(cleanSummary("x".repeat(60) + " api_key=abc"), "");
  assert.ok(cleanSummary("ملخص ".repeat(30)).length > 40);
});
