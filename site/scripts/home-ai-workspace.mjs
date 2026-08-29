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
.bp-ai-shell{direction:ltr;display:grid;grid-template-columns:220px minmax(0,1fr);min-height:calc(100vh - 72px);max-width:1440px;margin:0 auto;background:#fff;border-inline:1px solid #edf0f5}
.bp-ai-sidebar{background:#f4f5f8;border-right:1px solid #e5e8ef;padding:18px 12px;display:flex;flex-direction:column;gap:7px;min-width:0;color:#17213c}
[dir="rtl"] .bp-ai-sidebar{direction:rtl}
.bp-ai-new{display:flex;align-items:center;gap:9px;width:100%;border:1px solid #dfe3eb;background:#fff;color:#0B1B5A;border-radius:11px;padding:10px 11px;font:inherit;font-weight:700;cursor:pointer;text-align:start}
.bp-ai-new:hover{background:#fbfcff}
.bp-ai-side-label{font-size:.67rem;font-weight:800;color:#8a91a0;text-transform:uppercase;letter-spacing:.06em;margin:14px 8px 5px}
.bp-ai-link,.bp-ai-recent-item{display:flex;align-items:center;gap:9px;color:#333c50;text-decoration:none;border-radius:9px;padding:9px 10px;font-size:.83rem;border:0;background:transparent;width:100%;font-family:inherit;text-align:start;cursor:pointer}
.bp-ai-link:hover,.bp-ai-recent-item:hover{background:#e9ebf1;color:#0B1B5A}
.bp-ai-side-icon{width:20px;text-align:center;opacity:.72}
.bp-ai-recent{display:grid;gap:2px;min-height:0}
.bp-ai-recent-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-ai-side-bottom{margin-top:auto;padding-top:12px;border-top:1px solid #e1e4ea}
.bp-ai-main{direction:ltr;min-width:0;display:flex;justify-content:center;background:#fff}
[dir="rtl"] .bp-ai-main{direction:rtl}
.bp-ai-stage{width:min(100%,900px);min-height:calc(100vh - 72px);display:flex;flex-direction:column;padding:24px 28px 18px}
.bp-ai-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:8px;padding:0 4px}
.bp-ai-agent{display:flex;align-items:center;gap:9px;font-weight:800;color:#0B1B5A;font-size:.9rem}
.bp-ai-status{width:8px;height:8px;border-radius:50%;background:#20b15a;box-shadow:0 0 0 4px rgba(32,177,90,.1)}
.bp-ai-tech{font-size:.7rem;color:#8b92a1;background:#f5f6f9;border:1px solid #e8eaf0;border-radius:99px;padding:5px 8px}
body.bp-ai-workspace .hero-start{border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;max-width:none!important;width:100%!important;background:transparent!important;flex:1;display:flex!important}
body.bp-ai-workspace .cs-wrap{border:0!important;box-shadow:none!important;border-radius:0!important;background:transparent!important;width:100%;display:flex;flex-direction:column}
body.bp-ai-workspace .cs-head{display:none!important}
body.bp-ai-workspace .cs-chat{padding:0!important;display:flex;flex-direction:column;flex:1;min-height:0}
body.bp-ai-workspace #homeAiReply{flex:1;min-height:330px;max-height:none!important;overflow-y:auto;padding:18px 8px 120px!important;margin:0!important}
body.bp-ai-workspace .ha-row{max-width:760px;width:100%;margin:14px auto!important}
body.bp-ai-workspace .ha-assistant .ha-bubble{background:transparent!important;padding:5px 7px!important;font-size:.97rem;line-height:1.85;flex-basis:auto!important;max-width:calc(100% - 46px)}
body.bp-ai-workspace .ha-avatar{border-radius:50%!important;width:32px!important;height:32px!important;flex-basis:32px!important;font-size:.72rem}
body.bp-ai-workspace .ha-user .ha-bubble{background:#f1f3f7!important;color:#192238!important;border-radius:18px!important;padding:11px 15px!important;max-width:72%!important}
body.bp-ai-workspace .cs-chips{max-width:760px;width:100%;margin:0 auto 12px!important;justify-content:center;padding:0!important}
body.bp-ai-workspace .cs-chip{background:#fff!important;border:1px solid #dfe3eb!important;color:#26324b!important;border-radius:12px!important;font-size:.78rem!important;font-weight:600!important}
body.bp-ai-workspace .cs-chip:hover{background:#f4f6f9!important;color:#0B1B5A!important}
body.bp-ai-workspace .cs-form{position:sticky!important;bottom:12px!important;max-width:760px;width:100%;margin:0 auto 5px!important;border:1px solid #d8dde7!important;border-radius:18px!important;padding:7px!important;background:#fff!important;box-shadow:0 8px 28px rgba(17,30,75,.11)!important}
body.bp-ai-workspace .cs-input{font-size:16px!important;padding:12px 11px!important}
body.bp-ai-workspace .cs-send{border-radius:12px!important;width:44px!important;height:44px!important;flex-basis:44px!important}
body.bp-ai-workspace .cs-results,body.bp-ai-workspace .cs-status,body.bp-ai-workspace .cs-footer,body.bp-ai-workspace .wa-float,body.bp-ai-workspace .chat-widget,body.bp-ai-workspace .floating-chat{display:none!important}
body.bp-ai-workspace .bp-compact-footer{display:none!important}
@media(max-width:820px){
 .bp-ai-shell{grid-template-columns:1fr;min-height:calc(100vh - 64px);border:0}
 .bp-ai-sidebar{direction:ltr!important;border-right:0;border-bottom:1px solid #e5e8ef;padding:8px 10px;display:flex;flex-direction:row;align-items:center;overflow-x:auto;gap:5px}
 [dir="rtl"] .bp-ai-sidebar{direction:rtl!important}
 .bp-ai-new,.bp-ai-link{width:auto;white-space:nowrap;padding:8px 10px;flex:0 0 auto}
 .bp-ai-side-label,.bp-ai-recent,.bp-ai-side-bottom{display:none!important}
 .bp-ai-stage{min-height:calc(100vh - 116px);padding:14px 12px 10px}
 .bp-ai-topbar{margin-bottom:2px}
 body.bp-ai-workspace #homeAiReply{padding:8px 3px 105px!important;min-height:350px}
 body.bp-ai-workspace .ha-user .ha-bubble{max-width:86%!important}
 body.bp-ai-workspace .cs-chips{justify-content:flex-start;flex-wrap:nowrap!important;overflow-x:auto!important;padding:0 2px 4px!important}
 body.bp-ai-workspace .cs-form{bottom:7px!important}
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
      <a class="bp-ai-link" href="'+p+'/services"><span class="bp-ai-side-icon">⌘</span><span>'+(ar?'الخدمات':'Services')+'</span></a>\
      <a class="bp-ai-link" href="'+p+'/account"><span class="bp-ai-side-icon">▣</span><span>'+(ar?'طلباتي':'My requests')+'</span></a>\
      <a class="bp-ai-link" href="'+p+'/account"><span class="bp-ai-side-icon">○</span><span>'+(ar?'حسابي':'Account')+'</span></a>\
      <div class="bp-ai-side-label">'+(ar?'محادثات سابقة':'Recent')+'</div>\
      <div class="bp-ai-recent" id="bpAiRecent"></div>\
      <div class="bp-ai-side-bottom"><a class="bp-ai-link" href="'+p+'/about"><span class="bp-ai-side-icon">i</span><span>'+(ar?'عن Business Partner':'About Business Partner')+'</span></a></div>';

    var main=document.createElement('main'); main.className='bp-ai-main';
    var stage=document.createElement('div'); stage.className='bp-ai-stage';
    var top=document.createElement('div'); top.className='bp-ai-topbar';
    top.innerHTML='<div class="bp-ai-agent"><span class="bp-ai-status"></span><span>'+(ar?'مستشار Business Partner الذكي':'Business Partner AI Advisor')+'</span></div><span class="bp-ai-tech">AI + Government Operations</span>';
    stage.appendChild(top); stage.appendChild(start); main.appendChild(stage);
    shell.appendChild(side); shell.appendChild(main);
    container.innerHTML=''; container.appendChild(shell);

    var recent=document.getElementById('bpAiRecent');
    function getRecent(){try{return JSON.parse(localStorage.getItem('bp_ai_recent')||'[]')}catch(e){return[]}}
    function draw(){
      var items=getRecent().slice(0,6); recent.innerHTML='';
      if(!items.length){var empty=document.createElement('div');empty.style.cssText='font-size:.74rem;color:#9298a5;padding:7px 10px';empty.textContent=ar?'لا توجد محادثات بعد':'No conversations yet';recent.appendChild(empty);return}
      items.forEach(function(t){var b=document.createElement('button');b.type='button';b.className='bp-ai-recent-item';b.innerHTML='<span>◌</span><span></span>';b.lastChild.textContent=t;b.onclick=function(){var inp=document.getElementById('csInput');if(inp){inp.value=t;inp.focus()}};recent.appendChild(b)});
    }
    function save(t){t=String(t||'').trim();if(!t)return;var a=getRecent().filter(function(x){return x!==t});a.unshift(t.slice(0,70));try{localStorage.setItem('bp_ai_recent',JSON.stringify(a.slice(0,8)))}catch(e){}draw()}
    draw();
    var hist=document.getElementById('homeAiReply');
    if(hist){new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;var b=n.matches&&n.matches('.ha-user')?n.querySelector('.ha-bubble'):n.querySelector&&n.querySelector('.ha-user .ha-bubble');if(b)save(b.textContent)})})}).observe(hist,{childList:true,subtree:true})}
    var newBtn=document.getElementById('bpNewChat'); if(newBtn)newBtn.onclick=function(){location.reload()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;

for(const rel of ['index.html','ar/index.html']){
  const file=path.join(ROOT,rel); if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes('bp-ai-workspace-css')) html=html.replace('</head>',STYLE+'</head>');
  if(!html.includes('bp-ai-workspace-js')) html=html.replace('</body>',SCRIPT+'</body>');
  fs.writeFileSync(file,html);
  console.log('AI workspace applied:',rel);
}
