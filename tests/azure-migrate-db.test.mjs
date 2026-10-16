// أداة النقل ops/azure/migrate-db.mjs.
//  • اختبارات بلا شبكة: وصف الهدف من db/schema.sql، الترتيب، الخطة، الترميز، ملف محلي (db/seed.local.json)
//    بوضع --dry-run بلا أي اتصال، وأن المخرجات لا تحمل قيماً.
//  • اختبارات على Postgres حقيقي: تُشغَّل إن وُجد خادم عند MIGRATE_TEST_PG (الافتراضي
//    postgres://bp_test:bp_test@127.0.0.1:54329) وفيه قاعدتان src_db وdst_db فارغتان؛ وإلا تتخطّى نفسها
//    (كما يفعل tests/azpg.test.mjs). تنشئ جداولها وتهدمها بنفسها.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ident, parseSchemaSql, planOrder, buildPlan, encodeForColumn, orderSelfRef, parseArgs, main, hashSql, hostOf,
} from "../ops/azure/migrate-db.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = path.join(ROOT, "db", "schema.sql");
const SEED = path.join(ROOT, "db", "seed.local.json");
const sink = () => { const lines = []; return { lines, log: (m) => lines.push(String(m)), error: (m) => lines.push(String(m)), text: () => lines.join("\n") }; };

// -------------------------------------------------------------- بلا شبكة --
test("ident: quotes safe names (Prisma's mixed case included) and refuses anything that could inject", () => {
  assert.equal(ident("users"), '"users"');
  assert.equal(ident("Client"), '"Client"');
  assert.equal(ident("nameAr"), '"nameAr"');
  for (const bad of ['a"b', "a;drop table x", "a b", "", "1x", "a-b"]) assert.throws(() => ident(bad), /معرّف غير صالح/, bad);
});

test("parseSchemaSql: every table of db/schema.sql, its columns (incl. alter … add column and text[]), PKs and FKs", () => {
  const sql = fs.readFileSync(SCHEMA, "utf8");
  const meta = parseSchemaSql(sql);
  const declared = [...sql.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);
  assert.ok(declared.length >= 45);
  assert.deepEqual([...meta.tables.keys()].sort(), declared.sort());
  assert.deepEqual(meta.tables.get("organization_members").pk, ["organization_id", "user_id"], "مفتاح مركّب");
  assert.deepEqual(meta.tables.get("users").pk, ["id"]);
  assert.equal(meta.tables.get("bd_profiles").columns.get("target_cities").type, "text[]");
  assert.ok(meta.tables.get("service_entitlements").columns.has("missing_documents"));
  assert.ok(meta.fks.some((e) => e.child === "payments" && e.parent === "documents" && e.childCols[0] === "receipt_document_id"), "alter table … add constraint foreign key");
  assert.ok(meta.fks.some((e) => e.child === "organization_members" && e.parent === "users"));
  const order = planOrder([...meta.tables.keys()], meta.fks);
  assert.equal(order.problem, null, "المخطّط الحالي بلا حلقات");
  const pos = (t) => order.order.indexOf(t);
  assert.ok(pos("users") < pos("user_sessions") && pos("organizations") < pos("organization_members"));
});

test("planOrder: parents first; a self reference is allowed; a hard cycle is reported, a deferrable one is not a blocker message", () => {
  const fks = [{ child: "b", parent: "a" }, { child: "c", parent: "b" }, { child: "c", parent: "c" }];
  assert.deepEqual(planOrder(["c", "b", "a"], fks).order, ["a", "b", "c"]);
  const cyc = planOrder(["x", "y"], [{ child: "x", parent: "y", deferrable: false }, { child: "y", parent: "x", deferrable: false }]);
  assert.deepEqual(cyc.cycle, ["x", "y"]);
  assert.match(cyc.problem, /حلقة.*DEFERRABLE/);
});

test("buildPlan: missing tables, extra/absent columns, system tables, --tables filter", () => {
  const meta = {
    tables: new Map([["Client", { columns: new Map([["id", {}], ["nameAr", {}], ["extra", {}]]), pk: ["id"] }], ["Doc", { columns: new Map([["id", {}]]), pk: ["id"] }]]),
    fks: [{ child: "Doc", parent: "Client", childCols: ["clientId"] }],
  };
  const info = new Map([
    ["Client", { count: 3, columns: new Set(["id", "nameAr", "old"]) }],
    ["Doc", { count: 1, columns: new Set(["id"]) }],
    ["Ghost", { count: 9, columns: new Set(["id"]) }],
    ["_prisma_migrations", { count: 5, columns: new Set(["id"]) }],
  ]);
  const p = buildPlan(info, meta);
  assert.deepEqual(p.order, ["Client", "Doc"]);
  assert.deepEqual(p.rows[0].extraOnSource, ["old"]);
  assert.deepEqual(p.rows[0].notOnSource, ["extra"]);
  assert.deepEqual(p.missingOnTarget, ["Ghost"]);
  assert.deepEqual(p.skippedSystem, ["_prisma_migrations"]);
  assert.equal(p.errors.length, 1);
  assert.equal(buildPlan(info, meta, { skipMissing: true }).errors.length, 0);
  assert.deepEqual(buildPlan(info, meta, { only: ["Doc"], skipMissing: true }).order, ["Doc"]);
  assert.match(buildPlan(info, meta, { only: ["Nope"] }).errors.join("|"), /Nope/);
});

test("encodeForColumn: jsonb, arrays (quotes/commas/null), dates, objects; nulls stay null", () => {
  assert.equal(encodeForColumn({ a: [1, "x"] }, { type: "jsonb" }), '{"a":[1,"x"]}');
  assert.equal(encodeForColumn(["a,b", 'q"r', null], { type: "text[]" }), '{"a,b","q\\"r",NULL}');
  assert.equal(encodeForColumn([[1, 2], [3, 4]], { type: "integer[]" }), '{{"1","2"},{"3","4"}}');
  assert.equal(encodeForColumn(new Date("2026-01-02T03:04:05Z"), { type: "timestamptz" }), "2026-01-02T03:04:05.000Z");
  assert.equal(encodeForColumn(12.5, { type: "numeric" }), "12.5");
  assert.equal(encodeForColumn(true, { type: "boolean" }), "true");
  assert.equal(encodeForColumn(null, { type: "jsonb" }), null);
  assert.equal(encodeForColumn(undefined, { type: "text" }), null);
});

test("orderSelfRef: parents before children whatever the input order; a loop is refused", () => {
  const rows = [{ id: "c", p: "b" }, { id: "b", p: "a" }, { id: "a", p: null }, { id: "z", p: "zz-missing" }];
  const out = orderSelfRef(rows, "id", "p").map((r) => r.id);
  assert.ok(out.indexOf("a") < out.indexOf("b") && out.indexOf("b") < out.indexOf("c"));
  assert.equal(out.length, 4);
  assert.throws(() => orderSelfRef([{ id: "a", p: "b" }, { id: "b", p: "a" }], "id", "p"), /حلقة/);
});

test("parseArgs: flags, defaults, and refusing unknown ones", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--tables=a,b", "--batch=50", "--skip-missing"]),
    { dryRun: true, verify: false, tables: ["a", "b"], batch: 50, schema: "public", skipMissing: true, replaceNoPk: false, clean: false, fromFile: null, schemaFile: null });
  assert.throws(() => parseArgs(["--wat"]), /غير معروف/);
  assert.throws(() => parseArgs(["--batch=0"]), /موجب/);
});

test("hashSql: hashes the common columns in a fixed order and treats NULL distinctly from empty text", () => {
  const sql = hashSql("Client", ["a", "b"]);
  assert.match(sql, /coalesce\("a"::text, chr\(2\)\), coalesce\("b"::text, chr\(2\)\)/);
  assert.match(sql, /from "Client"/);
});

test("offline rehearsal: local file + schema file + --dry-run — no connection, no values in the output", async () => {
  const out = sink();
  const code = await main(["--dry-run", `--from-file=${SEED}`, `--schema-file=${SCHEMA}`], {}, out);
  assert.equal(code, 0, out.text());
  const t = out.text();
  assert.match(t, /organizations: مصدر 2/);
  assert.match(t, /لم يُكتب شيء/);
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  const secrets = [];
  for (const rows of Object.values(seed)) for (const r of rows) for (const v of Object.values(r)) if (typeof v === "string" && v.length > 5 && !/^[\w.-]+$/.test(v)) secrets.push(v);
  for (const v of secrets.slice(0, 200)) assert.ok(!t.includes(v), `القيمة تسرّبت إلى المخرجات: ${v.slice(0, 12)}`);
  assert.doesNotMatch(t, /@/, "لا بريد إلكتروني في المخرجات");
});

test("refusals: no source, no target, both sources, offline without --dry-run, target = source, target is Supabase/Neon", async () => {
  const run = async (args, env) => { const o = sink(); return { code: await main(args, env, o), text: o.text() }; };
  assert.equal((await run([], { AZURE_PG_URL: "postgres://u:p@h/d" })).code, 2);
  assert.equal((await run([], { SOURCE_PG_URL: "postgres://u:p@h/d" })).code, 2);
  assert.equal((await run([`--from-file=${SEED}`], { SOURCE_PG_URL: "postgres://u:p@h/d", AZURE_PG_URL: "postgres://u:p@x/d" })).code, 2);
  assert.equal((await run([`--from-file=${SEED}`, `--schema-file=${SCHEMA}`], {})).code, 2, "--schema-file بلا --dry-run");
  const same = await run([], { SOURCE_PG_URL: "postgres://u:SECRETPW@db.example:5432/app", AZURE_PG_URL: "postgres://u2:OTHERPW@db.example:5432/app" });
  assert.equal(same.code, 2);
  for (const host of ["db.abc.supabase.co", "aws-0-ap.pooler.supabase.com", "ep-x.neon.tech"]) {
    const r = await run([], { SOURCE_PG_URL: "postgres://u:p@old.example/a", AZURE_PG_URL: `postgres://u:SECRETPW@${host}:5432/postgres` });
    assert.equal(r.code, 2, host);
    assert.doesNotMatch(r.text, /SECRETPW/, "كلمة السر لا تُطبع");
  }
  assert.equal(hostOf("postgres://u:p@h.example:6432/db"), "h.example:6432/db");
});

// ------------------------------------------------- على Postgres حقيقي --
const BASE = (process.env.MIGRATE_TEST_PG || "postgres://bp_test:bp_test@127.0.0.1:54329").replace(/\/+$/, "");
const SRC = `${BASE}/src_db`;
const DST = `${BASE}/dst_db`;
let pg, unavailable = null;
const env = (o = {}) => ({ SOURCE_PG_URL: SRC, AZURE_PG_URL: DST, SOURCE_PG_SSL: "0", AZURE_PG_SSL: "0", ...o });

async function withClient(url, fn) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

const SENTINEL = "SENTINEL-VALUE-لا-تظهر-في-المخرجات";
const DDL = `
  drop schema if exists public cascade; create schema public;
  create table "Client" (id text primary key, "nameAr" text not null, meta jsonb, tags text[], "createdAt" timestamp(3) not null default now(), "paidAt" timestamptz, amount numeric(65,30), flag boolean not null default false);
  create table "Document" (id text primary key, "clientId" text not null references "Client"(id), "parentId" text references "Document"(id), body text, raw bytea);
  create table "Counter" (id int generated always as identity primary key, label text, doubled int generated always as (id * 2) stored);
  create table legacy (id serial primary key, name text);
  create table nolog (msg text);
  create table "_prisma_migrations" (id text primary key);
`;
const DDL_NO_SYSTEM = DDL; // الهدف يحمل البنية نفسها
const SEEDSQL = `
  insert into "Client" (id, "nameAr", meta, tags, "createdAt", "paidAt", amount, flag) values
    ('c1', 'شركة ${SENTINEL}', '{"a":[1,{"b":"x,y"}],"s":"q\\"r"}', array['a,b','q"r','{x}','', 'NULL'], '2026-01-02 03:04:05.123', '2026-02-03 04:05:06.789+03', 12345678901234567890.123456789012345678, true),
    ('c2', 'ثانٍ', null, null, '2026-03-04 00:00:00', null, null, false),
    ('c3', 'empty-vs-null', '{}', '{}', '2026-03-05 00:00:00', null, 0, false);
  insert into "Document" (id, "clientId", "parentId", body, raw) values
    ('d1', 'c1', null, 'root', '\\xdeadbeef'), ('d2', 'c1', 'd1', 'child', null), ('a0', 'c2', 'd2', '', null);
  insert into "Counter" (label) values ('x'), ('y'), ('z');
  insert into legacy (name) values ('one'), ('two');
  insert into nolog values ('m1'), ('m2');
  insert into "_prisma_migrations" values ('init');
`;

test.before(async () => {
  try {
    pg = (await import("pg")).default;
    await withClient(SRC, (c) => c.query("select 1"));
    await withClient(DST, (c) => c.query("select 1"));
  } catch (e) {
    unavailable = `PostgreSQL not reachable at ${BASE.replace(/\/\/[^@]*@/, "//…@")} (${e.code || e.message}) — set MIGRATE_TEST_PG`;
    return;
  }
  await withClient(SRC, async (c) => { await c.query(DDL); await c.query(SEEDSQL); });
  await withClient(DST, async (c) => { await c.query(DDL_NO_SYSTEM); });
});
const pgTest = (name, fn) => test(name, async (t) => { if (unavailable) return t.skip(unavailable); return fn(t); });

pgTest("--dry-run on real Postgres: plan, counts, zero writes", async () => {
  const o = sink();
  assert.equal(await main(["--dry-run"], env(), o), 0, o.text());
  const t = o.text();
  assert.match(t, /Client: مصدر 3 · هدف 0/);
  assert.match(t, /nolog: مصدر 2 · هدف 0 · بلا مفتاح أساسي/);
  assert.match(t, /جداول نظام تُتجاوز: _prisma_migrations/);
  assert.doesNotMatch(t, new RegExp(SENTINEL), "لا قيم في المخرجات");
  assert.doesNotMatch(t, /bp_test:bp_test/, "لا كلمة سر في المخرجات");
  const n = await withClient(DST, async (c) => (await c.query('select count(*)::int n from "Client"')).rows[0].n);
  assert.equal(n, 0);
});

pgTest("full copy: self-referencing rows, jsonb, arrays with awkward elements, bytea, numeric(65,30), identity/serial/generated columns — then a clean verify", async () => {
  const o = sink();
  assert.equal(await main([], env(), o), 0, o.text());
  assert.match(o.text(), /تطابق تام/);
  assert.doesNotMatch(o.text(), new RegExp(SENTINEL));
  await withClient(DST, async (c) => {
    const cl = (await c.query('select * from "Client" order by id')).rows;
    assert.equal(cl.length, 3);
    assert.equal(cl[0]["nameAr"], `شركة ${SENTINEL}`);
    assert.deepEqual(cl[0].meta, { a: [1, { b: "x,y" }], s: 'q"r' });
    assert.deepEqual(cl[0].tags, ["a,b", 'q"r', "{x}", "", "NULL"]);
    assert.equal(cl[0].amount, "12345678901234567890.123456789012345678000000000000", "numeric بلا فقد دقة");
    assert.equal(cl[1].meta, null);
    assert.deepEqual(cl[2].tags, []);
    const d = (await c.query('select id, "parentId", encode(raw, \'hex\') h from "Document" order by id')).rows;
    assert.deepEqual(d.map((r) => r.id), ["a0", "d1", "d2"], "a0 يشير إلى d2 الذي يشير إلى d1: دخلت بترتيب الأب أولاً");
    assert.equal(d.find((r) => r.id === "d1").h, "deadbeef");
    const k = (await c.query("select id, label, doubled from \"Counter\" order by id")).rows;
    assert.deepEqual(k.map((r) => [r.id, r.doubled]), [[1, 2], [2, 4], [3, 6]], "عمود identity (ALWAYS) بمعرّفاته وعمود مولَّد يُحسَب لا يُنسخ");
    const sys = await c.query("select count(*)::int n from \"_prisma_migrations\"");
    assert.equal(sys.rows[0].n, 0, "جداول Prisma النظامية لا تُنسخ");
    // المتتاليات أُعيد ضبطها: الصف التالي لا يصطدم بما نُسخ
    await c.query("insert into legacy (name) values ('three')");
    await c.query('insert into "Counter" (label) values (\'w\')');
    assert.equal((await c.query("select max(id)::int m from legacy")).rows[0].m, 3);
    assert.equal((await c.query('select max(id)::int m from "Counter"')).rows[0].m, 4);
    await c.query("delete from legacy where name='three'");
    await c.query("delete from \"Counter\" where label='w'");
  });
});

pgTest("re-running is harmless (upsert; a no-PK table needs --replace-nopk), and --verify alone is read-only and clean", async () => {
  const o = sink();
  assert.equal(await main(["--replace-nopk"], env(), o), 0, o.text());
  assert.match(o.text(), /nolog: بلا مفتاح أساسي — استُبدل محتوى الهدف/);
  const v = sink();
  assert.equal(await main(["--verify"], env(), v), 0, v.text());
  const counts = await withClient(DST, async (c) => (await c.query('select (select count(*) from "Client")::int a, (select count(*) from "Document")::int b, (select count(*) from nolog)::int n')).rows[0]);
  assert.deepEqual(counts, { a: 3, b: 3, n: 2 });
});

pgTest("a table without a primary key is only copied into an empty target (re-run refuses, it would duplicate)", async () => {
  const o = sink();
  assert.equal(await main(["--tables=nolog"], env(), o), 1, o.text());
  assert.match(o.text(), /بلا مفتاح أساسي والهدف غير فارغ/);
  const n = await withClient(DST, async (c) => (await c.query("select count(*)::int n from nolog")).rows[0].n);
  assert.equal(n, 2, "لم تتكرّر الصفوف");
});

pgTest("verify catches a changed row, says how many, and prints no value — only a short hash of the key", async () => {
  await withClient(DST, (c) => c.query(`update "Client" set "nameAr" = 'TAMPERED' where id = 'c2'`));
  const o = sink();
  assert.equal(await main(["--verify"], env(), o), 1);
  const t = o.text();
  assert.match(t, /Client: مصدر 3 · هدف 3 · content-mismatch · 1 صف مختلف/);
  assert.doesNotMatch(t, /TAMPERED|ثانٍ|c2/);
  assert.match(t, /لا تبدّل DB_DRIVER/);
  // النسخ يُصلحه (upsert)
  assert.equal(await main(["--tables=Client,Document"], env(), sink()), 0);
  assert.equal(await main(["--verify", "--tables=Client,Document"], env(), sink()), 0);
});

pgTest("verify catches a missing row (count mismatch)", async () => {
  await withClient(DST, (c) => c.query(`delete from legacy where id = 2`));
  const o = sink();
  assert.equal(await main(["--verify", "--tables=legacy"], env(), o), 1);
  assert.match(o.text(), /legacy: مصدر 2 · هدف 1 · count-mismatch/);
  assert.equal(await main(["--tables=legacy"], env(), sink()), 0);
});

pgTest("--clean mirrors exactly: a row deleted at the source (and stale extra rows at the target) disappear; upsert alone would keep them", async () => {
  await withClient(SRC, (c) => c.query(`insert into legacy (name) values ('temp-row')`));
  assert.equal(await main(["--tables=legacy"], env(), sink()), 0);
  await withClient(SRC, (c) => c.query(`delete from legacy where name = 'temp-row'`));
  await withClient(DST, (c) => c.query(`insert into legacy (id, name) values (900, 'stale-extra')`));
  const plain = sink();
  assert.equal(await main(["--tables=legacy", "--verify"], env(), plain), 1, "بلا --clean: الفرق باقٍ ويكشفه التحقق");
  const o = sink();
  assert.equal(await main(["--tables=legacy", "--clean"], env(), o), 0, o.text());
  assert.match(o.text(), /--clean: أُفرغ الهدف/);
  const rows = await withClient(DST, async (c) => (await c.query("select name from legacy order by id")).rows.map((r) => r.name));
  assert.deepEqual(rows, ["one", "two"]);
  await withClient(DST, async (c) => { await c.query("insert into legacy (name) values ('after')"); assert.equal((await c.query("select max(id)::int m from legacy")).rows[0].m, 3, "restart identity ثم setval"); await c.query("delete from legacy where name='after'"); });
});

pgTest("a source table that the target lacks stops the run unless --skip-missing", async () => {
  await withClient(DST, (c) => c.query("drop table legacy"));
  const o = sink();
  assert.equal(await main([], env(), o), 1);
  assert.match(o.text(), /legacy.*غير موجودة في الهدف|غير موجودة في الهدف: legacy/);
  const ok = sink();
  assert.equal(await main(["--skip-missing", "--replace-nopk"], env(), ok), 0, ok.text());
  await withClient(DST, (c) => c.query("create table legacy (id serial primary key, name text)"));
  assert.equal(await main(["--tables=legacy"], env(), sink()), 0);
});

pgTest("local file → real Postgres: db/seed.local.json copied into db/schema.sql's tables, counted (no hash across JSON/PG)", async () => {
  await withClient(DST, async (c) => { await c.query("drop schema public cascade; create schema public"); await c.query(fs.readFileSync(SCHEMA, "utf8")); });
  const o = sink();
  // roles يملأها db/schema.sql نفسه بثمانية صفوف فلا يُقارَن عدّه بملف التجربة (صفّان).
  const only = "--tables=organizations,users,organization_members,requests,request_events,tasks";
  const code = await main([`--from-file=${SEED}`, "--skip-missing", only], { AZURE_PG_URL: DST, AZURE_PG_SSL: "0" }, o);
  assert.equal(code, 0, o.text());
  assert.match(o.text(), /مصدر ملف: التحقّق بالعدّ فقط/);
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  await withClient(DST, async (c) => {
    for (const t of ["organizations", "users", "requests", "request_events"]) {
      assert.equal((await c.query(`select count(*)::int n from ${ident(t)}`)).rows[0].n, seed[t].length, t);
    }
    const j = (await c.query("select quote from requests where quote is not null limit 1")).rows;
    if (j.length) assert.equal(typeof j[0].quote, "object", "jsonb عاد كائناً لا نصاً");
  });
  const again = sink();
  assert.equal(await main([`--from-file=${SEED}`, "--skip-missing", only], { AZURE_PG_URL: DST, AZURE_PG_SSL: "0" }, again), 0, "إعادة التشغيل آمنة");
});

test.after(async () => {
  if (unavailable) return;
  for (const url of [SRC, DST]) await withClient(url, (c) => c.query("drop schema if exists public cascade; create schema public")).catch(() => {});
});
