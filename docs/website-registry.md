# سجل الموقع — مَن يملك كل صفحة (Website Registry)

مولّد من فحص المستودع بتاريخ **2026-09-29**. الأرقام محسوبة من الملفات
الفعلية تحت `site/`، لا من تقدير.

المعيار الفاصل بين التصميمين نصّي وقابل لإعادة الفحص:

| التصميم | العلامة في الـHTML | المرجع |
|---|---|---|
| **الجديد (Simple V1)** | `<header class="sv1-hdr">` | `docs/simple-v1.md` |
| **القديم** | `<header class="site-header ...">` | `site/scripts/generate.mjs` |
| **بلا رأس مشترك** | لا يوجد `<header>` من الاثنين | تطبيقات مستقلة |

أمر إعادة الفحص:

```sh
cd site && for f in $(find . -name '*.html'); do
  if grep -ql 'sv1-hdr' "$f"; then echo "NEW $f"
  elif grep -ql 'site-header' "$f"; then echo "OLD $f"
  else echo "NOHDR $f"; fi
done | awk '{print $1}' | sort | uniq -c
```

---

## 1) الحصيلة

| الحالة | العدد | النسبة |
|---|---:|---:|
| **NEW** — الهوية الجديدة | **13** | 1.1% |
| **OLD** — الهوية القديمة | **1118** | 91.5% |
| **NOHDR** — بلا رأس مشترك (تطبيقات مستقلة) | **91** | 7.4% |
| **الإجمالي** | **1222** | |

الثلاث عشرة صفحة الجديدة هي كامل ما أنتجته طبقة Simple V1:

```
index.html          simple-v1.html      my.html        ops.html
ar/index.html       ar/simple-v1.html   ar/my.html
fr/index.html       fr/simple-v1.html   fr/my.html
zh/index.html       zh/simple-v1.html   zh/my.html
```

أي: **الرئيسية + بوابة العميل + لوحة العمليات**، بأربع لغات. لا شيء غيرها.
هذا مطابق تماماً لما تعده `docs/simple-v1.md` — الطبقة لم تتوسّع بعد، ولم تفشل.

## 2) توزيع اللغات

| اللغة | الصفحات | الحالة |
|---|---:|---|
| `ar` | 298 | كاملة |
| `zh` | 295 | كاملة |
| `fr` | 295 | كاملة |
| `ru` `ko` `ja` `hi` `es` | 5 لكل واحدة | **ناقصة — هيكل فقط** |

خمس لغات فيها خمس صفحات فقط لكل منها. إما تُكمل أو تُزال من مبدّل اللغة،
فوجودها الحالي يَعِد الزائر بترجمة غير موجودة.

## 3) مناطق الموقع ومالكها المقترح

| المنطقة | الصفحات | التصميم | المالك المقترح |
|---|---:|---|---|
| الرئيسية + `/my` + `/ops` | 13 | NEW | Simple V1 Agent |
| `services/` | 140 | OLD | Services Agent |
| `jobs/` | 38 | OLD | Recruitment Agent |
| `hr/employer/` | 20 | NOHDR | Employer Portal Agent |
| `team/` | 12 | OLD | Services Agent |
| `calculators/` | 6 | OLD | Services Agent |
| `portal/` | 4 | OLD/NOHDR | Client Portal Agent |
| صفحات الجذر المتفرقة | ~75 | OLD/NOHDR | Project Manager |
| الترجمات (`ar` `zh` `fr`) | ~888 | OLD | تتبع أصلها الإنجليزي |

## 4) التكرار المؤكَّد

### أ) الرئيسية — ٣ نسخ
| الملف | التصميم | الحكم |
|---|---|---|
| `index.html` | NEW | **KEEP** |
| `simple-v1.html` | NEW | KEEP — المصدر الثابت الذي يُنسخ منه |
| `classic-home.html` | OLD | **ARCHIVE** بعد تثبيت الجديدة |

### ب) بوابة العميل — ٤ متنافسات
| المسار | التصميم | الحكم |
|---|---|---|
| `/my` (٤ لغات) | NEW | **KEEP** — هي البوابة الرسمية |
| `portal.html` + `portal/` (٤ صفحات) | OLD | **MERGE** في `/my` |
| `account.html` | NOHDR | **MERGE** في `/my` |
| `dashboard.html` | NOHDR | **MERGE** أو ARCHIVE |

### ج) لوحات الإدارة — ٧ لوحات
| الملف | التصميم | الحكم |
|---|---|---|
| `ops.html` | NEW | **KEEP** — اللوحة الرسمية |
| `admin.html` | NOHDR | MERGE في `/ops` |
| `monitor.html` | NOHDR | MERGE في `/ops` |
| `suppliers-admin.html` | OLD | MERGE في `/ops` |
| `agencies-admin.html` | OLD | MERGE في `/ops` |
| `jobsearch-admin.html` | OLD | MERGE في `/ops` |
| `doc-agent-admin.html` | NOHDR | MERGE في `/ops` |

### د) بوابة أصحاب العمل — ٥ مداخل
| الملف | الحكم |
|---|---|
| `hr/employer/` (٢٠ صفحة) | **KEEP** — الأكمل بفارق كبير |
| `employer-dashboard.html` | MERGE |
| `employer-login.html` | MERGE — تسجيل الدخول يوحَّد |
| `employer-join.html` | MERGE |
| `agency-portal.html` | يُفصل: هل الوكالة كيان مختلف عن صاحب العمل؟ إن لا → MERGE |

## 5) قاعدة الملكية

- كل صفحة لها **مالك واحد**. لا صفحة بلا مالك، ولا صفحة بمالكَين.
- التكرار يُحسم بـ **KEEP واحد** والباقي MERGE أو ARCHIVE أو REDIRECT.
- أي نقل إلى الهوية الجديدة يمرّ عبر `npm run build` كاملاً، ولا يُنشر
  إلا بعد اجتياز `site/scripts/verify-api.mjs`.
- لا تُحذف صفحة قديمة قبل وجود `redirect` لها في `vercel.json`
  (فيه اليوم ٥٦ قاعدة مسار — هذا هو المكان الصحيح).

## 6) ما لا يعرفه هذا السجل

- **لا يقارن بالموقع الحيّ.** جلسة العمل السحابية محجوبة عن
  `businesspartner.sa` بسياسة الشبكة، فكل ما هنا مستخرج من المصدر.
  إن اختلف الحيّ عن المصدر، فالفارق هو نشرة غير مدموجة.
- **لا يحكم على جودة التصميم** — فقط على أي رأس تستعمله الصفحة.
- **صفحات `NOHDR` ليست بالضرورة معطوبة.** أغلبها تطبيقات لوحة مستقلة
  بُنيت بلا رأس الموقع عن قصد. تصنيفها هنا يعني أنها خارج نظام الهوية،
  لا أنها مكسورة.
