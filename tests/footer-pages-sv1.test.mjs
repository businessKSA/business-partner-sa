// حارس صفحات التذييل (/ai-agents · /packages) على قالب SV1: وكيل footer-pages.
// يبني الصفحتين من الوحدة مباشرة (ترويسة مُخرِجة بسيطة) فلا يعتمد على توليد الموقع،
// ثم يفحص ما وعدت به: SV1 كامل، لا main.js ولا الموقع القديم، وعقد bp_cart.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simpleV1 } from "../site/scripts/simple-v1.mjs";
import { buildSimpleAiAgents, buildSimplePackages } from "../site/scripts/simple-v1-footer-pages.mjs";

const read = (f) => JSON.parse(readFileSync(new URL("../site/data/" + f, import.meta.url), "utf8"));
const site = read("site.json");
const services = read("services.json");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function pages(lang) {
  const ctx0 = { lang: () => lang, esc, site, pathInLang: (p, l) => (l === "en" ? p : "/" + l + p),
    head: () => `<!DOCTYPE html><html lang="${lang}"><head></head><body>` };
  const SV1 = simpleV1(ctx0);
  const ctx = { lang: () => lang, esc, localizeLabel: (l) => l, pageVisible: () => true, services, site,
    pkgCode: (t) => String(t.code || `PKG-${String(t.key || "").toUpperCase()}`).toUpperCase(),
    employerYearly: (m, d) => Math.round((Number(m) * 12 * (1 - d)) / 10) * 10,
    portalQuoteUrl: (c) => "/portal/services?code=" + c };
  return { agents: buildSimpleAiAgents(SV1, ctx), packages: buildSimplePackages(SV1, ctx) };
}

for (const lang of ["ar", "en"]) {
  const { agents, packages } = pages(lang);
  for (const [name, html] of [["ai-agents", agents], ["packages", packages]]) {
    test(`${name} (${lang}): SV1 كامل بلا main.js ولا الموقع القديم`, () => {
      assert.match(html, /<body class="sv1-page">/);
      assert.ok(!/assets\/js\/main\.js/.test(html.replace(/<script>[\s\S]*?<\/script>/g, "")));
      assert.ok(!/bp-public-brand-v5/.test(html));
      assert.ok(!/href="[^"]*\/(account|admin|hr\/employer)[?"/]/.test(html), "رابط للموقع القديم");
      assert.ok(!/wa\.me/.test(html.replace(/<footer[\s\S]*$/, "")), "زرّ واتساب داخل المحتوى");
    });
  }

  test(`ai-agents (${lang}): الشراء يضيف بعقد bp_cart ولا مسار للقديم`, () => {
    assert.match(agents, /class="sv1-btn primary fp-add"[^>]*data-id="agent-Compliance-Agent"[^>]*data-kind="agent"/);
    assert.match(agents, /localStorage\.setItem\('bp_cart'/);
    assert.match(agents, /billingPeriod:'',renewsAt:null,commissionPercent:0/);
    assert.ok(!/#bp-consultant/.test(agents), "المرساة القديمة غير موجودة في الرئيسية الجديدة");
  });

  test(`packages (${lang}): كل بند له زرّ سلة أو استشارة، والسنوي يُشتقّ للشهري`, () => {
    const tiers = site.packages.groups.flatMap((g) => g.tiers);
    const cards = packages.split('<article class="fp-card"').length - 1;
    assert.equal(cards, tiers.length);
    assert.match(packages, /data-id-y="pkg-starter-4-yearly"/);
    assert.match(packages, /data-amount-y="21000"/);
  });
}
