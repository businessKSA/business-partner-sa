// مشغّل خارجي (n8n) لقراءة السير: سرٌّ مستقلّ عن CRON_SECRET، يفتح مسارَي القراءة والاستدراك وحدهما.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cv-runner-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = DBDIR;
process.env.NOTION_TOKEN = "test-token-never-leaves-this-process";
process.env.AZURE_OPENAI_ENDPOINT = "https://azure.test";
process.env.AZURE_OPENAI_KEY = "azure-test-key";
process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-test";
process.env.AZURE_DOCINTEL_ENDPOINT = "https://docintel.test";
process.env.AZURE_DOCINTEL_KEY = "docintel-test-key";
process.env.CV_RUNNER_SECRET = "runner-secret-0123456789-abcdef";
delete process.env.PANEL_KEY; delete process.env.LEADS_KEY; delete process.env.CRON_SECRET;

const queries = [];
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("api.notion.com") && String(url).endsWith("/query")) {
    queries.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
  }
  throw new Error("شبكة غير متوقعة: " + url);
};

const { default: handler } = await import("../api/candidate.js");
function call(url, headers = {}) {
  let status = 0, body = "";
  const res = { setHeader() {}, set statusCode(v) { status = v; }, get statusCode() { return status; }, end(b) { body = b; } };
  return handler({ method: "GET", url, headers, on() {} }, res).then(() => ({ status: status || 200, data: (() => { try { return JSON.parse(body); } catch { return null; } })() }));
}
const AUTH = { authorization: "Bearer runner-secret-0123456789-abcdef" };

test("بلا سرّ أو بسرٍّ خاطئ: 403 ولا استعلام", async () => {
  queries.length = 0;
  assert.equal((await call("/api/candidate?action=extract-cvs&dryRun=1")).status, 403);
  assert.equal((await call("/api/candidate?action=extract-cvs&dryRun=1", { authorization: "Bearer wrong" })).status, 403);
  assert.equal(queries.length, 0);
});

test("سرّ المشغّل يفتح extract-cvs، و applicants=1 يضع شرط الوظيفة المتقدَّم لها", async () => {
  queries.length = 0;
  const r = await call("/api/candidate?action=extract-cvs&dryRun=1&applicants=1", AUTH);
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  const f = JSON.stringify(queries[0].filter);
  assert.ok(f.includes("الوظيفة المتقدم لها"), "لم يُقيَّد بالمتقدّمين");
  queries.length = 0;
  await call("/api/candidate?action=extract-cvs&dryRun=1", AUTH);
  assert.ok(!JSON.stringify(queries[0].filter).includes("الوظيفة المتقدم لها"), "قيّد بلا طلب");
});

test("السرّ لا يفتح مساراتٍ أخرى للمالك (fix-compliance وsaudization)", async () => {
  queries.length = 0;
  assert.equal((await call("/api/candidate?action=fix-compliance&dryRun=1", AUTH)).status, 403);
  assert.equal((await call("/api/candidate?action=saudization&dryRun=1", AUTH)).status, 403);
  assert.equal(queries.length, 0);
});

test("سرٌّ قصير (أقل من ٢٤ حرفاً) لا يُقبل", async () => {
  const { runnerOk } = await import("../api/candidate.js");
  assert.equal(runnerOk({ headers: { authorization: "Bearer short" } }), false);
});

test.after(() => { try { fs.rmSync(DBDIR, { recursive: true, force: true }); } catch {} });
