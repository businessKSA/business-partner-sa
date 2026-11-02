// تطبيق redirects من vercel.json محلياً — للخادم المحلي (devserver.mjs) وللاختبارات.
//
// يدعم ما يستعمله الملف فقط من صيغة path-to-regexp عند Vercel:
//   /literal   (a|b)   :name   :name(regex)   :name*
// ولا يدعم `has` (شروط المضيف/الترويسة): تلك القواعد لـ Vercel وحده.
// المعاملات (?ref=…&view=…) تمرّ إلى الوجهة كما يفعل Vercel (تحقّقنا على
// الموقع الحيّ: /blog?ref=A&view=B → /saudi-arabia?ref=A&view=B).
import fs from "node:fs";

function closeParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return i;
  }
  throw new Error("redirect source بقوسٍ غير مغلق: " + src);
}

export function compileSource(src) {
  let re = "";
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === ":") {
      const m = /^:([A-Za-z_]\w*)/.exec(src.slice(i));
      if (!m) { re += ":"; i++; continue; }
      i += m[0].length;
      if (src[i] === "(") { const j = closeParen(src, i); re += `(?<${m[1]}>${src.slice(i + 1, j)})`; i = j + 1; }
      else if (src[i] === "*") { re += `(?<${m[1]}>.*)`; i++; }
      else re += `(?<${m[1]}>[^/]+)`;
    } else if (c === "(") {
      const j = closeParen(src, i); re += `(?:${src.slice(i + 1, j)})`; i = j + 1;
    } else { re += c.replace(/[.*+?^${}|[\]\\]/g, "\\$&"); i++; }
  }
  return new RegExp(`^${re}/?$`, "i");
}

export function loadRedirects(file) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  return (cfg.redirects || [])
    .filter((r) => !r.has && !r.missing)
    .map((r) => ({ re: compileSource(r.source), source: r.source, destination: r.destination, status: r.statusCode || (r.permanent ? 308 : 307) }));
}

// يُرجع { status, location } للمسار والاستعلام، أو null إن لم تُطابق قاعدة.
export function matchRedirect(rules, pathname, search = "") {
  for (const r of rules) {
    const m = r.re.exec(pathname);
    if (!m) continue;
    const g = m.groups || {};
    let dest = r.destination.replace(/:([A-Za-z_]\w*)\*?/g, (all, n) => (n in g ? g[n] : all));
    // الاستعلام الأصلي يُلحق حرفياً بالوجهة (بلا إعادة ترميز).
    if (search && search !== "?") dest += (dest.includes("?") ? "&" : "?") + search.replace(/^\?/, "");
    return { status: r.status, location: dest, source: r.source };
  }
  return null;
}
