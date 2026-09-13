import fs from 'node:fs';
import path from 'node:path';

// Owner decision 2026-09-13:
// Public advisor stays anonymous. The customer reviews the scope first, then
// "Create quotation" takes them to the client portal to sign in/register.
// Contact fields + OTP must not sit under the public chat.
//
// We patch the generated Simple V1 pages after all other public-page transforms
// so this behaviour cannot be overwritten by a later build step.

const ROOT = path.resolve('site');
const pages = [
  { file: 'index.html', lang: 'en', portal: '/my', home: '/' },
  { file: 'ar/index.html', lang: 'ar', portal: '/ar/my', home: '/ar/' },
  { file: 'fr/index.html', lang: 'fr', portal: '/fr/my', home: '/fr/' },
  { file: 'zh/index.html', lang: 'zh', portal: '/zh/my', home: '/zh/' },
  { file: 'simple-v1.html', lang: 'en', portal: '/my', home: '/' },
  { file: 'ar/simple-v1.html', lang: 'ar', portal: '/ar/my', home: '/ar/' },
  { file: 'fr/simple-v1.html', lang: 'fr', portal: '/fr/my', home: '/fr/' },
  { file: 'zh/simple-v1.html', lang: 'zh', portal: '/zh/my', home: '/zh/' },
];

const labels = {
  ar: { empty: 'راجع نطاق الخدمات أولاً قبل إنشاء عرض السعر.', creating: 'جاري إنشاء الطلب…', error: 'تعذّر إنشاء الطلب. حاول مرة أخرى.' },
  en: { empty: 'Review the scope before creating the quotation.', creating: 'Creating your request…', error: 'Could not create the request. Please try again.' },
  fr: { empty: 'Vérifiez le périmètre avant de créer le devis.', creating: 'Création de votre demande…', error: 'Impossible de créer la demande. Réessayez.' },
  zh: { empty: '请先检查服务范围，再创建报价。', creating: '正在创建申请…', error: '无法创建申请，请重试。' },
};

function injection(cfg) {
  const l = labels[cfg.lang];
  return `\n<style id="sv1-portal-auth-flow-css">\n/* Authentication belongs in the client portal, never under the public advisor. */\n#sv1Login{display:none!important}\n</style>\n<script id="sv1-portal-auth-flow">\n(function(){\n  var PORTAL=${JSON.stringify(cfg.portal)}, HOME=${JSON.stringify(cfg.home)}, LANG=${JSON.stringify(cfg.lang)};\n  var TYPE={consulting:'CONSULTATION',government:'GOVERNMENT_SERVICE',formation:'COMPANY_FORMATION'};\n  var LABELS=${JSON.stringify(l)};\n  function draft(){try{return JSON.parse(sessionStorage.getItem('sv1_chat')||'null')}catch(e){return null}}\n  function accountUrl(){\n    // The portal already supports ?next= and returns the signed-in customer to it.\n    var resume=HOME+'?resume=quote#advisor';\n    return PORTAL+'?next='+encodeURIComponent(resume);\n  }\n  function createFromDraft(btn){\n    var d=draft();\n    if(!d||!Array.isArray(d.items)||!d.items.length){alert(LABELS.empty);return}\n    var original=btn.textContent; btn.disabled=true; btn.textContent=LABELS.creating;\n    var sess=window.SV1_SESSION&&window.SV1_SESSION.user||{};\n    fetch('/api/simple',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({\n      action:'request-create',type:TYPE[d.ctx]||'CONSULTATION',source:'WEBSITE',lang:LANG,\n      title:d.title||'',summary:d.summary||'',scope:d.items||[],documents:d.docs||[],conversation:d.history||[],\n      name:sess.full_name||'',phone:sess.phone||''\n    })}).then(function(r){return r.json()}).then(function(o){\n      if(!o||!o.ok)throw new Error((o&&o.message)||'request_failed');\n      try{sessionStorage.removeItem('sv1_chat');sessionStorage.removeItem('sv1_resume_quote')}catch(e){}\n      location.href=PORTAL+'?ref='+encodeURIComponent(o.ref);\n    }).catch(function(){btn.disabled=false;btn.textContent=original;alert(LABELS.error)});\n  }\n\n  // Capture before the legacy inline onclick. Guests are sent to the portal;\n  // signed-in users create the request directly and then open it in the portal.\n  document.addEventListener('click',function(e){\n    var btn=e.target&&e.target.closest&&e.target.closest('#sv1Create');\n    if(!btn)return;\n    e.preventDefault();e.stopImmediatePropagation();\n    var d=draft();\n    if(!d||!Array.isArray(d.items)||!d.items.length){alert(LABELS.empty);return}\n    if(window.SV1_SESSION&&window.SV1_SESSION.user){createFromDraft(btn);return}\n    try{sessionStorage.setItem('sv1_resume_quote','1')}catch(_){}\n    location.href=accountUrl();\n  },true);\n\n  // After portal authentication, ?next= returns here. Finish the action the\n  // customer already asked for instead of making them click "Create quote" twice.\n  if(new URL(location.href).searchParams.get('resume')==='quote' && sessionStorage.getItem('sv1_resume_quote')==='1'){\n    var tries=0,t=setInterval(function(){\n      tries++;\n      if(window.SV1_SESSION&&window.SV1_SESSION.user){\n        clearInterval(t);\n        try{history.replaceState({},'',HOME+'#advisor')}catch(_){}\n        var b=document.getElementById('sv1Create');if(b)createFromDraft(b);\n      } else if(tries>40){clearInterval(t);location.href=accountUrl()}\n    },250);\n  }\n})();\n</script>\n`;
}

let changed=0;
for (const cfg of pages) {
  const file=path.join(ROOT,cfg.file);
  if(!fs.existsSync(file)) continue;
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('id="sv1Create"')) continue;
  html=html.replace(/\n<style id="sv1-portal-auth-flow-css">[\s\S]*?<\/script>\n?/g,'');
  html=html.replace('</body>',injection(cfg)+'</body>');
  fs.writeFileSync(file,html);
  changed++;
}

// A successful OTP / password / Google response sets an httpOnly session
// cookie. Calling /api/simple immediately in the same JS turn proved racy in
// production: /api/otp returned 200, then /api/simple could still see no
// session and answer 401. Force one same-origin navigation after auth so the
// browser commits Set-Cookie before the portal boot request. location.href
// preserves ?next=, so the quotation-resume flow continues automatically.
const portalPages = ['my.html', 'ar/my.html', 'fr/my.html', 'zh/my.html'];
let portalChanged = 0;
for (const rel of portalPages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(
    /try\{localStorage\.setItem\('bp_session','1'\)\}catch\(x\)\{\}boot\(\)/g,
    "try{localStorage.setItem('bp_session','1')}catch(x){}location.replace(location.href)"
  );
  if (html !== before) {
    fs.writeFileSync(file, html);
    portalChanged++;
  }
}

console.log(`sv1-quote-auth-flow: ${changed} public pages patched; ${portalChanged} portal pages patched`);
