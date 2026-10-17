// الميكروفون في مستشار الرئيسية كان يردّ «تعذّر تفريغ الصوت» لكل سبب. هذه
// الاختبارات تثبّت أن كل ردّ من Azure يصل العميل بسببه، وأن الكود يصلح بنفسه
// ما يمكن إصلاحه: اسم نشر مختلف، response_format لا يقبله النموذج، صيغة
// يدّعيها المتصفح ولا يحملها الملف. fetch مُحاكى — لا اتصال بـAzure.
import test from "node:test";
import assert from "node:assert/strict";

const AZ = "https://bp-ai.openai.azure.com";
const KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_WHISPER_DEPLOYMENT",
  "AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT", "AZURE_OPENAI_ASR_DEPLOYMENT", "AZURE_OPENAI_ENDPOINT_2",
  "AZURE_OPENAI_KEY_2", "AZURE_OPENAI_WHISPER_DEPLOYMENT_2", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_TEXT_DEPLOYMENT"];

async function withEnv(env, fn) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  const realFetch = globalThis.fetch;
  try { return await fn(); } finally {
    globalThis.fetch = realFetch;
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
const load = () => import(`../api/_docread.js?t=${Date.now()}${Math.random()}`);

// يسجّل كل نداء ويجيب من سيناريو: handler(callIndex, {model, format, file, url}) → Response
function stub(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const f = opts.body;
    const file = f.get("file");
    const c = { url: String(url), model: f.get("model"), format: f.get("response_format"), name: file.name, type: file.type, lang: f.get("language"), headers: opts.headers };
    calls.push(c);
    return handler(calls.length, c);
  };
  return calls;
}
const ok = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
const err = (status, message) => new Response(JSON.stringify({ error: { message } }), { status });
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 1)]).toString("base64");
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(2000, 1)]).toString("base64");
const ENV = { AZURE_OPENAI_ENDPOINT: AZ, AZURE_OPENAI_KEY: "k-secret" };

test("نجاح: نشر whisper، verbose_json، الاسم الافتراضي، المفتاح في الترويستين", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    const calls = stub(() => ok({ text: " hello there ", language: "english" }));
    const r = await transcribeAudio(WEBM, "audio/webm;codecs=opus", "en");
    assert.equal(r.ok, true);
    assert.equal(r.text, "hello there");
    assert.equal(r.lang, "en");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${AZ}/openai/v1/audio/transcriptions`);
    assert.equal(calls[0].model, "whisper");
    assert.equal(calls[0].format, "verbose_json");
    assert.equal(calls[0].name, "voice.webm");
    assert.equal(calls[0].headers["api-key"], "k-secret");
  });
});

test("404 DeploymentNotFound: يجرّب الأسماء التالية ويثبّت الناجح", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    const calls = stub((n, c) => c.model === "whisper-1" ? ok({ text: "ok", language: "en" }) : err(404, "The API deployment for this resource does not exist."));
    const r = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r.ok, true);
    assert.deepEqual(calls.map((c) => c.model), ["whisper", "whisper-1"]);
    // المرة الثانية تبدأ بالاسم الذي نجح — لا بحث متكرر.
    const calls2 = stub(() => ok({ text: "again", language: "en" }));
    const r2 = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r2.ok, true);
    assert.equal(calls2[0].model, "whisper-1");
  });
});

test("الاسم المضبوط في البيئة يُجرَّب أولاً، ونموذج gpt-4o-transcribe يأخذ json لا verbose_json", async () => {
  await withEnv({ ...ENV, AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: "gpt-4o-transcribe" }, async () => {
    const { transcribeAudio } = await load();
    const calls = stub(() => ok({ text: "مرحبا" }));
    const r = await transcribeAudio(WEBM, "audio/webm", "ar");
    assert.equal(r.ok, true);
    assert.equal(calls[0].model, "gpt-4o-transcribe");
    assert.equal(calls[0].format, "json");
    assert.equal(r.lang, "ar", "بلا language في الرد تُؤخذ لغة الصفحة");
  });
});

test("400 بسبب response_format: يُعاد الطلب مرة واحدة بالصيغة الأخرى", async () => {
  await withEnv({ ...ENV, AZURE_OPENAI_WHISPER_DEPLOYMENT: "my-asr" }, async () => {
    const { transcribeAudio } = await load();
    const calls = stub((n, c) => c.format === "verbose_json" ? err(400, "response_format 'verbose_json' is not compatible with model") : ok({ text: "fine" }));
    const r = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r.ok, true);
    assert.deepEqual(calls.map((c) => c.format), ["verbose_json", "json"]);
    assert.equal(calls.every((c) => c.model === "my-asr"), true);
  });
});

test("الصيغة تُحدَّد من بايتات الملف: webm يدّعيه المتصفح mp4 يصل باسم voice.webm", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    const calls = stub(() => ok({ text: "x", language: "en" }));
    await transcribeAudio(WEBM, "audio/mp4", "en");
    assert.equal(calls[0].name, "voice.webm");
    assert.equal(calls[0].type, "audio/webm");
    const calls2 = stub(() => ok({ text: "x", language: "en" }));
    await transcribeAudio(MP4, "audio/webm", "en");
    assert.equal(calls2[0].name, "voice.mp4");
    assert.equal(calls2[0].type, "audio/mp4");
  });
});

test("سفاري: audio/mp4;codecs=mp4a.40.2 مقبول", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    stub(() => ok({ text: "x", language: "ar" }));
    const r = await transcribeAudio(MP4, "audio/mp4;codecs=mp4a.40.2", "ar");
    assert.equal(r.ok, true);
  });
});

for (const [status, reason] of [[401, "auth"], [403, "auth"], [429, "busy"], [400, "format"], [415, "format"], [500, "unavailable"], [503, "unavailable"]]) {
  test(`ردّ Azure ${status} يصل العميل بسبب «${reason}» دون كشف المفتاح`, async () => {
    await withEnv(ENV, async () => {
      const { transcribeAudio } = await load();
      const calls = stub(() => err(status, "boom"));
      const r = await transcribeAudio(WEBM, "audio/webm", "en");
      assert.equal(r.ok, false);
      assert.equal(r.error, "transcribe_failed");
      assert.equal(r.reason, reason);
      assert.equal(calls.length, 1, "غير النشر المفقود لا يُعاد مع كل اسم");
      assert.doesNotMatch(JSON.stringify(r), /k-secret/);
    });
  });
}

test("404 على كل الأسماء: reason=deployment والتفصيل يذكر الأسماء المجرَّبة", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    const calls = stub(() => err(404, "DeploymentNotFound"));
    const r = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r.reason, "deployment");
    assert.equal(calls.length, 4);
    assert.match(r.detail, /gpt-4o-mini-transcribe|whisper-1|gpt-4o-transcribe/);
  });
});

test("انقطاع الشبكة: reason=timeout", async () => {
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    globalThis.fetch = async () => { throw Object.assign(new Error("aborted"), { name: "TimeoutError" }); };
    const r = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r.reason, "timeout");
  });
});

test("المنطقة الثانية تُجرَّب حين تفشل الأولى بعطل مؤقت", async () => {
  await withEnv({ ...ENV, AZURE_OPENAI_ENDPOINT_2: "https://second.openai.azure.com", AZURE_OPENAI_KEY_2: "k2" }, async () => {
    const { transcribeAudio } = await load();
    const calls = stub((n, c) => c.url.startsWith(AZ) ? err(503, "busy") : ok({ text: "from second", language: "en" }));
    const r = await transcribeAudio(WEBM, "audio/webm", "en");
    assert.equal(r.ok, true);
    assert.equal(r.text, "from second");
    assert.equal(calls.length, 2);
  });
});

test("بلا إعداد: not_configured. نوع غريب: bad_type. فارغ: no_audio. صامت: no_speech", async () => {
  await withEnv({}, async () => {
    const { transcribeAudio } = await load();
    assert.equal((await transcribeAudio(WEBM, "audio/webm", "en")).error, "not_configured");
    assert.equal((await transcribeAudio(WEBM, "video/mp4", "en")).error, "bad_type");
    assert.equal((await transcribeAudio("", "audio/webm", "en")).error, "no_audio");
  });
  await withEnv(ENV, async () => {
    const { transcribeAudio } = await load();
    stub(() => ok({ text: "  ", language: "en" }));
    assert.equal((await transcribeAudio(WEBM, "audio/webm", "en")).error, "no_speech");
  });
});

test("الفحص الصحي يعرض أسماء النشر لا المفتاح", async () => {
  await withEnv({ ...ENV, AZURE_OPENAI_WHISPER_DEPLOYMENT: "bp-whisper" }, async () => {
    const { voiceProviders } = await load();
    const v = voiceProviders();
    assert.equal(v[0].configured, true);
    assert.equal(v[0].deploymentSet, true);
    assert.equal(v[0].deployments[0], "bp-whisper");
    assert.doesNotMatch(JSON.stringify(v), /k-secret/);
  });
});
