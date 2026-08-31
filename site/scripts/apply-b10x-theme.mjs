import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const files=[];
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(name.endsWith('.html'))files.push(p)}}
walk(ROOT);

const LINK='<link rel="stylesheet" href="/assets/css/b10x-theme.css?v=20260829c">';

const arHome=`<section class="b10x-home" id="b10x-home">
  <div class="container b10x-home-grid">
    <div>
      <span class="b10x-kicker"><i></i> Business Partner 4.0 · AI Native</span>
      <h1>كل ما تحتاجه لأعمالك في السعودية. <span>اسأل B10X.</span></h1>
      <p class="b10x-lead">مستشار B10X يفهم احتياجك، يشرح الخدمات، يحدد الخطوات، يساعدك في اختيار الباقة أو الخدمة المناسبة، ويقودك من السؤال إلى الطلب والتنفيذ — مع بقاء السلة، الدفع، لوحة العميل ولوحة الشركاء كما هي.</p>
      <div class="b10x-actions">
        <a class="primary" href="/ar/services">استعرض الخدمات</a>
        <a class="ghost" href="/ar/packages">الباقات</a>
        <a class="ghost" href="/ar/account">لوحة العميل</a>
      </div>
    </div>
    <div class="b10x-chat-shell">
      <div class="b10x-chat">
        <div class="b10x-chat-head">
          <div class="b10x-chat-title"><span class="b10x-ai-dot">10X</span><span>B10X — مستشار Business Partner</span></div>
          <span class="b10x-live">● Online</span>
        </div>
        <div class="b10x-chat-body" id="b10x-chat-body">
          <div class="b10x-msg ai">أهلًا 👋 اكتب ما تحتاجه بطريقتك. أقدر أساعدك في التأسيس، الامتثال، الموارد البشرية، الخدمات الحكومية، العملاء والموردين، العقار، السكن، الريلوكشن، المستندات والباقات.</div>
          <div class="b10x-chips">
            <button class="b10x-chip" type="button" data-q="أبغى أفتح شركة في السعودية">تأسيس شركة</button>
            <button class="b10x-chip" type="button" data-q="أحتاج خدمة امتثال ومتابعة المنصات الحكومية">الامتثال</button>
            <button class="b10x-chip" type="button" data-q="أبغى أجيب عملاء وموردين لشركتي">عملاء وموردون</button>
            <button class="b10x-chip" type="button" data-q="عندي مخالفة وأبغى أقدم اعتراض">اعتراض مخالفة</button>
          </div>
        </div>
        <form class="b10x-compose" id="b10x-chat-form">
          <textarea id="b10x-chat-input" rows="1" placeholder="اكتب مثلاً: أبغى أفتح شركة أجنبية وأوظف 6 أشخاص..."></textarea>
          <button class="b10x-send" type="submit" aria-label="إرسال">↑</button>
        </form>
        <div class="b10x-note">B10X يوجّهك للخدمة والخطوة المناسبة داخل Business Partner.</div>
      </div>
    </div>
  </div>
</section>
<section class="b10x-cap-strip">
  <div class="container b10x-cap-grid">
    <a class="b10x-cap flagship" href="/ar/ai-agents"><strong>B10X AI Operating Layer</strong><span>AI + التنفيذ + النمو + الامتثال في تجربة واحدة.</span></a>
    <a class="b10x-cap" href="/ar/shared-services"><strong>Shared Services</strong><span>فريق خدمات مشتركة وتشغيل للشركات.</span></a>
    <a class="b10x-cap" href="/ar/compliance-agent"><strong>Compliance</strong><span>امتثال ومتابعة وتنبيهات تشغيلية.</span></a>
    <a class="b10x-cap" href="/ar/ai-document-agent"><strong>Document AI</strong><span>فهم المستندات وتجهيز المتطلبات.</span></a>
    <a class="b10x-cap" href="/ar/revenue-os"><strong>BD as a Service</strong><span>عملاء، موردون، Pipeline واجتماعات.</span></a>
  </div>
</section>`;

const enHome=`<section class="b10x-home" id="b10x-home"><div class="container b10x-home-grid"><div><span class="b10x-kicker"><i></i> Business Partner 4.0 · AI Native</span><h1>Run your business in Saudi Arabia. <span>Just ask B10X.</span></h1><p class="b10x-lead">One intelligent operating interface for company formation, compliance, HR, government operations, growth, suppliers, real estate and execution — while preserving your cart, checkout and portals.</p><div class="b10x-actions"><a class="primary" href="/services">Explore services</a><a class="ghost" href="/packages">Packages</a><a class="ghost" href="/account">Client portal</a></div></div><div class="b10x-chat-shell"><div class="b10x-chat"><div class="b10x-chat-head"><div class="b10x-chat-title"><span class="b10x-ai-dot">10X</span><span>B10X Advisor</span></div><span class="b10x-live">● Online</span></div><div class="b10x-chat-body" id="b10x-chat-body"><div class="b10x-msg ai">Tell me what you need in your own words. I can guide you across Business Partner services and next steps.</div></div><form class="b10x-compose" id="b10x-chat-form"><textarea id="b10x-chat-input" rows="1" placeholder="e.g. I want to set up a foreign company and hire 6 people..."></textarea><button class="b10x-send" type="submit">↑</button></form><div class="b10x-note">B10X routes you to the right Business Partner service and next action.</div></div></div></div></section>`;

const CHAT_JS=`<script id="b10x-home-js">
(function(){
  function hideLegacyAdvisor(){
    document.querySelectorAll('[class*="advisor-fab"],[class*="advisor-widget"],[class*="floating-advisor"],#advisor-teaser,#advisor-panel').forEach(function(el){
      el.style.setProperty('display','none','important');
    });
  }
  hideLegacyAdvisor();setTimeout(hideLegacyAdvisor,800);
  var form=document.getElementById('b10x-chat-form'),input=document.getElementById('b10x-chat-input'),body=document.getElementById('b10x-chat-body');
  if(!form||!input||!body)return;
  var history=[];
  function clean(t){
    t=String(t||'');
    t=t.replace(/باهر/g,'B10X');
    t=t.replace(/الوكيل الذكي/g,'B10X');
    t=t.replace(/الوكلاء الذكيون/g,'B10X');
    t=t.replace(/المساعد الذكي/g,'مستشار B10X');
    return t.trim();
  }
  function add(text,role){var d=document.createElement('div');d.className='b10x-msg '+role;d.textContent=text;body.appendChild(d);body.scrollTop=body.scrollHeight;return d}
  async function ask(q){
    if(!q)return;
    add(q,'user');history.push({role:'user',content:q});input.value='';
    var wait=add('B10X يفكر…','ai');
    try{
      var r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})});
      var j=await r.json();
      if(!r.ok) throw new Error(j&&j.error?j.error:'chat_failed');
      wait.remove();
      var reply=clean(j.reply||j.message||j.text||'تعذر الرد الآن. جرّب مرة ثانية.');
      add(reply,'ai');history.push({role:'assistant',content:reply});
    }catch(e){
      wait.textContent='تعذر الاتصال بـ B10X الآن. جرّب مرة ثانية أو استخدم واتساب للتواصل مع الفريق.';
    }
  }
  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value.trim())});
  document.querySelectorAll('.b10x-chip').forEach(function(b){b.addEventListener('click',function(){ask(b.getAttribute('data-q')||b.textContent)})});
})();
</script>`;

let changed=0;
for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('b10x-theme.css')) html=html.replace('</head>',LINK+'\n</head>');
  else html=html.replace(/\/assets\/css\/b10x-theme\.css\?v=[^"']+/g,'/assets/css/b10x-theme.css?v=20260829c');
  // The homepage is not touched here any more. This layer used to insert a
  // second hero + advisor (section.b10x-home) right after </header>, above the
  // real homepage, and add a second <body class>. The homepage now ships its
  // own hero and advisor in the correct order from generate.mjs (buildHome);
  // only the shared b10x-theme.css link above still applies site-wide.
  fs.writeFileSync(file,html);changed++;
}
console.log(`B10X theme applied to ${changed} generated pages`);