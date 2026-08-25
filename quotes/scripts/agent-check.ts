/**
 * فحص الأجزاء الحتمية في الوكيل الذكي بلا استدعاء الشبكة:
 * استخراج JSON من الرد، وحارس المحتوى (الإيموجي والاختصارات الحكومية).
 * الاستدعاء الحي للنموذج يحتاج ANTHROPIC_API_KEY ويُختبر بـ npm run agent:live
 */
import { checkContent, sanitizeDeep, hasEmoji, expandGovAbbreviations } from '../src/lib/content-guard';
import { loadText } from '../src/lib/templates';

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  PASS  ${n}${d ? ` — ${d}` : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${d ? ` — ${d}` : ''}`); }
};

// برومت الوكيل يحمّل ويحوي الأمثلة المعتمدة
const prompt = loadText('agent-prompt.md');
check('برومت الوكيل يُحمَّل من templates/', prompt.length > 2000, `${prompt.length} حرفاً`);
check('يحتوي مثالين few-shot معتمدين', prompt.includes('مثال 1') && prompt.includes('مثال 2'));
check('ينص على منع الإيموجي', prompt.includes('ممنوع منعاً باتاً استخدام الإيموجي'));
check('ينص على أسماء الجهات الحكومية كاملة', prompt.includes('وزارة الموارد البشرية والتنمية الاجتماعية'));
check('ينص على استثناء الرسوم الحكومية', prompt.includes('الرسوم الحكومية مستثناة دائماً'));
check('يمنع الوكيل من كتابة البنود القانونية العامة', prompt.includes('لا تكتب بنود العقد القانونية العامة'));
check('برومت الوكيل نفسه بلا إيموجي', !hasEmoji(prompt));

// حارس المحتوى يلتقط المخالفات
const dirty = {
  nameAr: 'خدمة تسجيل لدى MHRSD وZATCA ✅',
  nameEn: 'Registration with MHRSD and ZATCA 🚀',
  descAr: 'تشمل المعاملة عبر منصة قوى ومنصة مقيم.',
};
const issues = checkContent(dirty);
check('يلتقط الإيموجي', issues.some((i) => i.rule === 'emoji'), `${issues.filter((i) => i.rule === 'emoji').length} مخالفة`);
check('يلتقط الاختصارات الحكومية', issues.some((i) => i.rule === 'gov-abbreviation'));

const clean = sanitizeDeep(dirty, 'ar');
const after = checkContent(clean);
check('التنظيف يزيل كل المخالفات', after.length === 0, after.map((i) => i.rule).join(','));
check('الاسم العربي وُسِّع بالاسم الكامل', clean.nameAr.includes('وزارة الموارد البشرية والتنمية الاجتماعية') && clean.nameAr.includes('هيئة الزكاة والضريبة والجمارك'), clean.nameAr);
check('الاسم الإنجليزي وُسِّع بالاسم الكامل', clean.nameEn.includes('Ministry of Human Resources and Social Development'), clean.nameEn);
check('أسماء المنصات لم تُمسّ', clean.descAr.includes('قوى') && clean.descAr.includes('مقيم'));

// توسيع الاختصارات لا يمس النص السليم
const okText = 'التسجيل لدى المؤسسة العامة للتأمينات الاجتماعية عبر منصة مدد.';
check('النص السليم يبقى كما هو', expandGovAbbreviations(okText, 'ar') === okText);

console.log(`\nنجح: ${pass}   فشل: ${fail}`);
process.exit(fail ? 1 : 0);
