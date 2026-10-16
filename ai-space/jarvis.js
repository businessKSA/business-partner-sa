/* وحدة جارفس داخل BP AI Space: شبكة الفريق، النبض، «يحتاجونك»، فحص فرح،
 * وأصوات المدراء. تعتمد على window.BPSpace من app.js وتمرّ كلها عبر /api/bp/*؛
 * لا مسار ويبهوك ولا مفتاح هنا. عطلها لا يُسقط الأساس (app.js مستقل). */
(function () {
  'use strict';
  var BP = window.BPSpace;
  if (!BP) return;
  var CFG = window.BP_SPACE_CONFIG || {};
  var BASE = CFG.apiBase || '/api/bp';
  var PULSE_MS = CFG.pulseMs === 0 ? 0 : (CFG.pulseMs || 30000);

  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';

  // معرّفات assigned_to_agent في جدول المهام -> معرّف العقدة هنا.
  var PULSE_MAP = {
    farah_chief_of_staff: 'farah', chief_of_staff: 'farah', farah: 'farah',
    abdulrahman_cfo: 'abdulrahman', abdulrahman_finance: 'abdulrahman', badr_sales: 'badr',
    abdulaziz_legal: 'abdulaziz', mazen_ops: 'mazen', mishari_compliance: 'mishari',
    nasser_hr: 'nasser', abdullah_procurement: 'abdullah', mohammed_it: 'mohammed',
    website_funnel_ops: 'salman', ahmed_strategy: 'ahmed', farah_marketing: 'sara',
    sara_marketing: 'sara', tariq_realestate: 'tariq', alaa_news: 'alaa',
    deals_revenue_ops: 'wissam', bandar_recruitment: 'bandar', malak: 'malak',
    malak_assistant: 'malak', baher_front_desk: 'baher', virtual_baher: 'baher'
  };

  // صوت Azure Neural لكل مدير: [الصوت، النبرة، السرعة].
  var VOICES = {
    farah: ['ar-SA-ZariyahNeural', '+0%', '+0%'], sara: ['ar-AE-FatimaNeural', '+3%', '+4%'],
    malak: ['ar-QA-AmalNeural', '+2%', '+6%'], alaa: ['ar-BH-LailaNeural', '+0%', '-3%'],
    badr: ['ar-SA-HamedNeural', '+4%', '+0%'], salman: ['ar-AE-HamdanNeural', '+0%', '+3%'],
    mohammed: ['ar-QA-MoazNeural', '+3%', '-2%'], abdulrahman: ['ar-BH-AliNeural', '-3%', '-4%'],
    mazen: ['ar-KW-FahedNeural', '+2%', '+0%'], nasser: ['ar-OM-AbdullahNeural', '+0%', '-2%'],
    abdulaziz: ['ar-SA-HamedNeural', '-4%', '-6%'], mishari: ['ar-AE-HamdanNeural', '-2%', '-3%'],
    abdullah: ['ar-KW-FahedNeural', '+0%', '+5%'], ahmed: ['ar-QA-MoazNeural', '-3%', '+3%'],
    tariq: ['ar-BH-AliNeural', '+3%', '+4%'], bandar: ['ar-OM-AbdullahNeural', '+4%', '+4%'],
    wissam: ['ar-SA-HamedNeural', '+0%', '+6%'], baher: ['ar-SA-HamedNeural', '-2%', '+2%']
  };

  var AGENTS = [
    { id: 'farah', slug: '', name: 'فرح', role: 'رئيسة المكتب التنفيذي', team: 'تدير المديرين كلهم', keys: ['فرح'] },
    { id: 'salman', slug: 'website-funnel-ops', name: 'سلمان', role: 'مدير المنتج', team: 'لمى · جنى · وليد', keys: ['سلمان'] },
    { id: 'badr', slug: 'badr-intake', name: 'بدر', role: 'المبيعات وتطوير الأعمال', team: 'خالد · فيصل · نواف · تركي · عمر · عبدالإله · ياسر', keys: ['بدر'] },
    { id: 'sara', slug: 'farah-intake', name: 'سارة', role: 'النمو والتسويق', team: 'ريم · ليان · نور · جود · دانا · راكان', keys: ['سارة'] },
    { id: 'mohammed', slug: 'mohammed-intake', name: 'محمد', role: 'تقنية المعلومات والهندسة', team: 'زياد · رامي · سيف · أنس · مروان · يزن', keys: ['محمد'] },
    { id: 'abdulrahman', slug: 'abdulrahman-intake', name: 'عبدالرحمن', role: 'المدير المالي', team: 'رنا · فهد · مها · يوسف', keys: ['عبدالرحمن', 'المالية'] },
    { id: 'mazen', slug: 'mazen-intake', name: 'مازن', role: 'العمليات والتسليم', team: 'هتان · رائد · طلال · مشعل', keys: ['مازن'] },
    { id: 'nasser', slug: 'nasser-intake', name: 'ناصر', role: 'الموارد البشرية والتوظيف', team: 'هدى · أروى · غادة · فواز (داخلي فقط)', keys: ['ناصر'] },
    { id: 'abdulaziz', slug: 'abdulaziz-intake', name: 'عبدالعزيز', role: 'المدير القانوني', team: 'سمر · لؤي · هلا', keys: ['عبدالعزيز', 'القانوني'] },
    { id: 'mishari', slug: 'mishari-intake', name: 'مشاري', role: 'الامتثال والعلاقات الحكومية', team: 'عادل · زيد · نجلاء', keys: ['مشاري'] },
    { id: 'abdullah', slug: 'ahmed-procurement', name: 'عبدالله', role: 'المشتريات', team: 'سامي · معاذ · نورة', keys: ['عبدالله'] },
    { id: 'ahmed', slug: 'strategy-intake', name: 'أحمد', role: 'الاستراتيجية وPMO', team: 'باسل · هيا', keys: ['أحمد'] },
    { id: 'malak', slug: 'malak-intake', name: 'ملاك', role: 'المساعِدة التنفيذية', team: 'تعمل منفردة', keys: ['ملاك'] },
    { id: 'tariq', slug: 'realestate-intake', name: 'طارق', role: 'العقارات', team: 'بشائر · منيرة · عبدالوهاب', keys: ['طارق'] },
    { id: 'bandar', slug: 'recruitment-intake', name: 'بندر', role: 'منتجات الاستقدام (PEO/EOR، عمالة مسندة)', team: 'شهد · إياد · لينا · راشد', keys: ['بندر'] },
    { id: 'alaa', slug: 'news-intake', name: 'آلاء', role: 'الأخبار والمحتوى التنظيمي', team: 'رهف · تميم', keys: ['آلاء'] },
    { id: 'wissam', slug: 'deals-intake', name: 'وسام', role: 'مكتب الصفقات (قراءة وتصعيد فقط)', team: 'جواهر · فارس', keys: ['وسام'] },
    { id: 'baher', slug: '', name: 'باهر Front Desk', role: 'واجهة شات الموقع العام', team: 'يوجّه الزوار للإدارات', keys: ['باهر'] }
  ];

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function byId(id) { return AGENTS.filter(function (a) { return a.id === id; })[0]; }
  function teamOf(a) {
    return (a.team || '').split('·').map(function (s) { return s.trim(); })
      .filter(function (s) { return s && !/^(تدير|تعمل|يوجّه)/.test(s); });
  }

  /* ---------- التوجيه: كل مدير يُنادى عبر فرح بنص الطلب نفسه ---------- */
  function routeFor(a) {
    var v = VOICES[a.id] || VOICES.farah;
    return {
      target_agent: a.slug || a.id,
      voice: { voice: v[0], rate: v[1], pitch: v[2] },
      message: function (text) {
        if (a.id === 'baher') return 'هذا طلب موجّه لباهر Front Desk (واجهة الموقع). أجيبي كما لو أنك تراجعين ما سيقوله للزائر.\n\nالطلب: ' + text;
        if (a.slug) return 'وجّهي هذا الطلب إلى ' + a.name + ' (' + a.slug + ') عبر Consult Executive Team وأعيدي لي رده كاملاً كما هو، ثم أضيفي رأيك في سطر واحد إن لزم.\n\nالطلب: ' + text;
        return text;
      }
    };
  }
  AGENTS.forEach(function (a) { BP.routes['jv:' + a.id] = routeFor(a); });

  var selected = 'farah';
  var nodeEls = {}, linkEls = {}, chordEls = {};
  var CX = 500, CY = 350, R = 300;

  function renderMap() {
    var svg = $('webMap');
    svg.textContent = '';
    nodeEls = {}; linkEls = {}; chordEls = {};
    var ring = AGENTS.filter(function (a) { return a.id !== 'farah'; });
    var n = ring.length;
    var gw = el('g', {}, svg), gl = el('g', {}, svg), gn = el('g', {}, svg);
    [0.33, 0.66, 1].forEach(function (k) {
      el('ellipse', { 'class': 'jv-web', cx: CX, cy: CY, rx: R * 1.35 * k, ry: R * 0.86 * k }, gw);
    });
    ring.forEach(function (a, i) {
      var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var x = CX + Math.cos(ang) * R * 1.35, y = CY + Math.sin(ang) * R * 0.86;
      a._x = x; a._y = y;
      var mx = (CX + x) / 2 + Math.cos(ang + Math.PI / 2) * 18, my = (CY + y) / 2 + Math.sin(ang + Math.PI / 2) * 18;
      linkEls[a.id] = el('path', { d: 'M' + CX + ',' + CY + ' Q' + mx + ',' + my + ' ' + x + ',' + y, 'class': 'jv-link' }, gl);
      var g = el('g', { 'class': 'jv-node', transform: 'translate(' + x + ',' + y + ')', tabindex: 0, role: 'button' }, gn);
      nodeEls[a.id] = g;
      el('circle', { 'class': 'jv-core', r: 27 }, g);
      el('text', { 'class': 'init', y: 6 }, g).textContent = a.name.slice(0, 1);
      el('text', { y: 46 }, g).textContent = a.name;
      el('text', { 'class': 'sub', y: 60 }, g).textContent = a.role.length > 26 ? a.role.slice(0, 25) + '…' : a.role;
      el('text', { 'class': 'cnt', x: -24, y: -22 }, g).textContent = '';
      var team = teamOf(a);
      team.forEach(function (m, j) {
        var sa = -Math.PI / 2 + (j / Math.max(team.length, 1)) * Math.PI * 2;
        var c = el('circle', { 'class': 'sat', cx: Math.cos(sa) * 37, cy: Math.sin(sa) * 37, r: 3.4 }, g);
        el('title', {}, c).textContent = m;
      });
      g.addEventListener('click', function () { select(a.id); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(a.id); } });
    });
    // كل إدارة تستشير كل إدارة: الخيوط بين الجميع، وتُضاء عند تعاون فعلي في الرد.
    for (var i = 0; i < ring.length; i++) for (var j = i + 1; j < ring.length; j++) {
      var p = ring[i], q = ring[j];
      var c = el('path', { d: 'M' + p._x + ',' + p._y + ' Q' + CX + ',' + CY + ' ' + q._x + ',' + q._y, 'class': 'jv-chord' }, gw);
      chordEls[p.id + '|' + q.id] = c; chordEls[q.id + '|' + p.id] = c;
    }
    var f = el('g', { 'class': 'jv-node jv-center', transform: 'translate(' + CX + ',' + CY + ')', tabindex: 0, role: 'button' }, gn);
    nodeEls.farah = f;
    el('circle', { r: 50 }, f);
    el('text', { y: -2 }, f).textContent = 'فرح';
    el('text', { 'class': 'sub', y: 14 }, f).textContent = 'رئيسة المكتب التنفيذي';
    f.addEventListener('click', function () { select('farah'); });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select('farah'); } });
    applySel();
  }

  function applySel() {
    Object.keys(nodeEls).forEach(function (id) {
      nodeEls[id].classList.toggle('sel', id === selected);
      if (linkEls[id]) linkEls[id].classList.toggle('sel', id === selected);
    });
  }
  function select(id) {
    selected = id;
    var a = byId(id);
    BP.setTarget('jv:' + id, id === 'farah' ? 'فرح (رئيسة المكتب)' : 'فرح ← ' + a.name);
    applySel(); renderWho();
    try { $('input').focus(); } catch (e) {}
  }
  function setWork(id, on) {
    var g = nodeEls[id]; if (!g) return;
    g.classList.toggle('busy', on);
    if (linkEls[id]) linkEls[id].classList.toggle('busy', on);
  }

  /* ---------- النبض ---------- */
  var lastPulse = null;
  function pulseFor(id) {
    if (!lastPulse || !lastPulse.agents) return null;
    var keys = Object.keys(lastPulse.agents);
    for (var i = 0; i < keys.length; i++) {
      if ((PULSE_MAP[keys[i]] || PULSE_MAP[keys[i].toLowerCase()]) === id) return lastPulse.agents[keys[i]];
    }
    return null;
  }
  function renderWho() {
    var a = byId(selected) || AGENTS[0], p = pulseFor(a.id);
    var box = $('whoCard'); box.textContent = '';
    var h = document.createElement('h3'); h.textContent = a.name + (a.id === 'farah' ? '' : ' ← عبر فرح'); box.appendChild(h);
    var r = document.createElement('div'); r.textContent = a.role; box.appendChild(r);
    var t = document.createElement('div'); t.className = 'team';
    (a.team || '').split('·').forEach(function (m) { m = m.trim(); if (!m) return; var s = document.createElement('span'); s.textContent = m; t.appendChild(s); });
    box.appendChild(t);
    var l = document.createElement('div');
    l.textContent = p ? (p.open || 0) + ' مهمة مفتوحة · ' + (p.in_progress || 0) + ' قيد التنفيذ' + (p.latest_objective ? ' · آخر مهمة: ' + p.latest_objective : '') : 'لا بيانات نبض بعد';
    box.appendChild(l);
  }
  function pill(id, cls, txt) { $(id).className = 'pill ' + cls; }

  function pulse() {
    return fetch(BASE + '/pulse', { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 503) throw new Error('غير مُعدّ بعد (BP_PATH_PULSE)');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.agents) throw new Error('رد بلا بيانات');
        lastPulse = d;
        AGENTS.forEach(function (a) {
          var p = pulseFor(a.id), g = nodeEls[a.id]; if (!g) return;
          var busy = !!(p && (p.in_progress || 0) > 0);
          g.classList.toggle('busy', busy || (BP.isBusy() && (a.id === 'farah' || selected === a.id)));
          if (linkEls[a.id]) linkEls[a.id].classList.toggle('busy', busy);
          g.classList.toggle('paused', !!(p && (p.enabled === false || p.status === 'paused')));
          var cnt = g.querySelector('.cnt'); if (cnt) cnt.textContent = p && p.open ? String(p.open) : '';
        });
        var t = d.totals || {};
        $('pulseTxt').textContent = 'نبض: ' + (t.in_progress || 0) + ' يعمل · ' + (t.open || 0) + ' مفتوحة';
        pill('pulsePill', 'ok');
        renderNeeds(d.needs_owner || []);
        renderWho();
      })
      .catch(function (e) {
        $('pulseTxt').textContent = 'النبض متوقف: ' + (e.message || e);
        pill('pulsePill', 'bad');
      });
  }

  /* ---------- يحتاجونك ---------- */
  function renderNeeds(list) {
    var box = $('needsList'); box.textContent = '';
    $('needsSub').textContent = list.length ? list.length + ' بانتظارك' : 'لا شيء';
    if (!list.length) {
      var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'ما عليك شيء الآن — الفريق ماسكها.'; box.appendChild(e); return;
    }
    list.forEach(function (t) {
      var d = document.createElement('div'); d.className = 'need';
      var b = document.createElement('b'); b.textContent = t.objective || t.task_id; d.appendChild(b);
      var p = document.createElement('p'); p.textContent = t.next_action || ''; d.appendChild(p);
      var s = document.createElement('small'); s.textContent = [t.task_id, t.priority || '', 'من ' + (t.created_by || '—')].join(' · '); d.appendChild(s);
      var act = document.createElement('div'); act.className = 'act';
      var done = document.createElement('button'); done.type = 'button'; done.textContent = 'خلصت ✓';
      done.onclick = function () {
        select('farah');
        BP.ask('خلصت المهمة ' + t.task_id + ' (' + String(t.objective || '').slice(0, 60) + '). أغلقيها بـ Complete Human Task، فكّي أي Human Gate مرتبطة، واستأنفي الفريق، وقولي لي وش الخطوة التالية عندهم.');
      };
      var ask = document.createElement('button'); ask.type = 'button'; ask.textContent = 'اسألي فرح عنها';
      ask.onclick = function () {
        select('farah');
        BP.ask('اشرحي لي المهمة ' + t.task_id + ' باختصار: وش المطلوب مني بالضبط وليش، وما البديل لو ما سويتها؟');
      };
      act.appendChild(done); act.appendChild(ask); d.appendChild(act); box.appendChild(d);
    });
  }

  /* ---------- فحص فرح ---------- */
  function health() {
    pill('farahPill', 'busy'); $('farahTxt').textContent = 'يفحص…';
    var t0 = Date.now();
    return fetch(BASE + '/health', { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 503) throw new Error('غير مُعدّ بعد (BP_PATH_HEALTH)');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().catch(function () { return {}; });
      })
      .then(function (d) {
        if (!(d.reply || d.output || d.ok)) throw new Error('رد بلا محتوى');
        pill('farahPill', 'ok'); $('farahTxt').textContent = 'فرح: حيّة · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' ث';
      })
      .catch(function (e) { pill('farahPill', 'bad'); $('farahTxt').textContent = 'فرح: لا ترد · ' + (e.message || e); });
  }

  /* ---------- تبديل العرض ---------- */
  function showView(v) {
    var web = v === 'web';
    $('webView').hidden = !web;
    $('orbit').hidden = web;
    var vc = $('valueChain'); if (vc) vc.hidden = web;
    Array.prototype.forEach.call(document.querySelectorAll('.viewsw button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    try { localStorage.setItem('bp.space.view', v); } catch (e) {}
  }

  /* إضاءة الخيوط بين المدراء المذكورين في آخر رد (كما في جارفس). */
  function lightChords() {
    var msgs = document.querySelectorAll('#msgs .msg.ai');
    var last = msgs[msgs.length - 1]; if (!last) return;
    var text = last.textContent || '';
    var hits = AGENTS.filter(function (a) { return a.id !== 'farah' && a.keys.some(function (k) { return text.indexOf(k) !== -1; }); });
    hits.forEach(function (a) { setWork(a.id, true); setTimeout(function () { setWork(a.id, false); }, 2500); });
    for (var i = 0; i < hits.length; i++) for (var j = i + 1; j < hits.length; j++) {
      var c = chordEls[hits[i].id + '|' + hits[j].id];
      if (c) { c.classList.add('hot'); (function (x) { setTimeout(function () { x.classList.remove('hot'); }, 4000); })(c); }
    }
  }

  var wasBusy = false;
  setInterval(function () {
    var b = BP.isBusy();
    setWork('farah', b);
    if (selected !== 'farah') setWork(selected, b);
    if (wasBusy && !b) lightChords();
    wasBusy = b;
  }, 600);

  /* ---------- تشغيل ---------- */
  renderMap(); renderWho();
  Array.prototype.forEach.call(document.querySelectorAll('.viewsw button'), function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });
  $('btnHealth').addEventListener('click', health);
  var saved = 'orbit';
  try { saved = localStorage.getItem('bp.space.view') || 'orbit'; } catch (e) {}
  showView(saved === 'web' ? 'web' : 'orbit');

  pulse();
  if (PULSE_MS) {
    var timer = setInterval(pulse, PULSE_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearInterval(timer); timer = null; }
      else if (!timer) { pulse(); timer = setInterval(pulse, PULSE_MS); }
    });
  }
})();
