#!/usr/bin/env node
// Build a marketing content pack per service.
//
//   node build.mjs                  # all 95 services
//   node build.mjs BP-CHAMBER-01 …  # only these codes
//   node build.mjs --sample         # one representative service per category
//   node build.mjs --no-images      # copy only, skip PNG rendering
//
// Each pack: email.html · posts.json · social PNGs (instagram / story / linkedin).
import fs from "node:fs";
import path from "node:path";
import { buildCopy } from "./copy.mjs";
import { renderEmail } from "./email-template.mjs";
import { renderSocial } from "./social-template.mjs";
import { renderAll } from "./render.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/marketing-agent/content-packs");
const services = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/services.json"), "utf8"));

const args = process.argv.slice(2);
const noImages = args.includes("--no-images");
const codes = args.filter((a) => !a.startsWith("--"));

let picked;
if (args.includes("--sample")) {
  const seen = new Set();
  picked = services.filter((s) => {
    const c = s.categoryAr ?? s.category;
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
} else if (codes.length) {
  picked = services.filter((s) => codes.includes(s.code));
} else {
  picked = services;
}

if (!picked.length) {
  console.error("no services matched:", codes.join(", ") || "(all)");
  process.exit(1);
}

const jobs = [];
const index = [];

for (const service of picked) {
  const c = buildCopy(service);
  const dir = path.join(OUT, service.slug);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, "email.html"), renderEmail(c));
  fs.writeFileSync(path.join(dir, "posts.json"), JSON.stringify({
    code: c.code, slug: c.slug, title: c.title, category: c.category,
    subject: c.email.subject, preheader: c.email.preheader,
    whatsapp: c.whatsapp, linkedin: c.linkedin, instagram: c.instagram,
    tiktok: c.tiktok, x: c.x, url: c.url, landingUrl: c.landingUrl, whatsappLink: c.whatsappLink,
    links: c.links, whatsappLinks: c.whatsappLinks,
  }, null, 2));

  for (const [variant, w, h] of [["instagram",1080,1350],["story",1080,1920],["linkedin",1200,627]]) {
    jobs.push({ html: renderSocial(c, variant), out: path.join(dir, `${variant}.png`), width: w, height: h });
  }
  index.push({ code: c.code, slug: c.slug, title: c.title, category: c.category, price: c.price });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));

if (!noImages) await renderAll(jobs);

console.log(`packs: ${picked.length}  →  ${path.relative(ROOT, OUT)}/`);
console.log(`images: ${noImages ? "skipped" : jobs.length}`);
