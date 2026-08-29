import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const STYLE = `
<style id="bp-home-chat-enhance-css">
/* Homepage = one guided advisor conversation. */
body.bp-home-chat .wa-float,
body.bp-home-chat [href*="wa.me"],
body.bp-home-chat [href*="whatsapp" i],
body.bp-home-chat .chat-widget,
body.bp-home-chat .floating-chat{display:none!important}
#homeAiReply{display:block;margin:14px 0 12px;min-height:190px}
.ha-row{display:flex;gap:10px;align-items:flex-start;margin:12px 0}
.ha-avatar{width:36px;height:36px;border-radius:12px;background:#0B1B5A;color:#fff;display:grid;place-items:center;font-weight:800;flex:0 0 36px}
.ha-bubble{background:#f2f5fb;border-radius:6px 17px 17px 17px;padding:13px 15px;line-height:1.8;color:#17213c;white-space:pre-wrap;flex:0 1 86%}
[dir="rtl"] .ha-bubble{border-radius:17px 6px 17px 17px}
.ha-thinking{color:#788096;font-size:.85rem;padding:8px 46px}
.ha-history{max-height:52vh;overflow:auto;scroll-behavior:smooth;padding:4px 2px}
.ha-user{justify-content:flex-end}
.ha-user .ha-avatar{display:none}
.ha-user .ha-bubble{background:#0B1B5A;color:#fff;flex:0 1 auto;max-width:78%;border-radius:17px 17px 6px 17px}
[dir="rtl"] .ha-user .ha-bubble{border-radius:17px 17px 17px 6px}
/* Do not expose commerce cards while the client is still talking. */
body.bp-home-chat .cs-results,body.bp-home-chat .cs-status,body.bp-home-chat .cs-footer{display:none!important}
body.bp-home-chat .cs-chips{padding-top:12px;display:flex;gap:8px;flex-wrap:wrap;overflow:visible}
body.bp-home-chat .cs-chip{font-size:.82rem;padding:8px 12px}
body.bp-home-chat .cs-head{text-align:center;padding-top:30px}
body.bp-home-chat .cs-title{font-size:1.55rem}
body.bp-home-chat .cs-chat{padding:18px 20px 24px}
body.bp-home-chat .cs-form{position:sticky;bottom:10px;z-index:3}
@media(max-width:640px){
 #homeAiReply{min-height:230px}.ha-history{max-height:none;min-height:230px}.ha-user .ha-bubble{max-width:90%}
 body.bp-home-chat .cs-head{padding:24px 16px 10px}.ha-bubble{flex-basis:90%}.ha-thinking{padding-inline:45px}
}
</style>`;

const SCRIPT = `
<script id="bp-home-chat-enhance-js">
(function(){
  document.body.classList.add('bp-home-chat');
  var ar=(document.documentElement.lang||'').toLowerCase().indexOf('ar')===0;

  function hideLegacy(){
    document.querySelectorAll('a,button,div,span').forEach(function(el){
      var t=(el.textContent||'').trim();
      if(!t)return;
      if(t==='dr.baher magnas'||t==='Dr. Baher Magnas'||t==='اسأل باهر'||t==='Ask Baher'||t==='تواصل عبر واتساب'||t==='تواصل عبر الواتساب'){
        var box=el.closest('a,button,.user-menu,.account-menu,.chat-widget,.floating-chat,.wa-float')||el;
        box.style.display='none';
      }
    });
    document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp" i]').forEach(function(a){a.style.display='none'});
  }
  hideLegacy(); setTimeout(hideLegacy,500); setTimeout(hideLegacy,1600);

  var root=document.getElementById('serviceAssistant'), form=document.getElementById('csForm'), input=document.getElementById('csInput');
  if(!root||!form||!input)return;
  var chips=document.getElementById('csChips');
  var oldBubble=root.querySelector('.cs-bubble');
  if(oldBubble) oldBubble.style.display='none';

  var history=document.createElement('div'); history.className='ha-history'; history.id='homeAiReply';
  form.parentNode.insertBefore(history,form);
  var msgs=[];
  function esc(s){return String(s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function row(role,text){
    var d=document.createElement('div'); d.className='ha-row '+(role==='user'?'ha-user':'ha-assistant');
    d.innerHTML='<div class="ha-avatar">✦</div><div class="ha-bubble">'+esc(text)+'</div>';
    history.appendChild(d); history.scrollTop=history.scrollHeight;
  }
  function thinking(){var d=document.createElement('div');d.className='ha-thinking';d.id='haThinking';d.textContent=ar?'يفكر المستشار…':'Advisor is thinking…';history.appendChild(d);history.scrollTop=history.scrollHeight}
  async function ask(q){
    q=String(q||'').trim(); if(!q)return;
    row('user',q); msgs.push({role:'user',content:q}); thinking(); input.disabled=true;
    try{
      var r=await fetch('/api/home-assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:msgs.slice(-12)})});
      var data=await r.json(); var el=document.getElementById('haThinking'); if(el)el.remove();
      var reply=data.reply||(ar?'تعذر الحصول على إجابة الآن. جرّب مرة ثانية.':'Unable to answer right now. Please try again.');
      row('assistant',reply); msgs.push({role:'assistant',content:reply});
    }catch(e){var el=document.getElementById('haThinking');if(el)el.remove();row('assistant',ar?'صار خلل بسيط. جرّب مرة ثانية.':'Something went wrong. Try again.');}
    input.disabled=false; input.focus();
  }

  row('assistant', ar
    ? 'حياك الله 👋 أنا مستشار Business Partner الذكي. اشرح لي وش تحتاج أو وش المشكلة اللي تواجهك، وأنا أمشي معك خطوة بخطوة وأوصلك للخدمة أو الإجراء المناسب داخل الموقع.'
    : 'Hi 👋 I’m the Business Partner smart advisor. Tell me what you need or what problem you are facing, and I’ll guide you step by step to the right service or action on the site.');

  if(chips){
    chips.innerHTML = ar
      ? '<button type="button" class="cs-chip" data-q="أبغى أبدأ شركة">أبغى أبدأ شركة</button><button type="button" class="cs-chip" data-q="عندي موضوع موظفين أو موارد بشرية">موظفين وموارد بشرية</button><button type="button" class="cs-chip" data-q="أحتاج معاملة أو منصة حكومية">معاملة حكومية</button><button type="button" class="cs-chip" data-q="مو متأكد وش الخدمة اللي أحتاجها">مو متأكد وش أحتاج</button>'
      : '<button type="button" class="cs-chip" data-q="I want to start a company">Start a company</button><button type="button" class="cs-chip" data-q="I need help with employees or HR">Employees & HR</button><button type="button" class="cs-chip" data-q="I need help with a government process or platform">Government process</button><button type="button" class="cs-chip" data-q="I am not sure which service I need">Not sure what I need</button>';
    chips.addEventListener('click',function(e){var b=e.target.closest('[data-q]');if(!b)return;ask(b.getAttribute('data-q')||b.textContent||'')},true);
  }

  form.addEventListener('submit',function(e){
    e.preventDefault();e.stopImmediatePropagation();
    var q=input.value.trim(); if(!q)return; input.value=''; ask(q);
  },true);

  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();form.requestSubmit()}},true);
  input.placeholder=ar?'اكتب رسالتك للمستشار…':'Message the advisor…';
  var kicker=root.querySelector('.cs-kicker'); if(kicker) kicker.textContent=ar?'✦ مستشار Business Partner الذكي':'✦ Business Partner Smart Advisor';
  var title=root.querySelector('.cs-title'); if(title) title.textContent=ar?'كيف أقدر أساعدك اليوم؟':'How can I help you today?';
  var sub=root.querySelector('.cs-sub'); if(sub) sub.textContent=ar?'محادثة واحدة تساعدك في فهم خدمات الموقع، الإجراءات، المتطلبات، والمنصات — خطوة بخطوة.':'One conversation to help you understand the site, services, requirements and government processes — step by step.';
})();
</script>`;

for(const rel of ['index.html','ar/index.html']){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<style id="bp-home-chat-enhance-css">[\s\S]*?<\/style>/, STYLE.replace(/^\n|\n$/g,''));
  html=html.replace(/<script id="bp-home-chat-enhance-js">[\s\S]*?<\/script>/, SCRIPT.replace(/^\n|\n$/g,''));
  if(!html.includes('bp-home-chat-enhance-css')) html=html.replace('</head>',STYLE+'</head>');
  if(!html.includes('bp-home-chat-enhance-js')) html=html.replace('</body>',SCRIPT+'</body>');
  fs.writeFileSync(file,html);
  console.log('Guided homepage advisor applied:',rel);
}
