// SHR-HR — بوابة العميل: اللوحة · العمال (مع تفصيل) · العقود · الطلبات ونموذج طلب جديد · الفواتير.
//
// الدالة تعمل في المتصفح: تُحقن في صفحة /SHR-HR بـ toString()، فلا تلمس شيئاً خارج جسمها
// (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ${ داخلها). تتلقى أدوات الصفحة في env.
// ES5 عمداً ليطابق بقية الصفحة. تتكلم مع إجراءات client-* وحدها.
// بيانات تجريبية فقط: وسم «بيانات تجريبية» ثابت أعلى كل شاشة من قشرة الصفحة.
// لا شعار «سحر الإمداد» ولا ادعاء ترخيص أو امتثال. لا سعر ولا هامش في أي شاشة.

export const CLIENT_CSS = `
.shr textarea.cl-note{width:100%;min-height:90px;box-sizing:border-box;font:inherit}
.shr .cl-docs{display:flex;gap:6px;flex-wrap:wrap}
`;

export const CLIENT_ERR = {
  client_not_linked: 'المستخدم غير مربوط بشركة عميل — لا دخول',
  client_not_active: 'حساب الشركة غير نشط — لا دخول',
  read_only_role: 'هذا الحساب للقراءة فقط — لا يقدّم طلبات',
  client_company_id_forbidden: 'لا يُقبل تحديد الشركة من الطلب',
  bad_kind: 'نوع الطلب غير صالح',
  note_required: 'اكتب وصف الطلب (٣ أحرف على الأقل)',
  bad_quantity: 'العدد بين 1 و200',
  worker_required: 'اختر العامل المعنيّ بهذا الطلب',
  too_many_open_requests: 'بلغت الحد الأقصى للطلبات المفتوحة — انتظر معالجة بعضها',
  rate_limited: 'طلبات كثيرة في وقت قصير — حاول لاحقاً'
};

export function shrClientPortalClient(env) {
  var h = env.h, call = env.call, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render, layout = env.layout, empty = env.empty, loading = env.loading;
  var NAV = [['cl_home', 'اللوحة'], ['cl_workers', 'عمالي'], ['cl_contracts', 'عقودي'], ['cl_requests', 'طلباتي'], ['cl_invoices', 'الفواتير']];
  var DOCN = { work_contract: 'عقد العمل', iqama: 'الإقامة', passport: 'جواز السفر', medical_insurance: 'التأمين الطبي' };
  var DST = { valid: ['سارية', 'ok'], expiring: ['قريبة الانتهاء', 'warn'], expired: ['منتهية', 'bad'], no_expiry: ['سارٍ — بلا تاريخ انتهاء', 'ok'], missing: ['غير مرفوعة', 'mut'] };
  var WST = { active: ['نشط', 'ok'], pending_docs: ['بانتظار المستندات', 'warn'] };
  var ATT = { ok: ['المستندات سليمة', 'ok'], expiring: ['مستند قريب الانتهاء', 'warn'], expired: ['مستند منتهٍ', 'bad'], missing: ['مستند غير مرفوع', 'mut'] };
  var RKIND = { new_hire: 'توظيف جديد', termination: 'إنهاء', transfer: 'نقل', document: 'مستند', other: 'أخرى' };
  var RST = { new: ['جديد', ''], in_review: ['قيد المراجعة', 'warn'], waiting_client: ['بانتظار ردّك', 'warn'], in_progress: ['قيد التنفيذ', ''], done: ['مكتمل', 'ok'], rejected: ['مرفوض', 'mut'] };
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  var day = function (s) { return s ? String(s).slice(0, 10) : '—'; };

  // الصفحات بلا كلمات مشغّل أو امتثال: هذا المنظور يرى بيانات شركته فقط.
  var GROUPS = [{ t: 'بوابة العميل', i: NAV }];
  var DESC = {
    cl_home: 'ملخص سريع لعمالكم وعقودكم وطلباتكم ومستنداتكم.',
    cl_workers: 'العمال المُسندون إليكم وحالة مستندات كل منهم.',
    cl_worker: 'بيانات العامل ومستنداته وقوائمه، للاطلاع فقط.',
    cl_contracts: 'عقودكم السارية: الفترة والنسخة وعدد العمال.',
    cl_requests: 'أرسل طلباً جديداً وتابع حالة طلباتكم السابقة.',
    cl_invoices: 'فواتيركم تظهر هنا عند إصدارها.'
  };
  function activeNav() { return state.view === 'cl_worker' ? 'cl_workers' : (DESC[state.view] ? state.view : 'cl_home'); }
  function titleNow() { var a = activeNav(), t = ''; NAV.forEach(function (n) { if (n[0] === a) t = n[1]; }); return t; }
  function cframe(title, content) {
    var a = activeNav(), lab = titleNow();
    layout({
      groups: GROUPS, active: a, title: title, sub: DESC[DESC[state.view] ? state.view : 'cl_home'],
      crumbs: ['بوابة العميل', lab].concat(state.view === 'cl_worker' ? [title] : []),
      chip: 'منظور العميل' + (state.me && state.me.can_request ? '' : ' — قراءة فقط'), chipClass: 'cl',
      who: [(state.me && state.me.client ? state.me.client.name_ar : ''), (state.me && state.me.user ? state.me.user.name || '' : '')], content: content
    });
  }
  function guard(o) { if (!o || !o.ok) throw new Error((o && o.error) || 'x'); return o; }

  function vHome() {
    return call('client-home', null, true).then(function (o) {
      guard(o);
      var c = o.counts || {};
      var K = [['workers', 'عمال مُسندون إليكم', ''], ['contracts_active', 'عقود سارية', ''], ['open_requests', 'طلبات مفتوحة', c.open_requests ? 'hot' : ''],
        ['docs_expiring', 'مستندات قريبة الانتهاء (' + o.expiry_alert_days + ' يوماً)', c.docs_expiring ? 'hot' : ''], ['docs_expired', 'مستندات منتهية', c.docs_expired ? 'hot' : '']];
      cframe('اللوحة', h('div', {}, [
        h('div', { class: 'shr-kpis' }, K.map(function (k) { return h('div', { class: 'shr-kpi ' + k[2] }, [h('b', {}, [String(c[k[0]] || 0)]), h('span', {}, [k[1]])]); })),
        h('p', { class: 'note' }, ['تُعرض هنا بياناتكم أنتم فقط. لا أرقام تُعرض إلا من بيانات مسجّلة فعلاً.'])]));
    });
  }

  function vWorkers() {
    return call('client-workers', null, true).then(function (o) {
      guard(o);
      var rows = o.workers || [];
      var tb = h('table', {}, [th(['الاسم', 'المهنة', 'الجنسية', 'الحالة', 'المستندات', '']), h('tbody', {}, rows.map(function (w) {
        var st = WST[w.status] || [w.status, ''], at = ATT[w.attention] || [w.attention, ''];
        return h('tr', {}, [h('td', {}, [w.full_name]), h('td', {}, [w.profession || '—']), h('td', {}, [w.nationality || '—']), h('td', {}, [pill(st[0], st[1])]), h('td', {}, [pill(at[0], at[1])]),
          h('td', {}, [h('button', { class: 'btn ghost', onclick: function () { state.cworker = w.id; state.view = 'cl_worker'; state.msg = ''; state.err = ''; render(); } }, ['التفاصيل'])])]);
      }))]);
      cframe('عمالي', h('div', { class: 'shr-card scroll' }, [rows.length ? tb : empty('لا عمال مُسندون إليكم حالياً', 'ستظهر هنا أسماء العمال بعد إسنادهم وتفعيلهم.')]));
    });
  }

  function vWorker() {
    return call('client-worker', { id: state.cworker }, true).then(function (o) {
      if (!o.ok) { state.view = 'cl_workers'; flash(false, errText(o)); return render(); }
      var w = o.worker, st = WST[w.status] || [w.status, ''];
      var docs = h('table', {}, [th(['المستند', 'الحالة', 'ينتهي', 'المتبقي']), h('tbody', {}, (w.docs || []).map(function (d) {
        var s = DST[d.status] || [d.status, ''];
        return h('tr', {}, [h('td', {}, [DOCN[d.kind] || d.kind]), h('td', {}, [pill(s[0], s[1])]), h('td', {}, [day(d.expires_on)]), h('td', {}, [d.days_left == null ? '—' : (d.days_left < 0 ? 'منذ ' + (-d.days_left) + ' يوماً' : d.days_left + ' يوماً')])]);
      }))]);
      var lists = (o.checklists || []).map(function (c) {
        return h('div', { class: 'shr-card' }, [h('h2', {}, [c.title_ar]), h('ul', {}, c.items.map(function (i) { return h('li', {}, [(i.done ? '✔ ' : '☐ '), i.text_ar]); })),
          h('p', { class: 'note' }, [c.complete ? 'اكتملت البنود المطلوبة.' : 'بنود مطلوبة لم تكتمل بعد.'])]);
      });
      cframe(w.full_name, h('div', {}, [
        h('button', { class: 'btn ghost', onclick: function () { state.view = 'cl_workers'; render(); } }, ['رجوع']),
        h('div', { class: 'shr-card' }, [h('h2', {}, ['البيانات']), h('p', {}, [(w.profession || '—') + ' · ' + (w.nationality || '—') + ' · ']), pill(st[0], st[1]),
          h('p', { class: 'note' }, ['الإسناد: ', (w.assignment && w.assignment.starts_on ? 'من ' + day(w.assignment.starts_on) + (w.assignment.ends_on ? ' إلى ' + day(w.assignment.ends_on) : '') : '—')])]),
        h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['المستندات']), docs])].concat(lists)));
    });
  }

  function vContracts() {
    return call('client-contracts', null, true).then(function (o) {
      guard(o);
      var rows = o.contracts || [];
      var tb = h('table', {}, [th(['النسخة', 'من', 'إلى', 'المتبقي', 'العمال', 'الحالة']), h('tbody', {}, rows.map(function (k) {
        return h('tr', {}, [h('td', {}, ['v' + k.version]), h('td', {}, [day(k.starts_on)]), h('td', {}, [day(k.ends_on)]), h('td', {}, [k.days_left == null ? '—' : k.days_left < 0 ? 'منتهي المدة' : k.days_left + ' يوماً']), h('td', {}, [String(k.workers)]), h('td', {}, [pill('ساري', 'ok')])]);
      }))]);
      cframe('عقودي', h('div', { class: 'shr-card scroll' }, [rows.length ? tb : empty('لا عقود سارية', 'تظهر هنا العقود المعتمدة السارية فقط.'), h('p', { class: 'note' }, ['ملخص العقد: الفترة والنسخة. المسودات وما قيد الاعتماد لا تظهر.'])]));
    });
  }

  function vRequests() {
    return Promise.all([call('client-requests', null, true), call('client-workers', null, true)]).then(function (res) {
      guard(res[0]);
      var rows = res[0].requests || [], ws = (res[1] && res[1].workers) || [], can = res[0].can_request;
      var form = null;
      if (can) {
        var kind = h('select', { class: 'inp' }, Object.keys(RKIND).map(function (k) { return h('option', { value: k }, [RKIND[k]]); }));
        var note = h('textarea', { class: 'inp cl-note', maxlength: '500', placeholder: 'وصف الطلب (حتى 500 حرف)' });
        var prof = h('input', { class: 'inp', placeholder: 'المهنة (لطلب توظيف)', maxlength: '80' });
        var qty = h('input', { class: 'inp', type: 'number', min: '1', max: '200', placeholder: 'العدد', style: 'width:100px' });
        var wk = h('select', { class: 'inp' }, [h('option', { value: '' }, ['العامل المعنيّ…'])].concat(ws.map(function (w) { return h('option', { value: w.id }, [w.full_name]); })));
        var sync = function () { var k = kind.value; prof.style.display = qty.style.display = k === 'new_hire' ? '' : 'none'; wk.style.display = (k === 'termination' || k === 'transfer' || k === 'document') ? '' : 'none'; };
        kind.addEventListener('change', sync); sync();
        form = h('div', { class: 'shr-card' }, [h('h2', {}, ['طلب جديد']), h('div', { class: 'frm' }, [kind, prof, qty, wk]), h('div', { style: 'margin:8px 0' }, [note]),
          h('button', { class: 'btn', onclick: function () {
            var d = { kind: kind.value, note: note.value };
            if (kind.value === 'new_hire') { d.profession = prof.value; if (qty.value !== '') d.quantity = Number(qty.value); }
            if (wk.value) d.worker_id = wk.value;
            call('client-request-create', d).then(function (r) { flash(r.ok, r.ok ? 'سُجّل الطلب — يراجعه فريق Business Partner' : errText(r)); render(); });
          } }, ['إرسال الطلب']),
          h('p', { class: 'note' }, ['حالة الطلب يغيّرها فريق التشغيل وحده. هذا نموذج تجريبي: لا يُرسل شيء إلى أحد خارج النظام.'])]);
      }
      var tb = h('table', {}, [th(['النوع', 'الوصف', 'العامل', 'التاريخ', 'الحالة']), h('tbody', {}, rows.map(function (r) {
        var st = RST[r.state] || [r.state, ''];
        return h('tr', {}, [h('td', {}, [RKIND[r.kind] || r.kind]), h('td', {}, [(r.note || '—'), r.quantity ? ' · العدد ' + r.quantity : null, r.profession ? ' · ' + r.profession : null]), h('td', {}, [r.worker_name || '—']), h('td', {}, [day(r.created_at)]), h('td', {}, [pill(st[0], st[1])])]);
      }))]);
      cframe('طلباتي', h('div', {}, [form || h('p', { class: 'note' }, ['هذا الحساب للقراءة فقط: لا يقدّم طلبات.']), h('div', { class: 'shr-card scroll' }, [rows.length ? tb : empty('لا طلبات بعد', 'تظهر هنا طلبات شركتكم عند إرسالها.')])]));
    });
  }

  function vInvoices() {
    return call('client-invoices', null, true).then(function (o) {
      guard(o);
      cframe('الفواتير', h('div', { class: 'shr-card' }, [empty('لا فواتير للعرض', o.note_ar || '')]));
    });
  }
  return { _paint: cframe, _title: titleNow, cl_home: vHome, cl_workers: vWorkers, cl_worker: vWorker, cl_contracts: vContracts, cl_requests: vRequests, cl_invoices: vInvoices };
}
