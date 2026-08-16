// Translation-dictionary integrity audit. Run: node site/scripts/audit-translations.mjs
// Catches the defect classes that silently corrupt a language: values paired
// with the wrong key, lost {placeholders}, dropped edge whitespace on
// concatenated strings, pre-escaped entities that render literally, duplicate
// keys, and Arabic leaking into a non-Arabic tree.
import { TRANSLATIONS } from './i18n.mjs';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('./i18n.mjs', import.meta.url),'utf8');
const LANGS = Object.keys(TRANSLATIONS);
const PH = /\{[a-zA-Z_]+\}/g;
const AR = /[؀-ۿ]/;
const CJK = /[一-鿿]/;
const CYR = /[Ѐ-ӿ]/;
const DEV = /[ऀ-ॿ]/;
const HAN = /[가-힯]/;
const KANA = /[぀-ヿ一-鿿]/;
const NATIVE = { fr: null, es: null, zh: CJK, ru: CYR, hi: DEV, ko: HAN, ja: KANA };

const problems = [];
const add = (lang, kind, key, val, note) => problems.push({ lang, kind, key, val, note });

// duplicate keys within one language block (parsed from source, not the object)
for (const lang of LANGS) {
  const m = SRC.match(new RegExp('^  ' + lang + ': \\{$[\\s\\S]*?^  \\},$', 'm'));
  if (!m) { add(lang,'block-missing','','','no block found in source'); continue; }
  const seen = new Map();
  for (const line of m[0].split('\n')) {
    const km = line.match(/^\s*"((?:[^"\\]|\\.)*)":/);
    if (!km) continue;
    const k = JSON.parse('"' + km[1] + '"');
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) add(lang,'duplicate-key',k,'',n + ' occurrences');
}

for (const lang of LANGS) {
  const d = TRANSLATIONS[lang];
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== 'string') { add(lang,'not-a-string',k,String(v),typeof v); continue; }
    if (!v.trim() && k.trim()) { add(lang,'empty-value',k,v,''); continue; }
    // placeholders must survive
    const kp = (k.match(PH) || []).sort().join(',');
    const vp = (v.match(PH) || []).sort().join(',');
    if (kp !== vp) add(lang,'placeholder-mismatch',k,v,'key['+kp+'] value['+vp+']');
    // leading/trailing whitespace is load-bearing on concatenated strings
    if (/^\s/.test(k) !== /^\s/.test(v) || /\s$/.test(k) !== /\s$/.test(v))
      add(lang,'edge-space-mismatch',k,v,'');
    // Arabic must never appear in a non-Arabic tree (except a few deliberate glossary terms)
    if (lang !== 'ar' && AR.test(v) && !AR.test(k)) add(lang,'arabic-in-non-arabic',k,v,'');
    // native-script check: a value that is byte-identical to the key is untranslated
    if (v === k && /[A-Za-z]{4}/.test(k) && k.length > 6) add(lang,'identical-to-english',k,v,'');
    const need = NATIVE[lang];
    if (need && /[A-Za-z]{4}/.test(k) && k.length > 8 && !need.test(v) && !/^[\W\d\s]+$/.test(v))
      add(lang,'no-native-script',k,v,'');
    // HTML entities / tags must match
    const kt = (k.match(/&[a-z]+;|<[^>]+>/g) || []).join(',');
    const vt = (v.match(/&[a-z]+;|<[^>]+>/g) || []).join(',');
    if (kt !== vt) add(lang,'markup-mismatch',k,v,'key['+kt+'] value['+vt+']');
  }
}

console.log('LANGUAGES:', LANGS.map(l => l + '=' + Object.keys(TRANSLATIONS[l]).length).join('  '));
const byKind = {};
for (const p of problems) (byKind[p.lang+' / '+p.kind] ||= []).push(p);
const keys = Object.keys(byKind).sort();
if (!keys.length) console.log('\nNo integrity problems found.');
for (const k of keys) {
  const list = byKind[k];
  console.log('\n=== ' + k + '  (' + list.length + ') ===');
  for (const p of list.slice(0, 12))
    console.log('  key: ' + JSON.stringify(p.key).slice(0,110) + '\n  val: ' + JSON.stringify(p.val).slice(0,110) + (p.note ? '\n  ' + p.note : ''));
  if (list.length > 12) console.log('  … +' + (list.length - 12) + ' more');
}
