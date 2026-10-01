import { BRAND } from "./playbooks.mjs";

const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const SIZES = {
  instagram: { w: 1080, h: 1350, headline: 74, body: 30, pad: 84 },
  story:     { w: 1080, h: 1920, headline: 82, body: 33, pad: 92 },
  linkedin:  { w: 1200, h: 627,  headline: 52, body: 24, pad: 64 },
};

// Navy field, one gold rule, one restrained lattice motif. No stock photography —
// the identity is typographic so every one of the 95 services renders consistently
// without sourcing an image per service.
export function renderSocial(c, variant = "instagram") {
  const s = SIZES[variant] ?? SIZES.instagram;
  const steps = c.steps.slice(0, variant === "linkedin" ? 3 : 4);
  const stepFont = Math.round(s.body * 0.95);

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${s.w}px;height:${s.h}px;overflow:hidden;font-family:"Noto Sans Arabic",sans-serif}
  .canvas{position:relative;width:${s.w}px;height:${s.h}px;background:${BRAND.navy};
    padding:${s.pad}px;display:flex;flex-direction:column;overflow:hidden}
  .canvas::before{content:"";position:absolute;inset:0;
    background:radial-gradient(120% 90% at 12% 0%, ${BRAND.navyDeep} 0%, transparent 58%)}
  .motif{position:absolute;width:${Math.round(s.w*0.62)}px;height:${Math.round(s.w*0.62)}px;
    inset-inline-start:${-Math.round(s.w*0.14)}px;bottom:${-Math.round(s.w*0.22)}px;opacity:.10;
    background:repeating-linear-gradient(45deg, ${BRAND.goldSoft} 0 3px, transparent 3px 46px),
               repeating-linear-gradient(-45deg, ${BRAND.goldSoft} 0 3px, transparent 3px 46px)}
  .layer{position:relative;display:flex;flex-direction:column;height:100%}
  .top{display:flex;align-items:center;gap:${Math.round(s.pad*0.16)}px}
  .mark{width:${Math.round(s.body*0.55)}px;height:${Math.round(s.body*0.55)}px;border-radius:4px;background:${BRAND.gold}}
  .wm{font-family:"DejaVu Sans",sans-serif;font-size:${Math.round(s.body*0.68)}px;font-weight:700;
    letter-spacing:${Math.round(s.body*0.16)}px;color:${BRAND.goldSoft};white-space:nowrap}
  .cat{margin-inline-start:auto;font-size:${Math.round(s.body*0.72)}px;color:#aab4d8}
  .mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:${Math.round(s.pad*0.3)}px}
  .rule{width:${Math.round(s.headline*1.1)}px;height:${Math.round(s.headline*0.07)}px;
    background:${BRAND.gold};border-radius:3px;margin-bottom:${Math.round(s.pad*0.42)}px}
  h1{font-family:"Noto Kufi Arabic",sans-serif;font-size:${s.headline}px;line-height:1.5;
    font-weight:700;color:#fff}
  .svc{margin-top:${Math.round(s.pad*0.42)}px;font-size:${Math.round(s.body*1.12)}px;
    font-weight:700;color:${BRAND.goldSoft};line-height:1.6}
  ul{margin-top:${Math.round(s.pad*0.36)}px;list-style:none;display:flex;flex-direction:column;
    gap:${Math.round(s.pad*0.16)}px}
  li{display:flex;align-items:flex-start;gap:${Math.round(s.body*0.5)}px;
    font-size:${stepFont}px;line-height:1.65;color:#d5dcf2}
  li .v{color:${BRAND.gold};font-weight:800}
  .bot{display:flex;align-items:center;gap:${Math.round(s.pad*0.22)}px}
  .pill{background:${BRAND.gold};color:#221a00;font-weight:700;border-radius:999px;
    padding:${Math.round(s.body*0.62)}px ${Math.round(s.body*1.35)}px;font-size:${Math.round(s.body*0.92)}px;white-space:nowrap}
  .phone{font-family:"DejaVu Sans",sans-serif;font-size:${Math.round(s.body*0.88)}px;color:#aab4d8;direction:ltr}
</style></head><body>
<div class="canvas"><div class="motif"></div><div class="layer">
  <div class="top"><span class="mark"></span><span class="wm">BUSINESS PARTNER</span><span class="cat">${esc(c.category)}</span></div>
  <div class="mid">
    <div class="rule"></div>
    <h1>${esc(c.headline)}</h1>
    <div class="svc">${esc(c.title)}</div>
    <ul>${steps.map((x)=>`<li><span class="v">✓</span><span>${esc(x)}</span></li>`).join("")}</ul>
  </div>
  <div class="bot"><span class="pill">${esc(c.priceTag || "اطلب عرض سعر")}</span><span class="phone">${BRAND.phone} · businesspartner.sa</span></div>
</div></div>
</body></html>`;
}
