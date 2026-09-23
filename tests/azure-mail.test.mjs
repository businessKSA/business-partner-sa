// توقيع طلبات بريد Azure Communication Services.
//
// سبب تثبيت هذا: ACS لا يقبل مفتاحاً في ترويسة بسيطة، بل يوقّع الطلب بـHMAC
// على نصٍّ يجمع الفعل والمسار والتاريخ والمضيف وبصمة الجسم. وأي حرف يزيد أو
// ينقص في ذلك النص يعطي 401 لا تشرح نفسها — ولا تظهر إلا بعد النشر، حين تكون
// الرسالة التي لم تصل رمزَ دخول عميل أو عرض سعر. الحالات أدناه تحسب التوقيع
// حساباً مستقلاً وتقارنه بما يرسله الكود فعلاً، فلا يمر خطأ في البناء صامتاً.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// مفتاح اختباري بحت — base64 صالح ولا علاقة له بأي مورد حقيقي.
const KEY = Buffer.from("business-partner-test-key-0123456789").toString("base64");
process.env.ACS_ENDPOINT = "https://bp-test.saudiarabia.communication.azure.com";
process.env.ACS_ACCESS_KEY = KEY;
process.env.ACS_SENDER_ADDRESS = "Business Partner <DoNotReply@businesspartner.sa>";
delete process.env.ACS_CONNECTION_STRING;

const { azureSendMail, azureSendEmail, azureEmailReady, azureMailStatus } =
  await import("../api/_azure_notify.js");

// التقاط الطلب بدل إرساله.
const realFetch = globalThis.fetch;
let captured = null;
function stubFetch(status = 202) {
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return { ok: status < 300, status, headers: { get: () => "req-1" }, text: async () => "boom" };
  };
}
test.after(() => { globalThis.fetch = realFetch; });

test("الإعداد يُقرأ من المتغيّرات المفرّقة", () => {
  assert.equal(azureEmailReady(), true);
  const s = azureMailStatus();
  assert.equal(s.provider, "azure-communication-services");
  assert.equal(s.ready, true);
  // التشخيص يقول «مضبوط» ولا يسرّب القيمة نفسها.
  assert.equal(JSON.stringify(s).includes(KEY), false);
});

test("سلسلة الاتصال تُقسم على أول «=» فقط", async () => {
  // مفتاح base64 قد ينتهي بحشوة «=»، وقسمةٌ ساذجة على كل «=» تبتره.
  const padded = Buffer.from("k").toString("base64"); // "aw=="
  const prev = { ep: process.env.ACS_ENDPOINT, k: process.env.ACS_ACCESS_KEY };
  delete process.env.ACS_ENDPOINT;
  delete process.env.ACS_ACCESS_KEY;
  process.env.ACS_CONNECTION_STRING = `endpoint=https://x.communication.azure.com/;accesskey=${padded}`;
  stubFetch();
  await azureSendMail({ to: "a@b.co", subject: "s", html: "<p>h</p>" });
  const u = new URL(captured.url);
  assert.equal(u.host, "x.communication.azure.com");
  const h = captured.init.headers;
  const expected = crypto
    .createHmac("sha256", Buffer.from(padded, "base64"))
    .update(`POST\n${u.pathname}${u.search}\n${h["x-ms-date"]};${u.host};${h["x-ms-content-sha256"]}`, "utf8")
    .digest("base64");
  assert.ok(h.Authorization.endsWith(`Signature=${expected}`), "المفتاح لم يُبتر عند حشوة base64");
  delete process.env.ACS_CONNECTION_STRING;
  process.env.ACS_ENDPOINT = prev.ep;
  process.env.ACS_ACCESS_KEY = prev.k;
});

test("الطلب يذهب إلى مسار ACS الصحيح", async () => {
  stubFetch();
  const res = await azureSendMail({ to: "client@example.com", subject: "عرض سعر", html: "<p>مرحباً</p>" });
  assert.equal(res.ok, true);
  const u = new URL(captured.url);
  assert.equal(u.pathname, "/emails:send");
  assert.equal(u.searchParams.get("api-version"), "2023-03-31");
});

test("التوقيع يطابق حساباً مستقلاً", async () => {
  stubFetch();
  await azureSendMail({ to: "client@example.com", subject: "عرض سعر", html: "<p>مرحباً</p>" });
  const body = captured.init.body;
  const h = captured.init.headers;
  const u = new URL(captured.url);

  const expectedHash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
  assert.equal(h["x-ms-content-sha256"], expectedHash, "بصمة الجسم = sha256 للجسم بصيغة base64");

  const stringToSign = `POST\n${u.pathname}${u.search}\n${h["x-ms-date"]};${u.host};${expectedHash}`;
  const expectedSig = crypto.createHmac("sha256", Buffer.from(KEY, "base64")).update(stringToSign, "utf8").digest("base64");
  assert.equal(
    h.Authorization,
    `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${expectedSig}`,
  );
  // التاريخ بصيغة RFC1123 وبتوقيت عالمي — «GMT» في آخره هي العلامة.
  assert.match(h["x-ms-date"], /GMT$/);
});

test("المُرسِل يصل عنواناً مجرّداً بلا حقلٍ غير موثّق", async () => {
  stubFetch();
  await azureSendMail({ to: "client@example.com", subject: "س", html: "<p>مرحباً</p>" });
  const sent = JSON.parse(captured.init.body);
  // ACS يريد العنوان وحده؛ «اسم <عنوان>» يعطي 400.
  assert.equal(sent.senderAddress, "DoNotReply@businesspartner.sa");
  // الاسم المعروض يُضبط على المورد في أزور، ولا حقل موثّقاً له في جسم الطلب.
  assert.equal("senderUsername" in sent, false);
  assert.equal(sent.recipients.to[0].address, "client@example.com");
});

test("نصٌّ مجرّد يُشتقّ من الHTML", async () => {
  stubFetch();
  await azureSendMail({ to: "client@example.com", subject: "س", html: "<p>مرحباً</p>" });
  const sent = JSON.parse(captured.init.body);
  assert.ok(sent.content.plainText.includes("مرحباً"));
});

test("المرفقات تُترجم من شكل Resend إلى شكل ACS", async () => {
  stubFetch();
  await azureSendMail({
    to: "client@example.com",
    subject: "فاتورة",
    html: "<p>x</p>",
    attachments: [{ filename: "invoice.pdf", content: "QUJD" }],
  });
  const sent = JSON.parse(captured.init.body);
  assert.equal(sent.attachments.length, 1);
  assert.equal(sent.attachments[0].name, "invoice.pdf", "name بدل filename");
  assert.equal(sent.attachments[0].contentType, "application/pdf", "النوع مُشتقّ من الامتداد");
  assert.equal(sent.attachments[0].contentInBase64, "QUJD", "contentInBase64 بدل content");
});

test("عدة مستقبِلين: مصفوفة أو سلسلة بفواصل", async () => {
  stubFetch();
  await azureSendMail({ to: "a@b.co, c@d.co", subject: "س", html: "<p>x</p>" });
  assert.deepEqual(JSON.parse(captured.init.body).recipients.to, [{ address: "a@b.co" }, { address: "c@d.co" }]);
  await azureSendMail({ to: ["a@b.co", "c@d.co"], subject: "س", html: "<p>x</p>" });
  assert.deepEqual(JSON.parse(captured.init.body).recipients.to, [{ address: "a@b.co" }, { address: "c@d.co" }]);
});

test("لا يُرسَل بلا مستقبِل صالح", async () => {
  stubFetch();
  captured = null;
  const bad = await azureSendMail({ to: "not-an-email", subject: "x", html: "y" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "no_recipient");
  assert.equal(captured, null, "لم يُنادَ الشبكة أصلاً");
});

test("ACS يردّ 202 قبولاً لا 200", async () => {
  stubFetch(202);
  assert.equal((await azureSendMail({ to: "a@b.co", subject: "س", html: "<p>x</p>" })).ok, true);
});

test("الفشل يُسمّى ولا يُرمى", async () => {
  stubFetch(401);
  const r = await azureSendMail({ to: "a@b.co", subject: "س", html: "<p>x</p>" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "http_401");
  assert.equal(r.detail, "boom", "نص خطأ أزور يُحفظ للتشخيص");
});

test("الغلاف المنطقي القديم ما زال يعيد true/false", async () => {
  stubFetch(202);
  assert.equal(await azureSendEmail("a@b.co", "س", "<p>x</p>"), true);
  stubFetch(500);
  assert.equal(await azureSendEmail("a@b.co", "س", "<p>x</p>"), false);
});
