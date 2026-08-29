import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("site");

const CSS = `
<style id="bp-conversational-storefront-css">
.hero-start{padding:0!important;overflow:hidden}
.cs-wrap{background:#fff;border-radius:18px;overflow:hidden}
.cs-head{padding:22px 22px 14px;background:linear-gradient(135deg,#f7f9ff,#fff)}
.cs-kicker{display:inline-flex;align-items:center;gap:7px;font-size:.76rem;font-weight:800;color:#0B1B5A;background:#edf1ff;border-radius:99px;padding:5px 10px;margin-bottom:8px}
.cs-title{margin:0;color:#0B1B5A;font-size:1.35rem;line-height:1.45}
.cs-sub{margin:7px 0 0;color:#5d6475;line-height:1.7;font-size:.92rem}
.cs-chat{padding:16px 18px 18px}
.cs-bubble{max-width:91%;border-radius:16px 16px 5px 16px;background:#f2f5fb;color:#17213c;padding:11px 13px;font-size:.92rem;line-height:1.65;margin-bottom:12px}
[dir="ltr"] .cs-bubble{border-radius:16px 16px 16px 5px}
.cs-form{display:flex;align-items:center;gap:8px;border:1.5px solid #cfd6e6;border-radius:14px;padding:6px;background:#fff;box-shadow:0 5px 18px rgba(11,27,90,.06)}
.cs-form:focus-within{border-color:#0B1B5A;box-shadow:0 0 0 3px rgba(11,27,90,.09)}
.cs-input{border:0;outline:0;min-width:0;flex:1;padding:9px 10px;font:inherit;background:transparent;color:#111827}
.cs-send{width:42px;height:42px;border:0;border-radius:11px;background:#0B1B5A;color:#fff;display:grid;place-items:center;cursor:pointer;font-size:1.05rem;flex:0 0 42px}
.cs-chips{display:flex;gap:7px;overflow-x:auto;padding:11px 1px 3px;scrollbar-width:none}
.cs-chips::-webkit-scrollbar{display:none}
.cs-chip{border:1px solid #dbe0ec;background:#fff;color:#0B1B5A;border-radius:99px;padding:7px 11px;white-space:nowrap;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}
.cs-chip:hover,.cs-chip.active{background:#0B1B5A;color:#fff;border-color:#0B1B5A}
.cs-status{font-size:.78rem;color:#687086;margin:10px 2px 0;min-height:18px}
.cs-results{display:grid;gap:9px;margin-top:10px;max-height:380px;overflow:auto;padding-inline-end:2px}
.cs-card{border:1px solid #e1e5ee;border-radius:13px;padding:12px;background:#fff;box-shadow:0 3px 10px rgba(11,27,90,.04)}
.cs-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.cs-cat{font-size:.7rem;color:#687086;margin-bottom:3px;font-weight:700}
.cs-name{font-size:.92rem;font-weight:800;color:#0B1B5A;line-height:1.45}
.cs-code{font-size:.65rem;color:#9aa1af;direction:ltr;white-space:nowrap}
.cs-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}
.cs-meta span{font-size:.69rem;background:#f6f7fa;color:#596174;border-radius:7px;padding:4px 7px}
.cs-price{margin-top:8px;font-size:.85rem;font-weight:800;color:#0B1B5A}
.cs-actions{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}
.cs-actions .btn{padding:.55rem .75rem;font-size:.78rem;min-height:auto}
.cs-buy{border:0;cursor:pointer}
.cs-empty{border:1px dashed #ccd3e3;border-radius:13px;padding:14px;text-align:center;color:#5f6676;font-size:.86rem;line-height:1.6}
.cs-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;padding-top:11px;border-top:1px solid #edf0f5;font-size:.76rem;color:#777f90}
.cs-footer a{color:#0B1B5A;font-weight:700}
@media(max-width:640px){
 .hero-inner--split{display:block!important}
 .hero-inner--split .hero-copy{margin-bottom:22px}
 .hero-inner--split .hero-extra{margin-top:22px}
 .hero-start{border-radius:20px!important}
 .cs-head{padding:20px 18px 12px}.cs-chat{padding:14px}
 .cs-results{max-height:430px}.cs-name{font-size:.95rem}.cs-actions .btn{flex:1;justify-content:center}
}
</style>`;

const markup = (ar) => `
<aside class="hero-start" id="heroStart">
  <div class="cs-wrap" id="serviceAssistant">
    <div class="cs-head">
      <div class="cs-kicker">✦ ${ar ? "اطلب خدمتك مباشرة" : "Find and buy a service"}</div>
      <h2 class="cs-title">${ar ? "وش تحتاج ننجز لك اليوم؟" : "What do you need done today?"}</h2>
      <p class="cs-sub">${ar ? "اكتب طلبك بطريقتك — مثل: نقل كفالة، فتح شركة أجنبية، تجديد إقامة — ونطلع لك الخدمة المناسبة للشراء." : "Describe what you need in your own words and we’ll match you with the right service to buy."}</p>
    </div>
    <div class="cs-chat">
      <div class="cs-bubble">${ar ? "حياك الله 👋 اكتب اسم الخدمة أو صف اللي تحتاجه، أو اختر واحد من الخيارات السريعة." : "Hi 👋 Type a service name or describe what you need, or use a quick option below."}</div>
      <form class="cs-form" id="csForm">
        <input class="cs-input" id="csInput" autocomplete="off" placeholder="${ar ? "مثال: أبغى أنقل موظف لشركتي..." : "Example: I need to transfer an employee..."}" aria-label="${ar ? "ابحث عن خدمة" : "Search services"}">
        <button class="cs-send" type="submit" aria-label="${ar ? "بحث" : "Search"}">⌕</button>
      </form>
      <div class="cs-chips" id="csChips">
        ${[
          ar ? ["تأسيس شركة","تأسيس شركة"] : ["Start a company","company formation"],
          ar ? ["مستثمر أجنبي","استثمار أجنبي"] : ["Foreign investor","foreign investment"],
          ar ? ["نقل كفالة","نقل كفالة"] : ["Employee transfer","sponsorship transfer"],
          ar ? ["إقامة ومقيم","إقامة مقيم"] : ["Iqama / Muqeem","iqama muqeem"],
          ar ? ["قوى","قوى"] : ["Qiwa","qiwa"],
          ar ? ["زكاة وضريبة","زكاة ضريبة vat"] : ["VAT & Zakat","vat zakat"],
          ar ? ["رخصة بلدية","بلدية"] : ["Municipal license","municipal license"],
          ar ? ["توظيف","توظيف استقدام"] : ["Recruitment","recruitment hiring"]
        ].map(([label,q])=>`<button type="button" class="cs-chip" data-q="${q}">${label}</button>`).join("")}
      </div>
      <div class="cs-status" id="csStatus">${ar ? "ابدأ بالكتابة وستظهر النتائج فورًا." : "Start typing and matching services will appear instantly."}</div>
      <div class="cs-results" id="csResults"></div>
      <div class="cs-footer"><span>${ar ? "تقدر تتصفح بدون تسجيل — التسجيل مطلوب فقط عند إتمام الشراء." : "Browse without signing in — account required only at checkout."}</span><a href="${ar ? "/ar/services" : "/services"}">${ar ? "كل الخدمات" : "All services"}</a></div>
    </div>
  </div>
</aside>`;

const JS = `
<script id="bp-conversational-storefront-js">
(function(){
  var root=document.getElementById('serviceAssistant'); if(!root)return;
  var ar=(document.documentElement.lang||'').toLowerCase().indexOf('ar')===0;
  var input=document.getElementById('csInput'),form=document.getElementById('csForm'),results=document.getElementById('csResults'),status=document.getElementById('csStatus'),chips=document.getElementById('csChips');
  var catalog=[];
  var aliases={
    'نقل موظف':'نقل كفالة','نقل عامل':'نقل كفالة','نقل خدمة':'نقل كفالة','كفاله':'كفالة',
    'اقامه':'إقامة','تجديد اقامه':'تجديد إقامة','هوية مقيم':'إقامة','مقيم':'إقامة مقيم',
    'فتح شركة':'تأسيس شركة','اسس شركة':'تأسيس شركة','شركة اجنبية':'استثمار أجنبي شركة','مستثمر اجنبي':'استثمار أجنبي',
    'ضريبه':'ضريبة','فات':'vat','القيمة المضافة':'vat ضريبة','زاتكا':'زكاة ضريبة vat',
    'بلدي':'بلدية','رخصه':'رخصة','سجل':'سجل تجاري','سي ار':'سجل تجاري','cr':'commercial registration',
    'توظيف موظفين':'توظيف','عمال':'توظيف استقدام','استقدام عمال':'استقدام',
    'مكتب افتراضي':'مكتب افتراضي عنوان وطني','عنوان وطني':'عنوان وطني سبل'
  };
  function norm(s){return String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim()}
  function expand(q){var raw=String(q||'').trim(); var n=norm(raw); Object.keys(aliases).forEach(function(k){if(n.indexOf(norm(k))>-1) raw+=' '+aliases[k]}); return norm(raw)}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  function searchable(s){return norm([s.code,s.nameAr,s.nameEn,s.categoryAr,s.category,s.govPlatform,s.pricingModel].join(' '))}
  function score(s,q){var hay=searchable(s),qq=expand(q),parts=qq.split(/\s+/).filter(Boolean); if(!parts.length)return 0; var total=0; parts.forEach(function(p){if(hay.indexOf(p)>-1)total+=p.length>4?4:2}); var name=norm((ar?s.nameAr:s.nameEn)||s.nameAr||s.nameEn); if(name.indexOf(qq)>-1)total+=10; if(norm(s.code)===qq)total+=20; return total}
  function path(s){var slug=String(s.code||'').toLowerCase(); return (ar?'/ar/services/':'/services/')+encodeURIComponent(slug)}
  function signed(){try{return !!JSON.parse(localStorage.getItem('bp_session')||'null')}catch(e){return false}}
  function cartItem(s){return {id:String(s.code||'').toLowerCase(),nameEn:s.nameEn||s.nameAr||'',nameAr:s.nameAr||s.nameEn||'',amount:s.amount==null?null:Number(s.amount),price:s.priceLabel||'',kind:'service',qty:1}}
  function add(s){try{var c=JSON.parse(localStorage.getItem('bp_cart')||'[]'); if(!Array.isArray(c))c=[]; var it=cartItem(s),ex=c.find(function(x){return x.id===it.id}); if(ex)ex.qty=(ex.qty||1)+1; else c.push(it); localStorage.setItem('bp_cart',JSON.stringify(c)); document.dispatchEvent(new Event('bp-cart-change'));}catch(e){}}
  function goBuy(s){add(s); location.href=signed()?(ar?'/ar/checkout':'/checkout'):(ar?'/ar/account?redirect=checkout':'/account?redirect=checkout')}
  function card(s){var fixed=s.amount!=null&&Number(s.amount)>0; var meta=[]; if(s.govPlatform)meta.push(s.govPlatform); if(s.pricingModel)meta.push(s.pricingModel); var price=''; if(document.documentElement.getAttribute('data-prices')==='on'&&fixed) price='<div class="cs-price">'+Number(s.amount).toLocaleString('en-US')+' '+(ar?'﷼':'SAR')+'</div>'; else if(fixed) price='<div class="cs-price">'+(ar?'السعر يظهر بعد تسجيل الدخول':'Price shown after sign-in')+'</div>'; else price='<div class="cs-price">'+(ar?'عرض سعر حسب الحالة':'Custom quote')+'</div>';
    var actions=fixed?'<button class="btn btn-primary cs-buy" data-buy="'+esc(s.code)+'">'+(ar?'اشتر الآن':'Buy now')+'</button><button class="btn btn-ghost cs-buy" data-add="'+esc(s.code)+'">'+(ar?'أضف للسلة':'Add to cart')+'</button>':'<a class="btn btn-primary" href="'+path(s)+'">'+(ar?'اطلب عرض سعر':'Request a quote')+'</a>';
    return '<article class="cs-card"><div class="cs-card-top"><div><div class="cs-cat">'+esc(s.categoryAr||s.category||'')+'</div><div class="cs-name">'+esc((ar?s.nameAr:s.nameEn)||s.nameAr||s.nameEn||s.code)+'</div></div><span class="cs-code">'+esc(s.code||'')+'</span></div><div class="cs-meta">'+meta.slice(0,2).map(function(x){return '<span>'+esc(x)+'</span>'}).join('')+'</div>'+price+'<div class="cs-actions">'+actions+'<a class="btn btn-ghost" href="'+path(s)+'">'+(ar?'التفاصيل':'Details')+'</a></div></article>'}
  function render(q){q=String(q||'').trim(); if(!q){results.innerHTML='';status.textContent=ar?'ابدأ بالكتابة وستظهر النتائج فورًا.':'Start typing and matching services will appear instantly.';return}
    var rows=catalog.map(function(s){return {s:s,n:score(s,q)}}).filter(function(x){return x.n>0}).sort(function(a,b){return b.n-a.n}).slice(0,6).map(function(x){return x.s});
    status.textContent=rows.length?(ar?'وجدنا '+rows.length+' خدمات قريبة من طلبك:':'We found '+rows.length+' matching services:'):(ar?'ما لقينا خدمة مطابقة بالاسم. جرّب وصف الطلب بطريقة ثانية.':'No exact match. Try describing the service differently.');
    results.innerHTML=rows.length?rows.map(card).join(''):'<div class="cs-empty">'+(ar?'جرّب كلمات مثل: نقل كفالة، قوى، إقامة، سجل تجاري، زكاة، رخصة بلدية، أو تأسيس شركة.':'Try terms like Qiwa, Iqama, company formation, VAT, municipal license, or employee transfer.')+'</div>';
  }
  fetch('/assets/data/catalog.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){catalog=(d.services||[]).filter(function(s){return s&&s.code});}).catch(function(){status.textContent=ar?'تعذر تحميل الكتالوج الآن — استخدم رابط كل الخدمات.':'Could not load the catalog right now — use All services.'});
  input.addEventListener('input',function(){render(input.value)}); form.addEventListener('submit',function(e){e.preventDefault();render(input.value)});
  chips.addEventListener('click',function(e){var b=e.target.closest('[data-q]');if(!b)return; Array.from(chips.querySelectorAll('.cs-chip')).forEach(function(x){x.classList.remove('active')});b.classList.add('active');input.value=b.getAttribute('data-q');render(input.value)});
  results.addEventListener('click',function(e){var b=e.target.closest('[data-buy],[data-add]');if(!b)return;var code=b.getAttribute('data-buy')||b.getAttribute('data-add');var s=catalog.find(function(x){return x.code===code});if(!s)return;if(b.hasAttribute('data-buy'))goBuy(s);else{add(s);b.textContent=ar?'تمت الإضافة ✓':'Added ✓';setTimeout(function(){b.textContent=ar?'أضف للسلة':'Add to cart'},1300)}});
})();
</script>`;

for (const [rel, ar] of [["ar/index.html", true], ["index.html", false]]) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  const re = /<aside class="hero-start" id="heroStart">[\s\S]*?<\/aside>/;
  if (!re.test(html)) throw new Error(`heroStart not found in ${rel}`);
  html = html.replace(re, markup(ar));
  if (!html.includes('bp-conversational-storefront-css')) html = html.replace('</head>', CSS + '</head>');
  if (!html.includes('bp-conversational-storefront-js')) html = html.replace('</body>', JS + '</body>');
  fs.writeFileSync(file, html);
  console.log(`Conversational storefront applied: ${rel}`);
}
