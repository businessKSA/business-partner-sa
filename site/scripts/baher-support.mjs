// باهر — حاقن ودجت الدعم العائم في كل صفحات الموقع (Simple V1 + الكلاسيكية).
// دعم فقط: يلتقط اسم/جوال الزائر مرة، يحاور عبر /api/chat (Azure OpenAI)،
// ويسجّل كل محادثة لفريق الدعم عبر /api/requests (advisor-chat). تصميم موحّد
// بألوان الموقع الجديد (--ink/--wa) ليطابقه في كل الصفحات.
//
// يُشغَّل في نهاية سلسلة البناء بعد بناة الصفحات كلها، فيغطّي كل صفحة عامة.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = join(process.cwd(), "site");
const WA_HUMAN = "https://wa.me/966530540231"; // واتساب المستشار/الدعم البشري
const IMG = "/assets/img/baher.jpg";

// صفحات لا نضع فيها ودجت الدعم العام (لوحات داخلية/مضمّنة/مونيتور).
const SKIP = [/\/portal\//, /\/admin(\.|\/)/, /\/monitor(\.|\/)/, /\/ops(\.|\/)/, /\/checkout(\.|\/)/];

function widget(ar) {
  const greet = ar
    ? "حياك الله 👋 أنا باهر، مساعد الدعم في بيزنس بارتنر. كيف نقدر ندعمك؟"
    : "Hi 👋 I'm Baher, Business Partner's support assistant. How can we help?";
  const T = (a, e) => (ar ? a : e);
  return `<style>
.bps-fab{position:fixed;inset-inline-end:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:9px;padding:7px 16px 7px 7px;background:var(--ink,#0B1B5A);color:#fff;border:0;border-radius:999px;box-shadow:0 12px 30px rgba(11,27,90,.32);cursor:pointer;font-family:inherit;font-weight:700;font-size:.95rem}
[dir=rtl] .bps-fab{padding:7px 7px 7px 16px}
.bps-fab img{width:38px;height:38px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.bps-fab .bps-dot{position:absolute;inset-inline-start:40px;top:8px;width:11px;height:11px;border-radius:50%;background:var(--wa,#25D366);border:2px solid var(--ink,#0B1B5A)}
.bps-fab.bps-hide{display:none}
.bps-panel{position:fixed;inset-inline-end:18px;bottom:18px;z-index:2147483001;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100vh - 40px));background:#fff;border:1px solid var(--line,#E5E9F0);border-radius:20px;box-shadow:0 24px 60px rgba(11,27,90,.28);display:none;flex-direction:column;overflow:hidden}
.bps-panel.bps-on{display:flex}
.bps-hd{display:flex;align-items:center;gap:10px;padding:13px 15px;background:var(--ink,#0B1B5A);color:#fff}
.bps-hd img{width:40px;height:40px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.bps-hd b{font-size:1.02rem;display:block}
.bps-hd small{font-size:.76rem;opacity:.9;display:flex;align-items:center;gap:5px}
.bps-hd em{width:7px;height:7px;border-radius:50%;background:var(--wa,#25D366);display:inline-block;font-style:normal}
.bps-x{margin-inline-start:auto;background:rgba(255,255,255,.16);border:0;color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:1.05rem;line-height:1}
.bps-intake{padding:16px;overflow-y:auto}
.bps-intake .bps-in{width:100%;box-sizing:border-box;margin-bottom:9px;padding:12px 13px;border:1px solid var(--line,#E5E9F0);border-radius:12px;font-family:inherit;font-size:.95rem}
.bps-intake h4{color:var(--ink,#0B1B5A);margin:0 0 12px;font-size:1rem;line-height:1.6;font-weight:700}
.bps-go{width:100%;padding:13px;background:var(--ink,#0B1B5A);color:#fff;border:0;border-radius:12px;font-family:inherit;font-weight:700;font-size:.98rem;cursor:pointer}
.bps-note{color:#64748b;font-size:.78rem;margin:10px 2px 0}
.bps-err{color:#b91c1c;font-size:.82rem;margin-top:8px;display:none}
.bps-chat{display:none;flex-direction:column;height:100%;min-height:0}
.bps-msgs{flex:1;overflow-y:auto;padding:15px;background:#f6f8fc;display:flex;flex-direction:column;gap:9px}
.bps-msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:.92rem;line-height:1.7;white-space:pre-wrap;word-wrap:break-word}
.bps-msg.bps-bot{background:#fff;border:1px solid var(--line,#E5E9F0);color:#1f2430;align-self:flex-start;border-end-start-radius:4px}
.bps-msg.bps-me{background:var(--ink,#0B1B5A);color:#fff;align-self:flex-end;border-end-end-radius:4px}
.bps-msg.bps-ty{opacity:.6}
.bps-wa{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;background:#eafaf0;color:#0b7a3b;border-top:1px solid var(--line,#E5E9F0);font-size:.85rem;font-weight:600;text-decoration:none}
.bps-form{display:flex;gap:8px;padding:11px;border-top:1px solid var(--line,#E5E9F0);background:#fff}
.bps-form input{flex:1;padding:11px 13px;border:1px solid var(--line,#E5E9F0);border-radius:12px;font-family:inherit;font-size:.95rem}
.bps-form button{flex:0 0 auto;width:44px;border:0;border-radius:12px;background:var(--ink,#0B1B5A);color:#fff;cursor:pointer;font-size:1.05rem}
html.bp-embed .bps-fab,html.bp-embed .bps-panel{display:none!important}
</style>
<button class="bps-fab" id="bpsFab" aria-label="${T("افتح محادثة الدعم مع باهر", "Open support chat with Baher")}"><img src="${IMG}" alt=""><span class="bps-dot"></span><span>${T("الدعم", "Support")}</span></button>
<section class="bps-panel" id="bpsPanel" role="dialog" aria-label="${T("دعم باهر", "Baher support")}">
  <div class="bps-hd"><img src="${IMG}" alt=""><div><b>${T("باهر", "Baher")}</b><small><em></em>${T("الدعم — متصل الآن", "Support — online now")}</small></div><button class="bps-x" id="bpsClose" aria-label="${T("إغلاق", "Close")}">✕</button></div>
  <div class="bps-intake" id="bpsIntake">
    <h4>${T("أهلاً بك في دعم بيزنس بارتنر 👋 عرّفنا بنفسك حتى نخدمك ونتابع طلبك.", "Welcome to Business Partner support 👋 Tell us about yourself so we can help and follow up.")}</h4>
    <input class="bps-in" id="bpsName" type="text" placeholder="${T("الاسم الكامل *", "Full name *")}" autocomplete="name">
    <input class="bps-in" id="bpsPhone" type="tel" placeholder="${T("الجوال 05XXXXXXXX *", "Mobile 05XXXXXXXX *")}" autocomplete="tel">
    <button class="bps-go" id="bpsStart">${T("ابدأ الدعم ›", "Start support ›")}</button>
    <div class="bps-err" id="bpsErr"></div>
    <p class="bps-note">🔒 ${T("بياناتك تُستخدم فقط لخدمتك ومتابعة طلبك.", "Your details are used only to help and follow up on your request.")}</p>
  </div>
  <div class="bps-chat" id="bpsChat">
    <div class="bps-msgs" id="bpsMsgs"><div class="bps-msg bps-bot">${greet}</div></div>
    <a class="bps-wa" href="${WA_HUMAN}" target="_blank" rel="noopener">${T("أو تواصل مع فريق الدعم على واتساب", "Or reach the support team on WhatsApp")}</a>
    <form class="bps-form" id="bpsForm"><input id="bpsInput" type="text" autocomplete="off" placeholder="${T("اكتب رسالتك…", "Type your message…")}"><button type="submit" aria-label="${T("إرسال", "Send")}">➤</button></form>
  </div>
</section>
<script>(function(){var AR=document.documentElement.lang!=='en';var fab=document.getElementById('bpsFab'),panel=document.getElementById('bpsPanel');if(!fab||!panel)return;var msgs=document.getElementById('bpsMsgs'),form=document.getElementById('bpsForm'),input=document.getElementById('bpsInput'),intake=document.getElementById('bpsIntake'),chat=document.getElementById('bpsChat');var sid='';try{sid=sessionStorage.getItem('bps_sid')||''}catch(e){}if(!sid){sid='s'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);try{sessionStorage.setItem('bps_sid',sid)}catch(e){}}var contact=null;try{contact=JSON.parse(sessionStorage.getItem('bps_contact')||'null')}catch(e){}var history=[],busy=false;function view(){if(contact){intake.style.display='none';chat.style.display='flex';setTimeout(function(){input.focus()},60)}else{intake.style.display='block';chat.style.display='none'}}function open(){panel.classList.add('bps-on');fab.classList.add('bps-hide');view()}function close(){panel.classList.remove('bps-on');fab.classList.remove('bps-hide')}function add(txt,who){var d=document.createElement('div');d.className='bps-msg '+who;d.textContent=txt;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d}fab.onclick=open;document.getElementById('bpsClose').onclick=close;document.getElementById('bpsStart').onclick=function(){var n=document.getElementById('bpsName').value.trim(),p=document.getElementById('bpsPhone').value.trim(),err=document.getElementById('bpsErr');if(!n){err.textContent=AR?'الرجاء إدخال اسمك.':'Enter your name.';err.style.display='block';return}if(!/^(?:\\+?966|0)?5\\d{8}$/.test(p.replace(/\\s/g,''))){err.textContent=AR?'أدخل جوالاً سعودياً صحيحاً (05XXXXXXXX).':'Enter a valid Saudi mobile.';err.style.display='block';return}err.style.display='none';contact={name:n,phone:p};try{sessionStorage.setItem('bps_contact',JSON.stringify(contact))}catch(e){}view()};function sync(notify){try{fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({type:'advisor-chat',sid:sid,messages:history.slice(-24),notify:!!notify,contact:contact})}).catch(function(){})}catch(e){}}form.onsubmit=function(e){e.preventDefault();var v=input.value.trim();if(!v||busy)return;input.value='';add(v,'bps-me');history.push({role:'user',content:v});busy=true;var ty=add(AR?'يكتب…':'Typing…','bps-bot bps-ty');fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})}).then(function(r){return r.json().catch(function(){return{}})}).then(function(d){ty.remove();var rep=(d&&d.reply)||(AR?'تعذّر الرد الآن. تواصل معنا على واتساب.':'Could not reply now. Reach us on WhatsApp.');add(rep,'bps-bot');history.push({role:'assistant',content:rep});sync(true)}).catch(function(){ty.remove();add(AR?'صار خلل بسيط، جرّب واتساب.':'Something went wrong, try WhatsApp.','bps-bot')}).finally(function(){busy=false;input.focus()})};})();</script>`;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
}

const files = [];
walk(SITE, files);
let patched = 0;
for (const f of files) {
  const rel = f.slice(SITE.length).replace(/\\/g, "/");
  if (SKIP.some((re) => re.test(rel))) continue;
  let html = readFileSync(f, "utf8");
  if (html.includes("bpsFab")) continue; // موجود مسبقاً
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) continue;
  const ar = /<html[^>]*\blang=["']?ar\b/i.test(html);
  html = html.slice(0, idx) + widget(ar) + html.slice(idx);
  writeFileSync(f, html);
  patched++;
}
console.log(`baher-support: widget injected into ${patched} page(s)`);
