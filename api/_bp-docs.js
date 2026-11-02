// Business Partner — which paper a document is printed with (template versions).
//
// The generators are frozen per version: api/_bp-docs-v2.js (and later _bp-docs-v3.js …) never
// change once a document has been issued with them. This file is the only door to them:
//
//   templateForVersion("v2")  → { version, quote, contract, nda, finalize, companySnapshot }
//   templateForVersion("v1")  → null: the original paper lives in api/_docusign.js (also frozen)
//
// A stored `template_version` decides how a document is (re)built — never "the newest template".
// A document without one is v1 for ever. To change a paper: add a new frozen file, register it
// in TEMPLATES, point CURRENT_TEMPLATE at it. Existing contracts keep rebuilding with the file
// they were issued with, so a signature is never invalidated by a design or wording change.
// See docs/bp-docs-v2.md ("The freeze rule").
import * as V2 from "./_bp-docs-v2.js";
import * as V3 from "./_bp-docs-v3.js";

export const TEMPLATE_V1 = "v1";
/** The template NEW contracts and NDAs are issued with. Changing it never touches a stored document. */
export const CURRENT_TEMPLATE = "v2";
/**
 * The template NEW quotations are issued with (owner decision 2026-10-29: every document that goes to a
 * client is built from the sales team's approved templates). v3 is the QUOTATION only — the contract and
 * the NDA stay on v2 until their own templates are ported (a v3 entry has no `contract` / `nda`).
 */
export const CURRENT_QUOTE_TEMPLATE = "v3";

const TEMPLATES = {
  v2: {
    version: "v2",
    quote: V2.quoteDocV2,
    contract: V2.contractDocV2,
    nda: V2.ndaDocV2,
    finalize: V2.finalizeBpDoc,
    companySnapshot: V2.companySnapshot,
  },
  v3: {
    version: "v3",
    quote: V3.quoteDocV3,
    finalize: V3.finalizeBpDocV3,
    companySnapshot: V3.companySnapshotV3,
  },
};
for (const t of Object.values(TEMPLATES)) Object.freeze(t);
Object.freeze(TEMPLATES);

/** The frozen template a stored version names, or null (v1, absent, unknown → the original paper). */
export const templateForVersion = (v) => (typeof v === "string" && Object.prototype.hasOwnProperty.call(TEMPLATES, v) ? TEMPLATES[v] : null);

const env = (k) => String(process.env[k] || "").trim();
/** The version a NEW document is issued with. BP_DOCS_TEMPLATE=v1 is the kill switch. */
export const defaultTemplateVersion = () => (/^v1$/i.test(env("BP_DOCS_TEMPLATE")) ? TEMPLATE_V1 : CURRENT_TEMPLATE);
/** Templates are Arabic + English only; a client who reads French or Chinese keeps the v1 paper. */
export const templateForLang = (lang) => (["ar", "en", ""].includes(String(lang || "")) ? defaultTemplateVersion() : TEMPLATE_V1);
/**
 * The version a NEW quotation is issued with. BP_DOCS_TEMPLATE=v1 (the kill switch of every paper) still wins;
 * BP_DOCS_QUOTE_TEMPLATE=v2 keeps issuing the previous quotation paper only. A client who reads French or
 * Chinese keeps the v1 paper (the templates are Arabic + English).
 */
export const templateForQuoteLang = (lang) => {
  if (!["ar", "en", ""].includes(String(lang || ""))) return TEMPLATE_V1;
  if (/^v1$/i.test(env("BP_DOCS_TEMPLATE"))) return TEMPLATE_V1;
  return /^v2$/i.test(env("BP_DOCS_QUOTE_TEMPLATE")) ? "v2" : CURRENT_QUOTE_TEMPLATE;
};

/** Which template a printed paper was made with, read from its own marker ("v1" when it has none). */
export const versionOfHtml = (html) => {
  const m = typeof html === "string" ? html.match(/<html[^>]*\sdata-bp-doc="(v\d+)"/) : null;
  return m ? m[1] : TEMPLATE_V1;
};
export const isBpDoc = (html) => versionOfHtml(html) !== TEMPLATE_V1;

/**
 * Makes a stored paper ready to be read (hides company-side signing anchors, adds the print
 * button). Dispatches by the paper's own marker; anything that is not a frozen-template paper
 * (v1) is returned untouched, byte for byte.
 */
export function finalizeBpDoc(html) {
  const t = templateForVersion(versionOfHtml(html));
  return t ? t.finalize(html) : html;
}
