// المنطق الصافي لرحلة «ارفع كل ملفات شركتك مرة واحدة» في /my — بلا DOM وبلا شبكة.
//
// يملكه client-portal (واجهة فقط). الخادم (api/_doc-intake.js وإجراءا doc-intake و
// doc-intake-confirm في api/_simple.js) يملكه وكيل المستندات، والعقد بين الطرفين
// مكتوب في tests/fixtures/doc-intake-contract.json وتحرسه tests/my-doc-intake.test.mjs.
//
// لماذا دالةٌ واحدة تُرجع كائناً: الصفحة تحمل هذا المنطق بنسخ نصّ الدالة نفسها
// (`makeIntakeCore.toString()`) إلى سكربت /my، والاختبارات تستدعي الدالة نفسها —
// فما يُختبر هو ما يعمل في المتصفح لا نسخةٌ ثانية منه. لذلك يجب أن تكون الدالة
// مكتفية بذاتها: لا مرجع إلى شيء خارجها، ولا `${` ولا علامة اقتباس عكسية بداخلها.
//
// ما يفعله:
//  • يفحص الملف قبل أن يغادر الجهاز (حجم، صيغة، فراغ).
//  • يحوّل نوع المستند المقروء إلى تصنيف خزانة.
//  • يحسب التحذيرات: منتهٍ، ينتهي قريباً، مكرر، متضارب، غير مقروء، ثقة منخفضة،
//    رقم ضريبي أو سجل بشكلٍ غير معتاد.
//  • يقترح «بيانات الشركة» من الملفات المُبقاة، ويكشف تعارض المصادر.
//  • يبني حمولة doc-intake-confirm بما أكّده العميل فقط.
export function makeIntakeCore() {
  var MAX_BYTES = 8 * 1024 * 1024;      // حدّ الخزانة (api/requests.js DOC_VAULT_MAX_BYTES)
  var MAX_READ = 6 * 1024 * 1024;       // حدّ القراءة الآلية (api/_docread.js MAX_DOC_BYTES)
  var MAX_FILES = 12;
  var OK_MIME = { "application/pdf": "application/pdf", "image/jpeg": "image/jpeg", "image/jpg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp" };
  var OK_EXT = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  var COMPANY_FIELDS = ["name_ar", "name_en", "cr_number", "vat_number", "city"];
  // نوع المستند كما يقرؤه الوكيل ← تصنيفه في الخزانة (db/schema.sql: documents.category)
  var TYPE_CAT = { cr: "cr", vat_certificate: "vat", national_address: "national_address", license: "license", gosi: "gosi", zakat: "zakat", id: "id", contract: "contract", other: "other" };
  var CONF_RANK = { high: 3, medium: 2, low: 1 };
  // سلطة كل نوع مستند على كل حقل من بيانات الشركة: السجل التجاري هو الأصل للاسم
  // ورقم السجل، والشهادة الضريبية هي الأصل للرقم الضريبي. الهوية لا تُقترح منها شركة.
  var AUTH = {
    name_ar: { cr: 4, vat_certificate: 3, license: 2, zakat: 2, gosi: 2, national_address: 1, contract: 0, other: 0 },
    name_en: { cr: 4, vat_certificate: 3, license: 2, zakat: 2, gosi: 2, national_address: 1, contract: 0, other: 0 },
    cr_number: { cr: 4, license: 2, gosi: 2, vat_certificate: 1, zakat: 1, national_address: 1, contract: 0, other: 0 },
    vat_number: { vat_certificate: 4, zakat: 3, license: 1, cr: 1, gosi: 1, national_address: 0, contract: 0, other: 0 },
    city: { national_address: 4, cr: 3, vat_certificate: 3, license: 2, gosi: 1, zakat: 1, contract: 0, other: 0 }
  };

  function str(v) { return v == null ? "" : String(v).trim(); }
  function ext(n) { var t = str(n); var i = t.lastIndexOf("."); return i < 0 ? "" : t.slice(i + 1).toLowerCase(); }
  // النوع من ترويسة المتصفح أولاً، ومن الامتداد حين يصمت المتصفح (أندرويد وبعض الـPDF).
  function mimeOf(f) { return OK_MIME[str(f && f.type).toLowerCase()] || OK_EXT[ext(f && f.name)] || ""; }
  function fileCheck(f) {
    if (!f) return "bad_type";
    if (!f.size) return "empty";
    if (!mimeOf(f)) return "bad_type";
    if (f.size > MAX_BYTES) return "too_large";
    return "";
  }
  function baseName(n) { return str(n).replace(/\.[^.]+$/, "").slice(0, 120); }
  function digits(v) {
    var s = str(v), out = "", i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) out += s.charAt(i);
      else if (c >= 1632 && c <= 1641) out += String(c - 1632);
      else if (c >= 1776 && c <= 1785) out += String(c - 1776);
    }
    return out;
  }
  // اسمٌ للمقارنة لا للعرض: بلا مسافات ولا تشكيل ولا تطويل ولا علامات، وألفٌ وياءٌ وتاءٌ موحّدة.
  function nameKey(v) {
    return str(v).toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[آأإ]/g, "ا")
      .replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[\s.,\-_()\/\\"'،؛]+/g, "");
  }
  function sameName(a, b) {
    var x = nameKey(a), y = nameKey(b);
    if (!x || !y) return false;
    if (x === y) return true;
    var s = x.length <= y.length ? x : y, l = x.length <= y.length ? y : x;
    return s.length >= 5 && l.indexOf(s) >= 0;
  }
  function sameVal(field, a, b) {
    if (field === "cr_number" || field === "vat_number") return digits(a) === digits(b) && !!digits(a);
    return sameName(a, b);
  }
  // تطابقٌ تامّ (للحفظ والعرض): الأرقام بأرقامها، والأسماء بعد إزالة الفروق الشكلية فقط.
  // أما sameVal فتسامح بالاحتواء، وهو للكشف عن مصدرين لشيءٍ واحد لا للحكم بأن الاسم لم يتغيّر.
  function exactSame(field, a, b) {
    if (field === "cr_number" || field === "vat_number") return !!digits(a) && digits(a) === digits(b);
    return !!nameKey(a) && nameKey(a) === nameKey(b);
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function daysLeft(d, today) {
    var s = str(d).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var t = Date.parse(s + "T00:00:00Z"), n = Date.parse((today || todayStr()) + "T00:00:00Z");
    if (!isFinite(t) || !isFinite(n)) return null;
    return Math.round((t - n) / 86400000);
  }
  function validDate(d) { var s = str(d).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && isFinite(Date.parse(s + "T00:00:00Z")) ? s : ""; }
  function categoryOf(docType, serverCategory) {
    var c = str(serverCategory);
    if (c) return c;
    return TYPE_CAT[str(docType)] || "other";
  }

  // ردّ الخادم عن ملفٍ واحد ← مدخلٌ موحّد. متسامحٌ مع الحقول الناقصة: ما ليس ظاهراً يبقى فارغاً ولا يُخمَّن.
  // يقبل docType وما معه داخل `fields` أيضاً (هكذا يعيدها readDocument اليوم).
  function fromServer(x) {
    x = x || {};
    var f = x.fields && typeof x.fields === "object" ? x.fields : {};
    var addr = f.address && typeof f.address === "object" ? f.address : {};
    var docType = str(x.docType || f.docType) || "other";
    var out = {
      docType: TYPE_CAT[docType] ? docType : "other",
      docTitle: str(x.docTitle || x.title || f.docTitle).slice(0, 200),
      category: categoryOf(docType, x.category),
      issueDate: validDate(x.issueDate || f.issueDate),
      expiryDate: validDate(x.expiryDate || f.expiryDate),
      confidence: CONF_RANK[str(x.confidence || f.confidence)] ? str(x.confidence || f.confidence) : "medium",
      fields: {
        companyNameAr: str(f.companyNameAr), companyNameEn: str(f.companyNameEn),
        crNumber: digits(f.crNumber), vatNumber: digits(f.vatNumber),
        city: str(addr.city || f.city), district: str(addr.district), street: str(addr.street),
        buildingNo: str(addr.buildingNo), postalCode: str(addr.postalCode),
        contactName: str(f.contactName), contactPhone: str(f.contactPhone)
      },
      fieldConfidence: x.fieldConfidence && typeof x.fieldConfidence === "object" ? x.fieldConfidence : {},
      serverWarnings: []
    };
    var w = Array.isArray(x.warnings) ? x.warnings : [];
    for (var i = 0; i < w.length; i++) {
      var c = typeof w[i] === "string" ? w[i] : w[i] && w[i].code;
      if (c) out.serverWarnings.push({ code: str(c), field: str(w[i] && w[i].field) });
    }
    return out;
  }

  // هل في المدخل شيءٌ مقروء فعلاً؟ ملفٌّ قرأه الوكيل ولم يجد فيه حقلاً ولا تاريخاً يُعامَل «غير مقروء».
  function hasReading(e) {
    var f = e.fields || {};
    return !!(f.companyNameAr || f.companyNameEn || f.crNumber || f.vatNumber || f.city || e.expiryDate || e.issueDate || (e.docType && e.docType !== "other"));
  }

  function idKey(e) {
    var f = e.fields || {};
    var id = f.crNumber || f.vatNumber || "";
    if (id) return str(e.docType) + ":" + id;
    return "file:" + str(e.name) + ":" + (e.size || 0);
  }

  // التحذيرات والمصادر. تُحسب من جديد عند كل تغيير (إبقاء ملفٍ أو تجاهله يغيّر التعارض).
  // لا تُعدِّل المدخلات إلا حقلَي `warnings` و`dupOf`.
  function reconcile(entries, org, today) {
    today = today || todayStr();
    org = org || {};
    var i, j, e;
    // 1) فحوص الملف وحده
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      e.warnings = [];
      e.dupOf = "";
      if (e.status === "failed") continue;
      var add = function (code, field, extra) {
        for (var k = 0; k < e.warnings.length; k++) if (e.warnings[k].code === code && e.warnings[k].field === (field || "")) return;
        var w = { code: code, field: field || "" };
        if (extra) for (var p in extra) w[p] = extra[p];
        e.warnings.push(w);
      };
      if (e.status === "manual" || (e.status === "ready" && !hasReading(e))) { add("unreadable"); }
      var d = daysLeft(e.expiryDate, today);
      if (d !== null && d < 0) add("expired", "expiryDate", { days: d });
      else if (d !== null && d <= 30) add("expiring", "expiryDate", { days: d });
      if (e.status === "ready") {
        if (e.confidence === "low") add("low_confidence");
        var f = e.fields || {};
        if (f.vatNumber && !/^3\d{13}3$/.test(f.vatNumber)) add("bad_vat", "vatNumber");
        if (f.crNumber && !/^\d{10}$/.test(f.crNumber)) add("bad_cr", "crNumber");
        for (var s = 0; s < (e.serverWarnings || []).length; s++) {
          var sw = e.serverWarnings[s];
          if (sw.code === "duplicate") add("duplicate", sw.field, { server: true });
          else if (sw.code === "expired" || sw.code === "expiring") { /* محسوبٌ هنا من التاريخ */ }
          else add(sw.code, sw.field);
        }
      }
    }
    // 2) المكرر داخل الدفعة: الأحدث في الترتيب هو المكرر
    var seen = {};
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (e.status === "failed" || e.status === "queued" || e.status === "reading") continue;
      var k2 = idKey(e);
      if (seen[k2]) {
        e.dupOf = seen[k2];
        e.warnings.push({ code: "duplicate", field: "", of: seen[k2] });
      } else seen[k2] = e.id;
    }
    // 3) التعارض بين الملفات المُبقاة، ومع المسجَّل
    var keys = [["crNumber", "cr_number"], ["vatNumber", "vat_number"], ["companyNameAr", "name_ar"]];
    for (var q = 0; q < keys.length; q++) {
      var fk = keys[q][0], ck = keys[q][1];
      var vals = [];
      for (i = 0; i < entries.length; i++) {
        e = entries[i];
        if (e.status !== "ready" || e.keep === false || e.dupOf) continue;
        var v = e.fields && e.fields[fk];
        if (!v) continue;
        var hit = false;
        for (j = 0; j < vals.length; j++) if (sameVal(ck, vals[j].v, v)) { vals[j].ids.push(e.id); hit = true; break; }
        if (!hit) vals.push({ v: v, ids: [e.id] });
      }
      if (vals.length > 1) {
        for (j = 0; j < vals.length; j++) for (var m = 0; m < vals[j].ids.length; m++) {
          for (i = 0; i < entries.length; i++) if (entries[i].id === vals[j].ids[m]) entries[i].warnings.push({ code: "conflict", field: ck });
        }
      }
      // أرقام السجل والضريبة المسجَّلة لا تُستبدل بصمت؛ الاسم المسجَّل يحلّ محلّه المقروء (يُنبَّه في بطاقة الشركة).
      if ((ck === "cr_number" || ck === "vat_number") && str(org[ck])) {
        for (j = 0; j < vals.length; j++) if (!sameVal(ck, vals[j].v, org[ck])) {
          for (var n = 0; n < vals[j].ids.length; n++) for (i = 0; i < entries.length; i++) if (entries[i].id === vals[j].ids[n]) entries[i].warnings.push({ code: "conflict_saved", field: ck });
        }
      }
    }
    return entries;
  }

  // «بيانات شركتك» المقترحة: لكل حقل أفضل مصدر (سلطة النوع ثم الثقة)، والبدائل المختلفة من ملفات أخرى.
  // الناتج { حقل: { value, from, alts:[{value,from}], conflict } } — حقلٌ لم يُجد مصدراً لا يظهر.
  function suggestCompany(entries) {
    var out = {};
    for (var c = 0; c < COMPANY_FIELDS.length; c++) {
      var ck = COMPANY_FIELDS[c];
      var map = { name_ar: "companyNameAr", name_en: "companyNameEn", cr_number: "crNumber", vat_number: "vatNumber", city: "city" }[ck];
      var cands = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.status !== "ready" || e.keep === false || e.dupOf) continue;
        if (e.docType === "id") continue;
        var v = str(e.fields && e.fields[map]);
        if (!v) continue;
        var rank = (AUTH[ck][e.docType] != null ? AUTH[ck][e.docType] : 0) * 10 + (CONF_RANK[(e.fieldConfidence && e.fieldConfidence[map]) || e.confidence] || 2);
        cands.push({ value: v, from: e.id, rank: rank, order: i });
      }
      if (!cands.length) continue;
      cands.sort(function (a, b) { return b.rank - a.rank || a.order - b.order; });
      var best = cands[0], alts = [];
      for (var j = 1; j < cands.length; j++) {
        if (sameVal(ck, best.value, cands[j].value)) continue;
        var dup = false;
        for (var k = 0; k < alts.length; k++) if (sameVal(ck, alts[k].value, cands[j].value)) dup = true;
        if (!dup) alts.push({ value: cands[j].value, from: cands[j].from });
      }
      out[ck] = { value: best.value, from: best.from, alts: alts, conflict: alts.length > 0 };
    }
    return out;
  }

  // ما تغيّر فعلاً عن المسجَّل: حقلٌ فارغ لا يُرسَل، ومطابقٌ للمسجَّل لا يُرسَل.
  function companyDiff(current, edited) {
    var out = {};
    current = current || {};
    edited = edited || {};
    for (var i = 0; i < COMPANY_FIELDS.length; i++) {
      var k = COMPANY_FIELDS[i], to = str(edited[k]), from = str(current[k]);
      if (!to) continue;
      if (from && exactSame(k, from, to)) continue;
      out[k] = { from: from, to: to };
    }
    return out;
  }

  // حمولة doc-intake-confirm لملفٍ واحد (البايتات تُضاف عند الإرسال، ولا تُحفظ في الحالة).
  // «ما أكّده العميل فقط»: الملف المتجاهَل لا يخرج، والحقول المقروءة تخرج كما وافق عليها لا كما قرأها النموذج.
  function confirmFile(e) {
    var f = e.fields || {};
    var read = {};
    for (var k in f) if (f[k]) read[k] = f[k];
    var out = {
      id: e.id, name: e.name, mime: e.mime,
      title: str(e.title).slice(0, 200), category: str(e.category) || "other",
      docType: e.docType || "other", expiryDate: validDate(e.expiryDate), issueDate: validDate(e.issueDate)
    };
    if (e.status === "ready" && hasReading(e)) out.fields = read;
    else out.unread = true;
    return out;
  }
  function confirmPlan(entries, edited, current) {
    var files = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.keep === false || e.status === "failed" || e.status === "queued" || e.status === "reading") continue;
      files.push(confirmFile(e));
    }
    var diff = companyDiff(current, edited), company = {};
    for (var k in diff) company[k] = diff[k].to;
    return { files: files, company: company, diff: diff };
  }

  // رمز خطأ الخادم/الشبكة ← مفتاح نص للعميل. بلا رمزٍ ينتهي بـ«حدث خطأ» عامّ.
  function errKey(code, httpStatus) {
    code = str(code);
    if (code === "network") return "ixENet";
    if (code === "too_large" || code === "http_413") return "ixEBig";
    if (code === "bad_type") return "ixEType";
    if (code === "empty") return "ixEEmpty";
    if (code === "unreadable" || code === "no_text" || code === "read_failed") return "ixEUnread";
    if (code === "file_too_large_to_read") return "ixEBigRead";
    if (code === "reader_unavailable" || code === "service_unavailable" || code === "ai_unavailable" || code === "ai_off" || code === "not_configured") return "ixEService";
    if (code === "rate_limited" || code === "busy") return "ixEBusy";
    if (code === "no_org") return "ixENoOrg";
    if (code === "too_many_files") return "ixEMany";
    return "ixEGeneric";
  }
  // أخطاء الخدمة كلها (لا أخطاء ملفٍ بعينه): إن حدثت توقّفنا عن القراءة وحفظنا الباقي كما هو.
  function isServiceDown(code, httpStatus) {
    code = str(code);
    return code === "reader_unavailable" || code === "service_unavailable" || code === "ai_unavailable" || code === "ai_off" || code === "not_configured" || code === "unknown_action" || httpStatus === 404 || httpStatus === 501 || httpStatus === 503;
  }

  return {
    MAX_BYTES: MAX_BYTES, MAX_READ: MAX_READ, MAX_FILES: MAX_FILES, COMPANY_FIELDS: COMPANY_FIELDS,
    mimeOf: mimeOf, fileCheck: fileCheck, baseName: baseName, digits: digits, sameName: sameName, sameVal: sameVal, exactSame: exactSame,
    daysLeft: daysLeft, categoryOf: categoryOf, fromServer: fromServer, hasReading: hasReading,
    reconcile: reconcile, suggestCompany: suggestCompany, companyDiff: companyDiff,
    confirmFile: confirmFile, confirmPlan: confirmPlan, errKey: errKey, isServiceDown: isServiceDown
  };
}
