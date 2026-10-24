const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const er=[];
for(const mode of ['web','client-ai']){
 const p=await b.newPage({viewport:{width:1300,height:900}});p.on('pageerror',e=>er.push(mode+': '+e.message));
 if(mode==='client-ai') await p.addInitScript(()=>{ const sm=async(input,opts)=>{ const T=Object.fromEntries(opts.tools.map(t=>[t.name,t])); const act=await T.find_activity.execute({query:'مطاعم'}); await T.add_establishment.execute({name:'مطعم النخيل',labour_office_no:'1-123456',unified_no:'7001234567',tax_no:'300123456789003',gosi_no:'123456789',short_address:'RRRD2929',activity_code:act[0].code,full:3,part:0,foreign:12}); return {text:'أضفتُ مطعم النخيل. وضعه كالتالي.'}; }; sm.limits=async()=>({images:{maxCount:4}}); sm.json=async()=>({}); window.claude={use:async n=>n==='sample'?sm:null}; });
 await p.goto('file://'+process.cwd()+'/'+(mode==='web'?'index-web.html':'index-client.html'));await p.waitForTimeout(800);
 console.log(mode,'shell',await p.evaluate(()=>!!document.getElementById('cs')),'chips',await p.evaluate(()=>document.querySelectorAll('#cs-thread .chip').length));
 await p.click('[data-chip=goal][data-arg=assess]');await p.waitForTimeout(300);
 await p.click('[data-side=open][data-arg=nit]');await p.waitForTimeout(400);console.log('canvas',await p.evaluate(()=>document.body.classList.contains('cv')),await p.evaluate(()=>getComputedStyle(document.getElementById('app')).display));
 await p.click('#cv-x');await p.waitForTimeout(200);
 await p.fill('#cs-t','أضف مطعم النخيل');await p.keyboard.press('Enter');await p.waitForTimeout(1500);
 console.log(mode,'thread:',(await p.evaluate(()=>document.getElementById('cs-thread').innerText)).replace(/\n+/g,' | ').slice(-260));
 if(mode==='client-ai'){ console.log('card',await p.evaluate(()=>!!document.querySelector('.card .ccs')), 'sidebar est',await p.evaluate(()=>document.querySelectorAll('#cs-side .si .dot').length));
   await p.screenshot({path:'chat1.png'}); }
 else await p.screenshot({path:'chat0.png'});
}
console.log(er);await b.close()})();
