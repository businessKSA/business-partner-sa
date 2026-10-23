// SHR-HR — بوابة العامل: بياناتي · عقدي · مستنداتي · راتبي · طلباتي.
//
// الدالة تعمل في المتصفح: تُحقن في صفحة /SHR-HR بـ toString()، فلا تلمس شيئاً خارج جسمها
// (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ${ داخلها). تتلقى أدوات الصفحة في env.
// ES5 عمداً ليطابق بقية الصفحة. تتكلم مع إجراءات worker-* وحدها.
// بيانات تجريبية فقط: وسم «بيانات تجريبية» ثابت أعلى كل شاشة من قشرة الصفحة.
// لا شعار «سحر الإمداد» ولا ادعاء ترخيص أو امتثال. لا سعر ولا هامش ولا رقم راتب في أي شاشة:
// «راتبي» قسم فارغ صريح حتى تصدر فرق Business Partner الكشف بعد الاعتماد. لا رقم هوية ولا جوال ولا آيبان.

export const WORKER_CSS = `
.shr textarea.wk-note{width:100%;min-height:90px;box-sizing:border-box;font:inherit}
.shr table.wk-kv th{width:34%;white-space:normal}
.shr table.wk-kv td{overflow-wrap:anywhere}
`;

export const WORKER_ERR = {
  worker_not_linked: 'المستخدم غير مربوط بسجل عامل — لا دخول',
  worker_not_active: 'سجل العامل غير نشط — لا دخول',
  worker_id_forbidden: 'لا يُقبل تحديد العامل من الطلب',
  bad_topic: 'موضوع الطلب غير صالح'
};

export function shrWorkerPortalClient(env) {
  var h = env.h, call = env.call, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render, layout = env.layout, empty = env.empty;
  var NAV = [['wk_data', 'بياناتي'], ['wk_contract', 'عقدي'], ['wk_docs', 'مستنداتي'], ['wk_salary', 'راتبي'], ['wk_requests', 'طلباتي']];
  var DOCN = { work_contract: 'عقد العمل', iqama: 'الإقامة', medical_insurance: 'التأمين الطبي' };
  var DST = { valid: ['سارية', 'ok'], expiring: ['قريبة الانتهاء', 'warn'], expired: ['منتهية', 'bad'], no_expiry: ['سارٍ — بلا تاريخ انتهاء', 'ok'], missing: ['غير مرفوعة', 'mut'] };
  var ATT = { ok: ['المستندات سليمة', 'ok'], expiring: ['مستند قريب الانتهاء', 'warn'], expired: ['مستند منتهٍ', 'bad'], missing: ['مستند غير مرفوع', 'mut'] };
  var IDK = { iqama: 'إقامة', national_id: 'هوية وطنية', border_no: 'رقم حدود' };
  var WST = { active: ['نشط', 'ok'] };
  var RKIND = { worker_document: 'طلب مستند', worker_update: 'تحديث بيان', worker_inquiry: 'استفسار' };
  var RST = { new: ['جديد', ''], in_review: ['قيد المراجعة', 'warn'], waiting_client: ['بانتظار ردّك', 'warn'], in_progress: ['قيد التنفيذ', ''], done: ['مكتمل', 'ok'], rejected: ['مرفوض', 'mut'] };
  var TOPIC = { work_contract: 'عقد العمل', iqama: 'الإقامة', medical_insurance: 'التأمين الطبي', employment_letter: 'خطاب تعريف بالعمل', other: 'أخرى',
    personal_data: 'البيانات الشخصية', contact: 'بيانات التواصل', contract: 'العقد', documents: 'المستندات', pay_statement: 'كشف الراتب' };
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  var day = function (s) { return s ? String(s).slice(0, 10) : '—'; };
  var kv = function (rows) { return h('table', { class: 'wk-kv' }, [h('tbody', {}, rows.map(function (r) { return h('tr', {}, [h('th', { scope: 'row' }, [r[0]]), h('td', {}, [r[1]])]); }))]); };

  // الصفحات بلا كلمات مشغّل أو امتثال: هذا المنظور يرى بيانات العامل نفسه فقط.
  var GROUPS = [{ t: 'بوابة العامل', i: NAV }];
  var DESC = {
    wk_data: 'بياناتك الأساسية والعميل المسند إليه، للاطلاع فقط.',
    wk_contract: 'ملخص عقد عملك: النوع وتاريخ البدء.',
    wk_docs: 'إقامتك وتأمينك الطبي وعقد عملك: الحالة وتاريخ الانتهاء.',
    wk_salary: 'كشف راتبك يظهر هنا عند إصداره.',
    wk_requests: 'أرسل طلباً محدداً وتابع حالة طلباتك السابقة.'
  };
  function activeNav() { return DESC[state.view] ? state.view : 'wk_data'; }
  function titleNow() { var a = activeNav(), t = ''; NAV.forEach(function (n) { if (n[0] === a) t = n[1]; }); return t; }
  function wframe(title, content) {
    var a = activeNav(), lab = titleNow();
    layout({
      groups: GROUPS, active: a, title: title, sub: DESC[a],
      crumbs: ['بوابة العامل', lab], chip: 'منظور العامل', chipClass: 'cl',
      who: [(state.me && state.me.worker ? state.me.worker.full_name : ''), ''], content: content
    });
  }
  function guard(o) { if (!o || !o.ok) throw new Error((o && o.error) || 'x'); return o; }

  function vData() {
    return call('worker-profile', null, true).then(function (o) {
      guard(o);
      var w = o.worker || {}, a = o.assignment, st = WST[w.status] || [w.status, ''], at = ATT[o.attention] || [o.attention, ''];
      var kids = [];
      if (o.attention && o.attention !== 'ok') kids.push(h('div', { class: 'shr-card' }, [pill(at[0], at[1]), h('p', { class: 'note' }, ['راجع صفحة «مستنداتي» لمعرفة التفاصيل.'])]));
      kids.push(h('div', { class: 'shr-card' }, [h('h2', {}, ['البيانات']), kv([['الاسم', w.full_name], ['الجنسية', w.nationality || '—'], ['المهنة', w.profession || '—'], ['نوع الهوية', w.id_kind ? (IDK[w.id_kind] || w.id_kind) : '—'], ['الحالة', pill(st[0], st[1])]])]));
      kids.push(h('div', { class: 'shr-card' }, [h('h2', {}, ['العميل المستفيد']), a ? kv([['العميل المستفيد', a.client_name || '—'], ['المهنة', a.profession || '—'], ['تاريخ البدء', day(a.starts_on)]]) : empty('لا إسناد حالي', 'يظهر هنا العميل المسند إليه بعد الإسناد.')]));
      kids.push(h('p', { class: 'note' }, ['تُعرض هنا بياناتك أنت فقط. لا تُعرض أرقام الهوية ولا الجوال ولا الآيبان في هذه النسخة التجريبية.']));
      wframe('بياناتي', h('div', {}, kids));
    });
  }

  function vContract() {
    return call('worker-contract', null, true).then(function (o) {
      guard(o);
      var k = o.contract;
      wframe('عقدي', h('div', { class: 'shr-card' }, [k ? kv([['النوع', 'عقد عمل'], ['تاريخ البدء', day(k.starts_on)], ['الحالة', pill('ساري', 'ok')]]) : empty('لا عقد عمل ساري للعرض', 'يظهر هنا ملخص عقد عملك بعد توثيقه واعتماده.'),
        h('p', { class: 'note' }, ['ملخص العقد: النوع وتاريخ البدء. المسودات وما قيد الاعتماد لا تظهر.'])]));
    });
  }

  function vDocs() {
    return call('worker-documents', null, true).then(function (o) {
      guard(o);
      var tb = h('table', {}, [th(['المستند', 'الحالة', 'ينتهي', 'المتبقي']), h('tbody', {}, (o.documents || []).map(function (d) {
        var s = DST[d.status] || [d.status, ''];
        return h('tr', {}, [h('td', {}, [DOCN[d.kind] || d.kind]), h('td', {}, [pill(s[0], s[1])]), h('td', {}, [day(d.expires_on)]), h('td', {}, [d.days_left == null ? '—' : (d.days_left < 0 ? 'منذ ' + (-d.days_left) + ' يوماً' : d.days_left + ' يوماً')])]);
      }))]);
      var lists = (o.checklists || []).map(function (c) {
        return h('div', { class: 'shr-card' }, [h('h2', {}, [c.title_ar]), h('ul', {}, c.items.map(function (i) { return h('li', {}, [(i.done ? '✔ ' : '☐ '), i.text_ar]); })),
          h('p', { class: 'note' }, [c.complete ? 'اكتملت البنود المطلوبة.' : 'بنود مطلوبة لم تكتمل بعد.'])]);
      });
      wframe('مستنداتي', h('div', {}, [h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['المستندات']), tb]),
        h('p', { class: 'note' }, ['«قريبة الانتهاء» تعني أن المستند ينتهي خلال ' + o.expiry_alert_days + ' يوماً.'])].concat(lists)));
    });
  }

  function vSalary() {
    return call('worker-salary', null, true).then(function (o) {
      guard(o);
      wframe('راتبي', h('div', { class: 'shr-card' }, [empty('لا كشف راتب للعرض', o.note_ar || '')]));
    });
  }

  function vRequests() {
    return call('worker-requests', null, true).then(function (o) {
      guard(o);
      var rows = o.requests || [], TOP = o.topics || {};
      var kind = h('select', { class: 'inp' }, (o.kinds || []).map(function (k) { return h('option', { value: k }, [RKIND[k] || k]); }));
      // قائمة الموضوع تُعاد بناؤها عند تغيّر النوع (تُستبدل داخل حاوية، فلا تُعدَّل أبناء عنصر قائم).
      var topic = null, holder = h('div', { style: 'flex:1 1 150px;display:flex' }, []);
      var fill = function () {
        holder.innerHTML = '';
        topic = h('select', { class: 'inp', style: 'flex:1 1 auto' }, [h('option', { value: '' }, ['الموضوع…'])].concat((TOP[kind.value] || []).map(function (t) { return h('option', { value: t }, [TOPIC[t] || t]); })));
        holder.appendChild(topic);
      };
      var note = h('textarea', { class: 'inp wk-note', maxlength: '500', placeholder: 'وصف الطلب (حتى 500 حرف)' });
      kind.addEventListener('change', fill); fill();
      var form = h('div', { class: 'shr-card' }, [h('h2', {}, ['طلب جديد']), h('div', { class: 'frm' }, [kind, holder]), h('div', { style: 'margin:8px 0' }, [note]),
        h('button', { class: 'btn', onclick: function () {
          var d = { kind: kind.value, note: note.value };
          if (topic.value) d.topic = topic.value;
          call('worker-request-create', d).then(function (r) { flash(r.ok, r.ok ? 'سُجّل الطلب — يراجعه فريق Business Partner' : errText(r)); render(); });
        } }, ['إرسال الطلب']),
        h('p', { class: 'note' }, ['حالة الطلب يغيّرها فريق التشغيل وحده. هذا نموذج تجريبي: لا يُرسل شيء إلى أحد خارج النظام.'])]);
      var tb = h('table', {}, [th(['النوع', 'الموضوع', 'الوصف', 'التاريخ', 'الحالة']), h('tbody', {}, rows.map(function (r) {
        var st = RST[r.state] || [r.state, ''];
        return h('tr', {}, [h('td', {}, [RKIND[r.kind] || r.kind]), h('td', {}, [r.topic ? (TOPIC[r.topic] || r.topic) : '—']), h('td', {}, [r.note || '—']), h('td', {}, [day(r.created_at)]), h('td', {}, [pill(st[0], st[1])])]);
      }))]);
      wframe('طلباتي', h('div', {}, [form, h('div', { class: 'shr-card scroll' }, [rows.length ? tb : empty('لا طلبات بعد', 'تظهر هنا طلباتك عند إرسالها.')])]));
    });
  }
  return { _paint: wframe, _title: titleNow, wk_data: vData, wk_contract: vContract, wk_docs: vDocs, wk_salary: vSalary, wk_requests: vRequests };
}
