/* BP AI Command Space — one runtime for the dashboard and the conversation.
 * Data comes from n8n (read-only JSON API); the chat posts to the same
 * Virtual Baher endpoint whether the words were typed or spoken. */
(function () {
  'use strict';

  var CFG = window.BP_SPACE_CONFIG || {};
  var API = {
    data: (CFG.n8n || '') + (CFG.dataPath || ''),
    chat: (CFG.n8n || '') + (CFG.chatPath || ''),
    action: (CFG.n8n || '') + (CFG.actionPath || '')
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
        note('');
        renderAll(body.generated_at);
      })
      .catch(function (e) {
        note('تعذر تحميل بيانات اللوحة: ' + (e.name === 'AbortError' ? 'انتهت المهلة (٣٠ ثانية)' : (e.message || e)));
        if (manual) addMsg('تعذر تحميل البيانات: ' + (e.message || e), 'sys');
      })
      .then(function () { btn.classList.remove('spin'); });
  }

  function note(t) {
    var n = $('linkLine');
    if (!t) { n.hidden = true; n.textContent = ''; return; }
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
    listening:['🟢 أسمعك — تكلّم', 'live'],
    heard:    ['✅ سمعتك', 'busy'],
    thinking: ['🔵 أفكّر…', 'busy'],
    deleg:    ['🟣 أوزّع على المدراء…', 'busy'],
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

  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return Promise.resolve();
    busy = true;
    $('btnSend').disabled = true;
    addMsg(text, 'me');
    $('input').value = '';
    autosize();

    var t0 = Date.now();
    setState('thinking');
    var tick = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      setState(s > 12 ? 'deleg' : 'thinking', s + 'ث');
    }, 1500);

    var ctl = new AbortController();
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
        addMsg(abort
          ? 'انتهت المهلة بعد ' + Math.round(CHAT_TIMEOUT / 1000) + ' ثانية. الطلب طويل — جرّب سؤالًا أقصر.'
          : (e.message || String(e)), 'sys');
        setState('error');
      })
      .then(function () {
        clearTimeout(tm);
        clearInterval(tick);
        busy = false;
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
    // No lookbehind: Safari before 16.4 throws on it and the whole script dies.
    var SEP = String.fromCharCode(1);
    var parts = String(s).replace(/([.!?\u061F\u06D4\n])/g, '$1' + SEP).split(SEP);
    var out = [], buf = '';
    parts.forEach(function (p) {
      if ((buf + ' ' + p).trim().length > 220) { if (buf.trim()) out.push(buf.trim()); buf = p; }
      else buf = buf ? buf + ' ' + p : p;
    });
    if (buf.trim()) out.push(buf.trim());
    return out.filter(Boolean).slice(0, 12);
  }

  function speak(text) {
    var s = voicePart(text);
    if (!speakOn || !s || !window.speechSynthesis) return Promise.resolve();
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

  /* ---------- speech in (always listening) ---------- */
  var rec = null, listening = false, wantListen = true, restartT = null, audioCtx = null, analyser = null, meterRaf = null;

  function pauseListening() {
    listening = false;
    try { if (rec) rec.stop(); } catch (e) {}
    $('meter').classList.remove('on');
  }
  function resumeListening() {
    if (!rec || !wantListen) { if (!busy) setState(wantListen ? 'idle' : 'idle'); return; }
    clearTimeout(restartT);
    restartT = setTimeout(startListening, 450);
  }
  function startListening() {
    if (!rec || !wantListen || busy || listening) return;
    if (window.speechSynthesis && window.speechSynthesis.speaking) { resumeListening(); return; }
    try { rec.start(); } catch (e) { clearTimeout(restartT); restartT = setTimeout(startListening, 900); }
  }

  function initVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setState('error', 'المتصفح لا يدعم التعرّف على الصوت — الكتابة تعمل');
      $('btnMic').classList.add('off');
      $('btnMic').textContent = '🎙️ غير مدعوم';
      wantListen = false;
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        startMeter(stream);
        rec = new SR();
        rec.lang = 'ar-SA';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onstart = function () { listening = true; setState('listening'); $('meter').classList.add('on'); };
        rec.onresult = function (e) {
          var finalText = '';
          for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          }
          finalText = finalText.trim();
          if (finalText.length > 1) {
            setState('heard');
            pauseListening();
            ask(finalText);
          }
        };
        rec.onerror = function (e) {
          listening = false;
          $('meter').classList.remove('on');
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            wantListen = false;
            setState('micoff', 'اضغط 🔒 بجانب الرابط → Microphone → Allow ثم حدّث الصفحة');
            return;
          }
          if (e.error === 'no-speech' || e.error === 'aborted' || e.error === 'network') { resumeListening(); return; }
          setState('error', e.error || '');
          resumeListening();
        };
        rec.onend = function () {
          listening = false;
          $('meter').classList.remove('on');
          if (!busy) resumeListening();
        };
        startListening();
      })
      .catch(function (e) {
        wantListen = false;
        $('btnMic').classList.add('off');
        setState('micoff', e && e.name === 'NotAllowedError'
          ? 'اضغط 🔒 بجانب الرابط → Microphone → Allow ثم حدّث الصفحة'
          : (e && e.message) || '');
      });
  }

  function startMeter(stream) {
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
        for (var i = 0; i < bars.length; i++) {
          var v = bins[Math.floor(i * bins.length / bars.length)] / 255;
          bars[i].style.height = Math.max(3, Math.round(v * 22)) + 'px';
        }
        meterRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { /* meter is decoration; ignore */ }
  }

  /* ---------- controls ---------- */
  function autosize() {
    var t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(120, t.scrollHeight) + 'px';
  }
  $('input').addEventListener('input', autosize);
  $('input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(this.value); }
  });
  $('btnSend').addEventListener('click', function () { ask($('input').value); });
  $('btnRefresh').addEventListener('click', function () { loadData(true); });
  $('btnSpeak').addEventListener('click', function () {
    speakOn = !speakOn;
    this.classList.toggle('off', !speakOn);
    this.textContent = speakOn ? '🔊 الصوت' : '🔇 صامت';
    if (!speakOn && window.speechSynthesis) window.speechSynthesis.cancel();
  });
  $('btnMic').addEventListener('click', function () {
    wantListen = !wantListen;
    this.classList.toggle('off', !wantListen);
    this.textContent = wantListen ? '🎙️ الاستماع' : '🎙️ موقوف';
    if (wantListen) { if (rec) startListening(); else initVoice(); }
    else { pauseListening(); setState('idle'); }
  });
  window.addEventListener('resize', function () { clearTimeout(window.__rz); window.__rz = setTimeout(renderOrbs, 200); });

  /* ---------- boot ---------- */
  if (!API.data || API.data.indexOf('REPLACE') !== -1 || API.data.indexOf('YOUR-INSTANCE') !== -1) {
    note('config.js لم يُعبّأ بعد — انسخ config.example.js إلى config.js وضع مسارات n8n الحقيقية.');
  }
  setState('idle');
  addMsg('أنا معك. اسألني عن الفريق، العملاء، الفلوس، أو التسويق — أو أعطني أمرًا وأنا أوزّعه على المدراء.', 'ai');

  loadData();
  if (REFRESH_MS) setInterval(function () { if (!busy) loadData(); }, REFRESH_MS);
  initVoice();
})();
