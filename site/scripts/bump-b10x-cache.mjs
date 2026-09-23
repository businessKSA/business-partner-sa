import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('site');
let changed=0;
// The key is the stylesheet's content hash, not a date typed by hand: /assets/*
// is served immutable for a year, and a literal that nobody remembers to bump
// pins every browser and the CDN to the first copy they saw — the same fault
// that left the business-development workspace on weeks-old JavaScript.
const KEY=crypto.createHash('md5').update(fs.readFileSync(path.join(process.cwd(),'site','assets','css','b10x-theme.css'))).digest('hex').slice(0,10);
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.statSync(p);if(s.isDirectory())walk(p);else if(name.endsWith('.html')){let h=fs.readFileSync(p,'utf8');const n=h.replace(/\/assets\/css\/b10x-theme\.css\?v=[^"']*/g,'/assets/css/b10x-theme.css?v='+KEY);if(n!==h){fs.writeFileSync(p,n);changed++;}}}}
walk(root);
console.log(`B10X cache key updated on ${changed} pages`);
