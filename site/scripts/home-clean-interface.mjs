import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("site");
const STYLE = `
<style id="bp-home-clean-interface">
/* Homepage policy: the conversational storefront is the primary and only main interface. */
main > section:not(.hero){display:none!important}
.hero{min-height:calc(100vh - 82px);display:flex;align-items:center;padding:48px 0!important;background:linear-gradient(180deg,#f8faff 0%,#f3f6fc 100%)}
.hero-inner--split{display:block!important;max-width:920px!important;margin-inline:auto!important}
.hero-inner--split .hero-copy,
.hero-inner--split .hero-extra{display:none!important}
.hero-inner--split .hero-start{display:block!important;max-width:920px!important;width:100%!important;margin:0 auto!important;grid-column:auto!important;grid-row:auto!important}
.hero-start{border-radius:24px!important;box-shadow:0 24px 70px rgba(11,27,90,.14)!important}
.cs-wrap{border-radius:24px!important}
.cs-head{padding:30px 32px 18px!important}
.cs-title{font-size:clamp(1.65rem,3vw,2.25rem)!important}
.cs-sub{font-size:1rem!important;max-width:720px}
.cs-chat{padding:22px 28px 28px!important}
.cs-bubble{font-size:1rem!important;max-width:82%!important}
.cs-form{padding:8px!important;border-radius:16px!important}
.cs-input{font-size:1rem!important;padding:13px 12px!important}
.cs-send{width:48px!important;height:48px!important;flex-basis:48px!important}
.cs-chips{padding-top:14px!important;flex-wrap:wrap!important;overflow:visible!important}
.cs-chip{font-size:.84rem!important;padding:8px 13px!important}
.cs-results{max-height:min(48vh,520px)!important}
.cs-card{padding:15px!important}
.cs-name{font-size:1rem!important}
.cs-footer{margin-top:16px!important}
@media(max-width:640px){
  .hero{min-height:calc(100vh - 70px);padding:18px 0 28px!important;align-items:flex-start}
  .hero .container{padding-inline:14px!important}
  .hero-start{border-radius:20px!important}
  .cs-wrap{border-radius:20px!important}
  .cs-head{padding:22px 18px 14px!important}
  .cs-title{font-size:1.55rem!important}
  .cs-sub{font-size:.93rem!important}
  .cs-chat{padding:14px 14px 18px!important}
  .cs-bubble{max-width:95%!important;font-size:.92rem!important}
  .cs-form{position:sticky;bottom:8px;z-index:2}
  .cs-input{font-size:16px!important}
  .cs-chips{flex-wrap:nowrap!important;overflow-x:auto!important}
  .cs-results{max-height:none!important;overflow:visible!important}
  .cs-footer{flex-direction:column;align-items:flex-start!important}
}
</style>`;

for (const rel of ["index.html", "ar/index.html"]) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("bp-home-clean-interface")) {
    html = html.replace("</head>", `${STYLE}</head>`);
  }
  fs.writeFileSync(file, html);
  console.log(`Clean conversational homepage applied: ${rel}`);
}
