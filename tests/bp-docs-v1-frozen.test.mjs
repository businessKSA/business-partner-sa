// The v1 quote / contract templates (api/_docusign.js) must never change.
//
// A signed contract is hashed (SHA-256) and later rebuilt from live data and compared with the
// stored copy; one different byte makes every existing contract "needs_resign". The hashes in
// fixtures/v1-docs-hashes.json were taken from the code BEFORE the v2 templates existed, over
// a set of inputs that covers every language, subscription, portal mode and a signed paper.
// If this test fails, you changed the old paper: put the change in a NEW frozen template (see api/_bp-docs.js, docs/bp-docs-v2.md).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { contractHtml, quoteHtml, portalContractHtml } from "../api/_docusign.js";
import { CONTRACT_CASES, QUOTE_CASES } from "./fixtures/v1-docs-inputs.mjs";

const EXPECTED = JSON.parse(readFileSync(new URL("./fixtures/v1-docs-hashes.json", import.meta.url), "utf8"));
const h = (s) => createHash("sha256").update(s).digest("hex");

for (const [name, input] of Object.entries(CONTRACT_CASES)) {
  test(`v1 contract unchanged byte for byte: ${name}`, () => {
    assert.equal(h(contractHtml(input)), EXPECTED[name]);
  });
}
for (const [name, input] of Object.entries(QUOTE_CASES)) {
  test(`v1 quote unchanged byte for byte: ${name}`, () => {
    assert.equal(h(quoteHtml(input)), EXPECTED[name]);
  });
}
test("v1 portal wrapper unchanged byte for byte", () => {
  assert.equal(h(portalContractHtml(contractHtml(CONTRACT_CASES["contract-en"]))), EXPECTED["portal-wrap-unsigned"]);
});
test("every pinned hash is exercised", () => {
  assert.equal(Object.keys(EXPECTED).length, Object.keys(CONTRACT_CASES).length + Object.keys(QUOTE_CASES).length + 1);
});
test("v1 papers carry no v2 marker", () => {
  for (const input of Object.values(CONTRACT_CASES)) assert.ok(!contractHtml(input).includes("data-bp-doc"));
});
