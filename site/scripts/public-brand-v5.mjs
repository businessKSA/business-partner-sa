import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('site');
const include=[
  '/services','/packages','/b10x','/compliance-agent','/ai-document-agent','/shared-services','/workspaces','/worker-housing','/revenue-os','/about','/consultation','/task-force','/data','/deals','/tourism','/farina'
];
const skip=['/account','/portal','/checkout','/cart','/admin','/suppliers','/agency-portal','/revenue-dashboard','/hr'];

const css=String.raw`<style id="bp-public-brand-v5-css">
body.bp-public-brand-v5{--bp-navy:#07163f;--bp-blue:#3159d8;--bp-cyan:#43d6f4;--bp-mint:#16b875;--bp-ink:#111b36;--bp-muted:#6b7690;--bp-line:#e4e9f2;--bp-soft:#f7f9fd;background:#fff;color:var(--bp-ink)}
body.bp-public-brand-v5 .site-header{background:rgba(255,255,255,.96)!important;border-bottom:1px solid #e8ecf3!important;backdrop-filter:blur(16px)}
body.bp-public-brand-v5 .site-header .logo img{max-height:32px!important;width:auto!important}
body.bp-public-brand-v5 main>.hero,body.bp-public-brand-v5 .svc-hero,body.bp-public-brand-v5 .cat-hero,body.bp-public-brand-v5 .page-hero{background:radial-gradient(circle at 84% 4%,rgba(49,89,216,.10),transparent 24%),radial-gradient(circle at 12% 2%,rgba(67,214,244,.08),transparent 20%),#fff!important;border-bottom:1px solid #edf0f5!important}
body.bp-public-brand-v5 main>.hero,body.bp-public-brand-v5 .page-hero{padding-top:64px!important;padding-bottom:52px!important}
body.bp-public-brand-v5 main>.hero h1,body.bp-public-brand-v5 .svc-hero h1,body.bp-public-brand-v5 .cat-hero h1,body.bp-public-brand-v5 .page-hero h1{color:var(--bp-navy)!important;letter-spacing:-.045em!important;line-height:1.06!important}
body.bp-public-brand-v5 main>.hero .lead,body.bp-public-brand-v5 main>.hero p,body.bp-public-brand-v5 .svc-hero p,body.bp-public-brand-v5 .cat-hero p,body.bp-public-brand-v5 .page-hero p{color:var(--bp-muted)!important;line-height:1.8!important}
body.bp-public-brand-v5 .eyebrow{display:inline-flex!important;padding:6px 9px!important;border:1px solid #dfe6f3!important;border-radius:999px!important;background:#f8faff!important;color:#3156ad!important;font-size:.68rem!important;font-weight:850!important}
body.bp-public-brand-v5 .btn-primary,body.bp-public-brand-v5 .btn.btn-primary{background:linear-gradient(135deg,var(--bp-navy),var(--bp-blue))!important;border-color:transparent!important;box-shadow:0 11px 28px rgba(36,75,184,.16)!important}
body.bp-public-brand-v5 .btn,body.bp-public-brand-v5 button,body.bp-public-brand-v5 .order-box,body.bp-public-brand-v5 .card,body.bp-public-brand-v5 .service-card,body.bp-public-brand-v5 .pkg-card,body.bp-public-brand-v5 .panel{border-radius:16px}
body.bp-public-brand-v5 .card,body.bp-public-brand-v5 .service-card,body.bp-public-brand-v5 .pkg-card,body.bp-public-brand-v5 .panel,body.bp-public-brand-v5 .order-box{border-color:var(--bp-line)!important;box-shadow:0 8px 28px rgba(10,29,80,.045)!important}
body.bp-public-brand-v5 .card:hover,body.bp-public-brand-v5 .service-card:hover,body.bp-public-brand-v5 .pkg-card:hover{box-shadow:0 14px 36px rgba(10,29,80,.08)!important}
body.bp-public-brand-v5 .svc-main,body.bp-public-brand-v5 .svc-layout{gap:24px!important}
body.bp-public-brand-v5 .svc-body,body.bp-public-brand-v5 .svc-content{line-height:1.85!important;color:#3c4964!important}
body.bp-public-brand-v5 .svc-body h2,body.bp-public-brand-v5 .svc-body h3,body.bp-public-brand-v5 .svc-content h2,body.bp-public-brand-v5 .svc-content h3{color:var(--bp-navy)!important}
body.bp-public-brand-v5 .svc-aside .order-box{position:sticky;top:92px;background:linear-gradient(180deg,#fff,#f8faff)!important}
body.bp-public-brand-v5 .site-footer{background:#07143b!important;color:rgba(255,255,255,.7)!important}
body.bp-public-brand-v5 .site-footer a{color:rgba(255,255,255,.72)!important}
body.bp-public-brand-v5 .wa-fab{display:none!important}
@media(max-width:760px){body.bp-public-brand-v5 main>.hero,body.bp-public-brand-v5 .page-hero{padding-top:42px!important;padding-bottom:34px!important}body.bp-public-brand-v5 .svc-aside .order-box{position:static}}
</style>`;

function walk(dir,out=[]){for(const n of fs.readdirSync(dir)){const p=path.join(dir,n);const s=fs.statSync(p);if(s.isDirectory())walk(p,out);else if(n.endsWith('.html'))out.push(p)}return out}
for(const file of walk(ROOT)){
  let rel='/'+path.relative(ROOT,file).replaceAll(path.sep,'/').replace(/index\.html$/,'').replace(/\.html$/,'').replace(/\/$/,'');
  rel=rel.replace(/^\/ar(?=\/|$)/,'').replace(/^\/en(?=\/|$)/,'').replace(/^\/fr(?=\/|$)/,'').replace(/^\/zh(?=\/|$)/,'')||'/';
  if(skip.some(x=>rel.startsWith(x)))continue;
  if(!include.some(x=>rel.startsWith(x)))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<style id="bp-public-brand-v5-css">[\s\S]*?<\/style>/g,'');
  html=html.replace(/<body(?![^>]*bp-public-brand-v5)([^>]*)>/,m=>m.replace('<body','<body class="bp-public-brand-v5"'));
  if(/<body[^>]*class="[^"]*"/.test(html)&&!html.includes('class="bp-public-brand-v5"')) html=html.replace(/<body([^>]*?)class="([^"]*)"/, '<body$1class="bp-public-brand-v5 $2"');
  html=html.replace('</head>',css+'\n</head>');
  fs.writeFileSync(file,html);
}
console.log('Public brand v5 applied');
