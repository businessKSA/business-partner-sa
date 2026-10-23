// The v2 quote / contract / NDA template is FROZEN (api/_bp-docs-v2.js + api/_bp-docs-logo.js).
//
// A v2 contract is stored, hashed (SHA-256) when it is signed and rebuilt later for comparison.
// If the template's output changes by one byte, every signed v2 contract is marked
// «needs_resign» — clients are asked to sign again. So v2 is never edited.
//
//   To change the design, the CSS or the wording of a paper:
//     1. cp api/_bp-docs-v2.js api/_bp-docs-v3.js   and change the COPY;
//     2. register it in api/_bp-docs.js (TEMPLATES) and point CURRENT_TEMPLATE at "v3";
//     3. add tests/fixtures/v3-docs-* and a freeze test for v3 like this one.
//   New documents then take v3; documents stored as v2 keep rebuilding with the untouched v2 file.
//
// The output hashes were taken the day v2 was frozen (inputs are literal, including the company
// snapshot, so nothing but the template can change them). The source hashes pin the files too.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import * as V2 from "../api/_bp-docs-v2.js";
import { templateForVersion, templateForLang, defaultTemplateVersion, finalizeBpDoc, versionOfHtml, CURRENT_TEMPLATE } from "../api/_bp-docs.js";
import { portalContractHtml } from "../api/_docusign.js";
import { QUOTE_CASES, CONTRACT_CASES, NDA_CASES, SIG, COMPANY } from "./fixtures/v2-docs-inputs.mjs";

const OUT = JSON.parse(readFileSync(new URL("./fixtures/v2-docs-hashes.json", import.meta.url), "utf8"));
const SRC = JSON.parse(readFileSync(new URL("./fixtures/v2-docs-source-hashes.json", import.meta.url), "utf8"));
const h = (s) => createHash("sha256").update(s).digest("hex");
const RULE = "\n\nTemplate v2 is FROZEN: a changed byte marks every signed v2 contract «needs_resign».\n" +
  "Do NOT edit api/_bp-docs-v2.js / api/_bp-docs-logo.js and do NOT update the fixtures to make this pass.\n" +
  "Make the change in a NEW template: copy to api/_bp-docs-v3.js, register it in api/_bp-docs.js (templateForVersion),\n" +
  "and add a v3 freeze test. See docs/bp-docs-v2.md, section «The freeze rule».";
const same = (actual, expected, what) => assert.equal(actual, expected, `${what} changed.${RULE}`);

const tpl = templateForVersion("v2");

for (const [name, input] of Object.entries(QUOTE_CASES)) {
  test(`v2 quote unchanged byte for byte: ${name}`, () => {
    same(h(tpl.quote(input)), OUT[name], name);
    same(h(V2.quoteDocV2(input)), OUT[name], name + " (direct)");
  });
}
for (const [name, input] of Object.entries(CONTRACT_CASES)) {
  test(`v2 contract unchanged byte for byte: ${name}`, () => {
    same(h(tpl.contract(input)), OUT[name], name);
    same(h(V2.contractDocV2(input)), OUT[name], name + " (direct)");
  });
}
for (const [name, input] of Object.entries(NDA_CASES)) {
  test(`v2 NDA unchanged byte for byte: ${name}`, () => {
    same(h(tpl.nda(input)), OUT[name], name);
  });
}
test("v2 what a person reads (portal view, unsigned and signed) unchanged byte for byte", () => {
  const c = tpl.contract(CONTRACT_CASES["contract-default"]);
  same(h(portalContractHtml(c)), OUT["contract-portal-unsigned"], "contract portal view");
  same(h(portalContractHtml(c, { signature: SIG, signedAt: SIG.at })), OUT["contract-portal-signed"], "signed contract portal view");
  same(h(portalContractHtml(tpl.nda(NDA_CASES["nda-default"]), { signature: SIG, signedAt: SIG.at })), OUT["nda-portal-signed"], "signed NDA portal view");
});
test("every pinned output hash is exercised", () => {
  const n = Object.keys(QUOTE_CASES).length + Object.keys(CONTRACT_CASES).length + Object.keys(NDA_CASES).length + 3;
  assert.equal(Object.keys(OUT).length, n);
});

test("v2 source files are byte-identical to the frozen ones", () => {
  for (const f of ["api/_bp-docs-v2.js", "api/_bp-docs-logo.js"]) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    same(h(src), SRC[f], f);
  }
});

test("a signed v2 contract rebuilds identically from its stored snapshot, whatever the live company data says", () => {
  const stored = tpl.contract(CONTRACT_CASES["contract-default"]);
  const prev = { cr: process.env.COMPANY_CR_NUMBER, d: process.env.COMPANY_CR_DATE, p: process.env.COMPANY_SIGNER_NAME_EN };
  process.env.COMPANY_CR_NUMBER = "1234567890"; process.env.COMPANY_CR_DATE = "01/01/2030"; process.env.COMPANY_SIGNER_NAME_EN = "Someone Else";
  try {
    const rebuilt = templateForVersion("v2").contract({ ...CONTRACT_CASES["contract-default"], company: JSON.parse(JSON.stringify(COMPANY)) });
    assert.equal(rebuilt, stored);
  } finally {
    for (const [k, v] of [["COMPANY_CR_NUMBER", prev.cr], ["COMPANY_CR_DATE", prev.d], ["COMPANY_SIGNER_NAME_EN", prev.p]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ── the version door ──
test("templateForVersion: a stored version names its own frozen template; v1/absent/unknown → null (the original paper)", () => {
  assert.equal(templateForVersion("v2").version, "v2");
  for (const v of [undefined, null, "", "v1", "v9", "V2", "constructor", "__proto__", "toString", 2, {}]) assert.equal(templateForVersion(v), null, String(v));
  assert.ok(Object.isFrozen(templateForVersion("v2")), "the registry entry cannot be swapped at run time");
});
test("new documents take CURRENT_TEMPLATE; the kill switch and other languages fall back to v1", () => {
  const prev = process.env.BP_DOCS_TEMPLATE;
  try {
    delete process.env.BP_DOCS_TEMPLATE;
    assert.equal(defaultTemplateVersion(), CURRENT_TEMPLATE);
    assert.ok(templateForVersion(templateForLang("ar")), "the current template is registered");
    assert.equal(templateForLang("fr"), "v1");
    process.env.BP_DOCS_TEMPLATE = "v1";
    assert.equal(templateForLang("en"), "v1");
  } finally { if (prev === undefined) delete process.env.BP_DOCS_TEMPLATE; else process.env.BP_DOCS_TEMPLATE = prev; }
});
test("a paper names its own template; finalize dispatches by that marker and leaves v1 untouched", () => {
  const c = tpl.contract(CONTRACT_CASES["contract-default"]);
  assert.equal(versionOfHtml(c), "v2");
  assert.equal(versionOfHtml("<html><body>old</body></html>"), "v1");
  assert.equal(finalizeBpDoc("<html><body>old</body></html>"), "<html><body>old</body></html>");
  assert.equal(finalizeBpDoc(c), tpl.finalize(c));
});

// ── nobody goes around the door ──
test("only api/_bp-docs.js imports a frozen template file; callers cannot pin themselves to a template directly", () => {
  const importers = [];
  for (const f of readdirSync(new URL("../api/", import.meta.url)).filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(new URL("../api/" + f, import.meta.url), "utf8");
    if (/from\s+["']\.\/_bp-docs-v\d+\.js["']/.test(src)) importers.push(f);
  }
  assert.deepEqual(importers, ["_bp-docs.js"]);
});
test("the frozen module has no clock, randomness or network", () => {
  const src = readFileSync(new URL("../api/_bp-docs-v2.js", import.meta.url), "utf8");
  assert.ok(!/Date\.now\(|new Date\(\)|Math\.random|fetch\(|toLocaleDateString|Intl\./.test(src));
});
