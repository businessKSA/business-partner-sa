// SHR-HR — شاشات ATS داخل لوحة التشغيل: الوظائف، لوحة مراحل المرشحين، ملف المرشح، المطابقة.
// shrAtsClient تعمل في المتصفح: تُحقَن في الصفحة بـ toString()، فلا تلمس شيئاً خارج
// جسمها (لا استيراد ولا متغيرات وحدة). تتلقى أدوات لوحة التشغيل في env.
// بيانات تجريبية فقط؛ وسم «بيانات تجريبية» ثابت أعلى كل شاشة من قشرة الصفحة.
// ES5 عمداً ليطابق بقية الصفحة.

export const ATS_CSS = `
.shr .board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);gap:10px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px}
.shr .col{background:var(--soft);border:1px solid var(--l);border-radius:12px;padding:8px;min-height:120px}
.shr .col h3{margin:0 0 8px;font-size:13.5px;color:var(--ink);display:flex;justify-content:space-between;align-items:center;font-weight:600}
.shr .col h3 span{background:#fff;border:1px solid var(--l);border-radius:999px;padding:0 9px;font-family:var(--fm);font-size:12px;font-weight:500;color:var(--mut)}
.shr .kcard{background:#fff;border:1px solid var(--l);border-radius:10px;padding:10px;margin-bottom:8px;font-size:13px;box-shadow:var(--sh)}
.shr .kcard a{color:var(--ink);font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.shr .kcard .sub{color:var(--mut);font-size:12.5px;margin:3px 0 6px}
.shr .kcard select{width:100%;font-size:12.5px;padding:5px}
.shr .kcard.busy{opacity:.55}
.shr .score{display:inline-block;min-width:40px;text-align:center;border-radius:8px;padding:2px 9px;font-family:var(--fm);font-weight:500;color:#fff;background:var(--ac)}
.shr .score.s-strong{background:var(--ok)}.shr .score.s-good{background:var(--ac2)}.shr .score.s-review{background:var(--warn)}.shr .score.s-weak,.shr .score.s-unscored{background:var(--mut)}
.shr .mustbox{border:2px dashed var(--bad);background:var(--badSoft);border-radius:13px;padding:14px;margin-top:14px}
.shr .mustbox h2{color:var(--bad)}
.shr details{margin-top:6px}.shr summary{cursor:pointer;color:var(--ac2);font-size:13px;font-weight:600}
.shr .back{margin-bottom:12px}
`;

export function shrAtsClient(env) {
  var h = env.h, call = env.call, frame = env.frame, flash = env.flash, pill = env.pill, errText = env.errText, state = env.state, render = env.render, empty = env.empty;
  var STAGE = { new: 'جديد', review: 'مراجعة', shortlist: 'قائمة قصيرة', interview: 'مقابلة', offer: 'عرض', hired: 'تعيين', rejected: 'مرفوض', future: 'للمستقبل' };
  var STAGE_ORDER = ['new', 'review', 'shortlist', 'interview', 'offer', 'hired', 'rejected', 'future'];
  var STAGE_TONE = { hired: 'ok', rejected: 'bad', offer: 'warn', future: 'mut' };
  var CONSENT = { active: ['موافقة سارية', 'ok'], withdrawn: ['موافقة مسحوبة', 'bad'], none: ['بلا موافقة', 'warn'] };
  var RES = { yes: 'قابلة للنقل', no: 'غير قابلة للنقل', unknown: 'غير معروف' };
  var STATUS = { MATCH: ['مطابق', 'ok'], PARTIAL_MATCH: ['جزئي', 'warn'], NO_MATCH: ['غير مطابق', 'bad'], UNKNOWN: ['غير معروف', 'mut'], NA: ['غير مطلوب', 'mut'] };
  var CAT = [['strong', 'مطابقة قوية'], ['good', 'مطابقة جيدة'], ['review', 'تحتاج مراجعة'], ['weak', 'ضعيفة'], ['unscored', 'بلا درجة (بيانات ناقصة)']];
  var MODE = { onsite: 'حضوري', video: 'مرئي', phone: 'هاتفي' };
  var IVSTATE = { requested: 'مطلوبة', scheduled: 'مجدولة', done: 'تمت', cancelled: 'ملغاة' };
  var fmtDate = function (s) { return s ? String(s).slice(0, 16).replace('T', ' ') : '—'; };
  var th = function (cols) { return h('thead', {}, [h('tr', {}, cols.map(function (x) { return h('th', {}, [x]); }))]); };
  function open(view, extra) { state.view = view; state.msg = ''; state.err = ''; for (var k in (extra || {})) state[k] = extra[k]; render(); }
  function candLink(c) { return h('a', { onclick: function () { open('candidate', { cid: c.id }); } }, [c.full_name]); }
  function consentPill(c) { var x = CONSENT[c.consent] || CONSENT.none; return pill(x[0], x[1]); }

  // --------------------------------------------------------------- jobs --
  function vJobs() {
    return call('jobs', null, true).then(function (o) {
      var rows = o.jobs || [];
      var f = { title: h('input', { class: 'inp', placeholder: 'عنوان الوظيفة (وهمي)' }), prof: h('input', { class: 'inp', placeholder: 'المهنة' }), city: h('input', { class: 'inp', placeholder: 'المدينة' }), yrs: h('input', { class: 'inp', type: 'number', min: '0', placeholder: 'سنوات الخبرة', style: 'width:120px' }),
        res: h('select', { class: 'inp' }, [h('option', { value: 'any' }, ['الإقامة: لا شرط']), h('option', { value: 'transferable' }, ['الإقامة: قابلة للنقل'])]),
        must: h('input', { class: 'inp', placeholder: 'شروط إلزامية (مفتاح أو مهارة، بفاصلة)' }) };
      var split = function (v) { return v.split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean); };
      var add = h('div', { class: 'shr-card' }, [h('h2', {}, ['وظيفة جديدة']), h('div', { class: 'frm' }, [f.title, f.prof, f.city, f.yrs, f.res, f.must,
        h('button', { class: 'btn', onclick: function () { call('job-create', { title: f.title.value, profession: f.prof.value, city: f.city.value, experience_years: f.yrs.value === '' ? null : Number(f.yrs.value), residency_required: f.res.value, must_have: split(f.must.value) }).then(function (r) { flash(r.ok, r.ok ? 'أُنشئت الوظيفة' : errText(r)); render(); }); } }, ['إنشاء'])]),
        h('p', { class: 'note' }, ['الشروط الإلزامية: profession · residency · experience · nationality · location · availability · skills أو اسم مهارة. من يفشل فيها يظهر في فئة منفصلة ولا يُحذف.'])]);
      var tb = h('table', {}, [th(['الوظيفة', 'المهنة', 'المدينة', 'الخبرة', 'الإقامة', 'الطلبات', 'الحالة', '']), h('tbody', {}, rows.map(function (j) {
        var acts = [h('button', { class: 'btn ghost', onclick: function () { open('match', { matchJob: j.id, autoMatch: true }); } }, ['طابق'])];
        if (j.status === 'open') acts.push(h('button', { class: 'btn ghost', onclick: function () { call('job-close', { id: j.id }).then(function (r) { flash(r.ok, r.ok ? 'أُغلقت الوظيفة' : errText(r)); render(); }); } }, ['إغلاق']));
        return h('tr', {}, [h('td', {}, [j.title]), h('td', {}, [j.profession || '—']), h('td', {}, [j.city || '—']), h('td', {}, [j.experience_years == null ? '—' : String(j.experience_years)]),
          h('td', {}, [j.residency_required === 'transferable' ? 'قابلة للنقل' : 'لا شرط']), h('td', {}, [String(j.applications) + (j.hired ? ' (تعيين ' + j.hired + ')' : '')]),
          h('td', {}, [pill(j.status === 'open' ? 'مفتوحة' : 'مغلقة', j.status === 'open' ? 'ok' : 'mut')]), h('td', {}, [h('div', { class: 'frm' }, acts)])]);
      }))]);
      frame('الوظائف', h('div', {}, [add, rows.length ? h('div', { class: 'shr-card scroll' }, [tb]) : empty('لا وظائف بعد', 'أنشئ أول وظيفة من النموذج أعلاه.')]));
    });
  }

  // -------------------------------------------------------------- board --
  function vBoard() {
    return Promise.all([call('applications', state.boardJob ? { job_id: state.boardJob } : null, true), call('jobs', null, true), call('candidates', null, true)]).then(function (res) {
      var apps = res[0].applications || [], jobs = res[1].jobs || [], cands = res[2].candidates || [];
      var local = h('p', { class: 'err' });
      var cols = {}, counts = {}, bodies = {};
      var board = h('div', { class: 'board' }, STAGE_ORDER.map(function (s) {
        var cnt = h('span', {}, ['0']), body = h('div', {});
        cols[s] = h('div', { class: 'col' }, [h('h3', {}, [h('b', {}, [STAGE[s]]), cnt]), body]);
        counts[s] = cnt; bodies[s] = body; return cols[s];
      }));
      function recount() { STAGE_ORDER.forEach(function (s) { counts[s].textContent = String(bodies[s].children.length); }); }
      function card(a) {
        var cur = a.stage;
        var sel = h('select', { class: 'inp' }, [h('option', { value: '' }, ['انقل إلى…'])].concat(STAGE_ORDER.map(function (s) { return h('option', { value: s }, [STAGE[s]]); })));
        var el = h('div', { class: 'kcard' }, [candLink(a.candidate), h('div', { class: 'sub' }, [[a.candidate.profession, a.candidate.nationality, a.candidate.city].filter(Boolean).join(' · ')]),
          h('div', { class: 'sub' }, ['الوظيفة: ' + (a.job.title || '—')]), a.interview ? pill('مقابلة ' + (IVSTATE[a.interview.state] || ''), 'warn') : null, sel]);
        sel.addEventListener('change', function () {
          var to = sel.value; sel.value = '';
          if (!to || to === cur) return;
          var from = cur;
          // تحريك متفائل ثم تراجع عند الفشل.
          el.classList.add('busy'); bodies[to].appendChild(el); cur = to; recount(); local.textContent = '';
          call('application-stage', { id: a.id, stage: to }).then(function (r) {
            el.classList.remove('busy');
            if (!r || !r.ok) { bodies[from].appendChild(el); cur = from; recount(); local.textContent = 'تعذّر النقل وأُعيدت البطاقة: ' + errText(r); }
            else { state.msg = ''; local.textContent = ''; }
          }).catch(function () { el.classList.remove('busy'); bodies[from].appendChild(el); cur = from; recount(); local.textContent = 'تعذّر الاتصال — أُعيدت البطاقة'; });
        });
        return el;
      }
      apps.forEach(function (a) { bodies[a.stage].appendChild(card(a)); });
      recount();
      var jsel = h('select', { class: 'inp', onchange: function () { state.boardJob = jsel.value || ''; render(); } }, [h('option', { value: '' }, ['كل الوظائف'])].concat(jobs.map(function (j) { var o = h('option', { value: j.id }, [j.title]); if (j.id === state.boardJob) o.selected = true; return o; })));
      var openJobs = jobs.filter(function (j) { return j.status === 'open'; });
      var aj = h('select', { class: 'inp' }, openJobs.map(function (j) { return h('option', { value: j.id }, [j.title]); }));
      var ac = h('select', { class: 'inp' }, cands.map(function (c) { return h('option', { value: c.id }, [c.full_name + ' — ' + (c.profession || '') + (c.consent === 'active' ? '' : ' (' + CONSENT[c.consent][0] + ')')]); }));
      var addApp = h('div', { class: 'shr-card' }, [h('h2', {}, ['إضافة طلب تقديم']), h('div', { class: 'frm' }, [aj, ac, h('button', { class: 'btn', onclick: function () { call('application-create', { job_id: aj.value, candidate_id: ac.value }).then(function (r) { flash(r.ok, r.ok ? 'أُضيف الطلب في «جديد»' : errText(r)); render(); }); } }, ['إضافة'])]),
        h('p', { class: 'note' }, ['لا يُقبل طلب لمرشح بلا موافقة سارية. التعيين = اعتماد العرض، ولا يعتمده من أدخل الطلب أو اقترح العرض.'])]);
      frame('مراحل المرشحين', h('div', {}, [h('div', { class: 'frm', style: 'margin-bottom:10px' }, [jsel]), local, board, addApp]));
    });
  }

  // ---------------------------------------------------------- candidate --
  function vCandidate() {
    return call('candidate', { id: state.cid }, true).then(function (o) {
      if (!o.ok) { state.err = errText(o); state.view = 'board'; return render(); }
      var c = o.candidate;
      var back = h('button', { class: 'btn ghost back', onclick: function () { open('board'); } }, ['رجوع إلى اللوحة']);
      var info = h('div', { class: 'shr-card' }, [h('h2', {}, [c.full_name]), h('div', { class: 'frm' }, [consentPill(c), pill('بيانات وهمية', 'mut'), pill(c.ref || '', 'mut')]),
        h('table', {}, [h('tbody', {}, [['المهنة', c.profession], ['الجنسية', c.nationality], ['المدينة', c.city], ['الخبرة', c.years_experience == null ? null : c.years_experience + ' سنة'],
          ['نقل الإقامة', RES[c.residency_transferable] || null], ['الانتقال', c.willing_to_relocate == null ? null : c.willing_to_relocate ? 'مستعد' : 'غير مستعد'],
          ['مدة الإشعار', c.notice_days == null ? null : c.notice_days + ' يوماً'], ['المهارات', (c.skills || []).join('، ') || null]].map(function (r) { return h('tr', {}, [h('th', {}, [r[0]]), h('td', {}, [r[1] || 'غير معروف'])]); }))])]);
      var cons = h('div', { class: 'shr-card' }, [h('h2', {}, ['سجل الموافقة']), o.consents.length ? h('table', {}, [th(['الصيغة', 'التاريخ', 'المصدر', 'السحب']), h('tbody', {}, o.consents.map(function (k) {
        return h('tr', {}, [h('td', {}, [k.text_version]), h('td', {}, [fmtDate(k.granted_at)]), h('td', {}, [k.source]), h('td', {}, [k.withdrawn_at ? pill('سُحبت ' + fmtDate(k.withdrawn_at), 'bad') : pill('سارية', 'ok')])]);
      }))]) : empty('لا سجل موافقة', 'لا يدخل المطابقة ولا يُقبل له طلب تقديم.')]);
      var apps = o.applications.map(function (a) {
        var when = h('input', { class: 'inp', type: 'datetime-local' }), mode = h('select', { class: 'inp' }, [h('option', { value: 'video' }, ['مرئي']), h('option', { value: 'onsite' }, ['حضوري']), h('option', { value: 'phone' }, ['هاتفي'])]);
        var ivs = a.interviews.map(function (iv) {
          var setter = iv.state === 'requested' || iv.state === 'scheduled' ? h('span', { class: 'frm' }, [when, h('button', { class: 'btn ghost', onclick: function () { if (!when.value) { flash(false, 'اختر الموعد'); return render(); } call('interview-set', { id: iv.id, scheduled_at: new Date(when.value).toISOString(), mode: mode.value }).then(function (r) { flash(r.ok, r.ok ? 'سُجّل الموعد (سجل داخلي، لم تُرسل رسالة)' : errText(r)); render(); }); } }, [iv.state === 'scheduled' ? 'غيّر الموعد' : 'حدّد الموعد'])]) : null;
          return h('li', {}, ['مقابلة ' + (IVSTATE[iv.state] || iv.state) + (iv.mode ? ' · ' + MODE[iv.mode] : '') + (iv.scheduled_at ? ' · ' + fmtDate(iv.scheduled_at) : '') + ' ', mode, setter]);
        });
        var canIv = a.stage !== 'hired' && a.stage !== 'rejected';
        return h('div', { class: 'shr-card' }, [h('h2', {}, [(a.job || 'وظيفة') + ' — ']), pill(STAGE[a.stage] || a.stage, STAGE_TONE[a.stage] || ''),
          h('ul', { class: 'tl' }, a.events.map(function (e) { return h('li', {}, [fmtDate(e.at) + ' — ' + (e.from_stage ? STAGE[e.from_stage] + ' ← ' : 'إدخال: ') + STAGE[e.to_stage] + (e.note ? ' (' + e.note + ')' : '')]); })),
          ivs.length ? h('ul', { class: 'tl' }, ivs) : null,
          canIv ? h('button', { class: 'btn ghost', onclick: function () { call('interview-request', { application_id: a.id, mode: 'video' }).then(function (r) { flash(r.ok, r.ok ? 'سُجّل طلب المقابلة (داخلي — لا رسالة)' : errText(r)); render(); }); } }, ['طلب مقابلة']) : null]);
      });
      frame('ملف المرشح', h('div', {}, [back, info, cons, h('h2', {}, ['طلبات التقديم'])].concat(apps.length ? apps : [empty('لا طلبات تقديم بعد', 'أضف طلباً من لوحة المرشحين.')])));
    });
  }

  // -------------------------------------------------------------- match --
  function resultRow(r) {
    var ex = h('table', {}, [th(['المكوّن', 'الوزن', 'الحالة', 'الدرجة', 'المساهمة', 'الشرح']), h('tbody', {}, r.explain.map(function (x) {
      var s = STATUS[x.status] || ['', ''];
      return h('tr', {}, [h('td', {}, [x.label]), h('td', {}, [x.weight + '%']), h('td', {}, [pill(s[0], s[1])]), h('td', {}, [x.score == null ? '—' : String(x.score)]), h('td', {}, [x.counted ? String(x.contribution) : '—']), h('td', {}, [x.note])]);
    }))]);
    return h('div', { class: 'kcard' }, [h('div', { class: 'frm' }, [h('span', { class: 'score s-' + r.category }, [r.overall == null ? '—' : String(r.overall)]), candLink(r.candidate),
      h('span', { class: 'sub' }, [[r.candidate.profession, r.candidate.nationality, r.candidate.city].filter(Boolean).join(' · ')])]),
      h('div', { class: 'sub' }, [r.summary]), h('details', {}, [h('summary', {}, ['شرح الدرجة']), h('div', { class: 'scroll' }, [ex])])]);
  }
  function vMatch() {
    return call('jobs', null, true).then(function (o) {
      var jobs = o.jobs || [];
      var sel = h('select', { class: 'inp' }, jobs.map(function (j) { var op = h('option', { value: j.id }, [j.title + (j.status === 'open' ? '' : ' (مغلقة)')]); if (j.id === state.matchJob) op.selected = true; return op; }));
      var out = h('div', {});
      function run() {
        out.innerHTML = ''; out.appendChild(h('p', { class: 'note' }, ['جارٍ المطابقة…']));
        call('match', { job_id: sel.value }).then(function (m) {
          out.innerHTML = '';
          if (!m.ok) { out.appendChild(h('p', { class: 'err' }, [errText(m)])); return; }
          var by = {}; m.results.forEach(function (r) { by[r.candidate_id] = r; });
          out.appendChild(h('p', { class: 'note' }, ['طُوبق ' + m.results.length + ' مرشحاً بموافقة سارية. استُبعد من العملية: ' + m.excluded.no_consent + ' بلا سجل موافقة و' + m.excluded.withdrawn + ' سحبوا موافقتهم. الإصدار ' + m.version + ' — المجهول لا يستبعد أحداً.']));
          CAT.forEach(function (c) {
            var ids = m.buckets[c[0]]; if (!ids.length) return;
            out.appendChild(h('div', { class: 'shr-card' }, [h('h2', {}, [c[1] + ' (' + ids.length + ')'])].concat(ids.map(function (id) { return resultRow(by[id]); }))));
          });
          var miss = m.buckets.must_have_miss;
          if (miss.length) out.appendChild(h('div', { class: 'mustbox' }, [h('h2', {}, ['ينقصهم شرط إلزامي (' + miss.length + ') — مفصولون عن النتائج ومعروضون للمراجعة'])].concat(miss.map(function (id) { return resultRow(by[id]); }))));
        }).catch(function () { out.innerHTML = ''; out.appendChild(h('p', { class: 'err' }, ['تعذّر الاتصال'])); });
      }
      sel.addEventListener('change', function () { state.matchJob = sel.value; });
      frame('المطابقة', h('div', {}, [h('div', { class: 'shr-card' }, [h('div', { class: 'frm' }, [sel, h('button', { class: 'btn', onclick: function () { state.matchJob = sel.value; run(); } }, ['شغّل المطابقة'])]),
        h('p', { class: 'note' }, ['مرشحون وهميون فقط. الدرجة موزونة ومشروحة مكوّناً مكوّناً؛ لا رقم غامض.'])]), out]));
      if (state.autoMatch) { state.autoMatch = false; run(); }
    });
  }

  return { jobs: vJobs, board: vBoard, candidate: vCandidate, match: vMatch };
}
