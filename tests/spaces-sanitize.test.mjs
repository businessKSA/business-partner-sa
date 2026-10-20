// ‏معرض المساحات العام (/api/spaces) لا يكشف المورّد: Business Partner وسيط.
// يقرأ من اللوحة الموحّدة، وينشر العرض المتاح فقط، بلا اسم الإعلان (يحمل
// العلامة التجارية) ولا بريد ولا هاتف، ولا يطابق البحثُ اسمَ المورّد.
import test from "node:test";
import assert from "node:assert/strict";

process.env.NOTION_TOKEN = "test";
delete process.env.NOTION_SUPPLY_DB;
let sent;
globalThis.fetch = async (url, opt) => {
  sent = { url, body: JSON.parse(opt.body) };
  return { ok: true, json: async () => ({ results: [{ properties: {
    Name: { type: "title", title: [{ plain_text: "Regus – Tamkeen Tower" }] },
    City: { type: "select", select: { name: "Riyadh" } },
    District: { type: "rich_text", rich_text: [{ plain_text: "Olaya" }] },
    "Property Category": { type: "select", select: { name: "Office" } },
    "Size sqm": { type: "number", number: 120 },
    "Vendor Name": { type: "rich_text", rich_text: [{ plain_text: "IWG / Regus" }] },
    Email: { type: "email", email: "x@iwgplc.com" },
  } }] }) };
};
const { default: handler } = await import("../api/_spaces.js");
const run = (url) => new Promise((resolve) => handler({ url }, { setHeader() {}, end: (b) => resolve(JSON.parse(b)) }));

test("reads available supply from the unified board only", async () => {
  await run("/api/spaces");
  assert.match(sent.url, /f416606b4fab4cbb80ced171f75e0a3b/);
  const f = JSON.stringify(sent.body.filter);
  assert.match(f, /"Available"/);
  assert.match(f, /Supply - For Rent/);
});

test("never exposes the vendor", async () => {
  const out = await run("/api/spaces");
  assert.equal(out.total, 1);
  assert.equal(out.spaces[0].district, "Olaya");
  assert.equal("name" in out.spaces[0], false);
  assert.doesNotMatch(JSON.stringify(out), /Regus|IWG|iwgplc/i);
  assert.equal((await run("/api/spaces?q=regus")).total, 0);
});
