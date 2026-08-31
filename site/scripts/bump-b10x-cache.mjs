import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('site');
let changed=0;
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else if(name.endsWith('.html')){let h=fs.readFileSync(p,'utf8');const n=h.replaceAll('/assets/css/b10x-theme.css?v=20260829','/assets/css/b10x-theme.css?v=20260829b');if(n!==h){fs.writeFileSync(p,n);changed++;}}}}
walk(root);
console.log(`B10X cache key updated on ${changed} pages`);
