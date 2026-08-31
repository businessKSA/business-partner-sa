import fs from 'node:fs';
import path from 'node:path';

const files=[path.resolve('site/ar/index.html'),path.resolve('site/index.html')];

const guard=String.raw`<script id="bp-home-order-guard-v7">(function(){
  function run(){
    var clarity=document.querySelector('#bp-home-clarity');
    if(!clarity) return;

    // Remove the legacy B10X umbrella that older build layers injected above
    // the real homepage hero. B10X belongs below the title + chat only.
    document.querySelectorAll('#b10x-all-services,.bp-b10x-umbrella').forEach(function(el){
      if(el.closest('#bp-home-clarity')!==clarity) el.remove();
    });

    var hero=clarity.querySelector('.bp-home-hero,.bp-brand-hero,.hero');
    var chat=clarity.querySelector('#bp-consultant');
    var sales=document.querySelector('#b10x-sales');
    var services=clarity.querySelector('#bp-services');
    var packages=clarity.querySelector('#bp-packages');

    // Force the requested order, regardless of earlier post-build scripts:
    // Business Partner title -> chat -> B10X sales -> services -> packages.
    if(hero && chat) hero.insertAdjacentElement('afterend',chat);
    if(chat && sales) chat.insertAdjacentElement('afterend',sales);
    if(sales && services) sales.insertAdjacentElement('afterend',services);
    if(services && packages) services.insertAdjacentElement('afterend',packages);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();
  setTimeout(run,120);
  setTimeout(run,600);
})();</script>`;

for(const file of files){
  if(!fs.existsSync(file)) continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<script id="bp-home-order-guard-v7">[\s\S]*?<\/script>/g,'');
  html=html.replace('</body>',guard+'\n</body>');
  fs.writeFileSync(file,html);
}
console.log('Homepage order guard v7 applied');
