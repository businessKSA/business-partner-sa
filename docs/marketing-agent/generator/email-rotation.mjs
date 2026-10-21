#!/usr/bin/env node
// The year-round email rotation — four tracks, one every two weeks, per company.
//
//   node email-rotation.mjs      # → site/data/email-rotation.json
//
// Owner decision (2026-10-20): every company in the sales database receives the
// core services, then two weeks later what we have newly added, then the news,
// then the platform updates — and the cycle repeats for as long as they stay
// subscribed. A company that has never been written to starts at step 0, so the
// companies already emailed and the ones never emailed converge on the same
// wheel instead of needing two separate campaigns.
//
// Why a step counter per company and not one global campaign calendar: the
// database is filled continuously (Apollo, Google Places, referrals), so at any
// given day some rows are at step 0 and some at step 11. A global calendar would
// send a brand-new company the news issue as its first contact, which explains
// nothing about who we are. The counter makes each company's first letter its
// own introduction, whatever the date.
//
// n8n stays thin, exactly as with feed.mjs: it reads this file, does the step
// arithmetic, and writes Notion. The content rules live here, under review.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const services = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/services.json"), "utf8"));
const byCode = Object.fromEntries(services.map((s) => [s.code, s]));

// ── The interval ────────────────────────────────────────────────────────────
// Fourteen days between letters to the same address. Twenty-six letters a year,
// six and a half full turns of the wheel. The sender's own daily cap is a
// separate limit and the stricter of the two wins on any given morning.
export const INTERVAL_DAYS = 14;

// ── The four tracks ─────────────────────────────────────────────────────────
// `sourceOfTruth` is the thing that may not be invented: a track whose source is
// empty on the day it is due is skipped and the company keeps its step, rather
// than going out with filler. A newsletter that arrives empty costs more trust
// than one that arrives late.
export const TRACKS = [
  {
    step: 0,
    key: "core",
    nameAr: "الخدمات الأساسية",
    subjectAr: "ما الذي نديره عنك — Business Partner",
    intentAr: "التعريف: من نحن وما الذي نتولّاه نيابةً عن منشأتك.",
    sourceOfTruth: "site/data/services.json",
    // The audience is an existing Saudi company, not a founder: company
    // formation is behind them, which is why the homepage's own doors are the
    // wrong five things to put in front of this list. These are the five the
    // owner named for exactly this audience (2026-10-20), each one standing for
    // a pillar rather than a single transaction — a company reads "من يمسك
    // ملفي الحكومي" and not "رخصة بلدية".
    pillars: [
      { nameAr: "الخدمات الحكومية", code: "GR-GEN" },
      { nameAr: "التحوّل الرقمي بالذكاء الاصطناعي", code: "AI-GEN" },
      { nameAr: "التوظيف والتعاقد الخارجي (EOR)", code: "BP-REC-03" },
      { nameAr: "Business Partner AI", code: "BP-AI-01" },
      { nameAr: "تطوير الأعمال", code: "REV-GROWTH" },
    ],
    serviceCodes: ["GR-GEN", "AI-GEN", "BP-REC-03", "BP-AI-01", "REV-GROWTH"],
    always: true,
  },
  {
    step: 1,
    key: "new",
    nameAr: "الجديد لدينا",
    subjectAr: "أضفنا هذا الشهر — Business Partner",
    intentAr: "ما أضفناه حديثاً، وفي صدارته Business Partner AI.",
    sourceOfTruth: "docs/marketing-agent/generator/email-rotation.mjs (NEW_SERVICES)",
    // Curated, never computed: services.json carries no «added on» field, and a
    // service is new because the owner decided to lead with it, not because a
    // row moved. Business Partner AI leads by owner decision (2026-10-20).
    serviceCodes: ["BP-AI-01", "BP-AI-SMART-EMPLOYEE", "BP-AI-03", "AI-GEN"],
    leadCode: "BP-AI-01",
    always: true,
  },
  {
    step: 2,
    key: "news",
    nameAr: "أخبار Business Partner",
    subjectAr: "ما الذي جرى — نشرة Business Partner",
    intentAr: "أخبار الشركة والسوق كما ترصدها المنظومة.",
    // Owner decision (2026-10-20): «تبع الاخبار والتحديثات تابع لك في المنظومه»
    // — the items come from the intelligence centre, not from this file and not
    // from the model's memory. No items on the due day means no letter.
    sourceOfTruth: "docs/marketing-agent/briefs/news/<issue>.json",
    serviceCodes: [],
    always: false,
  },
  {
    step: 3,
    key: "platform",
    nameAr: "تحديثات المنصات",
    subjectAr: "تحديثات المنصات الحكومية — Business Partner",
    intentAr: "ما تغيّر في قوى ومقيم والتأمينات وبقية المنصات، وما الذي يلزم فعله.",
    // The existing weekly regulatory brief. Its own editorial rule already
    // forbids an item without a source link and without an exclusive angle,
    // which is the rule that matters most in a letter that names deadlines.
    sourceOfTruth: "docs/marketing-agent/briefs/<issue>.json",
    serviceCodes: [],
    always: false,
  },
];

export const CYCLE = TRACKS.length;

// ── The wheel ───────────────────────────────────────────────────────────────
// A company's step is a plain counter that only ever goes up; the track is the
// counter modulo four. Storing the counter rather than the track name means a
// skipped issue does not silently reorder anybody's cycle.
// A row written to in the first campaign has no counter yet, and an empty
// counter reads as zero — which would send it the introduction a second time.
// So the counter is derived once, from the flag the first campaign did set,
// rather than backfilled across two thousand rows: already written to means
// step 1, «الجديد لدينا», which is the two-week follow-up the owner asked for.
export function stepFor(row) {
  const n = row && row["Email Step"];
  if (n !== null && n !== undefined && n !== "") return Number(n);
  return row && (row["Campaign Sent"] === true || row["Campaign Sent"] === "__YES__") ? 1 : 0;
}

export function trackFor(step) {
  return TRACKS[((Number(step) || 0) % CYCLE + CYCLE) % CYCLE];
}

// Eligible on a given day: never written to, or written to at least fourteen
// days ago. Suppressed, bounced and duplicate rows are filtered before this is
// ever called — this function answers timing only.
export function dueOn(lastSentISO, todayISO) {
  if (!lastSentISO) return true;
  const gap = (Date.parse(todayISO + "T00:00:00Z") - Date.parse(String(lastSentISO).slice(0, 10) + "T00:00:00Z")) / 86400000;
  return gap >= INTERVAL_DAYS;
}

function serviceSummary(code) {
  const s = byCode[code];
  if (!s) return null;
  return { code, name: s.name, category: s.category, slug: s.slug, requiresProposal: !!s.requiresProposal };
}

function build() {
  const missing = TRACKS.flatMap((t) => t.serviceCodes).filter((c) => !byCode[c]);
  if (missing.length) {
    console.error("email-rotation: رموز غير موجودة في الكتالوج: " + missing.join(", "));
    process.exit(1);
  }
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    intervalDays: INTERVAL_DAYS,
    cycle: CYCLE,
    tracks: TRACKS.map((t) => ({
      step: t.step,
      key: t.key,
      nameAr: t.nameAr,
      subjectAr: t.subjectAr,
      intentAr: t.intentAr,
      sourceOfTruth: t.sourceOfTruth,
      always: t.always,
      leadCode: t.leadCode || null,
      pillars: t.pillars ? t.pillars.map((p) => ({ ...p, service: serviceSummary(p.code) })) : null,
      services: t.serviceCodes.map(serviceSummary),
    })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const out = path.join(ROOT, "site/data/email-rotation.json");
  fs.writeFileSync(out, JSON.stringify(build(), null, 2) + "\n");
  console.log("email-rotation: " + CYCLE + " مسارات، كل " + INTERVAL_DAYS + " يوماً → " + path.relative(ROOT, out));
}
