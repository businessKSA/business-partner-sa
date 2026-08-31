import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('site');
fs.mkdirSync(out, { recursive: true });
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=https://businesspartner.sa/"><link rel="canonical" href="https://businesspartner.sa/"><title>Business Partner</title><script>location.replace('https://businesspartner.sa/'+location.search+location.hash)</script></head><body><p>جاري تحويلك إلى <a href="https://businesspartner.sa/">Business Partner</a>…</p></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('bp-erp compatibility build: redirecting to primary Business Partner site');
