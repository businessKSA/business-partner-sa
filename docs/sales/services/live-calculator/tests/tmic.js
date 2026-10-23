const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const er=[];let fail=0;const p=await b.newPage();p.on('pageerror',e=>er.push(e.message));
await p.addInitScript(()=>{class SR{start(){setTimeout(()=>{this.onresult({results:[Object.assign([{transcript:'أضف مطعم النخيل'}],{isFinal:true})]});this.onend&&this.onend()},100)}stop(){}};window.SpeechRecognition=SR;window.webkitSpeechRecognition=SR;});
await p.goto('file://'+process.cwd()+'/index-client.html?lang=ar');await p.waitForTimeout(700);
await p.click('#cs-mic');await p.waitForTimeout(700);const v=await p.inputValue('#cs-t');console.log('text:',v);if(!v.includes('النخيل'))fail++;
const th=await p.evaluate(()=>document.getElementById('cs-thread').innerText);if(!th.includes('التقطته'))fail++;
console.log(er);await b.close();process.exit(fail||er.length?1:0)})();
