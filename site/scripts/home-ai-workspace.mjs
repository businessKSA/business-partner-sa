import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');

const STYLE = `
<style id="bp-ai-workspace-css">
body.bp-ai-workspace{background:#f7f8fb}
body.bp-ai-workspace .site-header .nav{display:none!important}
body.bp-ai-workspace .site-header{box-shadow:none;border-bottom:1px solid #e8ebf2;background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}
body.bp-ai-workspace .hero{padding:0!important;min-height:calc(100vh - 72px)!important;background:#f7f8fb!important;align-items:stretch!important}
body.bp-ai-workspace .hero>.container{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
.bp-ai-shell{direction:ltr;display:grid;grid-template-columns:218px minmax(0,1fr);min-height:calc(100vh - 72px);max-width:1480px;margin:0 auto;background:#fff;border-inline:1px solid #edf0f5}
.bp-ai-sidebar{background:#f5f6f8;border-right:1px solid #e5e8ef;padding:16px 11px;display:flex;flex-direction:column;gap:6px;min-width:0;color:#17213c}
[dir="rtl"] .bp-ai-sidebar{direction:rtl}
.bp-ai-new{display:flex;align-items:center;gap:9px;width:100%;border:1px solid #dde2eb;background:#fff;color:#0B1B5A;border-radius:11px;padding:10px 11px;font:inherit;font-weight:750;cursor:pointer;text-align:start;box-shadow:0 1px 2px rgba(12,28,75,.03)}
.bp-ai-new:hover{background:#fbfcff;border-color:#cfd6e3}
.bp-ai-side-label{font-size:.65rem;font-weight:800;color:#939aa8;text-transform:uppercase;letter-spacing:.07em;margin:13px 8px 4px}
.bp-ai-link,.bp-ai-recent-item{display:flex;align-items:center;gap:9px;color:#394258;text-decoration:none;border-radius:9px;padding:9px 10px;font-size:.81rem;border:0;background:transparent;width:100%;font-family:inherit;text-align:start;cursor:pointer}
.bp-ai-link:hover,.bp-ai-recent-item:hover{background:#e9ecf2;color:#0B1B5A}
.bp-ai-link.bp-side-b10x{background:linear-gradient(135deg,#eef3ff,#f8faff);color:#0B1B5A;border:1px solid #e0e7f7;font-weight:800}
.bp-ai-link.bp-side-b10x:hover{border-color:#c9d5f1;background:#edf3ff}
.bp-ai-side-icon{width:20px;text-align:center;opacity:.78;font-weight:800}
.bp-ai-recent{display:grid;gap:2px;min-height:0}
.bp-ai-recent-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-ai-side-bottom{margin-top:auto;padding-top:11px;border-top:1px solid #e1e4ea}
.bp-ai-main{direction:ltr;min-width:0;display:flex;justify-content:center;background:#fff}
[dir="rtl"] .bp-ai-main{direction:rtl}
.bp-ai-stage{width:min(100%,1120px);min-height:calc(100vh - 72px);display:flex;flex-direction:column;padding:20px 28px 16px;transition:max-width .2s ease}
.bp-ai-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:8px;padding:0 4px}
.bp-ai-agent{display:flex;align-items:center;gap:9px;font-weight:800;color:#0B1B5A;font-size:.88rem}
.bp-ai-status{width:8px;height:8px;border-radius:50%;background:#20b15a;box-shadow:0 0 0 4px rgba(32,177,90,.1)}
.bp-ai-tech{font-size:.68rem;color:#7d8595;background:#f5f6f9;border:1px solid #e8eaf0;border-radius:99px;padding:5px 9px}

/* Welcome capability layer: product value is visible without turning the page into a catalog. */
.bp-ai-welcome{max-width:920px;width:100%;margin:9px auto 10px;transition:opacity .18s ease,transform .18s ease,max-height .25s ease;max-height:720px;overflow:hidden}
.bp-ai-welcome-head{text-align:center;margin:4px auto 16px;max-width:680px}
.bp-ai-welcome-kicker{display:inline-flex;align-items:center;gap:7px;color:#315396;background:#f3f6fd;border:1px solid #e4eafa;border-radius:999px;padding:5px 9px;font-size:.68rem;font-weight:800;margin-bottom:8px}
.bp-ai-welcome h1{margin:0;color:#0B1B5A;font-size:clamp(1.55rem,3vw,2.2rem);letter-spacing:-.035em;line-height:1.15}
.bp-ai-welcome-head p{margin:8px 0 0;color:#667085;font-size:.88rem;line-height:1.7}
.bp-ai-all-services{display:inline-block;margin-top:7px;color:#315396;text-decoration:none;font-size:.73rem;font-weight:750}
.bp-ai-all-services:hover{text-decoration:underline}
.bp-cap-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.bp-cap-card{position:relative;min-height:112px;border:1px solid #e2e6ee;background:#fff;border-radius:16px;padding:15px;text-align:start;font-family:inherit;cursor:pointer;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;color:#16203a}
.bp-cap-card:hover{transform:translateY(-2px);border-color:#cfd8e9;box-shadow:0 10px 28px rgba(15,35,86,.08)}
.bp-cap-card:focus-visible,.bp-demo-card:focus-visible{outline:3px solid rgba(35,88,186,.22);outline-offset:2px}
.bp-cap-featured{grid-column:span 2;grid-row:span 2;min-height:234px;color:#fff;border:0;background:linear-gradient(135deg,#06133d 0%,#0b2367 54%,#164aa9 100%);padding:20px;box-shadow:0 16px 38px rgba(7,28,86,.18)}
.bp-cap-featured:hover{border:0;box-shadow:0 20px 45px rgba(7,28,86,.24)}
.bp-b10x-water{position:absolute;inset:auto -8px -31px auto;font-size:6.6rem;font-weight:900;letter-spacing:-.09em;color:rgba(255,255,255,.07);line-height:1;pointer-events:none}
[dir="rtl"] .bp-b10x-water{inset:auto auto -31px -8px}
.bp-cap-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 8px;font-size:.64rem;font-weight:850;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);color:#fff;margin-bottom:19px}
.bp-cap-featured h2{margin:0 0 7px;font-size:1.55rem;letter-spacing:-.03em;color:#fff}
.bp-cap-featured p{margin:0;max-width:430px;color:rgba(255,255,255,.76);font-size:.82rem;line-height:1.7}
.bp-cap-featured .bp-cap-open{position:absolute;inset:auto 20px 18px auto;color:#fff;font-size:.75rem;font-weight:800}
[dir="rtl"] .bp-cap-featured .bp-cap-open{inset:auto auto 18px 20px}
.bp-cap-icon{width:39px;height:39px;border-radius:12px;display:grid;place-items:center;background:#f1f5fc;color:#174994;font-size:1rem;font-weight:900;margin-bottom:12px;border:1px solid #e4eaf5}
.bp-cap-card h3{margin:0 0 5px;color:#111f45;font-size:.88rem}
.bp-cap-card p{margin:0;color:#71798a;font-size:.7rem;line-height:1.55}
.bp-cap-arrow{position:absolute;top:14px;inset-inline-end:14px;color:#a2a9b7;font-size:.8rem}
.bp-cap-secondary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:9px}
.bp-cap-slim{display:flex;align-items:center;gap:10px;border:1px solid #e5e8ef;background:#fafbfc;border-radius:13px;padding:10px 12px;text-align:start;font:inherit;color:#29354d;cursor:pointer;min-width:0}
.bp-cap-slim:hover{background:#f5f7fb;border-color:#d8dfe9}
.bp-cap-slim-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff;border:1px solid #e4e8ef;color:#315396;font-weight:850;flex:0 0 30px}
.bp-cap-slim strong{display:block;color:#15234a;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-cap-slim span:last-child{display:block;color:#848b99;font-size:.64rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.bp-demo-head{display:flex;align-items:center;justify-content:space-between;margin:15px 2px 7px;gap:10px}
.bp-demo-head strong{color:#27324c;font-size:.76rem}
.bp-demo-head span{color:#949aa7;font-size:.64rem}
.bp-demo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.bp-demo-card{border:1px solid #e5e8ef;background:#fff;border-radius:14px;padding:10px 11px;text-align:start;font:inherit;cursor:pointer;color:#28344d;min-height:86px;transition:border-color .16s ease,box-shadow .16s ease}
.bp-demo-card:hover{border-color:#cfd7e4;box-shadow:0 7px 20px rgba(15,35,86,.05)}
.bp-demo-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.bp-demo-top strong{font-size:.72rem;color:#17264e}
.bp-demo-dots{display:flex;gap:3px}
.bp-demo-dots i{width:4px;height:4px;border-radius:50%;background:#cbd1db;display:block}
.bp-demo-ui{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.bp-demo-ui span{display:block;height:22px;border-radius:7px;background:#f2f4f8;border:1px solid #eceff4;color:#7f8796;font-size:.55rem;display:grid;place-items:center;overflow:hidden;white-space:nowrap;padding:0 3px}
.bp-demo-card[data-demo="packages"] .bp-demo-ui span:first-child{background:#edf3ff;color:#285198;border-color:#dfe8fa}
body.bp-ai-active .bp-ai-welcome{opacity:0;transform:translateY(-8px);max-height:0;margin-top:0;margin-bottom:0;pointer-events:none}
body.bp-ai-active .bp-ai-stage{width:min(100%,920px)}

body.bp-ai-workspace .hero-start{border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;max-width:none!important;width:100%!important;background:transparent!important;flex:1;display:flex!important}
body.bp-ai-workspace .cs-wrap{border:0!important;box-shadow:none!important;border-radius:0!important;background:transparent!important;width:100%;display:flex;flex-direction:column}
body.bp-ai-workspace .cs-head{display:none!important}
body.bp-ai-workspace .cs-chat{padding:0!important;display:flex;flex-direction:column;flex:1;min-height:0}
body.bp-ai-workspace #homeAiReply{flex:0 0 auto;min-height:90px;max-height:165px!important;overflow-y:auto;padding:7px 8px 10px!important;margin:0!important}
body.bp-ai-active #homeAiReply{flex:1 1 auto;min-height:370px;max-height:none!important;padding:18px 8px 120px!important}
body.bp-ai-workspace .ha-row{max-width:790px;width:100%;margin:10px auto!important}
body.bp-ai-workspace .ha-assistant .ha-bubble{background:transparent!important;padding:5px 7px!important;font-size:.94rem;line-height:1.82;flex-basis:auto!important;max-width:calc(100% - 46px)}
body.bp-ai-workspace .ha-avatar{border-radius:50%!important;width:32px!important;height:32px!important;flex-basis:32px!important;font-size:.72rem}
body.bp-ai-workspace .ha-user .ha-bubble{background:#f1f3f7!important;color:#192238!important;border-radius:18px!important;padding:11px 15px!important;max-width:72%!important}
body.bp-ai-workspace .cs-chips{display:none!important}
body.bp-ai-workspace .cs-form{position:sticky!important;bottom:10px!important;max-width:790px;width:100%;margin:0 auto 5px!important;border:1px solid #d8dde7!important;border-radius:18px!important;padding:7px!important;background:#fff!important;box-shadow:0 9px 30px rgba(17,30,75,.11)!important;z-index:4}
body.bp-ai-workspace .cs-input{font-size:16px!important;padding:12px 11px!important}
body.bp-ai-workspace .cs-send{border-radius:12px!important;width:44px!important;height:44px!important;flex-basis:44px!important}
body.bp-ai-workspace .cs-results,body.bp-ai-workspace .cs-status,body.bp-ai-workspace .cs-footer,body.bp-ai-workspace .wa-float,body.bp-ai-workspace .chat-widget,body.bp-ai-workspace .floating-chat{display:none!important}

@media(max-width:980px){
 .bp-cap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .bp-cap-featured{grid-column:span 2;grid-row:auto;min-height:200px}
 .bp-cap-secondary{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(max-width:820px){
 .bp-ai-shell{grid-template-columns:1fr;min-height:calc(100vh - 64px);border:0}
 .bp-ai-sidebar{direction:ltr!important;border-right:0;border-bottom:1px solid #e5e8ef;padding:8px 10px;display:flex;flex-direction:row;align-items:center;overflow-x:auto;gap:5px;position:sticky;top:0;z-index:6}
 [dir="rtl"] .bp-ai-sidebar{direction:rtl!important}
 .bp-ai-new,.bp-ai-link{width:auto;white-space:nowrap;padding:8px 10px;flex:0 0 auto}
 .bp-ai-side-label,.bp-ai-recent,.bp-ai-side-bottom{display:none!important}
 .bp-ai-stage{min-height:calc(100vh - 116px);padding:13px 12px 9px}
 .bp-ai-topbar{margin-bottom:1px}
 .bp-ai-welcome{margin-top:5px}
 .bp-ai-welcome-head{margin-bottom:12px}
 .bp-demo-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:3px}
 .bp-demo-card{min-width:210px;scroll-snap-align:start}
 body.bp-ai-workspace #homeAiReply{min-height:86px;max-height:140px!important;padding:5px 3px 8px!important}
 body.bp-ai-active #homeAiReply{max-height:none!important;min-height:380px;padding:8px 3px 105px!important}
 body.bp-ai-workspace .ha-user .ha-bubble{max-width:86%!important}
 body.bp-ai-workspace .cs-form{bottom:7px!important}
}
@media(max-width:560px){
 .bp-ai-stage{padding-inline:10px}
 .bp-ai-tech{display:none}
 .bp-ai-agent{font-size:.8rem}
 .bp-ai-welcome h1{font-size:1.55rem}
 .bp-ai-welcome-head p{font-size:.78rem}
 .bp-cap-grid{gap:8px}
 .bp-cap-featured{grid-column:span 2;min-height:185px;padding:17px}
 .bp-cap-featured h2{font-size:1.3rem}
 .bp-b10x-water{font-size:5.4rem}
 .bp-cap-card:not(.bp-cap-featured){min-height:116px;padding:12px}
 .bp-cap-icon{width:34px;height:34px;margin-bottom:9px}
 .bp-cap-card h3{font-size:.79rem}
 .bp-cap-card p{font-size:.64rem}
 .bp-cap-secondary{display:flex;overflow-x:auto;gap:7px;padding-bottom:2px}
 .bp-cap-slim{min-width:185px}
 .bp-demo-head{margin-top:12px}
}
</style>`;

const SCRIPT = `
<script id="bp-ai-workspace-js">
(function(){
  function init(){
    var hero=document.querySelector('.hero');
    var start=document.getElementById('heroStart');
    var root=document.getElementById('serviceAssistant');
    if(!hero||!start||!root||start.closest('.bp-ai-shell'))return;
    document.body.classList.add('bp-ai-workspace');
    var ar=(document.documentElement.lang||'').toLowerCase().indexOf('ar')===0;
    var p=ar?'/ar':'';
    var container=hero.querySelector(':scope > .container')||hero.querySelector('.container');
    if(!container)return;

    var shell=document.createElement('div'); shell.className='bp-ai-shell';
    var side=document.createElement('aside'); side.className='bp-ai-sidebar';
    side.innerHTML='\
      <button type="button" class="bp-ai-new" id="bpNewChat"><span>＋</span><span>'+(ar?'محادثة جديدة':'New chat')+'</span></button>\
      <div class="bp-ai-side-label">'+(ar?'الوصول السريع':'Quick access')+'</div>\
      <button type="button" class="bp-ai-link bp-side-b10x" data-prompt="'+(ar?'اشرح لي B10X وكيف يمكن أن يدعم تشغيل شركتي':'Explain B10X and how it can support my business operations')+'"><span class="bp-ai-side-icon">10X</span><span>B10X</span></button>\
      <a class="bp-ai-link" href="'+p+'/services"><span class="bp-ai-side-icon">⌘</span><span>'+(ar?'كل الخدمات':'All services')+'</span></a>\
      <a class="bp-ai-link" href="'+p+'/account"><span class="bp-ai-side-icon">▣</span><span>'+(ar?'طلباتي':'My requests')+'</span></a>\
      <a class="bp-ai-link" href="'+p+'/account"><span class="bp-ai-side-icon">○</span><span>'+(ar?'حسابي':'Account')+'</span></a>\
      <div class="bp-ai-side-label">'+(ar?'محادثات سابقة':'Recent')+'</div>\
      <div class="bp-ai-recent" id="bpAiRecent"></div>\
      <div class="bp-ai-side-bottom"><a class="bp-ai-link" href="'+p+'/about"><span class="bp-ai-side-icon">i</span><span>'+(ar?'عن Business Partner':'About Business Partner')+'</span></a></div>';

    var main=document.createElement('main'); main.className='bp-ai-main';
    var stage=document.createElement('div'); stage.className='bp-ai-stage';
    var top=document.createElement('div'); top.className='bp-ai-topbar';
    top.innerHTML='<div class="bp-ai-agent"><span class="bp-ai-status"></span><span>'+(ar?'مستشار Business Partner الذكي':'Business Partner AI Advisor')+'</span></div><span class="bp-ai-tech">AI + Saudi Business Operations</span>';

    var welcome=document.createElement('section'); welcome.className='bp-ai-welcome'; welcome.id='bpAiWelcome';
    welcome.innerHTML='<div class="bp-ai-welcome-head">\
      <span class="bp-ai-welcome-kicker">✦ '+(ar?'Business Partner مدعوم بالذكاء الاصطناعي':'AI-powered Business Partner')+'</span>\
      <h1>'+(ar?'وش تبغى تنجز اليوم؟':'What do you want to get done today?')+'</h1>\
      <p>'+(ar?'تكلم مع المستشار مباشرة، أو ابدأ من إحدى قدرات Business Partner الرئيسية. كل التفاصيل والخدمات تظهر لك فقط وقت الحاجة.':'Talk to the advisor directly, or start from one of Business Partner core capabilities. Details appear only when you need them.')+'</p>\
      <a class="bp-ai-all-services" href="'+p+'/services">'+(ar?'استعرض جميع الخدمات ←':'Browse all services →')+'</a>\
    </div>\
    <div class="bp-cap-grid" id="bpCapGrid"></div>\
    <div class="bp-cap-secondary" id="bpCapSecondary"></div>\
    <div class="bp-demo-head"><strong>'+(ar?'شاهد كيف تعمل المنصة':'See the platform in action')+'</strong><span>'+(ar?'نماذج تفاعلية داخل المحادثة':'Interactive previews through the advisor')+'</span></div>\
    <div class="bp-demo-grid" id="bpDemoGrid"></div>';

    stage.appendChild(top); stage.appendChild(welcome); stage.appendChild(start); main.appendChild(stage);
    shell.appendChild(side); shell.appendChild(main);
    container.innerHTML=''; container.appendChild(shell);

    function cap(o){
      var b=document.createElement('button'); b.type='button'; b.className='bp-cap-card'+(o.featured?' bp-cap-featured':''); b.setAttribute('data-prompt',o.prompt);
      if(o.featured){
        b.innerHTML='<span class="bp-b10x-water">B10X</span><span class="bp-cap-badge">✦ Business Partner 10X</span><h2>B10X</h2><p>'+o.desc+'</p><span class="bp-cap-open">'+(ar?'اكتشف B10X ←':'Explore B10X →')+'</span>';
      }else{
        b.innerHTML='<span class="bp-cap-arrow">↗</span><span class="bp-cap-icon">'+o.icon+'</span><h3>'+o.title+'</h3><p>'+o.desc+'</p>';
      }
      return b;
    }
    var capGrid=document.getElementById('bpCapGrid');
    var caps=ar?[
      {featured:true,desc:'نموذج تشغيل متكامل يجمع الوكلاء الذكيين والخدمات المشتركة والامتثال والتنفيذ في تجربة واحدة.',prompt:'اشرح لي B10X بالتفصيل وكيف يناسب شركتي وما الذي يقدمه لي'},
      {icon:'⧉',title:'الخدمات المشتركة',desc:'تشغيل ودعم الأعمال من مكان واحد.',prompt:'أبغى أعرف كيف تعمل خدمة الخدمات المشتركة وما الذي يمكنكم تشغيله عن شركتي'},
      {icon:'✓',title:'وكيل الامتثال',desc:'فهم الالتزامات والمخاطر والإجراءات المطلوبة.',prompt:'ورني كيف يعمل وكيل الامتثال وكيف يساعد شركتي في الالتزام'},
      {icon:'▤',title:'Document AI',desc:'أدوات ذكية للمستندات والقراءة والتجهيز.',prompt:'ورني أدوات Document AI والمستندات الذكية الموجودة عندكم وكيف أستفيد منها'},
      {icon:'✦',title:'الوكلاء الذكيون',desc:'مستشارون رقميون لمهام الأعمال المتكررة.',prompt:'ما هي الوكلاء الذكيين الموجودة في Business Partner وكيف أقدر أستخدمها'}
    ]:[
      {featured:true,desc:'An integrated operating model combining AI agents, shared services, compliance and execution in one experience.',prompt:'Explain B10X in detail, how it fits my company, and what it can do for me'},
      {icon:'⧉',title:'Shared Services',desc:'Business operations and support from one place.',prompt:'Show me how Business Partner Shared Services work and what you can operate for my company'},
      {icon:'✓',title:'Compliance Agent',desc:'Understand obligations, risks and required actions.',prompt:'Show me how the Compliance Agent works and how it can help my company'},
      {icon:'▤',title:'Document AI',desc:'Smart tools for reading and preparing business documents.',prompt:'Show me the Document AI tools available and how I can use them'},
      {icon:'✦',title:'AI Agents',desc:'Digital advisors for recurring business work.',prompt:'What AI agents are available in Business Partner and how can I use them'}
    ];
    caps.forEach(function(o){capGrid.appendChild(cap(o))});

    function slim(icon,title,sub,prompt){var b=document.createElement('button');b.type='button';b.className='bp-cap-slim';b.setAttribute('data-prompt',prompt);b.innerHTML='<span class="bp-cap-slim-icon">'+icon+'</span><span><strong>'+title+'</strong><span>'+sub+'</span></span>';return b}
    var secondary=document.getElementById('bpCapSecondary');
    if(ar){
      secondary.appendChild(slim('⌘','العمليات الحكومية','تأسيس · تراخيص · منصات','عندي إجراء أو معاملة حكومية وأبغى المستشار يحدد لي الطريق الصحيح'));
      secondary.appendChild(slim('↗','BDaaS','عملاء · موردون · شركاء','اشرح لي Business Development as a Service وكيف تساعدوني في إيجاد عملاء أو موردين أو شركاء'));
      secondary.appendChild(slim('◫','الباقات','حلول حسب مرحلة شركتك','ورني باقات Business Partner وساعدني أختار الأنسب حسب احتياجي'));
    }else{
      secondary.appendChild(slim('⌘','Government Operations','Formation · licences · portals','I need help with a Saudi government process and want the advisor to guide me'));
      secondary.appendChild(slim('↗','BDaaS','Customers · suppliers · partners','Explain Business Development as a Service and how you can help me find customers, suppliers or partners'));
      secondary.appendChild(slim('◫','Packages','Solutions for each business stage','Show me Business Partner packages and help me choose the right one'));
    }

    function demo(type,title,labels,prompt){var b=document.createElement('button');b.type='button';b.className='bp-demo-card';b.setAttribute('data-demo',type);b.setAttribute('data-prompt',prompt);b.innerHTML='<div class="bp-demo-top"><strong>'+title+'</strong><span class="bp-demo-dots"><i></i><i></i><i></i></span></div><div class="bp-demo-ui">'+labels.map(function(x){return '<span>'+x+'</span>'}).join('')+'</div>';return b}
    var demos=document.getElementById('bpDemoGrid');
    if(ar){
      demos.appendChild(demo('client','لوحة العميل',['الطلبات','المستندات','الفواتير'],'ورني ديمو لوحة العميل وما الذي يستطيع العميل متابعته وتنفيذه منها'));
      demos.appendChild(demo('partners','لوحة الشركاء',['الفرص','العروض','المهام'],'ورني ديمو لوحة الشركاء والموردين وكيف يعمل التعاون والفرص فيها'));
      demos.appendChild(demo('packages','الباقات',['تأسيس','تشغيل','Enterprise'],'ورني الباقات كديمو وساعدني أعرف أي نوع يناسب شركتي'));
    }else{
      demos.appendChild(demo('client','Client Workspace',['Requests','Documents','Billing'],'Show me a demo of the client workspace and what clients can manage there'));
      demos.appendChild(demo('partners','Partner Hub',['Opportunities','Quotes','Tasks'],'Show me a demo of the partner and supplier hub and how collaboration works'));
      demos.appendChild(demo('packages','Packages',['Setup','Managed','Enterprise'],'Show me the packages as a demo and help me understand which model fits my company'));
    }

    var input=document.getElementById('csInput'); var form=document.getElementById('csForm');
    function askPrompt(q){q=String(q||'').trim();if(!q||!input||!form)return;document.body.classList.add('bp-ai-active');input.value=q;form.requestSubmit()}
    shell.addEventListener('click',function(e){var t=e.target.closest('[data-prompt]');if(!t)return;e.preventDefault();askPrompt(t.getAttribute('data-prompt'))});

    var recent=document.getElementById('bpAiRecent');
    function getRecent(){try{return JSON.parse(localStorage.getItem('bp_ai_recent')||'[]')}catch(e){return[]}}
    function draw(){
      var items=getRecent().slice(0,6); recent.innerHTML='';
      if(!items.length){var empty=document.createElement('div');empty.style.cssText='font-size:.72rem;color:#9298a5;padding:7px 10px';empty.textContent=ar?'لا توجد محادثات بعد':'No conversations yet';recent.appendChild(empty);return}
      items.forEach(function(t){var b=document.createElement('button');b.type='button';b.className='bp-ai-recent-item';b.innerHTML='<span>◌</span><span></span>';b.lastChild.textContent=t;b.onclick=function(){if(input){input.value=t;input.focus()}};recent.appendChild(b)});
    }
    function save(t){t=String(t||'').trim();if(!t)return;var a=getRecent().filter(function(x){return x!==t});a.unshift(t.slice(0,70));try{localStorage.setItem('bp_ai_recent',JSON.stringify(a.slice(0,8)))}catch(e){}draw()}
    draw();
    var hist=document.getElementById('homeAiReply');
    if(hist){new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;var b=n.matches&&n.matches('.ha-user')?n.querySelector('.ha-bubble'):n.querySelector&&n.querySelector('.ha-user .ha-bubble');if(b){document.body.classList.add('bp-ai-active');save(b.textContent)}})})}).observe(hist,{childList:true,subtree:true})}
    var newBtn=document.getElementById('bpNewChat'); if(newBtn)newBtn.onclick=function(){location.reload()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;

for(const rel of ['index.html','ar/index.html']){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<style id="bp-ai-workspace-css">[\s\S]*?<\/style>/, STYLE.replace(/^\n|\n$/g,''));
  html=html.replace(/<script id="bp-ai-workspace-js">[\s\S]*?<\/script>/, SCRIPT.replace(/^\n|\n$/g,''));
  if(!html.includes('bp-ai-workspace-css')) html=html.replace('</head>',STYLE+'</head>');
  if(!html.includes('bp-ai-workspace-js')) html=html.replace('</body>',SCRIPT+'</body>');
  fs.writeFileSync(file,html);
  console.log('AI product workspace applied:',rel);
}
