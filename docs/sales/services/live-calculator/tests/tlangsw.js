const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok',m)};
const p=await b.newPage({viewport:{width:480,height:1000}});p.on('pageerror',e=>er.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
await p.goto('file://'+process.cwd()+'/index-client.html');await p.waitForTimeout(600);
const th=()=>p.evaluate(()=>document.getElementById('cs-thread').innerText);
await p.evaluate(()=>[...document.querySelectorAll('#cs-thread .chip')].find(x=>x.innerText==='English').click());await p.waitForTimeout(300);
let t=await th();ok(/I am your localisation/.test(t)&&!/أهلاً/.test(t),'EN welcome after choosing English');
ok(await p.evaluate(()=>document.getElementById('cs').dir==='ltr'),'dir ltr');
// go into a flow then switch via top bar
await p.click('[data-chip=goal][data-arg=assess]');await p.waitForTimeout(200);
await p.click('#cs-top button[data-arg=ar]');await p.waitForTimeout(300);
t=await th();ok(/أهلاً/.test(t)&&!/I am your localisation/.test(t),'AR thread after top-bar switch');
ok(/تغيّرت اللغة/.test(t),'language-change note');
ok(await p.evaluate(()=>document.getElementById('cs').dir==='rtl'),'dir rtl');
await p.click('#cs-top button[data-arg=fr]');await p.waitForTimeout(300);t=await th();ok(/Bonjour|assistant/i.test(t)&&!/أهلاً/.test(t),'FR thread');
// mic error dedupe
await p.click('#cs-top button[data-arg=ar]');await p.waitForTimeout(200);
await p.addInitScript(()=>{});
const r=await p.evaluate(()=>{class SR{start(){setTimeout(()=>{this.onerror({error:'not-allowed'});this.onerror({error:'service-not-allowed'});this.onend&&this.onend()},50)}stop(){}};window.SpeechRecognition=SR;window.webkitSpeechRecognition=SR;return 1});
console.log(er);if(er.length)fail++;await b.close();process.exit(fail?1:0)})();
