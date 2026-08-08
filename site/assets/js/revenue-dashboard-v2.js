// Revenue Command Center v2 — REAL client data, no demo numbers.
// Auth = the client-portal session (bp_session marker + the httpOnly server
// cookie the /account OTP login sets). Data = the client's own CRM orders
// (/api/requests?action=my-orders), operational overview (my-overview) and
// ops lists (my-ops). Sections with no data yet render honest empty states.
(() => {
  const content = document.getElementById('dashboardContent');
  const title = document.getElementById('viewTitle');
  const nav = document.getElementById('dashboardNav');
  const sidebar = document.getElementById('sidebar');
  if (!content || !nav) return;

  // ---- auth gate: client portal login required ----
  let session = null;
  try { session = JSON.parse(localStorage.getItem('bp_session') || 'null'); } catch (e) {}
  if (!session) { location.href = '/ar/account?redirect=revenue'; return; }

  const money = (v) => new Intl.NumberFormat('en-US').format(Math.round(v)) + ' ريال';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OPEN = ['قيد المراجعة', 'بانتظار الدفع', 'بانتظار التسعير'];
  const ACTIVE = ['مؤكد - قيد التنفيذ'];
  const DONE = ['مكتمل'];

  const state = { orders: [], overview: null, tasks: [], documents: [], loaded: false, error: false };

  const head = (h, p, actions = '') => `<div class="view-head"><div><h1>${h}</h1><p>${p}</p></div><div class="head-actions">${actions}</div></div>`;
  const kpi = (label, value, note = '', down = false) => `<div class="dash-kpi"><small>${label}</small><strong>${value}</strong>${note ? `<span class="delta${down ? ' down' : ''}">${note}</span>` : ''}</div>`;
  const table = (heads, rows) => `<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const statusChip = (s) => {
    const cls = DONE.includes(s) ? 'ok' : ACTIVE.includes(s) ? 'active' : s === 'ملغي' ? 'off' : 'wait';
    return `<span class="status-chip ${cls}" style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${cls === 'ok' ? '#E3F1E9;color:#006C35' : cls === 'active' ? '#E8EDFB;color:#0B1B5A' : cls === 'off' ? '#F3F4F6;color:#6B7280' : '#FFF7E6;color:#92600A'}">${esc(s || '—')}</span>`;
  };
  const emptyState = (t, p, cta) => `<div class="dash-card" style="text-align:center;padding:48px 24px"><div style="font-size:2rem;margin-bottom:10px">◇</div><h3 style="margin:0 0 6px">${t}</h3><p style="color:#6B7280;max-width:46em;margin:0 auto 16px">${p}</p>${cta || ''}</div>`;
  const pkgCta = '<a class="dash-btn primary" href="/revenue-os#pricing" style="text-decoration:none">استعرض باقات Revenue OS</a>';

  function sums() {
    const open = state.orders.filter((o) => OPEN.includes(o.status));
    const active = state.orders.filter((o) => ACTIVE.includes(o.status));
    const done = state.orders.filter((o) => DONE.includes(o.status));
    const sum = (arr) => arr.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return { open, active, done, pipeline: sum(open) + sum(active), collected: sum(done), wallet: (state.overview && state.overview.walletBalance) || 0 };
  }

  const ordersRows = (list) => list.map((o) => [
    `<b dir="ltr">${esc(o.ref)}</b>`, esc(o.title || '—'), statusChip(o.status),
    o.total ? money(o.total) : '—', esc(o.at || '—'),
  ]);

  const views = {
    overview() {
      const s = sums();
      const recent = state.orders.slice(0, 6);
      return `${head('Revenue Overview', 'أرقامك الحقيقية — من طلباتك وفرصك المسجلة لدى Business Partner.', '<a class="dash-btn" href="/ar/account" style="text-decoration:none">منصّة العملاء</a><a class="dash-btn primary" href="/ar/services" style="text-decoration:none">+ طلب جديد</a>')}
      <div class="dash-kpis">
        ${kpi('Pipeline (فرص مفتوحة + قيد التنفيذ)', money(s.pipeline), s.open.length + s.active.length + ' فرصة')}
        ${kpi('قيد التنفيذ', money(s.active.reduce((x, o) => x + (Number(o.total) || 0), 0)), s.active.length + ' طلب مؤكد')}
        ${kpi('المكتمل (محصّل)', money(s.collected), s.done.length + ' طلب مكتمل')}
        ${kpi('رصيد المحفظة', money(s.wallet), '')}
      </div>
      <div class="dash-grid-2">
        <article class="dash-card"><div class="dash-card-head"><div><h3>تقدم الفرص</h3><small>حسب الحالة الفعلية</small></div></div>
          <div class="funnel">
            ${[['قيد المراجعة', state.orders.filter((o) => o.status === 'قيد المراجعة').length], ['بانتظار الدفع', state.orders.filter((o) => o.status === 'بانتظار الدفع').length], ['مؤكد - قيد التنفيذ', s.active.length], ['مكتمل', s.done.length]].map(([label, n], i, all) => {
              const max = Math.max(1, ...all.map((x) => x[1]));
              return `<div class="funnel-row"><span>${label}</span><div class="progress"><i style="width:${Math.round((n / max) * 100)}%"></i></div><b>${n}</b></div>`;
            }).join('')}
          </div></article>
        <article class="dash-card"><div class="dash-card-head"><div><h3>آخر الأنشطة</h3><small>أحدث طلباتك وفرصك</small></div></div>
          ${recent.length ? table(['المرجع', 'الطلب', 'الحالة', 'المبلغ', 'التاريخ'], ordersRows(recent)) : '<p style="color:#6B7280;padding:12px">لا توجد طلبات بعد — ابدأ من صفحة الخدمات أو باقات Revenue OS.</p>'}
        </article>
      </div>`;
    },
    pipeline() {
      const s = sums();
      const list = state.orders.filter((o) => o.status !== 'ملغي');
      return `${head('الفرص والـPipeline', 'كل فرصك وطلباتك المفتوحة والمكتملة — بيانات حقيقية من سجلك.')}
      <div class="dash-kpis">${kpi('إجمالي الـPipeline', money(s.pipeline))}${kpi('فرص مفتوحة', String(s.open.length))}${kpi('قيد التنفيذ', String(s.active.length))}${kpi('مكتمل', String(s.done.length))}</div>
      ${list.length ? `<article class="dash-card">${table(['المرجع', 'الفرصة / الخدمة', 'الحالة', 'المبلغ', 'التاريخ'], ordersRows(list))}</article>` : emptyState('لا توجد فرص بعد', 'أول فرصة تظهر هنا فور تقديم طلب أو تفعيل باقة Revenue OS.', pkgCta)}`;
    },
    revenue() {
      const s = sums();
      const tx = (state.overview && state.overview.walletTransactions) || [];
      return `${head('الإيرادات والتحصيل', 'المبالغ المكتملة ورصيد محفظتك وحركاتها — بيانات حقيقية.')}
      <div class="dash-kpis">${kpi('المحصّل (طلبات مكتملة)', money(s.collected))}${kpi('رصيد المحفظة', money(s.wallet))}${kpi('حركات المحفظة', String(tx.length))}</div>
      ${tx.length ? `<article class="dash-card"><div class="dash-card-head"><div><h3>حركات المحفظة</h3></div></div>${table(['النوع', 'المبلغ', 'ملاحظة', 'التاريخ'], tx.map((t) => [esc(t.type === 'topup' ? 'شحن' : 'سداد'), money(Math.abs(Number(t.amount) || 0)), esc(t.note || '—'), esc(String(t.created_at || '').slice(0, 10))]))}</article>` : emptyState('لا توجد حركات مالية بعد', 'تظهر هنا الدفعات المحصلة وحركات محفظتك فور اعتمادها.', '')}`;
    },
    tasks() {
      const t = state.tasks;
      return `${head('المهام وSLA', 'المهام المطلوبة منك ومن فريقنا — من مركز عمليات العميل.')}
      ${t.length ? `<article class="dash-card">${table(['المهمة', 'الحالة', 'الأولوية', 'الاستحقاق'], t.map((x) => [esc(x.title), statusChip(x.status === 'done' ? 'مكتمل' : 'قيد المراجعة'), esc(x.urgency || 'عادي'), esc(String(x.due_at || '—').slice(0, 10))]))}</article>` : emptyState('لا توجد مهام حالياً', 'تظهر المهام هنا عندما يسندها فريق التشغيل إليك أو لفريقنا ضمن باقتك.', '')}`;
    },
    documents() {
      const d = state.documents;
      return `${head('المستندات', 'مستنداتك المرفوعة في مركز عمليات العميل.')}
      ${d.length ? `<article class="dash-card">${table(['المستند', 'التصنيف', 'حالة التحقق', 'التاريخ'], d.map((x) => [esc(x.title), esc(x.category || '—'), statusChip(x.verify_status === 'verified' ? 'مكتمل' : 'قيد المراجعة'), esc(String(x.created_at || '').slice(0, 10))]))}</article>` : emptyState('لا توجد مستندات بعد', 'ارفع مستنداتك من منصّة العملاء وتظهر هنا مباشرة.', '<a class="dash-btn primary" href="/ar/account" style="text-decoration:none">فتح منصّة العملاء</a>')}`;
    },
  };
  // Sections that activate with a running Revenue OS package — honest empty
  // states, no invented numbers.
  const soon = {
    accounts: ['الحسابات المستهدفة', 'قوائم الشركات المستهدفة (ICP) تُبنى وتظهر هنا مع بدء تشغيل باقتك.'],
    leads: ['العملاء المحتملون', 'العملاء المحتملون المؤهلون يظهرون هنا مع تشغيل حملات باقتك.'],
    meetings: ['الاجتماعات', 'اجتماعاتك مع صناع القرار تُسجّل هنا مع بدء التشغيل.'],
    campaigns: ['الحملات والتواصل', 'حملات التواصل متعدد القنوات تظهر هنا مع بدء التشغيل.'],
    suppliers: ['الموردون والطلبات', 'الموردون المؤهلون وطلبات RFQ تظهر هنا مع تشغيل مسار الموردين.'],
    commissions: ['العمولات', 'عمولات النجاح والإغلاق تُحتسب على الإيراد المحصّل وتُعرض هنا مع أول صفقة.'],
    reports: ['التقارير', 'تقاريرك الدورية تُنشر هنا حسب باقتك (شهري / أسبوعي / لوحات تنفيذية).'],
  };
  Object.keys(soon).forEach((k) => {
    views[k] = () => head(soon[k][0], 'بيانات حقيقية فقط — لا أرقام تجريبية.') + emptyState(soon[k][0], soon[k][1], pkgCta);
  });

  const titles = { overview: 'نظرة عامة', accounts: 'الحسابات المستهدفة', leads: 'العملاء المحتملون', pipeline: 'الفرص والـPipeline', meetings: 'الاجتماعات', campaigns: 'الحملات والتواصل', suppliers: 'الموردون والطلبات', revenue: 'الإيرادات والتحصيل', commissions: 'العمولات', tasks: 'المهام وSLA', documents: 'المستندات', reports: 'التقارير' };
  let current = 'overview';
  function render() {
    if (!state.loaded && !state.error) { content.innerHTML = '<div class="dash-card" style="text-align:center;padding:60px">جارٍ تحميل بياناتك…</div>'; return; }
    if (state.error) { content.innerHTML = emptyState('تعذّر تحميل البيانات', 'سجّل الدخول من منصّة العملاء ثم عد إلى اللوحة.', '<a class="dash-btn primary" href="/ar/account?redirect=revenue" style="text-decoration:none">تسجيل الدخول</a>'); return; }
    content.innerHTML = (views[current] || views.overview)();
    if (title) title.textContent = titles[current] || '';
  }
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    current = btn.getAttribute('data-view');
    render();
    if (sidebar) sidebar.classList.remove('open');
  });
  const drawer = document.getElementById('drawerBtn');
  if (drawer && sidebar) drawer.addEventListener('click', () => sidebar.classList.toggle('open'));

  render();
  const jf = (u) => fetch(u, { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
  Promise.all([
    jf('/api/requests?action=my-orders'),
    jf('/api/requests?action=my-overview'),
    jf('/api/requests?action=my-ops&what=tasks'),
    jf('/api/requests?action=my-ops&what=documents'),
  ]).then(([ord, ov, tk, dc]) => {
    if (ord && ord.ok) state.orders = ord.orders || [];
    else if (ord && ord.error === 'unauthorized') { location.href = '/ar/account?redirect=revenue'; return; }
    if (ov && ov.ok) state.overview = ov;
    if (tk && tk.ok) state.tasks = tk.items || [];
    if (dc && dc.ok) state.documents = dc.items || [];
    state.loaded = true;
    render();
  }).catch(() => { state.error = true; render(); });
})();
