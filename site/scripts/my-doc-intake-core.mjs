// المنطق الصافي لرحلة «ارفع كل ملفات شركتك مرة واحدة» في /my — بلا DOM وبلا شبكة.
//
// يملكه client-portal (واجهة فقط). الخادم (api/_doc-intake.js وإجراءا doc-intake و
// doc-intake-confirm في api/_simple.js) يملكه وكيل المستندات، وهذا الملف يقرأ ردّه
// كما هو في الواقع، وتحرس ذلك tests/my-doc-intake.test.mjs باستدعاء intakeBatch
// وconfirmIntake نفسيهما (لا نسخةٍ مكتوبة بيد).
//
// لماذا دالةٌ واحدة تُرجع كائناً: الصفحة تحمل هذا المنطق بنسخ نصّ الدالة نفسها
// (`makeIntakeCore.toString()`) إلى سكربت /my، والاختبارات تستدعي الدالة نفسها —
// فما يُختبر هو ما يعمل في المتصفح لا نسخةٌ ثانية منه. لذلك يجب أن تكون الدالة
// مكتفية بذاتها: لا مرجع إلى شيء خارجها، ولا `${` ولا علامة اقتباس عكسية بداخلها.
export function makeIntakeCore() {
  // الحدّ الفعلي لجسم الطلب ٤٫٥MB (Vercel وخادم Azure معاً) وbase64 يزيده ثلثاً، فالخادم يرفض
  // نداءً تتجاوز ملفاته الخام ٣٫٣MB (api/_doc-intake.js INTAKE_MAX_BATCH_BYTES). الواجهة تلتزم بالحدّ نفسه.
  var MAX_BYTES = 3.3 * 1024 * 1024;
  var PACK_BYTES = 3.0 * 1024 * 1024;   // مجموع ما يُرسل في نداء قراءة واحد (هامشٌ تحت الحدّ)
  var PACK_FILES = 3;                   // تزامن القراءة في الخادم ٣: نداءٌ بثلاثة ملفات يستغرق وقت ملفٍ واحد
  var MAX_FILES = 12;
  var PRIOR_MAX = 30;
  var OK_MIME = { "application/pdf": "application/pdf", "image/jpeg": "image/jpeg", "image/jpg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp" };
  var OK_EXT = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  var COMPANY_FIELDS = ["name_ar", "name_en", "cr_number", "vat_number", "city"];
  var CATS = ["cr", "vat", "contract", "id", "other"];   // تصنيفات الخزانة التي يقبلها الخادم عند الاعتماد
  var LEVEL_RANK = { high: 3, medium: 2, low: 1 };

  function str(v) { return v == null ? "" : String(v).trim(); }
  function ext(n) { var t = str(n); var i = t.lastIndexOf("."); return i < 0 ? "" : t.slice(i + 1).toLowerCase(); }
  // النوع من ترويسة المتصفح أولاً، ومن الامتداد حين يصمت المتصفح (أندرويد وبعض الـPDF). الخادم يتحقق من بصمة البايتات.
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
  // تطابقٌ تامّ (للحفظ والعرض): الأرقام بأرقامها، والأسماء بعد إزالة الفروق الشكلية فقط.
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

  // ----- القراءة: ما يُرسَل وما يُستلَم
  // حزم الملفات في نداءات: كل نداء ≤ ٣ ملفات و≤ ٣MB خاماً، وملفٌّ واحد كبير (حتى ٣٫٣MB) يذهب وحده.
  // list عناصرها {id,size}؛ يعيد مصفوفة مصفوفات من الـid بترتيب الإدخال.
  function packBatches(list) {
    var out = [], cur = [], bytes = 0, i, it;
    for (i = 0; i < list.length; i++) {
      it = list[i];
      if (cur.length && (cur.length >= PACK_FILES || bytes + it.size > PACK_BYTES)) { out.push(cur); cur = []; bytes = 0; }
      cur.push(it.id); bytes += it.size;
    }
    if (cur.length) out.push(cur);
    return out;
  }
  // نتائج النداءات السابقة التي يطلب الخادم تمريرها (prior) لدمج الحقائق وكشف التكرار عبر النداءات.
  // لا يُمرَّر ما سيُرسَل الآن (وإلا عُدّ مكرراً لنفسه).
  function priorFrom(entries, exceptIds) {
    var out = [], i, e;
    for (i = entries.length - 1; i >= 0 && out.length < PRIOR_MAX; i--) {
      e = entries[i];
      if (!e.srv || (exceptIds && exceptIds.indexOf(e.id) >= 0)) continue;
      out.unshift({ id: e.srv.id, fileName: e.srv.fileName, sha256: e.srv.sha256, docType: e.srv.docType, issueDate: e.srv.issueDate || null, suspicious: !!e.srv.suspicious, fields: e.srv.fields || {} });
    }
    return out;
  }

  // ردّ الخادم عن ملفٍ واحد ← حقول المدخل. status الخادم: read · unreadable · deferred · rejected · duplicate.
  //   read        مقروء، جاهز للمراجعة                         → ready
  //   unreadable  لم يُقرأ (أو الخدمة معطّلة) ويُحفظ كما هو    → manual
  //   deferred    ضاق الوقت فلم يُقرأ؛ يُعاد وحده              → manual
  //   rejected    مرفوض (صيغة/تلف/فراغ/حجم) ولا يُحفظ           → failed
  //   duplicate   مكرر (في الدفعة أو الخزانة) ولا يُحفظ         → dup
  function fromServer(x) {
    x = x || {};
    var st = str(x.status);
    var status = st === "read" ? "ready" : (st === "unreadable" || st === "deferred") ? "manual" : st === "duplicate" ? "dup" : "failed";
    if (status === "manual" && x.canSave === false) status = "failed";
    var fields = {}, k, f;
    var src = x.fields && typeof x.fields === "object" ? x.fields : {};
    for (k in src) {
      f = src[k];
      if (f && typeof f === "object" && str(f.value)) {
        fields[k] = { value: str(f.value), confidence: Number(f.confidence) || 0, level: LEVEL_RANK[str(f.level)] ? str(f.level) : "medium", needsReview: f.needsReview === true };
      }
    }
    var warnings = [], w = Array.isArray(x.warnings) ? x.warnings : [], i;
    for (i = 0; i < w.length; i++) {
      if (w[i] && w[i].code) warnings.push({ code: str(w[i].code), severity: str(w[i].severity) || "warn", message: str(w[i].message), field: str(w[i].field), days: w[i].days, date: str(w[i].date) });
    }
    var cat = str(x.category);
    return {
      status: status, srv: x, srvId: str(x.id), sha256: str(x.sha256),
      docType: str(x.docType) || "unknown", category: CATS.indexOf(cat) >= 0 ? cat : "other", categoryDetail: str(x.categoryDetail),
      title: str(x.title).slice(0, 200), fields: fields,
      issueDate: validDate(x.issueDate), expiryDate: validDate(x.expiry || (fields.expiryDate && fields.expiryDate.value)),
      confidence: Number(x.confidence) || 0, level: confLevel(Number(x.confidence) || 0),
      warnings: warnings, canSave: x.canSave !== false, suspicious: x.suspicious === true,
      mime: str(x.mime)
    };
  }
  function confLevel(n) { return n >= 0.85 ? "high" : n >= 0.6 ? "medium" : "low"; }

  // تحذيرات العرض: ما قاله الخادم، مع إعادة حساب «منتهٍ/ينتهي قريباً» من التاريخ الحالي في الخانة
  // (العميل قد يصحّحه)، وملاحظة «نسخة جديدة» إن وُجد في الخزانة مستندٌ بالتصنيف والعنوان نفسيهما.
  function displayWarnings(e, today, vaultDocs) {
    var out = [], i, w;
    for (i = 0; i < (e.warnings || []).length; i++) {
      w = e.warnings[i];
      if (w.code === "expired" || w.code === "expiring_soon") continue;
      out.push(w);
    }
    var d = daysLeft(e.expiryDate, today);
    if (d !== null && d < 0) out.push({ code: "expired", severity: "error", field: "expiryDate", date: e.expiryDate, days: d });
    else if (d !== null && d <= 30) out.push({ code: "expiring_soon", severity: "warn", field: "expiryDate", date: e.expiryDate, days: d });
    var t = str(e.title).toLowerCase();
    if (t && e.status !== "dup" && e.status !== "failed") {
      for (i = 0; i < (vaultDocs || []).length; i++) {
        if (vaultDocs[i].category === e.category && str(vaultDocs[i].title).toLowerCase() === t) { out.push({ code: "new_version", severity: "info" }); break; }
      }
    }
    return out;
  }

  // ----- بيانات الشركة المقترحة
  // الخادم يدمج الحقائق عبر كل الملفات (suggested[col] = {value,level,source,conflict,alternatives,current,same,willOverwrite,needsReview}).
  // هنا نطبّق ما يعرفه العميل وحده: ملفٌّ تجاهله لا يُؤخذ منه اقتراح. إن كان مصدر القيمة مُتجاهَلاً
  // رُقّي أول بديلٍ مصدره ملفٌّ مُبقى؛ فإن لم يبقَ بديلٌ سقط الاقتراح وبقي المسجَّل.
  function adjustSuggestions(suggested, entries) {
    var ignored = {}, i;
    // المكرر يحمل معرّف أصله (المعرّف من بصمة المحتوى): لا يُحسب «متجاهَلاً» وإلا أسقط اقتراح الأصل.
    for (i = 0; i < entries.length; i++) if (entries[i].srvId && entries[i].keep === false && (entries[i].status === "ready" || entries[i].status === "manual")) ignored[entries[i].srvId] = true;
    var out = {}, col, s, cands, j, c;
    for (col in suggested || {}) {
      s = suggested[col];
      if (!s || !str(s.value)) continue;
      cands = [{ value: s.value, level: s.level, source: s.source }];
      for (j = 0; j < (s.alternatives || []).length; j++) cands.push({ value: s.alternatives[j].value, level: confLevel(Number(s.alternatives[j].confidence) || 0), source: s.alternatives[j].source });
      var live = [];
      for (j = 0; j < cands.length; j++) { c = cands[j]; if (!(c.source && ignored[c.source.fileId])) live.push(c); }
      if (!live.length) continue;
      var best = live[0], alts = live.slice(1), cur = str(s.current);
      var same = !!cur && exactSame(col, cur, best.value);
      out[col] = {
        value: best.value, level: best.level || "medium", source: best.source || null, alts: alts,
        conflict: alts.length > 0 || (live.length === cands.length && s.conflict === true),
        current: cur, same: same, willOverwrite: !!cur && !same,
        needsReview: alts.length > 0 || best.level === "low" || (!!cur && !same) || (live.length === cands.length && s.needsReview === true)
      };
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
  // أرقام الشركة بصيغةٍ يقبلها الخادم (cleanConfirmedFacts)؛ الخطأ يُمنع قبل الإرسال لا بعده.
  function factIssues(diff) {
    var out = [];
    if (diff.cr_number && !/^\d{6,15}$/.test(digits(diff.cr_number.to))) out.push({ field: "cr_number", error: "invalid_cr" });
    if (diff.vat_number && !/^3\d{13}3$/.test(digits(diff.vat_number.to))) out.push({ field: "vat_number", error: "invalid_vat" });
    return out;
  }

  // ----- الاعتماد: ما أكّده العميل فقط
  // الملف المتجاهَل والمكرر والمرفوض لا يخرج. الحقول المقروءة تخرج كما وافق عليها لا كما قرأها النموذج:
  // الحقل الذي طلب الخادم مراجعته يخرج بعلامته (needsReview) حتى يبقى المستند «قيد التحقق»، وما سواه مؤكَّد.
  function savable(e) { return e.keep !== false && (e.status === "ready" || e.status === "manual" || e.status === "local"); }
  function confirmFile(e) {
    var out = { id: e.srvId, name: e.name, mime: e.mime, title: str(e.title).slice(0, 200), category: CATS.indexOf(e.category) >= 0 ? e.category : "other", docType: e.docType || "unknown", expiry: validDate(e.expiryDate) };
    if (e.status === "ready") {
      var f = {}, k;
      for (k in (e.fields || {})) f[k] = { value: e.fields[k].value, needsReview: e.fields[k].needsReview === true, confirmed: e.fields[k].needsReview !== true };
      out.fields = f;
    }
    return out;
  }
  function confirmPlan(entries, edited, current) {
    var files = [], localFiles = [], i, e;
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (!savable(e)) continue;
      if (e.status === "local") localFiles.push({ id: e.id, name: e.name, mime: e.mime, title: str(e.title).slice(0, 200), category: CATS.indexOf(e.category) >= 0 ? e.category : "other", expiry: validDate(e.expiryDate) });
      else files.push(confirmFile(e));
    }
    var diff = companyDiff(current, edited), facts = {}, k;
    for (k in diff) facts[k] = diff[k].to;
    return { files: files, localFiles: localFiles, facts: facts, diff: diff, issues: factIssues(diff) };
  }

  // رمز خطأ الخادم/الشبكة ← مفتاح نص للعميل. بلا رمزٍ ينتهي بـ«تعذّرت المعالجة» العامّ.
  function errKey(code) {
    code = str(code);
    if (code === "network") return "ixENet";
    if (code === "too_large" || code === "http_413") return "ixEBig";
    if (code === "bad_type") return "ixEType";
    if (code === "empty") return "ixEEmpty";
    if (code === "corrupt") return "ixECorrupt";
    if (code === "rate_limited" || code === "http_429") return "ixERate";
    if (code === "file_changed") return "ixEChanged";
    if (code === "duplicate") return "ixSkipDup";
    if (code === "store_failed") return "ixESave";
    if (code === "invalid_fields") return "eName";
    if (code === "no_org") return "ixENoOrg";
    if (code === "too_many_files") return "ixEMany";
    if (code === "unreadable" || code === "read_failed") return "ixEUnread";
    if (code === "unknown_action" || code === "http_404" || code === "http_501" || code === "http_503" || code === "http_502") return "ixEService";
    return "ixEGeneric";
  }
  // نداءٌ فشل كله لأن الخدمة نفسها غير موجودة/معطّلة (لا لأن ملفاً بعينه فاسد).
  function isServiceDown(code) {
    code = str(code);
    return code === "unknown_action" || code === "http_404" || code === "http_501" || code === "http_502" || code === "http_503";
  }

  return {
    MAX_BYTES: MAX_BYTES, MAX_FILES: MAX_FILES, COMPANY_FIELDS: COMPANY_FIELDS, CATS: CATS,
    mimeOf: mimeOf, fileCheck: fileCheck, baseName: baseName, digits: digits, exactSame: exactSame,
    daysLeft: daysLeft, packBatches: packBatches, priorFrom: priorFrom, fromServer: fromServer, confLevel: confLevel,
    displayWarnings: displayWarnings, adjustSuggestions: adjustSuggestions, companyDiff: companyDiff, factIssues: factIssues,
    savable: savable, confirmFile: confirmFile, confirmPlan: confirmPlan, errKey: errKey, isServiceDown: isServiceDown
  };
}
