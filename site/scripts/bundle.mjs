// Bundle the whole site into ONE self-contained HTML file with a tiny hash
// router, inlined CSS, and the logo as a data URI. Opens by double-click, no
// server. Output: dist-portable/business-partner-onefile.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, "..");
const OUT = path.resolve(SITE, "..", "business-partner-onefile.html");

const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");

// Route map: file -> route path
const routes = [
  ["index.html", "/"],
  ["about.html", "/about"],
  ["services.html", "/services"],
  ["ai-agents.html", "/ai-agents"],
  ["tourism.html", "/tourism"],
  ["packages.html", "/packages"],
  ["calculator.html", "/calculator"],
  ["saudi-arabia.html", "/saudi-arabia"],
  ["news.html", "/news"],
  ["careers.html", "/careers"],
  ["contact.html", "/contact"],
];
for (const f of fs.readdirSync(path.join(SITE, "services"))) {
  if (f.endsWith(".html")) routes.push([`services/${f}`, `/services/${f.replace(/\.html$/, "")}`]);
}

// Rewrite internal absolute links to hash-router links. Keeps external (http),
// in-page anchors (#foo), and tel:/mailto:.
function rewriteLinks(html) {
  return html
    .replace(/href="\/"/g, 'href="#/"')
    .replace(/href="\/(assets\/[^"]*)"/g, 'href="$1"') // leave asset refs (we inline what matters)
    .replace(/href="\/([a-z][a-z0-9-]*(?:\/[a-z0-9-]+)?)((?:\?|#)[^"]*)?"/g, 'href="#/$1$2"');
}

// Extract the <main>…</main> body from a generated page.
function extractMain(html) {
  const m = html.match(/<main>([\s\S]*)<\/main>/);
  let body = m ? m[1] : html;
  body = body.replace(/<script[\s\S]*?<\/script>/g, ""); // scripts handled by router
  return rewriteLinks(body);
}

// Build the routes object (path -> {title, html})
const pages = {};
for (const [file, route] of routes) {
  const raw = read(file);
  const title = (raw.match(/<title>([^<]*)<\/title>/) || [])[1] || "Business Partner";
  pages[route] = { title, html: extractMain(raw) };
}

// Shell (header/footer/fab) from index.html, links rewritten, logo inlined.
const index = read("index.html");
const logoB64 = fs.readFileSync(path.join(SITE, "assets/img/logo.png")).toString("base64");
const logoData = `data:image/png;base64,${logoB64}`;
let header = (index.match(/<header[\s\S]*?<\/header>/) || [""])[0];
let footer = (index.match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
let fab = (index.match(/<a class="wa-fab"[\s\S]*?<\/a>/) || [""])[0];
header = rewriteLinks(header).replace(/src="\/assets\/img\/logo\.png"/g, `src="${logoData}"`);
footer = rewriteLinks(footer).replace(/src="\/assets\/img\/logo\.png"/g, `src="${logoData}"`);

const css = read("assets/css/styles.css");

// Calculator dataset (mirror of what the calculator page injects)
const services = JSON.parse(read("data/services.json"));
const overrides = JSON.parse(read("data/site.json")).overrides || {};
const mini = services.map((s) => {
  const ov = overrides[s.slug];
  const price = ov && ov.priceLabel ? { amount: ov.priceAmount ?? null, label: ov.priceLabel } : { amount: s.price.amount, label: s.price.label };
  return { code: s.code, name: (ov && ov.name) || s.name, categoryAr: s.categoryAr, govFeesSeparate: s.govFeesSeparate, price };
});

const router = `
(function(){
  var PAGES = __PAGES__;
  var SERVICES = __SERVICES__;
  var app = document.getElementById('app');
  var navToggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (navToggle && nav) navToggle.addEventListener('click', function(){ nav.classList.toggle('open'); });
  // FAQ accordion (delegated)
  document.addEventListener('click', function(e){
    var q = e.target.closest && e.target.closest('.faq-q'); if(!q) return;
    q.closest('.faq-item').classList.toggle('open');
  });
  function money(n){ return n.toLocaleString('en-US',{maximumFractionDigits:2}) + ' ﷼'; }
  function initCalc(query){
    var root = document.getElementById('calc'); if(!root) return;
    var sel = document.getElementById('calc-service'), qty = document.getElementById('calc-qty');
    var byCat = {}; SERVICES.forEach(function(s){ (byCat[s.categoryAr]=byCat[s.categoryAr]||[]).push(s); });
    Object.keys(byCat).forEach(function(cat){ var og=document.createElement('optgroup'); og.label=cat;
      byCat[cat].forEach(function(s){ var o=document.createElement('option'); o.value=s.code; o.textContent=s.name; og.appendChild(o); }); sel.appendChild(og); });
    var elFee=document.getElementById('calc-fee'), elVat=document.getElementById('calc-vat'), elTotal=document.getElementById('calc-total'),
        elNote=document.getElementById('calc-extra-note'), elGov=document.getElementById('calc-gov');
    function upd(){ var s=SERVICES.find(function(x){return x.code===sel.value;}); if(!s)return;
      var q=Math.max(1,parseInt(qty.value,10)||1), a=s.price.amount;
      if(a==null){ elFee.textContent='—'; elVat.textContent='—'; elTotal.textContent=s.price.label; elNote.textContent='تُسعّر بعرض مخصّص حسب حالتك.'; elGov.style.display='none'; }
      else { var fee=a*q, vat=fee*0.15; elFee.textContent=money(fee); elVat.textContent=money(vat); elTotal.textContent=money(fee+vat);
        elNote.textContent=q>1?'الأتعاب مضروبة في العدد المطلوب.':''; elGov.style.display=s.govFeesSeparate?'flex':'none'; } }
    sel.addEventListener('change',upd); qty.addEventListener('input',upd);
    if(query){ var m=/service=([^&]+)/.exec(query); if(m){ var v=decodeURIComponent(m[1]); if(SERVICES.some(function(x){return x.code===v;})) sel.value=v; } }
    upd();
  }
  function render(){
    var h = location.hash || '#/';
    if (h.charAt(1) !== '/') { // in-page anchor, just scroll
      var el = document.getElementById(h.slice(1)); if(el) el.scrollIntoView(); return;
    }
    var rest = h.slice(1); // "/path" or "/path?q" or "/path#anchor"
    var anchor = '', query = '';
    var hi = rest.indexOf('#'); if(hi>=0){ anchor=rest.slice(hi+1); rest=rest.slice(0,hi); }
    var qi = rest.indexOf('?'); if(qi>=0){ query=rest.slice(qi+1); rest=rest.slice(0,qi); }
    var page = PAGES[rest] || PAGES['/'];
    document.title = page.title;
    app.innerHTML = page.html;
    if(nav) nav.classList.remove('open');
    // active nav
    document.querySelectorAll('.nav a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('href')==='#'+rest); });
    if(rest==='/calculator') initCalc(query);
    if(anchor){ var t=document.getElementById(anchor); if(t) setTimeout(function(){t.scrollIntoView();},50); }
    else window.scrollTo(0,0);
  }
  window.addEventListener('hashchange', render);
  render();
})();`;

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Business Partner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
${header}
<main id="app"></main>
${footer}
${fab}
<script>${router
  .replace("__PAGES__", JSON.stringify(pages))
  .replace("__SERVICES__", JSON.stringify(mini))}</script>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`One-file bundle: ${OUT} (${(html.length / 1024 / 1024).toFixed(2)} MB, ${Object.keys(pages).length} pages)`);
