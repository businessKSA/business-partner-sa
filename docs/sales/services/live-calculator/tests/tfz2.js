const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:3000}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.cwd()+'/index-fawaz.html');await p.waitForTimeout(500);
let t=await p.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].slice(0,13).map(r=>r.innerText.replace(/\s+/g,' ').slice(0,150)));console.log(t.join('\n'));
// open an establishment with act and one without
await p.click('[data-co-open="11"]');await p.waitForTimeout(300);
console.log('open#11 act field:',await p.evaluate(()=>document.getElementById('g-act').value.slice(0,70)),'| group:',await p.evaluate(()=>document.getElementById('g-grp').selectedOptions[0].textContent));
await p.click('[data-co-open="0"]');await p.waitForTimeout(300);
console.log('open#0 act field:',await p.evaluate(()=>document.getElementById('g-act').value||'(empty)'));
await p.fill('#g-act','تشغيل');await p.waitForTimeout(300);await p.click('.dd .it');await p.waitForTimeout(400);
console.log('after pick:',await p.evaluate(()=>[document.getElementById('g-act').value.slice(0,60),document.getElementById('g-grp').selectedOptions[0].textContent,document.querySelector('#main tbody tr').innerText.replace(/\s+/g,' ').slice(0,160)]));
await p.screenshot({path:'co-fawaz.png',fullPage:false});await b.close();})();
