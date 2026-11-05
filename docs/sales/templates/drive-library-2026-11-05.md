# مكتبة النماذج على Drive — 2026-11-05 (بطلب المالك)

الجذر: [مكتبة النماذج · Business Partner Templates Library](https://drive.google.com/drive/folders/1Ds4deSOHj_g6QfjdnhjvU0lUHoejI-KQ)

- **A · PDF جاهزة للإرسال:** [المجلد](https://drive.google.com/drive/folders/1Ta_sn5vdiwbUBA6f0ouCxFaAEt8WxUgX) — مجلد فرعي لكل خدمة (13).
- **B · نسخ مفتوحة للتعديل (Word، داخلي):** [المجلد](https://drive.google.com/drive/folders/1jjV2sPl2tUcvg1jJLHxkBdOQ1-Ba4NU7) — أسماء الملفات تبدأ برقم الخدمة.

| # | الخدمة | مجلد PDF |
|---|---|---|
| 01 | تطوير الأعمال كخدمة (REV-LAUNCH مقترحنا + كل الباقات) | `1m0TZ-k4WyBCXwO7Zsxy0RcFneS8eb28C` |
| 02 | التوظيف على بند التعاقد والإسناد (سعوديون) | `1hUJ7H7AdpCVT3mq347WP8XZMSNBo7pUM` |
| 03 | توفير العمالة EOR (أجانب) — قالب ISR | `137rzttSZFjeF8fyCDhc0bv_6s0oAlouB` |
| 04 | تأسيس الشركات | `1eKnLPYW4cQLTVL3-KTkteg7tDcaRjteh` |
| 05 | الاستثمار الأجنبي | `1zETp_0JcAVzOfYuJPy8tRMEHw5OSh1_8` |
| 06 | الإقامة المميزة | `1EoaVThgZb3h6OL7ZsQi1tLO7gmZ1ptav` |
| 07 | العلاقات الحكومية | `1gYZeLWCnlmp42zY1H1kbWeOOXSyixCHq` |
| 08 | الموارد البشرية | `1x5xTfo_RV86tpZqrAy1zDMMS5U6iqMUJ` |
| 09 | التوظيف والاستقدام | `1oIMMxk2pA_CkWnDkgRF6_fISu3acYenh` |
| 10 | دعم الأعمال | `1y83F7pdmjTlYQ7rKq04svHDBQ0yWA0ZN` |
| 11 | المكاتب ومساحات العمل | `1Y7mISMoNAH0Ii8SmidDZljQ2QVIsv8aP` |
| 12 | الأتمتة والذكاء الاصطناعي | `136Hd3lcFeFtWYX5xFE-jd57qUykC-sS5` |
| 13 | مشترك: عدم الإفصاح + الملف التعريفي | `12OpHBoxbGKkggznt2bG0VMAvowIxjXfv` |

## مسودات الإيميل الجاهزة (Gmail، بلا مستلم، عنوانها «[قالب · انسخه ولا ترسله]»)
| الخدمة | معرّف المسودة |
|---|---|
| تطوير الأعمال كخدمة | `r-1149812901379030427` |
| التعاقد والإسناد (سعوديون) | `r-8434227557228113418` |
| توفير العمالة EOR | `r-2068891731519358093` |
| عرض خدمة (فئات الكتالوج التسع) | `r3532107035444017919` |

الاستعمال: افتح المسودة القالب، انسخها، بدّل الأقواس `[...]` (الاسم، الرابط)، أضف المستلم، ثم «أرسلي».

## ما يخرج منها
- 01–02: مولّدا `business-development-service/clients/batch-2026-11-05/build_rev_batch.py` (مفتاح `tplbd`) و`cases/2026-11-05-maake-beauty-eor/build_quote.py|build_contract.py` بمتغير `TEMPLATE=1` (نموذج بلا اسم عميل). لبناء عميل جديد: `BP_OUT=... python3 build_rev_batch.py --only <مفتاح>` بعد إضافته لـ`clients.json`.
- 03: ملفات ISR (قوالب معتمدة؛ رسوم التوطين والحاسبة داخلها).
- 04–12: من `library/out-samples` (قالب لكل فئة: عرض وعقد وشروط وتفويض أو POC). **حالتها: مراجعة قانونية معلّقة (README المكتبة)** — لا تُرسل لعميل قبل المراجعة.
