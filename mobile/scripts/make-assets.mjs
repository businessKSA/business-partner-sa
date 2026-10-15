// يولّد أيقونة التطبيق وشاشة الإقلاع من الشعار الرسمي (site/assets/img/logo.png).
// لا رمز مربّعاً رسمياً للعلامة، فالأيقونة مشتقّة من حرفيها: B الخفيفة + P العريضة.
// الاعتماد النهائي للأيقونة قرار المالك قبل رفعها إلى المتجرين.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const logo = path.join(root, "../../site/assets/img/logo.png");
const out = path.join(root, "../resources");
const NAVY = "#0B1B5A";
mkdirSync(out, { recursive: true });

// الشعار 2000×301: B في أقصى اليسار، وP أول حرف من PARTNER.
// حدود الحروف مقيسة من أعمدة الشفافية: B = 20..110، وP = 967..~1096. ذيل قدم A
// يتداخل مع أسفل P عند x≥1088 فيُمحى بقناع.
const crop = async (left, width, clear) => {
  let img = sharp(logo).extract({ left, top: 0, width, height: 170 });
  if (clear) {
    const buf = await img.png().toBuffer();
    const mask = await sharp({ create: { width: clear.w, height: clear.h, channels: 4, background: "#000" } }).png().toBuffer();
    img = sharp(buf).composite([{ input: mask, left: clear.x, top: clear.y, blend: "dest-out" }]);
  }
  return img.png().toBuffer();
};

async function monogram(size, scale) {
  const [b, p] = await Promise.all([crop(19, 93), crop(966, 132, { x: 112, y: 112, w: 20, h: 58 })]);
  const bm = await sharp(b).metadata();
  const pm = await sharp(p).metadata();
  const h = Math.round(size * scale);
  const bw = Math.round((bm.width / bm.height) * h);
  const pw = Math.round((pm.width / pm.height) * h);
  const gap = Math.round(h * 0.07);
  const total = bw + gap + pw;
  // تبييض: نُبقي قناة الشفافية ونجعل RGB أبيض.
  const tint = async (buf, w) => {
    const { data, info } = await sharp(buf).resize({ width: w, height: h, fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; }
    return sharp(data, { raw: info }).png().toBuffer();
  };
  const [bt, pt] = await Promise.all([tint(b, bw), tint(p, pw)]);
  const left = Math.round((size - total) / 2);
  const top = Math.round((size - h) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: bt, left, top }, { input: pt, left: left + bw + gap, top }])
    .png()
    .toBuffer();
}

const solid = (size) =>
  sharp({ create: { width: size, height: size, channels: 4, background: NAVY } }).png();

const run = async () => {
  // أيقونة كاملة (iOS تقتطع الزوايا بنفسها، فلا نُدوّرها)
  await solid(1024).composite([{ input: await monogram(1024, 0.34) }]).png().toFile(path.join(out, "icon-only.png"));
  // Android adaptive: الرمز داخل المنطقة الآمنة (٦٦٪ من الوسط)
  await sharp(await monogram(1024, 0.26)).png().toFile(path.join(out, "icon-foreground.png"));
  await solid(1024).toFile(path.join(out, "icon-background.png"));
  // شاشة الإقلاع: الرمز صغير في الوسط على كحلي
  for (const name of ["splash.png", "splash-dark.png"]) {
    await solid(2732).composite([{ input: await monogram(2732, 0.1) }]).png().toFile(path.join(out, name));
  }
  console.log("assets ✓ →", out);
};
run().catch((e) => { console.error(e); process.exit(1); });
