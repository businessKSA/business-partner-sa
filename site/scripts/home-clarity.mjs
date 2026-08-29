import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

const css = String.raw`
<style id="bp-home-clarity-css">
body.bp-home-clarity{background:radial-gradient(circle at 86% 0%,rgba(79,115,255,.11),transparent 25%),#fff}
.bp-home-clarity .b10x-home,.bp-home-clarity .b10x-cap-strip,.bp-home-clarity>main{display:none!important}
.bp-home-clarity .advisor-fab,.bp-home-clarity .advisor-panel,.bp-home-clarity .advisor-teaser{display:none!important}
.bp-home-clarity .wa-fab{display:flex!important}
.bp-clarity{--n:#07163f;--b:#2856d6;--i:#5e79f4;--c:#42d7f6;--ink:#111a33;--muted:#697389;--line:#e5e9f2;--soft:#f7f9fd;color:var(--ink)}
.bp-clarity *{box-sizing:border-box}.bp-clarity a{text-decoration:none}
.bp-clarity .wrap{width:min(1160px,calc(100% - 36px));margin:auto}
.bp-clarity .hero{padding:78px 0 54px;text-align:center;display:block!important}
.bp-clarity .pill{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;border:1px solid #dfe7f7;background:#f8faff;color:#3156ad;font-size:.73rem;font-weight:800}
.bp-clarity .pill i{width:7px;height:7px;border-radius:50%;background:#18b66f;box-shadow:0 0 0 5px rgba(24,182,111,.08)}
.bp-clarity h1{max-width:880px;margin:20px auto 16px;font-size:clamp(2.55rem,5.4vw,5.45rem);line-height:.98;letter-spacing:-.065em;color:var(--n)}
.bp-clarity h1 span{background:linear-gradient(100deg,#2457d7,#647eff 52%,#32bddf);-webkit-background-clip:text;background-clip:text;color:transparent}
.bp-clarity .hero p{max-width:810px;margin:0 auto;color:var(--muted);line-height:1.9;font-size:1.05rem}
.bp-clarity .hero-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:25px}
.bp-clarity .btnx{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:13px;font-weight:850;font-size:.85rem;border:1px solid #dfe5ef;color:var(--n);background:#fff}
.bp-clarity .btnx.primary{border:0;background:linear-gradient(135deg,var(--n),var(--b));color:#fff;box-shadow:0 10px 28px rgba(34,75,184,.18)}
.bp-clarity .who{padding:14px 0 68px}.bp-clarity .who-box{border:1px solid var(--line);border-radius:22px;padding:23px 26px;background:linear-gradient(135deg,#fff,#f8faff);display:grid;grid-template-columns:180px 1fr;gap:24px;align-items:center}
.bp-clarity .who-box strong{font-size:1rem;color:var(--n)}.bp-clarity .who-box p{margin:0;color:var(--muted);line-height:1.8;font-size:.88rem}
.bp-clarity section{padding:76px 0}.bp-clarity .head{max-width:720px;margin:0 auto 32px;text-align:center}.bp-clarity .head h2{margin:0;color:var(--n);font-size:clamp(2rem,3.8vw,3.3rem);line-height:1.08;letter-spacing:-.05em}.bp-clarity .head p{margin:12px 0 0;color:var(--muted);line-height:1.8}
.bp-clarity .chat-sec{background:linear-gradient(180deg,#f8faff,#fff)}
.bp-clarity .chat-grid{display:grid;grid-template-columns:.88fr 1.12fr;gap:24px;align-items:center}
.bp-clarity .chat-copy h2{font-size:clamp(2rem,3.5vw,3.4rem);line-height:1.08;letter-spacing:-.05em;color:var(--n);margin:0 0 14px}.bp-clarity .chat-copy p{color:var(--muted);line-height:1.85;margin:0}.bp-clarity .chat-copy ul{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:9px}.bp-clarity .chat-copy li{font-size:.82rem;color:#526079}.bp-clarity .chat-copy li:before{content:'✓';color:#17aa68;font-weight:900;margin-left:7px}
.bp-chat-shell{padding:1px;border-radius:28px;background:linear-gradient(135deg,#3159cf,#6c82ff,#4ed9f8);box-shadow:0 24px 70px rgba(31,67,168,.14)}.bp-chat{border-radius:27px;background:#fff;overflow:hidden}.bp-chat-head{height:54px;padding:0 15px;border-bottom:1px solid #edf0f5;display:flex;align-items:center;justify-content:space-between}.bp-chat-title{display:flex;align-items:center;gap:8px;color:var(--n);font-size:.78rem;font-weight:900}.bp-chat-mark{width:29px;height:29px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,var(--n),var(--b));color:#fff;font-size:.6rem}.bp-chat-live{font-size:.61rem;color:#0f8e57;background:#eaf9f2;padding:5px 8px;border-radius:999px;font-weight:800}.bp-chat-body{padding:15px;min-height:290px;max-height:380px;overflow:auto;background:linear-gradient(180deg,#fbfcff,#f7f9fd)}.bp-msg{max-width:88%;padding:10px 12px;border-radius:14px;margin-bottom:8px;font-size:.75rem;line-height:1.65;white-space:pre-wrap}.bp-msg.ai{background:#fff;border:1px solid #e6eaf2;color:#34415c}.bp-msg.user{margin-inline-start:auto;background:linear-gradient(135deg,#0a1a4d,#2c5ad3);color:#fff}.bp-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}.bp-chip{border:1px solid #dfe5f0;background:#fff;color:#36559d;border-radius:999px;padding:6px 9px;font-size:.63rem;cursor:pointer;font-weight:700}.bp-compose{display:flex;align-items:center;gap:8px;padding:11px;border-top:1px solid #e9edf4}.bp-compose textarea{flex:1;resize:none;min-height:46px;max-height:100px;border:1px solid #dfe5ef;border-radius:13px;padding:11px 12px;outline:none;background:#fbfcff}.bp-compose button{width:46px;height:46px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--n),var(--b));color:#fff;cursor:pointer;font-weight:900}.bp-chat-note{text-align:center;color:#929bad;font-size:.61rem;padding:0 12px 10px}
.bp-clarity .cap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.bp-clarity .cap{border:1px solid var(--line);border-radius:20px;padding:18px;background:#fff;min-height:168px;transition:.2s}.bp-clarity .cap:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(10,28,78,.08)}.bp-clarity .cap i{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#eef3ff;color:#3159bd;font-style:normal;font-weight:900;margin-bottom:18px}.bp-clarity .cap strong{display:block;color:#172854;font-size:.88rem;margin-bottom:6px}.bp-clarity .cap span{display:block;color:#7b8498;font-size:.7rem;line-height:1.62}
.bp-clarity .b10x-box{border-radius:30px;padding:34px;background:radial-gradient(circle at 88% 8%,rgba(69,215,248,.17),transparent 27%),linear-gradient(135deg,#07163f,#123984);color:#fff;box-shadow:0 24px 70px rgba(31,67,168,.16)}.bp-clarity .b10x-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:26px;align-items:center}.bp-clarity .b10x-box h2{margin:8px 0 12px;font-size:clamp(2.15rem,4vw,4.1rem);letter-spacing:-.055em;line-height:1}.bp-clarity .b10x-box p{margin:0;color:rgba(255,255,255,.68);line-height:1.8}.bp-clarity .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.bp-clarity .step{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:15px;padding:13px}.bp-clarity .step b{display:block;font-size:.75rem}.bp-clarity .step span{display:block;color:rgba(255,255,255,.58);font-size:.63rem;margin-top:4px}
.bp-clarity .packages{background:#f8faff}.bp-clarity .pkg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.bp-clarity .pkgx{border:1px solid var(--line);border-radius:22px;padding:19px;background:#fff;display:flex;flex-direction:column}.bp-clarity .pkgx.featured{border-color:#5876df;box-shadow:0 18px 50px rgba(50,84,180,.12)}.bp-clarity .pkgx h3{margin:0 0 7px;color:var(--n)}.bp-clarity .pkgx p{margin:0;color:var(--muted);font-size:.7rem;line-height:1.6;min-height:44px}.bp-clarity .pkgx ul{list-style:none;padding:0;margin:16px 0 20px;display:grid;gap:8px}.bp-clarity .pkgx li{font-size:.68rem;color:#536077}.bp-clarity .pkgx li:before{content:'✓';color:#18a869;font-weight:900;margin-left:6px}.bp-clarity .pkgx a{margin-top:auto;text-align:center}
.bp-clarity .demo{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bp-clarity .demo-card{border:1px solid var(--line);border-radius:24px;padding:20px;background:#fff;box-shadow:0 8px 28px rgba(10,28,78,.05)}.bp-clarity .demo-card.dark{background:linear-gradient(135deg,#07163f,#123984);color:#fff;border:0}.bp-clarity .demo-card h3{margin:0 0 14px}.bp-clarity .mini-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf0f5;font-size:.7rem;color:#5d687d}.bp-clarity .dark .mini-row{border-color:rgba(255,255,255,.09);color:rgba(255,255,255,.7)}.bp-clarity .status{font-size:.58rem;padding:4px 7px;border-radius:999px;background:#eaf8f1;color:#118657;font-weight:800}.bp-clarity .dark .status{background:rgba(255,255,255,.1);color:#fff}
.bp-home-clarity .site-footer{min-height:48px!important;padding:0!important;background:#07143b!important}.bp-home-clarity .site-footer .newsletter-band,.bp-home-clarity .site-footer .footer-grid{display:none!important}.bp-home-clarity .site-footer>.container{padding-top:0!important;padding-bottom:0!important}.bp-home-clarity .site-footer .footer-bottom{min-height:48px!important;margin:0!important;padding:8px 0!important;border:0!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;color:rgba(255,255,255,.58)!important;font-size:.65rem!important}.bp-home-clarity .site-footer .footer-bottom span{font-size:.65rem!important;color:rgba(255,255,255,.58)!important;line-height:1.3!important}
@media(max-width:980px){.bp-clarity .who-box,.bp-clarity .chat-grid,.bp-clarity .b10x-grid{grid-template-columns:1fr}.bp-clarity .cap-grid,.bp-clarity .pkg-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.bp-clarity .wrap{width:min(100% - 24px,1160px)}.bp-clarity .hero{padding:48px 0 32px}.bp-clarity h1{font-size:3rem}.bp-clarity section{padding:58px 0}.bp-clarity .cap-grid,.bp-clarity .pkg-grid,.bp-clarity .demo{grid-template-columns:1fr}.bp-clarity .steps{grid-template-columns:repeat(2,1fr)}.bp-home-clarity .site-footer .footer-bottom{min-height:54px!important;flex-direction:column!important;justify-content:center!important;gap:3px!important;text-align:center!important}}
</style>`;

const ar = String.raw`
<div class="bp-clarity" id="bp-home-clarity">
  <section class="hero">
    <div class="wrap">
      <span class="pill"><i></i> Business Partner · السعودية</span>
      <h1>شريك تشغيل أعمالك <span>في السعودية.</span></h1>
      <p>نساعد الشركات والمستثمرين في التأسيس، الخدمات الحكومية، الامتثال، الموارد البشرية، التشغيل، الموردين، العملاء، العقار والانتقال إلى السعودية — من خلال فريق متخصص وتقنية B10X.</p>
      <div class="hero-actions"><a class="btnx primary" href="#bp-consultant">ابدأ مع B10X</a><a class="btnx" href="#bp-services">استعرض خدماتنا</a></div>
    </div>
  </section>
  <div class="who"><div class="wrap"><div class="who-box"><strong>ماذا نفعل؟</strong><p>Business Partner تجمع خدمات الأعمال الحكومية والتشغيلية في مكان واحد. بدل ما تتعامل مع عدة مكاتب وموردين، نساعدك في تحديد المسار الصحيح، ثم نتولى التنسيق والتنفيذ والمتابعة حتى الإنجاز.</p></div></div></div>

  <section class="chat-sec" id="bp-consultant"><div class="wrap chat-grid">
    <div class="chat-copy"><span class="pill"><i></i> B10X</span><h2>لا تعرف اسم الخدمة؟ اشرح المطلوب فقط.</h2><p>B10X يفهم احتياجك ويقودك للخدمة والخطوة المناسبة داخل Business Partner.</p><ul><li>يفهم الحالة ويسأل الأسئلة الناقصة.</li><li>يوضح المتطلبات والخطوات المناسبة.</li><li>يساعدك في اختيار الخدمة أو الباقة.</li><li>ينقلك من السؤال إلى الطلب والمتابعة.</li></ul></div>
    <div class="bp-chat-shell"><div class="bp-chat"><div class="bp-chat-head"><div class="bp-chat-title"><span class="bp-chat-mark">10X</span><span>B10X — مستشار Business Partner</span></div><span class="bp-chat-live">● Online</span></div><div class="bp-chat-body" id="bp-chat-body"><div class="bp-msg ai">أهلًا 👋 قل لي وش تحتاج أو وش المشكلة اللي تواجهك، وأنا أساعدك أحدد المسار المناسب.</div><div class="bp-chips"><button class="bp-chip" type="button" data-q="أبغى أفتح شركة في السعودية">تأسيس شركة</button><button class="bp-chip" type="button" data-q="عندي موضوع امتثال أو منصة حكومية">امتثال وخدمات حكومية</button><button class="bp-chip" type="button" data-q="أحتاج موظفين أو موارد بشرية">موظفين وموارد بشرية</button><button class="bp-chip" type="button" data-q="أبغى أجيب عملاء وموردين لشركتي">عملاء وموردون</button></div></div><form class="bp-compose" id="bp-chat-form"><textarea id="bp-chat-input" rows="1" placeholder="اكتب مثلاً: عندي شركة أجنبية وأبغى أبدأ في الرياض..."></textarea><button type="submit">↑</button></form><div class="bp-chat-note">المستشار يساعدك داخل الموقع، ويمكنك الانتقال للطلب أو لوحة العميل عند الحاجة.</div></div></div>
  </div></section>

  <section id="bp-services"><div class="wrap"><div class="head"><h2>وش نقدر نسوي لك؟</h2><p>هذه هي المجالات الرئيسية. التفاصيل والخدمات الفرعية تظهر لك فقط لما تحتاجها.</p></div><div class="cap-grid">
    <a class="cap" href="/ar/services/category/company-formation"><i>01</i><strong>تأسيس الشركات والاستثمار</strong><span>تأسيس، مستثمر أجنبي، فروع، تعديلات وما بعد التأسيس.</span></a>
    <a class="cap" href="/ar/services/category/government-relations"><i>02</i><strong>الخدمات الحكومية والامتثال</strong><span>التراخيص والمنصات والإجراءات والالتزامات التشغيلية.</span></a>
    <a class="cap" href="/ar/services/category/hr-services"><i>03</i><strong>الموارد البشرية والتوظيف</strong><span>موظفون، تشغيل، نقل خدمات، توظيف واستقدام.</span></a>
    <a class="cap" href="/ar/shared-services"><i>04</i><strong>Shared Services</strong><span>فريق خدمات مشتركة يساعدك في تشغيل الأعمال اليومية.</span></a>
    <a class="cap" href="/ar/revenue-os"><i>05</i><strong>تطوير الأعمال</strong><span>عملاء، موردون، شركاء، Pipeline وترتيب اجتماعات.</span></a>
    <a class="cap" href="/ar/workspaces"><i>06</i><strong>العقار والمكاتب والسكن</strong><span>مكاتب ومساحات وسكن موظفين وعمال وحلول مواقع.</span></a>
    <a class="cap" href="/ar/mahfol-makfol"><i>07</i><strong>Relocation & Soft Landing</strong><span>انتقال الشركة والموظفين وتجهيز بداية التشغيل في السعودية.</span></a>
    <a class="cap" href="/ar/ai-agents"><i>10X</i><strong>B10X & AI</strong><span>مستشار وأدوات ووكلاء تساعدك في فهم وتنفيذ ومتابعة العمل.</span></a>
  </div></div></section>

  <section><div class="wrap"><div class="b10x-box"><div class="b10x-grid"><div><span class="pill" style="background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14);color:#fff">B10X by Business Partner</span><h2>من السؤال إلى التنفيذ.</h2><p>B10X هي طبقة التشغيل داخل Business Partner. تفهم احتياجك، تربطه بالخدمات والأدوات المناسبة، وتساعدك في متابعة كل شيء من مكان واحد.</p></div><div class="steps"><div class="step"><b>Ask</b><span>اشرح احتياجك.</span></div><div class="step"><b>Plan</b><span>نبني المسار المناسب.</span></div><div class="step"><b>Execute</b><span>ابدأ الطلب والتنفيذ.</span></div><div class="step"><b>Track</b><span>تابع الحالة من لوحتك.</span></div></div></div></div></div></section>

  <section class="packages" id="bp-packages"><div class="wrap"><div class="head"><h2>اختر مستوى الدعم المناسب لشركتك.</h2><p>الباقات تحدد مستوى التشغيل والمتابعة، أما التسعير النهائي فيتحدد حسب احتياجك والخدمات المطلوبة.</p></div><div class="pkg-grid">
    <div class="pkgx"><h3>Micro</h3><p>للمنشآت الصغيرة والطلبات الأساسية.</p><ul><li>دعم أساسي</li><li>طلبات تشغيلية محددة</li><li>وصول إلى B10X</li></ul><a class="btnx" href="/ar/packages">اعرف إذا تناسبك</a></div>
    <div class="pkgx"><h3>Small</h3><p>للشركات الناشئة والفرق الصغيرة.</p><ul><li>متابعة أوسع</li><li>موارد بشرية وخدمات حكومية</li><li>تقارير وطلبات</li></ul><a class="btnx" href="/ar/packages">اعرف إذا تناسبك</a></div>
    <div class="pkgx featured"><h3>Medium</h3><p>للتشغيل المستمر والنمو والامتثال.</p><ul><li>تشغيل ومتابعة</li><li>امتثال وموارد بشرية</li><li>تطوير أعمال وموردون</li></ul><a class="btnx primary" href="/ar/packages">استكشف الباقة</a></div>
    <div class="pkgx"><h3>Large</h3><p>للشركات الأكبر ومتعددة الاحتياجات.</p><ul><li>تشغيل متعدد المسارات</li><li>متابعة مخصصة</li><li>أولوية وتقارير</li></ul><a class="btnx" href="/ar/packages">تواصل معنا</a></div>
  </div></div></section>

  <section><div class="wrap"><div class="head"><h2>كل شيء تتابعه من لوحة واحدة.</h2><p>بعد بدء العمل، العميل لا يحتاج يطارد الرسائل. الطلبات والعروض والمستندات والمدفوعات وحالة التنفيذ تكون في حسابه.</p></div><div class="demo"><div class="demo-card"><h3>لوحة العميل</h3><div class="mini-row"><span>طلبات نشطة</span><span class="status">قيد التنفيذ</span></div><div class="mini-row"><span>عروض الأسعار</span><span>3</span></div><div class="mini-row"><span>المستندات</span><span>12</span></div><div class="mini-row"><span>المدفوعات والفواتير</span><span>محدّثة</span></div><a class="btnx" style="margin-top:16px" href="/ar/account">فتح لوحة العميل</a></div><div class="demo-card dark"><h3>Business Partner Workspace</h3><div class="mini-row"><span>B10X</span><span class="status">Active</span></div><div class="mini-row"><span>Compliance</span><span>Monitoring</span></div><div class="mini-row"><span>Shared Services</span><span>Connected</span></div><div class="mini-row"><span>Partners & Suppliers</span><span>Connected</span></div><a class="btnx" style="margin-top:16px;background:#fff;color:#153778;border:0" href="/ar/account">شاهد تجربتك بعد الدخول</a></div></div></div></section>
</div>`;

const en = String.raw`<div class="bp-clarity" id="bp-home-clarity"><section class="hero"><div class="wrap"><span class="pill"><i></i> Business Partner · Saudi Arabia</span><h1>Your operating partner <span>in Saudi Arabia.</span></h1><p>We help companies and investors with formation, government operations, compliance, HR, shared services, suppliers, customers, real estate and relocation — powered by B10X.</p><div class="hero-actions"><a class="btnx primary" href="#bp-consultant">Start with B10X</a><a class="btnx" href="/services">Explore services</a></div></div></section><div class="who"><div class="wrap"><div class="who-box"><strong>What do we do?</strong><p>Business Partner brings business, government and operational services into one place, then helps coordinate execution and follow-up.</p></div></div></div><section class="chat-sec" id="bp-consultant"><div class="wrap chat-grid"><div class="chat-copy"><span class="pill"><i></i> B10X</span><h2>Don't know the service name? Just explain the outcome.</h2><p>B10X understands your need and guides you to the right Business Partner service and next action.</p></div><div class="bp-chat-shell"><div class="bp-chat"><div class="bp-chat-head"><div class="bp-chat-title"><span class="bp-chat-mark">10X</span><span>B10X — Business Partner Advisor</span></div><span class="bp-chat-live">● Online</span></div><div class="bp-chat-body" id="bp-chat-body"><div class="bp-msg ai">Tell me what you need and I will help you identify the right path.</div></div><form class="bp-compose" id="bp-chat-form"><textarea id="bp-chat-input" rows="1" placeholder="e.g. I want to set up a foreign company in Riyadh..."></textarea><button type="submit">↑</button></form><div class="bp-chat-note">B10X helps you move from question to service, request and tracking.</div></div></div></div></section><section><div class="wrap"><div class="head"><h2>What can we help you with?</h2><p>Formation, government & compliance, HR, shared services, business development, real estate, relocation and B10X.</p></div><div class="hero-actions"><a class="btnx primary" href="/services">Explore capabilities</a><a class="btnx" href="/packages">Packages</a><a class="btnx" href="/account">Client portal</a></div></div></section></div>`;

const js = String.raw`
<script id="bp-home-clarity-js">
(function(){
  var form=document.getElementById('bp-chat-form'),input=document.getElementById('bp-chat-input'),body=document.getElementById('bp-chat-body');
  if(!form||!input||!body)return;
  var history=[];
  function add(text,role){var d=document.createElement('div');d.className='bp-msg '+role;d.textContent=text;body.appendChild(d);body.scrollTop=body.scrollHeight;return d}
  function clean(t){return String(t||'').replace(/باهر/g,'B10X').replace(/الوكيل الذكي/g,'B10X').trim()}
  async function ask(q){
    if(!q)return;add(q,'user');history.push({role:'user',content:q});input.value='';var wait=add('B10X يفكر…','ai');
    try{var r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})});var j=await r.json();wait.remove();var reply=clean(j.reply||j.message||'تعذر الرد الآن. جرّب مرة ثانية.');add(reply,'ai');history.push({role:'assistant',content:reply})}catch(e){wait.textContent='تعذر الاتصال بالمستشار الآن. جرّب مرة ثانية بعد لحظات.'}
  }
  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value.trim())});
  document.querySelectorAll('.bp-chip').forEach(function(b){b.addEventListener('click',function(){ask(b.getAttribute('data-q')||b.textContent)})});
})();
</script>`;

for (const [rel, block] of [['ar/index.html', ar], ['index.html', en]]) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<body([^>]*)>/, (m, attrs) => `<body${attrs} class="${/class=/.test(attrs)?'':'bp-home-clarity'}">`);
  if (html.includes('class="bp-b10x-home"')) html = html.replace('class="bp-b10x-home"','class="bp-b10x-home bp-home-clarity"');
  else if (!html.includes('bp-home-clarity')) html = html.replace('<body','<body class="bp-home-clarity"');
  if (!html.includes('bp-home-clarity-css')) html = html.replace('</head>', css + '\n</head>');
  if (!html.includes('id="bp-home-clarity"')) {
    const endHeader = html.indexOf('</header>');
    if (endHeader > -1) html = html.slice(0,endHeader+9)+block+html.slice(endHeader+9);
  }
  if (!html.includes('id="bp-home-clarity-js"')) html = html.replace('</body>', js+'\n</body>');
  fs.writeFileSync(file, html);
}
console.log('Homepage clarity layer applied');
