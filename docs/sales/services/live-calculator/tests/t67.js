const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1000,height:1400}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess&ui=classic');await p.waitForTimeout(300);
console.log('combo bars:',await p.$$eval('input.cmb',e=>e.length),'| plain selects visible:',await p.$$eval('select',e=>e.filter(s=>s.style.display!=='none').length));
console.log((await p.$$eval('input.cmb',e=>e.map(i=>i.id+'['+i.placeholder+']='+i.value))).join('\n'));
// functional: pick term 6 through the combo, gender female, insurance VIP
const pick=async(id,text)=>{await p.click('#'+id+'-s');await p.waitForTimeout(200);await p.fill('#'+id+'-s',text);await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);};
await pick('l-term','6 أشهر');console.log('term now:',await p.evaluate(()=>document.getElementById('l-term').value));
await pick('i-gender','أنثى');console.log('gender:',await p.evaluate(()=>document.getElementById('i-gender').value));
console.log(errs);await b.close();})();
