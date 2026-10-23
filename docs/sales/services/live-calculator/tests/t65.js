const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/index.html?goal=assess');await p.waitForTimeout(300);
for(const tab of ['lump','cost','hire']){await p.click('[data-tab='+tab+']');await p.waitForTimeout(300);console.log(tab,'chips:',await p.$$eval('.chips button',e=>e.length),'| nationality select:',!!(await p.$('#'+({lump:'l-cty',cost:'c-cty',hire:'h-nat'}[tab]))));}
console.log(errs);await b.close();})();
