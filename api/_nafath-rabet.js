// Business Partner — Nafath through «رابط» (Rabet, rabet.sa). SKELETON ONLY.
//
// Selected with NAFATH_PROVIDER=rabet (api/_nafath.js). The provider's API
// documentation has not reached us, and nothing here may be guessed: no
// address, no header name, no body or response shape. Until it arrives every
// call refuses with `not_implemented`, which api/otp.js reports to the visitor
// as «الدخول عبر نفاذ غير مُفعّل بعد», so selecting this provider by mistake
// fails closed instead of calling something invented.
//
// The contract the rest of the system relies on is the same two calls Elm's
// provider offers, and nothing wider:
//
//   request({ nationalId, locale, service })
//       → { requestId, transId, random }      random = the two-digit number
//                                               the user must pick in the app
//   status({ nationalId, transId, random })
//       → { status, raw }                      WAITING | EXPIRED | REJECTED | COMPLETED
//
// When the documentation arrives, fill these two functions and `configured()`
// and add the environment variables they need. Do not change the shapes above:
// api/otp.js, the sealed challenge and the daily meter all depend on them.

function notImplemented() {
  const e = new Error("not_implemented");
  e.provider = "rabet";
  return e;
}

export default {
  name: "rabet",
  configured: () => false,
  async request(_args) { throw notImplemented(); },
  async status(_args) { throw notImplemented(); },
};
