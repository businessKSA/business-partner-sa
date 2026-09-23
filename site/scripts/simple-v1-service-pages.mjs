// Apply Simple V1 design to all service pages for unified modern look across the site
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}

function classify(rel){
  const clean=rel.replaceAll('\\','/');
  if(/(^|\/)services\/category\/[^/]+\.html$/.test(clean)) return 'service-category';
  if(/(^|\/)services\/[^/]+\.html$/.test(clean) && !clean.endsWith('/services.html')) return 'service-detail';
  return null;
}

let count = 0;
for(const file of walk(ROOT)){
  if(!file.endsWith('.html')) continue;
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const type = classify(rel);
  if(!type) continue;

  let html = fs.readFileSync(file, 'utf8');

  // Skip if already has sv1 styling
  if(html.includes('id="sv1-css"')) continue;

  // Add sv1 class to body
  html = html.replace(/<body([^>]*)>/g, (match) => {
    return match.replace('<body', '<body class="sv1"');
  });

  // Move sv1-css to replace bp-public-v4-css if it exists
  const sv1CssContent = extractSv1Css();

  if(html.includes('id="bp-public-v4-css"')) {
    // Replace old CSS with new
    html = html.replace(/<style id="bp-public-v4-css">[\s\S]*?<\/style>/, sv1CssContent);
  } else if(html.includes('</head>')) {
    // Add SV1 CSS if not present
    html = html.replace('</head>', sv1CssContent + '</head>');
  }

  // Add service-specific overrides
  const overrides = getServiceOverrides(type);
  if(overrides && html.includes('</head>')) {
    html = html.replace('</head>', overrides + '</head>');
  }

  fs.writeFileSync(file, html);
  count++;
}

function extractSv1Css() {
  return `<style id="sv1-css">
/* Simple V1 Service Pages — unified modern design */
.sv1{--n:#0B1B5A;--ac:#0B1B5A;--ac2:#16307F;--acSoft:#EEF2FB;--acLine:#C3CDE6;
 --n2:#081345;--g:#F5F7FB;--l:#E5E9F0;--line:#E5E9F0;--line2:#EBEFF7;
 --t:#232A3D;--ink:#0B1B5A;--s:#5A6478;--mut:#5A6478;--faint:#8D97AE;--soft:#F5F7FB;
 --ok:#047857;--okSoft:#E7F4EF;--warn:#B45309;--wa:#25D366;
 --sh:0 1px 2px rgba(11,27,90,.06);--sh2:0 22px 56px -18px rgba(11,27,90,.22),0 2px 8px rgba(11,27,90,.06);
 --fm:"IBM Plex Mono",ui-monospace,SFMono-Regular,monospace;
 font-family:"IBM Plex Sans Arabic","IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
 color:var(--t);line-height:1.7;background:#fff;display:flex;flex-direction:column;min-height:100vh;
 -webkit-font-smoothing:antialiased}
.sv1 main{flex:1;padding:40px 0}
.sv1 .sv1-mono,.sv1 .en{font-family:var(--fm);font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.sv1 .en{direction:ltr;unicode-bidi:isolate}
.sv1 :focus-visible{outline:2px solid var(--ac);outline-offset:3px;border-radius:5px}
.sv1 *{box-sizing:border-box}
.sv1 a{color:inherit;text-decoration:none}
.sv1 .container{max-width:1160px;margin:auto;padding:0 22px;width:100%}
.sv1 .wrap{max-width:1160px;margin:auto;padding:0 22px;width:100%}

/* Hero section */
.sv1-hero,.svc-hero{background:#fff;padding:40px 0;position:relative;overflow:hidden;border-bottom:1px solid var(--l)}
.sv1-hero h1,.svc-hero h1{font-size:clamp(30px,4.4vw,52px);line-height:1.08;letter-spacing:-.035em;color:var(--ink);max-width:900px;margin:15px 0;font-weight:200}
.sv1-hero p,.svc-hero p{font-size:16px;color:var(--mut);max-width:600px;line-height:1.8}

/* Service content layout */
.sv1 .svc-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;align-items:start;margin-top:20px}
.sv1 .svc-content>section,.sv1 .svc-main>section{background:#fff;border:1px solid var(--l);border-radius:16px;padding:24px;margin-bottom:14px;box-shadow:var(--sh)}
.sv1 .svc-content>section:hover,.sv1 .svc-main>section:hover{border-color:var(--acLine);box-shadow:var(--sh2)}

/* Headings and typography */
.sv1 h2,.sv1 h3{color:var(--ink);margin:0 0 12px;letter-spacing:-.025em;font-weight:300}
.sv1 h2{font-size:22px}
.sv1 h3{font-size:18px;font-weight:500}
.sv1 p,.sv1 li{font-size:15px;line-height:1.8;color:var(--s)}

/* Buttons */
.sv1 .btn,.sv1 button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--l);background:#fff;color:var(--ink);padding:11px 19px;border-radius:9px;font-weight:500;font-size:13.5px;cursor:pointer;line-height:1.2;font-family:inherit;transition:transform .12s ease,background .2s ease,border-color .2s ease}
.sv1 .btn:hover,.sv1 button:hover{border-color:var(--ink)}
.sv1 .btn.primary,.sv1 button.primary{background:var(--ac);border-color:var(--ac);color:#fff;box-shadow:0 6px 18px -6px rgba(11,27,90,.45)}
.sv1 .btn.primary:hover,.sv1 button.primary:hover{background:#16307F;border-color:#16307F;transform:translateY(-1px)}
.sv1 .btn.sm{padding:7px 12px;font-size:12px}

/* Service cards */
.sv1 .service-card,.sv1 [class*="service-card"]{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);transition:.18s ease}
.sv1 .service-card:hover,.sv1 [class*="service-card"]:hover{transform:translateY(-2px);border-color:var(--acLine);box-shadow:var(--sh2)}
.sv1 .service-card h3{font-size:16px;margin:0 0 8px;color:var(--ink)}
.sv1 .service-card p{font-size:13px;color:var(--mut);margin:0}

/* Grid layouts */
.sv1 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.sv1 .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.sv1 .grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}

/* Sidebar sticky order box */
.sv1 .svc-aside{position:sticky;top:92px}
.sv1 .order-box{border:1px solid var(--acLine);border-radius:16px;background:linear-gradient(180deg,#fff,var(--soft));padding:20px;box-shadow:var(--sh2)}
.sv1 .order-box::before{content:'SERVICE REQUEST';display:block;font-size:9px;letter-spacing:.1em;font-weight:900;color:var(--ac);margin-bottom:12px}

/* Responsive */
@media(max-width:900px){
  .sv1 .svc-layout{grid-template-columns:1fr}
  .sv1 .svc-aside{position:static}
  .sv1 .grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}
}

@media(max-width:640px){
  .sv1 main{padding:20px 0}
  .sv1 .svc-hero{padding:24px 0}
  .sv1 .svc-hero h1{font-size:28px}
  .sv1 .grid-2,.sv1 .grid-3{grid-template-columns:1fr}
  .sv1 .svc-content>section,.sv1 .svc-main>section{padding:16px}
}
</style>`;
}

function getServiceOverrides(type) {
  if(type === 'service-detail') {
    return `<style>
/* Service detail page overrides */
.sv1 .breadcrumb{font-size:12px;color:var(--mut);margin:0 0 16px}
.sv1 .svc-meta{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.sv1 .svc-meta .chip{border:1px solid var(--acLine);background:#fff;border-radius:999px;color:var(--ink);font-size:12px;padding:6px 12px}
.sv1 .callout{background:linear-gradient(135deg,var(--acSoft),var(--soft));border:1px solid var(--acLine);border-radius:12px;padding:16px;margin:16px 0}
.sv1 .callout strong::before{content:'💡 '}
</style>`;
  }
  return null;
}

console.log(`simple-v1-service-pages: ${count} service pages updated to SV1 design`);
