# Business Partner — موقع تسويقي (Static, RTL)

موقع تسويقي احترافي متعدد الصفحات لـ **Business Partner (BPIC)** — عربي RTL بالكامل،
HTML/CSS/JS ثابت بدون أي framework، جاهز للنشر على Vercel.

## الهوية البصرية
مطابقة لملف Brand Guidelines المعتمد على Notion:
- **Primary Navy** `#0B1B5A` · **White** `#FFFFFF`
- **Light Gray** `#F5F6FA` (خلفيات) · **Dark Gray** `#1F2430` (نصوص)
- عناوين = Navy · نصوص = رمادي داكن · أزرار/روابط = Navy
- الخطوط: IBM Plex Sans Arabic (عربي) · Playfair Display + Inter (لاتيني)
- الشعار: `assets/img/logo.png` (بألوانه المعتمدة، لا يُمدّد، حد أدنى 160px)
- Tagline: *Partnering for your success*

## الصفحات
| المسار | الوصف |
|--------|-------|
| `/` | الرئيسية (Hero, لماذا BP, الخدمات, الباقات, الوكيل الذكي, أرقام, آراء, CTA) |
| `/about` | من نحن |
| `/services` | الخدمات مصنّفة حسب الكتالوج الرسمي |
| `/services/<slug>` | صفحة خدمة مفردة بالقالب السباعي (93 خدمة) |
| `/packages` | الباقات (Start / Growth / Pro) بأسعار Notion |
| `/calculator` | حاسبة تكلفة الخدمة (أتعاب + ضريبة 15%) |
| `/blog` | المدوّنة (مرحلة 2) |
| `/contact` | نموذج + واتساب + خريطة |

القالب السباعي لكل خدمة: الاسم+الفئة · تفاصيل سريعة · الوصف · المستندات · المميزات · FAQ · Callout + زر واتساب.

## مصدر المحتوى
كل الأرقام والأسعار والأكواد (BP-xxx) مسحوبة مباشرة من **BP Services Catalog — OFFICIAL** على Notion.
الألوان والشعار من ملف الهوية المعتمد. لا توجد أرقام أو ألوان مُختلَقة.

- زر الوكيل الذكي على واتساب: `https://wa.me/message/HVR44Jacft5ZYsxd` (في كل صفحة: الهيدر + زر عائم + CTAs).

## البناء
```bash
# 1) (اختياري) إعادة توليد بيانات الخدمات من تصدير كتالوج Notion
python3 site/scripts/build_services.py <notion-catalog-export.json>

# 2) توليد كل صفحات HTML من data/*.json
node site/scripts/generate.mjs
```
- `data/services.json` · `data/categories.json` — مولّدة من الكتالوج.
- `data/site.json` — الهوية، التنقل، الرئيسية، من نحن، الباقات، ومحتوى الخدمات المميّزة.
- المخرجات HTML ثابتة تُنشر كما هي.

## النشر على Vercel
مضبوط عبر `vercel.json` في جذر المستودع:
`framework: null` · `buildCommand: node site/scripts/generate.mjs` · `outputDirectory: site` · `cleanUrls: true`.
لا توجد تبعيات npm — Node فقط لتشغيل المولّد.
