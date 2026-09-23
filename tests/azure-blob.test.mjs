// Azure Blob signing, checked against the shape Azure documents. A wrong field
// order or a missed header returns 403 from Azure with no hint, so the exact
// string-to-sign is pinned here rather than trusted.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const ACCOUNT = "bpvault";
const KEY = Buffer.from("super-secret-account-key-0123456789").toString("base64");

function withAzure(fn, extra = {}) {
  const keys = ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY", "AZURE_STORAGE_CONTAINER", "AZURE_STORAGE_SUFFIX"];
  const saved = {};
  for (const k of keys) saved[k] = process.env[k];
  Object.assign(process.env, { AZURE_STORAGE_ACCOUNT: ACCOUNT, AZURE_STORAGE_KEY: KEY, AZURE_STORAGE_CONTAINER: "client-documents", ...extra });
  return Promise.resolve().then(fn).finally(() => {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}
const stub = (handler) => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return handler(String(url), opts, calls.length); };
  return { calls, restore: () => { globalThis.fetch = real; } };
};

test("a signed download URL carries exactly the SAS fields Azure expects", async () => {
  await withAzure(async () => {
    const { blobSign } = await import(`../api/_azblob.js?t=${Date.now()}`);
    const url = new URL(blobSign("org-1/doc-agent/req-9/cr.pdf", 600));

    assert.equal(url.host, `${ACCOUNT}.blob.core.windows.net`);
    assert.equal(url.pathname, "/client-documents/org-1/doc-agent/req-9/cr.pdf");
    const q = url.searchParams;
    assert.equal(q.get("sp"), "r", "read only - a download link must never grant writes");
    assert.equal(q.get("sr"), "b", "scoped to one blob, not the container");
    assert.equal(q.get("spr"), "https");
    assert.equal(q.get("sv"), "2021-08-06");
    assert.ok(q.get("sig"), "signed");

    // Short-lived, with a small backdated start for clock skew.
    const st = new Date(q.get("st")).getTime(), se = new Date(q.get("se")).getTime();
    assert.ok(st < Date.now(), "starts slightly in the past");
    assert.equal(Math.round((se - st) / 1000), 900, "600s of life plus the 300s skew window");
    assert.ok(!/\.\d{3}Z/.test(q.get("se")), "second precision, as Azure requires");

    // The signature is the HMAC of the documented 16-field string, in order.
    const expected = crypto.createHmac("sha256", Buffer.from(KEY, "base64")).update([
      "r", q.get("st"), q.get("se"),
      `/blob/${ACCOUNT}/client-documents/org-1/doc-agent/req-9/cr.pdf`,
      "", "", "https", "2021-08-06", "b", "", "", "", "", "", "", "",
    ].join("\n"), "utf8").digest("base64");
    assert.equal(q.get("sig"), expected);
  });
});

test("upload signs a Shared Key header and declares the block-blob type", async () => {
  await withAzure(async () => {
    const { blobPut } = await import(`../api/_azblob.js?t=${Date.now()}`);
    const f = stub(() => new Response("", { status: 201 }));
    try {
      const body = Buffer.from("a vendor form");
      await blobPut("org-1/forms/vendor.xlsx", body, "application/vnd.ms-excel");
      assert.equal(f.calls.length, 1);
      const { url, opts } = f.calls[0];
      assert.equal(url, `https://${ACCOUNT}.blob.core.windows.net/client-documents/org-1/forms/vendor.xlsx`);
      assert.equal(opts.method, "PUT");
      assert.equal(opts.headers["x-ms-blob-type"], "BlockBlob");
      assert.equal(opts.headers["x-ms-version"], "2021-08-06");
      assert.match(opts.headers.Authorization, new RegExp(`^SharedKey ${ACCOUNT}:`));
      assert.ok(opts.headers["x-ms-date"], "date is signed and sent");
      assert.equal(opts.body, body, "the bytes go up untouched");
      // Content-Length is signed but handed to fetch, never set by us.
      assert.equal(opts.headers["Content-Length"], undefined);
    } finally { f.restore(); }
  });
});

test("Arabic and spaced names are percent-encoded, but the path keeps its slashes", async () => {
  await withAzure(async () => {
    const { blobSign } = await import(`../api/_azblob.js?t=${Date.now()}`);
    const url = blobSign("org-1/عقود/السجل التجاري.pdf", 600);
    assert.ok(url.includes("/client-documents/org-1/"), "folder structure survives");
    assert.ok(url.includes("%D8%B9%D9%82%D9%88%D8%AF"), "Arabic segment encoded");
    assert.ok(url.includes("%20"), "the space encoded, not dropped");
    assert.ok(!/عقود/.test(url), "raw Arabic is not left in the URL");
  });
});

test("a failed upload names the status instead of a bare failure", async () => {
  await withAzure(async () => {
    const { blobPut } = await import(`../api/_azblob.js?t=${Date.now()}`);
    const f = stub(() => new Response("<Error><Code>AuthenticationFailed</Code></Error>", { status: 403 }));
    try {
      await assert.rejects(() => blobPut("x/y.pdf", Buffer.from("z"), "application/pdf"), /azblob_put_403/);
    } finally { f.restore(); }
  });
});

test("the container is configurable and defaults to client-documents", async () => {
  await withAzure(async () => {
    const { CONTAINER } = await import(`../api/_azblob.js?t=${Date.now()}`);
    assert.equal(CONTAINER(), "bp-vault");
  }, { AZURE_STORAGE_CONTAINER: "bp-vault" });
  await withAzure(async () => {
    delete process.env.AZURE_STORAGE_CONTAINER;
    const { CONTAINER } = await import(`../api/_azblob.js?t=${Date.now()}`);
    assert.equal(CONTAINER(), "client-documents");
  });
});

test("an unconfigured account is reported by variable name, not guessed at", async () => {
  const saved = [process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY];
  delete process.env.AZURE_STORAGE_ACCOUNT; delete process.env.AZURE_STORAGE_KEY;
  try {
    const { azureBlobReady, blobMissing } = await import(`../api/_azblob.js?t=${Date.now()}`);
    assert.equal(azureBlobReady(), false);
    assert.equal(blobMissing(), "AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY");
  } finally {
    if (saved[0] !== undefined) process.env.AZURE_STORAGE_ACCOUNT = saved[0];
    if (saved[1] !== undefined) process.env.AZURE_STORAGE_KEY = saved[1];
  }
});
