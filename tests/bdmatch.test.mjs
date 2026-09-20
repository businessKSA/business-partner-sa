// Matchmaking between the BD profile and the companies database.
//
// Run: npm test
//
// What is pinned, and why each is worth pinning:
//
// The query is the product. A filter that quietly drops the sector clause
// returns the whole database — which is not a match, it is a leak of the
// asset the paid data portal sells. And a match row must never carry a phone
// or an e-mail unless a reveal was asked for, because that is the line
// between "companies you could talk to" and "a contact list anyone on a free
// trial can export".
import { matchFilter, matchQuery, mapCompany, explainMatch, MATCH_PAGE_SIZE } from "../api/_bdmatch.js";

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const j = (v) => JSON.stringify(v);

console.log("\n1. No sectors → no query at all");
ok(matchFilter({ targetSectors: [] }) === null, "empty sectors → null filter");
ok(matchFilter(null) === null, "no profile → null filter");
ok(matchQuery({ targetSectors: [] }) === null, "and therefore no request body");

console.log("\n2. One sector is a plain equals; several are an OR");
let f = matchFilter({ targetSectors: ["Healthcare"] });
ok(j(f.and[0]) === j({ property: "Sector", select: { equals: "Healthcare" } }), "single sector → equals: " + j(f.and[0]));
f = matchFilter({ targetSectors: ["Healthcare", "Real Estate"] });
ok(f.and[0].or && f.and[0].or.length === 2, "two sectors → OR of two: " + j(f.and[0]));
ok(f.and[0].or.every((c) => c.property === "Sector"), "every branch filters Sector");

console.log("\n3. Cities narrow, and are absent when none were picked");
f = matchFilter({ targetSectors: ["Healthcare"], targetCities: ["Riyadh"] });
ok(f.and.some((c) => c.property === "City" && c.select.equals === "Riyadh"), "one city → City equals");
f = matchFilter({ targetSectors: ["Healthcare"], targetCities: ["Riyadh", "Jeddah"] });
ok(f.and.some((c) => c.or && c.or.length === 2 && c.or[0].property === "City"), "two cities → OR on City");
f = matchFilter({ targetSectors: ["Healthcare"] });
ok(!j(f).includes('"City"'), "no cities → no City clause at all");

console.log("\n4. The paid portal's two guards are always present");
f = matchFilter({ targetSectors: ["Healthcare"] });
ok(f.and.some((c) => c.property === "Duplicate" && c.checkbox.equals === false), "duplicates excluded");
ok(f.and.some((c) => c.or && c.or.some((x) => x.property === "Phone") && c.or.some((x) => x.property === "Email")), "must have a phone or an e-mail");

console.log("\n5. The request body is paged and sorted");
let q = matchQuery({ targetSectors: ["Healthcare"] });
ok(q.page_size === MATCH_PAGE_SIZE, "page size: " + q.page_size);
ok(!("start_cursor" in q), "no cursor on the first page");
q = matchQuery({ targetSectors: ["Healthcare"] }, "abc");
ok(q.start_cursor === "abc", "cursor carried on later pages");
ok(q.sorts[0].property === "Sector", "sorted by sector so the list groups");

console.log("\n6. A match row carries no contact details unless revealed");
const page = { id: "p1", properties: {
  Name: { title: [{ plain_text: "شركة المدار" }] },
  Sector: { select: { name: "Healthcare" } },
  City: { select: { name: "Riyadh" } },
  Ownership: { select: { name: "Saudi" } },
  Phone: { phone_number: "+966500000000" },
  Email: { email: "info@example.com" },
  Domain: { url: "https://example.com" },
  LinkedIn: { url: "" },
  Description: { rich_text: [{ plain_text: "x".repeat(600) }] },
} };
let r = mapCompany(page);
ok(r.name === "شركة المدار" && r.sector === "Healthcare" && r.city === "Riyadh", "company, sector, city mapped");
ok(!("phone" in r) && !("email" in r), "no phone/email on a plain row: " + Object.keys(r).join(","));
ok(r.hasPhone === true && r.hasEmail === true, "but it says a contact exists, so the client knows a reveal is worth asking for");
ok(r.description.length === 400, "description clamped: " + r.description.length);
r = mapCompany(page, true);
ok(r.phone === "+966500000000" && r.email === "info@example.com", "revealed on request");
ok(mapCompany(null).name === "" && mapCompany({}).id === "", "a broken page does not throw");

console.log("\n7. The row says why it matched, in the client's language");
const labels = { sector: (v) => (v === "Healthcare" ? "الرعاية الصحية" : v), city: (v) => (v === "Riyadh" ? "الرياض" : v) };
const prof = { targetSectors: ["Healthcare"], targetCities: ["Riyadh"] };
ok(explainMatch(mapCompany(page), prof, labels) === "الرعاية الصحية · الرياض", "sector and city, labelled: " + explainMatch(mapCompany(page), prof, labels));
ok(explainMatch(mapCompany(page), { targetSectors: ["Healthcare"] }, labels) === "الرعاية الصحية", "sector only when no city was targeted");
ok(explainMatch({ sector: "Retail & Restaurants", city: "" }, prof, labels) === "", "no false reason for a row that did not match on those");

console.log(fail.length ? "\nFAILED: " + fail.length : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
