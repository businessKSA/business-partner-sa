// SHR-HR — شاشة «إعلانات الوظائف» داخل لوحة التشغيل: قائمة بالحالات، نموذج إعلان بمعاينة
// «كيف يبدو الإعلان» داخل الصفحة، أزرار الدورة (إرسال ← اعتماد ← نشر داخلي ← إغلاق)، وإضافة مقدّم طلب.
//
// shrPostsClient تعمل في المتصفح: تُحقن في صفحة /SHR-HR بـ toString()، فلا تلمس شيئاً خارج جسمها
// (لا استيراد ولا متغيرات وحدة، ولا backtick ولا ${ داخلها). ES5 عمداً ليطابق بقية الصفحة.
//
// قرار المالك: موضع النشر العام (صفحة وظائف BP أو منصات خارجية) معلّق، فالواجهة لا تعرض إلا القناة
// الخاصة، وتُبقي ملاحظة ثابتة بذلك. لا راتب يُولَّد: حقلا النطاق يدخلهما موظف وحده. بيانات تجريبية.

export const POSTS_CSS = `
.shr .pnote{background:var(--warnSoft);border:1px solid color-mix(in srgb,var(--warn) 45%,#fff);color:var(--warn);border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;margin-bottom:14px}
.shr .pgrid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:14px}
.shr .pform{display:grid;gap:10px}
.shr .pform label{display:grid;gap:4px;font-size:12.5px;color:var(--mut)}
.shr .pform .inp,.shr .pform textarea.inp{width:100%;box-sizing:border-box}
.shr .pform textarea.inp{min-height:92px;resize:vertical;font-family:inherit;line-height:1.7}
.shr .prow2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.shr .pv{background:#fff;border:1px solid var(--acLine);border-radius:13px;padding:16px 18px;box-shadow:var(--sh);position:sticky;top:calc(var(--hdr) + 64px)}
.shr .pv h3{margin:6px 0 4px;color:var(--ink);font-size:17px;font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.shr .pv .meta{color:var(--mut);font-size:13px;margin-bottom:8px;overflow-wrap:anywhere}
.shr .pv p{margin:0 0 8px;font-size:13.5px;line-height:1.8;overflow-wrap:anywhere}
.shr .pv .req{margin:8px 0 0;padding:0;list-style:none;font-size:13.5px;line-height:1.8}
.shr .pv .req li{overflow-wrap:anywhere}
.shr .pv .foot{border-top:1px dashed var(--acLine);margin-top:10px;padding-top:8px;font-size:12px;color:var(--mut)}
.shr .pv .sal{display:inline-block;background:var(--okSoft);color:var(--ok);border-radius:8px;padding:2px 10px;font-size:12.5px;font-weight:600;margin-bottom:8px}
.shr .pcards{display:grid;gap:12px}
.shr .pcard{background:#fff;border:1px solid var(--l);border-radius:13px;box-shadow:var(--sh);padding:14px 16px}
.shr .pcard.blk{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 3%,#fff)}
.shr .pcard .top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.shr .pcard h3{margin:0;font-size:15px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;min-width:0;flex:1 1 220px}
.shr .pcard .kv{margin:8px 0;display:flex;gap:6px 14px;flex-wrap:wrap;font-size:13px;color:var(--t)}
.shr .pcard .kv span b{color:var(--mut);font-weight:500;margin-inline-end:4px}
.shr .pcard .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.shr .pcard .why{font-size:12.5px;color:var(--bad);margin-top:6px}
.shr .pcard .padd{background:var(--soft);border-radius:10px;padding:10px;margin-top:10px}
@media(max-width:860px){
.shr .pgrid{grid-template-columns:minmax(0,1fr)}
.shr .pv{position:static}
.shr .prow2{grid-template-columns:1fr}
}
`;

export const POSTS_ERR = {
  content_rejected: 'نص الإعلان مرفوض',
  channel_not_enabled: 'قناة النشر هذه معطّلة: النشر العام قرار المالك ولم يُفعَّل',
  channel_not_implemented: 'قناة النشر الخارجية غير مُنفَّذة في هذه المرحلة',
  bad_channel: 'قناة نشر غير معروفة',
  bad_transition: 'انتقال غير مسموح: الدورة خطوة بخطوة (مسودة، اعتماد، نشر، إغلاق)',
  not_draft: 'لا تعديل إلا للمسودة',
  post_not_published: 'لا يُضاف مقدّم طلب إلا لإعلان منشور داخلياً',
  establishment_required: 'اختر المنشأة المعلِنة قبل الإرسال للاعتماد',
  bad_salary: 'قيمة الراتب غير صالحة',
  bad_salary_range: 'الحد الأدنى للراتب أكبر من الأعلى',
  bad_language: 'لغة غير صالحة',
  nothing_to_update: 'لا تغيير لحفظه',
  job_not_editable: 'لا يُنقل الإعلان إلى وظيفة أخرى'
};

export function shrPostsClient(env) {
  var h = env.h, call = env.call, frame = env.frame, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render, empty = env.empty;
  var ST = { draft: ['مسودة', 'mut'], pending_approval: ['بانتظار الاعتماد', 'warn'], approved: ['معتمد', 'ok'], published: ['منشور داخلياً', 'ok'], closed: ['مغلق', 'mut'] };
  var ST_ORDER = ['draft', 'pending_approval', 'approved', 'published', 'closed'];
  var CH = { shr_private: 'صفحة SHR الخاصة', public_bp_jobs: 'صفحة وظائف BP العامة', external: 'منصات خارجية' };
  var WHY = { licence_claim: 'ادعاء ترخيص', compliance_claim: 'ادعاء امتثال أو اعتماد', guarantee: 'ضمان أو وعد بنتيجة', gov_outcome_promise: 'وعد بنتيجة حكومية', invented_salary: 'رقم راتب غير موجود في حقل النطاق المُدخَل', contact_info: 'بيانات تواصل', client_name: 'اسم عميل' };
  var FIELD = { title: 'العنوان', description: 'الوصف', requirements: 'المتطلبات', city: 'المدينة' };
  var STATE_AR = { unknown: 'غير معروفة', clear: 'نظيفة', restricted: 'مقيّدة', suspected: 'اشتباه' };
  var CONSENT = { active: 'موافقة سارية', withdrawn: 'موافقة مسحوبة', none: 'بلا موافقة' };
  var fmtDate = function (s) { return s ? String(s).slice(0, 10) : '—'; };
  var opt = function (v, t, sel) { var o = h('option', { value: v }, [t]); if (sel) o.selected = true; return o; };
  function errP(o) {
    var t = errText(o);
    if (o && o.reasons && o.reasons.length) t += ': ' + o.reasons.map(function (r) { return (FIELD[r.field] || r.field) + ' — «' + r.match + '» (' + (WHY[r.code] || r.code) + ')'; }).join('، ');
    if (o && o.error === 'establishment_blocked') t += ' — ' + (STATE_AR[o.state] || o.state || '') + (o.reason ? ': ' + o.reason : '');
    return t;
  }
  function act(action, data, okMsg) { return call(action, data).then(function (r) { flash(r.ok, r.ok ? okMsg : errP(r)); if (r.ok) state.pedit = null; render(); return r; }); }

  function vPosts() {
    return Promise.all([call('posts', state.pfilter ? { status: state.pfilter } : null, true), call('jobs', null, true), call('compliance-dashboard', null, true), call('candidates', null, true)]).then(function (res) {
      var o = res[0], rows = o.posts || [], jobs = (res[1].jobs || []).filter(function (j) { return j.status === 'open'; }), ests = res[2].establishments || [], cands = res[3].candidates || [];
      var ed = state.pedit || null;

      // ---------------------------------------------------------------- النموذج + المعاينة ----
      var f = {
        job: h('select', { class: 'inp' }, jobs.map(function (j) { return opt(j.id, j.title + ' — ' + j.headcount + ' مطلوب', ed && ed.job.id === j.id); })),
        est: h('select', { class: 'inp' }, [opt('', 'اختر المنشأة المعلِنة…')].concat(ests.map(function (e) { return opt(e.id, e.name_ar + ' — ' + (STATE_AR[e.state] || e.state), ed && ed.establishment && ed.establishment.id === e.id); }))),
        lang: h('select', { class: 'inp' }, [opt('ar', 'العربية', !ed || ed.language === 'ar'), opt('en', 'English', ed && ed.language === 'en')]),
        title: h('input', { class: 'inp', placeholder: 'عنوان الإعلان', maxlength: '120' }),
        city: h('input', { class: 'inp', placeholder: 'المدينة', maxlength: '60' }),
        desc: h('textarea', { class: 'inp', placeholder: 'وصف قصير للوظيفة' }),
        req: h('textarea', { class: 'inp', placeholder: 'المتطلبات: سطر لكل شرط' }),
        smin: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'الحد الأدنى (اختياري)' }),
        smax: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'الحد الأعلى (اختياري)' })
      };
      if (ed) { f.title.value = ed.title || ''; f.city.value = ed.city || ''; f.desc.value = ed.description || ''; f.req.value = ed.requirements || ''; f.smin.value = ed.salary_min == null ? '' : String(ed.salary_min); f.smax.value = ed.salary_max == null ? '' : String(ed.salary_max); }
      var pv = h('div', { class: 'pv', 'aria-live': 'polite' });
      function headcountNow() { if (ed) return ed.headcount; var j = jobs.filter(function (x) { return x.id === f.job.value; })[0]; return j ? j.headcount : null; }
      function paintPreview() {
        pv.innerHTML = '';
        var lines = String(f.desc.value || '').split('\n').filter(function (x) { return x.trim(); });
        var reqs = String(f.req.value || '').split('\n').filter(function (x) { return x.trim(); });
        var hc = headcountNow(), meta = [];
        if (f.city.value) meta.push(f.city.value);
        if (hc != null) meta.push((f.lang.value === 'en' ? 'Positions: ' : 'عدد المطلوبين: ') + hc);
        var lo = f.smin.value, hi = f.smax.value, sal = null;
        if (lo !== '' || hi !== '') sal = (f.lang.value === 'en' ? 'Salary range: ' : 'نطاق الراتب: ') + (lo !== '' ? lo : '—') + ' – ' + (hi !== '' ? hi : '—') + (f.lang.value === 'en' ? ' SAR' : ' ريال');
        pv.appendChild(pill('كيف يبدو الإعلان — معاينة', 'mut'));
        pv.appendChild(pill('بيانات تجريبية', 'warn'));
        pv.appendChild(h('h3', {}, [f.title.value || 'عنوان الإعلان يظهر هنا']));
        if (meta.length) pv.appendChild(h('div', { class: 'meta' }, [meta.join(' · ')]));
        if (sal) pv.appendChild(h('div', { class: 'sal' }, [sal]));
        if (lines.length) lines.forEach(function (l) { pv.appendChild(h('p', {}, [l])); }); else pv.appendChild(h('p', { class: 'meta' }, ['الوصف يظهر هنا.']));
        if (reqs.length) pv.appendChild(h('ul', { class: 'req' }, reqs.map(function (l) { return h('li', {}, [l]); })));
        pv.appendChild(h('div', { class: 'foot' }, ['يظهر داخل صفحة SHR الخاصة فقط. لا اسم عميل ولا بيانات تواصل. لا نشر عام ولا خارجي.']));
      }
      ['title', 'city', 'desc', 'req', 'smin', 'smax'].forEach(function (k) { f[k].addEventListener('input', paintPreview); });
      f.lang.addEventListener('change', paintPreview);
      f.job.addEventListener('change', function () { var j = jobs.filter(function (x) { return x.id === f.job.value; })[0]; if (j && !f.city.value) f.city.value = j.city || ''; paintPreview(); });
      var local = h('p', { class: 'err', role: 'alert' });
      function numOrNull(v) { return v === '' ? null : Number(v); }
      var suggestBtn = h('button', { class: 'btn ghost', type: 'button', onclick: function () {
        local.textContent = '';
        if (!f.job.value) { local.textContent = 'اختر وظيفة مفتوحة أولاً'; return; }
        call('post-suggest', { job_id: f.job.value, language: f.lang.value }).then(function (r) {
          if (!r.ok) { local.textContent = errP(r); return; }
          var s = r.suggestion; f.title.value = s.title || ''; f.desc.value = s.description || ''; f.req.value = s.requirements || ''; if (s.city && !f.city.value) f.city.value = s.city;
          paintPreview(); state.msg = ''; state.err = '';
          local.textContent = 'صياغة من قالب محلي (بلا ذكاء اصطناعي، بلا راتب). عدّلها كما تشاء قبل الحفظ.' + (r.omitted && r.omitted.length ? ' حُذف ' + r.omitted.length + ' سطر لا يمرّ الحرس.' : '');
          local.className = 'note';
        }).catch(function () { local.className = 'err'; local.textContent = 'تعذّر الاتصال'; });
      } }, ['اقترح صياغة']);
      var saveBtn = h('button', { class: 'btn', type: 'button', onclick: function () {
        local.className = 'err'; local.textContent = '';
        var d = { title: f.title.value, description: f.desc.value, requirements: f.req.value, city: f.city.value, language: f.lang.value, establishment_id: f.est.value || null, salary_min: numOrNull(f.smin.value), salary_max: numOrNull(f.smax.value) };
        if (ed) { d.id = ed.id; act('post-update', d, 'حُفظ التعديل'); }
        else { d.job_id = f.job.value; call('post-create', d).then(function (r) { if (!r.ok) { local.textContent = errP(r); return; } flash(true, 'أُنشئت المسودة — أرسلها للاعتماد من بطاقتها'); render(); }).catch(function () { local.textContent = 'تعذّر الاتصال'; }); }
      } }, [ed ? 'حفظ التعديل' : 'حفظ كمسودة']);
      var cancelBtn = ed ? h('button', { class: 'btn ghost', type: 'button', onclick: function () { state.pedit = null; render(); } }, ['إلغاء التعديل']) : null;
      if (ed) f.job.disabled = true;
      var form = h('div', { class: 'shr-card' }, [h('h2', {}, [ed ? 'تعديل مسودة' : 'إعلان جديد']), h('div', { class: 'pform' }, [
        h('label', {}, ['الوظيفة', f.job]), h('label', {}, ['المنشأة المعلِنة (تُفحص حالة قيدها قبل الإرسال)', f.est]),
        h('div', { class: 'prow2' }, [h('label', {}, ['لغة الإعلان', f.lang]), h('label', {}, ['المدينة', f.city])]),
        h('label', {}, ['العنوان', f.title]), h('label', {}, ['الوصف', f.desc]), h('label', {}, ['المتطلبات', f.req]),
        h('div', { class: 'prow2' }, [h('label', {}, ['أدنى راتب بالريال (يدخله موظف فقط)', f.smin]), h('label', {}, ['أعلى راتب بالريال (يدخله موظف فقط)', f.smax])]),
        h('div', { class: 'frm' }, [suggestBtn, saveBtn, cancelBtn]), local,
        h('p', { class: 'note' }, ['عدد المطلوبين يؤخذ من الوظيفة. النص لا يقبل ادعاء ترخيص أو امتثال أو ضمان أو وعداً بنتيجة حكومية، ولا رقم راتب خارج الحقلين، ولا بيانات تواصل أو اسم عميل. من يكتب الإعلان لا يعتمده.'])])]);
      paintPreview();

      // ------------------------------------------------------------------------ القائمة ----
      var flt = h('select', { class: 'inp', onchange: function () { state.pfilter = flt.value; render(); } }, [opt('', 'كل الحالات', !state.pfilter)].concat(ST_ORDER.map(function (s) { return opt(s, ST[s][0], state.pfilter === s); })));
      function card(p) {
        var st = ST[p.status] || [p.status, ''];
        var head = [h('h3', {}, [p.title]), h('div', { class: 'frm' }, [pill(st[0], st[1]), p.blocked ? pill('محجوب: منشأة ' + (STATE_AR[p.blocked.state] || p.blocked.state), 'bad') : null])];
        var kv = [['الوظيفة', (p.job && p.job.title) || '—'], ['المدينة', p.city || '—'], ['المطلوبون', String(p.headcount)], ['المنشأة', (p.establishment && p.establishment.name_ar) || 'لم تُحدَّد'], ['القناة', CH[p.channel] || p.channel], ['الطلبات', String(p.applicants)]];
        if (p.salary_min != null || p.salary_max != null) kv.push(['الراتب (مُدخَل بشرياً)', (p.salary_min == null ? '—' : p.salary_min) + ' – ' + (p.salary_max == null ? '—' : p.salary_max)]);
        kv.push(['كتبه', p.created_by_name || '—']);
        if (p.approved_by_name) kv.push(['اعتمده', p.approved_by_name]);
        var acts = [];
        if (p.status === 'draft') {
          acts.push(h('button', { class: 'btn ghost sm', type: 'button', onclick: function () { state.pedit = p; render(); } }, ['تعديل']));
          acts.push(h('button', { class: 'btn sm', type: 'button', onclick: function () { act('post-submit', { id: p.id }, 'أُرسل للاعتماد'); } }, ['إرسال للاعتماد']));
        }
        if (p.status === 'pending_approval') {
          var ap = h('button', { class: 'btn sm', type: 'button', onclick: function () { act('post-approve', { id: p.id }, 'اعتُمد الإعلان'); } }, ['اعتماد']);
          if (p.mine) { ap.disabled = true; ap.setAttribute('title', 'كاتب الإعلان لا يعتمده — يعتمده مستخدم آخر'); }
          acts.push(ap);
        }
        if (p.status === 'approved') acts.push(h('button', { class: 'btn sm', type: 'button', onclick: function () { act('post-publish', { id: p.id }, 'نُشر داخل صفحة SHR الخاصة فقط'); } }, ['نشر داخل SHR']));
        if (p.status === 'published') acts.push(h('button', { class: 'btn ghost sm', type: 'button', onclick: function () { state.paddFor = state.paddFor === p.id ? null : p.id; render(); } }, ['إضافة مقدّم طلب']));
        if (p.status !== 'closed') acts.push(h('button', { class: 'btn ghost sm', type: 'button', onclick: function () { act('post-close', { id: p.id }, 'أُغلق الإعلان'); } }, ['إغلاق']));
        var kids = [h('div', { class: 'top' }, head), h('div', { class: 'kv' }, kv.map(function (x) { return h('span', {}, [h('b', {}, [x[0]]), x[1]]); }))];
        if (p.blocked) kids.push(h('div', { class: 'why' }, ['لا يُنشر ولا تُضاف له طلبات ما دامت المنشأة ' + (STATE_AR[p.blocked.state] || '') + (p.blocked.reason ? ' (' + p.blocked.reason + ')' : '') + '.']));
        if (p.job && p.job.status === 'closed' && p.status !== 'closed') kids.push(h('div', { class: 'why' }, ['الوظيفة مغلقة: لا يُنشر هذا الإعلان.']));
        if (acts.length) kids.push(h('div', { class: 'acts' }, acts));
        if (state.paddFor === p.id && p.status === 'published') {
          var cs = h('select', { class: 'inp' }, cands.map(function (c) { return opt(c.id, c.full_name + ' — ' + (c.profession || '') + ' (' + (CONSENT[c.consent] || c.consent) + ')'); }));
          var perr = h('p', { class: 'err', role: 'alert' });
          kids.push(h('div', { class: 'padd' }, [h('div', { class: 'frm' }, [cs, h('button', { class: 'btn sm', type: 'button', onclick: function () {
            call('post-applicant-add', { post_id: p.id, candidate_id: cs.value }).then(function (r) { if (!r.ok) { perr.textContent = errP(r); return; } state.paddFor = null; flash(true, 'أُضيف طلب التقديم في «جديد» (إدخال يدوي، لا صفحة تقديم عامة)'); render(); }).catch(function () { perr.textContent = 'تعذّر الاتصال'; });
          } }, ['إضافة'])]), perr, h('p', { class: 'note' }, ['لا يُقبل إلا مرشح موافقته سارية. لا صفحة تقديم عامة: المشغّل يدخل الطلب يدوياً.'])]));
        }
        if (p.history && p.history.length) kids.push(h('details', {}, [h('summary', {}, ['سجل الحالات']), h('ul', { class: 'tl' }, p.history.map(function (e) { return h('li', {}, [fmtDate(e.at) + ' — ' + (e.from ? (ST[e.from] || [e.from])[0] + ' ← ' : 'إنشاء: ') + (ST[e.to] || [e.to])[0] + (e.by ? ' (' + e.by + ')' : '') + (e.note && e.to !== 'draft' ? ' — ' + e.note : '')]); }))]));
        return h('div', { class: 'pcard' + (p.blocked ? ' blk' : '') }, kids);
      }
      var chans = (o.channels || []).map(function (c) { return (CH[c.channel] || c.channel) + (c.enabled ? ' (مفعّلة)' : ' (معطّلة)'); }).join(' · ');
      frame('إعلانات الوظائف', h('div', {}, [
        h('div', { class: 'pnote', role: 'note' }, ['النشر العام (صفحة وظائف BP العامة أو منصات خارجية) قرار المالك ولم يُفعَّل. «منشور» هنا يعني ظاهراً داخل صفحة SHR الخاصة فقط، ولا يُرسل شيء لأحد.']),
        h('div', { class: 'pgrid' }, [form, pv]),
        h('div', { class: 'shr-card' }, [h('div', { class: 'frm' }, [h('h2', { style: 'margin:0;flex:1 1 auto' }, ['الإعلانات (' + rows.length + ')']), flt]), h('p', { class: 'note' }, ['القنوات: ' + chans])]),
        rows.length ? h('div', { class: 'pcards' }, rows.map(card)) : empty('لا إعلانات في هذه الحالة', 'اكتب إعلاناً من النموذج أعلاه.')]));
    });
  }

  return { posts: vPosts };
}
