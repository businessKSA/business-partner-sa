/* BP AI Command Space — one runtime for the dashboard and the conversation.
 * Data comes from n8n (read-only JSON API); the chat posts to the same
 * Virtual Baher endpoint whether the words were typed or spoken. */
(function () {
  'use strict';

  var CFG = window.BP_SPACE_CONFIG || {};
  var API = {
    data: (CFG.n8n || '') + (CFG.dataPath || ''),
    chat: (CFG.n8n || '') + (CFG.chatPath || ''),
    action: (CFG.n8n || '') + (CFG.actionPath || ''),
    voice: CFG.voicePath ? (CFG.n8n || '') + CFG.voicePath : '',
    stt: CFG.sttPath ? (CFG.n8n || '') + CFG.sttPath : ''
  };
  var CHAT_TIMEOUT = CFG.chatTimeoutMs || 150000;
  var REFRESH_MS = CFG.refreshMs === 0 ? 0 : (CFG.refreshMs || 45000);

  /* ---------- department canon (merged with the live registry) ---------- */
  var DEPTS = [
    { id: 'farah_marketing',      ar: 'فرح',       dept: 'التسويق والنمو',        en: 'Marketing & Growth', icon: '🎯', c: '#d946ef', chain: 1 },
    { id: 'badr_sales',           ar: 'بدر',       dept: 'المبيعات وتطوير الأعمال', en: 'Sales & BD',         icon: '📈', c: '#22d3ee', chain: 2 },
    { id: 'abdulaziz_legal',      ar: 'عبدالعزيز', dept: 'القانوني',              en: 'Legal',              icon: '⚖️', c: '#c084fc', chain: 3 },
    { id: 'abdulrahman_finance',  ar: 'عبدالرحمن', dept: 'المالية',               en: 'Finance',            icon: '💰', c: '#fbbf24', chain: 4 },
    { id: 'mazen_ops',            ar: 'مازن',      dept: 'العمليات',              en: 'Operations',         icon: '⚙️', c: '#60a5fa', chain: 5 },
    { id: 'mohammed_it',          ar: 'محمد',      dept: 'تقنية المعلومات',       en: 'IT & Engineering',   icon: '💻', c: '#38bdf8' },
    { id: 'nasser_hr',            ar: 'ناصر',      dept: 'الموارد البشرية',       en: 'People & HR',        icon: '👥', c: '#2dd4bf' },
    { id: 'mishari_compliance',   ar: 'مشاري',     dept: 'الامتثال والمنصات',     en: 'Compliance & GRO',   icon: '🛡️', c: '#34d399' },
    { id: 'abdullah_procurement', ar: 'عبدالله',   dept: 'المشتريات',             en: 'Procurement',        icon: '📦', c: '#f472b6' },
    { id: 'website_funnel_ops',   ar: 'الموقع والفانل', dept: 'المنتج الرقمي',    en: 'Digital Operations', icon: '🧩', c: '#f59e0b' },
    { id: 'ahmed_strategy',       ar: 'أحمد',      dept: 'الاستراتيجية و PMO',    en: 'Strategy & PMO',     icon: '🧠', c: '#06b6d4' }
  ];
  var CHIEF = 'chief_of_staff';

  var OFF = ['paused', 'disabled', 'maintenance', 'offline', 'stopped'];
  var OPEN_TASK = ['queued', 'in_progress', 'waiting', 'blocked'];
  var CLOSED_DEAL = ['delivered', 'lost', 'cancelled', 'canceled'];
  var READY_INT = ['ready', 'connected', 'live', 'ok', 'active'];

  /* ---------- tiny helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function low(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function num(v) { return Number(v || 0) || 0; }
  function money(v) { return num(v).toLocaleString('en-US'); }
  function when(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return 'قبل ' + mins + ' د';
    if (mins < 1440) return 'قبل ' + Math.round(mins / 60) + ' س';
    return 'قبل ' + Math.round(mins / 1440) + ' ي';
  }
  function isOn(a) { return a && a.enabled !== false && OFF.indexOf(low(a.status)) === -1; }

  /* ---------- state ---------- */
  var DATA = { agents: [], tasks: [], deals: [], kpis: [], campaigns: [], integrations: [] };
  var index = {};          // agent_id -> registry row
  var target = 'virtual_baher';
  var targetName = 'كل الشركة';
  var busy = false;

  /* =====================================================================
     1. DATA
     ===================================================================== */
  function loadData(manual) {
    var btn = $('btnRefresh');
    btn.classList.add('spin');
    var ctl = new AbortController();
    var tm = setTimeout(function () { ctl.abort(); }, 30000);

    return fetch(API.data, { signal: ctl.signal, cache: 'no-store' })
      .then(function (r) {
        clearTimeout(tm);
        return r.text().then(function (raw) {
          if (!r.ok) throw new Error('الخادم رجّع HTTP ' + r.status + (raw ? ' · ' + raw.slice(0, 140) : ''));
          if (!raw.trim()) throw new Error('الخادم رجّع ردًا فارغًا');
          try { return JSON.parse(raw); }
          catch (e) { throw new Error('رد غير صالح من الخادم · ' + raw.slice(0, 140)); }
        });
      })
      .then(function (j) {
        var body = Array.isArray(j) ? (j[0] || {}) : j;
        DATA = {
          agents: body.agents || [],
          tasks: body.tasks || [],
          deals: body.deals || [],
          kpis: body.kpis || [],
          campaigns: body.campaigns || [],
          integrations: body.integrations || []
        };
        index = {};
        DATA.agents.forEach(function (a) { if (a && a.agent_id) index[a.agent_id] = a; });
        note('', 'data');
        renderAll(body.generated_at);
      })
      .catch(function (e) {
        note('تعذر تحميل بيانات اللوحة: ' + (e.name === 'AbortError' ? 'انتهت المهلة (٣٠ ثانية)' : (e.message || e)), 'data');
        if (manual) addMsg('تعذر تحميل البيانات: ' + (e.message || e), 'sys');
      })
      .then(function () { btn.classList.remove('spin'); });
  }

  /* The 45s data refresh used to clear the banner a moment after speak() or the
   * microphone wrote a reason into it, so the reason flashed and vanished. A
   * clear now only lands if it comes from whoever wrote the message. */
  var noteOwner = '';
  function note(t, owner) {
    var n = $('linkLine');
    owner = owner || '';
    if (!t) {
      if (noteOwner && owner && noteOwner !== owner) return;
      n.hidden = true; n.textContent = ''; noteOwner = '';
      return;
    }
    noteOwner = owner;
    n.hidden = false;
    n.textContent = '⚠️ ' + t;
  }

  /* ---------- derived ---------- */
  function openTasks() {
    return DATA.tasks.filter(function (t) { return OPEN_TASK.indexOf(low(t.status)) !== -1; });
  }
  function tasksOf(id) {
    return openTasks().filter(function (t) { return t.assigned_to_agent === id; });
  }
  function activeDeals() {
    return DATA.deals.filter(function (d) { return CLOSED_DEAL.indexOf(low(d.stage)) === -1; });
  }
  function dealsOf(id) {
    return DATA.deals.filter(function (d) {
      return d.owner_agent === id || d.assigned_to_agent === id || d.created_by_agent === id;
    });
  }
  function teamOf(id) {
    var head = index[id] || {};
    var canon = DEPTS.filter(function (d) { return d.id === id; })[0];
    return DATA.agents.filter(function (a) {
      if (a.agent_id === id) return false;
      var rt = a.reports_to;
      if (!rt) return false;
      return rt === id || (head.agent_name && rt === head.agent_name) || (canon && rt === canon.ar);
    });
  }
  function deptValue(id) {
    return dealsOf(id).reduce(function (s, d) { return s + num(d.deal_value || d.quoted_amount); }, 0);
  }

  /* =====================================================================
     2. RENDER
     ===================================================================== */
  function renderAll(stamp) {
    renderStats();
    renderOrbs();
    renderChain();
    renderTasks();
    renderDeals();
    renderIntegrations();
    $('mapSub').textContent = DATA.agents.length + ' وكيل · آخر قراءة ' + when(stamp || new Date().toISOString());
    var chief = index[CHIEF];
    $('coreState').textContent = chief
      ? (chief.agent_name || 'رئيس الديوان') + ' · ' + (chief.status || '—')
      : 'اضغط للتحدّث للشركة كلها';
  }

  function renderStats() {
    var open = openTasks();
    var human = open.filter(function (t) {
      return t.human_action_required === true || t.human_action_required === 'true' || t.assigned_to_agent === 'baher_owner';
    });
    var on = DATA.agents.filter(isOn).length;
    var noReg = departments().filter(function (d) { return !index[d.id]; }).length;
    var pipeline = activeDeals().reduce(function (s, d) { return s + num(d.deal_value || d.quoted_amount); }, 0);
    var collected = DATA.deals.reduce(function (s, d) { return s + num(d.paid_amount); }, 0);
    var blocked = DATA.deals.filter(function (d) {
      return num(d.paid_amount) > 0 && ['completed', 'delivered'].indexOf(low(d.execution_status)) === -1;
    });
    var ready = DATA.integrations.filter(function (i) {
      return READY_INT.indexOf(low(i.status || i.readiness)) !== -1;
    });

    var cells = [
      { k: 'الوكلاء يعملون', v: on + ' / ' + DATA.agents.length, cls: on ? 'good' : 'bad' },
      { k: 'مهام مفتوحة', v: open.length, cls: '' },
      { k: 'تنتظرك أنت', v: human.length, cls: human.length ? 'warn' : 'good' },
      { k: 'خط الصفقات (ر.س)', v: money(pipeline), cls: '' },
      { k: 'محصّل (ر.س)', v: money(collected), cls: 'good' },
      { k: 'مدفوع ومتوقف', v: blocked.length, cls: blocked.length ? 'bad' : 'good' },
      { k: 'روابط جاهزة', v: ready.length + ' / ' + DATA.integrations.length, cls: '' },
      { k: 'حملات نمو', v: DATA.campaigns.length, cls: '' },
      { k: 'أقسام بلا سجل', v: noReg, cls: noReg ? 'bad' : 'good' }
    ];
    var box = $('tbStats');
    box.textContent = '';
    cells.forEach(function (c) {
      var d = el('div', 'stat ' + c.cls);
      d.appendChild(el('small', '', c.k));
      d.appendChild(el('b', '', String(c.v)));
      box.appendChild(d);
    });
  }

  function departments() {
    // canon first, then any department head found in the registry but not in the canon
    var seen = {};
    var list = DEPTS.map(function (d) {
      seen[d.id] = 1;
      return d;
    });
    DATA.agents.forEach(function (a) {
      if (!a.agent_id || seen[a.agent_id]) return;
      if (a.reports_to && a.reports_to !== 'baher_owner' && a.reports_to !== 'virtual_baher') return;
      seen[a.agent_id] = 1;
      list.push({
        id: a.agent_id, ar: a.agent_name || a.agent_id, dept: a.department || a.role || '',
        en: a.department_en || '', icon: '🤖', c: '#7dd3fc'
      });
    });
    return list;
  }

  function renderOrbs() {
    var host = $('orbs');
    host.textContent = '';
    var list = departments();
    var box = $('orbit').getBoundingClientRect();
    var narrow = box.width < 760;
    // On phones the orbs are laid out by CSS grid, so skip the polar coordinates
    // entirely rather than writing inline left/top the stylesheet has to undo.
    var stacked = window.matchMedia('(max-width:900px)').matches;
    list.forEach(function (d, i) {
      var a = index[d.id] || {};
      var b = el('button', 'orb' + (isOn(a) ? '' : ' off') + (index[d.id] ? '' : ' noreg'));
      b.type = 'button';
      b.style.setProperty('--c', d.c);
      if (!stacked) {
        var ang = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        var rx = narrow ? 36 : 38, ry = narrow ? 38 : 36;
        b.style.left = (50 + Math.cos(ang) * rx) + '%';
        b.style.top = (50 + Math.sin(ang) * ry) + '%';
      }
      var ic = el('span', 'oi', d.icon);
      ic.appendChild(el('span', 'dot'));
      b.appendChild(ic);
      var tx = el('span', 'otxt');
      tx.appendChild(el('b', '', d.ar + ' — ' + d.dept));
      tx.appendChild(el('small', '', d.en || a.role || ''));
      tx.appendChild(el('em', '', index[d.id]
        ? tasksOf(d.id).length + ' مهمة · ' + (a.status || 'نشط')
        : tasksOf(d.id).length + ' مهمة · لا سجل'));
      b.appendChild(tx);
      b.addEventListener('click', function () { openDept(d.id); });
      host.appendChild(b);
    });
  }

  function renderChain() {
    var host = $('valueChain');
    host.textContent = '';
    var chain = DEPTS.filter(function (d) { return d.chain; })
      .sort(function (a, b) { return a.chain - b.chain; });
    chain.forEach(function (d, i) {
      if (i) host.appendChild(el('span', 'vc-arrow', '←'));
      var a = index[d.id] || {};
      var b = el('button', 'vc');
      b.type = 'button';
      b.style.borderColor = d.c;
      b.appendChild(el('b', '', d.icon + ' ' + d.dept));
      b.appendChild(el('small', '', tasksOf(d.id).length + ' مهمة · ' + money(deptValue(d.id)) + ' ر.س · ' + (isOn(a) ? 'نشط' : 'متوقف')));
      b.addEventListener('click', function () { openDept(d.id); });
      host.appendChild(b);
    });
  }

  function renderTasks() {
    var list = openTasks();
    $('taskSub').textContent = list.length + ' مهمة';
    var host = $('taskList');
    host.textContent = '';
    if (!list.length) { host.appendChild(el('div', 'empty', 'لا توجد مهام مفتوحة')); return; }
    list.slice(0, 40).forEach(function (t) {
      var r = el('div', 'row');
      r.appendChild(el('span', 'tag ' + (t.priority || 'P2'), t.priority || 'P2'));
      var mid = el('div');
      mid.appendChild(el('b', '', t.objective || 'مهمة بلا عنوان'));
      mid.appendChild(el('small', '', (t.client_name || 'داخلي') + ' · ' + (nameOf(t.assigned_to_agent) || '—')));
      r.appendChild(mid);
      r.appendChild(el('span', 'tag', t.status || ''));
      host.appendChild(r);
    });
  }

  function renderDeals() {
    var list = activeDeals();
    $('dealSub').textContent = list.length + ' صفقة نشطة';
    var host = $('dealList');
    host.textContent = '';
    if (!list.length) { host.appendChild(el('div', 'empty', 'لا توجد صفقات نشطة')); return; }
    list.slice(0, 30).forEach(function (d) {
      var r = el('div', 'row');
      r.appendChild(el('span', 'tag', d.stage || 'lead'));
      var mid = el('div');
      mid.appendChild(el('b', '', d.client_name || 'عميل'));
      mid.appendChild(el('small', '', (d.service || '') + (d.execution_status ? ' · ' + d.execution_status : '')));
      r.appendChild(mid);
      r.appendChild(el('span', 'amount', money(d.deal_value || d.quoted_amount) + ' ر.س'));
      host.appendChild(r);
    });
  }

  function renderIntegrations() {
    var list = DATA.integrations;
    $('intSub').textContent = list.length + ' رابط';
    var host = $('intList');
    host.textContent = '';
    if (!list.length) { host.appendChild(el('div', 'empty', 'لا توجد بيانات ربط')); return; }
    list.slice(0, 40).forEach(function (i) {
      var s = low(i.status || i.readiness);
      var cls = READY_INT.indexOf(s) !== -1 ? 'ok' : (s.indexOf('block') !== -1 ? 'no' : 'mid');
      var r = el('div', 'row');
      r.appendChild(el('span', 'tag ' + cls, s || '—'));
      var mid = el('div');
      mid.appendChild(el('b', '', i.system_name || i.integration_id || 'ربط'));
      mid.appendChild(el('small', '', (i.owner_agent ? nameOf(i.owner_agent) + ' · ' : '') + (i.blocking_reason || i.next_action || i.purpose || '')));
      r.appendChild(mid);
      r.appendChild(el('span', 'tag', when(i.last_checked_at)));
      host.appendChild(r);
    });
  }

  function nameOf(id) {
    if (!id) return '';
    var a = index[id];
    if (a && a.agent_name) return a.agent_name;
    var d = DEPTS.filter(function (x) { return x.id === id; })[0];
    return d ? d.ar : id;
  }

  /* =====================================================================
     3. DEPARTMENT DOSSIER
     ===================================================================== */
  var sheetDept = null;

  function openDept(id) {
    sheetDept = id;
    var canon = DEPTS.filter(function (d) { return d.id === id; })[0] || { ar: nameOf(id), dept: '', en: '', icon: '🤖' };
    var a = index[id] || {};
    var mine = tasksOf(id);
    var team = teamOf(id);
    var deals = dealsOf(id);
    var kpis = DATA.kpis.filter(function (k) {
      return k.manager_agent === id || (a.department && low(k.department) === low(a.department)) || low(k.department) === low(canon.en);
    });
    var camps = DATA.campaigns.filter(function (c) { return c.owner_agent === id; });

    $('sheetTitle').textContent = canon.icon + ' ' + canon.ar + ' — ' + (a.department || canon.dept);
    $('sheetSub').textContent = (a.role || canon.en || '') + (a.mission ? ' · ' + a.mission : '');

    var body = $('sheetBody');
    body.textContent = '';

    body.appendChild(facts([
      ['الحالة', !index[id] ? 'لا سجل في السجل' : (isOn(a) ? (a.status || 'نشط') : (a.status || 'متوقف'))],
      ['الصحة', a.health_status || '—'],
      ['آخر نبضة', when(a.last_heartbeat)],
      ['مستوى الاستقلالية', a.autonomy_level || a.permissions_level || '—'],
      ['مهام مفتوحة', String(mine.length)],
      ['أعضاء الفريق', String(team.length)],
      ['الحمل الحالي', a.current_load != null ? String(a.current_load) : '—'],
      ['سقف التكلفة اليومي', a.max_daily_cost != null ? money(a.max_daily_cost) : '—'],
      ['صفقات مرتبطة', String(deals.length)],
      ['قيمة الصفقات', money(deptValue(id)) + ' ر.س']
    ]));

    if (!index[id]) body.appendChild(section('تنبيه من السجل', [textRow(
      'لا يوجد صف لهذا المدير في BP_Agent_Registry، مع أن ' + team.length +
      ' وكيلًا يرفعون تقاريرهم إليه. الحالة والنبضة والاستقلالية أعلاه فارغة لهذا السبب، لا لأن القسم متوقف.')]));
    if (a.paused_reason) body.appendChild(section('سبب التوقف', [textRow(a.paused_reason)]));
    if (a.last_error) body.appendChild(section('آخر خطأ', [textRow(a.last_error)]));

    body.appendChild(section('المهام المفتوحة', mine.length ? mine.slice(0, 20).map(function (t) {
      return row(t.priority || 'P2', t.objective || 'مهمة', (t.client_name || 'داخلي') + ' · ' + (t.next_action || ''), t.status || '');
    }) : [emptyRow('لا مهام مفتوحة')]));

    body.appendChild(section('الفريق', team.length ? team.map(function (m) {
      return row(isOn(m) ? 'ok' : 'no', m.agent_name || m.agent_id, m.role || m.mission || '',
        tasksOf(m.agent_id).length + ' مهمة · ' + when(m.last_heartbeat));
    }) : [emptyRow('لا أعضاء مسجّلون تحت هذا القسم')]));

    if (deals.length) body.appendChild(section('الصفقات', deals.slice(0, 15).map(function (d) {
      return row(d.stage || 'lead', d.client_name || 'عميل', d.service || '', money(d.deal_value || d.quoted_amount) + ' ر.س');
    })));

    if (kpis.length) body.appendChild(section('المؤشرات', kpis.slice(0, 12).map(function (k) {
      return row('', k.department || 'مؤشر',
        'مفتوحة ' + num(k.tasks_open) + ' · منجزة ' + num(k.tasks_completed) + ' · منتظرة ' + num(k.tasks_waiting) +
        ' · خط ' + money(k.pipeline_value) + ' · محصّل ' + money(k.collected_revenue),
        (k.score != null ? k.score + '%' : '—') + ' · ' + (k.snapshot_date || ''));
    })));

    if (camps.length) body.appendChild(section('حملات النمو', camps.slice(0, 12).map(function (c) {
      return row(c.status || c.phase || '', c.campaign_name || c.campaign_id || 'حملة',
        (c.channel || '') + ' · ' + (c.objective || '') + (c.blocked_by ? ' · معطّلة بـ' + c.blocked_by : ''),
        num(c.lead_count) + ' محتمل · ' + num(c.qualified_count) + ' مؤهّل');
    })));

    var rel = DEPTS.filter(function (d) { return d.chain && d.id !== id; });
    var meChain = (DEPTS.filter(function (d) { return d.id === id; })[0] || {}).chain;
    if (meChain) {
      var up = rel.filter(function (d) { return d.chain === meChain - 1; })[0];
      var dn = rel.filter(function (d) { return d.chain === meChain + 1; })[0];
      body.appendChild(section('الموقع في سلسلة القيمة', [
        textRow((up ? 'يستلم من: ' + up.dept : 'بداية السلسلة') + '  ←  ' + (a.department || canon.dept) + '  ←  ' + (dn ? 'يسلّم إلى: ' + dn.dept : 'نهاية السلسلة'))
      ]));
    }

    $('sheet').hidden = false;
  }

  function facts(pairs) {
    var w = el('div', 'facts');
    pairs.forEach(function (p) {
      var f = el('div', 'fact');
      f.appendChild(el('small', '', p[0]));
      f.appendChild(el('b', '', p[1]));
      w.appendChild(f);
    });
    return w;
  }
  function section(title, kids) {
    var s = el('section', 'sec');
    s.appendChild(el('h4', '', title));
    kids.forEach(function (k) { s.appendChild(k); });
    return s;
  }
  function row(tag, title, sub, right) {
    var r = el('div', 'row');
    r.appendChild(el('span', 'tag ' + tag, tag || '·'));
    var mid = el('div');
    mid.appendChild(el('b', '', title));
    if (sub) mid.appendChild(el('small', '', sub));
    r.appendChild(mid);
    r.appendChild(el('span', 'tag', right || ''));
    return r;
  }
  function textRow(t) { return el('div', 'row', t); }
  function emptyRow(t) { return el('div', 'empty', t); }

  $('sheetClose').addEventListener('click', function () { $('sheet').hidden = true; });
  $('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) $('sheet').hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('sheet').hidden = true; });
  $('sheetAsk').addEventListener('click', function () {
    if (!sheetDept) return;
    var d = DEPTS.filter(function (x) { return x.id === sheetDept; })[0];
    setTarget(sheetDept, d ? d.ar + ' — ' + d.dept : nameOf(sheetDept));
    $('sheet').hidden = true;
    ask('وش وضع ' + (d ? d.dept : nameOf(sheetDept)) + ' الآن، وأهم شيء يحتاج قراري؟');
  });
  $('coreBtn').addEventListener('click', function () {
    setTarget('virtual_baher', 'كل الشركة');
    $('input').focus();
  });

  function setTarget(id, label) {
    target = id;
    targetName = label;
    $('targetLine').textContent = 'التوجيه: ' + label;
  }

  /* =====================================================================
     4. ONE CONVERSATION RUNTIME (typed + spoken hit the same endpoint)
     ===================================================================== */
  var STATES = {
    idle:     ['🎙️ جاهز', ''],
    needmic:  ['🎙️ اضغط «فعّل المايك» للتحدّث', ''],
    listening:['🟢 أسمعك — تكلّم', 'live'],
    heard:    ['✅ سمعتك', 'busy'],
    thinking: ['🔵 أفكّر… (المايك موقوف · اضغط إيقاف للمقاطعة)', 'busy'],
    deleg:    ['🟣 أوزّع على المدراء… (اضغط إيقاف للمقاطعة)', 'busy'],
    speaking: ['🗣️ أتكلّم', 'talk'],
    micoff:   ['🔴 المايك مقفول', 'err'],
    error:    ['⚠️ خطأ', 'err']
  };
  function setState(k, extra) {
    var s = STATES[k] || STATES.idle;
    var n = $('uiState');
    n.textContent = s[0] + (extra ? ' · ' + extra : '');
    n.className = 'state ' + s[1];
  }

  function addMsg(text, who) {
    var box = $('msgs');
    var d = el('div', 'msg ' + who, text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function voicePart(t) {
    return String(t || '').split('[[DETAILS]]')[0].replace(/^\s*VOICE:\s*/i, '').trim();
  }

  /* The owner could not send a second command while the first was still out:
   * ask() returned early on `busy` and the button sat disabled, sometimes for
   * the full 150s timeout, with listening paused the whole time. A request in
   * flight is now interruptible. */
  var inflight = null, abortedByUser = false, busySince = 0;

  function forceUnbusy(why) {
    if (!busy) return;
    try { if (inflight) inflight.abort(); } catch (e) {}
    inflight = null;
    busy = false;
    busySince = 0;
    abortedByUser = false;
    var b = $('btnSend');
    b.textContent = 'إرسال';
    b.disabled = false;
    diag('أُعيد ضبط حالة الانتظار تلقائيًا: ' + why);
    note('تعلّقت حالة الانتظار فأُعيد ضبطها — المايك عاد للعمل.', 'mic');
    resumeListening();
  }

  function cancelAsk() {
    if (!busy || !inflight) return false;
    abortedByUser = true;
    try { inflight.abort(); } catch (e) {}
    return true;
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return Promise.resolve();
    busy = true;
    busySince = Date.now();
    abortedByUser = false;
    $('btnSend').textContent = 'إيقاف';
    addMsg(text, 'me');
    var box = $('input');
    box.value = '';
    delete box.dataset.interim;
    box.dataset.typed = '0';
    autosize();

    var t0 = Date.now();
    setState('thinking');
    var tick = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      setState(s > 12 ? 'deleg' : 'thinking', s + 'ث');
    }, 1500);

    var ctl = new AbortController();
    inflight = ctl;
    var tm = setTimeout(function () { ctl.abort(); }, CHAT_TIMEOUT);

    return fetch(API.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, target_agent: target, source: 'command_space' }),
      signal: ctl.signal
    })
      .then(function (r) {
        return r.text().then(function (raw) {
          if (!r.ok) throw new Error('الخادم رجّع HTTP ' + r.status + (raw ? ' · ' + raw.slice(0, 180) : ''));
          if (!raw.trim()) throw new Error('الخادم رجّع ردًا فارغًا (السير توقّف قبل عقدة الرد)');
          try { return JSON.parse(raw); }
          catch (e) { throw new Error('رد غير صالح من الخادم · ' + raw.slice(0, 180)); }
        });
      })
      .then(function (j) {
        var body = Array.isArray(j) ? (j[0] || {}) : j;
        var reply = body.reply || body.output || body.text || body.message || 'تم استلام الطلب.';
        addMsg(reply, 'ai');
        loadData();
        return speak(reply);
      })
      .catch(function (e) {
        var abort = e.name === 'AbortError';
        if (abort && abortedByUser) addMsg('أوقفت الطلب. تفضّل بالأمر الجديد.', 'sys');
        else addMsg(abort
          ? 'انتهت المهلة بعد ' + Math.round(CHAT_TIMEOUT / 1000) + ' ثانية. الطلب طويل — جرّب سؤالًا أقصر.'
          : (e.message || String(e)), 'sys');
        setState(abortedByUser ? 'idle' : 'error');
      })
      .then(function () {
        clearTimeout(tm);
        clearInterval(tick);
        inflight = null;
        busy = false;
        busySince = 0;
        abortedByUser = false;
        $('btnSend').textContent = 'إرسال';
        $('btnSend').disabled = false;
        resumeListening();
      });
  }

  /* ---------- speech out (browser native, no paid TTS) ---------- */
  var speakOn = true;
  var voices = [];
  var chosenVoice = null;

  /* The browser default for lang='ar-SA' is usually the flattest voice installed.
   * Rank what is actually available and take the most natural one: Saudi dialect
   * first, then network voices (those are the neural ones), then names the
   * platforms give their high-quality engines. */
  function rankVoice(v) {
    var n = String(v.name || '').toLowerCase();
    var lang = String(v.lang || '').replace('_', '-').toLowerCase();
    var s = 0;
    if (lang.indexOf('ar-sa') === 0) s += 50;
    else if (lang.indexOf('ar-') === 0) s += 25;
    if (v.localService === false) s += 30;
    if (/neural|natural|premium|enhanced|wavenet|online|siri/.test(n)) s += 25;
    if (/majed|maged|hamed|naayf|zariyah|hala|laila|salim|amina/.test(n)) s += 12;
    if (/compact|espeak|robot|default/.test(n)) s -= 25;
    return s;
  }
  function loadVoices() {
    if (!window.speechSynthesis) return;
    try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
    var ar = voices.filter(function (v) {
      return /^ar([-_]|$)/i.test(String(v.lang || ''));
    });
    chosenVoice = ar.length
      ? ar.sort(function (a, b) { return rankVoice(b) - rankVoice(a); })[0]
      : null;
  }
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  /* Long replies were truncated at 700 characters, so the last sentence was cut
   * mid-word. Split on sentence ends instead and queue the pieces in order. */
  function chunkForSpeech(s) {
    // No lookbehind (Safari before 16.4 throws on it) and no control-character
    // sentinel either — an invisible separator is impossible to review safely.
    // Match runs of non-terminators followed by their terminators instead.
    var parts = String(s).match(/[^.!?\u061F\u06D4\n]+[.!?\u061F\u06D4\n]*/g) || [String(s)];
    var out = [], buf = '';
    parts.forEach(function (p) {
      if ((buf + ' ' + p).trim().length > 220) { if (buf.trim()) out.push(buf.trim()); buf = p; }
      else buf = buf ? buf + ' ' + p : p;
    });
    if (buf.trim()) out.push(buf.trim());
    return out.filter(Boolean).slice(0, 12);
  }

  /* One entry point for every spoken reply. The neural voice is preferred when
   * config.js carries a voicePath; the browser voice is the fallback, so the
   * page still talks when the endpoint is missing, unpaid, or down — and the
   * banner says which of those it was. */
  var currentAudio = null;

  function speak(text) {
    var s = voicePart(text);
    if (!speakOn || !s) return Promise.resolve();
    if (!API.voice) return speakBrowser(s);
    return speakNeural(s).catch(function (e) {
      note('الصوت الطبيعي غير متاح (' + (e && e.message ? e.message : e) + ') — رجعت لصوت المتصفح', 'voice');
      return speakBrowser(s);
    });
  }

  function speakNeural(s) {
    return new Promise(function (res, rej) {
      pauseListening();
      setState('speaking', 'صوت طبيعي');
      var ctl = new AbortController();
      var tm = setTimeout(function () { ctl.abort(); }, 45000);
      fetch(API.voice, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: s.slice(0, 2500) }),
        signal: ctl.signal
      })
        .then(function (r) {
          clearTimeout(tm);
          var ct = r.headers.get('content-type') || '';
          if (!r.ok) {
            return r.text().then(function (t) {
              throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 120) : ''));
            });
          }
          if (ct.indexOf('audio') === -1) {
            return r.text().then(function (t) {
              throw new Error('الخادم لم يرجّع صوتًا · ' + t.slice(0, 120));
            });
          }
          return r.blob();
        })
        .then(function (b) {
          if (!b || b.size < 512) throw new Error('ملف صوتي فارغ');
          var url = URL.createObjectURL(b);
          var a = new Audio(url);
          var done = false;
          currentAudio = a;
          var clear = function () {
            done = true;
            try { URL.revokeObjectURL(url); } catch (e) {}
            currentAudio = null;
          };
          a.onended = function () { if (done) return; clear(); res(); };
          a.onerror = function () { if (done) return; clear(); rej(new Error('تعذّر تشغيل الصوت')); };
          a.play().catch(function (e) { if (done) return; clear(); rej(e); });
        })
        .catch(function (e) {
          clearTimeout(tm);
          rej(e && e.name === 'AbortError' ? new Error('انتهت مهلة توليد الصوت') : e);
        });
    });
  }

  function speakBrowser(s) {
    if (!s || !window.speechSynthesis) return Promise.resolve();
    if (!chosenVoice) loadVoices();
    var pieces = chunkForSpeech(s);
    if (!pieces.length) return Promise.resolve();

    return new Promise(function (res) {
      pauseListening();
      setState('speaking', chosenVoice ? chosenVoice.name : '');
      try { window.speechSynthesis.cancel(); } catch (e) {}
      var i = 0, done = false;
      var finish = function () { if (done) return; done = true; res(); };
      var guard = setTimeout(finish, 120000);
      var next = function () {
        if (i >= pieces.length) { clearTimeout(guard); finish(); return; }
        var u = new SpeechSynthesisUtterance(pieces[i++]);
        if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
        else u.lang = 'ar-SA';
        u.rate = 0.96;
        u.pitch = 1;
        u.onend = next;
        u.onerror = function () { clearTimeout(guard); finish(); };
        window.speechSynthesis.speak(u);
      };
      next();
    });
  }

  /* ---------- diagnostics ----------
   * Three blind fixes to the microphone were tested against a FAKE recogniser,
   * so none of them proved anything about the real one. This panel reports what
   * actually happens in the owner's own browser: permission state, whether the
   * recogniser ever started, and the exact error if it did not. */
  var DIAG = {
    support: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    perm: '?', micReady: false, wantListen: false, started: 0,
    results: 0, interim: 0, lastErr: '', lastErrAt: '', startedAt: '', note: ''
  };
  function stamp() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  var BUILD_ID = 'stt-3';
  function diagText() {
    return [
      'إصدار اللوحة: ' + BUILD_ID,
      'محرّك السمع: ' + (serverMode ? 'خادمنا (تسجيل + تفريغ)' : 'متصفحك'),
      'دعم المتصفح: ' + (DIAG.support ? 'نعم' : 'لا'),
      'إذن المايك: ' + DIAG.perm,
      'المايك مفتوح: ' + (DIAG.micReady ? 'نعم' : 'لا'),
      'الاستماع مطلوب: ' + (DIAG.wantListen ? 'نعم' : 'لا'),
      'بدأ التعرّف: ' + DIAG.started + (DIAG.startedAt ? ' (آخر مرة ' + DIAG.startedAt + ')' : ''),
      'نتائج نهائية: ' + DIAG.results + ' · مؤقتة: ' + DIAG.interim,
      'صوت يُنطق الآن: ' + ((window.speechSynthesis && window.speechSynthesis.speaking) ? 'نعم' : 'لا'),
      'ينتظر ردًا: ' + (busy ? 'نعم' + (busySince ? ' منذ ' + Math.round((Date.now() - busySince) / 1000) + 'ث' : '') : 'لا'),
      'آخر خطأ: ' + (DIAG.lastErr ? DIAG.lastErr + ' @ ' + DIAG.lastErrAt : 'لا شيء'),
      DIAG.note ? 'ملاحظة: ' + DIAG.note : ''
    ].filter(Boolean).join('\n');
  }
  var diagBox = null, diagPre = null;
  function buildDiag() {
    var strip = document.querySelector('.mic-strip');
    if (!strip || diagBox) return;
    diagBox = el('div', 'diag');
    diagBox.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--line);font-size:10px;color:var(--dim)';
    var head = el('div');
    head.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between';
    var ttl = el('b', '', 'تشخيص المايك');
    ttl.style.cssText = 'font-size:10px;color:#9fe2ff';
    var btn = el('button', 'chip', 'نسخ');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      var t = diagText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { btn.textContent = 'تم النسخ'; },
          function () { btn.textContent = 'انسخ يدويًا'; });
      } else { btn.textContent = 'انسخ يدويًا'; }
    });
    head.appendChild(ttl); head.appendChild(btn);
    diagPre = el('pre');
    diagPre.style.cssText = 'margin:5px 0 0;white-space:pre-wrap;font:inherit;line-height:1.7';
    diagBox.appendChild(head); diagBox.appendChild(diagPre);
    strip.parentNode.insertBefore(diagBox, strip.nextSibling);
  }
  function diag(note) {
    if (note != null) DIAG.note = note;
    DIAG.micReady = micReady; DIAG.wantListen = wantListen;
    buildDiag();
    if (diagPre) diagPre.textContent = diagText();
  }

  /* ---------- speech in (always listening) ---------- */
  var rec = null, listening = false, wantListen = false, micReady = false, restartT = null, audioCtx = null, analyser = null, meterRaf = null;

  function pauseListening() {
    listening = false;
    if (serverMode) { stopRecorder(); chunks = []; speechSeen = false; return; }
    try { if (rec) rec.stop(); } catch (e) {}
    $('meter').classList.remove('on');
  }
  function resumeListening() {
    if (serverMode) {
      if (!wantListen) { if (!busy) setState('idle'); return; }
      clearTimeout(restartT);
      restartT = setTimeout(startListening, 350);
      return;
    }
    if (!rec || !wantListen) { if (!busy) setState(wantListen ? 'idle' : 'idle'); return; }
    clearTimeout(restartT);
    restartT = setTimeout(startListening, 450);
  }
  var startWatch = null, speakBlocks = 0, busyBlocks = 0, deadStarts = 0;

  /* Two unbounded waits used to silence the microphone permanently:
   *
   * 1. speechSynthesis.speaking can stay stuck true in Chrome when an utterance
   *    is cancelled or the tab loses focus and `onend` never fires. The old code
   *    then bounced between resumeListening() and startListening() forever and
   *    never called rec.start() — no error, no message, just deafness.
   * 2. A stuck `busy` did the same, and worse: startListening() returned without
   *    scheduling another attempt, so listening never resumed at all.
   *
   * Both waits are now capped and recover themselves. */
  function startListening() {
    if (!wantListen) return;
    if (serverMode) {
      if (!busy && !sending && !recorder) startRecorder();
      return;
    }
    if (!rec) return;
    if (listening) return;

    if (busy) {
      busyBlocks += 1;
      if (busyBlocks >= 8) {   // ~4s of being blocked by a request that never settled
        busyBlocks = 0;
        forceUnbusy('انتظار الرد تعلّق');
      } else {
        clearTimeout(restartT);
        restartT = setTimeout(startListening, 500);
        return;
      }
    } else { busyBlocks = 0; }

    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      speakBlocks += 1;
      if (speakBlocks >= 6) {  // ~3s: speaking is stuck, not actually speaking
        speakBlocks = 0;
        try { window.speechSynthesis.cancel(); } catch (e) {}
        diag('speechSynthesis.speaking بقي عالقًا — أُلغي النطق واستُؤنف الاستماع');
      } else {
        resumeListening();
        return;
      }
    } else { speakBlocks = 0; }

    try {
      rec.start();
      // start() can resolve into silence: no onstart, no onerror. Without this
      // the page looks alive while the recogniser never actually ran.
      clearTimeout(startWatch);
      startWatch = setTimeout(function () {
        if (!listening && wantListen) {
          diag('طُلب التعرّف ولم يبدأ خلال ٣ ثوانٍ');
          switchToServerStt('لم يبدأ إطلاقًا');
        }
      }, 3000);
    } catch (e) {
      diag('rec.start() رمى: ' + (e && e.message ? e.message : e));
      clearTimeout(restartT);
      restartT = setTimeout(startListening, 900);
    }
  }

  function initVoice(forceOn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR && !API.stt) {
      setState('error', 'المتصفح لا يدعم التعرّف على الصوت — الكتابة تعمل');
      wantListen = false;
      micLabel();
      return;
    }
    if (!SR || serverModeOn()) serverMode = true;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        micReady = true;
        try { localStorage.setItem('bp_mic_granted', '1'); } catch (e) {}
        // The stream (and with it the clap detector) stays open even when
        // recognition is off, otherwise two claps could never switch it back on.
        var stored = '1';
        try { stored = localStorage.getItem('bp_listen') || '1'; } catch (e) {}
        wantListen = forceOn ? true : stored !== '0';
        rememberListen(wantListen);
        micLabel();
        startMeter(stream);
        if (serverMode) {
          micBanner('');
          if (wantListen) startRecorder(); else setState('idle', 'صفّق مرتين لأسمعك');
          diag('وضع التفريغ على الخادم');
          return;
        }
        rec = new SR();
        rec.lang = 'ar-SA';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onstart = function () {
          listening = true;
          clearTimeout(startWatch);
          DIAG.started += 1;
          DIAG.startedAt = stamp();
          setState('listening');
          note('', 'mic');
          $('meter').classList.add('on');
          diag('');
        };
        rec.onresult = function (e) {
          var finalText = '', interim = '';
          for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
          }
          finalText = finalText.trim();
          interim = interim.trim();
          if (interim) DIAG.interim += 1;
          if (finalText) DIAG.results += 1;
          diag();
          // Interim words were being thrown away, so nothing on screen moved
          // while the owner spoke and the page looked deaf. Write them into the
          // box as they arrive; the final result replaces them and is sent.
          if (!finalText && interim) showInterim(interim);
          if (finalText.length > 1) {
            clearInterim();
            setState('heard', finalText.slice(0, 60));
            pauseListening();
            ask(finalText);
          }
        };
        rec.onerror = function (e) {
          listening = false;
          clearTimeout(startWatch);
          DIAG.lastErr = (e && e.error) || 'unknown';
          DIAG.lastErrAt = stamp();
          diag();
          $('meter').classList.remove('on');
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            wantListen = false;
            setState('micoff', 'اضغط 🔒 بجانب الرابط → Microphone → Allow ثم حدّث الصفحة');
            return;
          }
          if (e.error === 'network') {
            switchToServerStt('لا يصل لخوادم التعرّف');
            return;
          }
          if (e.error === 'no-speech' || e.error === 'aborted') {
            // Started and died with nothing heard, repeatedly: the browser's
            // speech service is not answering. Stop pretending it will.
            if (e.error === 'aborted' && DIAG.results === 0 && DIAG.interim === 0) {
              deadStarts += 1;
              if (deadStarts >= 3) { switchToServerStt('يبدأ ثم يُجهَض بلا نتيجة'); return; }
            }
            resumeListening();
            return;
          }
          setState('error', e.error || '');
          note('المايك: ' + (e.error || 'خطأ غير معروف'), 'mic');
          resumeListening();
        };
        rec.onend = function () {
          listening = false;
          $('meter').classList.remove('on');
          if (!busy) resumeListening();
        };
        if (wantListen) startListening();
        else setState('idle', 'صفّق مرتين لأسمعك');
      })
      .catch(function (e) {
        wantListen = false;
        micReady = false;
        micLabel();
        diag('getUserMedia رفض: ' + (e && e.name ? e.name : '') + ' ' + (e && e.message ? e.message : ''));
        micBanner(e && e.name === 'NotAllowedError' ? 'denied' : 'prompt');
        setState('micoff', e && e.name === 'NotAllowedError'
          ? 'اضغط 🔒 بجانب الرابط → Microphone → Allow ثم حدّث الصفحة'
          : (e && e.message) || '');
      });
  }

  /* Two claps toggle listening, so the owner never has to reach for the button.
   * A clap is a transient: one frame far above the running average of the last
   * frames, not merely loud — speech ramps, a clap spikes. Two of them inside
   * 1.1s count as the gesture, and a short deaf window afterwards stops the
   * same pair from firing twice. */
  var lvlHist = [], clapTimes = [], lastClapAt = 0, clapDeafUntil = 0;

  function detectClap(lvl) {
    var now = Date.now();
    var avg = 0;
    if (lvlHist.length) {
      for (var i = 0; i < lvlHist.length; i++) avg += lvlHist[i];
      avg /= lvlHist.length;
    }
    lvlHist.push(lvl);
    if (lvlHist.length > 18) lvlHist.shift();

    // With an empty history the average is 0, so the very first sound after the
    // microphone opens satisfies "three times the average" and registered as a
    // clap — two of those and listening switched itself off at startup.
    if (lvlHist.length < 12) return;

    if (now < clapDeafUntil) return;
    if (lvl < 0.34 || lvl < avg * 3 || now - lastClapAt < 180) return;

    lastClapAt = now;
    clapTimes.push(now);
    clapTimes = clapTimes.filter(function (t) { return now - t < 1100; });
    if (clapTimes.length < 2) return;

    clapTimes = [];
    clapDeafUntil = now + 1200;
    toggleListenByClap();
  }

  function toggleListenByClap() {
    wantListen = !wantListen;
    rememberListen(wantListen);
    micLabel();
    if (wantListen) {
      setState('idle', 'تصفيقتان · عاد السماع');
      startListening();
    } else {
      pauseListening();
      clearInterim();
      // rec.stop() fires onend, whose resumeListening() would repaint the state
      // and swallow the confirmation. Say it once the stop has settled.
      setTimeout(function () {
        if (!wantListen) setState('idle', 'تصفيقتان · أوقفتُ السماع · صفّق مرتين لأعود');
      }, 90);
    }
  }

  function startMeter(stream) {
    mediaStream = stream;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      var src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      var bins = new Uint8Array(analyser.frequencyBinCount);
      var bars = $('meter').querySelectorAll('i');
      var loop = function () {
        analyser.getByteFrequencyData(bins);
        var sum = 0;
        for (var i = 0; i < bars.length; i++) {
          var v = bins[Math.floor(i * bins.length / bars.length)] / 255;
          bars[i].style.height = Math.max(3, Math.round(v * 22)) + 'px';
        }
        for (var k = 0; k < bins.length; k++) sum += bins[k];
        var lvl = sum / bins.length / 255;
        detectClap(lvl);
        voiceActivity(lvl);
        meterRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { /* meter is decoration; ignore */ }
  }

  /* =====================================================================
     SERVER LISTENING — the fallback that does not need the browser's
     speech service.

     The owner's diagnostics showed the truth: permission granted, microphone
     open, recognition started 24 times, zero results, last error "aborted".
     Chrome's SpeechRecognition talks to a Google service; where that service
     does not answer it starts and dies instantly and no page code can fix it.
     So this path ignores it entirely: MediaRecorder captures the audio, the
     existing analyser marks where speech stops, and the clip goes to n8n for
     transcription. Only the microphone permission is needed.
     ===================================================================== */
  var serverMode = false, mediaStream = null, recorder = null, chunks = [];
  var speechSeen = false, silenceSince = 0, clipStart = 0, sending = false;
  var SPEAK_LEVEL = 0.06, SILENCE_MS = 1200, MAX_CLIP_MS = 20000, MIN_CLIP_MS = 500;

  function serverModeOn() {
    try { return localStorage.getItem('bp_stt') === 'server'; } catch (e) { return false; }
  }
  function rememberServerMode() {
    try { localStorage.setItem('bp_stt', 'server'); } catch (e) {}
  }

  function switchToServerStt(why) {
    if (serverMode) return;
    if (!API.stt) {
      note('التعرّف في المتصفح لا يعمل (' + why + ') ولا يوجد مسار تفريغ بديل في الإعدادات.', 'mic');
      return;
    }
    serverMode = true;
    rememberServerMode();
    try { if (rec) { rec.onend = null; rec.onerror = null; rec.abort(); } } catch (e) {}
    rec = null;
    diag('تحوّلت إلى التفريغ على الخادم لأن تعرّف المتصفح ' + why);
    note('تعرّف المتصفح لا يستجيب — حوّلت التسجيل إلى خادمنا. تكلّم عاديًا.', 'mic');
    if (mediaStream) startRecorder();
  }

  function pickMime() {
    var opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (var i = 0; i < opts.length; i++) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(opts[i])) return opts[i]; } catch (e) {}
    }
    return '';
  }

  function startRecorder() {
    if (!serverMode || !wantListen || busy || sending || recorder || !mediaStream) return;
    if (!window.MediaRecorder) { note('هذا المتصفح لا يدعم التسجيل (MediaRecorder).', 'mic'); return; }
    try {
      var mime = pickMime();
      recorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      chunks = []; speechSeen = false; silenceSince = 0; clipStart = Date.now();
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        var blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null;
        recorder = null;
        var spoke = speechSeen;
        if (spoke && blob && blob.size > 1200) sendClip(blob);
        else if (wantListen && !busy) setTimeout(startRecorder, 200);
      };
      recorder.start(250);
      listening = true;
      setState('listening');
      $('meter').classList.add('on');
      DIAG.started += 1; DIAG.startedAt = stamp();
      diag('');
    } catch (e) {
      recorder = null;
      diag('تعذّر بدء التسجيل: ' + (e && e.message ? e.message : e));
    }
  }

  function stopRecorder() {
    listening = false;
    $('meter').classList.remove('on');
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); else recorder = null; } catch (e) { recorder = null; }
  }

  /* Called from the meter loop on every animation frame. */
  function voiceActivity(lvl) {
    if (!serverMode || !recorder) return;
    var now = Date.now();
    if (lvl >= SPEAK_LEVEL) { speechSeen = true; silenceSince = 0; }
    else if (speechSeen) {
      if (!silenceSince) silenceSince = now;
      else if (now - silenceSince >= SILENCE_MS && now - clipStart >= MIN_CLIP_MS) { stopRecorder(); return; }
    }
    if (now - clipStart >= MAX_CLIP_MS) stopRecorder();
  }

  function sendClip(blob) {
    sending = true;
    setState('heard', 'أفرّغ الصوت…');
    var fr = new FileReader();
    fr.onload = function () {
      var raw64 = String(fr.result || '');
      var b64 = raw64.slice(raw64.indexOf(',') + 1);
      var ctl = new AbortController();
      var tm = setTimeout(function () { ctl.abort(); }, 45000);
      fetch(API.stt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_b64: b64, mime: blob.type || 'audio/webm' }),
        signal: ctl.signal
      })
        .then(function (r) {
          clearTimeout(tm);
          return r.text().then(function (raw) {
            var j = {};
            try { j = JSON.parse(raw); } catch (e) { throw new Error('رد غير صالح · ' + raw.slice(0, 120)); }
            if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
            return String(j.text || '').trim();
          });
        })
        .then(function (text) {
          sending = false;
          text = text.replace(/[\[(][^\])]*[\])]/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 1) {
            DIAG.results += 1; diag('');
            note('', 'mic');
            showInterim(text);
            setState('heard', text.slice(0, 60));
            ask(text);
          } else {
            if (wantListen && !busy) setTimeout(startRecorder, 200);
          }
        })
        .catch(function (e) {
          sending = false;
          clearTimeout(tm);
          DIAG.lastErr = 'stt: ' + (e && e.message ? e.message : e);
          DIAG.lastErrAt = stamp();
          diag('');
          note('تعذّر تفريغ الصوت: ' + (e && e.message ? e.message : e), 'mic');
          if (wantListen && !busy) setTimeout(startRecorder, 1500);
        });
    };
    fr.onerror = function () { sending = false; if (wantListen && !busy) setTimeout(startRecorder, 800); };
    fr.readAsDataURL(blob);
  }

  /* ---------- controls ---------- */
  function showInterim(t) {
    var el = $('input');
    if (el.dataset.typed === '1') return;   // never clobber what he is typing
    el.dataset.interim = '1';
    el.value = t;
    autosize();
    setState('listening', t.slice(-48));
  }
  function clearInterim() {
    var el = $('input');
    if (el.dataset.interim === '1') { el.value = ''; delete el.dataset.interim; autosize(); }
  }

  /* The old labels read as status, not as an action: the button said "موقوف"
   * and the owner could not tell whether that was a state or a button to press.
   * Each label now names what a press will do. */
  function micLabel() {
    var b = $('btnMic');
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      b.classList.add('off'); b.textContent = '🎙️ غير مدعوم'; return;
    }
    if (!micReady) { b.classList.add('off'); b.textContent = '🎙️ شغّل المايك'; return; }
    b.classList.toggle('off', !wantListen);
    b.textContent = wantListen ? '🎙️ يسمعك · اضغط للإيقاف' : '🎙️ اضغط ليسمعك';
  }
  /* Safari has no navigator.permissions for the microphone. Only re-open the
   * stream there if this browser granted it before — never on a first visit,
   * which is what got the permission blocked in the first place. */
  function armIfPreviouslyAllowed() {
    var seen = '';
    try { seen = localStorage.getItem('bp_mic_granted') || ''; } catch (e) {}
    if (seen === '1') initVoice(false);
    else setState('needmic');
  }
  function rememberListen(on) {
    try { localStorage.setItem('bp_listen', on ? '1' : '0'); } catch (e) {}
  }

  function autosize() {
    var t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(120, t.scrollHeight) + 'px';
  }
  $('input').addEventListener('input', function () {
    var el = $('input');
    delete el.dataset.interim;
    el.dataset.typed = el.value.trim() ? '1' : '0';
    autosize();
  });
  $('input').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    var v = this.value;
    if (busy) {
      // Waiting on the previous reply must never swallow a new order.
      cancelAsk();
      setTimeout(function () { ask(v); }, 60);
      return;
    }
    ask(v);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && busy) cancelAsk();
  });
  $('btnSend').addEventListener('click', function () {
    if (busy) { cancelAsk(); return; }
    ask($('input').value);
  });
  $('btnRefresh').addEventListener('click', function () { loadData(true); });
  $('btnSpeak').addEventListener('click', function () {
    speakOn = !speakOn;
    this.classList.toggle('off', !speakOn);
    this.textContent = speakOn ? '🔊 الصوت' : '🔇 صامت';
    if (!speakOn) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
    }
  });
  /* Chrome refuses (and after a couple of dismissals permanently blocks) a
   * getUserMedia call that isn't tied to a user gesture. Asking on page load
   * was what got the microphone blocked; the first click asks instead. */
  $('btnMic').addEventListener('click', function () {
    if (!micReady) {
      wantListen = true;
      this.classList.remove('off');
      this.textContent = '🎙️ جارٍ التفعيل…';
      setState('idle', 'اسمح للمايك في نافذة المتصفح');
      initVoice(true);
      return;
    }
    wantListen = !wantListen;
    rememberListen(wantListen);
    micLabel();
    if (wantListen) startListening();
    else { pauseListening(); clearInterim(); setState('idle'); }
  });
  window.addEventListener('resize', function () { clearTimeout(window.__rz); window.__rz = setTimeout(renderOrbs, 200); });

  /* The state chip is small and easy to miss. A microphone that is blocked by
   * the browser is not a subtle condition — no amount of page code can undo it,
   * only the owner can, so it gets the loud red bar and exact instructions. */
  function micBanner(kind) {
    var n = $('linkLine');
    n.hidden = false;
    n.textContent = '';
    n.style.cssText = 'padding:10px 16px;font-size:13px;line-height:1.9';
    var b = el('b', '', '');
    var p = el('div', '', '');
    if (kind === 'denied') {
      b.textContent = '🔴 المتصفح مانع المايك على هذا الموقع — لا يمكن إصلاحه من الكود.';
      p.textContent = 'اضغط أيقونة 🔒 (أو ⓘ) بجانب العنوان أعلى المتصفح ← إعدادات الموقع ← الميكروفون ← اختر «سماح» أو «إعادة تعيين الأذونات» ← حدّث الصفحة.';
    } else if (kind === 'prompt') {
      b.textContent = '🎙️ المايك يحتاج إذنك مرة واحدة.';
      p.textContent = 'اضغط زر «شغّل المايك» بالأسفل، ثم اختر «سماح / Allow» في نافذة المتصفح.';
    } else if (kind === 'nosupport') {
      b.textContent = '⚠️ هذا المتصفح لا يدعم التعرّف على الصوت.';
      p.textContent = 'افتح اللوحة في Chrome على الحاسوب. الكتابة تعمل هنا على أي حال.';
    } else { n.hidden = true; n.style.cssText = ''; return; }
    n.appendChild(b);
    n.appendChild(p);
    var t = el('button', 'chip', 'افحص المايك الآن');
    t.type = 'button';
    t.style.cssText = 'margin-top:6px';
    t.addEventListener('click', micSelfTest);
    n.appendChild(t);
    noteOwner = 'mic';
  }

  /* One button that answers "why is it not hearing me" with a fact, by actually
   * trying — instead of the owner and me guessing at each other across a chat. */
  function micSelfTest() {
    var n = $('linkLine');
    n.hidden = false;
    n.textContent = 'جارٍ الفحص…';
    noteOwner = 'mic';
    var lines = [];
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    lines.push('دعم التعرّف: ' + (SR ? 'موجود' : 'غير موجود'));
    lines.push('الاتصال آمن (https): ' + (window.isSecureContext ? 'نعم' : 'لا — الميكروفون ممنوع بدون https'));
    var done = function () {
      n.textContent = '';
      lines.forEach(function (t) { n.appendChild(el('div', '', t)); });
      var again = el('button', 'chip', 'أعد الفحص');
      again.type = 'button';
      again.style.cssText = 'margin-top:6px';
      again.addEventListener('click', micSelfTest);
      n.appendChild(again);
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      lines.push('getUserMedia: غير متاح في هذا المتصفح');
      return done();
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      lines.push('فتح المايك: ✅ نجح');
      try {
        var tr = stream.getAudioTracks ? stream.getAudioTracks() : [];
        lines.push('الجهاز: ' + (tr.length ? (tr[0].label || 'بلا اسم') : 'لا توجد قناة صوت'));
        tr.forEach(function (x) { try { x.stop(); } catch (e) {} });
      } catch (e) {}
      lines.push('إذن المتصفح سليم — إن بقي لا يسمع فالمشكلة في خدمة التعرّف لا في الإذن.');
      done();
    }).catch(function (e) {
      var nm = (e && e.name) || 'خطأ';
      lines.push('فتح المايك: ❌ ' + nm + (e && e.message ? ' — ' + e.message : ''));
      if (nm === 'NotAllowedError') lines.push('المتصفح مانع الإذن. اضغط 🔒 بجانب العنوان ← الميكروفون ← سماح ← حدّث.');
      if (nm === 'NotFoundError') lines.push('لا يوجد ميكروفون موصول بالجهاز.');
      if (nm === 'NotReadableError') lines.push('تطبيق آخر يستعمل المايك الآن (زوم/تيمز/تسجيل). أغلقه ثم أعد الفحص.');
      done();
    });
  }

  /* ---------- boot ---------- */
  if (!API.data || API.data.indexOf('REPLACE') !== -1 || API.data.indexOf('YOUR-INSTANCE') !== -1) {
    note('config.js لم يُعبّأ بعد — انسخ config.example.js إلى config.js وضع مسارات n8n الحقيقية.');
  }
  setState('needmic');
  addMsg('أنا معك. اسألني عن الفريق، العملاء، الفلوس، أو التسويق — أو أعطني أمرًا وأنا أوزّعه على المدراء.', 'ai');

  loadData();
  if (REFRESH_MS) setInterval(function () { if (!busy) loadData(); }, REFRESH_MS);

  // Last line of defence: nothing may hold the microphone shut indefinitely.
  setInterval(function () {
    if (busy && busySince && Date.now() - busySince > CHAT_TIMEOUT + 8000) {
      forceUnbusy('تجاوز المهلة القصوى');
    }
    if (rec && wantListen && !listening && !busy) startListening();
    // A timeout or error badge used to sit there while the page was in fact
    // listening again, which reads as "still broken" to the owner.
    if (listening && !busy) {
      var n = $('uiState');
      if (n && n.textContent.indexOf('أسمعك') === -1) setState('listening');
    }
    diag();
  }, 5000);

  // Never getUserMedia unprompted on a fresh visit — that is what got the
  // microphone blocked before. But once the owner has already granted it, the
  // browser will not prompt again, so re-arm listening by itself and spare him
  // pressing the button on every reload.
  micLabel();
  diag('');
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    setState('error', 'المتصفح لا يدعم التعرّف على الصوت — الكتابة تعمل');
    micBanner('nosupport');
  } else if (!(navigator.permissions && navigator.permissions.query)) {
    armIfPreviouslyAllowed();
  } else {
    navigator.permissions.query({ name: 'microphone' }).then(function (st) {
      var state = (st && st.state) || '?';
      DIAG.perm = state;
      diag();
      if (state === 'granted') { micBanner(''); initVoice(false); return; }
      setState('needmic');
      micBanner(state === 'denied' ? 'denied' : 'prompt');
      // The state can change while the page is open (owner resets it in the
      // browser); pick that up without needing a reload.
      if (st && 'onchange' in st) {
        st.onchange = function () {
          DIAG.perm = st.state; diag();
          if (st.state === 'granted') { micBanner(''); initVoice(true); }
          else micBanner(st.state === 'denied' ? 'denied' : 'prompt');
        };
      }
    }).catch(function () { DIAG.perm = 'غير مدعوم'; armIfPreviouslyAllowed(); });
  }
})();
