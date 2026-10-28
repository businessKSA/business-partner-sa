// جسر المساعد الذكي في صفحة /compliance-solutions (طبقة الصفحة فوق مسار الخادم action:'compliance-ai')
//
// شغّله: npm test
//
// الصفحة صُمّمت لتعمل داخل Claude عبر claude.use('sample'). خارج Claude صارت تستدعي الخادم برمز وصول.
// هذا الاختبار يثبّت ما لا يجوز أن يتراجع (والسلوك الحيّ تُثبّته لقطات Playwright لا هذا الملف):
//   ① العقد: POST /api/chat بجسم {action:'compliance-ai'} وترويسة x-cs-key.
//   ② الرمز في sessionStorage فقط: لا localStorage ولا الرابط.
//   ③ لا تظهر «متاحة داخل Claude فقط» خارج Claude: النصّ الباقي محروس بـcsInClaude().
//   ④ كل نص جديد للعميل له ترجمة فرنسية وصينية في جدول #tr.
//   ⑤ الحدّ يطابق الخادم: ≤6 ملفات و≤6MB.
//   ⑥ بقاء claude.use('sample') داخل Claude كما كان.
//   ⑦ لا مفتاح مكتوب في الصفحة.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'site/scripts/assets/compliance-solutions.page.html'), 'utf8');
const trStart = SRC.indexOf('<script id="tr" type="application/json">') + '<script id="tr" type="application/json">'.length;
const trEnd = SRC.indexOf('</script>', trStart);
const TR = JSON.parse(SRC.slice(trStart, trEnd));
const CODE = SRC.slice(0, trStart) + SRC.slice(trEnd); // الصفحة بلا جدول الترجمة
const BRIDGE = CODE.slice(CODE.indexOf('const CSAI='), CODE.indexOf('const DR_PROMPT='));

test('العقد مع الخادم: action ومسار /api/chat وترويسة x-cs-key', () => {
  assert.ok(BRIDGE.includes("action:'compliance-ai'"));
  assert.ok(BRIDGE.includes("'/api/chat'"));
  assert.ok(BRIDGE.includes("'x-cs-key'"));
  assert.match(BRIDGE, /messages:/);
  assert.match(BRIDGE, /json:true/);
  assert.match(BRIDGE, /files:/);
});

test('رمز الوصول في sessionStorage فقط: لا localStorage ولا الرابط', () => {
  assert.match(BRIDGE, /sessionStorage\.setItem\(CSAI\.SK/);
  assert.ok(!/localStorage/.test(BRIDGE), 'الجسر لا يلمس localStorage');
  assert.ok(!/location\.(search|hash)/.test(BRIDGE), 'الجسر لا يقرأ الرمز من الرابط');
  assert.ok(!/history\.(push|replace)State/.test(BRIDGE));
  // كل قراءة وكتابة للتخزين داخل try/catch
  assert.match(BRIDGE, /try\{[^}]*sessionStorage\.getItem[^}]*\}catch/);
  assert.match(BRIDGE, /try\{[^}]*sessionStorage\.setItem[^}]*\}catch/);
});

test('داخل Claude يبقى claude.use(sample)، وخارجه الخادم', () => {
  assert.match(BRIDGE, /async function drSample\(\)\{ if\(csInClaude\(\)\)\{ try\{ return await claude\.use\('sample'\)/);
  assert.match(BRIDGE, /return CSAI\.declined\?null:csSample/);
});

test('«متاح داخل Claude فقط» لا يظهر خارج Claude', () => {
  const claudeOnly = [...CODE.matchAll(/داخل صفحة Claude|inside the Claude page/g)];
  // نصّان محروسان فقط (عربي/إنجليزي في السطر نفسه) خلف csInClaude()
  for (const m of claudeOnly) {
    const ctx = CODE.slice(Math.max(0, m.index - 260), m.index);
    assert.ok(/csInClaude\(\)/.test(ctx), 'نصّ «داخل Claude» بلا حارس csInClaude قرب: ' + CODE.slice(m.index - 40, m.index + 40));
  }
});

test('كل رسالة جديدة لها ترجمة فرنسية وصينية في #tr', () => {
  const keys = [
    'Access code', 'Unlock', 'I have no code', 'That code is not correct. Try again.',
    'Free-text chat and file reading need an access code. Enter it and I carry on with what you asked.',
    'The smart assistant is locked. Enter the access code to enable it, or continue with the buttons.',
    'Too many requests right now. Wait a minute and try again.',
    'The smart assistant’s daily allowance is used up. It returns tomorrow; meanwhile use the buttons.',
    'The smart assistant is unavailable right now. Please try again shortly.',
    'The file is too large. The limit is 6 files and 6 MB in total; shrink it or upload fewer pages.',
    'The request could not be understood. Rephrase it or upload a different file.',
    'Could not connect. Check your internet and try again.',
    'I received an unreadable reply. Please try again.',
    'Access code saved. Write your request or attach your files.',
    'Free-text chat needs an access code. Pick from the buttons, or enter the code to enable it:',
    'Local read of labelled numbers only (dates and name need the assistant)',
    'Reading images and scanned PDFs needs the smart assistant (access code)',
    'The smart plan needs the smart assistant (access code).',
    'Local read of labelled dates and numbers only — name, profession and city need the assistant',
  ];
  for (const k of keys) {
    assert.ok(CODE.includes(k), 'الرسالة غير مستعملة في الصفحة: ' + k);
    assert.ok(TR.fr[k] && TR.fr[k] !== k, 'بلا فرنسية: ' + k);
    assert.ok(TR.zh[k] && TR.zh[k] !== k, 'بلا صينية: ' + k);
  }
});

test('كل خطأ خادم له رسالة: مقفل · كثرة الطلبات · الرصيد · غير متاح · ملف كبير', () => {
  for (const code of ['locked', 'rate_limited', 'budget', 'unavailable', 'too_large']) {
    assert.match(BRIDGE, new RegExp('\\b' + code + ':\\['), 'لا رسالة للرمز ' + code);
  }
  // مطابقة حالات الخادم: 401 · 429 · 402 · 503 · 413 · 400
  for (const st of ['401', '429', '402', '413', '400']) assert.ok(BRIDGE.includes('r.status===' + st), 'حالة ' + st);
});

test('حدّ الملفات يطابق الخادم: ≤6 ملفات و≤6MB', () => {
  assert.match(BRIDGE, /MAXF:6/);
  assert.match(BRIDGE, /MAXB:6\*1024\*1024/);
  assert.match(BRIDGE, /\.slice\(0,CSAI\.MAXF\)/);
  assert.match(BRIDGE, /throw csErr\('too_large'\)/);
  assert.match(BRIDGE, /readAsDataURL/); // base64 بلا مكتبات
});

test('لا مفتاح ولا سرّ مكتوب في الصفحة', () => {
  assert.ok(!/sk-[A-Za-z0-9]{20,}|x-cs-key['"]?\s*:\s*['"][A-Za-z0-9]{8,}/.test(CODE), 'سرّ مكتوب في الصفحة');
});
