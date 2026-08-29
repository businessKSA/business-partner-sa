import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const STYLE = `
<style id="bp-home-chat-enhance-css">
/* Homepage: one conversational surface only. */
body.bp-home-chat .wa-float,
body.bp-home-chat [href*="wa.me"],
body.bp-home-chat [href*="whatsapp" i]{display:none!important}
#homeAiReply{display:none;margin:12px 0 4px}
#homeAiReply.show{display:block}
.ha-row{display:flex;gap:10px;align-items:flex-start;margin:10px 0}
.ha-avatar{width:34px;height:34px;border-radius:10px;background:#0B1B5A;color:white;display:grid;place-items:center;font-weight:800;flex:0 0 34px}
.ha-bubble{background:#f2f5fb;border-radius:5px 16px 16px 16px;padding:12px 14px;line-height:1.75;color:#17213c;white-space:pre-wrap;flex:1}
[dir="rtl"] .ha-bubble{border-radius:16px 5px 16px 16px}
.ha-thinking{color:#788096;font-size:.85rem;padding:8px 2px}
.ha-history{max-height:42vh;overflow:auto;scroll-behavior:smooth}
.ha-user{justify-content:flex-end}
.ha-user .ha-avatar{display:none}
.ha-user .ha-bubble{background:#0B1B5A;color:#fff;flex:0 1 auto;max-width:80%;border-radius:16px 16px 5px 16px}
[dir="rtl"] .ha-user .ha-bubble{border-radius:16px 16px 16px 5px}
@media(max-width:640px){.ha-history{max-height:none}.ha-user .ha-bubble{max-width:92%}}
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
  hideLegacy(); setTimeout(hideLegacy,600); setTimeout(hideLegacy,1800);

  var root=document.getElementById('serviceAssistant'), form=document.getElementById('csForm'), input=document.getElementById('csInput');
  if(!root||!form||!input)return;
  var results=document.getElementById('csResults');
  var status=document.getElementById('csStatus');
  var history=document.createElement('div'); history.className='ha-history'; history.id='homeAiReply';
  form.parentNode.insertBefore(history,form);
  var msgs=[];
  function esc(s){return String(s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function row(role,text){
    var d=document.createElement('div'); d.className='ha-row '+(role==='user'?'ha-user':'ha-assistant');
    d.innerHTML='<div class="ha-avatar">✦</div><div class="ha-bubble">'+esc(text)+'</div>';
    history.appendChild(d); history.classList.add('show'); history.scrollTop=history.scrollHeight;
  }
  function thinking(){var d=document.createElement('div');d.className='ha-thinking';d.id='haThinking';d.textContent=ar?'جاري التفكير…':'Thinking…';history.appendChild(d);history.classList.add('show');history.scrollTop=history.scrollHeight}
  async function ask(q){
    if(!q.trim())return;
    row('user',q); msgs.push({role:'user',content:q}); thinking();
    try{
      var r=await fetch('/api/home-assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:msgs.slice(-10)})});
      var data=await r.json(); var el=document.getElementById('haThinking'); if(el)el.remove();
      var reply=data.reply||(ar?'تعذر الحصول على إجابة الآن.':'Unable to answer right now.');
      row('assistant',reply); msgs.push({role:'assistant',content:reply});
      if(status) status.textContent=ar?'الخدمات المطابقة — اختر الخدمة المناسبة أو أكمل المحادثة.':'Matching services — choose one below or keep chatting.';
    }catch(e){var el=document.getElementById('haThinking');if(el)el.remove();row('assistant',ar?'صار خلل بسيط. جرّب مرة ثانية.':'Something went wrong. Try again.');}
  }
  // Keep the existing instant service matcher; add AI answer in parallel.
  form.addEventListener('submit',function(){setTimeout(function(){var q=input.value.trim(); if(q){ask(q); input.value='';}},0)},true);
  var chips=document.getElementById('csChips');
  if(chips) chips.addEventListener('click',function(e){var b=e.target.closest('[data-q]');if(!b)return;var q=b.getAttribute('data-q')||b.textContent||'';setTimeout(function(){ask(q)},0)},true);
  input.placeholder=ar?'اكتب أي شيء تحتاجه عن خدمات الأعمال في السعودية…':'Ask anything about business services in Saudi Arabia…';
  var bubble=root.querySelector('.cs-bubble'); if(bubble) bubble.textContent=ar?'حياك الله 👋 اكتب اللي تحتاجه كأنك تتحدث مع مستشار. أسأل عن خدمة، سعر، مستندات، منصة حكومية، أو اشرح مشكلتك، وسأساعدك وأعرض لك الخدمات المناسبة.':'Hi 👋 Tell me what you need as if you were speaking to a consultant. Ask about services, pricing, documents, government platforms, or describe your problem.';
})();
</script>`;
for(const rel of ['index.html','ar/index.html']){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('bp-home-chat-enhance-css')) html=html.replace('</head>',STYLE+'</head>');
  if(!html.includes('bp-home-chat-enhance-js')) html=html.replace('</body>',SCRIPT+'</body>');
  fs.writeFileSync(file,html);
  console.log('Homepage AI chat enhanced:',rel);
}
