// SHR-HR — شاشات الامتثال: لوحة المنشآت · سجل المخالفات · قوائم التحقق · التنبيهات ·
// استيراد الملفات · تصنيف أسماء A33.
//
// shrComplianceClient تعمل في المتصفح: تُحقن في صفحة /SHR-HR بـ toString()، فلا تلمس شيئاً
// خارج جسمها (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ${ داخلها). ES5 عمداً ليطابق بقية الصفحة.
//
// كل رقم نظامي (غرامة، موعد، نطاق) يأتي من الخادم وهو يقرؤه من db/shr-ref؛ الواجهة لا تحسب شيئاً
// ولا تحمل رقماً نظامياً. وسم «بيانات تجريبية» ثابت أعلى الصفحة من القشرة؛ ووسما «تقديري» و«غير مؤكد
// من المصدر» يظهران حسب الحالة، وعبارة «لا نضمن إلغاء المخالفة» ثابتة في كل شاشة. لا شعار ولا ادعاء ترخيص.

export const COMPLIANCE_CSS = `
.shr .cmp-note{background:#fff8e6;border:1px solid #f59e0b;color:#7a4a05;border-radius:10px;padding:8px 12px;font-size:.82rem;font-weight:700;margin-bottom:12px}
.shr .pill.est{background:#e8f1ff;color:#1d4ed8}
.shr .pill.unc{background:#fff3e6;color:#b45309;border:1px dashed #f59e0b}
.shr .tiny{font-size:.74rem;color:#5f6880}
.shr .kv{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.shr .row-unc{background:#fffaf0}
.shr .sm{padding:4px 9px;font-size:.76rem}
.shr .inp.sm{padding:4px 8px;font-size:.8rem}
.shr .chk{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #e4e8f1}
.shr .chk.off{opacity:.65}
`;

export const COMPLIANCE_ERR = {
  establishment_blocked: 'المنشأة محجوبة: حالة القيد تمنع هذا الإجراء',
  a33_blocked: 'العامل مرتبط بقائمة A33 غير مكتملة التصنيف والاعتماد',
  compliance_officer_required: 'حالة «تقديم» لا يغيّرها إلا مسؤول الامتثال',
  review_required: 'لا تقدّم بلا مراجعة ثانية من مستخدم آخر',
  already_reviewed: 'روجعت أصلاً',
  already_verified: 'تُحقِّق منها أصلاً',
  already_approved: 'اعتُمد أصلاً',
  already_decided: 'قُرّر في الطلب أصلاً',
  not_classified: 'يلزم التصنيف أولاً',
  owner_only: 'تغيير الإعدادات لمالك المستأجر وحده',
  unknown_rule: 'بند غير موجود في المرجع',
  rule_unconfirmed: 'البند غير مؤكد من المصدر — لا يُفعَّل',
  tier_unknown: 'شريحة غير موجودة في المرجع',
  authority_required: 'الجهة مطلوبة',
  bad_persons_count: 'عدد الأشخاص أو الحالات غير صالح',
  bad_notification_date: 'تاريخ التبليغ غير صالح',
  notification_in_future: 'تاريخ التبليغ لا يكون في المستقبل',
  notification_date_required: 'أدخل تاريخ التبليغ من الإشعار الرسمي',
  forbidden_deadline_input: 'لا يُشتق الموعد من تاريخ المخالفة أو القرار — تاريخ التبليغ وحده',
  regulatory_figure_not_allowed: 'الأرقام النظامية تأتي من المرجع وحده',
  duplicate_violation: 'رقم المخالفة مسجّل أصلاً لهذه الجهة',
  bad_status: 'حالة غير معروفة',
  bad_transition: 'انتقال غير مسموح: خطوة واحدة فقط',
  same_status: 'الحالة نفسها',
  bad_restriction_state: 'حالة قيد غير صالحة',
  reason_required: 'السبب مطلوب',
  bad_band: 'نطاق غير صالح',
  unknown_activity: 'نشاط غير موجود في المرجع',
  bad_declared_pct: 'نسبة معلنة غير صالحة',
  bad_count: 'عدد غير صالح',
  demo_alias_required: 'الاسم يحمل وسم «(وهمي)» في هذه المرحلة',
  field_not_allowed: 'حقل غير مسموح (لا أسماء حقيقية ولا هوية خام)',
  duplicate_name: 'الاسم مكرر في القائمة',
  list_ref_required: 'مرجع القائمة مطلوب',
  alias_required: 'الاسم الوهمي مطلوب',
  id_no_required: 'رقم هوية وهمي مطلوب (يُحفظ بصمةً فقط)',
  bad_classification: 'تصنيف غير صالح',
  no_assignment: 'للعامل لا إسناد حالي',
  same_establishment: 'المنشأة نفسها',
  transfer_pending: 'لدى العامل طلب نقل معلّق',
  bad_decision: 'قرار غير صالح',
  bad_kind: 'نوع دفعة غير صالح',
  no_rows: 'لا صفوف',
  too_many_rows: 'الحد الأقصى للدفعة تجاوزه الملف',
  no_valid_rows: 'لا صف صالح في الملف',
  scope_mismatch: 'القائمة لا تخص هذا النوع',
  bad_subject_kind: 'نوع غير صالح',
  done_required: 'الحالة مطلوبة',
  statuses_unconfirmed: 'أسماء الحالات غير مؤكدة في المرجع',
  unknown_setting: 'إعداد غير معروف',
  bad_setting: 'قيمة إعداد غير صالحة'
};

export function shrComplianceClient(env) {
  var h = env.h, call = env.call, frame = env.frame, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render;
  var STATE_AR = { unknown: 'غير معروفة', clear: 'نظيفة', restricted: 'مقيّدة', suspected: 'اشتباه' };
  var STATE_CLS = { unknown: 'warn', clear: 'ok', restricted: 'bad', suspected: 'bad' };
  var CLS_AR = { actual_worker: 'عامل فعلي', not_a_worker: 'ليس عاملاً', works_for_other: 'يعمل لدى جهة أخرى' };
  var PAID_AR = { unknown: 'غير معروف', unpaid: 'غير مسدّدة', paid: 'مسدّدة' };
  var TSTATE = { requested: 'بانتظار الموافقة', approved: 'موافَق', rejected: 'مرفوض' };
  var ISTATE = { uploaded: 'مرفوع', matched: 'مطابَق', reviewed: 'روجع', applied: 'مطبَّق' };
  var INEXT = { uploaded: ['import-match', 'مطابقة'], matched: ['import-review', 'مراجعة'], reviewed: ['import-apply', 'تطبيق'] };
  var KIND_AR = { gosi: 'تأمينات', wps: 'حماية أجور' };
  var AL = { document_expired: 'مستند منتهٍ', document_expiring: 'مستند ينتهي قريباً', objection_deadline_near: 'موعد اعتراض تقديري قريب', objection_deadline_passed: 'موعد اعتراض تقديري مضى',
    notification_date_missing: 'تاريخ التبليغ غير مُدخل', establishment_blocked: 'منشأة محجوبة', establishment_state_unknown: 'حالة القيد غير معروفة', snapshot_unverified: 'لقطة غير متحقَّق منها', a33_unresolved: 'قائمة A33 غير مكتملة' };
  var SEV = { high: ['عالية', 'bad'], medium: ['متوسطة', 'warn'], low: ['منخفضة', 'mut'] };
  var DOCK = { iqama: 'الإقامة', medical_insurance: 'التأمين الطبي', work_contract: 'عقد العمل', passport: 'الجواز', gosi: 'التأمينات' };
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  var opt = function (v, t, sel) { var o = h('option', { value: v }, [t]); if (sel) o.selected = true; return o; };
  function act(action, data, okMsg) { return call(action, data).then(function (r) { flash(r.ok, r.ok ? okMsg : errText(r)); render(); return r; }); }
  function note() { return h('div', { class: 'cmp-note' }, ['لا نضمن إلغاء المخالفة. المبالغ والمواعيد تقديرية، تُؤكَّد من بوابة الجهة قبل الاعتماد عليها، ومصدر كل رقم ظاهر بجانبه.']); }
  function est(label) { return pill(label || 'تقديري', 'est'); }
  function unc() { return pill('غير مؤكد من المصدر', 'unc'); }
  function src(o) { return o && (o.source_ref || o.source_url) ? h('div', { class: 'tiny', title: o.source_url || '' }, ['المصدر: ' + (o.source_ref || o.source_url)]) : null; }
  function cframe(title, content) { frame(title, h('div', {}, [note(), content])); }
  function ref() { if (state.cref) return Promise.resolve(state.cref); return call('compliance-ref', null, true).then(function (o) { state.cref = o; return o; }); }
  function estOpts() { return call('compliance-dashboard', null, true).then(function (o) { return o.establishments || []; }); }

  // ---------------------------------------------------------------- لوحة الامتثال ----
  function vDash() {
    return Promise.all([call('compliance-dashboard', null, true), call('compliance-transfers', null, true)]).then(function (res) {
      var o = res[0], tr = res[1].transfers || [], t = o.totals || {}, rows = o.establishments || [], s = o.settings || {};
      var K = [['establishments', 'منشآت', ''], ['blocked', 'محجوبة (مقيّدة/اشتباه)', t.blocked ? 'hot' : ''], ['unknown', 'حالتها غير معروفة', t.unknown ? 'hot' : ''], ['violations_open', 'مخالفات مفتوحة', t.violations_open ? 'hot' : ''], ['alerts', 'تنبيهات', t.alerts ? 'hot' : ''], ['documents_expiring', 'مستندات تنتهي قريباً', '']];
      var kp = h('div', { class: 'shr-kpis' }, K.map(function (k) { return h('div', { class: 'shr-kpi ' + k[2] }, [h('b', {}, [String(t[k[0]] || 0)]), h('span', {}, [k[1]])]); }));
      var tb = h('table', {}, [th(['المنشأة', 'حالة القيد', 'النطاق المعلن / التقدير', 'مخالفات', 'أقرب موعد تقديري', 'A33', '']), h('tbody', {}, rows.map(function (e) {
        var c = e.computed && e.computed.band_ar ? e.computed.band_ar : (e.computed && e.computed.unavailable ? '—' : null);
        var bandCell = [h('div', {}, [(e.declared_band_ar || '—') + (e.declared_saudization_pct !== null && e.declared_saudization_pct !== undefined ? ' · ' + e.declared_saudization_pct + '%' : '')])];
        if (c) bandCell.push(h('div', { class: 'kv' }, [est('تقدير: ' + c)]));
        var st = [pill(STATE_AR[e.state] || e.state, STATE_CLS[e.state] || '')];
        if (!e.verified) st.push(pill('غير متحقَّق', 'warn'));
        if (e.pending_clear_verification) st.push(pill('رفع القيد بانتظار تحقق', 'warn'));
        return h('tr', {}, [h('td', {}, [e.name_ar, e.reason ? h('div', { class: 'tiny' }, [e.reason]) : null]), h('td', {}, [h('div', { class: 'kv' }, st)]), h('td', {}, bandCell),
          h('td', {}, [e.violations_open + ' / ' + e.violations_total + (e.unconfirmed_rules ? ' ' : ''), e.unconfirmed_rules ? unc() : null]),
          h('td', {}, [e.next_deadline_estimate ? h('div', { class: 'kv' }, [e.next_deadline_estimate, est()]) : '—']), h('td', {}, [e.a33_pending ? pill(String(e.a33_pending) + ' بلا اعتماد', 'warn') : '—']),
          h('td', {}, [h('button', { class: 'btn ghost sm', onclick: function () { state.eid = e.id; state.view = 'c_est'; state.msg = ''; state.err = ''; render(); } }, ['التفاصيل'])])]);
      }))]);
      // طلبات النقل: طلب ثم موافقة من غير الطالب.
      var ttb = h('table', {}, [th(['العامل', 'من', 'إلى', 'السبب', 'الحالة', '']), h('tbody', {}, tr.map(function (x) {
        var acts = [];
        if (x.state === 'requested') {
          acts.push(h('button', { class: 'btn sm', onclick: function () { act('transfer-decide', { id: x.id, decision: 'approve' }, 'وُوفق على النقل — سُجّل'); } }, ['موافقة']));
          acts.push(h('button', { class: 'btn ghost sm', onclick: function () { act('transfer-decide', { id: x.id, decision: 'reject' }, 'رُفض النقل'); } }, ['رفض']));
        }
        return h('tr', {}, [h('td', {}, [x.worker || '—']), h('td', {}, [x.from || '—']), h('td', {}, [x.to || '—']), h('td', {}, [x.reason]), h('td', {}, [pill(TSTATE[x.state] || x.state, x.state === 'approved' ? 'ok' : x.state === 'rejected' ? 'bad' : 'warn')]), h('td', {}, [h('div', { class: 'kv' }, acts)])]);
      }))]);
      // الإعدادات: مالك المستأجر وحده يغيّرها.
      var cb = function (k, label) { var i = h('input', { type: 'checkbox' }); i.checked = !!s[k]; i.addEventListener('change', function () { var d = {}; d[k] = i.checked; act('compliance-settings-update', d, 'حُفظ الإعداد'); }); return h('label', { class: 'kv' }, [i, label]); };
      var num = function (k, label) { var i = h('input', { class: 'inp sm', type: 'number', style: 'width:80px' }); i.value = s[k]; return h('div', { class: 'kv' }, [label, i, h('button', { class: 'btn ghost sm', onclick: function () { var d = {}; d[k] = Number(i.value); act('compliance-settings-update', d, 'حُفظ الإعداد'); } }, ['حفظ'])]); };
      var set = h('div', { class: 'shr-card' }, [h('h2', {}, ['إعدادات الامتثال (للمستأجر)']), cb('unknown_blocks', 'حالة القيد «غير معروفة» تمنع (الافتراضي: تحذير فقط)'), cb('a33_gate', 'حجب تفعيل العامل المرتبط بقائمة A33 غير المعتمدة'), cb('client_visibility', 'السماح للعميل برؤية المخالفات المؤكدة والمراجَعة (الافتراضي: لا)'),
        num('expiry_alert_days', 'عتبة تنبيه انتهاء المستندات (أيام): '), num('deadline_alert_days', 'عتبة تنبيه المواعيد التقديرية (أيام): '), h('p', { class: 'tiny' }, ['افتراضات تشغيلية قابلة للتغيير لا أرقام نظامية. يغيّرها tenant_owner وحده.'])]);
      cframe('لوحة الامتثال', h('div', {}, [kp, h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['المنشآت']), tb]),
        h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['طلبات نقل العمال بين المنشآت']), tr.length ? ttb : h('p', { class: 'note' }, ['لا طلبات.']), h('p', { class: 'tiny' }, ['النقل بطلب وموافقة من غير الطالب وسجل. شروط النقل الرسمية لم تُوجد في المرجع فلا يُفحص شيء منها هنا.'])]), set]));
    });
  }

  // -------------------------------------------------------------- تفاصيل منشأة ----
  function vEst() {
    return Promise.all([call('compliance-establishment', { id: state.eid }, true), ref()]).then(function (res) {
      var o = res[0], rf = res[1].reference;
      if (!o.ok) { state.view = 'c_dash'; flash(false, errText(o)); return render(); }
      var e = o.effective, snaps = o.snapshots || [];
      var head = h('div', { class: 'shr-card' }, [h('h2', {}, [o.establishment.name_ar]), h('div', { class: 'kv' }, [pill('الحالة الفعلية: ' + (STATE_AR[e.state] || e.state), STATE_CLS[e.state] || ''), e.verified ? pill('متحقَّق منها', 'ok') : pill('غير متحقَّق', 'warn'), e.pending_clear_verification ? pill('رفع القيد بانتظار تحقق', 'warn') : null]),
        e.reason ? h('p', { class: 'note' }, ['السبب: ' + e.reason]) : null,
        h('p', { class: 'tiny' }, ['الحجب: مقيّدة أو اشتباه تحجب أوامر الاستقدام وخطوات التأشيرة. لقطة «نظيفة» غير متحقَّق منها لا تُصدَّق ولا ترفع قيداً. غير المعروفة تحذير فقط ما لم يفعّل المستأجر المنع.']),
        h('button', { class: 'btn ghost sm', onclick: function () { state.view = 'c_dash'; render(); } }, ['رجوع'])]);
      var tb = h('table', {}, [th(['التاريخ', 'الحالة', 'نطاق معلن', 'تقدير النطاق', 'المُدخِل', '']), h('tbody', {}, snaps.map(function (s) {
        var c = s.computed, cc = [];
        if (c && c.unavailable) cc.push(h('span', { class: 'tiny' }, ['غير متاح: ' + c.unavailable]), c.label_ar ? unc() : null);
        else if (c) { cc.push(est('تقدير: ' + (c.band_ar || 'لا تصنيف') + ' · ' + c.pct + '%')); if (c.caveats && c.caveats.length) cc.push(h('div', { class: 'tiny' }, ['عدّ بالرؤوس؛ أوزان الأجور معطّلة لعدم تأكيدها'])); }
        var vb = s.verified ? pill('متحقَّق ' + (s.verified_on || ''), 'ok') : h('button', { class: 'btn sm', onclick: function () { act('establishment-compliance-verify', { snapshot_id: s.id }, 'تُحقِّق من اللقطة'); } }, ['تحقق (مستخدم آخر)']);
        return h('tr', {}, [h('td', {}, [s.as_of]), h('td', {}, [pill(STATE_AR[s.restriction_state] || s.restriction_state, STATE_CLS[s.restriction_state] || ''), s.restriction_reason ? h('div', { class: 'tiny' }, [s.restriction_reason]) : null]),
          h('td', {}, [(s.declared_band_ar || '—') + (s.declared_saudization_pct !== null ? ' · ' + s.declared_saudization_pct + '%' : '')]), h('td', {}, [h('div', {}, cc)]), h('td', {}, [s.entered_by_name || '—']), h('td', {}, [vb])]);
      }))]);
      var f = { st: h('select', { class: 'inp' }, ['unknown', 'clear', 'restricted', 'suspected'].map(function (k) { return opt(k, STATE_AR[k]); })), reason: h('input', { class: 'inp', placeholder: 'السبب (يلزم للمقيّدة والاشتباه)', style: 'min-width:220px' }), asof: h('input', { class: 'inp', type: 'date' }),
        act: h('select', { class: 'inp' }, [opt('', 'نشاط نطاقات (اختياري)')].concat((rf.activities || []).map(function (a) { return opt(a.rule_id, a.rule_id + ' ' + (a.activity_ar || '') + (a.usable ? '' : ' (غير مؤكد)')); }))),
        sa: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'سعوديون', style: 'width:100px' }), non: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'غير سعوديين', style: 'width:110px' }),
        band: h('select', { class: 'inp' }, [opt('', 'النطاق المعلن')].concat((rf.band_keys || []).map(function (b) { return opt(b.key, b.label_ar || b.key); }))), pct: h('input', { class: 'inp', type: 'number', step: '0.01', placeholder: 'نسبة معلنة %', style: 'width:120px' }),
        src: h('input', { class: 'inp', placeholder: 'من أين أُخذت الحالة (إدخال بشري)', style: 'min-width:220px' }) };
      var rec = h('div', { class: 'shr-card' }, [h('h2', {}, ['لقطة جديدة (إدخال بشري من منصة الجهة)']), h('div', { class: 'frm' }, [f.st, f.reason, f.asof, f.act, f.sa, f.non, f.band, f.pct, f.src,
        h('button', { class: 'btn', onclick: function () {
          var d = { establishment_id: state.eid, restriction_state: f.st.value, restriction_reason: f.reason.value, as_of: f.asof.value || undefined, activity_rule_id: f.act.value || undefined, declared_band: f.band.value || undefined, source_note: f.src.value };
          if (f.sa.value !== '') d.saudi_count = Number(f.sa.value); if (f.non.value !== '') d.non_saudi_count = Number(f.non.value); if (f.pct.value !== '') d.declared_saudization_pct = Number(f.pct.value);
          act('establishment-compliance-record', d, 'سُجّلت اللقطة — تحتاج تحققاً من مستخدم آخر');
        } }, ['تسجيل'])]), h('p', { class: 'tiny' }, ['التقدير يُحسب في الخادم من المرجع، ولا يُدخَل يدوياً. من أدخل اللقطة لا يتحقق منها.'])]);
      var ck = h('div', { class: 'shr-card' }, [h('h2', {}, ['الفحوص']), h('button', { class: 'btn sm', onclick: function () { act('compliance-run-checks', { establishment_id: state.eid }, 'شُغّلت الفحوص'); } }, ['تشغيل الفحوص']),
        (o.checks || []).length ? h('table', {}, [th(['الفحص', 'النتيجة', 'تفصيل']), h('tbody', {}, o.checks.map(function (c) { return h('tr', {}, [h('td', {}, [c.check_key]), h('td', {}, [pill(c.result, c.result === 'pass' ? 'ok' : c.result === 'fail' ? 'bad' : 'warn')]), h('td', { class: 'tiny' }, [JSON.stringify(c.detail)])]); }))]) : h('p', { class: 'note' }, ['لم تُشغَّل فحوص بعد.'])]);
      cframe('منشأة — الامتثال', h('div', {}, [head, h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['اللقطات التاريخية']), tb]), rec, ck]));
    });
  }

  // ---------------------------------------------------------------- المخالفات ----
  function vViol() {
    return Promise.all([call('compliance-violations', state.vFilter ? { status: state.vFilter } : null, true), ref(), estOpts()]).then(function (res) {
      var o = res[0], rf = res[1].reference, ests = res[2], rows = o.violations || [], sts = o.statuses || [];
      var keys = sts.map(function (s) { return s.key; });
      var f = h('select', { class: 'inp', onchange: function () { state.vFilter = f.value; render(); } }, [opt('', 'كل الحالات')].concat(sts.map(function (s) { return opt(s.key, s.label_ar, s.key === state.vFilter); })));
      var rs = h('select', { class: 'inp' }, (rf.violation_rules || []).map(function (r) { return opt(r.rule_id, r.rule_id + ' — ' + r.name_ar + (r.usable ? '' : ' (غير مؤكد من المصدر)')); }));
      var tier = h('select', { class: 'inp' }, []);
      function fillTier() { tier.innerHTML = ''; var r = (rf.violation_rules || []).filter(function (x) { return x.rule_id === rs.value; })[0]; tier.appendChild(opt('', 'الشريحة (يحددها الإنسان)')); ((r && r.tiers) || []).forEach(function (t) { tier.appendChild(opt(t, t)); }); }
      rs.addEventListener('change', fillTier); fillTier();
      var n = { est: h('select', { class: 'inp' }, ests.map(function (e) { return opt(e.id, e.name_ar); })), auth: h('input', { class: 'inp', placeholder: 'الجهة المصدِرة' }), no: h('input', { class: 'inp', placeholder: 'رقم المخالفة' }), cnt: h('input', { class: 'inp', type: 'number', min: '1', value: '1', style: 'width:90px', title: 'عدد الأشخاص/الحالات' }),
        nd: h('input', { class: 'inp', type: 'date', title: 'تاريخ التبليغ من الإشعار الرسمي' }) };
      var add = h('div', { class: 'shr-card' }, [h('h2', {}, ['تسجيل مخالفة']), h('div', { class: 'frm' }, [n.est, n.auth, n.no, rs, tier, n.cnt, n.nd,
        h('button', { class: 'btn', onclick: function () { act('violation-create', { establishment_id: n.est.value, authority: n.auth.value, ref_no: n.no.value, rule_id: rs.value, size_tier: tier.value || undefined, persons_count: Number(n.cnt.value), notification_date: n.nd.value || undefined }, 'سُجّلت المخالفة — تحتاج مراجعة من مستخدم آخر'); } }, ['تسجيل'])]),
        h('p', { class: 'tiny' }, ['المبلغ والمواعيد تُحسب في الخادم من بنود المرجع. لا موعد اعتراض بلا تاريخ تبليغ يُدخله إنسان من الإشعار الرسمي. الاعتراض والسداد مساران متوازيان: الاعتراض لا يوقف الغرامة، وقرار السداد للعميل.'])]);
      var wins = (rf.windows || []).map(function (w) { return h('li', { class: 'tiny' }, [w.name_ar + (w.days !== null ? ' — ' + w.days + ' يوماً ' + (w.anchor_ar || '') : '') + (w.usable ? '' : ' (غير مؤكد من المصدر)') + (w.warning_ar ? ' — ' + w.warning_ar : '')]); });
      var tb = h('table', {}, [th(['البند / المنشأة', 'العدد', 'غرامة تقديرية', 'التبليغ', 'مواعيد تقديرية', 'الحالة', 'السداد', '']), h('tbody', {}, rows.map(function (v) {
        var rule = v.rule || {}, fe = v.fine_estimate || {};
        var fineCell = fe.estimate ? [h('div', { class: 'kv' }, [Number(fe.amount_sar).toLocaleString('en-US') + ' ر.س', est()]), h('div', { class: 'tiny' }, [fe.count + ' × ' + Number(fe.unit_sar).toLocaleString('en-US') + ' (' + fe.tier + ')']), src(fe)] : [h('span', { class: 'tiny' }, ['غير متاح: ' + (fe.unavailable || '—')]), fe.label_ar ? unc() : null];
        var nd = v.notification_date ? [v.notification_date] : [h('span', { class: 'tiny' }, ['لم يُدخل'])];
        var ni = h('input', { class: 'inp sm', type: 'date', title: 'تاريخ التبليغ من الإشعار الرسمي' });
        nd.push(h('div', { class: 'kv' }, [ni, h('button', { class: 'btn ghost sm', onclick: function () { if (!ni.value) { flash(false, 'أدخل تاريخ التبليغ أولاً'); return render(); } act('violation-notify', { id: v.id, notification_date: ni.value }, 'سُجّل تاريخ التبليغ'); } }, [v.notification_date ? 'تصحيح' : 'إدخال'])]));
        var win = function (name, w) { return w && w.deadline ? h('div', {}, [h('div', { class: 'kv' }, [name + ': ' + w.deadline, est()]), src(w)]) : h('div', { class: 'tiny' }, [name + ': ' + (w && w.unavailable === 'notification_date_required' ? 'يلزم تاريخ التبليغ' : 'غير متاح' + (w && w.label_ar ? ' — ' + w.label_ar : ''))]); };
        var i = keys.indexOf(v.status), nxt = [];
        if (i > 0) nxt.push(keys[i - 1]); if (i >= 0 && i < keys.length - 1) nxt.push(keys[i + 1]);
        var sel = h('select', { class: 'inp sm' }, nxt.map(function (k) { var s = sts.filter(function (x) { return x.key === k; })[0]; return opt(k, s.label_ar + (s.human_task ? ' (مهمة بشرية)' : '')); }));
        var stc = [h('div', { class: 'kv' }, [pill(v.status_label_ar || v.status, 'ok'), v.reviewed_by ? pill('روجعت', 'ok') : pill('بانتظار مراجعة', 'warn')]), v.human_task ? h('div', { class: 'tiny' }, ['التقديم عبر بوابة الجهة بهوية العميل: مهمة بشرية لا آلية.']) : null];
        if (nxt.length) stc.push(h('div', { class: 'kv' }, [sel, h('button', { class: 'btn ghost sm', onclick: function () { act('violation-status', { id: v.id, status: sel.value }, 'تغيّرت الحالة'); } }, ['نقل'])]));
        var pd = h('select', { class: 'inp sm', onchange: function () { act('violation-paid', { id: v.id, paid_state: pd.value }, 'حُدّث السداد'); } }, Object.keys(PAID_AR).map(function (k) { return opt(k, PAID_AR[k], k === v.paid_state); }));
        var rv = v.reviewed_by ? '—' : h('button', { class: 'btn sm', onclick: function () { act('violation-review', { id: v.id }, 'راجعتَ المخالفة'); } }, ['مراجعة (مستخدم آخر)']);
        return h('tr', { class: rule.usable ? '' : 'row-unc' }, [h('td', {}, [h('div', {}, [v.rule_id + ' — ' + v.kind_ar]), h('div', { class: 'tiny' }, [(v.establishment || '') + ' · ' + v.authority + (v.ref_no ? ' · ' + v.ref_no : '')]), rule.usable ? null : unc()]),
          h('td', {}, [String(v.persons_count)]), h('td', {}, fineCell), h('td', {}, nd), h('td', {}, [win('اعتراض', v.objection), win('تسوية', v.settlement), win('سداد', v.payment)]), h('td', {}, stc), h('td', {}, [pd]), h('td', {}, [rv])]);
      }))]);
      cframe('سجل المخالفات', h('div', {}, [add, h('div', { class: 'shr-card' }, [h('div', { class: 'frm' }, [f]), h('ul', {}, wins), h('p', { class: 'tiny' }, ['مدة التسوية تختلف عن مدة الاعتراض ولا يُوحَّدان. لا يُعرض تخفيض كحق: التسوية بشروط وتخضع لدراسة الجهة.'])]), h('div', { class: 'shr-card scroll' }, [rows.length ? tb : h('p', { class: 'note' }, ['لا مخالفات.'])])]));
    });
  }

  // ------------------------------------------------------------- قوائم التحقق ----
  function vCheck() {
    var kind = state.ckKind || 'establishment';
    var subj = kind === 'establishment' ? estOpts().then(function (a) { return a.map(function (e) { return [e.id, e.name_ar]; }); })
      : kind === 'worker' ? call('workers', null, true).then(function (o) { return (o.workers || []).filter(function (w) { return w.status !== 'archived'; }).map(function (w) { return [w.id, w.full_name]; }); })
        : call('compliance-violations', null, true).then(function (o) { return (o.violations || []).map(function (v) { return [v.id, v.rule_id + ' — ' + (v.establishment || '')]; }); });
    return subj.then(function (list) {
      var sid = state.ckSubject && list.some(function (x) { return x[0] === state.ckSubject; }) ? state.ckSubject : (list[0] ? list[0][0] : '');
      return call('compliance-checklists', sid ? { subject_kind: kind, subject_id: sid } : { subject_kind: kind }, true).then(function (o) {
        var k = h('select', { class: 'inp', onchange: function () { state.ckKind = k.value; state.ckSubject = ''; render(); } }, [['establishment', 'منشأة'], ['worker', 'عامل'], ['violation', 'مخالفة']].map(function (x) { return opt(x[0], x[1], x[0] === kind); }));
        var s = h('select', { class: 'inp', onchange: function () { state.ckSubject = s.value; render(); } }, list.map(function (x) { return opt(x[0], x[1], x[0] === sid); }));
        var cards = (o.checklists || []).map(function (c) {
          return h('div', { class: 'shr-card' }, [h('h2', {}, [c.title_ar]), h('div', { class: 'kv' }, [pill('الجمهور: ' + c.audience, ''), c.complete === null ? null : pill(c.complete ? 'مكتملة' : 'متبقٍ ' + c.required_remaining, c.complete ? 'ok' : 'warn')]),
            h('div', {}, c.items.map(function (it) {
              var cb = h('input', { type: 'checkbox' }); cb.checked = !!it.done; cb.disabled = !it.active || !sid;
              cb.addEventListener('change', function () { act('checklist-tick', { item_id: it.id, subject_kind: kind, subject_id: sid, done: cb.checked }, 'سُجّل البند'); });
              return h('div', { class: 'chk' + (it.active ? '' : ' off') }, [cb, h('div', {}, [h('div', {}, [it.text_ar]), h('div', { class: 'kv' }, [it.rule_id ? pill(it.rule_id, '') : null, it.active ? null : unc(), it.active ? null : h('span', { class: 'tiny' }, ['معطَّل: لا يُحتسب ولا يُنقر حتى يُؤكَّد المصدر'])])])]);
            }))]);
        });
        cframe('قوائم التحقق', h('div', {}, [h('div', { class: 'shr-card' }, [h('div', { class: 'frm' }, [k, s])]), cards.length ? h('div', {}, cards) : h('p', { class: 'note' }, ['لا قوائم لهذا النوع.'])]));
      });
    });
  }

  // ----------------------------------------------------------------- التنبيهات ----
  function vAlerts() {
    return call('compliance-alerts', null, true).then(function (o) {
      var rows = o.alerts || [], st = o.settings || {};
      var tb = h('table', {}, [th(['الخطورة', 'التنبيه', 'الموضوع', 'الموعد', 'المتبقي', 'ملاحظة']), h('tbody', {}, rows.map(function (a) {
        var sv = SEV[a.severity] || [a.severity, ''], sj = a.subject || {};
        var extra = [];
        if (a.estimated) extra.push(est(a.label_ar || 'تقديري'));
        if (a.kind === 'objection_deadline_near' || a.kind === 'objection_deadline_passed') extra.push(h('span', { class: 'tiny' }, [a.reviewed ? 'روجعت' : 'غير مراجَعة']));
        if (a.kind === 'establishment_blocked') extra.push(h('span', { class: 'tiny' }, [(STATE_AR[a.state] || a.state) + (a.reason ? ': ' + a.reason : '')]));
        if (a.pending) extra.push(h('span', { class: 'tiny' }, [String(a.pending) + ' اسماً بلا اعتماد']));
        if (a.doc_kind) extra.push(h('span', { class: 'tiny' }, [DOCK[a.doc_kind] || a.doc_kind]));
        return h('tr', {}, [h('td', {}, [pill(sv[0], sv[1])]), h('td', {}, [AL[a.kind] || a.kind]), h('td', {}, [(sj.name || '—') + (sj.establishment ? ' · ' + sj.establishment : '')]), h('td', {}, [a.due || '—']),
          h('td', {}, [a.days_left === undefined ? '—' : (a.days_left < 0 ? 'مضى ' + (-a.days_left) : a.days_left) + ' يوماً']), h('td', {}, [h('div', { class: 'kv' }, extra)])]);
      }))]);
      cframe('التنبيهات', h('div', {}, [h('div', { class: 'shr-card scroll' }, [rows.length ? tb : h('p', { class: 'note' }, ['لا تنبيهات.']),
        h('p', { class: 'tiny' }, ['عتبة المستندات ' + st.expiry_alert_days + ' يوماً، وعتبة المواعيد التقديرية ' + st.deadline_alert_days + ' يوماً (إعدادات تشغيلية للمستأجر). التنبيهات داخلية للمشغّل: لا رسالة تُرسل لأحد، ولا تنبيه بموعد دون تاريخ تبليغ مُدخَل.'])])]));
    });
  }

  // ------------------------------------------------------------ استيراد الملفات ----
  function parseRows(text) {
    var lines = String(text || '').split(/\r?\n/), out = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var c = lines[i].split(/[,\t;،]/).map(function (x) { return x.trim(); });
      if (out.length === 0 && /^(id|رقم|الهوية)/i.test(c[0])) continue;
      out.push({ line: i + 1, id_no: c[0] || '', period: c[1] || '', status: c[2] || '' });
    }
    return out;
  }
  function vImport() {
    return Promise.all([call('compliance-imports', null, true), state.bid ? call('compliance-import', { id: state.bid }, true) : Promise.resolve(null)]).then(function (res) {
      var o = res[0], det = res[1], rows = o.batches || [];
      var kd = h('select', { class: 'inp' }, (o.kinds || []).map(function (k) { return opt(k, KIND_AR[k] || k); }));
      var lb = h('input', { class: 'inp', placeholder: 'اسم الدفعة (وهمي)' });
      var ta = h('textarea', { class: 'inp', placeholder: 'رقم هوية وهمي,YYYY-MM,الحالة\nDEMO-SHR-1,2026-10,registered\n(تأمينات: registered | not_registered ؛ حماية أجور: paid | not_paid)' });
      var fl = h('input', { type: 'file', accept: '.csv,.txt,text/csv', onchange: function () { var f = fl.files && fl.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { ta.value = String(rd.result || ''); }; rd.readAsText(f); } });
      var rpt = h('div', {});
      var go = h('button', { class: 'btn', onclick: function () {
        call('import-create', { kind: kd.value, label: lb.value, rows: parseRows(ta.value) }).then(function (r) {
          rpt.innerHTML = '';
          if (!r.ok) { rpt.appendChild(h('p', { class: 'err' }, [errText(r)])); return; }
          flash(true, 'رُفعت الدفعة: ' + r.batch.rows + ' صفاً — بصمات فقط');
          if (r.errors && r.errors.length) state.lastErrors = r.errors; else state.lastErrors = null;
          render();
        });
      } }, ['رفع']);
      var errs = state.lastErrors ? h('div', { class: 'rpt' }, [h('p', { class: 'err' }, ['صفوف مرفوضة (لا توقف الباقي):']), h('table', {}, [th(['السطر', 'السبب']), h('tbody', {}, state.lastErrors.map(function (e) { return h('tr', {}, [h('td', {}, [String(e.line)]), h('td', {}, [errText({ error: e.error }) + (e.field ? ' (' + e.field + ')' : '')])]); }))])]) : null;
      var up = h('div', { class: 'shr-card' }, [h('h2', {}, ['رفع دفعة (تأمينات أو حماية أجور)']), h('div', { class: 'frm' }, [kd, lb, fl]), h('div', { style: 'margin:10px 0' }, [ta]), go, rpt, errs,
        h('p', { class: 'tiny' }, ['الصفوف مُبصَّمة: رقم الهوية يُحوَّل إلى بصمة في الخادم ولا يُخزَّن ولا يُعاد، ولا أعمدة للاسم أو الهاتف أو البريد (تُرفض). المسار: مرفوع ← مطابَق ← روجع ← مطبَّق، ومن رفع لا يراجع ولا يطبّق. الحد الأقصى ' + o.max_rows + ' صفاً.'])]);
      var tb = h('table', {}, [th(['الدفعة', 'النوع', 'الحالة', 'صفوف', 'مطابقة', '']), h('tbody', {}, rows.map(function (b) {
        var nx = INEXT[b.state];
        var btns = [h('button', { class: 'btn ghost sm', onclick: function () { state.bid = state.bid === b.id ? '' : b.id; render(); } }, ['الصفوف'])];
        if (nx) btns.push(h('button', { class: 'btn sm', onclick: function () { act(nx[0], { id: b.id }, 'تمّ: ' + nx[1]); } }, [nx[1]]));
        return h('tr', {}, [h('td', {}, [b.label || '—']), h('td', {}, [KIND_AR[b.kind] || b.kind]), h('td', {}, [pill(ISTATE[b.state] || b.state, b.state === 'applied' ? 'ok' : 'warn')]), h('td', {}, [String(b.row_count)]), h('td', {}, [String(b.matched_count)]), h('td', {}, [h('div', { class: 'kv' }, btns)])]);
      }))]);
      var dt = det && det.ok ? h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['صفوف الدفعة (بلا بصمات)']), h('table', {}, [th(['السطر', 'الفترة', 'الحالة', 'المطابقة', 'العامل', 'مطبَّق']), h('tbody', {}, det.rows.map(function (r) { return h('tr', {}, [h('td', {}, [String(r.line)]), h('td', {}, [r.period]), h('td', {}, [r.status]), h('td', {}, [pill(r.match_state === 'matched' ? 'مطابق' : 'غير مطابق', r.match_state === 'matched' ? 'ok' : 'mut')]), h('td', {}, [r.worker || '—']), h('td', {}, [r.applied ? 'نعم' : '—'])]); }))])]) : null;
      cframe('استيراد الملفات', h('div', {}, [up, h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['الدفعات']), rows.length ? tb : h('p', { class: 'note' }, ['لا دفعات.'])]), dt]));
    });
  }

  // ------------------------------------------------------------ تصنيف أسماء A33 ----
  function vA33() {
    return Promise.all([call('compliance-a33', null, true), estOpts()]).then(function (res) {
      var o = res[0], ests = res[1], names = o.names || [], lists = o.lists || [];
      var ls = h('table', {}, [th(['القائمة', 'المنشأة', 'الأسماء', 'مصنَّفة', 'معتمدة', 'الاكتمال']), h('tbody', {}, lists.map(function (l) { return h('tr', {}, [h('td', {}, [l.list_ref]), h('td', {}, [l.establishment || '—']), h('td', {}, [String(l.total)]), h('td', {}, [String(l.classified)]), h('td', {}, [String(l.approved)]), h('td', {}, [pill(l.complete ? 'مكتملة' : 'غير مكتملة', l.complete ? 'ok' : 'warn')])]); }))]);
      var nt = h('table', {}, [th(['الاسم (وهمي)', 'القائمة', 'عامل مرتبط', 'التصنيف', '']), h('tbody', {}, names.map(function (n) {
        var sel = h('select', { class: 'inp sm' }, [opt('', 'صنّف…')].concat(o.classes.map(function (c) { return opt(c, CLS_AR[c] || c, c === n.classification); })));
        var acts = [];
        if (!n.approved) {
          acts.push(sel, h('button', { class: 'btn ghost sm', onclick: function () { if (!sel.value) { flash(false, 'اختر تصنيفاً'); return render(); } act('a33-classify', { id: n.id, classification: sel.value }, 'صُنّف الاسم'); } }, ['حفظ']));
          if (n.classification) acts.push(h('button', { class: 'btn sm', onclick: function () { act('a33-approve', { id: n.id }, 'اعتُمد التصنيف'); } }, ['اعتماد (مراجع ثانٍ)']));
        } else acts.push(pill('معتمد', 'ok'));
        return h('tr', {}, [h('td', {}, [n.alias]), h('td', {}, [n.list_ref]), h('td', {}, [n.worker_linked ? pill('مرتبط', 'warn') : '—']), h('td', {}, [n.classification ? pill(CLS_AR[n.classification] || n.classification, '') : pill('غير مصنَّف', 'mut')]), h('td', {}, [h('div', { class: 'kv' }, acts)])]);
      }))]);
      var f = { est: h('select', { class: 'inp' }, ests.map(function (e) { return opt(e.id, e.name_ar); })), ref: h('input', { class: 'inp', placeholder: 'مرجع القائمة' }), al: h('input', { class: 'inp', placeholder: 'اسم وهمي ينتهي بـ(وهمي)' }), no: h('input', { class: 'inp', placeholder: 'رقم هوية وهمي (بصمة فقط)' }) };
      var add = h('div', { class: 'shr-card' }, [h('h2', {}, ['إضافة اسم إلى قائمة']), h('div', { class: 'frm' }, [f.est, f.ref, f.al, f.no, h('button', { class: 'btn', onclick: function () { act('a33-add', { establishment_id: f.est.value, list_ref: f.ref.value, alias: f.al.value, id_no: f.no.value }, 'أُضيف الاسم'); } }, ['إضافة'])]),
        h('p', { class: 'tiny' }, ['م33: تسجيل عامل سعودي ضمن عمال المنشأة دون علاقة عمل فعلية (لا وافد). لا أسماء حقيقية في هذه المرحلة، والهوية بصمة فقط. المصنِّف لا يعتمد، ويُحجب تفعيل العامل المرتبط بالقائمة حتى يُصنَّف كل اسم ويعتمد مراجع ثانٍ.'])]);
      cframe('تصنيف أسماء A33', h('div', {}, [add, h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['القوائم']), lists.length ? ls : h('p', { class: 'note' }, ['لا قوائم.'])]), h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['الأسماء']), names.length ? nt : h('p', { class: 'note' }, ['لا أسماء.'])])]));
    });
  }

  return { c_dash: vDash, c_est: vEst, c_viol: vViol, c_check: vCheck, c_alerts: vAlerts, c_import: vImport, c_a33: vA33 };
}
