// node --test ops/azure-n8n/farah-guards.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { classifyChat, replyGuard, buildDigest } from "./farah-guards.mjs";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (h) => new Date(NOW - h * 3600e3).toISOString();
const A = { wa_id: "WEB-aaa", name: "أحمد العتيبي", phone: "+966501112233", email: "a@x.com", last_ts: ago(1), last_wa_in: null };
const B = { wa_id: "WEB-bbb", name: "أحمد الغامدي", phone: "0555555555", email: "", last_ts: ago(2), last_wa_in: ago(3) };
const ok = { action: "send", who: "WEB-aaa", channel: "email", text: "أهلاً أحمد، وصلنا طلبك وسنتواصل معك اليوم.", baher_order: "ردّي على أحمد وقولي وصلنا طلبه", approved_by_baher: "false" };

test("classify: phone makes it hot and alert has name/phone/wants", () => {
  const r = classifyChat({ sid: "s1", name: "سارة", phone: "0501234567", messages: [{ role: "user", content: "أبغى تأسيس شركة" }] });
  assert.equal(r.valid, true); assert.equal(r.hot, true); assert.equal(r.wa_id, "WEB-s1");
  assert.match(r.alert, /سارة/); assert.match(r.alert, /0501234567/); assert.match(r.alert, /تواصل الآن/);
});
test("classify: anonymous browsing is cold; purchase intent without phone is hot but says no contact", () => {
  const cold = classifyChat({ sid: "s2", messages: [{ role: "user", content: "مرحبا" }, { role: "bot", content: "أهلاً" }] });
  assert.equal(cold.hot, false);
  const hot = classifyChat({ sid: "s3", messages: [{ role: "user", content: "كم السعر لعرض سعر استقدام" }] });
  assert.equal(hot.hot, true); assert.match(hot.alert, /لا وسيلة تواصل/);
});
test("classify: anger is hot; invalid payloads are not valid; control chars stripped", () => {
  assert.equal(classifyChat({ sid: "s4", messages: [{ role: "user", content: "عندي شكوى وأبغى استرداد" }] }).hot, true);
  assert.equal(classifyChat({}).valid, false);
  assert.equal(classifyChat({ sid: "s5", messages: [] }).valid, false);
  assert.equal(classifyChat({ sid: "s6", name: "x\u0001y", messages: [{ role: "user", content: "hi" }] }).name, "xy");
});
test("classify: bad email dropped, sid sanitised", () => {
  const r = classifyChat({ sid: "WEB-../../x;drop", email: "nope", messages: [{ role: "user", content: "hi" }] });
  assert.equal(r.email, ""); assert.match(r.wa_id, /^WEB-[A-Za-z0-9_-]+$/);
});

test("reply: clean email reply to a single known target passes", () => {
  const g = replyGuard(ok, [A], NOW);
  assert.equal(g.blocked, false); assert.equal(g.id, "WEB-aaa"); assert.equal(g.channel, "email");
});
test("reply: no explicit order from Baher blocks", () => {
  assert.match(replyGuard({ ...ok, baher_order: "" }, [A], NOW).reasons, /أمر صريح/);
});
test("reply: ambiguous name (two Ahmeds) blocks and lists both", () => {
  const g = replyGuard({ ...ok, who: "أحمد" }, [A, B], NOW);
  assert.equal(g.blocked, true); assert.match(g.reasons, /أكثر من مرشّح/);
});
test("reply: exact id narrows among several candidates", () => {
  assert.equal(replyGuard({ ...ok, who: "WEB-aaa" }, [A, B], NOW).blocked, false);
});
test("reply: unknown target blocks", () => {
  assert.match(replyGuard({ ...ok, who: "نورة" }, [], NOW).reasons, /غير معروف/);
});
test("reply: several recipients in one call block", () => {
  assert.match(replyGuard({ ...ok, who: "WEB-aaa, WEB-bbb" }, [A, B], NOW).reasons, /طرف واحد/);
});
test("reply: price / discount / guarantee blocked unless Baher approved that text", () => {
  for (const t of ["السعر 5000 ريال", "نعطيك خصم 20%", "نضمن لك القبول", "this is the price", "سنقدّم لك التزام من وزارة قوى"]) {
    assert.equal(replyGuard({ ...ok, text: t }, [A], NOW).blocked, true, t);
  }
  assert.equal(replyGuard({ ...ok, text: "السعر 5000 ريال", approved_by_baher: "true" }, [A], NOW).blocked, false);
});
test("reply: approval does not bypass the explicit-order or unknown-target rules", () => {
  assert.equal(replyGuard({ ...ok, baher_order: "", approved_by_baher: "true" }, [A], NOW).blocked, true);
  assert.equal(replyGuard({ ...ok, approved_by_baher: "true" }, [], NOW).blocked, true);
});
test("reply: whatsapp needs a phone and an open 24h window", () => {
  const wa = { ...ok, channel: "whatsapp", who: "WEB-bbb" };
  assert.equal(replyGuard(wa, [B], NOW).blocked, false);                        // client wrote 3h ago
  const old = { ...B, last_wa_in: ago(30) };
  assert.match(replyGuard(wa, [old], NOW).reasons, /131047/);                   // 30h ago
  assert.equal(replyGuard({ ...wa, wa_window_confirmed: "true" }, [old], NOW).blocked, false);
  assert.match(replyGuard({ ...wa, who: "WEB-aaa" }, [{ ...A, phone: "" }], NOW).reasons, /رقم جوال/);
});
test("reply: email channel needs an email on the conversation", () => {
  assert.match(replyGuard({ ...ok, who: "WEB-bbb" }, [B], NOW).reasons, /بريد/);
});
test("reply: lookup never sends and reports candidates", () => {
  const g = replyGuard({ action: "lookup", who: "أحمد" }, [A, B], NOW);
  assert.equal(g.sent, false); assert.equal(g.count, 2); assert.equal(g.candidates.length, 2);
});
test("reply: bad channel and empty/oversized text block", () => {
  assert.equal(replyGuard({ ...ok, channel: "sms" }, [A], NOW).blocked, true);
  assert.equal(replyGuard({ ...ok, text: "  " }, [A], NOW).blocked, true);
  assert.equal(replyGuard({ ...ok, text: "ا".repeat(1501) }, [A], NOW).blocked, true);
});

test("digest: empty -> none; only cold items counted as «للعلم»", () => {
  assert.equal(buildDigest([]).has, false);
  const d = buildDigest([{ wa_id: "WEB-1", hot: true, name: "س", last_body: "x" }, { wa_id: "WEB-2", hot: false, name: "م", last_body: "سؤال عن الأسعار" }]);
  assert.equal(d.has, true); assert.match(d.text, /1 للعلم|1 ساخنة|2 محادثة/); assert.match(d.text, /سؤال عن الأسعار/);
  assert.equal(buildDigest([{ wa_id: "WEB-1", hot: true }]).has, false);
});

test("guards are self-contained (survive toString injection into a Code node)", () => {
  for (const fn of [classifyChat, replyGuard, buildDigest]) {
    const rebuilt = new Function(`return (${fn.toString().replace(/^export\s+/, "")})`)();
    assert.equal(typeof rebuilt, "function");
  }
  const re = new Function(`return (${replyGuard.toString()})`)();
  assert.equal(re(ok, [A], NOW).blocked, false);
});
