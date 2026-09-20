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


// ---- Pair-structure checks -------------------------------------------------
// The checks above verify each value in isolation. These verify that a value
// actually belongs to its key: a batch of translations merged one index out of
// step leaves every value plausible on its own but attached to the wrong
// string, which is invisible to a "did every key get a value?" check. Compare
// language-independent structure a correct translation must preserve.
const EMO = /^[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
// Han, Hangul and Kana pack an English word into roughly one to two characters,
// so they need their own size band — the Latin band would flag every correct
// translation. Counted together because ja mixes kanji and kana.
const COMPACT = /[一-鿿가-힯぀-ヿ]/g;
// Chinese and Japanese use full-width punctuation; normalise before comparing.
const NORM_TAIL = (s) => s.trim().replace(/[：？。…、，]/g, (c) => ({ "：": ":", "？": "?", "。": ".", "…": "…", "、": ",", "，": "," }[c]));
for (const lang of LANGS) {
  if (lang === "ar" || lang === "en") continue;
  for (const [en, tr] of Object.entries(TRANSLATIONS[lang])) {
    if (typeof tr !== "string" || !tr) continue;
    const pair = (why, note) => add(lang, "pair:" + why, en, tr, note || "");
    // a page title stays a page title
    if (/— Business Partner$/.test(en) !== /— Business Partner$/.test(tr)) pair("brand-suffix");
    // a leading emoji is part of the label and must carry over
    const em = (s) => (EMO.test(s) ? [...s][0] : "");
    if (em(en) !== em(tr)) pair("leading-emoji");
    // trailing affordance punctuation marks the same kind of string
    const tail = (s) => (NORM_TAIL(s).match(/[:…?›→←↗]$/) || [""])[0];
    if (tail(en) !== tail(tr)) pair("trailing-punct");
    // size mismatch is the off-by-one signature
    const words = (en.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
    const compact = (tr.match(COMPACT) || []).length;
    if (compact && words >= 3) {
      const r = compact / words;
      if (r < 0.3 || r > 5) pair("size", "compact-chars/word=" + r.toFixed(2));
    } else if (!compact && en.length > 12) {
      const r = tr.length / en.length;
      if (r < 0.45 || r > 2.6) pair("size", "len-ratio=" + r.toFixed(2));
    }
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
