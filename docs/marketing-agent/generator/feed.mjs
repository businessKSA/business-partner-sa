#!/usr/bin/env node
// Publish the marketing content feed the n8n weekly planner reads.
//
//   node feed.mjs            # writes site/data/marketing-content.json
//
// Why a published file instead of building the copy inside n8n: the copy rules
// (Arabic naming, pricing caveats, the deliverables-vs-process distinction that
// stops a service promising another service's outputs) live here, in the repo,
// under review. Duplicating them into a Code node would put marketing claims in
// a place nobody reads diffs on. n8n stays thin: fetch, slice the week, write
// Notion rows.
import fs from "node:fs";
import path from "node:path";
import { buildCopy, hashtags, priceLine, priceShort, landingUrl, trackedUrl } from "./copy.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const services = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/services.json"), "utf8"));

// ── The week ────────────────────────────────────────────────────────────────
// The Saudi work week runs Sunday–Thursday, so day 0 is Sunday and nothing is
// scheduled on Friday or Saturday. Times are Riyadh local (UTC+3, no DST).
const SERVICES_PER_WEEK = 5;
const WEEK_EPOCH_SUNDAY = "2026-01-04"; // any Sunday; fixes the rotation phase

// One featured service per weekday. These four run for every featured service:
// LinkedIn and X carry the argument, WhatsApp and Instagram carry the offer.
const BASE_SLOTS = [
  { platform: "LinkedIn",         channel: "linkedin",  time: "09:00", pillar: "Educational" },
  { platform: "WhatsApp Channel", channel: "whatsapp",  time: "11:00", pillar: "Product & Offer" },
  { platform: "X",                channel: "x",         time: "13:30", pillar: "Educational" },
  { platform: "Instagram",        channel: "instagram", time: "20:00", pillar: "Product & Offer" },
];

// The heavy formats rotate instead of running daily — a video brief every day is
// a queue nobody clears, and the calendar stops being believable.
const EXTRA_BY_DAY = {
  0: { platform: "Facebook", channel: "facebook", time: "19:00", pillar: "Product & Offer" },
  1: { platform: "TikTok",   channel: "tiktok",   time: "21:00", pillar: "Educational" },
  2: { platform: "Snapchat", channel: "snapchat", time: "20:30", pillar: "Product & Offer" },
  3: { platform: "TikTok",   channel: "tiktok",   time: "21:00", pillar: "Proof & Trust" },
  4: { platform: "Facebook", channel: "facebook", time: "19:00", pillar: "Educational" },
};

// One post a week that is not about a single service: the five of the week, so a
// follower who missed a day still sees the range.
const DIGEST = {
  dayOffset: 4,
  platform: "Telegram Channel",
  channel: "telegram",
  time: "12:00",
  pillar: "Product & Offer",
  title: "ملخص الأسبوع",
  url: "https://businesspartner.sa/ar/services?utm_source=telegram&utm_medium=messaging&utm_campaign=weekly-digest",
};

const grid = [];
for (let day = 0; day < SERVICES_PER_WEEK; day++) {
  for (const slot of BASE_SLOTS) grid.push({ dayOffset: day, serviceIndex: day, ...slot });
  grid.push({ dayOffset: day, serviceIndex: day, ...EXTRA_BY_DAY[day] });
}

// ── The rotation ────────────────────────────────────────────────────────────
// Round-robin across categories so a single week never reads as five variations
// of the same service. 95 services at 5 a week is a 19-week cycle.
function interleaveByCategory(list) {
  const buckets = new Map();
  for (const s of list) {
    const k = s.categoryAr ?? s.category;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s);
  }
  const queues = [...buckets.values()];
  const out = [];
  while (out.length < list.length) {
    for (const q of queues) if (q.length) out.push(q.shift());
  }
  return out;
}

const rotation = interleaveByCategory(services).map((s) => s.code);

const catalogue = {};
for (const service of services) {
  const c = buildCopy(service);
  catalogue[service.code] = {
    slug: c.slug,
    title: c.title,
    category: c.category,
    price: priceLine(service),
    priceTag: priceShort(service),
    landingUrl: landingUrl(service),
    whatsappLink: c.whatsappLink,
    hashtags: hashtags(service).join(" "),
    designBrief: c.designBrief,
    pack: `docs/marketing-agent/content-packs/${c.slug}/`,
    // One tracked link per channel, including the three the pack builder does not
    // emit, so every calendar row carries a link that names the channel it came
    // from. An untagged link makes a channel invisible rather than ineffective.
    links: {
      linkedin: trackedUrl(service, "linkedin"),
      instagram: trackedUrl(service, "instagram"),
      whatsapp: trackedUrl(service, "whatsapp"),
      telegram: trackedUrl(service, "telegram"),
      facebook: trackedUrl(service, "facebook"),
      snapchat: trackedUrl(service, "snapchat"),
      tiktok: trackedUrl(service, "tiktok"),
      x: trackedUrl(service, "x"),
      email: trackedUrl(service, "email"),
    },
    copy: {
      linkedin: c.linkedin,
      instagram: c.instagram,
      whatsapp: c.whatsapp,
      telegram: c.telegram,
      facebook: c.facebook,
      x: c.x,
      snapchat: c.snapchat.caption,
      tiktok: [c.tiktok.hook, "", c.tiktok.body, "", c.tiktok.cta].join("\n"),
    },
    tiktok: c.tiktok,
    snapchatSwipeUrl: c.snapchat.swipeUrl,
    email: { subject: c.email.subject, preheader: c.email.preheader },
  };
}

const feed = {
  version: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  timezone: "Asia/Riyadh",
  utcOffset: "+03:00",
  servicesPerWeek: SERVICES_PER_WEEK,
  weekEpochSunday: WEEK_EPOCH_SUNDAY,
  cycleWeeks: Math.ceil(rotation.length / SERVICES_PER_WEEK),
  grid,
  digest: DIGEST,
  rotation,
  services: catalogue,
};

const out = path.join(ROOT, "site/data/marketing-content.json");
fs.writeFileSync(out, JSON.stringify(feed, null, 1));
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`services: ${rotation.length}  slots/week: ${grid.length + 1}  cycle: ${feed.cycleWeeks} weeks`);
console.log(`wrote site/data/marketing-content.json (${kb} KB)`);
