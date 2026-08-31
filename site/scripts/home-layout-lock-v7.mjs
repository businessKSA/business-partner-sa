import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('site');
const files = [path.join(ROOT,'ar','index.html'), path.join(ROOT,'index.html')];

const css = String.raw`<style id="bp-home-layout-lock-v7-css">
/* Final homepage hierarchy lock — this runs after all legacy post-build layers. */
body.bp-home-clarity .bp-b10x-umbrella{display:none!important}
body.bp-home-clarity #bp-home-clarity{display:block!important}
body.bp-home-clarity #bp-home-clarity>.hero{order:1}
body.bp-home-clarity #bp-home-clarity>#bp-consultant{order:2}
body.bp-home-clarity #bp-home-clarity>#b10x-sales{order:3}
body.bp-home-clarity #bp-home-clarity>#bp-services{order:4}
body.bp-home-clarity #bp-home-clarity>#bp-packages{order:5}
</style>`;

const js = String.raw`<script id="bp-home-layout-lock-v7-js">(function(){
  function lock(){
    var root=document.querySelector('#bp-home-clarity');
    if(!root)return;
    var main=root.closest('main')||document.querySelector('main');
    var header=document.querySelector('header.site-header,header');

    /* The canonical homepage must be the first real content block. */
    if(main && root.parentElement===main && main.firstElementChild!==root){
      main.insertBefore(root,main.firstElementChild);
    } else if(!main && header && root.previousElementSibling!==header){
      header.insertAdjacentElement('afterend',root);
    }

    var hero=root.querySelector(':scope > .hero') || root.querySelector('.hero');
    var chat=root.querySelector('#bp-consultant');
    var b10x=document.querySelector('#b10x-sales');
    var services=root.querySelector('#bp-services');
    var packages=root.querySelector('#bp-packages');

    /* Remove the old B10X umbrella that used to render above the real hero. */
    document.querySelectorAll('.bp-b10x-umbrella').forEach(function(el){
      if(!el.closest('#bp-services')) el.remove();
    });

    /* One canonical B10X sales section only, inside the canonical homepage. */
    if(b10x && b10x.parentElement!==root){ root.appendChild(b10x); }
    document.querySelectorAll('#b10x-sales').forEach(function(el,i){ if(i>0)el.remove(); });
    b10x=document.querySelector('#b10x-sales');

    /* Deterministic order, independent of every earlier script. */
    if(hero) root.insertBefore(hero,root.firstElementChild);
    if(hero && chat) hero.insertAdjacentElement('afterend',chat);
    if(chat && b10x) chat.insertAdjacentElement('afterend',b10x);
    if((b10x||chat) && services) (b10x||chat).insertAdjacentElement('afterend',services);
    if(services && packages) services.insertAdjacentElement('afterend',packages);

    /* Legacy capability/showcase blocks are allowed only after the core flow. */
    var anchor=packages||services||b10x||chat||hero;
    if(anchor){
      Array.from(root.children).forEach(function(el){
        if([hero,chat,b10x,services,packages].indexOf(el)!==-1)return;
        if(el.compareDocumentPosition(hero||root)&Node.DOCUMENT_POSITION_FOLLOWING){
          anchor.insertAdjacentElement('afterend',el); anchor=el;
        }
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lock);else lock();
  window.addEventListener('load',lock,{once:true});
  setTimeout(lock,120);
  setTimeout(lock,700);
})();</script>`;

for (const file of files){
  if(!fs.existsSync(file)) continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<style id="bp-home-layout-lock-v7-css">[\s\S]*?<\/style>/g,'')
           .replace(/<script id="bp-home-layout-lock-v7-js">[\s\S]*?<\/script>/g,'');
  html=html.replace('</head>',css+'\n</head>');
  html=html.replace('</body>',js+'\n</body>');
  fs.writeFileSync(file,html);
}
console.log('Homepage hierarchy locked: Hero → Chat → B10X → Services → Packages');
