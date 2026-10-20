// The sign-in screen as built (site/**/my.html, checkout.html): three doors in the
// order the owner decided on 2026-10-16 — Nafath, then Google, then e-mail (with a
// password to sign in or to create an account, and the emailed link/code as the
// alternative) — in all four languages, on /my and /checkout, with the one-time
// contact step after a first Nafath sign-in. These read the generated pages, so
// they need `npm run build` to have run (as `npm test` expects everywhere).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { default: test } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const page = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const LANGS = [["ar", "ar/my.html", "ar/checkout.html"], ["en", "my.html", "checkout.html"], ["fr", "fr/my.html", "fr/checkout.html"], ["zh", "zh/my.html", "zh/checkout.html"]];

for (const [lang, my, checkout] of LANGS) {
  test(`/my (${lang}): Nafath first, Google second, e-mail third`, () => {
    const html = page(my);
    const iN = html.indexOf("box.appendChild(nslot)");
    const iG = html.indexOf("box.appendChild(gslot)");
    const iM = html.indexOf("box.appendChild(mail)");
    assert.ok(iN > 0 && iG > iN && iM > iG, "the doors are appended in the decided order");
    const iMountN = html.indexOf("mountNafath(nslot");
    const iMountG = html.indexOf("mountGoogle(gslot");
    assert.ok(iMountN > 0 && iMountG > iMountN, "Nafath is mounted before Google");
    // e-mail: password sign-in, new account (code first), emailed link as the alternative
    for (const a of ["password-login", "password-signup-start", "password-signup-verify", "link-start", "nafath-contact-start", "nafath-contact-verify"]) {
      assert.ok(html.includes(`action:'${a}'`), `${a} is wired`);
    }
    // success paths keep the literal the build step turns into a full reload
    assert.ok(!html.includes("catch(x){}boot()"), "every sign-in success is rewritten to a full navigation");
    assert.ok(html.includes("location.replace(location.href)"));
    // after a first Nafath sign-in the contact step comes BEFORE any ?next= redirect
    const boot = html.indexOf("function boot(){");
    const contact = html.indexOf("renderContact();return", boot);
    const next = html.indexOf("location.replace(nx)", boot);
    assert.ok(contact > 0 && next > contact, "contact step before the redirect");
  });

  test(`/my (${lang}): the Nafath door and the new e-mail screens are written in this language`, () => {
    const html = page(my);
    const m = /var LX=(\{.*?\}),LL=/.exec(html);
    assert.ok(m, "the shared door script carries its texts");
    const LX = JSON.parse(m[1]);
    const T = /,TX=(\{.*?\}),ST=/s.exec(html);
    const TX = JSON.parse(T[1]);
    const needLX = ["nfTitle", "nfSub", "nfLabel", "nfBtn", "nfWaitTitle", "nfWaitText", "nfWaiting", "nfDone", "nfRejected", "nfExpired", "nfRetry", "nfFail", "nfDaily", "nfSoon", "nfBad10", "nfBadPrefix", "nfPrefix9"];
    for (const k of needLX) assert.ok(LX[k] && LX[k].length > 1, `LX.${k}`);
    const needTX = ["tabPw", "tabNew", "tabLink", "pwNew", "pwConfirm", "pwMismatch", "pwRule", "signupGo", "signupNote", "codeSent", "confirmGo",
      "cTitle", "cText", "cPhone", "cBadPhone", "cSend", "cMismatch", "pwr_short", "pwr_no_letter", "pwr_no_digit", "pwr_repetitive", "pwr_common", "pwr_has_email", "pwr_long", "tooMany", "badCreds", "codeOld"];
    for (const k of needTX) assert.ok(TX[k] && TX[k].length > 1, `TX.${k}`);
    if (lang !== "ar") {
      assert.ok(!/[؀-ۿ]/.test(LX.nfTitle + LX.nfBtn + LX.nfDaily + LX.nfSoon + TX.tabPw + TX.signupGo + TX.cTitle), `no Arabic leaks into the ${lang} page`);
    }
    if (lang === "zh") assert.ok(/[一-鿿]/.test(LX.nfTitle + TX.cTitle));
  });

  test(`/checkout (${lang}): a guest is offered Nafath, then Google, then the e-mail button`, () => {
    const html = page(checkout);
    const g = html.indexOf("function guestGoogle()");
    assert.ok(g > 0);
    const body = html.slice(g, g + 1500);
    const iN = body.indexOf("L.mountNafath(ns");
    const iG = body.indexOf("L.mountGoogle(s");
    assert.ok(iN > 0 && iG > iN, "Nafath is mounted before Google");
    assert.ok(body.indexOf("mount.insertBefore(ns,a)") > 0 && body.indexOf("mount.insertBefore(ns,a)") < body.indexOf("mount.insertBefore(s,a)"));
    // a brand-new Nafath account goes to /my for the one-time step, then back here
    assert.ok(body.includes("needsContact") && body.includes("'my?next='"));
    // a signed-in account without a real address is sent to complete it, not to pay with a placeholder
    assert.ok(html.includes("u.contactPending"));
  });
}

test("the Nafath door's styles ship with /my and /checkout", () => {
  for (const f of ["my.html", "checkout.html"]) {
    const html = page(f);
    for (const sel of [".nf{", ".nf-num{", ".nf-wait", ".bpg-or"]) assert.ok(html.includes(sel), `${f} has ${sel}`);
  }
  assert.ok(page("my.html").includes(".login .seg{"), "the e-mail tabs are styled");
});

test("the mobile menu still carries «دخول» first, pointing at /my", () => {
  const html = page("ar/index.html");
  assert.match(html, /<a href="[^"]*\/ar\/my[^"]*" class="sv1-navlogin" id="sv1NavLogin">/);
});

test("no secret, key or token is baked into the sign-in pages", () => {
  for (const f of ["my.html", "ar/my.html", "checkout.html"]) {
    const html = page(f);
    assert.ok(!/NAFATH_(APP_ID|APP_KEY|HASH_SECRET)|OTP_SECRET|OWNER_NATIONAL_IDS/.test(html), f);
  }
});
