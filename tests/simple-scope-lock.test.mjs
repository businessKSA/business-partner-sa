// The scope of a request is fixed by a standing quotation, whatever the status
// says. Found while trying the sales-client path (2026-10-20): operations moved
// a PAID request to WAITING_CLIENT to ask for a document, the portal re-opened
// the scope editor, and the customer could re-confirm the scope and have a new
// quotation issued over a signed contract. Only a REJECTED quotation (the
// customer asked for changes) leaves the scope open.
//
// Run: npm test   (no dependencies, no browser; lives in tests/, not api/)
process.env.LOCAL_DB = process.env.LOCAL_DB || "1";
const { scopeLockedByQuote } = await import("../api/_simple.js");

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };

ok(scopeLockedByQuote({ status: "NEW", quote: null }) === false, "no quotation yet: scope open");
ok(scopeLockedByQuote({ status: "REVIEWING" }) === false, "no quote field at all: scope open");
ok(scopeLockedByQuote({ status: "WAITING_CLIENT", quote: { status: "REJECTED" } }) === false, "customer asked for changes: scope open again");
ok(scopeLockedByQuote({ status: "QUOTE_SENT", quote: { status: "SENT" } }) === true, "quotation sent: locked");
ok(scopeLockedByQuote({ status: "WAITING_CLIENT", quote: { status: "APPROVED" } }) === true, "paid/signed request moved to WAITING_CLIENT: still locked");
ok(scopeLockedByQuote({ status: "REVIEWING", quote: { status: "DRAFT" } }) === false, "an unsent draft does not fix the scope (as before)");

if (fail.length) { console.log("\nFAILED:", fail.length); process.exit(1); }
console.log("# ALL PASS");
