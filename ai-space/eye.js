/* BP AI Command Space — التحكم بالعين
 *
 * العين تحرّك المؤشّر وتختار بالتثبيت (dwell)، والصوت ينفّذ ويكتب.
 *
 * لماذا MediaPipe محليّاً ولا خدمة تتبّع مدفوعة: قاعدة CLAUDE.md §2.6 تمنع أي
 * استدعاء مدفوع خارج Azure، وتتبّع العين هنا يعمل كله داخل المتصفّح — لا صورة
 * تغادر جهاز المالك، ولا تكلفة، ولا مفتاح. وهذا أيضاً شرط خصوصية لا رفاهية:
 * كاميرا المالك مفتوحة طوال الجلسة، فبقاء الإطارات في الجهاز هو الضمان الوحيد.
 *
 * التقدير يعتمد على القزحية لا على الوجه: مركز القزحية منسوباً إلى زاويتَي
 * العين يعطي اتجاه النظر حتى لو تحرّك الرأس قليلاً. ثم معايرة بخمس نقاط تحوّل
 * ذلك الاتجاه إلى إحداثيات شاشة — بلا معايرة تكون القراءة اتجاهاً لا موضعاً.
 */
(function () {
  'use strict';

  var EYE_BUILD = 'eye-1';

  // ————— إعدادات قابلة للضبط من config.js —————
  var CFG = (window.BP_EYE_CONFIG || {});
  var DWELL_MS = CFG.dwellMs || 900;       // كم يثبت النظر قبل الاختيار
  var SMOOTH = CFG.smooth || 0.25;          // 0 = بلا تنعيم، 1 = متجمّد
  var MODEL_URL = CFG.modelUrl ||
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  var LANDMARKER_URL = CFG.landmarkerUrl ||
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  // نقاط MediaPipe: مركز القزحية وزاويتا كل عين.
  var L_IRIS = 468, R_IRIS = 473;
  var L_OUT = 33, L_IN = 133, R_IN = 362, R_OUT = 263;
  var L_TOP = 159, L_BOT = 145, R_TOP = 386, R_BOT = 374;

  var state = {
    on: false,
    ready: false,
    calibrated: false,
    loading: false,
    stream: null,
    video: null,
    landmarker: null,
    raf: null,
    // نقطة النظر الحالية بعد التنعيم
    x: 0, y: 0,
    // التثبيت
    target: null,
    since: 0,
    lastBlink: 0,
    // معايرة: نقاط (gazeX,gazeY) ← (screenX,screenY)
    cal: null
  };

  var dom = {};

  function log(msg) {
    if (window.BP_EYE_DEBUG) console.log('[eye]', msg);
  }

  /* يُبلّغ اللوحة. تُعرَّف من app.js إن وُجدت، وإلا تُطبع فقط —
     حتى لا يسقط التحكم بالعين لو تغيّر app.js. */
  function say(text, tone) {
    if (typeof window.BP_EYE_NOTE === 'function') {
      try { window.BP_EYE_NOTE(text, tone); return; } catch (e) {}
    }
    log(text);
  }

  // ——————————————————————————— الواجهة ———————————————————————————

  function buildUI() {
    if (dom.dot) return;

    var dot = document.createElement('div');
    dot.id = 'eyeDot';
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = '<svg viewBox="0 0 48 48"><circle class="ring-bg" cx="24" cy="24" r="20"/>' +
      '<circle class="ring-fg" cx="24" cy="24" r="20"/></svg><i></i>';
    document.body.appendChild(dot);
    dom.dot = dot;
    dom.ring = dot.querySelector('.ring-fg');

    var cal = document.createElement('div');
    cal.id = 'eyeCal';
    cal.hidden = true;
    cal.innerHTML = '<div class="eye-cal-msg"><b>معايرة العين</b>' +
      '<span id="eyeCalStep">انظر إلى النقطة وثبّت</span></div>' +
      '<button type="button" class="eye-cal-x" id="eyeCalCancel">إلغاء</button>' +
      '<div class="eye-cal-pt" id="eyeCalPt"></div>';
    document.body.appendChild(cal);
    dom.cal = cal;
    dom.calPt = cal.querySelector('#eyeCalPt');
    dom.calStep = cal.querySelector('#eyeCalStep');
    cal.querySelector('#eyeCalCancel').addEventListener('click', cancelCalibration);

    var v = document.createElement('video');
    v.id = 'eyeVideo';
    v.setAttribute('playsinline', '');
    v.muted = true;
    v.hidden = true;
    document.body.appendChild(v);
    state.video = v;
  }

  function showDot(on) {
    if (dom.dot) dom.dot.classList.toggle('live', !!on);
  }

  function ringProgress(p) {
    if (!dom.ring) return;
    var c = 2 * Math.PI * 20;
    dom.ring.style.strokeDasharray = c;
    dom.ring.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, p)));
  }

  // ————————————————————— تحميل المحرّك —————————————————————

  /* مصدران للمحرّك لا مصدر واحد: تعطّل شبكة CDN واحدة كان يُسقط التحكم
     بالعين كلّه، وهو اعتماد خارجي لا سلطة لنا عليه. نجرّب بالترتيب. */
  var BUNDLES = CFG.bundles || [
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  ];

  function importFirst(urls, i) {
    i = i || 0;
    if (i >= urls.length) {
      return Promise.reject(new Error('تعذّر تحميل محرّك التتبّع من أي مصدر'));
    }
    return import(/* webpackIgnore: true */ urls[i]).catch(function (e) {
      log('bundle failed: ' + urls[i]);
      return importFirst(urls, i + 1);
    });
  }

  function loadVision() {
    if (state.landmarker) return Promise.resolve(state.landmarker);
    if (state.loading) return state.loading;

    state.loading = importFirst(BUNDLES).then(function (vision) {
      return vision.FilesetResolver.forVisionTasks(MODEL_URL).then(function (files) {
        return vision.FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: LANDMARKER_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          // القزحية لا تأتي إلا بهذا — وبدونها لا تتبّع نظر أصلاً، فقط وجه.
          outputFacialTransformationMatrixes: false
        });
      });
    }).then(function (lm) {
      state.landmarker = lm;
      state.loading = null;
      return lm;
    }).catch(function (err) {
      state.loading = null;
      throw err;
    });

    return state.loading;
  }

  function openCamera() {
    if (state.stream) return Promise.resolve(state.stream);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('المتصفّح لا يتيح الكاميرا'));
    }
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    }).then(function (s) {
      state.stream = s;
      state.video.srcObject = s;
      return state.video.play().then(function () { return s; });
    });
  }

  // ————————————————————— استخراج اتجاه النظر —————————————————————

  /* يُرجع {gx, gy, open} حيث gx,gy اتجاه النظر المطبّع تقريباً في [-1,1].
     المرجع زاويتا العين لا الشاشة، فحركة الرأس الصغيرة لا تُفسد القراءة. */
  function gazeFrom(pts) {
    function ratio(iris, inner, outer, top, bot) {
      var i = pts[iris], a = pts[inner], b = pts[outer];
      var t = pts[top], d = pts[bot];
      if (!i || !a || !b || !t || !d) return null;

      var w = b.x - a.x;
      var h = d.y - t.y;
      if (Math.abs(w) < 1e-6 || Math.abs(h) < 1e-6) return null;

      // موضع القزحية داخل العين: 0.5 = مركز
      var hx = (i.x - a.x) / w;
      var hy = (i.y - t.y) / h;
      // فتحة العين نسبةً إلى عرضها — تكشف الإغماضة بلا نموذج إضافي
      var open = Math.abs(h) / Math.abs(w);
      return { hx: hx, hy: hy, open: open };
    }

    var L = ratio(L_IRIS, L_OUT, L_IN, L_TOP, L_BOT);
    var R = ratio(R_IRIS, R_IN, R_OUT, R_TOP, R_BOT);
    if (!L && !R) return null;

    var hx, hy, open;
    if (L && R) { hx = (L.hx + R.hx) / 2; hy = (L.hy + R.hy) / 2; open = (L.open + R.open) / 2; }
    else { var o = L || R; hx = o.hx; hy = o.hy; open = o.open; }

    // مركز العين عند 0.5 → صفر، والمدى الفعلي للقزحية ضيّق فيُوسَّع
    return { gx: (hx - 0.5) * 2, gy: (hy - 0.5) * 2, open: open };
  }

  /* المعايرة تحوّل الاتجاه إلى موضع. انحدار خطّي بسيط على كل محور:
     screen = a*gaze + b. خمس نقاط تكفي لأن العلاقة خطّية تقريباً في
     المدى الذي تغطيه شاشة واحدة؛ والنقطة الوسطى تمنع ميل الحواف. */
  function fit(samples, key, dim) {
    var n = samples.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) {
      var g = samples[i].g[key], s = samples[i].s[dim];
      sx += g; sy += s; sxx += g * g; sxy += g * s;
    }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return { a: 0, b: sy / n };
    var a = (n * sxy - sx * sy) / den;
    var b = (sy - a * sx) / n;
    return { a: a, b: b };
  }

  function project(g) {
    if (!state.cal) return null;
    return {
      x: state.cal.x.a * g.gx + state.cal.x.b,
      y: state.cal.y.a * g.gy + state.cal.y.b
    };
  }

  // ————————————————————— المعايرة —————————————————————

  var CAL_POINTS = [
    [0.5, 0.5], [0.08, 0.10], [0.92, 0.10], [0.08, 0.90], [0.92, 0.90]
  ];
  var calRun = null;

  function cancelCalibration() {
    if (calRun) { calRun.cancelled = true; calRun = null; }
    dom.cal.hidden = true;
    say('أُلغيت المعايرة', 'eye');
  }

  function calibrate() {
    if (!state.ready) return Promise.reject(new Error('المحرّك غير جاهز'));
    dom.cal.hidden = false;
    var run = { cancelled: false, samples: [] };
    calRun = run;

    var i = 0;
    function step() {
      if (run.cancelled) return Promise.reject(new Error('cancelled'));
      if (i >= CAL_POINTS.length) return Promise.resolve();

      var p = CAL_POINTS[i];
      var sx = p[0] * window.innerWidth;
      var sy = p[1] * window.innerHeight;
      dom.calPt.style.left = sx + 'px';
      dom.calPt.style.top = sy + 'px';
      dom.calStep.textContent = 'ثبّت نظرك على النقطة — ' + (i + 1) + ' من ' + CAL_POINTS.length;
      dom.calPt.classList.remove('hold');

      // مهلة قصيرة لينتقل النظر، ثم جمع عيّنات لمتوسّط ثابت
      return wait(700).then(function () {
        if (run.cancelled) throw new Error('cancelled');
        dom.calPt.classList.add('hold');
        return collect(run, 700);
      }).then(function (avg) {
        if (!avg) throw new Error('لم أستطع رؤية عينيك بوضوح');
        run.samples.push({ g: avg, s: { x: sx, y: sy } });
        i++;
        return step();
      });
    }

    return step().then(function () {
      calRun = null;
      dom.cal.hidden = true;
      state.cal = {
        x: fit(run.samples, 'gx', 'x'),
        y: fit(run.samples, 'gy', 'y')
      };
      state.calibrated = true;
      persistCal();
      say('العين معايَرة — انظر وثبّت لتختار', 'eye');
    }).catch(function (err) {
      calRun = null;
      dom.cal.hidden = true;
      if (String(err && err.message) !== 'cancelled') {
        say('تعذّرت المعايرة: ' + (err && err.message ? err.message : err), 'eye');
      }
      throw err;
    });
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* يجمع قراءات النظر خلال مدة ويعيد متوسّطها. القراءة الواحدة صاخبة،
     والمتوسّط على ~0.7 ثانية يثبّتها بما يكفي لنقطة معايرة. */
  function collect(run, ms) {
    return new Promise(function (resolve) {
      var acc = [], t0 = performance.now();
      function tick() {
        if (run && run.cancelled) return resolve(null);
        if (state.lastGaze) acc.push(state.lastGaze);
        if (performance.now() - t0 < ms) return requestAnimationFrame(tick);
        if (!acc.length) return resolve(null);
        var gx = 0, gy = 0;
        for (var i = 0; i < acc.length; i++) { gx += acc[i].gx; gy += acc[i].gy; }
        resolve({ gx: gx / acc.length, gy: gy / acc.length });
      }
      tick();
    });
  }

  function persistCal() {
    try {
      localStorage.setItem('bp_eye_cal', JSON.stringify(state.cal));
    } catch (e) { /* وضع خاص أو تخزين محجوب — المعايرة تبقى للجلسة فقط */ }
  }

  function restoreCal() {
    try {
      var raw = localStorage.getItem('bp_eye_cal');
      if (!raw) return false;
      var c = JSON.parse(raw);
      if (!c || !c.x || !c.y || typeof c.x.a !== 'number') return false;
      state.cal = c;
      state.calibrated = true;
      return true;
    } catch (e) { return false; }
  }

  // ————————————————————— التثبيت والاختيار —————————————————————

  /* ما الذي يصلح هدفاً للعين: كل ما هو قابل للنقر فعلاً. لا نخترع سِمة
     خاصة لأن اللوحة مبنية بأزرار حقيقية — والعين يجب أن تصل لكل ما يصل
     إليه الفأر، وإلا صارت نصف واجهة. */
  var SEL = 'button, [role="button"], a[href], input, textarea, select, .orb, .row[data-id]';

  function hitTarget(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return null;
    var t = el.closest(SEL);
    if (!t) return null;
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return null;
    if (t.closest('#eyeCal')) return null;   // عناصر المعايرة ليست أهدافاً
    return t;
  }

  function fire(el) {
    // حقول الكتابة تُركَّز لا تُنقَر، ليبدأ الإملاء الصوتي فيها
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || tag === 'select') {
      el.focus();
      say('المؤشّر في الحقل — تكلّم ليُكتب', 'eye');
      return;
    }
    el.focus({ preventScroll: true });
    el.click();
  }

  function clearDwell() {
    if (state.target) state.target.classList.remove('eye-hover');
    state.target = null;
    state.since = 0;
    ringProgress(0);
  }

  // ————————————————————— الحلقة —————————————————————

  function loop() {
    if (!state.on) return;
    state.raf = requestAnimationFrame(loop);

    var v = state.video;
    if (!v || v.readyState < 2 || !state.landmarker) return;

    var now = performance.now();
    var res;
    try { res = state.landmarker.detectForVideo(v, now); }
    catch (e) { return; }

    var faces = res && res.faceLandmarks;
    if (!faces || !faces.length) {
      // لا وجه: أخفِ المؤشّر بدل تجميده في آخر مكان — التجميد يوهم أنه يعمل
      showDot(false);
      clearDwell();
      return;
    }

    var g = gazeFrom(faces[0]);
    if (!g) return;
    state.lastGaze = g;

    if (!state.calibrated) return;   // نقرأ الاتجاه لكن لا نحرّك بلا معايرة

    var p = project(g);
    if (!p) return;

    // تنعيم أُسّي: يمنع الرعشة بلا تأخير محسوس
    state.x = state.x ? state.x + (p.x - state.x) * (1 - SMOOTH) : p.x;
    state.y = state.y ? state.y + (p.y - state.y) * (1 - SMOOTH) : p.y;

    var x = Math.max(2, Math.min(window.innerWidth - 2, state.x));
    var y = Math.max(2, Math.min(window.innerHeight - 2, state.y));

    showDot(true);
    dom.dot.style.transform = 'translate(' + (x - 24) + 'px,' + (y - 24) + 'px)';

    var t = hitTarget(x, y);
    if (t !== state.target) {
      clearDwell();
      if (t) { state.target = t; state.since = now; t.classList.add('eye-hover'); }
      return;
    }

    if (!t) return;

    var held = now - state.since;
    ringProgress(held / DWELL_MS);
    if (held >= DWELL_MS) {
      var el = state.target;
      clearDwell();
      state.since = now + 400;   // فترة صمت تمنع نقرتين متتاليتين
      fire(el);
    }
  }

  // ————————————————————— التشغيل والإيقاف —————————————————————

  function start() {
    if (state.on) return Promise.resolve();
    buildUI();
    say('أشغّل العين…', 'eye');

    return openCamera()
      .then(loadVision)
      .then(function () {
        state.ready = true;
        state.on = true;
        restoreCal();
        loop();
        if (!state.calibrated) {
          say('العين تعمل — تحتاج معايرة مرة واحدة', 'eye');
          return calibrate().catch(function () {});
        }
        say('العين تعمل', 'eye');
      })
      .catch(function (err) {
        state.on = false;
        var m = String(err && err.message || err);
        if (/denied|NotAllowed/i.test(m)) say('رفضتَ إذن الكاميرا — العين لا تعمل بدونه', 'eye');
        else if (/camera|NotFound/i.test(m)) say('لا أجد كاميرا', 'eye');
        else say('تعذّر تشغيل العين: ' + m, 'eye');
        throw err;
      });
  }

  function stop() {
    state.on = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    clearDwell();
    showDot(false);
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
      if (state.video) state.video.srcObject = null;
    }
    say('أوقفتُ العين — الكاميرا مُطفأة', 'eye');
  }

  function toggle() {
    return state.on ? (stop(), Promise.resolve(false)) : start().then(function () { return true; });
  }

  // ————————————————————— أوامر صوتية —————————————————————

  /* يُستدعى من app.js عند كل نصّ مسموع. يعيد true إن ابتلع الأمر،
     فلا يُرسل إلى المدراء كسؤال. */
  function voiceCommand(text) {
    var t = String(text || '').trim();
    if (!t) return false;

    if (/^(شغّل|شغل|افتح)\s*(العين|عيني)/.test(t)) { start().catch(function(){}); return true; }
    if (/^(أوقف|اوقف|أطفئ|اطفئ|سكّر|سكر)\s*(العين|عيني|الكاميرا)/.test(t)) { stop(); return true; }
    if (/^(عاير|معايرة|عايري)\s*(العين|عيني)?/.test(t)) {
      if (!state.on) { say('العين مُطفأة — قل «شغّل العين» أولاً', 'eye'); return true; }
      calibrate().catch(function () {});
      return true;
    }
    if (/^(اختر|اضغط|انقر)$/.test(t)) {
      if (state.target) { var el = state.target; clearDwell(); fire(el); }
      else say('لا شيء تحت نظرك', 'eye');
      return true;
    }
    return false;
  }

  // ————————————————————— الواجهة العامة —————————————————————

  window.BPEye = {
    build: EYE_BUILD,
    start: start,
    stop: stop,
    toggle: toggle,
    calibrate: calibrate,
    command: voiceCommand,
    isOn: function () { return state.on; },
    isCalibrated: function () { return state.calibrated; },
    diag: function () {
      return {
        build: EYE_BUILD,
        on: state.on,
        ready: state.ready,
        calibrated: state.calibrated,
        camera: !!state.stream,
        secure: window.isSecureContext,
        target: state.target ? (state.target.id || state.target.className) : null
      };
    }
  };

  // زر التشغيل في شريط المايك، إن وُجد
  document.addEventListener('DOMContentLoaded', function () {
    var strip = document.querySelector('.mic-strip');
    if (!strip || document.getElementById('btnEye')) return;
    var b = document.createElement('button');
    b.id = 'btnEye';
    b.type = 'button';
    b.className = 'chip off';
    b.textContent = '👁️ العين';
    b.title = 'تحكّم بالنظر — يحتاج كاميرا ومعايرة مرة واحدة';
    b.addEventListener('click', function () {
      toggle().then(function (on) {
        b.classList.toggle('off', !on);
      }).catch(function () { b.classList.add('off'); });
    });
    strip.appendChild(b);
  });
})();
