// توقيع طلبات بريد Azure Communication Services.
//
// Run: npm test
//
// سبب تثبيت هذا: ACS لا يقبل مفتاحاً في ترويسة بسيطة، بل يوقّع الطلب بـHMAC
// على نصٍّ يجمع الفعل والمسار والتاريخ والمضيف وبصمة الجسم. وأي حرف يزيد أو
// ينقص في ذلك النص يعطي 401 لا تشرح نفسها — ولا تظهر إلا بعد النشر، حين تكون
// الرسالة التي لم تصل رمزَ دخول عميل أو عرض سعر. الحالات أدناه تحسب التوقيع
// حساباً مستقلاً وتقارنه بما يرسله الكود فعلاً، فلا يمر خطأ في البناء صامتاً.
import crypto from "node:crypto";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

// مفتاح اختباري بحت — base64 صالح ولا علاقة له بأي مورد حقيقي.
const KEY = Buffer.from("business-partner-test-key-0123456789").toString("base64");
process.env.ACS_ENDPOINT = "https://bp-test.saudiarabia.communication.azure.com";
process.env.ACS_ACCESS_KEY = KEY;
process.env.ACS_SENDER_ADDRESS = "Business Partner <DoNotReply@businesspartner.sa>";

const { sendMail, mailConfigured } = await import("../api/_mail.js");

// التقاط الطلب بدل إرساله
let captured = null;
globalThis.fetch = async (url, init) => {
  captured = { url, init };
  return { ok: true, status: 202, headers: { get: () => "req-1" }, text: async () => "" };
};

console.log("\n1. الإعداد يُقرأ من المتغيّرات المفرّقة");
ok(mailConfigured(), "mailConfigured صحيح حين تكتمل الثلاثة");

console.log("\n2. الطلب يذهب إلى مسار ACS الصحيح");
const res = await sendMail({ to: "client@example.com", subject: "عرض سعر", html: "<p>مرحباً</p>" });
ok(res.ok, "الإرسال نجح: " + JSON.stringify(res));
const u = new URL(captured.url);
ok(u.pathname === "/emails:send", "المسار /emails:send — وجد: " + u.pathname);
ok(u.searchParams.get("api-version") === "2023-03-31", "api-version افتراضي");

console.log("\n3. التوقيع يطابق حساباً مستقلاً");
const body = captured.init.body;
const h = captured.init.headers;
const expectedHash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
ok(h["x-ms-content-sha256"] === expectedHash, "بصمة الجسم = sha256 للجسم بصيغة base64");

const stringToSign = `POST\n${u.pathname}${u.search}\n${h["x-ms-date"]};${u.host};${expectedHash}`;
const expectedSig = crypto.createHmac("sha256", Buffer.from(KEY, "base64")).update(stringToSign, "utf8").digest("base64");
ok(
  h.Authorization === `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${expectedSig}`,
  "ترويسة Authorization بالصيغة والتوقيع المتوقّعين",
);
// التاريخ بصيغة RFC1123 وبتوقيت عالمي — «GMT» في آخره هي العلامة.
ok(/GMT$/.test(h["x-ms-date"]), "x-ms-date بصيغة RFC1123: " + h["x-ms-date"]);

console.log("\n4. المُرسِل يُفصل إلى عنوان واسم");
const sent = JSON.parse(body);
ok(sent.senderAddress === "DoNotReply@businesspartner.sa", "senderAddress عنوان مجرّد: " + sent.senderAddress);
ok(sent.senderUsername === "Business Partner", "الاسم في حقله المنفصل: " + sent.senderUsername);
ok(sent.recipients.to[0].address === "client@example.com", "المستقبِل في recipients.to");
ok(typeof sent.content.plainText === "string" && sent.content.plainText.includes("مرحباً"), "نصٌّ مجرّد يُشتقّ من الHTML");

console.log("\n5. المرفقات تُترجم من شكل Resend إلى شكل ACS");
await sendMail({
  to: "client@example.com",
  subject: "فاتورة",
  html: "<p>x</p>",
  attachments: [{ filename: "invoice.pdf", content: "QUJD" }],
});
const withFiles = JSON.parse(captured.init.body);
ok(withFiles.attachments?.length === 1, "مرفق واحد");
ok(withFiles.attachments[0].name === "invoice.pdf", "name بدل filename");
ok(withFiles.attachments[0].contentType === "application/pdf", "النوع مُشتقّ من الامتداد");
ok(withFiles.attachments[0].contentInBase64 === "QUJD", "contentInBase64 بدل content");

console.log("\n6. لا يُرسَل بلا مستقبِل صالح");
const bad = await sendMail({ to: "not-an-email", subject: "x", html: "y" });
ok(!bad.ok && bad.error === "no_recipient", "عنوان غير صالح يُردّ قبل النداء: " + JSON.stringify(bad));

if (fail.length) { console.error(`\n${fail.length} FAILED`); process.exit(1); }
console.log("\nALL PASS");
