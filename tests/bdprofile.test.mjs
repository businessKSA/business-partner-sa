// The Business Development client profile — the input side of matchmaking.
//
// Run: npm test
//
// What these pin down, and why each one is worth a test:
//
// The companies database filters on an English Sector select; every screen the
// client sees is Arabic. If an Arabic label reaches the stored row, the match
// query returns nothing and the product looks like an empty database rather
// than a mismatched key. That failure is invisible — no error, no exception,
// just no results — so the value/label translation is pinned here.
//
// And the uploaded profile deck is marketing copy. It may fill gaps, but it
// must never overwrite what the client typed about their own business.
import {
  normalizeProfile, profileCompleteness, canMatch, mergeExtracted,
  sectorLabel, cityLabel, SECTORS, MAX_SECTORS,
} from "../api/_bdprofile.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

console.log("\n1. Sectors are stored as the value the database filters on");
let p = normalizeProfile({ targetSectors: ["المقاولات والإنشاءات", "الرعاية الصحية"] });
ok(p.targetSectors[0] === "Contracting & Construction", "Arabic label → canonical value: " + p.targetSectors[0]);
ok(p.targetSectors[1] === "Healthcare", "and the second: " + p.targetSectors[1]);
p = normalizeProfile({ targetSectors: ["Healthcare"] });
ok(p.targetSectors[0] === "Healthcare", "a canonical value passes through unchanged");
ok(sectorLabel("Healthcare") === "الرعاية الصحية", "and reads back in Arabic: " + sectorLabel("Healthcare"));
ok(cityLabel("Riyadh") === "الرياض", "cities too: " + cityLabel("Riyadh"));

console.log("\n2. A sector the database has never heard of is dropped, not stored");
p = normalizeProfile({ targetSectors: ["Underwater Basket Weaving", "قطاع لا وجود له", "Healthcare"] });
ok(p.targetSectors.length === 1 && p.targetSectors[0] === "Healthcare",
  "only the real one survives: " + JSON.stringify(p.targetSectors));

console.log("\n3. Duplicates and floods are bounded");
p = normalizeProfile({ targetSectors: ["Healthcare", "الرعاية الصحية", "Healthcare"] });
ok(p.targetSectors.length === 1, "the same sector by both names counts once: " + p.targetSectors.length);
p = normalizeProfile({ targetSectors: SECTORS.map(([v]) => v) });
ok(p.targetSectors.length === MAX_SECTORS, `capped at ${MAX_SECTORS}: ` + p.targetSectors.length);
p = normalizeProfile({ targetSectors: "Healthcare" });
ok(Array.isArray(p.targetSectors) && p.targetSectors.length === 0, "a bare string is not a list");

console.log("\n4. Free text is trimmed and bounded, never trusted raw");
p = normalizeProfile({ servicesText: "  نورّد   معدات\n\nمطابخ  ", idealCustomer: "x".repeat(9000) });
ok(p.servicesText === "نورّد معدات مطابخ", "whitespace collapsed: " + JSON.stringify(p.servicesText));
ok(p.idealCustomer.length === 4000, "long text clamped: " + p.idealCustomer.length);
p = normalizeProfile({});
ok(p.servicesText === "" && p.idealCustomer === "", "missing fields become empty strings, not undefined");
ok(normalizeProfile(null).targetSectors.length === 0, "null input does not throw");

console.log("\n5. Matching only runs once there is something to match on");
ok(canMatch({ targetSectors: ["Healthcare"] }) === true, "a sector is enough to match");
ok(canMatch({ targetSectors: [] }) === false, "no sector, no match");
ok(canMatch(null) === false, "no profile, no match");

console.log("\n6. Completeness reports what is missing, not what is filled in");
ok(profileCompleteness(null) === 0, "an absent profile is 0");
ok(profileCompleteness({}) === 0, "an empty profile is 0, not a participation score");
const partial = profileCompleteness({ servicesText: "x".repeat(50) });
const withSector = profileCompleteness({ servicesText: "x".repeat(50), targetSectors: ["Healthcare"] });
ok(withSector > partial, "adding the sector that makes matching possible raises it: " + partial + " → " + withSector);
ok(profileCompleteness({
  servicesText: "x".repeat(50), idealCustomer: "y".repeat(40),
  targetSectors: ["Healthcare"], targetCities: ["Riyadh"], profilePath: "p/1.pdf",
}) === 100, "a complete profile reaches 100");

console.log("\n7. The uploaded deck fills gaps and never overrules the client");
const typed = { servicesText: "نبيع أنظمة إطفاء حريق", targetSectors: ["Healthcare"] };
let m = mergeExtracted(typed, {
  summaryAr: "شركة تسويق رقمي",
  sectorsServed: ["Retail & Restaurants"],
  servicesAr: ["حملات", "تصميم"],
  keywordsAr: ["تسويق"],
});
ok(m.servicesText === "نبيع أنظمة إطفاء حريق", "the client's own words survive: " + m.servicesText);
ok(m.targetSectors[0] === "Healthcare", "and their chosen sector survives: " + m.targetSectors[0]);
ok(m.suggestedSectors[0] === "Retail & Restaurants", "the deck's sectors are kept as a suggestion");
ok(m.extractedServices.length === 2 && m.extractedKeywords.length === 1, "extracted lists are stored");

m = mergeExtracted({ servicesText: "", targetSectors: [] }, {
  summaryAr: "شركة تسويق رقمي", sectorsServed: ["Retail & Restaurants"],
});
ok(m.servicesText === "شركة تسويق رقمي", "but an empty field is filled from the deck");
ok(m.targetSectors[0] === "Retail & Restaurants", "and so is an empty sector list");

m = mergeExtracted({ targetSectors: [] }, { sectorsServed: ["nonsense", "Healthcare"] });
ok(m.targetSectors.length === 1, "a sector the model invented is dropped like any other");
ok(mergeExtracted(null, null).extractedServices.length === 0, "null on both sides does not throw");

console.log(fail.length ? "\nFAILED: " + fail.length : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
