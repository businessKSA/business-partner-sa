/* Agents Command: particle sphere behind the core button. Isolated: any failure here leaves the panel untouched. */
(function () {
  try {
    var host = document.getElementById('orbit');
    if (!host) return;
    var cv = document.createElement('canvas');
    cv.id = 'hudSphere';
    host.insertBefore(cv, host.firstChild);
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var N = 460, P = [], i;
    for (i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      P.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ang = 0, t = 0, talk = 0, W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      var b = host.getBoundingClientRect();
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);
    var st = document.getElementById('uiState');
    if (st && window.MutationObserver) {
      new MutationObserver(function () {
        if (/يتكلم|أتكلم|يرد|يفكر|يجيب/.test(st.textContent || '')) talk = 120;
      }).observe(st, { childList: true, characterData: true, subtree: true });
    }
    function frame() {
      if (document.hidden) { requestAnimationFrame(frame); return; }
      if (!reduce) ang += 0.004;
      t += 0.03;
      var amp = 1 + (talk > 0 ? 0.06 * Math.sin(t * 6) : 0.015 * Math.sin(t));
      if (talk > 0) talk--;
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.26 * amp;
      var g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.3);
      g.addColorStop(0, 'rgba(120,200,255,.5)');
      g.addColorStop(0.4, 'rgba(30,110,200,.18)');
      g.addColorStop(1, 'rgba(5,9,18,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, 7); ctx.fill();
      var ca = Math.cos(ang), sa = Math.sin(ang);
      for (i = 0; i < N; i++) {
        var p = P[i], x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, d = (z + 1) / 2;
        var px = cx + x * R, py = cy + p[1] * R;
        ctx.strokeStyle = 'rgba(120,200,255,' + (0.04 + 0.16 * d) + ')';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = 'rgba(190,230,255,' + (0.2 + 0.7 * d) + ')';
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      requestAnimationFrame(frame);
    }
    frame();
  } catch (e) { /* skin only; never break the panel */ }
})();
