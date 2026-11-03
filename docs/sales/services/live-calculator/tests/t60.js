const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
for(const tab of ['lump','cost','rent','ot','nit','prof','hire','team','guides']){await p.click('[data-tab='+tab+']');await p.waitForTimeout(250);
 console.log(tab,'full bar(g-act):',!!(await p.$('#g-act')),'compact:',!!(await p.$('[data-gonit]')));}
await p.evaluate(()=>bpGo('prof'));await p.waitForTimeout(250);await p.click('[data-gonit]');await p.waitForTimeout(300);console.log('jump to nit ok:',!!(await p.$('#g-act')));
// activity set in nit tab still filters professions in lump
await p.click('#g-act');await p.fill('#g-act','561010');await p.waitForTimeout(350);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);
console.log('group:',await p.evaluate(()=>document.getElementById('g-grp').value));
await p.evaluate(()=>bpGo('lump'));await p.waitForTimeout(300);console.log('lump scope note:',(await p.evaluate(()=>document.querySelector('#main').innerText)).match(/تُعرض مهن مجال نشاطك[^\n]*/)?.[0]);
console.log(errs);await b.close();})();
