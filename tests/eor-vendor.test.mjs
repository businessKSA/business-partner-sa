// طلبات EOR مجهولة العميل لبوابة المورّدين — listVendorDemand في api/_eor.js. بلا شبكة: Notion كله محاكى.
//
// ما يُثبته هذا الملف: الناتج قائمةٌ بيضاء فقط. أسماء المنشأة والتواصل والبريد والجوال والملاحظات والراتب والتقدير
// والعنوان، وأي حقلٍ جديد في الحمولة، لا تظهر في أي مكانٍ من الناتج — بفحصٍ نصّي على JSON بقيمٍ فريدة (canaries).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

process.env.APP_ENV = "development";
process.env.LOCAL_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eor-vendor-test-"));

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const E = await import("../api/_eor.js");

const NOW = Date.parse("2026-10-08T09:00:00Z");
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });

// قيم فريدة لا يجوز أن تظهر في الناتج.
const CANARY = {
  company: "ZZCOMPANY7Q1", contact: "ZZCONTACT8W2", email: "zzmail3k@canary.example", phone: "0559876543",
  notes: "ZZNOTES4R5", salary: 7771.25, quote: "ZZQUOTE9T6", addr: "ZZADDR2Y3", memo: "ZZMEMO1A1", itemNote: "ZZITEMNOTE5B5",
};
const CANARY_TEXT = [CANARY.company, CANARY.contact, CANARY.email, CANARY.phone.slice(1), CANARY.notes, "7771", CANARY.quote, CANARY.addr, CANARY.memo, CANARY.itemNote, "canary.example"];
const assertNoCanary = (value, label = "") => {
  const s = JSON.stringify(value);
  for (const c of CANARY_TEXT) assert.equal(s.includes(c), false, `${label} تسرّب: ${c}`);
};

const good = (over = {}) => ({
  company: CANARY.company, contactName: CANARY.contact, email: CANARY.email, phone: CANARY.phone, city: "الرياض",
  sector: "hospitality", workerType: "foreign", recruitment: "yes",
  items: [
    { occupationId: "hosp.waiter", count: 5, nationalities: ["IN", "PK"], salary: CANARY.salary },
    { occupationId: "hosp.chef-de-partie", count: 2, nationalities: [], salary: null },
  ],
  startDate: "2026-11-01", durationMonths: 12, notes: CANARY.notes, lang: "ar", ...over,
});

// يكتب الطلب بالمعالج الحقيقي ويلتقط ما أُرسل إلى Notion، ثم يحوّله إلى شكل القراءة (صفحة + كتلة الجسم).
function plainOf(prop) {
  if (prop.title) return { title: prop.title.map((x) => ({ plain_text: x.text.content })) };
  if (prop.rich_text) return { rich_text: prop.rich_text.map((x) => ({ plain_text: x.text.content })) };
  return prop;   // select/number/date/email/phone_number/checkbox متطابقة في الكتابة والقراءة
}
async function writeRow(body, { ref, open = true, status = "جديد", created = "2026-10-05T10:00:00.000Z", launch = null, id } = {}) {
  let captured = null;
  const ctx = {
    dev: false, notionToken: "t", dbId: "d", now: NOW, ip: "", pricing: null, refGen: () => ref,
    fetch: async (url, init) => { captured = JSON.parse(init.body); return resp(200, { id: id || "page-" + ref }); },
    sendEmail: async () => ({ ok: true }), notify: async () => ({ ok: true }), teamEmail: "t@test.local", ownerEmail: "o@test.local",
  };
  const r = await E.handleEor(body, ctx);
  assert.equal(r.ok, true, JSON.stringify(r));
  const props = {};
  for (const [k, v] of Object.entries(captured.properties)) props[k] = plainOf(v);
  props["الحالة"] = { select: { name: status } };
  props["تقدير عرض السعر"] = { rich_text: [{ plain_text: CANARY.quote }] };
  props["مفتوح للمورّدين"] = { checkbox: open };
  props["تاريخ الإطلاق"] = { date: launch ? { start: launch } : null };
  return { page: { id: id || "page-" + ref, created_time: created, archived: false, properties: props }, children: captured.children };
}

// Notion محاكى: يعيد الصفوف كلها دون تصفية (ليُختبر التحقق المحلي)، وكتل الجسم من الخريطة.
function notionMock(rows, over = {}) {
  const log = { query: [], children: [] };
  const bodies = new Map(rows.map((r) => [r.page.id, r.children]));
  const fetch = async (url, init) => {
    if (over.throw) throw new Error("network down");
    if (/\/databases\/[^/]+\/query$/.test(url)) {
      const body = JSON.parse(init.body);
      log.query.push({ url, init, body });
      if (over.queryStatus) return resp(over.queryStatus, "boom");
      if (over.pages) return resp(200, over.pages[log.query.length - 1]);
      return resp(200, { results: rows.map((r) => r.page), has_more: false, next_cursor: null });
    }
    const m = url.match(/\/blocks\/([^/?]+)\/children/);
    if (m) {
      log.children.push(m[1]);
      if (over.childrenStatus) return resp(over.childrenStatus, "boom");
      if (over.noCode) return resp(200, { results: [{ type: "paragraph", paragraph: {} }] });
      return resp(200, { results: (bodies.get(decodeURIComponent(m[1])) || []).map((b) => ({ type: b.type, code: b.code })) });
    }
    return resp(404, "unexpected " + url);
  };
  return { fetch, log };
}
const run = (rows, over, opts) => { const m = notionMock(rows, over); return E.listVendorDemand({ notionToken: "tok", dbId: "db-x", fetch: m.fetch, ...(opts || {}) }).then((r) => ({ r, ...m })); };

/* ───────────── الأساس: الاستعلام والقيم ───────────── */
test("الاستعلام: مفتوح للمورّدين = true وحالة ≠ مغلق، رأس Notion، وحدّ الصفحة", async () => {
  const row = await writeRow(good(), { ref: "EOR-100001" });
  const { r, log } = await run([row]);
  assert.equal(r.ok, true);
  assert.equal(log.query.length, 1);
  const q = log.query[0];
  assert.ok(q.url.endsWith("/databases/db-x/query"));
  assert.equal(q.init.headers.Authorization, "Bearer tok");
  assert.equal(q.init.headers["Notion-Version"], "2022-06-28");
  assert.deepEqual(q.body.filter, { and: [{ property: "مفتوح للمورّدين", checkbox: { equals: true } }, { property: "الحالة", select: { does_not_equal: "مغلق" } }] });
  assert.equal(q.body.page_size, 100);
});

test("بندان من طلب واحد: قيم القائمة البيضاء صحيحة، itemId = ref-فهرس (من ١)", async () => {
  const row = await writeRow(good(), { ref: "EOR-100001" });
  const { r } = await run([row]);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0], {
    ref: "EOR-100001", itemId: "EOR-100001-1", occupationId: "hosp.waiter", nameAr: "نادل", nameEn: "Waiter / Server",
    count: 5, nationalities: ["IN", "PK"], startDate: "2026-11-01", durationMonths: 12, sector: "hospitality", region: "الرياض",
  });
  assert.equal(r.items[1].itemId, "EOR-100001-2");
  assert.equal(r.items[1].occupationId, "hosp.chef-de-partie");
  assert.deepEqual(r.items[1].nationalities, []);
});

/* ───────────── الحارس: لا تسرّب ───────────── */
test("الحارس: مفاتيح كل بند = VENDOR_ITEM_FIELDS بالضبط، ولا قيمة فريدة من الاسم/التواصل/البريد/الجوال/الملاحظات/الراتب/التقدير/العنوان", async () => {
  const row = await writeRow(good({ city: "الرياض، حي " + CANARY.addr + "، شارع الملك" }), { ref: "EOR-100002" });
  // التأكد أن القيم الفريدة موجودة فعلاً في المصدر (وإلا يكون الفحص أجوف)
  const src = JSON.stringify(row);
  for (const c of [CANARY.company, CANARY.contact, "canary.example", CANARY.notes, "7771.25", CANARY.quote, CANARY.addr]) assert.ok(src.includes(c), "المصدر يحوي " + c);
  const { r } = await run([row]);
  assert.equal(r.ok, true);
  assert.ok(r.items.length > 0);
  for (const it of r.items) assert.deepEqual(Object.keys(it), [...E.VENDOR_ITEM_FIELDS]);
  assert.deepEqual(Object.keys(r), ["ok", "items"]);
  assertNoCanary(r, "الناتج");
  assert.equal(r.items[0].region, "السعودية", "مدينة معها عنوان ⇒ السعودية لا نصّ العميل");
});

test("حقلٌ جديد غير مدرج في القائمة البيضاء لا يمرّ (على مستوى الطلب وعلى مستوى البند، في كتلة JSON وفي الصف)", async () => {
  const row = await writeRow(good(), { ref: "EOR-100003" });
  const payload = JSON.parse(row.children[0].code.rich_text.map((x) => x.text.content).join(""));
  payload.internalMemo = CANARY.memo; payload.company2 = CANARY.company; payload.quote = { total: CANARY.quote };
  payload.items = payload.items.map((it) => ({ ...it, vendorNote: CANARY.itemNote, salary: CANARY.salary, priceSar: 123456 }));
  row.children = [{ type: "code", code: { language: "json", rich_text: [{ text: { content: JSON.stringify(payload) } }] } }];
  row.page.properties["حقل جديد"] = { rich_text: [{ plain_text: CANARY.memo }] };
  const { r } = await run([row]);
  assert.equal(r.ok, true);
  for (const it of r.items) { assert.deepEqual(Object.keys(it), [...E.VENDOR_ITEM_FIELDS]); assert.ok(!("priceSar" in it) && !("salary" in it) && !("vendorNote" in it)); }
  assertNoCanary(r);
  assert.equal(JSON.stringify(r).includes("123456"), false);
});

test("احتياط العمود النصّي (لا كتلة JSON): البنود تُستعاد، والراتب والمنشأة والملاحظات لا تظهر", async () => {
  for (const over of [{ childrenStatus: 500 }, { noCode: true }]) {
    const row = await writeRow(good({ items: [{ occupationId: "hosp.waiter", count: 4, nationalities: ["IN"], salary: CANARY.salary }, { occupationId: "hosp.chef-de-partie", count: 1, nationalities: [] }] }), { ref: "EOR-100004" });
    assert.match(row.page.properties["بنود المهن"].rich_text[0].plain_text, /الراتب المتوقع: 7771\.25/, "العمود النصّي يحمل الراتب في المصدر");
    const { r } = await run([row], over);
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 2, JSON.stringify(over));
    assert.deepEqual([r.items[0].occupationId, r.items[0].count, r.items[0].nationalities, r.items[0].itemId], ["hosp.waiter", 4, ["IN"], "EOR-100004-1"]);
    assert.deepEqual([r.items[1].occupationId, r.items[1].count, r.items[1].nationalities], ["hosp.chef-de-partie", 1, []]);
    // تاريخ البدء والمدة والمجال من أعمدة الصف حين لا جسم
    assert.deepEqual([r.items[0].startDate, r.items[0].durationMonths, r.items[0].sector, r.items[0].region], ["2026-11-01", 12, "hospitality", "الرياض"]);
    assertNoCanary(r, JSON.stringify(over));
  }
});

/* ───────────── من يظهر ومن لا يظهر ───────────── */
test("صف مغلق لا يظهر، وصف غير مفتوح لا يظهر (حتى لو أعاد Notion كل الصفوف)", async () => {
  const open = await writeRow(good(), { ref: "EOR-100010" });
  const closed = await writeRow(good(), { ref: "EOR-100011", status: "مغلق" });
  const notOpen = await writeRow(good(), { ref: "EOR-100012", open: false });
  const noFlag = await writeRow(good(), { ref: "EOR-100013" }); delete noFlag.page.properties["مفتوح للمورّدين"];
  const archived = await writeRow(good(), { ref: "EOR-100014" }); archived.page.archived = true;
  const review = await writeRow(good(), { ref: "EOR-100015", status: "قيد المراجعة" });
  const { r } = await run([open, closed, notOpen, noFlag, archived, review]);
  assert.equal(r.ok, true);
  assert.deepEqual([...new Set(r.items.map((x) => x.ref))].sort(), ["EOR-100010", "EOR-100015"]);
});

test("صفٌّ بلا بند صالح أو بمرجع فاسد يُتخطّى، والبند الفاسد لا يُسقط جاره ولا يغيّر فهرسه", async () => {
  const row = await writeRow(good(), { ref: "EOR-100020" });
  const payload = JSON.parse(row.children[0].code.rich_text.map((x) => x.text.content).join(""));
  payload.items = [{ occupationId: "made.up", count: 3 }, { occupationId: "hosp.waiter", count: 0 }, { occupationId: "hosp.waiter", count: 2, nationalities: ["IN", "ZZ", "in"] }, "x", null];
  payload.startDate = "2026-02-30"; payload.durationMonths = 999; payload.sector = "not-a-sector";
  row.children = [{ type: "code", code: { language: "json", rich_text: [{ text: { content: JSON.stringify(payload) } }] } }];
  const empty = await writeRow(good(), { ref: "EOR-100021" });
  const e = JSON.parse(empty.children[0].code.rich_text.map((x) => x.text.content).join("")); e.items = [];
  empty.children = [{ type: "code", code: { language: "json", rich_text: [{ text: { content: JSON.stringify(e) } }] } }];
  const badRef = await writeRow(good(), { ref: "EOR-100022" }); badRef.page.properties["رقم مرجعي"] = { title: [{ plain_text: "<script>x</script>" }] };
  const { r } = await run([row, empty, badRef]);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].itemId, "EOR-100020-3", "الفهرس = موضع البند الأصلي");
  assert.deepEqual(r.items[0].nationalities, ["IN"]);
  assert.equal(r.items[0].startDate, "2026-11-01", "تاريخ غير صالح في الجسم ⇒ يُستعاد من عمود الصف");
  assert.equal(r.items[0].durationMonths, 12);
  assert.equal(r.items[0].sector, "hospitality", "مجال غير معروف في الجسم ⇒ من عمود «المجال»");
});

test("بلا مجال ولا تاريخ ولا مدة: قيم فارغة صريحة لا undefined", async () => {
  const row = await writeRow(good({ sector: "", startDate: "" }), { ref: "EOR-100030" });
  delete row.page.properties["المجال"];
  const { r } = await run([row]);
  assert.deepEqual([r.items[0].sector, r.items[0].startDate], ["", ""]);
  assert.equal(r.items[0].durationMonths, 12);
  assert.ok(Object.values(r.items[0]).every((x) => x !== undefined));
});

/* ───────────── الترتيب والحدّ والصفحات ───────────── */
test("الأحدث أولاً (تاريخ الإطلاق إن وُضع وإلا الاستلام)، والحدّ ١٠٠ بند", async () => {
  const a = await writeRow(good({ items: [good().items[0]] }), { ref: "EOR-200001", created: "2026-10-01T00:00:00.000Z" });
  const b = await writeRow(good({ items: [good().items[0]] }), { ref: "EOR-200002", created: "2026-10-03T00:00:00.000Z" });
  const c = await writeRow(good({ items: [good().items[0]] }), { ref: "EOR-200003", created: "2026-09-01T00:00:00.000Z", launch: "2026-10-07" });
  const { r } = await run([a, b, c]);
  assert.deepEqual(r.items.map((x) => x.ref), ["EOR-200003", "EOR-200002", "EOR-200001"]);

  const many = [];
  for (let i = 0; i < 130; i++) many.push(await writeRow(good({ items: [good().items[0]] }), { ref: "EOR-3" + String(10000 + i), created: new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString() }));
  const { r: big, log } = await run(many);
  assert.equal(big.items.length, 100);
  assert.equal(big.items[0].ref, "EOR-3" + String(10129), "الأحدث أولاً");
  assert.equal(big.items[99].ref, "EOR-3" + String(10030));
  assert.ok(log.children.length < 130, "لا نجلب أجسام صفوفٍ لن تظهر");
  const { r: five } = await run(many, {}, { limit: 5 });
  assert.equal(five.items.length, 5);
  const { r: huge } = await run(many, {}, { limit: 5000 });
  assert.equal(huge.items.length, 100, "السقف ١٠٠ لا يُتجاوز");
});

test("تعدّد صفحات Notion: يتبع next_cursor", async () => {
  const a = await writeRow(good(), { ref: "EOR-400001" });
  const b = await writeRow(good(), { ref: "EOR-400002" });
  const pages = [{ results: [a.page], has_more: true, next_cursor: "cur-2" }, { results: [b.page], has_more: false, next_cursor: null }];
  const { r, log } = await run([a, b], { pages });
  assert.equal(log.query.length, 2);
  assert.equal(log.query[0].body.start_cursor, undefined);
  assert.equal(log.query[1].body.start_cursor, "cur-2");
  assert.deepEqual([...new Set(r.items.map((x) => x.ref))].sort(), ["EOR-400001", "EOR-400002"]);
});

/* ───────────── الفشل قيمةً لا استثناء ───────────── */
test("فشل Notion ⇒ { ok:false, error } بلا استثناء، وبلا items", async () => {
  const row = await writeRow(good(), { ref: "EOR-500001" });
  const a = (await run([row], { queryStatus: 500 })).r;
  assert.deepEqual(a, { ok: false, error: "notion_unavailable" });
  const b = (await run([row], { throw: true })).r;
  assert.equal(b.ok, false); assert.ok(typeof b.error === "string" && b.error); assert.ok(!("items" in b));
  const c = await E.listVendorDemand({ notionToken: "", fetch: async () => { throw new Error("must not be called"); } });
  assert.deepEqual(c, { ok: false, error: "not_configured" });
  const d = await E.listVendorDemand({ notionToken: "t", fetch: async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }) });
  assert.equal(d.ok, false);
  const e = await E.listVendorDemand({ notionToken: "t", fetch: async () => ({ ok: true, json: async () => null }) });
  assert.deepEqual(e, { ok: true, items: [] });
});

test("استعلام فاضٍ ⇒ { ok:true, items:[] }", async () => {
  assert.deepEqual((await run([])).r, { ok: true, items: [] });
});

/* ───────────── المنطقة العامة ───────────── */
test("publicRegion: مدينة وحدها من القائمة ⇒ اسمها، وأي شيء آخر (عنوان، حيّ، مدينة غير معروفة، فراغ) ⇒ السعودية", () => {
  for (const [input, want] of [["الرياض", "الرياض"], ["  الرياض  ", "الرياض"], ["Riyadh", "الرياض"], ["جده", "جدة"], ["مكة", "مكة المكرمة"], ["مدينة الدمام", "الدمام"], ["الاحساء", "الأحساء"], ["Al Khobar", "الخبر"]]) assert.equal(E.publicRegion(input), want, input);
  for (const input of ["الرياض، حي الملقا", "الرياض - شارع التحلية", "Riyadh, King Fahd Rd", "حي الملقا", "الرياض 12345", "Springfield", "", null, undefined, "الرياض\nمبنى 4", CANARY.addr]) assert.equal(E.publicRegion(input), "السعودية", String(input));
});
