/* HR Employer App (/hr/employer/*) — logic + data layer.
   All UI reads/writes go through HRStore (adapter). Today HRStore serves
   site/data/hr-mock.json + a localStorage overlay for mutations; swapping in
   real APIs later means reimplementing the same HRStore methods with fetch —
   no page code changes. */
(function () {
  "use strict";
  if (!document.body || !document.body.getAttribute("data-hr-page")) return;
  var PAGE = document.body.getAttribute("data-hr-page");

  /* ---------- utils ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    var h = d.getHours(), m = ("0" + d.getMinutes()).slice(-2), am = h < 12 ? "ص" : "م";
    h = h % 12 || 12;
    return h + ":" + m + " " + am;
  }
  function dayName(iso) { return ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(iso).getDay()]; }
  function initials(name) { return String(name || "؟").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join(""); }
  function readLS(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var toastTimer = null;
  function toast(msg, actionLabel, onAction) {
    var root = $("hr-toast-root");
    if (!root) return;
    clearTimeout(toastTimer);
    root.innerHTML = '<div class="hr-toast" role="status"><span>' + esc(msg) + "</span>" +
      (actionLabel ? '<button type="button" id="hr-toast-act">' + esc(actionLabel) + "</button>" : "") + "</div>";
    if (actionLabel && onAction) {
      $("hr-toast-act").addEventListener("click", function () { root.innerHTML = ""; onAction(); });
    }
    toastTimer = setTimeout(function () { root.innerHTML = ""; }, 6000);
  }
  function confirmModal(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var root = $("hr-modal-root");
      root.innerHTML = '<div class="hr-modal" role="dialog" aria-modal="true"><div class="hr-modal-in">' +
        "<h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>" +
        '<div class="m-actions"><button class="hr-btn hr-btn-ghost" id="hm-no">إلغاء</button>' +
        '<button class="hr-btn ' + (danger ? "hr-btn-danger" : "hr-btn-primary") + '" id="hm-ok">' + esc(okLabel || "تأكيد") + "</button></div></div></div>";
      function close(v) { root.innerHTML = ""; resolve(v); }
      $("hm-no").addEventListener("click", function () { close(false); });
      $("hm-ok").addEventListener("click", function () { close(true); });
      root.firstChild.addEventListener("click", function (e) { if (e.target === root.firstChild) close(false); });
    });
  }

  /* ---------- data layer (adapter) ---------- */
  var HRStore = (function () {
    var DATA = null, loadErr = null;
    var OV_KEY = "bp_hr_overlay";
    function overlay() { return readLS(OV_KEY, { stages: {}, jobs: [], jobEdits: {}, notes: {}, ratings: {}, read: {}, activities: [] }); }
    function saveOverlay(ov) { writeLS(OV_KEY, ov); }

    var REAL_MODE = false;
    function loadRealJobs() {
      var code = hrRealCode();
      if (!code) return Promise.resolve();
      return fetch("/api/candidates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list-postings", code: code }),
      }).then(function (r) { return r.json(); }).then(function (d2) {
        if (!d2 || !d2.ok || !d2.postings || !d2.postings.length) return;
        DATA.mockJobs = DATA.jobs;
        DATA.jobs = d2.postings.map(function (pp) {
          return { id: pp.id, companyId: "real", title: pp.title, dept: pp.field || "عام", city: pp.city || "", country: "السعودية", branch: "", type: "دوام كامل", workMode: "حضوري", openings: 1, status: pp.status === "نشطة" ? "منشورة" : pp.status === "مغلقة" ? "مغلقة" : (pp.status || "منشورة"), postedAt: "", closesAt: "", hiringManager: "", salaryVisible: false, description: pp.description || "", skills: [], mustHave: [], languages: ["العربية"], real: true };
        });
        REAL_MODE = true;
      }).catch(function () {});
    }
    function ready() {
      if (DATA) return Promise.resolve(DATA);
      if (loadErr) return Promise.reject(loadErr);
      return fetch("/data/hr-mock.json").then(function (r) {
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      }).then(function (d) { DATA = d; return loadRealJobs().then(function () { return DATA; }); })
        .catch(function (e) { loadErr = e; throw e; });
    }
    function jobs() {
      var ov = overlay();
      return DATA.jobs.map(function (j) { return Object.assign({}, j, ov.jobEdits[j.id] || {}); }).concat(ov.jobs);
    }
    function job(id) {
      var hit = jobs().filter(function (j) { return j.id === id; })[0];
      if (hit) return hit;
      return (DATA.mockJobs || []).filter(function (j) { return j.id === id; })[0] || null;
    }
    function candidates() { return DATA.candidates; }
    function candidate(id) { return DATA.candidates.filter(function (c) { return c.id === id; })[0] || null; }
    function applications() {
      if (REAL_MODE) return []; // لا عينات في الحساب الحقيقي — المتقدمون الحقيقيون يُربطون من الموقع
      var ov = overlay();
      return DATA.applications.map(function (a) {
        var out = Object.assign({}, a);
        if (ov.stages[a.id]) out.stage = ov.stages[a.id];
        if (ov.read[a.id]) out.unread = false;
        out.candidate = candidate(a.candidateId);
        out.job = job(a.jobId);
        return out;
      }).filter(function (a) { return a.candidate && a.job; });
    }
    function application(id) { return applications().filter(function (a) { return a.id === id; })[0] || null; }
    function stageOf(key) {
      return DATA.stages.concat(DATA.sideStages).filter(function (s) { return s.key === key; })[0] || { key: key, label: key, color: "gray" };
    }
    function activities() {
      var ov = overlay();
      return (REAL_MODE ? ov.activities : ov.activities.concat(DATA.activities)).slice(0, 30);
    }
    function logActivity(type, text) {
      var ov = overlay();
      ov.activities.unshift({ id: "ac_l" + Date.now(), at: new Date().toISOString(), type: type, text: text });
      ov.activities = ov.activities.slice(0, 40);
      saveOverlay(ov);
    }
    function moveStage(appId, stageKey) {
      var a = application(appId);
      if (!a) return null;
      var prev = a.stage;
      var ov = overlay();
      ov.stages[appId] = stageKey;
      saveOverlay(ov);
      logActivity("stage", "نُقل " + a.candidate.name + " إلى مرحلة «" + stageOf(stageKey).label + "» لوظيفة " + a.job.title);
      return prev;
    }
    function setStageSilent(appId, stageKey) {
      var ov = overlay();
      ov.stages[appId] = stageKey;
      saveOverlay(ov);
    }
    function markRead(appId) {
      var ov = overlay();
      if (!ov.read[appId]) { ov.read[appId] = true; saveOverlay(ov); }
    }
    function addJob(jobData, publish) {
      var ov = overlay();
      var id = "job_l" + Date.now();
      var j = Object.assign({ id: id, companyId: DATA.company.id, qualifiedCount: 0, hiringManager: DATA.user.name }, jobData, {
        status: publish ? "منشورة" : "مسودة",
        postedAt: publish ? new Date().toISOString().slice(0, 10) : "",
      });
      ov.jobs.push(j);
      saveOverlay(ov);
      logActivity("job", (publish ? "نُشرت وظيفة " : "حُفظت مسودة وظيفة ") + (j.title || "بدون مسمى"));
      return j;
    }
    function editJob(id, patch) {
      var ov = overlay();
      var local = ov.jobs.filter(function (j) { return j.id === id; })[0];
      if (local) Object.assign(local, patch);
      else ov.jobEdits[id] = Object.assign(ov.jobEdits[id] || {}, patch);
      saveOverlay(ov);
    }
    function notesFor(refId) { return overlay().notes[refId] || []; }
    function addNote(refId, body, shared) {
      var ov = overlay();
      (ov.notes[refId] = ov.notes[refId] || []).unshift({ at: new Date().toISOString(), by: DATA.user.name, body: body, shared: !!shared });
      saveOverlay(ov);
    }
    function ratingFor(refId) { return overlay().ratings[refId] || null; }
    function setRating(refId, r) {
      var ov = overlay();
      ov.ratings[refId] = Object.assign({ at: new Date().toISOString(), by: DATA.user.name }, r);
      saveOverlay(ov);
    }
    function bag(key) { var ov = overlay(); return ov[key] || (Array.isArray(DEFAULT_BAGS[key]) ? [] : {}); }
    var DEFAULT_BAGS = { team: [], offers: [], ivExtra: [], ivEdits: {}, comms: [], companyProfile: {}, prefs: {}, manualCands: [], invites2: {} };
    function setBag(key, val) { var ov = overlay(); ov[key] = val; saveOverlay(ov); }
    function company() { return Object.assign({}, DATA.company, bag("companyProfile")); }
    return {
      ready: ready,
      data: function () { return DATA; },
      jobs: jobs, job: job, candidates: candidates, candidate: candidate,
      applications: applications, application: application, stageOf: stageOf,
      activities: activities, moveStage: moveStage, setStageSilent: setStageSilent,
      markRead: markRead, addJob: addJob, editJob: editJob,
      notesFor: notesFor, addNote: addNote, ratingFor: ratingFor, setRating: setRating,
      logActivity: logActivity, bag: bag, setBag: setBag, company: company,
      isReal: function () { return REAL_MODE; },
    };
  })();

  /* ---------- auth gate ---------- */
  // Same key the employer dashboard/login already use (bp_emp_code); the demo
  // flag lets anyone explore the app with the mock data set.
  var CODE = (function () { try { return localStorage.getItem("bp_emp_code") || ""; } catch (e) { return ""; } })();
  var DEMO_OK = readLS("bp_hr_demo", false);
  function hrRealCode() {
    var c = CODE || "";
    return c && ["BP-DEMO", "BP-EMP-DEMO"].indexOf(c.toUpperCase()) < 0 ? c : "";
  }
  if (!CODE && !DEMO_OK) {
    var content = $("hr-content");
    if (content) {
      content.innerHTML = '<div class="hr-gate"><div style="font-size:2rem">🔐</div>' +
        "<h2>سجّل الدخول للوحة صاحب العمل</h2>" +
        "<p>وظائفك ومتقدموك ومسار التوظيف في مكان واحد. سجّل الدخول بحساب شركتك أو استكشف اللوحة بالبيانات التجريبية.</p>" +
        '<a class="hr-btn hr-btn-primary" style="width:100%" href="/ar/employer-login">تسجيل الدخول</a>' +
        '<button class="hr-btn hr-btn-ghost" style="width:100%;margin-top:10px" id="hr-gate-demo">استكشف بالبيانات التجريبية</button></div>';
      var gd = $("hr-gate-demo");
      if (gd) gd.addEventListener("click", function () { writeLS("bp_hr_demo", true); location.reload(); });
    }
    initChrome(false);
    return;
  }

  /* ---------- chrome (sidebar/topbar) ---------- */
  function initChrome(withData) {
    var shell = $("hr-shell");
    if (readLS("bp_hr_side_collapsed", false)) shell.classList.add("side-collapsed");
    var col = $("hr-collapse");
    if (col) col.addEventListener("click", function () {
      shell.classList.toggle("side-collapsed");
      writeLS("bp_hr_side_collapsed", shell.classList.contains("side-collapsed"));
    });
    var burger = $("hr-burger"), overlayEl = $("hr-overlay");
    if (burger) burger.addEventListener("click", function () { shell.classList.add("side-open"); });
    if (overlayEl) overlayEl.addEventListener("click", function () { shell.classList.remove("side-open"); });
    var gq = $("hr-global-q");
    if (gq) gq.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && gq.value.trim()) location.href = "/hr/employer/applicants?q=" + encodeURIComponent(gq.value.trim());
    });
    var nb = $("hr-notif"); if (nb) nb.addEventListener("click", function () { toast("لا إشعارات جديدة — مركز الإشعارات يتفعّل مع ربط الأحداث الحقيقية."); });
    var mb = $("hr-msgs"); if (mb) mb.addEventListener("click", function () { location.href = "/hr/employer/messages"; });
    if (!withData) return;
    HRStore.ready().then(function (d) {
      var ses = readLS("bp_session", null);
      var realCo = (function () { try { return localStorage.getItem("bp_emp_company") || ""; } catch (e) { return ""; } })();
      var uName = hrRealCode() && ses && (ses.name || ses.email) ? (ses.name || String(ses.email).split("@")[0]) : d.user.name;
      var coName = hrRealCode() && realCo ? realCo : (hrRealCode() ? "حسابك المشترك" : d.company.name);
      $("hr-user-name").textContent = uName;
      $("hr-user-co").textContent = coName;
      $("hr-user-av").textContent = initials(uName);
      $("hr-co-name").textContent = coName;
      $("hr-co-logo").textContent = initials(coName);
      var newN = HRStore.applications().filter(function (a) { return a.unread; }).length;
      var badge = $("nav-new-count");
      if (badge && newN) { badge.textContent = newN; badge.hidden = false; }
      var dot = $("hr-notif-dot");
      if (dot && newN) dot.hidden = false;
    }).catch(function () {});
  }
  initChrome(true);

  function dataError(rootId) {
    var r = $(rootId);
    if (r) r.innerHTML = '<div class="hr-error">تعذّر تحميل البيانات — أعد تحميل الصفحة أو حاول لاحقاً.</div>';
  }

  var STAGE_TAG = { blue: "t-blue", purple: "t-purple", teal: "t-teal", orange: "t-orange", green: "t-green", red: "t-red", gray: "" };
  function stageTag(key) {
    var s = HRStore.stageOf(key);
    return '<span class="hr-tag ' + (STAGE_TAG[s.color] || "") + '">' + esc(s.label) + "</span>";
  }
  function candTags(c) {
    return (c.skills || []).slice(0, 3).map(function (s) { return '<span class="hr-tag">' + esc(s) + "</span>"; }).join("");
  }

  /* ================= dashboard ================= */
  function pageDashboard() {
    HRStore.ready().then(function (d) {
      $("dash-hello").textContent = "مرحباً " + d.user.name + " 👋";
      // «من تريد توظيفه اليوم؟» — يدخل مباشرة على مسار الإنشاء بالذكاء
      function goCreate(t) { location.href = "/hr/employer/jobs/new?title=" + encodeURIComponent(t); }
      var ask = $("dash-ask"), askGo = $("dash-ask-go"), chips = $("dash-ask-chips");
      if (askGo) askGo.addEventListener("click", function () { if (ask.value.trim()) goCreate(ask.value.trim()); else ask.focus(); });
      if (ask) ask.addEventListener("keydown", function (e) { if (e.key === "Enter" && ask.value.trim()) goCreate(ask.value.trim()); });
      if (chips) chips.querySelectorAll(".hr-chip").forEach(function (c) { c.addEventListener("click", function () { goCreate(c.textContent); }); });
      var apps = HRStore.applications(), jobs = HRStore.jobs();
      var mainStages = d.stages.map(function (s) { return s.key; });
      var inPipe = apps.filter(function (a) { return mainStages.indexOf(a.stage) > -1; });
      var newApps = apps.filter(function (a) { return a.unread; });
      var ivSrc = HRStore.isReal() ? [] : d.interviews;
      var upcoming = ivSrc.filter(function (iv) { return new Date(iv.at) > new Date("2026-07-23"); });
      var recommended = apps.filter(function (a) { return a.aiRecommended && ["hired", "rejected", "unqualified"].indexOf(a.stage) < 0; });
      var activeJobs = jobs.filter(function (j) { return j.status === "منشورة"; });
      var offers = apps.filter(function (a) { return a.stage === "offer"; });

      var kpis = [
        ["إجمالي المتقدمين", apps.length, "+18%", "up", "آخر 30 يوماً", "/hr/employer/applicants", "users", "t-blue"],
        ["مرشّحون جدد", newApps.length, "+4", "up", "بانتظار المراجعة", "/hr/employer/applicants", "spark", "t-teal"],
        ["المقابلات القادمة", upcoming.length, "هذا الأسبوع", "", "", "/hr/employer/interviews", "calendar", "t-orange"],
        ["مرشّحون موصى بهم", recommended.length, "AI", "", "بحسب المطابقة", "/hr/employer/applicants", "spark", "t-purple"],
        ["الوظائف النشطة", activeJobs.length, "", "", "من أصل " + jobs.length, "/hr/employer/jobs", "briefcase", "t-green"],
        ["العروض المعلقة", offers.length, "", "", "بانتظار الرد", "/hr/employer/offers", "filetext", "t-orange"],
      ];
      $("dash-kpis").innerHTML = kpis.map(function (k) {
        return '<a class="hr-kpi" href="' + k[5] + '"><span class="k-top"><span>' + k[0] + "</span></span>" +
          '<span class="k-num">' + k[1] + "</span>" +
          '<span class="k-sub">' + (k[2] ? '<span class="k-delta ' + (k[3] || "") + '">' + k[2] + "</span>" : "") + (k[4] ? "<span>" + k[4] + "</span>" : "") + "</span>" +
          '<span class="k-link">عرض التفاصيل ←</span></a>';
      }).join("");

      // funnel
      var funnelDefs = [
        ["إجمالي المتقدمين", apps.length],
        ["تمت مراجعتهم", apps.filter(function (a) { return ["review", "shortlist", "interview", "offer", "hired"].indexOf(a.stage) > -1; }).length],
        ["مؤهلون", apps.filter(function (a) { return ["shortlist", "interview", "offer", "hired"].indexOf(a.stage) > -1; }).length],
        ["مقابلات", apps.filter(function (a) { return ["interview", "offer", "hired"].indexOf(a.stage) > -1; }).length],
        ["تم التوظيف", apps.filter(function (a) { return a.stage === "hired"; }).length],
      ];
      var max = Math.max(apps.length, 1);
      $("dash-funnel").innerHTML = funnelDefs.map(function (f, i) {
        var pct = Math.round((f[1] / max) * 100);
        return '<div class="f-row"><span>' + f[0] + '</span><span class="f-bar"><span class="f-fill" style="width:' + pct + "%;opacity:" + (1 - i * 0.13) + '"></span></span><span class="f-n">' + f[1] + "</span></div>";
      }).join("");

      // interviews
      $("dash-interviews").innerHTML = upcoming.length ? upcoming.map(function (iv) {
        var c = HRStore.candidate(iv.candidateId), j = HRStore.job(iv.jobId);
        return '<div class="hr-cand"><span class="hr-avatar">' + esc(initials(c.name)) + '</span><div class="c-body"><b>' + esc(c.name) + '</b><div class="c-sub">' + esc(j.title) + " · " + dayName(iv.at) + " " + fmtDate(iv.at) + " · " + fmtTime(iv.at) + '</div><div class="c-sub">' + esc(iv.type) + " · " + esc(iv.panel.join("، ")) + '</div></div><a class="hr-btn hr-btn-sm hr-btn-ghost" href="/hr/employer/applicant?id=' + iv.applicationId + '">التفاصيل</a></div>';
      }).join("") : '<div class="hr-empty"><b>لا مقابلات قادمة</b><p>حدد مقابلة من ملف أي مرشّح.</p></div>';

      // active jobs table
      $("dash-jobs").innerHTML = '<table class="hr-tbl"><thead><tr><th>الوظيفة</th><th>المدينة</th><th>المتقدمون</th><th>الحالة</th><th>تاريخ النشر</th><th></th></tr></thead><tbody>' +
        activeJobs.slice(0, 5).map(function (j) {
          var n = apps.filter(function (a) { return a.jobId === j.id; }).length;
          return '<tr><td><a class="t-title" href="/hr/employer/job?id=' + j.id + '">' + esc(j.title) + '</a><div class="t-sub">' + esc(j.dept) + "</div></td><td>" + esc(j.city) + "</td><td>" + n + "</td><td>" + jobStatusTag(j.status) + "</td><td>" + fmtDate(j.postedAt) + '</td><td><a class="hr-link" href="/hr/employer/applicants?job=' + j.id + '">المتقدمون</a></td></tr>';
        }).join("") + "</tbody></table>";

      // recommended
      $("dash-recommended").innerHTML = recommended.length ? recommended.slice(0, 4).map(function (a) {
        var c = a.candidate;
        return '<div class="hr-cand"><span class="hr-avatar">' + esc(initials(c.name)) + '</span><div class="c-body"><b>' + esc(c.name) + '</b> <span class="hr-match">' + c.match + '%</span><div class="c-sub">' + esc(c.title) + " · خبرة " + c.years + " سنة · " + esc(c.city) + '</div></div><span style="display:flex;gap:6px"><a class="hr-btn hr-btn-sm hr-btn-ghost" href="/hr/employer/applicant?id=' + a.id + '">الملف</a><a class="hr-btn hr-btn-sm hr-btn-soft" href="/hr/employer/applicant?id=' + a.id + '#contact">تواصل</a></span></div>';
      }).join("") : '<div class="hr-empty"><b>لا توصيات بعد</b></div>';

      // activity
      var typeIc = { apply: "📥", stage: "🔁", interview: "📅", offer: "📄", job: "📋" };
      $("dash-activity").innerHTML = HRStore.activities().slice(0, 6).map(function (ac) {
        return '<div class="hr-cand" style="align-items:center"><span style="font-size:1.05rem">' + (typeIc[ac.type] || "•") + '</span><div class="c-body"><div style="font-size:.85rem">' + esc(ac.text) + '</div><div class="c-sub">' + fmtDate(ac.at) + " · " + fmtTime(ac.at) + "</div></div></div>";
      }).join("");
    }).catch(function () { dataError("hr-content"); });
  }

  var JOB_STATUS_TAG = { "منشورة": "t-green", "مسودة": "", "قيد المراجعة": "t-purple", "متوقفة": "t-orange", "منتهية": "t-red", "مغلقة": "t-red" };
  function jobStatusTag(st) { return '<span class="hr-tag ' + (JOB_STATUS_TAG[st] || "") + '">' + esc(st) + "</span>"; }

  /* ================= jobs list ================= */
  function pageJobs() {
    var view = readLS("bp_hr_jobs_view", "table");
    var pageN = 1, PER = 8;
    function filters() {
      return { q: $("jb-q").value.trim(), status: $("jb-status").value, city: $("jb-city").value, sort: $("jb-sort").value };
    }
    function filtered() {
      var f = filters();
      var apps = HRStore.applications();
      var rows = HRStore.jobs().map(function (j) {
        return Object.assign({}, j, { appsCount: apps.filter(function (a) { return a.jobId === j.id; }).length });
      });
      if (f.q) rows = rows.filter(function (j) { return (j.title + " " + j.dept + " " + (j.titleEn || "")).indexOf(f.q) > -1; });
      if (f.status) rows = rows.filter(function (j) { return j.status === f.status; });
      if (f.city) rows = rows.filter(function (j) { return j.city === f.city; });
      rows.sort(function (a, b) {
        if (f.sort === "apps") return b.appsCount - a.appsCount;
        var da = a.postedAt || "0", db = b.postedAt || "0";
        return f.sort === "old" ? (da > db ? 1 : -1) : (da < db ? 1 : -1);
      });
      return rows;
    }
    function menuHtml(j) {
      var items = j.real
        ? '<a href="/hr/employer/matching">المطابقة الذكية</a>' +
          '<a href="/hr/employer/jobs/new?id=' + j.id + '">تعديل</a>' +
          '<a href="/hr/employer/job?id=' + j.id + '">معاينة</a>' +
          '<button data-act="copy" data-id="' + j.id + '">نسخ الوظيفة</button>' +
          '<button data-act="share" data-id="' + j.id + '">مشاركة رابط التقديم</button>' +
          '<button data-act="close" data-id="' + j.id + '" class="danger">إغلاق الوظيفة</button>'
        : '<a href="/hr/employer/applicants?job=' + j.id + '">عرض المتقدمين</a>' +
          '<a href="/hr/employer/jobs/new?id=' + j.id + '">تعديل</a>' +
          '<a href="/hr/employer/job?id=' + j.id + '">معاينة</a>' +
          '<button data-act="copy" data-id="' + j.id + '">نسخ الوظيفة</button>' +
          '<button data-act="share" data-id="' + j.id + '">مشاركة رابط التقديم</button>' +
          '<button data-act="toggle" data-id="' + j.id + '">' + (j.status === "منشورة" ? "إيقاف مؤقت" : "نشر / إعادة نشر") + "</button>" +
          '<button data-act="close" data-id="' + j.id + '" class="danger">إغلاق الوظيفة</button>';
      return '<div class="hr-menu"><button aria-label="إجراءات" data-menu="' + j.id + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>' +
        '<div class="hr-menu-pop" hidden data-pop="' + j.id + '">' + items + "</div></div>";
    }
    function render() {
      var rows = filtered();
      var wrap = $("jb-wrap");
      var totalPages = Math.max(1, Math.ceil(rows.length / PER));
      if (pageN > totalPages) pageN = totalPages;
      var slice = rows.slice((pageN - 1) * PER, pageN * PER);
      if (!rows.length) {
        wrap.innerHTML = '<div class="hr-empty"><div class="e-ic">📋</div><b>لا توجد وظائف مطابقة</b><p>عدّل الفلاتر أو انشر وظيفة جديدة.</p><a class="hr-btn hr-btn-primary" href="/hr/employer/jobs/new">نشر وظيفة جديدة</a></div>';
      } else if (view === "table") {
        wrap.innerHTML = '<div class="hr-tbl-wrap"><table class="hr-tbl"><thead><tr><th>الوظيفة</th><th>الموقع</th><th>الدوام</th><th>الشواغر</th><th>المتقدمون</th><th>مؤهلون</th><th>مدير التوظيف</th><th>النشر</th><th>الانتهاء</th><th>الحالة</th><th></th></tr></thead><tbody>' +
          slice.map(function (j) {
            return "<tr><td><a class='t-title' href='/hr/employer/job?id=" + j.id + "'>" + esc(j.title) + "</a><div class='t-sub'>" + esc(j.dept) + "</div></td><td>" + esc(j.branch || "") + " · " + esc(j.city) + "</td><td>" + esc(j.type) + "</td><td>" + j.openings + "</td><td><a class='hr-link' href='/hr/employer/applicants?job=" + j.id + "'>" + (j.real ? "—" : j.appsCount) + "</a></td><td>" + (j.real ? "—" : (j.qualifiedCount || 0)) + "</td><td>" + esc(j.hiringManager || "—") + "</td><td>" + fmtDate(j.postedAt) + "</td><td>" + fmtDate(j.closesAt) + "</td><td>" + jobStatusTag(j.status) + "</td><td>" + menuHtml(j) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      } else {
        wrap.innerHTML = '<div class="bd"><div class="hr-grid">' + slice.map(function (j) {
          return '<div class="hr-jcard"><div style="display:flex;justify-content:space-between;gap:8px"><h3><a href="/hr/employer/job?id=' + j.id + '">' + esc(j.title) + "</a></h3>" + menuHtml(j) + "</div>" +
            '<div class="meta"><span>🏢 ' + esc(j.dept) + "</span><span>📍 " + esc(j.city) + "</span><span>🕐 " + esc(j.type) + "</span></div>" +
            '<div class="meta"><span>المتقدمون: <b>' + j.appsCount + "</b></span><span>الشواغر: " + j.openings + "</span></div>" +
            '<div class="foot">' + jobStatusTag(j.status) + '<a class="hr-link" href="/hr/employer/applicants?job=' + j.id + '">المتقدمون ←</a></div></div>';
        }).join("") + "</div></div>";
      }
      var pgn = $("jb-pgn");
      pgn.hidden = totalPages < 2;
      pgn.innerHTML = '<button id="pg-prev"' + (pageN <= 1 ? " disabled" : "") + '>السابق</button><span>صفحة ' + pageN + " من " + totalPages + '</span><button id="pg-next"' + (pageN >= totalPages ? " disabled" : "") + ">التالي</button>";
      var pp = $("pg-prev"), pn = $("pg-next");
      if (pp) pp.addEventListener("click", function () { pageN--; render(); });
      if (pn) pn.addEventListener("click", function () { pageN++; render(); });
      bindMenus(wrap);
    }
    function bindMenus(scope) {
      scope.querySelectorAll("[data-menu]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          var id = b.getAttribute("data-menu");
          document.querySelectorAll(".hr-menu-pop").forEach(function (p) { p.hidden = p.getAttribute("data-pop") !== id ? true : !p.hidden; });
        });
      });
      scope.querySelectorAll(".hr-menu-pop [data-act]").forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
          var j = HRStore.job(id);
          if (!j) return;
          if (act === "copy") {
            HRStore.addJob(Object.assign({}, j, { title: j.title + " (نسخة)", id: undefined }), false);
            toast("نُسخت الوظيفة كمسودة جديدة.");
            render();
          } else if (act === "share") {
            var link = location.origin + "/ar/careers";
            (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast("نُسخ رابط التقديم إلى الحافظة."); }, function () { toast(link); });
          } else if (act === "toggle") {
            HRStore.editJob(id, { status: j.status === "منشورة" ? "متوقفة" : "منشورة" });
            toast(j.status === "منشورة" ? "أُوقفت الوظيفة مؤقتاً." : "نُشرت الوظيفة.");
            render();
          } else if (act === "close") {
            confirmModal("إغلاق الوظيفة", "سيتوقف استقبال المتقدمين على «" + j.title + "». متأكد؟", "إغلاق", true).then(function (ok) {
              if (!ok) return;
              if (j.real && hrRealCode()) {
                fetch("/api/candidates", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "close-posting", code: hrRealCode(), id: j.id }),
                }).then(function (r) { return r.json(); }).then(function (dd) {
                  if (dd && dd.ok) { HRStore.editJob(id, { status: "مغلقة" }); toast("أُغلقت الوظيفة على الموقع."); render(); }
                  else toast("تعذّر الإغلاق — حاول مجدداً.");
                }).catch(function () { toast("خطأ في الاتصال."); });
              } else {
                HRStore.editJob(id, { status: "مغلقة" });
                toast("أُغلقت الوظيفة.");
                render();
              }
            });
          }
        });
      });
    }
    document.addEventListener("click", function () { document.querySelectorAll(".hr-menu-pop").forEach(function (p) { p.hidden = true; }); });
    HRStore.ready().then(function () {
      var cities = {};
      HRStore.jobs().forEach(function (j) { cities[j.city] = 1; });
      $("jb-city").innerHTML = '<option value="">كل المدن</option>' + Object.keys(cities).map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
      ["jb-q", "jb-status", "jb-city", "jb-sort"].forEach(function (id) {
        $(id).addEventListener(id === "jb-q" ? "input" : "change", function () { pageN = 1; render(); });
      });
      function setView(v) {
        view = v;
        writeLS("bp_hr_jobs_view", v);
        $("jb-view-table").classList.toggle("active", v === "table");
        $("jb-view-cards").classList.toggle("active", v === "cards");
        render();
      }
      $("jb-view-table").addEventListener("click", function () { setView("table"); });
      $("jb-view-cards").addEventListener("click", function () { setView("cards"); });
      setView(view);
    }).catch(function () { dataError("jb-wrap"); });
  }

  /* ================= job wizard ================= */
  function skillsForTitle(title) {
    var maps = [
      [/محاسب|مالية/, ["محاسبة عامة", "Excel", "أنظمة ERP", "تقارير مالية"]],
      [/موارد بشرية|HR/, ["قوى", "التأمينات", "عقود عمل", "التوظيف"]],
      [/مبيعات/, ["تطوير أعمال", "التفاوض", "إدارة علاقات العملاء"]],
      [/تسويق/, ["التسويق الرقمي", "إدارة الحملات", "المحتوى"]],
      [/خدمة عملاء|استقبال/, ["التواصل الفعال", "حل المشكلات", "أنظمة CRM"]],
      [/مهندس/, ["قراءة المخططات", "AutoCAD", "إدارة مشاريع"]],
      [/نجار|نجارة/, ["نجارة ديكور", "قراءة رسومات"]],
      [/كهرباء|كهربائي/, ["تمديدات", "إنارة LED", "لوحات توزيع"]],
      [/باريستا|قهوة/, ["تحضير القهوة", "خدمة العملاء", "النظافة"]],
      [/سائق|توصيل/, ["رخصة قيادة سارية", "معرفة الطرق"]],
      [/مدير/, ["قيادة فرق", "تخطيط", "إدارة أداء"]],
    ];
    for (var i = 0; i < maps.length; i++) if (maps[i][0].test(title)) return maps[i][1];
    return ["إتقان مهام الدور", "التواصل الفعال", "العمل ضمن فريق"];
  }

  function pageJobNew() {
    var qs0 = new URLSearchParams(location.search);
    var editId = qs0.get("id") || "";
    var fullMode = editId || qs0.get("mode") === "full";
    // في وضع التعديل/اليدوي: أخفِ بطاقة الإنشاء السريع فوراً قبل تحميل
    // البيانات — الانتظار كان يسبب وميض البطاقة ثم اختفاءها (glitch).
    if (fullMode) {
      var qaEl = $("qp-ask");
      if (qaEl) qaEl.hidden = true;
      var wwEl = $("wiz-wrap");
      if (wwEl) wwEl.hidden = false;
      var subEl = $("jn-sub");
      if (subEl) subEl.textContent = "جارٍ تحميل بيانات الوظيفة…";
    }
    // «اكتب المسمى وانشر»: حقل واحد يقبل مسمى أو طلباً بلغة طبيعية، الذكاء
    // الحقيقي (/api/hire jobdesc) يكتب الوصف، والباقي يُشتق من ملف الشركة
    // وقيم افتراضية موسومة بمصدرها — ولا يضيف الذكاء أي شرط حساس من نفسه.
    var CITIES = ["الرياض", "جدة", "الدمام", "مكة", "المدينة المنورة", "الخبر", "أبها", "تبوك", "بريدة", "عن بعد"];
    var SRC_LABEL = { USER_PROVIDED: "من طلبك", COMPANY_PROFILE: "من ملف الشركة", COMPANY_DEFAULT: "افتراضي الشركة", AI_GENERATED: "أنشأه الذكاء", SYSTEM_DEFAULT: "افتراضي" };
    function realCode() {
      var c = CODE || "";
      return c && ["BP-DEMO", "BP-EMP-DEMO"].indexOf(c.toUpperCase()) < 0 ? c : "";
    }
    function parseNL(text) {
      var raw = String(text || "").trim();
      var out = { raw: raw, title: raw, count: null, city: "", nationality: "", years: null };
      var t = " " + raw + " ";
      CITIES.forEach(function (c) { if (!out.city && t.indexOf(c) > -1) out.city = c; });
      var mN = t.match(/[\s^](\d+)\s/);
      if (mN && Number(mN[1]) <= 500) out.count = Number(mN[1]);
      if (/سعودي/.test(t)) out.nationality = "سعودي";
      var mE = t.match(/خبرة\s*(\d+)/);
      if (mE) out.years = Number(mE[1]);
      var title = raw
        .replace(/أحتاج|ابغى|أبغى|نحتاج|نبغى|مطلوب|توظيف/g, " ")
        .replace(/خبرة\s*\d+\s*(سنوات|سنة|سنين)?/g, " ")
        .replace(/سعوديين|سعوديات|سعودي|سعودية/g, " ")
        .replace(/\d+/g, " ");
      CITIES.forEach(function (c) { title = title.split("بال" + c.replace(/^ال/, "")).join(" ").split("في " + c).join(" ").split(c).join(" "); });
      title = title.replace(/\s+/g, " ").trim();
      out.title = title || raw;
      return out;
    }
    function skillsFor(title) { return skillsForTitle(title); }
    function questionsFor(title, parsed) {
      var qs = ["كم سنة خبرة لديك في " + title + "؟", "ما مدة الإشعار المطلوبة في عملك الحالي؟", "ما الراتب المتوقع؟"];
      if (parsed.city && parsed.city !== "عن بعد") qs.splice(1, 0, "هل أنت متاح للعمل في " + parsed.city + "؟");
      if (/محاسب/.test(title)) qs.splice(1, 0, "هل لديك خبرة في أنظمة ERP؟");
      return qs.slice(0, 5);
    }
    function fallbackDesc(title, city) {
      return "نبحث عن " + title + " للانضمام إلى فريقنا في " + (city || "الرياض") + ".\n\nالمهام:\n• تنفيذ مهام الدور اليومية وفق معايير الجودة المعتمدة.\n• التنسيق مع الفريق وإعداد التقارير الدورية.\n• الالتزام بسياسات الشركة وإجراءات السلامة.\n\nالمتطلبات:\n• خبرة عملية في مجال مشابه.\n• مهارات تواصل وتنظيم عالية.";
    }
    var GEN = null; // { parsed, fields, sections, questions, questionsOff }
    function buildSections(aiText, parsed, d) {
      var co = HRStore.company();
      var txt = String(aiText || "");
      var intro = txt, resp = "", reqs = "";
      var mR = txt.match(/(المهام|المسؤوليات)\s*:?([\s\S]*?)(?=(المتطلبات|المؤهلات)|$)/);
      var mQ = txt.match(/(المتطلبات|المؤهلات)\s*:?([\s\S]*)$/);
      if (mR) { resp = mR[2].trim(); intro = txt.slice(0, mR.index).trim(); }
      if (mQ) { reqs = mQ[2].trim(); if (!mR) intro = txt.slice(0, mQ.index).trim(); }
      return [
        ["about", "نبذة عن الوظيفة", intro || ("فرصة للانضمام إلى " + (co.name || "فريقنا") + " في دور " + parsed.title + ".")],
        ["resp", "المسؤوليات", resp || "• تنفيذ مهام الدور اليومية.\n• التعاون مع الفريق وتحقيق الأهداف."],
        ["reqs", "المؤهلات والمتطلبات", reqs || "• خبرة مناسبة في المجال.\n• مهارات تواصل وتنظيم."],
        ["skills", "المهارات", skillsFor(parsed.title).join("، ")],
        ["details", "تفاصيل العمل", "المدينة: " + (GEN.fields.city.value) + " · الدوام: دوام كامل · عدد الشواغر: " + GEN.fields.count.value + " · الراتب: غير معلن" + (parsed.nationality ? " · الجنسية: " + parsed.nationality + " (بحسب طلبك)" : "")],
        ["benefits", "المزايا", "تأمين طبي · إجازات نظامية · بيئة عمل محفزة (عدّلها بما يناسب شركتك)"],
        ["apply", "خطوات التقديم", "قدّم عبر صفحة الوظيفة وسنتواصل مع المرشحين المناسبين خلال أيام."],
      ];
    }
    function startGeneration(parsed) {
      var d = HRStore.data();
      var co = HRStore.company(); // Company Hiring Defaults (تُعبأ من صفحة الشركة)
      GEN = { parsed: parsed, questionsOff: false, fields: {
        title: { value: parsed.title, source: "USER_PROVIDED", confidence: 1 },
        city: { value: parsed.city || co.city || "الرياض", source: parsed.city ? "USER_PROVIDED" : "COMPANY_PROFILE", confidence: parsed.city ? 1 : 0.8 },
        count: { value: parsed.count || 1, source: parsed.count ? "USER_PROVIDED" : "SYSTEM_DEFAULT", confidence: 1 },
        type: { value: "دوام كامل", source: "COMPANY_DEFAULT", confidence: 0.9 },
        salary: { value: "غير معلن", source: "SYSTEM_DEFAULT", confidence: 1 },
      } };
      if (parsed.nationality) GEN.fields.nationality = { value: parsed.nationality, source: "USER_PROVIDED", confidence: 1 };
      if (parsed.years) GEN.fields.years = { value: "خبرة " + parsed.years + "+ سنوات", source: "USER_PROVIDED", confidence: 1 };
      $("qp-ask").hidden = true;
      $("qp-city-q").hidden = true;
      $("qp-progress").hidden = false;
      var steps = document.querySelectorAll("[data-gp]");
      var si = 0;
      var iv = setInterval(function () {
        if (si > 0) steps[si - 1].classList.add("done");
        if (si < steps.length) { steps[si].classList.add("on"); si++; } else clearInterval(iv);
      }, 850);
      var minWait = new Promise(function (r) { setTimeout(r, 3600); });
      var aiCall = fetch("/api/hire", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "jobdesc", title: parsed.title, field: "", city: GEN.fields.city.value }),
      }).then(function (r) { return r.json(); }).catch(function () { return null; });
      Promise.all([aiCall, minWait]).then(function (rr) {
        clearInterval(iv);
        var aiText = rr[0] && rr[0].ok && rr[0].result ? rr[0].result : "";
        GEN.aiOk = !!aiText;
        GEN.sections = buildSections(aiText || fallbackDesc(parsed.title, GEN.fields.city.value), parsed, d);
        GEN.questions = questionsFor(parsed.title, parsed);
        renderPreview();
      });
    }
    function renderPreview() {
      $("qp-progress").hidden = true;
      $("qp-preview").hidden = false;
      $("qp-quality").textContent = "جودة الإعلان: " + (GEN.aiOk ? "ممتازة" : "جيدة — نص مبدئي، حسّنه بالتعديل المباشر");
      $("qp-understood").innerHTML = '<span class="hr-hint">ما فهمناه:</span> ' + Object.keys(GEN.fields).map(function (k) {
        var f = GEN.fields[k];
        return '<span class="hr-tag" style="margin:2px">' + esc(String(f.value)) + ' <span class="hr-src-tag">' + (SRC_LABEL[f.source] || f.source) + "</span></span>";
      }).join(" ");
      $("qp-doc").innerHTML = '<h2 style="color:var(--hr-navy);margin-bottom:4px">' + esc(GEN.parsed.title) + '</h2><p class="hr-hint" style="margin-bottom:14px">' + esc(GEN.fields.city.value) + " · دوام كامل · اضغط أي فقرة لتعديلها مباشرة</p>" +
        GEN.sections.map(function (sec) {
          return '<div style="margin-bottom:12px"><b style="color:var(--hr-navy);font-size:.9rem">' + sec[1] + '</b><div class="hr-edit-block" contenteditable="true" data-sec="' + sec[0] + '" style="white-space:pre-wrap;font-size:.9rem">' + esc(sec[2]) + "</div></div>";
        }).join("");
      renderQuestions();
      $("qp-doc").querySelectorAll(".hr-edit-block").forEach(function (b) {
        b.addEventListener("blur", function () {
          var k = b.getAttribute("data-sec");
          GEN.sections.forEach(function (sec) { if (sec[0] === k) sec[2] = b.textContent; });
        });
      });
    }
    function renderQuestions() {
      var box = $("qp-questions");
      if (GEN.questionsOff) { box.innerHTML = '<p class="hr-hint">أسئلة الفرز معطّلة لهذه الوظيفة. <button class="hr-link" id="qp-q-on">إعادة تفعيلها</button></p>'; var on = $("qp-q-on"); if (on) on.addEventListener("click", function () { GEN.questionsOff = false; renderQuestions(); }); return; }
      box.innerHTML = GEN.questions.map(function (q, i) {
        return '<div class="hr-cand" style="align-items:center"><div class="c-body" style="font-size:.88rem">' + (i + 1) + ". " + esc(q) + '</div><button class="hr-link" data-qdel="' + i + '">حذف</button></div>';
      }).join("") + '<div style="display:flex;gap:8px;margin-top:10px"><input type="text" id="qp-q-new" placeholder="أضف سؤالاً…" style="flex:1;border:1px solid var(--hr-line);border-radius:9px;padding:7px 11px"><button class="hr-btn hr-btn-sm hr-btn-ghost" id="qp-q-add">إضافة</button></div>';
      box.querySelectorAll("[data-qdel]").forEach(function (b) {
        b.addEventListener("click", function () { GEN.questions.splice(Number(b.getAttribute("data-qdel")), 1); renderQuestions(); });
      });
      $("qp-q-add").addEventListener("click", function () {
        var v = $("qp-q-new").value.trim();
        if (v) { GEN.questions.push(v); renderQuestions(); }
      });
    }
    function composeDescription() {
      return GEN.sections.filter(function (s2) { return ["about", "resp", "reqs", "skills", "benefits", "apply"].indexOf(s2[0]) > -1; })
        .map(function (s2) { return s2[1] + ":\n" + s2[2]; }).join("\n\n");
    }
    function publishNow() {
      var pb = $("qp-publish");
      pb.disabled = true;
      var desc = composeDescription();
      var f = GEN.fields;
      HRStore.addJob({
        title: GEN.parsed.title, city: f.city.value, country: "السعودية", dept: "عام",
        type: f.type.value, workMode: f.city.value === "عن بعد" ? "عن بعد" : "حضوري",
        openings: f.count.value, description: desc, experienceYears: GEN.parsed.years ? GEN.parsed.years + "+" : "",
        closesAt: "", screeningQuestions: GEN.questionsOff ? [] : GEN.questions, _fields: f,
      }, true);
      var rc = realCode();
      var done = function (liveOk) {
        toast(liveOk ? "نُشرت الوظيفة على الموقع وبدأت المطابقة 🎉" : "نُشرت في لوحتك 🎉 (النشر على الموقع يتفعّل مع تسجيل الدخول برمزك)");
        setTimeout(function () { location.href = "/hr/employer/jobs"; }, 900);
      };
      if (!rc) { done(false); return; }
      fetch("/api/candidates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create-posting", code: rc, title: GEN.parsed.title, city: f.city.value, description: desc }),
      }).then(function (r) { return r.json(); }).then(function (dd) { done(!!(dd && dd.ok)); }).catch(function () { done(false); });
    }
    function initQuickCreate() {
      if (fullMode) {
        $("qp-ask").hidden = true;
        $("wiz-wrap").hidden = false;
        $("jn-sub").textContent = "الوضع اليدوي المتقدم — كل التفاصيل تحت سيطرتك.";
        return;
      }
      $("jn-sub").textContent = "";
      var goBtn = $("qp-go");
      function begin() {
        var raw = $("qp-title").value.trim();
        if (!raw) { $("qp-status").textContent = "اكتب المنصب أولاً."; $("qp-title").focus(); return; }
        var parsed = parseNL(raw);
        if (!parsed.city) {
          // سؤال ضروري واحد فقط — المدينة لا يمكن استنتاجها
          $("qp-city-q").hidden = false;
          $("qp-city-q").scrollIntoView({ behavior: "smooth", block: "center" });
          $("qp-city-q").querySelectorAll("[data-city]").forEach(function (b) {
            b.addEventListener("click", function () {
              parsed.city = b.getAttribute("data-city");
              startGeneration(parsed);
            });
          });
          return;
        }
        startGeneration(parsed);
      }
      goBtn.addEventListener("click", begin);
      $("qp-title").addEventListener("keydown", function (e) { if (e.key === "Enter") begin(); });
      $("qp-chips").querySelectorAll(".hr-chip").forEach(function (c) {
        if (c.hasAttribute("data-alt") || c.id === "jn-full") return;
        c.addEventListener("click", function () { $("qp-title").value = c.textContent; begin(); });
      });
      document.querySelectorAll("[data-alt]").forEach(function (b) {
        b.addEventListener("click", function () { toast("هذا الخيار يتفعّل قريباً — الإنشاء بالذكاء جاهز الآن."); });
      });
      var fullBtn = $("jn-full");
      if (fullBtn) fullBtn.addEventListener("click", function () { location.href = "/hr/employer/jobs/new?mode=full"; });
      $("qp-publish").addEventListener("click", publishNow);
      $("qp-regen").addEventListener("click", function () { if (GEN) startGeneration(GEN.parsed); });
      $("qp-edit-toggle").addEventListener("click", function () {
        var first = document.querySelector(".hr-edit-block");
        if (first) { first.focus(); toast("اضغط أي فقرة وعدّلها في مكانها مباشرة."); }
      });
      $("qp-q-off").addEventListener("click", function () { if (GEN) { GEN.questionsOff = true; renderQuestions(); } });
      // انطلاق مباشر من بطاقة «من تريد توظيفه اليوم؟» في اللوحة الرئيسية
      var preset = qs0.get("title");
      if (preset) {
        $("qp-title").value = preset;
        HRStore.ready().then(function () { begin(); });
      }
    }
    HRStore.ready().then(function () { initQuickCreate(); }).catch(function () { initQuickCreate(); });
    var DRAFT_KEY = "bp_hr_job_draft" + (editId ? "_" + editId : "");
    var STEPS = [
      ["basic", "المعلومات الأساسية"], ["location", "الموقع ونوع الدوام"], ["desc", "الوصف والمسؤوليات"],
      ["quals", "المؤهلات والخبرة"], ["skills", "المهارات واللغات"], ["legal", "الجنسية والإقامة"],
      ["salary", "الراتب والمزايا"], ["questions", "أسئلة الفرز"], ["stages", "مراحل التوظيف"],
      ["team", "فريق التوظيف"], ["preview", "المعاينة والنشر"],
    ];
    var step = 0;
    var draft = readLS(DRAFT_KEY, {});
    function saveDraft() { writeLS(DRAFT_KEY, draft); }
    function field(id, label, type, opts) {
      opts = opts || {};
      var req = opts.req ? ' <span class="req">*</span>' : "";
      var val = draft[id] != null ? draft[id] : (opts.def != null ? opts.def : "");
      var inner;
      if (type === "select") inner = '<select id="wf-' + id + '">' + (opts.options || []).map(function (o) { return "<option" + (String(val) === String(o) ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
      else if (type === "textarea") inner = '<textarea id="wf-' + id + '" rows="' + (opts.rows || 4) + '" placeholder="' + esc(opts.ph || "") + '">' + esc(val) + "</textarea>";
      else inner = '<input id="wf-' + id + '" type="' + type + '" value="' + esc(val) + '" placeholder="' + esc(opts.ph || "") + '"' + (opts.min != null ? ' min="' + opts.min + '"' : "") + ">";
      return '<div class="hr-field" data-f="' + id + '"' + (opts.req ? ' data-req="1"' : "") + "><label for=\"wf-" + id + '">' + label + req + "</label>" + inner + (opts.hint ? '<span class="hr-hint">' + opts.hint + "</span>" : "") + '<span class="err">هذا الحقل مطلوب</span></div>';
    }
    var aiNote = '<p class="hr-ai-note">أزرار AI هنا <b>ميزة تجريبية</b> — تعبّئ نصاً مقترحاً جاهزاً للتحرير، والربط بمحرك الذكاء الحقيقي يأتي لاحقاً.</p>';
    function stepHtml(key) {
      switch (key) {
        case "basic": return field("title", "المسمى الوظيفي (عربي)", "text", { req: 1, ph: "مثال: مهندس إنتاج" }) + field("titleEn", "المسمى الوظيفي (إنجليزي)", "text", { ph: "Production Engineer" }) + field("dept", "القسم", "text", { ph: "الهندسة" }) + field("category", "التصنيف المهني", "select", { options: ["", "هندسة", "إداري وسكرتارية", "مالية ومحاسبة", "موارد بشرية", "إنتاج وتصنيع", "تصميم", "لوجستيات ونقل", "أخرى"] }) + field("openings", "عدد الشواغر", "number", { req: 1, def: 1, min: 1 });
        case "location": return field("country", "الدولة", "select", { options: ["السعودية", "الإمارات", "مصر", "أخرى"], def: "السعودية" }) + field("city", "المدينة", "text", { req: 1, ph: "الرياض" }) + field("branch", "الفرع", "text", { ph: "المصنع الرئيسي" }) + field("inKsa", "موقع المرشّح", "select", { options: ["داخل السعودية", "خارج السعودية", "الاثنان"], def: "داخل السعودية" }) + field("workMode", "نمط العمل", "select", { options: ["حضوري", "عن بعد", "هجين"], def: "حضوري" }) + field("type", "نوع الدوام", "select", { options: ["دوام كامل", "دوام جزئي", "مرن", "موسمي", "تدريب"], def: "دوام كامل" });
        case "desc": return '<div class="hr-ai-row"><button type="button" class="hr-ai-btn" data-ai="write">✨ إنشاء وصف وظيفي</button><button type="button" class="hr-ai-btn" data-ai="improve">✨ تحسين الوصف</button><button type="button" class="hr-ai-btn" data-ai="english">✨ نسخة إنجليزية</button></div>' + aiNote + field("description", "الوصف والمسؤوليات", "textarea", { req: 1, rows: 8, ph: "المهام اليومية، نطاق المسؤولية، بيئة العمل…" });
        case "quals": return field("experienceYears", "سنوات الخبرة المطلوبة", "select", { options: ["0-2", "3+", "5+", "8+", "10+"], def: "3+" }) + field("qualification", "المؤهل", "select", { options: ["ثانوية", "دبلوم", "بكالوريوس", "ماجستير", "غير محدد"], def: "بكالوريوس" }) + field("certs", "شهادات مهنية (اختياري)", "text", { ph: "SOCPA، PMP…" });
        case "skills": return '<div class="hr-ai-row"><button type="button" class="hr-ai-btn" data-ai="skills">✨ اقتراح المهارات</button></div>' + aiNote + field("skills", "المهارات (افصل بينها بفاصلة)", "text", { req: 1, ph: "تخطيط إنتاج, AutoCAD, قيادة فرق" }) + field("languages", "اللغات", "text", { def: "العربية", ph: "العربية, الإنجليزية" });
        case "legal": return '<p class="hr-hint" style="margin-bottom:12px">حدد اشتراطات الجنسية فقط إن كانت قانونية وضرورية (مثل قرارات التوطين).</p>' + field("nationalityReq", "الجنسية المطلوبة", "select", { options: ["الكل", "سعودي فقط (توطين)", "غير محدد"], def: "الكل" }) + field("residencyReq", "حالة الإقامة", "select", { options: ["غير مهم", "إقامة سارية", "قابلة للنقل"], def: "غير مهم" }) + field("sponsorship", "نقل الكفالة متاح؟", "select", { options: ["نعم", "لا", "حسب الحالة"], def: "حسب الحالة" }) + field("docs", "المستندات المطلوبة", "text", { ph: "السيرة الذاتية, شهادة المؤهل, الهوية/الإقامة", def: "السيرة الذاتية" });
        case "salary": return '<div class="hr-ai-row"><button type="button" class="hr-ai-btn" data-ai="salary">✨ اقتراح نطاق الراتب</button></div>' + aiNote + field("salaryMin", "الراتب الأدنى (ريال)", "number", { min: 0 }) + field("salaryMax", "الراتب الأعلى (ريال)", "number", { min: 0 }) + field("salaryVisible", "إظهار الراتب للمتقدمين؟", "select", { options: ["لا", "نعم"], def: "لا" }) + field("benefits", "المزايا", "textarea", { rows: 3, ph: "تأمين طبي، بدل سكن ومواصلات…" });
        case "questions": return '<div class="hr-ai-row"><button type="button" class="hr-ai-btn" data-ai="questions">✨ اقتراح أسئلة الفرز</button></div>' + aiNote + field("questions", "أسئلة الفرز (سؤال في كل سطر)", "textarea", { rows: 5, ph: "كم سنة خبرتك في …؟\nهل لديك رخصة قيادة سارية؟" }) + field("mustAnswer", "إلزامية الإجابة", "select", { options: ["إلزامية", "اختيارية"], def: "إلزامية" });
        case "stages": return '<p class="hr-hint" style="margin-bottom:12px">المراحل الافتراضية للمسار — تخصيص المراحل لكل وظيفة يأتي في تحديث لاحق.</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + ["متقدم جديد", "مراجعة أولية", "قائمة مختصرة", "مقابلة", "عرض وظيفي", "تم التوظيف"].map(function (s, i) { return '<span class="hr-tag t-teal">' + (i + 1) + ". " + s + "</span>"; }).join("") + "</div>";
        case "team": return field("hiringManager", "مدير التوظيف", "text", { def: "باهر" }) + field("interviewers", "المحاورون", "text", { ph: "أسماء أعضاء لجنة المقابلات" }) + '<p class="hr-hint">إدارة الأدوار والصلاحيات الكاملة من صفحة «فريق العمل والصلاحيات».</p>';
        case "preview": {
          var d2 = draft;
          return '<h3 style="color:var(--hr-navy);margin-bottom:10px">' + esc(d2.title || "بدون مسمى") + '</h3><div class="hr-kv">' +
            [["القسم", d2.dept], ["المدينة", d2.city], ["الدوام", d2.type], ["نمط العمل", d2.workMode], ["الشواغر", d2.openings], ["الخبرة", d2.experienceYears], ["المؤهل", d2.qualification], ["المهارات", d2.skills], ["الراتب", (d2.salaryMin || "؟") + " – " + (d2.salaryMax || "؟") + " ريال" + (d2.salaryVisible === "نعم" ? " (ظاهر)" : " (مخفي)")]].map(function (kv) { return '<span class="kv"><b>' + kv[0] + "</b>" + esc(kv[1] || "—") + "</span>"; }).join("") +
            '</div><div style="margin-top:14px;padding:12px;background:var(--hr-bg);border-radius:10px;font-size:.87rem;white-space:pre-wrap">' + esc(d2.description || "لا وصف بعد") + "</div>" +
            '<div dir="rtl" style="margin-top:22px;padding-top:16px;border-top:1px solid var(--hr-line);display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end"><button class="hr-btn hr-btn-primary" type="button" id="wiz-publish" style="padding:12px 34px;font-size:1rem">📢 انشر</button><button class="hr-btn hr-btn-ghost" type="button" id="wiz-draft2" style="padding:12px 24px">مسودة</button></div>';
        }
      }
      return "";
    }
    var AI_FILL = {
      write: ["description", function (d) { return "نبحث عن " + (d.title || "موظف") + " للانضمام إلى فريق " + (d.dept || "الشركة") + " في " + (d.city || "الرياض") + ".\n\nالمهام:\n• تنفيذ المهام اليومية للدور وفق أعلى معايير الجودة.\n• التنسيق مع الفرق الداخلية وإعداد التقارير الدورية.\n• الالتزام بإجراءات السلامة وسياسات الشركة.\n\nالمتطلبات:\n• خبرة " + (d.experienceYears || "3+") + " سنوات في مجال مشابه.\n• مهارات تواصل وتنظيم عالية."; }],
      improve: ["description", function (d) { return (d.description || "") + "\n\nلماذا تنضم إلينا؟\n• بيئة عمل سعودية سريعة النمو ومشاريع فعاليات وطنية كبرى.\n• مسار تطوير مهني واضح وتدريب مستمر."; }],
      english: ["description", function (d) { return (d.description || "") + "\n\n— English —\nWe are hiring a " + (d.titleEn || d.title || "professional") + " to join our " + (d.dept || "team") + " in " + (d.city || "Riyadh") + ". You will own day-to-day execution, coordinate with internal teams, and uphold our quality and safety standards."; }],
      skills: ["skills", function (d) { return d.title && d.title.indexOf("مهندس") > -1 ? "قراءة مخططات, AutoCAD, تخطيط إنتاج, تقارير Excel, قيادة فرق" : "إدارة وقت, تواصل فعال, Excel, العمل تحت الضغط, روح الفريق"; }],
      questions: ["questions", function (d) { return "كم سنة خبرتك العملية في " + (d.title || "هذا المجال") + "؟\nما آخر مشروع عملت عليه وما دورك فيه؟\nما مدة الإشعار المطلوبة في عملك الحالي؟\nما الراتب المتوقع؟"; }],
      salary: ["salaryMin", function () { return ""; }],
    };
    function collect() {
      STEPS.forEach(function () {});
      document.querySelectorAll("#wiz-form [id^='wf-']").forEach(function (el) {
        draft[el.id.slice(3)] = el.value;
      });
      saveDraft();
    }
    function validateStep() {
      var ok = true;
      document.querySelectorAll("#wiz-form .hr-field[data-req]").forEach(function (f) {
        var input = f.querySelector("input,select,textarea");
        var bad = !input || !String(input.value).trim();
        f.classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      return ok;
    }
    function renderSteps() {
      $("wiz-steps").innerHTML = STEPS.map(function (s, i) {
        return '<button type="button" data-step="' + i + '" class="' + (i === step ? "active" : i < step ? "done" : "") + '"><span class="n">' + (i < step ? "✓" : i + 1) + "</span><span>" + s[1] + "</span></button>";
      }).join("");
      $("wiz-steps").querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          collect();
          step = Number(b.getAttribute("data-step"));
          render();
        });
      });
    }
    function render() {
      renderSteps();
      $("wiz-form").innerHTML = stepHtml(STEPS[step][0]);
      $("wiz-prev").disabled = step === 0;
      $("wiz-next").hidden = step === STEPS.length - 1;
      $("wiz-save").hidden = step === STEPS.length - 1; // زر «انشر/مسودة» أسفل المعاينة يكفي
      document.querySelectorAll("[data-ai]").forEach(function (b) {
        b.addEventListener("click", function () {
          collect();
          var k = b.getAttribute("data-ai");
          if (k === "salary") {
            draft.salaryMin = draft.salaryMin || 6000;
            draft.salaryMax = draft.salaryMax || 9000;
            toast("نطاق تجريبي مقترح: 6,000–9,000 ريال — عدّله بما يناسبك.");
            render();
            return;
          }
          var def = AI_FILL[k];
          if (!def) return;
          draft[def[0]] = def[1](draft);
          toast("تمت التعبئة (نص تجريبي) — راجعه وعدّله.");
          render();
        });
      });
      var pub = $("wiz-publish"), dr2 = $("wiz-draft2");
      if (pub) pub.addEventListener("click", function () { finish(true); });
      if (dr2) dr2.addEventListener("click", function () { finish(false); });
    }
    function finish(publish) {
      collect();
      if (publish && (!draft.title || !draft.city || !draft.description)) {
        toast("أكمل الحقول الإلزامية أولاً: المسمى، المدينة، الوصف.");
        return;
      }
      var jobData = {
        title: draft.title, titleEn: draft.titleEn, dept: draft.dept || "عام", city: draft.city || "الرياض",
        country: draft.country || "السعودية", branch: draft.branch || "", type: draft.type || "دوام كامل",
        workMode: draft.workMode || "حضوري", openings: Number(draft.openings) || 1,
        salaryMin: Number(draft.salaryMin) || null, salaryMax: Number(draft.salaryMax) || null,
        salaryVisible: draft.salaryVisible === "نعم", experienceYears: draft.experienceYears || "",
        description: draft.description || "", closesAt: "", hiringManager: draft.hiringManager || "",
      };
      if (editId) {
        HRStore.editJob(editId, jobData);
        if (publish) HRStore.editJob(editId, { status: "منشورة" });
        var edited = HRStore.job(editId);
        var rc2 = realCode();
        if (edited && edited.real && rc2) {
          fetch("/api/candidates", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "update-posting", code: rc2, id: editId, title: jobData.title, city: jobData.city, description: jobData.description, status: publish ? "نشطة" : undefined }),
          }).then(function (r) { return r.json(); }).then(function (dd) {
            toast(dd && dd.ok ? "حُفظت التعديلات على الموقع ✓" : "حُفظت محلياً — تعذّر تحديث الموقع، أعد المحاولة.");
          }).catch(function () { toast("حُفظت محلياً — تعذّر الاتصال بالموقع."); });
        } else {
          toast("حُفظت التعديلات.");
        }
      } else {
        HRStore.addJob(jobData, publish);
        toast(publish ? "نُشرت الوظيفة 🎉" : "حُفظت المسودة.");
      }
      writeLS(DRAFT_KEY, {});
      setTimeout(function () { location.href = "/hr/employer/jobs"; }, 700);
    }
    HRStore.ready().then(function () {
      if (editId) {
        var j = HRStore.job(editId);
        if (j && !Object.keys(draft).length) {
          draft = {
            title: j.title, titleEn: j.titleEn, dept: j.dept, city: j.city, country: j.country, branch: j.branch,
            type: j.type, workMode: j.workMode, openings: j.openings, salaryMin: j.salaryMin, salaryMax: j.salaryMax,
            salaryVisible: j.salaryVisible ? "نعم" : "لا", experienceYears: j.experienceYears, description: j.description,
            hiringManager: j.hiringManager,
          };
        }
        $("wiz-title").textContent = "تعديل وظيفة: " + (draft.title || "");
      }
      $("wiz-prev").addEventListener("click", function () { collect(); if (step > 0) { step--; render(); } });
      $("wiz-next").addEventListener("click", function () {
        collect();
        if (!validateStep()) return;
        if (step < STEPS.length - 1) { step++; render(); }
      });
      $("wiz-save").addEventListener("click", function () { collect(); toast("حُفظت المسودة على هذا الجهاز."); });
      render();
    }).catch(function () { dataError("hr-content"); });
  }

  /* ================= job view ================= */
  function pageJobView() {
    var id = new URLSearchParams(location.search).get("id") || "";
    HRStore.ready().then(function () {
      var j = HRStore.job(id);
      var root = $("jv-root");
      if (!j) { root.innerHTML = '<div class="hr-empty"><b>الوظيفة غير موجودة</b><p><a class="hr-link" href="/hr/employer/jobs">رجوع للوظائف</a></p></div>'; return; }
      var apps = HRStore.applications().filter(function (a) { return a.jobId === j.id; });
      root.innerHTML =
        '<div class="hr-page-head"><div><h1>' + esc(j.title) + "</h1><p>" + esc(j.dept) + " · " + esc(j.city) + " · " + esc(j.type) + "</p></div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="hr-btn hr-btn-ghost" href="/hr/employer/jobs/new?id=' + j.id + '">تعديل</a><a class="hr-btn hr-btn-primary" href="/hr/employer/applicants?job=' + j.id + '">المتقدمون (' + apps.length + ")</a></div></div>" +
        '<section class="hr-card"><div class="bd"><div class="hr-kv">' +
        [["الحالة", null, jobStatusTag(j.status)], ["الشواغر", j.openings], ["نمط العمل", j.workMode], ["الخبرة", j.experienceYears], ["تاريخ النشر", fmtDate(j.postedAt)], ["ينتهي", fmtDate(j.closesAt)], ["مدير التوظيف", j.hiringManager]].map(function (kv) { return '<span class="kv"><b>' + kv[0] + "</b>" + (kv[2] || esc(kv[1] == null ? "—" : kv[1])) + "</span>"; }).join("") +
        '</div><div style="margin-top:14px;padding:14px;background:var(--hr-bg);border-radius:12px;font-size:.9rem;white-space:pre-wrap">' + esc(j.description || "") + "</div></div></section>" +
        '<section class="hr-card"><div class="hd"><h2>أحدث المتقدمين</h2><a href="/hr/employer/applicants?job=' + j.id + '">الكل</a></div><div class="bd">' +
        (apps.length ? apps.slice(0, 5).map(function (a) {
          return '<div class="hr-cand"><span class="hr-avatar">' + esc(initials(a.candidate.name)) + '</span><div class="c-body"><b>' + esc(a.candidate.name) + '</b> <span class="hr-match">' + a.candidate.match + '%</span><div class="c-sub">' + esc(a.candidate.title) + " · " + fmtDate(a.appliedAt) + "</div></div>" + stageTag(a.stage) + ' <a class="hr-btn hr-btn-sm hr-btn-ghost" href="/hr/employer/applicant?id=' + a.id + '">الملف</a></div>';
        }).join("") : '<div class="hr-empty"><b>لا متقدمون بعد</b></div>') +
        "</div></section>";
    }).catch(function () { dataError("jv-root"); });
  }

  /* ================= applicants (kanban/table) ================= */
  function pageApplicants() {
    var params = new URLSearchParams(location.search);
    var view = readLS("bp_hr_ap_view", "kanban");
    var selected = {};
    var state = { job: params.get("job") || "", q: params.get("q") || "", nat: "", src: "", match: "" };
    function filtered() {
      var rows = HRStore.applications();
      if (state.job) rows = rows.filter(function (a) { return a.jobId === state.job; });
      if (state.q) rows = rows.filter(function (a) { return (a.candidate.name + " " + a.candidate.title + " " + a.candidate.skills.join(" ")).indexOf(state.q) > -1; });
      if (state.nat === "سعودي") rows = rows.filter(function (a) { return a.candidate.nationality.indexOf("سعودي") === 0; });
      if (state.nat === "غير") rows = rows.filter(function (a) { return a.candidate.nationality.indexOf("سعودي") !== 0; });
      if (state.src) rows = rows.filter(function (a) { return a.source === state.src || a.candidate.source === state.src; });
      if (state.match) rows = rows.filter(function (a) { return a.candidate.match >= Number(state.match); });
      return rows;
    }
    function updateBulk() {
      var n = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
      $("ap-bulk").hidden = !n;
      $("ap-bulk-n").textContent = "محدد: " + n;
    }
    function cardHtml(a) {
      var c = a.candidate;
      return '<div class="hr-ccard' + (a.unread ? " unread" : "") + '" draggable="true" data-app="' + a.id + '" role="article" aria-label="' + esc(c.name) + '">' +
        '<label class="cc-check"><input type="checkbox" data-sel="' + a.id + '"' + (selected[a.id] ? " checked" : "") + "></label>" +
        '<div class="cc-top"><span class="hr-avatar" style="width:34px;height:34px;font-size:.75rem">' + esc(initials(c.name)) + '</span><div><div class="cc-name">' + esc(c.name) + (a.duplicate ? ' <span class="hr-tag t-orange">مكرر</span>' : "") + (a.aiRecommended ? ' <span class="hr-tag t-ai">AI</span>' : "") + '</div><div class="cc-sub">' + esc(c.title) + " · " + c.years + " سنة</div></div></div>" +
        '<div class="cc-tags">' + candTags(c) + "</div>" +
        '<div class="cc-foot"><span>' + esc(c.city) + " · " + esc(a.source || c.source) + '</span><span class="hr-match">' + c.match + "%</span></div>" +
        '<div class="cc-foot"><span>' + fmtDate(a.appliedAt) + '</span><a class="hr-link" href="/hr/employer/applicant?id=' + a.id + '">الملف ←</a></div></div>';
    }
    function renderKanban(rows) {
      var d = HRStore.data();
      var cols = d.stages.concat(d.sideStages);
      $("ap-root").innerHTML = '<div class="hr-kanban">' + cols.map(function (s, idx) {
        var inCol = rows.filter(function (a) { return a.stage === s.key; });
        return '<div class="hr-col" data-col="' + s.key + '"' + (idx === d.stages.length ? ' style="border-inline-start:2px dashed var(--hr-line);margin-inline-start:6px"' : "") + '><div class="col-hd"><span class="col-dot" style="background:var(--hr-' + (s.color === "gray" ? "mute" : s.color) + ')"></span>' + esc(s.label) + '<span class="col-n">' + inCol.length + "</span></div>" +
          inCol.map(cardHtml).join("") + "</div>";
      }).join("") + "</div>";
      bindCards();
      bindDnd();
    }
    function renderTable(rows) {
      $("ap-root").innerHTML = '<section class="hr-card"><div class="hr-tbl-wrap"><table class="hr-tbl"><thead><tr><th></th><th>المرشّح</th><th>الوظيفة</th><th>المرحلة</th><th>المطابقة</th><th>المصدر</th><th>تاريخ التقديم</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (a) {
          var c = a.candidate;
          var opts = HRStore.data().stages.concat(HRStore.data().sideStages).map(function (s) { return '<option value="' + s.key + '"' + (a.stage === s.key ? " selected" : "") + ">" + s.label + "</option>"; }).join("");
          return '<tr><td><input type="checkbox" data-sel="' + a.id + '"' + (selected[a.id] ? " checked" : "") + '></td><td><a class="t-title" href="/hr/employer/applicant?id=' + a.id + '">' + esc(c.name) + '</a><div class="t-sub">' + esc(c.title) + " · " + esc(c.city) + "</div></td><td>" + esc(a.job.title) + '</td><td><select data-stage-sel="' + a.id + '" style="border:1px solid var(--hr-line);border-radius:8px;padding:4px 8px;font-size:.8rem">' + opts + '</select></td><td><span class="hr-match">' + c.match + "%</span></td><td>" + esc(a.source || c.source) + "</td><td>" + fmtDate(a.appliedAt) + '</td><td><a class="hr-btn hr-btn-sm hr-btn-ghost" href="/hr/employer/applicant?id=' + a.id + '">الملف</a></td></tr>';
        }).join("") : '<tr><td colspan="8"><div class="hr-empty"><b>لا نتائج مطابقة</b><p>عدّل الفلاتر.</p></div></td></tr>') +
        "</tbody></table></div></section>";
      bindCards();
      $("ap-root").querySelectorAll("[data-stage-sel]").forEach(function (sel) {
        sel.addEventListener("change", function () { requestMove(sel.getAttribute("data-stage-sel"), sel.value); });
      });
    }
    function render() {
      var rows = filtered();
      if (view === "kanban") renderKanban(rows); else renderTable(rows);
      $("ap-view-kanban").classList.toggle("active", view === "kanban");
      $("ap-view-table").classList.toggle("active", view === "table");
      updateBulk();
    }
    function bindCards() {
      $("ap-root").querySelectorAll("[data-sel]").forEach(function (cb) {
        cb.addEventListener("change", function () { selected[cb.getAttribute("data-sel")] = cb.checked; updateBulk(); });
        cb.addEventListener("click", function (e) { e.stopPropagation(); });
      });
    }
    var SENSITIVE = { rejected: "استبعاد المرشّح", hired: "تأكيد التوظيف" };
    function requestMove(appId, stage) {
      var a = HRStore.application(appId);
      if (!a || a.stage === stage) return;
      var doMove = function () {
        var prev = HRStore.moveStage(appId, stage);
        render();
        toast("نُقل " + a.candidate.name + " إلى «" + HRStore.stageOf(stage).label + "»", "تراجع", function () {
          HRStore.setStageSilent(appId, prev);
          render();
        });
      };
      if (SENSITIVE[stage]) {
        confirmModal(SENSITIVE[stage], "سيُنقل " + a.candidate.name + " إلى «" + HRStore.stageOf(stage).label + "». متأكد؟", "تأكيد", stage === "rejected").then(function (ok) { if (ok) doMove(); else render(); });
      } else doMove();
    }
    function bindDnd() {
      var root = $("ap-root");
      root.querySelectorAll(".hr-ccard").forEach(function (card) {
        card.addEventListener("dragstart", function (e) {
          card.classList.add("dragging");
          e.dataTransfer.setData("text/plain", card.getAttribute("data-app"));
          e.dataTransfer.effectAllowed = "move";
        });
        card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
      });
      root.querySelectorAll(".hr-col").forEach(function (col) {
        col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drag-over"); });
        col.addEventListener("dragleave", function () { col.classList.remove("drag-over"); });
        col.addEventListener("drop", function (e) {
          e.preventDefault();
          col.classList.remove("drag-over");
          var appId = e.dataTransfer.getData("text/plain");
          if (appId) requestMove(appId, col.getAttribute("data-col"));
        });
      });
    }
    HRStore.ready().then(function () {
      if (HRStore.isReal()) {
        $("ap-root").insertAdjacentHTML("beforebegin", '<div class="hr-error" style="background:var(--hr-blue-bg);color:var(--hr-blue)">لا يوجد متقدمون بعد — أول متقدم حقيقي على وظائفك سيظهر هنا تلقائياً فور ربط التقديمات من الموقع. جرّب «المطابقة الذكية» الآن للبحث في قاعدة السير الجاهزة.</div>');
      }
      var jobSel = $("ap-job");
      jobSel.innerHTML = '<option value="">كل الوظائف</option>' + HRStore.jobs().map(function (j) { return '<option value="' + j.id + '"' + (state.job === j.id ? " selected" : "") + ">" + esc(j.title) + "</option>"; }).join("");
      var srcs = {};
      HRStore.applications().forEach(function (a) { srcs[a.source || a.candidate.source] = 1; });
      $("ap-src").innerHTML = '<option value="">كل المصادر</option>' + Object.keys(srcs).map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
      if (state.q) $("ap-q").value = state.q;
      jobSel.addEventListener("change", function () { state.job = jobSel.value; render(); });
      $("ap-q").addEventListener("input", function () { state.q = $("ap-q").value.trim(); render(); });
      $("ap-nat").addEventListener("change", function () { state.nat = $("ap-nat").value; render(); });
      $("ap-src").addEventListener("change", function () { state.src = $("ap-src").value; render(); });
      $("ap-match").addEventListener("change", function () { state.match = $("ap-match").value; render(); });
      $("ap-view-kanban").addEventListener("click", function () { view = "kanban"; writeLS("bp_hr_ap_view", view); render(); });
      $("ap-view-table").addEventListener("click", function () { view = "table"; writeLS("bp_hr_ap_view", view); render(); });
      function bulkMove(stage) {
        var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
        if (!ids.length) return;
        var apply = function () {
          ids.forEach(function (id) { HRStore.setStageSilent(id, stage); });
          HRStore.logActivity("stage", "نُقل " + ids.length + " مرشّحين إلى «" + HRStore.stageOf(stage).label + "» (إجراء جماعي)");
          selected = {};
          render();
          toast("نُقل " + ids.length + " مرشّحين.");
        };
        if (SENSITIVE[stage]) confirmModal(SENSITIVE[stage], "سيُطبق على " + ids.length + " مرشّحين. متأكد؟", "تأكيد", stage === "rejected").then(function (ok) { if (ok) apply(); });
        else apply();
      }
      $("ap-bulk-shortlist").addEventListener("click", function () { bulkMove("shortlist"); });
      $("ap-bulk-reject").addEventListener("click", function () { bulkMove("rejected"); });
      render();
    }).catch(function () { dataError("ap-root"); });
  }

  /* ================= applicant profile ================= */
  function pageApplicant() {
    var id = new URLSearchParams(location.search).get("id") || "";
    HRStore.ready().then(function () {
      var a = HRStore.application(id);
      var root = $("cp-root");
      if (!a) { root.innerHTML = '<div class="hr-empty"><b>الملف غير موجود</b><p><a class="hr-link" href="/hr/employer/applicants">رجوع للمتقدمين</a></p></div>'; return; }
      HRStore.markRead(id);
      var c = a.candidate;
      var d = HRStore.data();
      var stageOpts = d.stages.concat(d.sideStages).map(function (s) { return '<option value="' + s.key + '"' + (a.stage === s.key ? " selected" : "") + ">" + s.label + "</option>"; }).join("");
      var TABS = [["overview", "نظرة عامة"], ["journey", "الرحلة والمصدر"], ["exp", "الخبرات"], ["edu", "التعليم"], ["skills", "المهارات"], ["answers", "إجابات التقديم"], ["evals", "التقييمات"], ["docs", "المستندات"], ["log", "سجل النشاط"]];
      root.innerHTML =
        '<a class="hr-link" href="/hr/employer/applicants">← رجوع للمتقدمين</a>' +
        '<section class="hr-card" style="margin-top:10px"><div class="bd"><div class="hr-prof-head">' +
        '<span class="hr-avatar">' + esc(initials(c.name)) + "</span>" +
        '<div style="flex:1;min-width:200px"><h1 style="font-size:1.2rem;color:var(--hr-navy)">' + esc(c.name) + ' <span class="hr-match">' + c.match + '% مطابقة</span></h1>' +
        '<p style="color:var(--hr-soft);font-size:.88rem">' + esc(c.title) + " · " + esc(c.city) + "، " + esc(c.country) + " · متقدم على: <b>" + esc(a.job.title) + "</b></p>" +
        '<p style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + stageTag(a.stage) + (a.aiRecommended ? '<span class="hr-tag t-ai">توصية AI</span>' : "") + '<span class="hr-tag">' + esc(a.source || c.source) + "</span></p></div>" +
        '<div style="display:flex;flex-direction:column;gap:8px" id="contact">' +
        '<select id="cp-stage" class="hr-btn hr-btn-ghost" style="font-size:.85rem" aria-label="تغيير المرحلة">' + stageOpts + "</select>" +
        '<a class="hr-btn hr-btn-primary hr-btn-sm" href="mailto:' + esc(c.email) + '">✉️ تواصل بالبريد</a>' +
        '<button class="hr-btn hr-btn-soft hr-btn-sm" id="cp-interview">📅 تحديد مقابلة</button>' +
        "</div></div></div></section>" +
        '<div class="hr-tabs" id="cp-tabs">' + TABS.map(function (t, i) { return '<button data-tab="' + t[0] + '"' + (i === 0 ? ' class="active"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div>" +
        '<div id="cp-tab-body"></div>';

      var evalCur = HRStore.ratingFor(id) || {};
      function tabBody(key) {
        switch (key) {
          case "overview":
            return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">' +
              '<section class="hr-card"><div class="hd"><h2>البيانات الأساسية</h2></div><div class="bd"><div class="hr-kv">' +
              [["الجنسية", c.nationality], ["الإقامة", c.residency], ["تصريح العمل", c.workPermit], ["الخبرة", c.years + " سنة"], ["الراتب المتوقع", (c.expectedSalary || "—") + " ريال"], ["مدة الإشعار", (c.noticeDays || "—") + " يوم"], ["الجوال", c.phone], ["البريد", c.email], ["اللغات", (c.languages || []).join("، ")]].map(function (kv) { return '<span class="kv"><b>' + kv[0] + "</b>" + esc(kv[1] == null ? "—" : kv[1]) + "</span>"; }).join("") +
              "</div></div></section>" +
              '<section class="hr-ai-box"><h3>✨ ملخص AI <span class="hr-tag t-orange">تجريبي</span></h3>' +
              '<p style="font-size:.88rem;margin-bottom:10px">' + esc(c.summary || "") + "</p>" +
              '<div style="font-size:.83rem;display:flex;flex-direction:column;gap:6px">' +
              "<div><b>أسباب المطابقة:</b> تطابق المسمى والخبرة (" + c.years + " سنة) مع متطلبات «" + esc(a.job.title) + "»، ومهارات: " + esc((c.skills || []).slice(0, 3).join("، ")) + ".</div>" +
              "<div><b>نقاط تحتاج تحقق:</b> " + (c.noticeDays > 30 ? "مدة إشعار طويلة (" + c.noticeDays + " يوماً). " : "") + (c.expectedSalary && a.job.salaryMax && c.expectedSalary > a.job.salaryMax ? "الراتب المتوقع أعلى من نطاق الوظيفة." : "لا شيء جوهري.") + "</div>" +
              "<div><b>أسئلة مقترحة للمقابلة:</b> اطلب مثالاً عملياً عن أكبر تحدٍ في " + esc(c.skills[0] || "مجاله") + "، وتحقق من جاهزية الانتقال والالتزام بتاريخ مباشرة.</div>" +
              '<div class="hr-ai-note">الذكاء الاصطناعي لا يصدر قرار رفض نهائي — القرار دائماً للفريق.</div></div></section></div>';
          case "journey": {
            var tps = (d.touchpoints || []).filter(function (t) { return t.applicationId === id || t.candidateId === c.id; });
            var first = tps[0], last = tps[tps.length - 1];
            return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">' +
              '<section class="hr-card"><div class="hd"><h2>الإسناد (Attribution)</h2></div><div class="bd"><div class="hr-kv">' +
              [["المصدر المسجل", a.source || c.source], ["أول نقطة تواصل", first ? first.label : "—"], ["آخر نقطة قبل التقديم", last ? last.label : "—"], ["طريقة الوصول", a.aiRecommended ? "توصية مطابقة + تقديم" : "تقديم مباشر"]].map(function (kv) { return '<span class="kv"><b>' + kv[0] + "</b>" + esc(kv[1]) + "</span>"; }).join("") +
              '</div><p class="hr-hint" style="margin-top:10px">تتبع الحملات وروابط UTM الموقعة يتفعّل مع Campaign Tracking Links.</p></div></section>' +
              '<section class="hr-card"><div class="hd"><h2>نقاط التواصل</h2></div><div class="bd">' +
              (tps.length ? tps.map(function (t) {
                var chIc = { website: "🌐", email: "✉️", whatsapp: "💬", platform: "🧭" }[t.channel] || "•";
                return '<div class="hr-cand" style="align-items:center"><span style="font-size:1rem">' + chIc + '</span><div class="c-body"><div style="font-size:.85rem">' + esc(t.label) + '</div><div class="c-sub">' + esc(t.eventType) + " · " + fmtDate(t.at) + " " + fmtTime(t.at) + "</div></div></div>";
              }).join("") : '<div class="hr-empty"><b>لا نقاط تواصل مسجلة بعد</b><p>تُسجل تلقائياً من الموقع والبريد وواتساب عند ربط القنوات.</p></div>') +
              "</div></section></div>";
          }
          case "exp":
            return '<section class="hr-card"><div class="bd"><div class="hr-cand"><span style="font-size:1.1rem">💼</span><div class="c-body"><b>' + esc(c.title) + '</b><div class="c-sub">آخر دور — خبرة إجمالية ' + c.years + " سنة</div><p style='font-size:.86rem;margin-top:6px'>" + esc(c.summary || "") + "</p></div></div><p class='hr-hint'>تفاصيل الخبرات الكاملة تُقرأ من السيرة الذاتية عند ربط محرك قراءة السير (CandidateExperience).</p></div></section>";
          case "edu":
            return '<section class="hr-card"><div class="bd"><div class="hr-cand"><span style="font-size:1.1rem">🎓</span><div class="c-body"><b>' + esc(c.education || "—") + "</b></div></div></div></section>";
          case "skills":
            return '<section class="hr-card"><div class="bd"><div style="display:flex;flex-wrap:wrap;gap:8px">' + (c.skills || []).map(function (s) { return '<span class="hr-tag t-teal">' + esc(s) + "</span>"; }).join("") + '</div><p class="hr-hint" style="margin-top:10px">اللغات: ' + esc((c.languages || []).join("، ")) + "</p></div></section>";
          case "answers":
            return '<section class="hr-card"><div class="bd"><div class="hr-empty"><b>لا أسئلة فرز لهذه الوظيفة</b><p>أضف أسئلة من نموذج نشر الوظيفة لتظهر إجابات المتقدمين هنا.</p></div></div></section>';
          case "evals": {
            var stars = "";
            for (var i = 1; i <= 5; i++) stars += '<button type="button" data-star="' + i + '" class="' + (evalCur.rating >= i ? "on" : "") + '">★</button>';
            var notes = HRStore.notesFor(id);
            return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">' +
              '<section class="hr-card"><div class="hd"><h2>تقييمك</h2></div><div class="bd">' +
              '<div class="hr-field"><label>التقييم العام</label><span class="hr-stars" id="cp-stars">' + stars + "</span></div>" +
              '<div class="hr-field"><label>نقاط القوة</label><textarea id="cp-strengths" rows="2">' + esc(evalCur.strengths || "") + "</textarea></div>" +
              '<div class="hr-field"><label>نقاط التحفظ</label><textarea id="cp-concerns" rows="2">' + esc(evalCur.concerns || "") + "</textarea></div>" +
              '<div class="hr-field"><label>التوصية</label><select id="cp-rec"><option' + (evalCur.rec === "توظيف" ? " selected" : "") + ">توظيف</option><option" + (evalCur.rec === "مقابلة إضافية" ? " selected" : "") + ">مقابلة إضافية</option><option" + (evalCur.rec === "غير مناسب" ? " selected" : "") + ">غير مناسب</option></select></div>" +
              '<button class="hr-btn hr-btn-primary hr-btn-sm" id="cp-save-eval">حفظ التقييم</button>' +
              (evalCur.at ? '<p class="hr-hint" style="margin-top:8px">آخر تعديل: ' + esc(evalCur.by) + " — " + fmtDate(evalCur.at) + "</p>" : "") +
              "</div></section>" +
              '<section class="hr-card"><div class="hd"><h2>الملاحظات</h2></div><div class="bd">' +
              '<div class="hr-field"><textarea id="cp-note" rows="2" placeholder="أضف ملاحظة للفريق…"></textarea></div>' +
              '<label style="font-size:.8rem;display:flex;gap:6px;align-items:center;margin-bottom:10px"><input type="checkbox" id="cp-note-shared" checked> مشتركة مع الفريق</label>' +
              '<button class="hr-btn hr-btn-ghost hr-btn-sm" id="cp-add-note">إضافة</button>' +
              '<div id="cp-notes" style="margin-top:12px">' + notes.map(function (n) { return '<div class="hr-cand"><div class="c-body"><div style="font-size:.86rem">' + esc(n.body) + '</div><div class="c-sub">' + esc(n.by) + " · " + fmtDate(n.at) + (n.shared ? " · مشتركة" : " · خاصة") + "</div></div></div>"; }).join("") + "</div>" +
              "</div></section></div>";
          }
          case "docs":
            return '<section class="hr-card"><div class="bd"><div class="hr-cand"><span style="font-size:1.1rem">📄</span><div class="c-body"><b>السيرة الذاتية الأصلية</b><div class="c-sub">تُعرض من التخزين عند ربط قاعدة السير الحقيقية (CandidateResume)</div></div><button class="hr-btn hr-btn-sm hr-btn-ghost" disabled>تنزيل</button></div></div></section>';
          case "log": {
            var acts = HRStore.activities().filter(function (ac) { return ac.text.indexOf(c.name) > -1; });
            return '<section class="hr-card"><div class="bd">' + (acts.length ? acts.map(function (ac) { return '<div class="hr-cand"><div class="c-body"><div style="font-size:.86rem">' + esc(ac.text) + '</div><div class="c-sub">' + fmtDate(ac.at) + "</div></div></div>"; }).join("") : '<div class="hr-empty"><b>لا نشاط مسجل بعد</b></div>') + "</div></section>";
          }
        }
        return "";
      }
      function renderTab(key) {
        $("cp-tab-body").innerHTML = tabBody(key);
        if (key === "evals") {
          $("cp-stars").querySelectorAll("[data-star]").forEach(function (b) {
            b.addEventListener("click", function () {
              evalCur.rating = Number(b.getAttribute("data-star"));
              renderTab("evals");
            });
          });
          $("cp-save-eval").addEventListener("click", function () {
            HRStore.setRating(id, { rating: evalCur.rating || 0, strengths: $("cp-strengths").value, concerns: $("cp-concerns").value, rec: $("cp-rec").value });
            evalCur = HRStore.ratingFor(id);
            toast("حُفظ التقييم.");
            renderTab("evals");
          });
          $("cp-add-note").addEventListener("click", function () {
            var v = $("cp-note").value.trim();
            if (!v) return;
            HRStore.addNote(id, v, $("cp-note-shared").checked);
            renderTab("evals");
          });
        }
      }
      $("cp-tabs").querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          $("cp-tabs").querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          renderTab(b.getAttribute("data-tab"));
        });
      });
      renderTab("overview");
      $("cp-stage").addEventListener("change", function () {
        var v = $("cp-stage").value;
        var apply = function () {
          HRStore.moveStage(id, v);
          toast("نُقل إلى «" + HRStore.stageOf(v).label + "»");
        };
        if (v === "rejected" || v === "hired") {
          confirmModal(v === "rejected" ? "استبعاد المرشّح" : "تأكيد التوظيف", "متأكد من نقل " + c.name + "؟", "تأكيد", v === "rejected").then(function (ok) {
            if (ok) apply(); else $("cp-stage").value = a.stage;
          });
        } else apply();
      });
      $("cp-interview").addEventListener("click", function () {
        toast("جدولة المقابلات تُبنى في وحدة «المقابلات» — قادمة في المرحلة التالية.");
      });
    }).catch(function () { dataError("cp-root"); });
  }

  /* ================= matching (Matchmaking Engine v1-mock) ================= */
  // Deterministic weighted scoring — NOT an opaque LLM percentage. Each
  // component returns {score, status: MATCH/PARTIAL_MATCH/NO_MATCH/UNKNOWN,
  // note}; UNKNOWN never disqualifies (it's surfaced and asked for instead).
  var SCORING_VERSION = "v1-mock";
  var WEIGHT_DEFS = [
    ["skills", "المهارات الأساسية", 25], ["experience", "الخبرة ذات الصلة", 20], ["title", "المسمى والمسار", 10],
    ["education", "المؤهل والشهادات", 10], ["location", "الموقع والانتقال", 10], ["eligibility", "الإقامة وتصريح العمل", 10],
    ["salary", "الراتب المتوقع", 5], ["language", "اللغة", 5], ["availability", "التوفر ومدة الإشعار", 5],
  ];
  function matchComponents(job, c) {
    var comps = {};
    function comp(key, score, status, note) { comps[key] = { score: Math.max(0, Math.min(100, Math.round(score))), status: status, note: note }; }
    var jSkills = job.skills || [], cSkills = c.skills || [];
    if (!jSkills.length) comp("skills", 55, "UNKNOWN", "الوظيفة بلا مهارات محددة");
    else {
      var hit = jSkills.filter(function (s) { return cSkills.some(function (cs) { return cs.indexOf(s) > -1 || s.indexOf(cs) > -1; }); });
      comp("skills", (hit.length / jSkills.length) * 100, hit.length === jSkills.length ? "MATCH" : hit.length ? "PARTIAL_MATCH" : "NO_MATCH", "تطابق " + hit.length + " من " + jSkills.length + (hit.length ? ": " + hit.join("، ") : ""));
      comps.skills.hit = hit;
      comps.skills.miss = jSkills.filter(function (s) { return hit.indexOf(s) < 0; });
    }
    var req = parseInt(job.experienceYears, 10) || 0;
    if (!c.years && c.years !== 0) comp("experience", 55, "UNKNOWN", "سنوات الخبرة غير معروفة");
    else if (c.years >= req) comp("experience", 100 - Math.min(15, Math.max(0, c.years - req - 6) * 3), "MATCH", c.years + " سنة (المطلوب " + (job.experienceYears || "غير محدد") + ")");
    else comp("experience", Math.max(30, 100 - (req - c.years) * 22), c.years >= req - 2 ? "PARTIAL_MATCH" : "NO_MATCH", c.years + " سنة والمطلوب " + job.experienceYears);
    var jt = (job.title || "").split(/\s+/), ct = (c.title || "").split(/\s+/);
    var tHit = jt.filter(function (w) { return w.length > 2 && ct.some(function (cw) { return cw.indexOf(w) > -1 || w.indexOf(cw) > -1; }); });
    comp("title", tHit.length ? Math.min(100, 55 + tHit.length * 22) : 40, tHit.length ? "MATCH" : "PARTIAL_MATCH", tHit.length ? "تقارب في المسمى: " + tHit.join(" ") : "مسمى مختلف — راجع المسار المهني");
    if (!c.education) comp("education", 55, "UNKNOWN", "المؤهل غير معروف");
    else comp("education", c.education.indexOf("بكالوريوس") > -1 || c.education.indexOf("ماجستير") > -1 ? 100 : 75, "MATCH", c.education);
    if (c.city === job.city) comp("location", 100, "MATCH", "نفس المدينة (" + c.city + ")");
    else if (c.country === job.country) comp("location", 65, "PARTIAL_MATCH", c.city + " — يحتاج تأكيد الانتقال إلى " + job.city);
    else comp("location", 35, "NO_MATCH", "خارج " + job.country);
    if (c.nationality && c.nationality.indexOf("سعودي") === 0) comp("eligibility", 100, "MATCH", "مواطن — لا يحتاج تصريح عمل");
    else if (c.workPermit === "قابل للنقل") comp("eligibility", 85, "MATCH", "إقامة قابلة للنقل");
    else if (!c.workPermit) comp("eligibility", 55, "UNKNOWN", "حالة تصريح العمل غير معروفة");
    else comp("eligibility", 60, "PARTIAL_MATCH", c.workPermit);
    if (!c.expectedSalary) comp("salary", 55, "UNKNOWN", "الراتب المتوقع غير معروف — اطلبه من المرشّح");
    else if (!job.salaryMax) comp("salary", 70, "UNKNOWN", "نطاق الوظيفة غير محدد");
    else if (c.expectedSalary <= job.salaryMax) comp("salary", 100, "MATCH", c.expectedSalary + " ريال ضمن النطاق");
    else comp("salary", Math.max(25, 100 - ((c.expectedSalary - job.salaryMax) / job.salaryMax) * 200), "PARTIAL_MATCH", "يتوقع " + c.expectedSalary + " والنطاق حتى " + job.salaryMax);
    var jl = job.languages || ["العربية"], cl = c.languages || [];
    var lHit = jl.filter(function (l) { return cl.indexOf(l) > -1; });
    comp("language", (lHit.length / jl.length) * 100 || 40, lHit.length === jl.length ? "MATCH" : "PARTIAL_MATCH", "يجيد: " + (cl.join("، ") || "غير معروف"));
    if (!c.noticeDays && c.noticeDays !== 0) comp("availability", 55, "UNKNOWN", "مدة الإشعار غير معروفة");
    else comp("availability", c.noticeDays <= 15 ? 100 : c.noticeDays <= 30 ? 88 : c.noticeDays <= 60 ? 62 : 45, c.noticeDays <= 30 ? "MATCH" : "PARTIAL_MATCH", "إشعار " + c.noticeDays + " يوماً");
    return comps;
  }
  function runMatch(job, weights, pool) {
    var results = (pool || HRStore.candidates()).map(function (c) {
      var comps = matchComponents(job, c);
      var total = 0, wsum = 0;
      WEIGHT_DEFS.forEach(function (w) {
        var wv = weights[w[0]] || 0;
        total += (comps[w[0]] ? comps[w[0]].score : 55) * wv;
        wsum += wv;
      });
      var overall = wsum ? Math.round(total / wsum) : 0;
      var mustMiss = (job.mustHave || []).filter(function (s) {
        return !(c.skills || []).some(function (cs) { return cs.indexOf(s) > -1 || s.indexOf(cs) > -1; });
      });
      var unknown = WEIGHT_DEFS.filter(function (w) { return comps[w[0]] && comps[w[0]].status === "UNKNOWN"; }).map(function (w) { return w[1]; });
      return { candidate: c, comps: comps, overall: overall, mustMiss: mustMiss, hardFiltered: !!mustMiss.length, unknown: unknown };
    });
    results.sort(function (a, b) { return (a.hardFiltered ? 1 : 0) - (b.hardFiltered ? 1 : 0) || b.overall - a.overall; });
    return results;
  }
  function matchCategory(r) {
    if (r.hardFiltered) return "hard";
    return r.overall >= 85 ? "strong" : r.overall >= 70 ? "good" : r.overall >= 50 ? "review" : "weak";
  }
  function pageMatching() {
    var W_KEY = "bp_hr_match_weights";
    var defWeights = {};
    WEIGHT_DEFS.forEach(function (w) { defWeights[w[0]] = w[2]; });
    var weights = readLS(W_KEY, defWeights);
    var lastResults = null;
    function ovInvites() { return readLS("bp_hr_invites", {}); }
    function runsLog() { return readLS("bp_hr_match_runs", []); }
    function renderWeights() {
      $("mt-weights-grid").innerHTML = WEIGHT_DEFS.map(function (w) {
        return '<span class="kv"><b>' + w[1] + '</b><input type="number" min="0" max="60" data-w="' + w[0] + '" value="' + (weights[w[0]] || 0) + '" style="width:76px;border:1px solid var(--hr-line);border-radius:8px;padding:4px 8px"> %</span>';
      }).join("");
      $("mt-weights-grid").querySelectorAll("[data-w]").forEach(function (inp) {
        inp.addEventListener("change", function () {
          weights[inp.getAttribute("data-w")] = Math.max(0, Math.min(60, Number(inp.value) || 0));
          writeLS(W_KEY, weights);
          var sum = WEIGHT_DEFS.reduce(function (s, w) { return s + (weights[w[0]] || 0); }, 0);
          if (sum !== 100) toast("مجموع الأوزان الآن " + sum + "% — يُوزن نسبياً، والافتراضي 100%.");
        });
      });
    }
    function statusTag(st) {
      return st === "MATCH" ? '<span class="hr-tag t-green">مطابق</span>' : st === "PARTIAL_MATCH" ? '<span class="hr-tag t-orange">جزئي</span>' : st === "UNKNOWN" ? '<span class="hr-tag">غير معروف</span>' : '<span class="hr-tag t-red">غير مطابق</span>';
    }
    function resultCard(r, job) {
      var c = r.candidate;
      var invited = ovInvites()[job.id + ":" + c.id];
      var catTag = r.hardFiltered ? '<span class="hr-tag t-red">لا يحقق شرطاً إلزامياً</span>'
        : r.overall >= 85 ? '<span class="hr-tag t-green">مطابقة قوية</span>'
        : r.overall >= 70 ? '<span class="hr-tag t-teal">مطابق جيد</span>'
        : r.overall >= 50 ? '<span class="hr-tag t-orange">يحتاج مراجعة</span>' : '<span class="hr-tag">مطابقة ضعيفة</span>';
      var bars = WEIGHT_DEFS.map(function (w) {
        var cp = r.comps[w[0]];
        if (!cp) return "";
        return '<div class="f-row"><span style="font-size:.78rem">' + w[1] + '</span><span class="f-bar"><span class="f-fill" style="width:' + cp.score + '%;background:' + (cp.status === "NO_MATCH" ? "var(--hr-red)" : cp.status === "UNKNOWN" ? "var(--hr-mute)" : cp.status === "PARTIAL_MATCH" ? "var(--hr-orange)" : "var(--hr-teal)") + '"></span></span><span class="f-n" style="font-size:.78rem">' + cp.score + "%</span></div>";
      }).join("");
      var matched = [], missing = [];
      Object.keys(r.comps).forEach(function (k) {
        var cp = r.comps[k];
        if (cp.status === "MATCH") matched.push(cp.note);
        if (cp.status === "NO_MATCH") missing.push(cp.note);
      });
      if (r.mustMiss.length) missing.unshift("شرط إلزامي غير متحقق: " + r.mustMiss.join("، "));
      return '<section class="hr-card" style="margin-bottom:14px"><div class="bd">' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
        '<span class="hr-avatar">' + esc(initials(c.name)) + "</span>" +
        '<div style="flex:1;min-width:180px"><b style="color:var(--hr-navy)">' + esc(c.name) + "</b> " + catTag +
        '<div style="font-size:.8rem;color:var(--hr-soft)">' + esc(c.title) + " · " + c.years + " سنة · " + esc(c.city) + " · المصدر: " + esc(c.source) + "</div></div>" +
        '<div style="text-align:center"><div style="font-size:1.7rem;font-weight:700;color:var(--hr-' + (r.hardFiltered ? "red" : r.overall >= 70 ? "teal" : "orange") + ')">' + r.overall + '%</div><div class="hr-hint">الدرجة الموزونة</div></div></div>' +
        '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:.84rem;color:var(--hr-teal);font-weight:600">تفاصيل الحساب ولماذا ظهر هذا المرشّح؟</summary>' +
        '<div class="hr-funnel" style="margin-top:10px">' + bars + "</div>" +
        '<div style="margin-top:10px;font-size:.83rem;display:flex;flex-direction:column;gap:5px">' +
        (matched.length ? "<div>✅ <b>المتطلبات المطابقة:</b> " + esc(matched.slice(0, 4).join(" · ")) + "</div>" : "") +
        (missing.length ? "<div>❌ <b>غير المتوفرة:</b> " + esc(missing.join(" · ")) + "</div>" : "") +
        (r.unknown.length ? "<div>❓ <b>غير معروفة (لا تستبعد):</b> " + esc(r.unknown.join("، ")) + " — اطلبها من المرشّح.</div>" : "") +
        '<div class="hr-hint">محرك ' + SCORING_VERSION + " · الدرجة = مجموع مرجّح للمكونات أعلاه.</div></div></details>" +
        '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">' +
        '<button class="hr-btn hr-btn-sm hr-btn-ghost" data-mact="profile" data-c="' + c.id + '">عرض الملف</button>' +
        (invited ? '<span class="hr-tag t-teal">دُعي للتقديم ✓</span>' : '<button class="hr-btn hr-btn-sm hr-btn-primary" data-mact="invite" data-c="' + c.id + '">دعوة للتقديم</button>') +
        '<button class="hr-btn hr-btn-sm hr-btn-soft" data-mact="shortlist" data-c="' + c.id + '">إضافة للمختصرة</button>' +
        '<button class="hr-btn hr-btn-sm hr-btn-ghost" data-mact="askinfo" data-c="' + c.id + '">طلب معلومات</button>' +
        '<button class="hr-btn hr-btn-sm hr-btn-ghost" data-mact="interview" data-c="' + c.id + '">تحديد مقابلة</button>' +
        '<button class="hr-btn hr-btn-sm hr-btn-danger" data-mact="exclude" data-c="' + c.id + '">استبعاد من هذه الوظيفة</button>' +
        '<button class="hr-btn hr-btn-sm hr-btn-ghost" data-mact="save" data-c="' + c.id + '">حفظ لفرصة أخرى</button>' +
        "</div></div></section>";
    }
    function render(job) {
      if (!lastResults) return;
      var cat = $("mt-cat").value;
      var rows = lastResults.filter(function (r) { return !cat || matchCategory(r) === cat; });
      var strong = lastResults.filter(function (r) { return matchCategory(r) === "strong"; }).length;
      var review = lastResults.filter(function (r) { return matchCategory(r) === "review"; }).length;
      var invitedN = Object.keys(ovInvites()).filter(function (k) { return k.indexOf(job.id + ":") === 0; }).length;
      $("mt-kpis").hidden = false;
      $("mt-kpis").innerHTML = [["مرشّحون تم تحليلهم", lastResults.length], ["مطابقات قوية", strong], ["تحتاج مراجعة", review], ["دعوات مرسلة", invitedN]].map(function (k) {
        return '<div class="hr-kpi"><span class="k-top"><span>' + k[0] + '</span></span><span class="k-num">' + k[1] + "</span></div>";
      }).join("");
      var cats = [["strong", "قوية", "var(--hr-green)"], ["good", "جيدة", "var(--hr-teal)"], ["review", "مراجعة", "var(--hr-orange)"], ["weak", "ضعيفة", "var(--hr-mute)"], ["hard", "فلتر إلزامي", "var(--hr-red)"]];
      var maxN = Math.max.apply(null, cats.map(function (ct) { return lastResults.filter(function (r) { return matchCategory(r) === ct[0]; }).length; }).concat([1]));
      $("mt-dist-card").hidden = false;
      $("mt-dist").innerHTML = '<div class="hr-funnel">' + cats.map(function (ct) {
        var n = lastResults.filter(function (r) { return matchCategory(r) === ct[0]; }).length;
        return '<div class="f-row"><span>' + ct[1] + '</span><span class="f-bar"><span class="f-fill" style="width:' + Math.round((n / maxN) * 100) + "%;background:" + ct[2] + '"></span></span><span class="f-n">' + n + "</span></div>";
      }).join("") + "</div>";
      $("mt-results").innerHTML = rows.length ? rows.map(function (r) { return resultCard(r, job); }).join("") : '<div class="hr-empty"><b>لا نتائج في هذه الفئة</b></div>';
      bindActions(job);
      var runs = runsLog();
      $("mt-history-card").hidden = !runs.length;
      $("mt-history").innerHTML = runs.slice(0, 6).map(function (rn) {
        return '<div class="hr-cand"><div class="c-body"><div style="font-size:.85rem">' + esc(rn.jobTitle) + " — حُلل " + rn.analyzed + " مرشّحاً، " + rn.strong + ' مطابقة قوية</div><div class="c-sub">' + fmtDate(rn.at) + " · " + fmtTime(rn.at) + " · محرك " + esc(rn.version) + "</div></div></div>";
      }).join("");
    }
    function bindActions(job) {
      $("mt-results").querySelectorAll("[data-mact]").forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.getAttribute("data-mact"), cid = b.getAttribute("data-c");
          var c = HRStore.candidate(cid) || (lastResults || []).map(function (r2) { return r2.candidate; }).filter(function (x) { return x.id === cid; })[0];
          var app = HRStore.applications().filter(function (a) { return a.candidateId === cid && a.jobId === job.id; })[0];
          if (act === "profile") {
            if (c && c.real) location.href = "/ar/candidate-profile?id=" + cid;
            else if (app) location.href = "/hr/employer/applicant?id=" + app.id;
            else toast("لا يوجد ملف تقديم لهذه الوظيفة بعد — ادعُه للتقديم أولاً.");
          } else if (act === "invite") {
            confirmModal("دعوة للتقديم", "سترسل دعوة إلى " + c.name + " للتقديم على «" + job.title + "». الإرسال الفعلي يتفعّل مع ربط قنوات التواصل — الآن تُسجل الدعوة فقط.", "تسجيل الدعوة").then(function (ok) {
              if (!ok) return;
              var inv = ovInvites();
              inv[job.id + ":" + cid] = { at: new Date().toISOString() };
              writeLS("bp_hr_invites", inv);
              HRStore.logActivity("stage", "سُجلت دعوة تقديم لـ " + c.name + " على وظيفة " + job.title);
              render(job);
            });
          } else if (act === "shortlist") {
            if (app) { HRStore.setStageSilent(app.id, "shortlist"); toast("أُضيف للقائمة المختصرة."); }
            else toast("سيُنشأ ملف تقديم عند قبول الدعوة — سجّل دعوة أولاً.");
          } else if (act === "askinfo") {
            toast("طلب المعلومات يُرسل من وحدة الرسائل عند ربط القنوات — سُجل كإجراء مقترح.");
          } else if (act === "interview") {
            toast("جدولة المقابلات تُبنى في وحدة «المقابلات» القادمة.");
          } else if (act === "exclude") {
            confirmModal("استبعاد من هذه الوظيفة", "يُستبعد " + c.name + " من نتائج «" + job.title + "» فقط. القرار بشري ويُسجل.", "استبعاد", true).then(function (ok) {
              if (!ok) return;
              if (app) HRStore.setStageSilent(app.id, "rejected");
              lastResults = lastResults.filter(function (r) { return r.candidate.id !== cid; });
              HRStore.logActivity("stage", "استُبعد " + c.name + " من مطابقات " + job.title);
              render(job);
            });
          } else if (act === "save") {
            if (app) HRStore.setStageSilent(app.id, "future");
            toast("حُفظ " + c.name + " لفرصة مستقبلية.");
          }
        });
      });
    }
    HRStore.ready().then(function () {
      var jobs = HRStore.jobs().filter(function (j) { return ["مغلقة", "منتهية"].indexOf(j.status) < 0; });
      $("mt-job").innerHTML = jobs.map(function (j) { return '<option value="' + j.id + '">' + esc(j.title) + "</option>"; }).join("");
      renderWeights();
      $("mt-weights-toggle").addEventListener("click", function () { $("mt-weights").hidden = !$("mt-weights").hidden; });
      $("mt-weights-reset").addEventListener("click", function () { weights = Object.assign({}, defWeights); writeLS(W_KEY, weights); renderWeights(); toast("عادت الأوزان للافتراضي."); });
      $("mt-cat").addEventListener("change", function () { var j = HRStore.job($("mt-job").value); if (j) render(j); });
      var MATCH_POOL_CAP = 400;
      function loadMatchPool() {
        if (!HRStore.isReal()) return Promise.resolve(HRStore.candidates());
        var code = hrRealCode();
        return new Promise(function (resolve) {
          var out = [];
          function step(cursor) {
            var qs2 = new URLSearchParams({ code: code });
            if (cursor) qs2.set("cursor", cursor);
            fetch("/api/candidates?" + qs2).then(function (r) { return r.json(); }).then(function (d2) {
              if (!d2 || !d2.ok) { resolve(out); return; }
              (d2.candidates || []).forEach(function (c) {
                out.push({ id: c.id, name: c.name || "مرشّح", title: c.role || "", years: parseInt(c.experience, 10) || 0, city: c.city || "", country: c.country || "", nationality: c.nationalityType || "", workPermit: "", skills: String(c.skills || "").split(/[،,]/).map(function (t) { return t.trim(); }).filter(Boolean), languages: String(c.languages || "").split(/[،,]/).map(function (t) { return t.trim(); }).filter(Boolean), education: c.education || "", expectedSalary: null, noticeDays: null, source: "بنك السير", real: true });
              });
              if (out.length < MATCH_POOL_CAP && !d2.done && d2.nextCursor) step(d2.nextCursor);
              else resolve(out.slice(0, MATCH_POOL_CAP));
            }).catch(function () { resolve(out); });
          }
          step(null);
        });
      }
      $("mt-run").addEventListener("click", function () {
        var job = HRStore.job($("mt-job").value);
        if (!job) return;
        if (job.real && (!job.skills || !job.skills.length)) { job.skills = skillsForTitle(job.title); }
        $("mt-results").innerHTML = '<div class="hr-skel" style="height:200px"></div>';
        loadMatchPool().then(function (pool) {
          if (HRStore.isReal()) $("mt-last-run").textContent = "يُحلل أول " + pool.length + " مرشّح من قاعدة السير — ضيّق لاحقاً بالفلاتر";
          lastResults = runMatch(job, weights, pool);
          var runs = runsLog();
          runs.unshift({ at: new Date().toISOString(), jobTitle: job.title, analyzed: lastResults.length, strong: lastResults.filter(function (r) { return matchCategory(r) === "strong"; }).length, version: SCORING_VERSION });
          writeLS("bp_hr_match_runs", runs.slice(0, 20));
          $("mt-last-run").textContent = ($("mt-last-run").textContent ? $("mt-last-run").textContent + " · " : "") + "آخر تشغيل: الآن · محرك " + SCORING_VERSION;
          render(job);
        });
      });
      var runs = runsLog();
      if (runs.length) $("mt-last-run").textContent = "آخر تشغيل: " + fmtDate(runs[0].at) + " " + fmtTime(runs[0].at) + " · محرك " + esc(runs[0].version);
    }).catch(function () { dataError("mt-results"); });
  }

  /* ================= reports (candidate sources / attribution) ================= */
  function pageReports() {
    HRStore.ready().then(function (d) {
      var apps = HRStore.applications();
      var bySrc = {};
      apps.forEach(function (a) {
        var key = a.candidate.sourceKey || "MANUAL_ENTRY";
        var reg = (d.sourcesRegistry || []).filter(function (s) { return s.key === key; })[0] || { label: a.candidate.source || key };
        var row = (bySrc[key] = bySrc[key] || { label: reg.label, total: 0, qualified: 0, interviews: 0, hires: 0 });
        row.total++;
        if (["shortlist", "interview", "offer", "hired"].indexOf(a.stage) > -1) row.qualified++;
        if (["interview", "offer", "hired"].indexOf(a.stage) > -1) row.interviews++;
        if (a.stage === "hired") row.hires++;
      });
      var rows = Object.keys(bySrc).map(function (k) { return bySrc[k]; }).sort(function (a, b) { return b.total - a.total; });
      var best = rows[0];
      $("rp-kpis").innerHTML = [["إجمالي المتقدمين", apps.length], ["مصادر نشطة", rows.length], ["أفضل مصدر", best ? best.label : "—"], ["مؤهلون", rows.reduce(function (s, r) { return s + r.qualified; }, 0)]].map(function (k) {
        return '<div class="hr-kpi"><span class="k-top"><span>' + k[0] + '</span></span><span class="k-num" style="font-size:' + (typeof k[1] === "string" ? "1.05rem" : "1.65rem") + '">' + esc(k[1]) + "</span></div>";
      }).join("");
      function renderTbl() {
        $("rp-table").innerHTML = '<table class="hr-tbl"><thead><tr><th>المصدر</th><th>مرشّحون</th><th>مؤهلون</th><th>مقابلات</th><th>تعيينات</th><th>معدل التحويل للمؤهل</th></tr></thead><tbody>' +
          rows.map(function (r) {
            var conv = r.total ? Math.round((r.qualified / r.total) * 100) : 0;
            return '<tr><td class="t-title">' + esc(r.label) + "</td><td>" + r.total + "</td><td>" + r.qualified + "</td><td>" + r.interviews + "</td><td>" + r.hires + '</td><td><span class="f-bar" style="display:inline-block;width:90px;height:8px;vertical-align:middle;margin-inline-end:6px;background:var(--hr-gray-bg);border-radius:99px"><span class="f-fill" style="display:block;height:100%;width:' + conv + '%;border-radius:99px;background:var(--hr-teal)"></span></span>' + conv + "%</td></tr>";
          }).join("") + "</tbody></table>";
      }
      renderTbl();
      $("rp-model").addEventListener("change", function () {
        toast($("rp-model").value === "last" ? "عرض Last-touch — مع بيانات التتبع الحقيقية سيختلف عن First-touch." : "عرض First-touch (أول مصدر).");
        renderTbl();
      });
    }).catch(function () { dataError("rp-table"); });
  }

  /* ================= integration hub ================= */
  var IG_STATUS = {
    OFFICIAL_API_AVAILABLE: ["API رسمي متاح", "t-green"], PARTNER_APPROVAL_REQUIRED: ["يتطلب اعتماد الشريك", "t-orange"],
    WEBHOOK_AVAILABLE: ["Webhook متاح", "t-teal"], FEED_AVAILABLE: ["Feed متاح", "t-teal"],
    EMAIL_INGESTION_ONLY: ["استقبال بريد فقط", "t-blue"], TRACKED_LINK_ONLY: ["روابط متتبعة فقط", "t-blue"],
    MANUAL_IMPORT: ["استيراد يدوي", ""], NOT_SUPPORTED: ["غير مدعوم", "t-red"],
  };
  var IG_HEALTH = { Healthy: ["سليم", "t-green"], Delayed: ["متأخر", "t-orange"], "Authentication Required": ["يحتاج مصادقة", "t-orange"], "Rate Limited": ["محدود المعدل", "t-orange"], "Partially Failed": ["فشل جزئي", "t-red"], Failed: ["فاشل", "t-red"], Disabled: ["غير مفعّل", ""] };
  function pageIntegrations() {
    HRStore.ready().then(function (d) {
      var list = d.integrations || [];
      var healthy = list.filter(function (i) { return i.health === "Healthy"; }).length;
      var attn = list.filter(function (i) { return ["Authentication Required", "Failed", "Partially Failed", "Delayed"].indexOf(i.health) > -1; }).length;
      $("ig-kpis").innerHTML = [["قنوات مربوطة", list.length], ["سليمة", healthy], ["تحتاج انتباه", attn]].map(function (k) {
        return '<div class="hr-kpi"><span class="k-top"><span>' + k[0] + '</span></span><span class="k-num">' + k[1] + "</span></div>";
      }).join("");
      $("ig-list").innerHTML = list.map(function (i, idx) {
        var st = IG_STATUS[i.status] || [i.status, ""], hl = IG_HEALTH[i.health] || [i.health, ""];
        return '<section class="hr-card" style="margin-bottom:12px"><div class="bd" style="display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center">' +
          '<div style="flex:1;min-width:200px"><b style="color:var(--hr-navy)">' + esc(i.platform) + '</b><div class="hr-hint">' + esc(i.type) + " · المسؤول: " + esc(i.owner || "—") + "</div></div>" +
          '<span class="hr-tag ' + st[1] + '">' + st[0] + '</span><span class="hr-tag ' + hl[1] + '">' + hl[0] + "</span>" +
          '<div style="font-size:.78rem;color:var(--hr-soft)">آخر مزامنة: ' + (i.lastSync ? fmtDate(i.lastSync) + " " + fmtTime(i.lastSync) : "—") + "<br>وظائف: " + i.jobs + " · متقدمون: " + i.applicants + "</div>" +
          '<span style="display:flex;gap:6px"><button class="hr-btn hr-btn-sm hr-btn-ghost" data-ig-test="' + idx + '">اختبار الاتصال</button><button class="hr-btn hr-btn-sm hr-btn-soft" data-ig-sync="' + idx + '">مزامنة الآن</button></span>' +
          (i.error ? '<div class="hr-error" style="width:100%;padding:8px 12px;font-size:.8rem">⚠️ ' + esc(i.error) + "</div>" : "") +
          "</div></section>";
      }).join("") + '<p class="hr-hint">لا تُعرض أي Tokens أو أسرار هنا. المنصات التي تتطلب اعتماد شريك (مثل LinkedIn) تبقى معطّلة حتى الحصول على الاعتماد الرسمي — بدون Scraping أو مشاركة كلمات مرور.</p>';
      $("ig-list").querySelectorAll("[data-ig-test]").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = list[Number(b.getAttribute("data-ig-test"))];
          toast(i.health === "Healthy" ? "✅ " + i.platform + ": الاتصال سليم." : "⚠️ " + i.platform + ": " + (i.error || "التكامل غير مفعّل بعد."));
        });
      });
      $("ig-list").querySelectorAll("[data-ig-sync]").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = list[Number(b.getAttribute("data-ig-sync"))];
          toast(i.status === "OFFICIAL_API_AVAILABLE" || i.status === "FEED_AVAILABLE" ? "المزامنة تُشغَّل من محرك التكاملات (n8n) — تُفعَّل مع الربط النهائي." : i.platform + ": لا مزامنة آلية لهذا النوع من التكامل.");
        });
      });
    }).catch(function () { dataError("ig-list"); });
  }

  /* ================= automation center (inbox) ================= */
  function pageAutomations() {
    HRStore.ready().then(function (d) {
      var KINDS = { approval: ["موافقات مطلوبة", "🟠"], missing: ["معلومات ناقصة", "❓"], integration: ["التكاملات", "🔌"], delayed: ["متأخر", "⏱️"], interview: ["مقابلات", "📅"], onboarding: ["المباشرة", "🧾"] };
      var items = HRStore.isReal() ? [] : (d.automationInbox || []);
      if (HRStore.isReal() && !items.length) { $("am-inbox").innerHTML = '<section class="hr-card"><div class="bd"><div class="hr-empty"><b>لا شيء يحتاج تدخلك الآن ✅</b><p>ستظهر هنا الموافقات المطلوبة والتنبيهات فور تفعيل الأتمتة على بياناتك.</p></div></div></section>'; }
      var groups = {};
      items.forEach(function (it) { (groups[it.kind] = groups[it.kind] || []).push(it); });
      $("am-inbox").innerHTML = Object.keys(groups).map(function (k) {
        var g = KINDS[k] || [k, "•"];
        return '<section class="hr-card" style="margin-bottom:12px"><div class="hd"><h2>' + g[1] + " " + g[0] + ' <span class="hr-tag">' + groups[k].length + "</span></h2></div><div class=\"bd\">" +
          groups[k].map(function (it) {
            return '<div class="hr-cand" style="align-items:center"><div class="c-body"><div style="font-size:.87rem">' + esc(it.text) + "</div></div>" +
              (it.urgent ? '<span class="hr-tag t-red">عاجل</span>' : "") +
              '<a class="hr-btn hr-btn-sm hr-btn-soft" href="' + it.href + '">افتح</a></div>';
          }).join("") + "</div></section>";
      }).join("");
      var TPLS = ["توظيف سريع", "توظيف احترافي", "توظيف تنفيذي", "توظيف جماعي", "وظائف تشغيلية", "تدريب وحديثو التخرج", "توظيف تديره Business Partner", "توظيف داخلي سري"];
      $("am-templates").innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' + TPLS.map(function (t) { return '<span class="hr-tag t-teal">' + t + "</span>"; }).join("") + '</div><p class="hr-hint" style="margin-top:10px">القوالب تحدد المراحل وأسئلة الفرز والرسائل والتذكيرات وSLA والموافقات — تشغيلها الفعلي (WorkflowRun) يأتي مع محرك الأتمتة. لا يُنفَّذ أي إرسال حقيقي بدون اعتماد بشري.</p>';
    }).catch(function () { dataError("am-inbox"); });
  }

  /* ================= onboarding board ================= */
  var OB_STATUS = {
    NOT_STARTED: ["لم يبدأ", ""], WAITING_CANDIDATE: ["بانتظار الموظف", "t-blue"], WAITING_EMPLOYER: ["بانتظار صاحب العمل", "t-blue"],
    DOCUMENTS_INCOMPLETE: ["مستندات ناقصة", "t-orange"], DOCUMENTS_UNDER_REVIEW: ["مستندات قيد المراجعة", "t-purple"],
    CONTRACT_DRAFT: ["مسودة عقد", ""], CONTRACT_SENT: ["أُرسل العقد", "t-teal"], CONTRACT_ACCEPTED: ["قُبل العقد", "t-green"],
    GOVERNMENT_ACTION_REQUIRED: ["إجراء حكومي مطلوب", "t-red"], WORK_ELIGIBILITY_PENDING: ["أهلية العمل معلقة", "t-orange"],
    GOSI_PENDING: ["التأمينات معلقة", "t-orange"], INSURANCE_PENDING: ["التأمين الطبي معلق", "t-orange"],
    PAYROLL_PENDING: ["الرواتب معلقة", "t-orange"], IT_SETUP_PENDING: ["تجهيز IT معلق", "t-orange"],
    READY_TO_START: ["جاهز للمباشرة", "t-green"], STARTED: ["باشر", "t-green"], IN_PROBATION: ["في فترة التجربة", "t-teal"],
    COMPLETED: ["مكتمل", "t-green"], BLOCKED: ["معطَّل", "t-red"], CANCELLED: ["ملغي", "t-red"],
  };
  function pageOnboarding() {
    HRStore.ready().then(function (d) {
      var cases = HRStore.isReal() ? [] : (d.onboardingCases || []);
      if (HRStore.isReal() && !cases.length) { $("ob-list").innerHTML = '<div class="hr-empty"><b>لا موظفون جدد بعد</b><p>عند قبول أول عرض وظيفي، تبدأ رحلة المباشرة هنا تلقائياً.</p></div>'; $("ob-detail").innerHTML = ""; return; }
      var view = "journey";
      var selected = cases.length ? cases[0].id : null;
      function caseOf(id) { return cases.filter(function (c) { return c.id === id; })[0]; }
      function taskTag(st) { return st === "done" ? "✅" : st === "blocked" ? "⛔" : st === "review" ? "🔎" : "⬜"; }
      function renderList() {
        $("ob-list").innerHTML = '<table class="hr-tbl"><thead><tr><th>الموظف</th><th>الوظيفة</th><th>التصنيف</th><th>المباشرة</th><th>الاكتمال</th><th>الحالة</th><th></th></tr></thead><tbody>' +
          cases.map(function (c) {
            var st = OB_STATUS[c.status] || [c.status, ""];
            return '<tr><td class="t-title">' + esc(c.name) + "</td><td>" + esc(c.job) + '</td><td style="font-size:.78rem">' + esc(c.classification) + "</td><td>" + fmtDate(c.startDate) + '</td><td><span style="display:inline-block;width:90px;height:8px;background:var(--hr-gray-bg);border-radius:99px;vertical-align:middle;margin-inline-end:6px"><span style="display:block;height:100%;width:' + c.completion + '%;border-radius:99px;background:var(--hr-teal)"></span></span>' + c.completion + '%</td><td><span class="hr-tag ' + st[1] + '">' + st[0] + '</span></td><td><button class="hr-btn hr-btn-sm hr-btn-ghost" data-ob="' + c.id + '">التفاصيل</button></td></tr>';
          }).join("") + "</tbody></table>";
        $("ob-list").querySelectorAll("[data-ob]").forEach(function (b) {
          b.addEventListener("click", function () { selected = b.getAttribute("data-ob"); renderDetail(); document.getElementById("ob-detail").scrollIntoView({ behavior: "smooth" }); });
        });
      }
      function renderDetail() {
        var c = caseOf(selected);
        var box = $("ob-detail");
        if (!c) { box.innerHTML = ""; return; }
        var blockedHtml = c.blocked ? '<div class="hr-error" style="margin-bottom:12px"><b>⛔ معطَّل:</b> ' + esc(c.blocked.reason) + "<br><b>المسؤول:</b> " + esc(c.blocked.owner) + " · <b>الإجراء:</b> " + esc(c.blocked.action) + " · <b>الموعد:</b> " + fmtDate(c.blocked.due) + " · <b>الخطورة:</b> " + esc(c.blocked.severity) + "<br><b>الأثر:</b> " + esc(c.blocked.impact) + "</div>" : "";
        if (view === "journey") {
          box.innerHTML = '<section class="hr-card"><div class="hd"><h2>رحلة ' + esc(c.name) + " — " + esc(c.classification) + "</h2></div><div class=\"bd\">" + blockedHtml +
            c.stages.map(function (sg) {
              var doneN = sg.tasks.filter(function (t) { return t[1] === "done"; }).length;
              return '<div style="margin-bottom:14px"><b style="color:var(--hr-navy);font-size:.9rem">' + esc(sg.label) + '</b> <span class="hr-hint">(' + doneN + "/" + sg.tasks.length + ')</span><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' +
                sg.tasks.map(function (t) { return '<div style="font-size:.85rem">' + taskTag(t[1]) + " " + esc(t[0]) + "</div>"; }).join("") + "</div></div>";
            }).join("") +
            '<p class="hr-hint">المعاملات الحكومية لا تُنفذ آلياً — تُنشأ مهمة موجهة بمسؤول وخطوات وإثبات إنجاز، وبدون تخزين بيانات دخول المنصات الحكومية.</p></div></section>';
        } else {
          var byStage = {};
          cases.forEach(function (cs) {
            cs.stages.forEach(function (sg) {
              sg.tasks.forEach(function (t) {
                if (t[1] === "done") return;
                (byStage[sg.label] = byStage[sg.label] || []).push({ emp: cs.name, task: t[0], st: t[1] });
              });
            });
          });
          box.innerHTML = '<section class="hr-card"><div class="hd"><h2>المهام المفتوحة حسب المرحلة (كل الموظفين)</h2></div><div class="bd">' +
            Object.keys(byStage).map(function (k) {
              return '<div style="margin-bottom:14px"><b style="color:var(--hr-navy);font-size:.9rem">' + esc(k) + '</b><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">' +
                byStage[k].map(function (t) { return '<div style="font-size:.85rem">' + taskTag(t.st) + " " + esc(t.task) + ' <span class="hr-hint">— ' + esc(t.emp) + "</span></div>"; }).join("") + "</div></div>";
            }).join("") + "</div></section>";
        }
      }
      $("ob-view-journey").addEventListener("click", function () { view = "journey"; $("ob-view-journey").classList.add("active"); $("ob-view-depts").classList.remove("active"); renderDetail(); });
      $("ob-view-depts").addEventListener("click", function () { view = "depts"; $("ob-view-depts").classList.add("active"); $("ob-view-journey").classList.remove("active"); renderDetail(); });
      renderList();
      renderDetail();
    }).catch(function () { dataError("ob-list"); });
  }


  /* ================= talent pool ================= */
  // With a real access code the pool is the LIVE CV bank (10k+ from the
  // site's /api/candidates, server-side filters + resumable scan). Demo mode
  // keeps the small sample set with a clear banner.
  function pageTalent() {
    var rc = hrRealCode();
    if (rc) { realTalentPool(rc); return; }
    HRStore.ready().then(function (d) {
      $("tp-count").insertAdjacentHTML("beforebegin", '<div class="hr-error" style="background:var(--hr-orange-bg);color:var(--hr-orange)">هذه عيّنة تجريبية صغيرة — <a class="hr-link" href="/ar/employer-login">سجّل دخولك برمز اشتراكك</a> لعرض قاعدة السير الكاملة (+10 آلاف سيرة).</div>');
      var apps = HRStore.applications();
      function allCands() { return HRStore.candidates().concat(HRStore.bag("manualCands")); }
      var cities = {};
      allCands().forEach(function (c) { cities[c.city] = 1; });
      $("tp-city").innerHTML = '<option value="">كل المدن</option>' + Object.keys(cities).map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
      function appsOf(cid) { return apps.filter(function (a) { return a.candidateId === cid; }); }
      function render() {
        var q = $("tp-q").value.trim(), nat = $("tp-nat").value, city = $("tp-city").value, list = $("tp-list").value;
        var rows = allCands().filter(function (c) {
          if (q && (c.name + " " + c.title + " " + (c.skills || []).join(" ")).indexOf(q) < 0) return false;
          if (nat === "سعودي" && String(c.nationality).indexOf("سعودي") !== 0) return false;
          if (nat === "غير" && String(c.nationality).indexOf("سعودي") === 0) return false;
          if (city && c.city !== city) return false;
          var ca = appsOf(c.id);
          if (list === "future" && !ca.some(function (a) { return a.stage === "future"; })) return false;
          if (list === "noapp" && ca.length) return false;
          if (list === "invited" && !Object.keys(HRStore.bag("invites2")).some(function (k) { return k.indexOf(":" + c.id) > -1; })) return false;
          return true;
        });
        $("tp-count").textContent = rows.length + " مرشّح (عيّنة)";
        $("tp-grid").innerHTML = rows.length ? rows.map(function (c) {
          var ca = appsOf(c.id);
          return '<div class="hr-jcard"><div style="display:flex;gap:10px;align-items:center"><span class="hr-avatar">' + esc(initials(c.name)) + '</span><div><b style="color:var(--hr-navy)">' + esc(c.name) + '</b><div class="hr-hint">' + esc(c.title) + " · " + c.years + " سنة · " + esc(c.city) + '</div></div></div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:5px">' + (c.skills || []).slice(0, 3).map(function (sk) { return '<span class="hr-tag">' + esc(sk) + "</span>"; }).join("") + "</div>" +
            '<div class="foot"><span class="hr-match">' + (c.match || "—") + '%</span>' + (ca.length ? '<a class="hr-link" href="/hr/employer/applicant?id=' + ca[0].id + '">الملف ←</a>' : "") + "</div></div>";
        }).join("") : '<div class="hr-empty" style="grid-column:1/-1"><b>لا نتائج</b></div>';
      }
      ["tp-q", "tp-nat", "tp-city", "tp-list"].forEach(function (id) { $(id).addEventListener(id === "tp-q" ? "input" : "change", render); });
      $("tp-add").addEventListener("click", function () { toast("الإضافة اليدوية تتفعّل مع تسجيل الدخول برمزك الحقيقي."); });
      $("tp-import").addEventListener("click", function () { toast("استيراد CSV ورفع السير يتفعّل مع خط معالجة السير — قريباً."); });
      render();
    }).catch(function () { dataError("tp-grid"); });
  }
  function realTalentPool(code) {
    var MAX_RENDER = 500;
    var seq = 0;
    $("tp-list").hidden = true;
    $("tp-city").innerHTML = '<option value="">كل المدن</option><option>الرياض</option><option>جدة</option><option>الدمام</option><option>مكة</option><option>الخبر</option><option>المدينة</option>';
    $("tp-add").addEventListener("click", function () { toast("الإضافة اليدوية للسجل الحقيقي تُبنى مع نموذج الإدخال الموحد — استخدم نموذج المرشحين في الموقع حالياً."); });
    $("tp-import").addEventListener("click", function () { toast("استيراد CSV ورفع السير يتفعّل مع خط معالجة السير — قريباً."); });
    function realCard(c) {
      var name = c.name || "مرشّح";
      var skills = String(c.skills || "").split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3);
      return '<div class="hr-jcard"><div style="display:flex;gap:10px;align-items:center"><span class="hr-avatar">' + esc(initials(name)) + '</span><div><b style="color:var(--hr-navy)">' + esc(name) + '</b><div class="hr-hint">' + esc(c.role || c.field || "") + (c.experience ? " · خبرة " + esc(c.experience) : "") + (c.city ? " · " + esc(c.city) : "") + "</div></div></div>" +
        '<div class="meta"><span>' + esc(c.nationalityType || "") + "</span><span>" + esc(c.field || "") + "</span></div>" +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' + skills.map(function (sk) { return '<span class="hr-tag">' + esc(sk) + "</span>"; }).join("") + "</div>" +
        '<div class="foot"><span class="hr-hint">بنك السير</span><span style="display:flex;gap:8px">' + (c.cv ? '<a class="hr-link" target="_blank" rel="noopener" href="' + esc(c.cv) + '">السيرة CV</a>' : "") + '<a class="hr-link" href="/ar/candidate-profile?id=' + c.id + '">الملف الكامل ←</a></span></div></div>';
    }
    function scan() {
      var mySeq = ++seq;
      var q = $("tp-q").value.trim(), nat = $("tp-nat").value, city = $("tp-city").value;
      var params = new URLSearchParams({ code: code });
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      if (nat === "سعودي") params.set("nat", "سعودي");
      if (nat === "غير") params.set("nat", "غير سعودي");
      var total = 0, shown = 0;
      $("tp-grid").innerHTML = '<div class="hr-skel" style="height:120px;grid-column:1/-1"></div>';
      $("tp-count").textContent = "جارٍ البحث في قاعدة السير…";
      function step(cursor) {
        var qs2 = new URLSearchParams(params);
        if (cursor) qs2.set("cursor", cursor);
        fetch("/api/candidates?" + qs2).then(function (r) { return r.json(); }).then(function (d) {
          if (mySeq !== seq) return;
          if (!d || !d.ok) { $("tp-grid").innerHTML = '<div class="hr-error" style="grid-column:1/-1">تعذّر تحميل قاعدة السير — أعد المحاولة.</div>'; return; }
          var page = d.candidates || [];
          if (total === 0) $("tp-grid").innerHTML = "";
          total += page.length;
          if (shown < MAX_RENDER && page.length) {
            var slice = page.slice(0, MAX_RENDER - shown);
            shown += slice.length;
            $("tp-grid").insertAdjacentHTML("beforeend", slice.map(realCard).join(""));
          }
          if (!total && d.done) { $("tp-grid").innerHTML = '<div class="hr-empty" style="grid-column:1/-1"><b>لا نتائج مطابقة</b><p>جرّب بحثاً أوسع.</p></div>'; $("tp-count").textContent = "0 مرشّح"; return; }
          $("tp-count").textContent = total.toLocaleString("en-US") + " مرشّح" + (d.done ? "" : " حتى الآن — العدّ مستمر…") + (total > MAX_RENDER ? " · يُعرض أول " + MAX_RENDER + " — ضيّق بالفلاتر لنتائج أدق" : "");
          if (!d.done && d.nextCursor) step(d.nextCursor);
        }).catch(function () { if (mySeq === seq) $("tp-count").textContent = "خطأ في الاتصال — أعد المحاولة."; });
      }
      step(null);
    }
    var deb = null;
    ["tp-q", "tp-nat", "tp-city"].forEach(function (id) {
      $(id).addEventListener(id === "tp-q" ? "input" : "change", function () { clearTimeout(deb); deb = setTimeout(scan, 500); });
    });
    scan();
  }

  /* ================= interviews ================= */
  function pageInterviews() {
    HRStore.ready().then(function (d) {
      function allIv() {
        var edits = HRStore.bag("ivEdits");
        var base = HRStore.isReal() ? [] : d.interviews;
        return base.map(function (iv) { return Object.assign({}, iv, edits[iv.id] || {}); }).concat(HRStore.bag("ivExtra"));
      }
      function render() {
        var ivs = allIv().slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; });
        var byDay = {};
        ivs.forEach(function (iv) { var k = iv.at.slice(0, 10); (byDay[k] = byDay[k] || []).push(iv); });
        $("iv-list").innerHTML = Object.keys(byDay).sort().map(function (day) {
          return '<section class="hr-card" style="margin-bottom:12px"><div class="hd"><h2>' + dayName(day) + " " + fmtDate(day) + "</h2></div><div class=\"bd\">" +
            byDay[day].map(function (iv) {
              var c = HRStore.candidate(iv.candidateId) || HRStore.bag("manualCands").filter(function (x) { return x.id === iv.candidateId; })[0] || { name: iv.candidateName || "مرشّح" };
              var j = HRStore.job(iv.jobId) || { title: iv.jobTitle || "" };
              var stTag = iv.status === "ملغاة" ? "t-red" : iv.status === "مؤكدة" ? "t-green" : "t-orange";
              return '<div class="hr-cand" style="align-items:center"><span class="hr-avatar">' + esc(initials(c.name)) + '</span><div class="c-body"><b>' + esc(c.name) + '</b><div class="c-sub">' + esc(j.title) + " · " + fmtTime(iv.at) + " · " + esc(iv.type) + " · " + esc(iv.location || "") + '</div><div class="c-sub">اللجنة: ' + esc((iv.panel || []).join("، ")) + '</div></div><span class="hr-tag ' + stTag + '">' + esc(iv.status) + "</span>" +
                (iv.status !== "ملغاة" ? '<span style="display:flex;gap:5px"><button class="hr-btn hr-btn-sm hr-btn-ghost" data-iv-c="' + iv.id + '">تأكيد</button><button class="hr-btn hr-btn-sm hr-btn-danger" data-iv-x="' + iv.id + '">إلغاء</button></span>' : "") + "</div>";
            }).join("") + "</div></section>";
        }).join("") || '<div class="hr-empty"><b>لا مقابلات مجدولة</b></div>';
        function setIv(id, patch, msg) {
          var extra = HRStore.bag("ivExtra");
          var hit = extra.filter(function (x) { return x.id === id; })[0];
          if (hit) { Object.assign(hit, patch); HRStore.setBag("ivExtra", extra); }
          else { var edits = HRStore.bag("ivEdits"); edits[id] = Object.assign(edits[id] || {}, patch); HRStore.setBag("ivEdits", edits); }
          HRStore.logActivity("interview", msg);
          render();
        }
        $("iv-list").querySelectorAll("[data-iv-c]").forEach(function (b) { b.addEventListener("click", function () { setIv(b.getAttribute("data-iv-c"), { status: "مؤكدة" }, "أُكدت مقابلة"); }); });
        $("iv-list").querySelectorAll("[data-iv-x]").forEach(function (b) {
          b.addEventListener("click", function () {
            confirmModal("إلغاء المقابلة", "سيُسجل الإلغاء في سجل التغييرات.", "إلغاء المقابلة", true).then(function (ok) { if (ok) setIv(b.getAttribute("data-iv-x"), { status: "ملغاة" }, "أُلغيت مقابلة"); });
          });
        });
      }
      $("iv-new").addEventListener("click", function () {
        var w = $("iv-form-wrap");
        w.hidden = !w.hidden;
        if (!w.innerHTML) {
          var candOpts = HRStore.applications().map(function (a) { return '<option value="' + a.candidateId + "|" + a.jobId + '">' + esc(a.candidate.name) + " — " + esc(a.job.title) + "</option>"; }).join("");
          w.innerHTML = '<section class="hr-card"><div class="bd"><h3 style="color:var(--hr-navy);margin-bottom:10px">مقابلة جديدة</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px">' +
            '<div class="hr-field"><label>المرشّح والوظيفة</label><select id="ivn-app">' + candOpts + "</select></div>" +
            '<div class="hr-field"><label>التاريخ والوقت</label><input id="ivn-at" type="datetime-local"></div>' +
            '<div class="hr-field"><label>النوع</label><select id="ivn-type"><option>حضورية</option><option>اتصال</option><option>فيديو</option></select></div>' +
            '<div class="hr-field"><label>المكان أو رابط الاجتماع</label><input id="ivn-loc" placeholder="قاعة الاجتماعات / رابط Meet"></div>' +
            '<div class="hr-field"><label>اللجنة</label><input id="ivn-panel" placeholder="أسماء مفصولة بفاصلة"></div></div>' +
            '<button class="hr-btn hr-btn-primary hr-btn-sm" id="ivn-save">حفظ المقابلة</button> <span class="hr-hint">دعوة التقويم والتذكيرات تُرسل عبر n8n عند الربط.</span></div></section>';
          $("ivn-save").addEventListener("click", function () {
            var at = $("ivn-at").value;
            if (!at) { toast("حدد التاريخ والوقت."); return; }
            var parts = $("ivn-app").value.split("|");
            var extra = HRStore.bag("ivExtra");
            extra.push({ id: "iv_l" + Date.now(), candidateId: parts[0], jobId: parts[1], at: at + ":00+03:00", type: $("ivn-type").value, location: $("ivn-loc").value, panel: $("ivn-panel").value.split("،").join(",").split(",").map(function (x) { return x.trim(); }).filter(Boolean), status: "بانتظار التأكيد" });
            HRStore.setBag("ivExtra", extra);
            HRStore.logActivity("interview", "حُددت مقابلة جديدة");
            w.hidden = true;
            render();
            toast("حُفظت المقابلة.");
          });
        }
      });
      render();
    }).catch(function () { dataError("iv-list"); });
  }

  /* ================= messages ================= */
  var MSG_TEMPLATES = [
    ["تأكيد استلام الطلب", "وصلنا طلبك يا {{candidate_name}} لوظيفة {{job_title}} وسنراجعه خلال أيام."],
    ["دعوة مرشّح للتقديم", "مرحباً {{candidate_name}}، أعجبنا ملفك ونرى ملاءمتك لوظيفة {{job_title}} في {{company_name}}. قدّم عبر الرابط: {{apply_link}}"],
    ["طلب معلومات ناقصة", "مرحباً {{candidate_name}}، لإكمال طلبك على {{job_title}} نحتاج: الراتب المتوقع ومدة الإشعار."],
    ["دعوة مقابلة", "يسعدنا دعوتك يا {{candidate_name}} لمقابلة لوظيفة {{job_title}} يوم {{interview_date}}. فضلاً أكّد حضورك."],
    ["إعادة جدولة", "نعتذر يا {{candidate_name}} — نحتاج إعادة جدولة مقابلتك لوظيفة {{job_title}}. ما الأوقات المناسبة لك؟"],
    ["طلب مستندات", "فضلاً يا {{candidate_name}} أرسل: الهوية/الإقامة وشهادة المؤهل لاستكمال إجراءات {{job_title}}."],
    ["إشعار انتقال مرحلة", "تحديث جيد يا {{candidate_name}}! انتقل طلبك لوظيفة {{job_title}} إلى المرحلة التالية."],
    ["العرض الوظيفي", "تهانينا {{candidate_name}} 🎉 يسعدنا تقديم عرض وظيفي لك لوظيفة {{job_title}} في {{company_name}}. التفاصيل في المرفق."],
    ["اعتذار", "شكراً لاهتمامك يا {{candidate_name}} بوظيفة {{job_title}}. اخترنا مرشحاً آخر لهذه المرحلة، وسنحتفظ بملفك للفرص القادمة."],
    ["حفظ لفرصة مستقبلية", "ملفك مميز يا {{candidate_name}} وسنحتفظ به لفرص قادمة تناسبك في {{company_name}}."],
  ];
  function pageMessages() {
    HRStore.ready().then(function (d) {
      var apps = HRStore.applications();
      $("ms-compose").innerHTML =
        '<div class="hr-field"><label>القالب</label><select id="ms-tpl">' + MSG_TEMPLATES.map(function (t, i) { return '<option value="' + i + '">' + t[0] + "</option>"; }).join("") + "</select></div>" +
        '<div class="hr-field"><label>المرشّح</label><select id="ms-cand">' + apps.map(function (a) { return '<option value="' + a.id + '">' + esc(a.candidate.name) + " — " + esc(a.job.title) + "</option>"; }).join("") + "</select></div>" +
        '<div class="hr-field"><label>القناة</label><select id="ms-ch"><option value="email">بريد إلكتروني (متاح عبر n8n)</option><option value="whatsapp">واتساب (بانتظار اعتماد القالب)</option><option value="platform">رسالة المنصة</option></select></div>' +
        '<div class="hr-field"><label>المعاينة (المتغيرات مُعبأة تلقائياً)</label><textarea id="ms-preview" rows="4"></textarea></div>' +
        '<button class="hr-btn hr-btn-primary hr-btn-sm" id="ms-send">تسجيل الإرسال</button> <span class="hr-hint">أثناء التطوير: تُسجل الرسالة في السجل ولا يتم إرسال حقيقي.</span>';
      function fill() {
        var t = MSG_TEMPLATES[Number($("ms-tpl").value)];
        var a = apps.filter(function (x) { return x.id === $("ms-cand").value; })[0] || apps[0];
        if (!a) return;
        $("ms-preview").value = t[1].split("{{candidate_name}}").join(a.candidate.name).split("{{job_title}}").join(a.job.title).split("{{company_name}}").join(HRStore.company().name).split("{{apply_link}}").join("businesspartner.sa/ar/careers").split("{{interview_date}}").join("الخميس 10:00 ص");
      }
      $("ms-tpl").addEventListener("change", fill);
      $("ms-cand").addEventListener("change", fill);
      fill();
      function renderLog() {
        var comms = HRStore.bag("comms");
        $("ms-log").innerHTML = comms.length ? comms.slice(0, 12).map(function (m) {
          return '<div class="hr-cand"><div class="c-body"><div style="font-size:.85rem"><b>' + esc(m.to) + "</b> · " + esc(m.tpl) + '</div><div class="c-sub">' + esc(m.ch) + " · " + fmtDate(m.at) + " " + fmtTime(m.at) + ' · <span class="hr-tag">مسجلة (لم تُرسل)</span></div></div></div>';
        }).join("") : '<div class="hr-empty"><b>لا رسائل مسجلة بعد</b></div>';
      }
      $("ms-send").addEventListener("click", function () {
        var a = apps.filter(function (x) { return x.id === $("ms-cand").value; })[0];
        if (!a) return;
        var comms = HRStore.bag("comms");
        comms.unshift({ at: new Date().toISOString(), to: a.candidate.name, tpl: MSG_TEMPLATES[Number($("ms-tpl").value)][0], ch: $("ms-ch").selectedOptions[0].textContent, body: $("ms-preview").value });
        HRStore.setBag("comms", comms);
        renderLog();
        toast("سُجلت الرسالة في السجل — الإرسال الفعلي يتفعّل مع ربط القنوات.");
      });
      renderLog();
      $("ms-templates").innerHTML = MSG_TEMPLATES.map(function (t) { return '<div class="hr-cand"><div class="c-body"><b style="font-size:.87rem">' + t[0] + '</b><div class="c-sub">' + esc(t[1]) + "</div></div></div>"; }).join("") + '<p class="hr-hint" style="margin-top:8px">كل رسالة تسجل: القناة، المستلم، القالب، المتغيرات، وقت الإرسال، حالة التسليم والقراءة والرد.</p>';
    }).catch(function () { dataError("ms-compose"); });
  }

  /* ================= offers ================= */
  function pageOffers() {
    HRStore.ready().then(function (d) {
      var OF_ST = { draft: ["مسودة", ""], pending: ["بانتظار الموافقة الداخلية", "t-orange"], sent: ["أُرسل للمرشّح", "t-teal"], accepted: ["مقبول ✓", "t-green"], declined: ["مرفوض", "t-red"], negotiating: ["تفاوض", "t-purple"] };
      function offers() { return HRStore.bag("offers"); }
      function render() {
        var seeded = HRStore.applications().filter(function (a) { return a.stage === "offer"; }).filter(function (a) {
          return !offers().some(function (o) { return o.appId === a.id; });
        }).map(function (a) { return { id: "of_s" + a.id, appId: a.id, name: a.candidate.name, job: a.job.title, base: null, status: "draft", startDate: "", validUntil: "" }; });
        var rows = offers().concat(seeded);
        $("of-list").innerHTML = rows.length ? rows.map(function (o) {
          var st = OF_ST[o.status] || [o.status, ""];
          var acts = "";
          if (o.status === "draft") acts = '<button class="hr-btn hr-btn-sm hr-btn-soft" data-of="pending" data-id="' + o.id + '">طلب الموافقة الداخلية</button>';
          else if (o.status === "pending") acts = '<button class="hr-btn hr-btn-sm hr-btn-primary" data-of="sent" data-id="' + o.id + '">اعتماد وإرسال</button>';
          else if (o.status === "sent" || o.status === "negotiating") acts = '<button class="hr-btn hr-btn-sm hr-btn-soft" data-of="accepted" data-id="' + o.id + '">قبِله المرشّح</button> <button class="hr-btn hr-btn-sm hr-btn-ghost" data-of="negotiating" data-id="' + o.id + '">طلب تعديل</button> <button class="hr-btn hr-btn-sm hr-btn-danger" data-of="declined" data-id="' + o.id + '">رفضه</button>';
          else if (o.status === "accepted") acts = '<a class="hr-btn hr-btn-sm hr-btn-primary" href="/hr/employer/onboarding">→ بدء رحلة المباشرة</a>';
          return '<section class="hr-card" style="margin-bottom:12px"><div class="bd" style="display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center">' +
            '<div style="flex:1;min-width:180px"><b style="color:var(--hr-navy)">' + esc(o.name) + '</b><div class="hr-hint">' + esc(o.job) + (o.base ? " · أساسي: " + o.base + " ريال" : " · الراتب لم يُحدد بعد") + (o.startDate ? " · مباشرة: " + fmtDate(o.startDate) : "") + "</div></div>" +
            '<span class="hr-tag ' + st[1] + '">' + st[0] + "</span><span style=\"display:flex;gap:6px;flex-wrap:wrap\">" + acts + "</span></div></section>";
        }).join("") : '<div class="hr-empty"><b>لا عروض بعد</b><p>انقل مرشحاً إلى مرحلة «عرض وظيفي» أو أنشئ عرضاً جديداً.</p></div>';
        $("of-list").querySelectorAll("[data-of]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = b.getAttribute("data-id"), to = b.getAttribute("data-of");
            var doIt = function () {
              var list = offers();
              var hit = list.filter(function (o) { return o.id === id; })[0];
              if (!hit) {
                var appId = id.replace("of_s", "");
                var a = HRStore.application(appId);
                hit = { id: id, appId: appId, name: a ? a.candidate.name : "", job: a ? a.job.title : "", base: null, status: "draft" };
                list.push(hit);
              }
              hit.status = to;
              HRStore.setBag("offers", list);
              if (to === "accepted" && hit.appId) HRStore.setStageSilent(hit.appId, "hired");
              HRStore.logActivity("offer", "تحديث عرض " + hit.name + " → " + (OF_ST[to] || [to])[0]);
              render();
            };
            if (to === "sent" || to === "accepted") confirmModal(to === "sent" ? "اعتماد وإرسال العرض" : "تأكيد قبول المرشّح", to === "sent" ? "الإرسال الفعلي يتفعّل مع ربط القنوات — الآن يُسجل الاعتماد فقط." : "سيتحول المرشّح إلى «تم التوظيف» وتبدأ رحلة المباشرة.", "تأكيد").then(function (ok) { if (ok) doIt(); });
            else doIt();
          });
        });
      }
      $("of-new").addEventListener("click", function () {
        var w = $("of-form-wrap");
        w.hidden = !w.hidden;
        if (!w.innerHTML) {
          var opts = HRStore.applications().filter(function (a) { return ["shortlist", "interview", "offer"].indexOf(a.stage) > -1; }).map(function (a) { return '<option value="' + a.id + '">' + esc(a.candidate.name) + " — " + esc(a.job.title) + "</option>"; }).join("");
          w.innerHTML = '<section class="hr-card"><div class="bd"><h3 style="color:var(--hr-navy);margin-bottom:10px">عرض وظيفي جديد</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px">' +
            '<div class="hr-field"><label>المرشّح</label><select id="ofn-app">' + opts + "</select></div>" +
            '<div class="hr-field"><label>الراتب الأساسي (ريال)</label><input id="ofn-base" type="number" min="0"></div>' +
            '<div class="hr-field"><label>بدل السكن</label><input id="ofn-house" type="number" min="0" value="0"></div>' +
            '<div class="hr-field"><label>بدل المواصلات</label><input id="ofn-trans" type="number" min="0" value="0"></div>' +
            '<div class="hr-field"><label>تاريخ المباشرة</label><input id="ofn-start" type="date"></div>' +
            '<div class="hr-field"><label>صلاحية العرض حتى</label><input id="ofn-valid" type="date"></div></div>' +
            '<div class="hr-field"><label>المزايا</label><input id="ofn-benefits" value="تأمين طبي، إجازات نظامية"></div>' +
            '<button class="hr-btn hr-btn-primary hr-btn-sm" id="ofn-save">حفظ كمسودة</button> <span class="hr-hint">الراتب النهائي والإرسال يحتاجان اعتماداً بشرياً دائماً.</span></div></section>';
          $("ofn-save").addEventListener("click", function () {
            var a = HRStore.application($("ofn-app").value);
            if (!a) return;
            var list = offers();
            list.unshift({ id: "of_l" + Date.now(), appId: a.id, name: a.candidate.name, job: a.job.title, base: Number($("ofn-base").value) || null, housing: Number($("ofn-house").value) || 0, transport: Number($("ofn-trans").value) || 0, benefits: $("ofn-benefits").value, startDate: $("ofn-start").value, validUntil: $("ofn-valid").value, status: "draft" });
            HRStore.setBag("offers", list);
            HRStore.setStageSilent(a.id, "offer");
            w.hidden = true;
            render();
            toast("حُفظ العرض كمسودة.");
          });
        }
      });
      render();
    }).catch(function () { dataError("of-list"); });
  }

  /* ================= billing / settings / help / team / company ================= */
  function pageBilling() {
    HRStore.ready().then(function () {
      var co = HRStore.company();
      $("bl-root").innerHTML =
        '<div class="hr-kpis"><div class="hr-kpi"><span class="k-top"><span>الباقة الحالية</span></span><span class="k-num" style="font-size:1.2rem">' + esc(co.plan || "احترافية") + '</span><span class="k-sub">مفعّلة</span></div>' +
        '<div class="hr-kpi"><span class="k-top"><span>الوظائف المنشورة</span></span><span class="k-num">' + HRStore.jobs().filter(function (j) { return j.status === "منشورة"; }).length + "</span></div>" +
        '<div class="hr-kpi"><span class="k-top"><span>أعضاء الفريق</span></span><span class="k-num">' + (1 + HRStore.bag("team").length) + "</span></div></div>" +
        '<section class="hr-card" style="margin-top:16px"><div class="hd"><h2>الفواتير</h2></div><div class="bd"><div class="hr-empty"><b>سجل الفواتير يُعرض هنا</b><p>يرتبط بنظام الاشتراكات في الموقع — <a class="hr-link" href="/ar/packages">استعرض الباقات</a> أو <a class="hr-link" href="/ar/contact">تواصل معنا للترقية</a>.</p></div></div></section>';
    }).catch(function () { dataError("bl-root"); });
  }
  function pageTeam() {
    HRStore.ready().then(function (d) {
      var ROLES = ["مالك الحساب", "مدير الموارد البشرية", "مسؤول التوظيف", "مدير القسم", "محاور", "عميل خارجي", "مشاهدة فقط"];
      var ACTIONS = ["رؤية الراتب", "رؤية بيانات التواصل", "نشر الوظائف", "رفض المرشّح", "تقديم العرض", "تنزيل البيانات", "إدارة الفريق", "إعدادات الشركة"];
      var GRANTS = [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0],[0,1,1,1,0,0,0,0],[0,1,0,1,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
      function render() {
        var members = [{ name: d.user.name, role: "مالك الحساب", email: "—" }].concat(HRStore.bag("team"));
        $("tm-members").innerHTML = members.map(function (m) {
          return '<div class="hr-cand" style="align-items:center"><span class="hr-avatar">' + esc(initials(m.name)) + '</span><div class="c-body"><b>' + esc(m.name) + '</b><div class="c-sub">' + esc(m.email || "") + '</div></div><span class="hr-tag t-teal">' + esc(m.role) + "</span></div>";
        }).join("");
      }
      $("tm-matrix").innerHTML = '<table class="hr-tbl"><thead><tr><th>الدور</th>' + ACTIONS.map(function (a) { return "<th>" + a + "</th>"; }).join("") + "</tr></thead><tbody>" +
        ROLES.map(function (r, ri) { return '<tr><td class="t-title">' + r + "</td>" + ACTIONS.map(function (_, ai) { return "<td>" + (GRANTS[ri][ai] ? "✓" : "—") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
      $("tm-invite").addEventListener("click", function () {
        var w = $("tm-form-wrap");
        w.hidden = !w.hidden;
        if (!w.innerHTML) {
          w.innerHTML = '<section class="hr-card"><div class="bd"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px">' +
            '<div class="hr-field"><label>الاسم *</label><input id="tmn-name"></div><div class="hr-field"><label>البريد *</label><input id="tmn-email" type="email"></div>' +
            '<div class="hr-field"><label>الدور</label><select id="tmn-role">' + ROLES.slice(1).map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></div></div>" +
            '<button class="hr-btn hr-btn-primary hr-btn-sm" id="tmn-save">إرسال الدعوة</button> <span class="hr-hint">بريد الدعوة الفعلي يتفعّل مع ربط القنوات — تُسجل العضوية الآن.</span></div></section>';
          $("tmn-save").addEventListener("click", function () {
            if (!$("tmn-name").value.trim() || !$("tmn-email").value.trim()) { toast("الاسم والبريد مطلوبان."); return; }
            var team = HRStore.bag("team");
            team.push({ name: $("tmn-name").value.trim(), email: $("tmn-email").value.trim(), role: $("tmn-role").value });
            HRStore.setBag("team", team);
            w.hidden = true;
            render();
            toast("أُضيف العضو.");
          });
        }
      });
      render();
    }).catch(function () { dataError("tm-members"); });
  }
  function pageCompany() {
    HRStore.ready().then(function () {
      var co = HRStore.company();
      var F = [["name", "اسم الشركة"], ["sector", "النشاط / القطاع"], ["city", "المدينة الرئيسية"], ["size", "حجم الشركة"], ["about", "وصف الشركة"], ["workdays", "أيام وساعات العمل"], ["workMode", "أسلوب العمل الافتراضي"], ["benefits", "المزايا الافتراضية"]];
      $("co-form").innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 16px">' +
        F.map(function (f) {
          var val = co[f[0]] || (f[0] === "workMode" ? "حضوري" : f[0] === "workdays" ? "الأحد–الخميس، 8ص–5م" : "");
          return '<div class="hr-field"><label>' + f[1] + '</label><input data-co="' + f[0] + '" value="' + esc(val) + '"></div>';
        }).join("") + "</div>" +
        '<button class="hr-btn hr-btn-primary" id="co-save">حفظ الإعدادات</button> <span class="hr-hint">تُستخدم هذه القيم تلقائياً عند إنشاء أي وظيفة جديدة (Company Hiring Defaults).</span>';
      $("co-save").addEventListener("click", function () {
        var prof = HRStore.bag("companyProfile");
        document.querySelectorAll("[data-co]").forEach(function (i) { prof[i.getAttribute("data-co")] = i.value.trim(); });
        HRStore.setBag("companyProfile", prof);
        toast("حُفظت إعدادات الشركة — ستُستخدم في الوظائف الجديدة.");
      });
    }).catch(function () { dataError("co-form"); });
  }
  function pageSettings() {
    HRStore.ready().then(function () {
      var prefs = HRStore.bag("prefs");
      $("st-root").innerHTML =
        '<section class="hr-card"><div class="hd"><h2>التفضيلات</h2></div><div class="bd">' +
        '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="st-notif"' + (prefs.notif !== false ? " checked" : "") + "> إشعارات المتقدمين الجدد</label>" +
        '<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="st-digest"' + (prefs.digest ? " checked" : "") + "> ملخص أسبوعي بالبريد</label>" +
        '<div class="hr-field" style="max-width:280px"><label>اللغة</label><select id="st-lang"><option>العربية</option><option disabled>English (قريباً)</option></select></div>' +
        '<button class="hr-btn hr-btn-primary hr-btn-sm" id="st-save">حفظ</button></div></section>' +
        '<section class="hr-card" style="margin-top:14px"><div class="hd"><h2>البيانات</h2></div><div class="bd"><p class="hr-hint" style="margin-bottom:10px">تعمل اللوحة حالياً على بيانات تجريبية + تعديلاتك المحفوظة على هذا الجهاز.</p><button class="hr-btn hr-btn-danger hr-btn-sm" id="st-reset">مسح بيانات التجربة وإعادة الضبط</button></div></section>';
      $("st-save").addEventListener("click", function () {
        HRStore.setBag("prefs", { notif: $("st-notif").checked, digest: $("st-digest").checked });
        toast("حُفظت التفضيلات.");
      });
      $("st-reset").addEventListener("click", function () {
        confirmModal("إعادة الضبط", "سيُمسح كل ما عدّلته في وضع التجربة على هذا الجهاز (وظائف، مراحل، عروض، ملاحظات).", "مسح وإعادة الضبط", true).then(function (ok) {
          if (!ok) return;
          try { localStorage.removeItem("bp_hr_overlay"); localStorage.removeItem("bp_hr_invites"); localStorage.removeItem("bp_hr_match_runs"); } catch (e) {}
          location.reload();
        });
      });
    }).catch(function () { dataError("st-root"); });
  }
  function pageHelp() {
    var FAQ = [
      ["كيف أنشر وظيفة؟", "من «الوظائف ← نشر وظيفة جديدة» اكتب المسمى فقط واضغط إنشاء — الذكاء يكتب الإعلان كاملاً وتنشر بضغطة. تقدر تعدّل أي فقرة بالضغط عليها مباشرة."],
      ["كيف أشوف المتقدمين وأحركهم بين المراحل؟", "من «المتقدمون» — اسحب البطاقة بين الأعمدة، أو بدّل لعرض الجدول وغيّر المرحلة من القائمة. الرفض والتوظيف يطلبان تأكيداً ويمكن التراجع."],
      ["كيف تعمل المطابقة الذكية؟", "من «المطابقة الذكية» اختر الوظيفة وشغّل المطابقة — كل مرشح يحصل على درجة موزونة مفصلة مع الشرح، وتقدر تعدّل الأوزان من إعدادات الأوزان."],
      ["ما الفرق بين اللوحة وبيانات الموقع؟", "اللوحة تعمل الآن على بيانات تجريبية للتصميم والتجربة، والنشر الفعلي للوظائف يتم على الموقع عند تسجيل الدخول برمز اشتراكك. الربط الكامل بقاعدة التشغيل ضمن خطة التنفيذ."],
      ["هل يرفض الذكاء الاصطناعي المرشحين؟", "لا. الذكاء يرتب ويشرح ويقترح فقط — قرارات الرفض والتوظيف والعروض تحتاج اعتماداً بشرياً دائماً."],
    ];
    $("hp-root").innerHTML =
      '<section class="hr-card"><div class="hd"><h2>الأسئلة الشائعة</h2></div><div class="bd">' +
      FAQ.map(function (f) { return '<details style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:600;color:var(--hr-navy)">' + f[0] + '</summary><p style="font-size:.88rem;color:var(--hr-soft);margin-top:6px">' + f[1] + "</p></details>"; }).join("") +
      '</div></section>' +
      '<section class="hr-card" style="margin-top:14px"><div class="hd"><h2>تواصل معنا</h2></div><div class="bd" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<a class="hr-btn hr-btn-primary" target="_blank" rel="noopener" href="https://wa.me/966507034157">واتساب فريق Business Partner</a>' +
      '<a class="hr-btn hr-btn-ghost" href="mailto:business@businesspartner.sa">business@businesspartner.sa</a>' +
      "</div></section>";
  }

  /* ---------- dispatch ---------- */
  if (PAGE === "dashboard") pageDashboard();
  else if (PAGE === "jobs") pageJobs();
  else if (PAGE === "job-new") pageJobNew();
  else if (PAGE === "job-view") pageJobView();
  else if (PAGE === "applicants") pageApplicants();
  else if (PAGE === "applicant") pageApplicant();
  else if (PAGE === "matching") pageMatching();
  else if (PAGE === "reports") pageReports();
  else if (PAGE === "integrations") pageIntegrations();
  else if (PAGE === "automations") pageAutomations();
  else if (PAGE === "onboarding") pageOnboarding();
  else if (PAGE === "talent") pageTalent();
  else if (PAGE === "interviews") pageInterviews();
  else if (PAGE === "messages") pageMessages();
  else if (PAGE === "offers") pageOffers();
  else if (PAGE === "billing") pageBilling();
  else if (PAGE === "team") pageTeam();
  else if (PAGE === "company") pageCompany();
  else if (PAGE === "settings") pageSettings();
  else if (PAGE === "help") pageHelp();
})();
