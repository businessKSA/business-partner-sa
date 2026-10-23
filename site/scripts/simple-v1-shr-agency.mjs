// SHR-HR — بوابة المكاتب: شاشات المشغّل (المكاتب · الأوامر · المرشحون المقدَّمون)
// ومنظور المكتب نفسه (طلباتي · تقديم مرشح · استيراد جماعي · مقابلاتي).
//
// الدالتان تعملان في المتصفح: تُحقنان في صفحة /SHR-HR بـ toString()، فلا تلمسان شيئاً
// خارج جسميهما (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ${ داخلهما). تتلقيان
// أدوات الصفحة في env. ES5 عمداً ليطابق بقية الصفحة.
// بيانات تجريبية فقط: وسم «بيانات تجريبية» ثابت أعلى كل شاشة من قشرة الصفحة.
// لا شعار ولا ادعاء ترخيص أو امتثال. المكتب لا يرى عميلاً ولا سعراً ولا مراحل صاحب العمل.

export const AGENCY_CSS = `
.shr .persp{display:inline-block;background:#eef2ff;color:#2b56c3;border-radius:999px;padding:3px 12px;font-size:.78rem;font-weight:800;margin-inline-start:8px;vertical-align:middle}
.shr .modes{display:flex;gap:6px;margin-bottom:12px}
.shr .modes button{flex:1;border:1px solid #e4e8f1;background:#fff;border-radius:10px;padding:8px;font-weight:700;cursor:pointer;color:#2c3550}
.shr .modes button.on{background:#0B1B5A;color:#fff;border-color:#0B1B5A}
.shr textarea.inp{width:100%;min-height:140px;font-family:ui-monospace,monospace;font-size:.82rem;box-sizing:border-box}
.shr .dup{background:#fff3e6;border:1px solid #f59e0b;color:#92400e;border-radius:8px;padding:2px 8px;font-size:.72rem;font-weight:800}
.shr .rev{margin-top:6px}.shr .rev .frm{margin-top:6px}
.shr .rpt{margin-top:10px;background:#f6f8fc;border:1px solid #e4e8f1;border-radius:12px;padding:10px}
`;

export const AGENCY_ERR = {
  agency_not_approved: 'المكتب غير معتمد (قيد الاعتماد أو موقوف) — لا دخول',
  already_approved: 'المكتب معتمد أصلاً',
  not_approved: 'المكتب غير معتمد',
  name_required: 'الاسم مطلوب',
  demo_email_only: 'بريد تجريبي فقط بنطاق .invalid في هذه المرحلة',
  email_taken: 'هذا البريد مستخدم',
  profession_required: 'المهنة مطلوبة',
  bad_quantity: 'الكمية بين 1 و500',
  agency_or_open_required: 'حدّد مكتباً أو «مفتوح»',
  bad_due_on: 'تاريخ غير صالح',
  order_closed: 'الأمر مغلق',
  duplicate_candidate: 'مرشح مكرر على هذا الأمر',
  duplicate_in_file: 'مكرر داخل الملف',
  contact_fields_not_allowed: 'لا هاتف ولا بريد ولا هوية خام في هذه المرحلة',
  full_name_required: 'الاسم مطلوب',
  bad_years_experience: 'سنوات الخبرة غير صالحة',
  order_not_found: 'الأمر غير موجود لهذا المكتب',
  no_rows: 'لا صفوف',
  too_many_rows: 'الحد الأقصى 60 صفاً في الدفعة',
  bad_transition: 'انتقال غير مسموح بين هاتين الحالتين',
  same_state: 'المرشح في هذه الحالة أصلاً',
  bad_list: 'القائمة غير صالحة'
};

// ================================================================ المشغّل ==
export function shrAgencyOpsClient(env) {
  var h = env.h, call = env.call, frame = env.frame, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render;
  var AST = { pending: ['قيد الاعتماد', 'warn'], approved: ['معتمد', 'ok'], suspended: ['موقوف', 'bad'] };
  var SST = { submitted: 'مقدَّم', under_review: 'قيد المراجعة', shortlisted: 'قائمة قصيرة', interview: 'مقابلة', accepted: 'مقبول', rejected: 'مرفوض' };
  var NEXT = { submitted: ['under_review', 'rejected'], under_review: ['shortlisted', 'rejected'], shortlisted: ['interview', 'accepted', 'rejected'], interview: ['accepted', 'rejected'], accepted: [], rejected: [] };
  var MODE = { onsite: 'حضوري', video: 'مرئي', phone: 'هاتفي' };
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  function act(action, data, okMsg) { return call(action, data).then(function (r) { flash(r.ok, r.ok ? okMsg : errText(r)); render(); }); }

  function vAgencies() {
    return call('agencies', null, true).then(function (o) {
      var rows = o.agencies || [];
      var nm = h('input', { class: 'inp', placeholder: 'اسم المكتب (وهمي)' }), co = h('input', { class: 'inp', placeholder: 'البلد' }), em = h('input', { class: 'inp', placeholder: 'بريد دخول تجريبي: x@shr.invalid', style: 'min-width:220px' });
      var add = h('div', { class: 'shr-card' }, [h('h2', {}, ['تسجيل مكتب جديد']), h('div', { class: 'frm' }, [nm, co, em,
        h('button', { class: 'btn', onclick: function () { act('agency-create', { name_ar: nm.value, country: co.value, contact_email: em.value }, 'سُجّل المكتب «قيد الاعتماد» — لا دخول قبل اعتماد مستخدم آخر'); } }, ['تسجيل'])]),
        h('p', { class: 'note' }, ['من سجّل المكتب لا يعتمده. المكتب لا يدخل ولا يستلم أوامر قبل الاعتماد. بريد حقيقي غير مقبول في هذه المرحلة.'])]);
      var tb = h('table', {}, [th(['المرجع', 'المكتب', 'البلد', 'الحالة', 'دخول', 'أوامر', 'مرشحون', '']), h('tbody', {}, rows.map(function (a) {
        var st = AST[a.status] || [a.status, ''], acts = [];
        if (a.status === 'pending' || a.status === 'suspended') acts.push(h('button', { class: 'btn', onclick: function () { act('agency-approve', { id: a.id }, 'اعتُمد المكتب'); } }, ['اعتماد']));
        if (a.status === 'approved') acts.push(h('button', { class: 'btn ghost', onclick: function () { act('agency-suspend', { id: a.id }, 'أُوقف المكتب'); } }, ['إيقاف']));
        return h('tr', {}, [h('td', {}, [a.ref || '—']), h('td', {}, [a.name_ar]), h('td', {}, [a.country || '—']), h('td', {}, [pill(st[0], st[1])]),
          h('td', {}, [(a.login_emails || []).join('، ') || '—']), h('td', {}, [String(a.orders)]), h('td', {}, [String(a.submissions)]), h('td', {}, [h('div', { class: 'frm' }, acts)])]);
      }))]);
      frame('المكاتب', h('div', {}, [add, h('div', { class: 'shr-card scroll' }, [tb])]));
    });
  }

  function vOrders() {
    return Promise.all([call('orders', null, true), call('agencies', null, true)]).then(function (res) {
      var rows = res[0].orders || [], ags = (res[1].agencies || []).filter(function (a) { return a.status === 'approved'; });
      var dest = h('select', { class: 'inp' }, [h('option', { value: '' }, ['الوجهة…']), h('option', { value: 'open' }, ['مفتوح لكل المكاتب المعتمدة'])].concat(ags.map(function (a) { return h('option', { value: a.id }, [a.name_ar]); })));
      var pr = h('input', { class: 'inp', placeholder: 'المهنة' }), qt = h('input', { class: 'inp', type: 'number', min: '1', value: '1', style: 'width:90px' }), br = h('input', { class: 'inp', placeholder: 'توجيه للمكتب (يراه المكتب)', style: 'min-width:240px' }), du = h('input', { class: 'inp', type: 'date' });
      var add = h('div', { class: 'shr-card' }, [h('h2', {}, ['أمر استقدام جديد']), h('div', { class: 'frm' }, [dest, pr, qt, br, du,
        h('button', { class: 'btn', onclick: function () {
          call('order-create', { agency_id: dest.value, profession: pr.value, quantity: Number(qt.value), agency_brief: br.value, due_on: du.value }).then(function (r) {
            var w = r.ok && r.order.warnings && r.order.warnings.length ? ' — تنبيه: فحص قيود التأشيرات معلَّق بقرار المالك' : '';
            flash(r.ok, r.ok ? 'أُنشئ الأمر' + w : errText(r)); render();
          });
        } }, ['إنشاء'])]),
        h('p', { class: 'note' }, ['الأمر الموجَّه يراه مكتبه وحده؛ المفتوح يراه كل مكتب معتمد. المكتب يرى المهنة والكمية والتوجيه فقط: لا عميل ولا سعر.'])]);
      var tb = h('table', {}, [th(['المرجع', 'المهنة', 'الكمية', 'الوجهة', 'العميل (داخلي)', 'مقدَّم / مقبول', 'الحالة', '']), h('tbody', {}, rows.map(function (o) {
        return h('tr', {}, [h('td', {}, [o.ref || '—']), h('td', {}, [o.profession]), h('td', {}, [String(o.quantity)]),
          h('td', {}, [o.scope === 'open' ? pill('مفتوح', '') : (o.agency || '—')]), h('td', {}, [o.client || '—']),
          h('td', {}, [o.submissions + ' / ' + o.accepted]), h('td', {}, [pill(o.state === 'open' ? 'مفتوح' : o.state, o.state === 'open' ? 'ok' : 'mut')]),
          h('td', {}, [h('button', { class: 'btn ghost', onclick: function () { state.oid = o.id; state.view = 'order_view'; state.msg = ''; state.err = ''; render(); } }, ['ما يراه صاحب العمل'])])]);
      }))]);
      frame('أوامر الاستقدام', h('div', {}, [add, h('div', { class: 'shr-card scroll' }, [tb])]));
    });
  }

  // معاينة ما يُعرض لصاحب العمل: «عبر شريك» فقط، بلا مكتب.
  function vOrderView() {
    return call('order-employer-view', { id: state.oid }, true).then(function (o) {
      if (!o.ok) { state.view = 'orders'; flash(false, errText(o)); return render(); }
      var cs = o.candidates || [];
      var tb = h('table', {}, [th(['المرجع', 'الاسم', 'المهنة', 'الجنسية', 'الخبرة', 'المصدر']), h('tbody', {}, cs.map(function (c) {
        return h('tr', {}, [h('td', {}, [c.ref]), h('td', {}, [c.full_name]), h('td', {}, [c.profession || '—']), h('td', {}, [c.nationality || '—']), h('td', {}, [c.years_experience == null ? '—' : String(c.years_experience)]), h('td', {}, [pill(c.source, '')])]);
      }))]);
      frame('ما يراه صاحب العمل', h('div', {}, [
        h('button', { class: 'btn ghost back', onclick: function () { state.view = 'orders'; render(); } }, ['رجوع']),
        h('div', { class: 'shr-card' }, [h('h2', {}, [o.order.ref + ' — ' + o.order.profession + ' × ' + o.order.quantity]), h('p', { class: 'note' }, ['المصدر: ' + o.order.source + '. اسم المكتب وبلده ومعرّفه لا تظهر لصاحب العمل أبداً.'])]),
        h('div', { class: 'shr-card scroll' }, [cs.length ? tb : h('p', { class: 'note' }, ['لا مرشحين مقدَّمين بعد.'])])]));
    });
  }

  function vSubs() {
    return call('agency-submissions', state.subState ? { state: state.subState } : null, true).then(function (o) {
      var rows = o.submissions || [];
      var f = h('select', { class: 'inp', onchange: function () { state.subState = f.value; render(); } }, [h('option', { value: '' }, ['كل الحالات'])].concat(Object.keys(SST).map(function (s) { var op = h('option', { value: s }, [SST[s]]); if (s === state.subState) op.selected = true; return op; })));
      function review(s) {
        var nx = NEXT[s.state] || [];
        if (!nx.length) return h('span', { class: 'note' }, ['نهائي']);
        var sel = h('select', { class: 'inp' }, nx.map(function (x) { return h('option', { value: x }, [SST[x]]); }));
        var when = h('input', { class: 'inp', type: 'datetime-local' }), mode = h('select', { class: 'inp' }, [h('option', { value: '' }, ['نوع المقابلة'])].concat(Object.keys(MODE).map(function (m) { return h('option', { value: m }, [MODE[m]]); })));
        var note = h('input', { class: 'inp', placeholder: 'ملاحظة داخلية' }), an = h('input', { class: 'inp', placeholder: 'نص للمكتب (اختياري)' });
        var ex = h('div', { class: 'frm' }, [when, mode, an]);
        ex.style.display = 'none';
        sel.addEventListener('change', function () { ex.style.display = sel.value === 'interview' ? 'flex' : 'none'; });
        ex.style.display = nx[0] === 'interview' ? 'flex' : 'none';
        return h('div', { class: 'rev' }, [h('div', { class: 'frm' }, [sel, note, h('button', { class: 'btn', onclick: function () {
          var d = { id: s.id, state: sel.value, note: note.value };
          if (sel.value === 'interview') { d.mode = mode.value || null; d.scheduled_at = when.value ? new Date(when.value).toISOString() : null; d.agency_note = an.value; }
          act('submission-state', d, 'تغيّرت الحالة');
        } }, ['تنفيذ'])]), ex]);
      }
      var tb = h('table', {}, [th(['المرجع', 'المرشح', 'المكتب', 'الأمر', 'الحالة', 'مراجعة']), h('tbody', {}, rows.map(function (s) {
        var tags = [pill(SST[s.state] || s.state, s.state === 'accepted' ? 'ok' : s.state === 'rejected' ? 'bad' : s.state === 'interview' ? 'warn' : '')];
        if (s.cross_agency_duplicate) tags.push(h('span', { class: 'dup' }, ['تكرار بين مكاتب: ' + s.duplicates.filter(function (d) { return !d.same_agency; }).map(function (d) { return d.agency + ' (' + d.ref + ')'; }).join('، ')]));
        if (s.interview) tags.push(pill('مقابلة ' + (s.interview.scheduled_at ? String(s.interview.scheduled_at).slice(0, 16).replace('T', ' ') : 'مطلوبة'), 'warn'));
        return h('tr', {}, [h('td', {}, [s.ref]), h('td', {}, [s.full_name, h('div', { class: 'note' }, [(s.profession || '—') + ' · ' + (s.nationality || '—') + ' · ' + (s.years_experience == null ? '—' : s.years_experience + ' سنة')])]),
          h('td', {}, [s.agency || '—']), h('td', {}, [s.order_ref || '—']), h('td', {}, [h('div', { class: 'frm' }, tags)]), h('td', {}, [review(s)])]);
      }))]);
      frame('المرشحون المقدَّمون من المكاتب', h('div', {}, [h('div', { class: 'shr-card' }, [h('div', { class: 'frm' }, [f]), h('p', { class: 'note' }, ['مواصفات فقط: لا هوية ولا هاتف ولا بريد. مراحل المراجعة داخلية ولا يراها المكتب (يرى «مستلم / مقابلة / مقبول / غير مختار»).'])]), h('div', { class: 'shr-card scroll' }, [rows.length ? tb : h('p', { class: 'note' }, ['لا مرشحين.'])])]));
    });
  }
  return { agencies: vAgencies, orders: vOrders, order_view: vOrderView, subs: vSubs };
}

// ================================================================== المكتب ==
// منظور مستقل: شريط تنقل خاص ولا شيء من لوحة المشغّل. يتكلم مع إجراءات my-* وحدها.
export function shrAgencyPortalClient(env) {
  var h = env.h, call = env.call, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render, app = env.app;
  var STATUS = { received: ['مستلم', ''], interview: ['مقابلة', 'warn'], accepted: ['مقبول', 'ok'], not_selected: ['غير مختار', 'mut'] };
  var IVS = { requested: 'مطلوبة', scheduled: 'مجدولة', done: 'تمت', cancelled: 'ملغاة' };
  var MODE = { onsite: 'حضوري', video: 'مرئي', phone: 'هاتفي' };
  var NAV = [['a_orders', 'طلباتي'], ['a_submit', 'تقديم مرشح'], ['a_bulk', 'استيراد جماعي'], ['a_iv', 'مقابلاتي']];
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  var fmt = function (s) { return s ? String(s).slice(0, 16).replace('T', ' ') : '—'; };

  function aframe(title, content) {
    app.innerHTML = '';
    var tabs = h('div', { class: 'shr-tabs' }, NAV.map(function (n) {
      return h('button', { class: state.view === n[0] ? 'on' : '', onclick: function () { state.view = n[0]; state.msg = ''; state.err = ''; render(); } }, [n[1]]);
    }).concat([h('button', { onclick: function () { call('session-end').then(function () { state.me = null; render(); }); } }, ['خروج'])]));
    app.appendChild(h('h1', {}, [title, h('span', { class: 'persp' }, ['منظور المكتب — ' + (state.me && state.me.agency ? state.me.agency.name_ar : '')])]));
    app.appendChild(tabs);
    if (state.msg) app.appendChild(h('p', { class: 'okm' }, [state.msg]));
    if (state.err) app.appendChild(h('p', { class: 'err' }, [state.err]));
    app.appendChild(content);
  }
  function orderSelect(orders, pre) {
    var sel = h('select', { class: 'inp' }, [h('option', { value: '' }, ['اختر الأمر…'])].concat(orders.filter(function (o) { return o.state === 'open'; }).map(function (o) {
      var op = h('option', { value: o.id }, [o.ref + ' — ' + o.profession + ' × ' + o.quantity]); if (o.id === pre) op.selected = true; return op;
    })));
    return sel;
  }
  function subsTable(rows) {
    return h('table', {}, [th(['المرجع', 'المرشح', 'الأمر', 'الحالة', 'المقابلة']), h('tbody', {}, rows.map(function (s) {
      var st = STATUS[s.status] || [s.status, ''];
      return h('tr', {}, [h('td', {}, [s.ref]), h('td', {}, [s.full_name, h('div', { class: 'note' }, [(s.profession || '—') + ' · ' + (s.nationality || '—')])]), h('td', {}, [s.order_ref || '—']),
        h('td', {}, [pill(st[0], st[1])]), h('td', {}, [s.interview ? (IVS[s.interview.state] || s.interview.state) + ' ' + fmt(s.interview.scheduled_at) : '—'])]);
    }))]);
  }

  function vOrders() {
    return Promise.all([call('my-orders', null, true), call('my-submissions', null, true)]).then(function (res) {
      if (!res[0].ok) throw new Error(res[0].error);
      var orders = res[0].orders || [], subs = res[1].submissions || [];
      var tb = h('table', {}, [th(['المرجع', 'المهنة', 'الكمية', 'الجنسية المفضلة', 'التوجيه', 'الموعد', 'النوع', 'مرشحوني', '']), h('tbody', {}, orders.map(function (o) {
        return h('tr', {}, [h('td', {}, [o.ref]), h('td', {}, [o.profession]), h('td', {}, [String(o.quantity)]), h('td', {}, [(o.nationality_pref || []).join('، ') || '—']), h('td', {}, [o.brief || '—']),
          h('td', {}, [o.due_on || '—']), h('td', {}, [pill(o.scope === 'open' ? 'مفتوح' : 'موجّه إليكم', o.scope === 'open' ? '' : 'ok')]), h('td', {}, [String(o.my_submissions)]),
          h('td', {}, [o.state === 'open' ? h('button', { class: 'btn', onclick: function () { state.aorder = o.id; state.view = 'a_submit'; render(); } }, ['قدّم مرشحاً']) : pill('مغلق', 'mut')])]);
      }))]);
      aframe('طلباتي', h('div', {}, [
        h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['الأوامر الموجّهة إليكم والمفتوحة']), orders.length ? tb : h('p', { class: 'note' }, ['لا أوامر.'])]),
        h('div', { class: 'shr-card scroll' }, [h('h2', {}, ['مرشحوكم']), subs.length ? subsTable(subs) : h('p', { class: 'note' }, ['لم تقدّموا مرشحين بعد.'])])]));
    });
  }

  function vSubmit() {
    return call('my-orders', null, true).then(function (o) {
      var orders = o.orders || [], sel = orderSelect(orders, state.aorder);
      var f = { name: h('input', { class: 'inp', placeholder: 'الاسم (وهمي)' }), prof: h('input', { class: 'inp', placeholder: 'المهنة' }), nat: h('input', { class: 'inp', placeholder: 'الجنسية' }),
        yrs: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'سنوات الخبرة', style: 'width:130px' }), skills: h('input', { class: 'inp', placeholder: 'مهارات بفاصلة' }),
        id: h('input', { class: 'inp', placeholder: 'رقم هوية وهمي (اختياري — يُحفظ بصمةً فقط)' }) };
      var go = h('button', { class: 'btn', onclick: function () {
        call('submit-candidate', {
          order_id: sel.value, full_name: f.name.value, profession: f.prof.value, nationality: f.nat.value,
          years_experience: f.yrs.value === '' ? null : Number(f.yrs.value),
          skills: f.skills.value.split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean), id_no: f.id.value
        }).then(function (r) { flash(r.ok, r.ok ? 'قُدّم المرشح (' + r.submission.ref + ')' : errText(r)); if (r.ok) state.aorder = sel.value; render(); });
      } }, ['تقديم']);
      aframe('تقديم مرشح', h('div', { class: 'shr-card' }, [h('h2', {}, ['مواصفات المرشح']), h('div', { class: 'frm' }, [sel, f.name, f.prof, f.nat, f.yrs, f.skills, f.id, go]),
        h('p', { class: 'note' }, ['مواصفات فقط في هذه المرحلة: لا هاتف ولا بريد ولا رقم هوية حقيقي. التكرار على الأمر نفسه يُرفض.'])]));
    });
  }

  // CSV بسيط يُحلَّل في المتصفح: الاسم، المهنة، الجنسية، سنوات الخبرة، رقم وهمي.
  function parseRows(text) {
    var lines = String(text || '').split(/\r?\n/), out = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var c = lines[i].split(/[,\t;،]/).map(function (x) { return x.trim(); });
      if (out.length === 0 && /^(الاسم|name)/i.test(c[0])) continue;       // سطر العناوين
      out.push({ line: i + 1, full_name: c[0] || '', profession: c[1] || '', nationality: c[2] || '', years_experience: c[3] === undefined || c[3] === '' ? null : (isNaN(Number(c[3])) ? c[3] : Number(c[3])), id_no: c[4] || '' });
    }
    return out;
  }
  function vBulk() {
    return call('my-orders', null, true).then(function (o) {
      var orders = o.orders || [], sel = orderSelect(orders, state.aorder);
      var ta = h('textarea', { class: 'inp', placeholder: 'الاسم,المهنة,الجنسية,سنوات الخبرة,رقم وهمي\nمرشح تجريبي (وهمي),سائق,الفلبين,4,DEMO-1' });
      var file = h('input', { type: 'file', accept: '.csv,.txt,text/csv', onchange: function () {
        var fl = file.files && file.files[0]; if (!fl) return; var rd = new FileReader(); rd.onload = function () { ta.value = String(rd.result || ''); }; rd.readAsText(fl);
      } });
      var rpt = h('div', {});
      var go = h('button', { class: 'btn', onclick: function () {
        var rows = parseRows(ta.value);
        call('bulk-submit', { order_id: sel.value, rows: rows }).then(function (r) {
          rpt.innerHTML = '';
          if (!r.ok) { rpt.appendChild(h('p', { class: 'err' }, [errText(r)])); return; }
          rpt.appendChild(h('div', { class: 'rpt' }, [h('p', { class: 'okm' }, ['أُنشئ ' + r.created + ' · متجاوَز ' + r.skipped]),
            r.errors.length ? h('table', {}, [th(['السطر', 'السبب']), h('tbody', {}, r.errors.map(function (e) { return h('tr', {}, [h('td', {}, [String(e.line)]), h('td', {}, [errText({ error: e.error })])]); }))]) : h('p', { class: 'note' }, ['لا أخطاء.'])]));
        });
      } }, ['استيراد']);
      aframe('استيراد جماعي', h('div', { class: 'shr-card' }, [h('h2', {}, ['قائمة مرشحين (حتى 60 صفاً)']), h('div', { class: 'frm' }, [sel, file]), h('div', { style: 'margin:10px 0' }, [ta]), go,
        h('p', { class: 'note' }, ['الأعمدة: الاسم، المهنة، الجنسية، سنوات الخبرة، رقم هوية وهمي (اختياري). الصف الفاسد يُبلَّغ برقم سطره ولا يوقف الباقي. أعمدة الهاتف والبريد مرفوضة.']), rpt]));
    });
  }

  function vInterviews() {
    return call('my-interviews', null, true).then(function (o) {
      var rows = o.interviews || [];
      var tb = h('table', {}, [th(['المرشح', 'الحالة', 'الموعد', 'النوع', 'المكان', 'ملاحظة']), h('tbody', {}, rows.map(function (i) {
        return h('tr', {}, [h('td', {}, [i.candidate ? i.candidate.full_name : '—']), h('td', {}, [pill(IVS[i.state] || i.state, i.state === 'scheduled' ? 'warn' : i.state === 'done' ? 'ok' : 'mut')]), h('td', {}, [fmt(i.scheduled_at)]),
          h('td', {}, [MODE[i.mode] || '—']), h('td', {}, [i.location || '—']), h('td', {}, [i.note || '—'])]);
      }))]);
      aframe('مقابلاتي', h('div', { class: 'shr-card scroll' }, [rows.length ? tb : h('p', { class: 'note' }, ['لا مقابلات بعد.'])]));
    });
  }
  return { a_orders: vOrders, a_submit: vSubmit, a_bulk: vBulk, a_iv: vInterviews };
}
