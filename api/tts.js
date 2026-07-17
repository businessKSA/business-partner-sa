// Vercel Serverless Function — نطق ردود «باهر» بصوت رجل طبيعي.
// POST {text} → audio (male voice, نفس لغة النص تلقائياً: عربي/إنجليزي/فرنسي/صيني...).
//
// المزودون بالترتيب:
//   1. Gemini 2.5 Flash TTS — نفس مفتاح Gemini المستخدم في api/chat (مجاني)،
//      صوت «Charon» الرجالي، ويتبع تعليمات الأسلوب (لهجة سعودية طبيعية للعربي).
//   2. OpenAI gpt-4o-mini-tts (صوت onyx الرجالي) إن وُجد مفتاح OpenAI.
// عند فشل الجميع يرجع 502 والواجهة تسقط تلقائياً على صوت المتصفح.

const envFrom = (names) => { for (const n of names) { if (process.env[n]) return process.env[n]; } return ""; };
const GEMINI_KEYS = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_KEY", "GEMINI_APIKEY", "GEMINI", "BusinessPartnerGimini", "BusinessPartnerGemini"];
const OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI"];

// غلاف WAV لخام PCM (Gemini يرجع 16-bit mono 24kHz بدون هيدر)
function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// تعليمة أسلوب قصيرة حسب لغة النص — نموذج TTS يتبعها ولا يقرؤها
function styled(text) {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  if (arabic > text.length * 0.2) {
    return "اقرأ النص التالي بصوت رجل سعودي طبيعي وودود وواثق، بإيقاع حديث عادي غير متكلّف:\n" + text;
  }
  return "Read the following aloud as a natural, warm, confident male voice at a normal conversational pace:\n" + text;
}

async function geminiTts(text) {
  const key = envFrom(GEMINI_KEYS);
  if (!key) throw new Error("no gemini key");
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: styled(text) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.GEMINI_TTS_VOICE || "Charon" } } },
      },
    }),
  });
  if (!r.ok) throw new Error(`gemini-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("gemini-tts empty audio");
  return { body: pcmToWav(Buffer.from(b64, "base64")), type: "audio/wav" };
}

async function openaiTts(text) {
  const key = envFrom(OPENAI_KEYS);
  if (!key) throw new Error("no openai key");
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "onyx",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!r.ok) throw new Error(`openai-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { body: Buffer.from(await r.arrayBuffer()), type: "audio/mpeg" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) {
    body = await new Promise((resolve) => {
      let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
  }

  let text = typeof body.text === "string" ? body.text.trim() : "";
  // تنظيف: بدون روابط وإيموجي، وبسقف طول ينتهي عند حدود جملة
  text = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}#*_>`~\-]{2,}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 1400) {
    const cut = text.slice(0, 1400);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("؟"), cut.lastIndexOf("!"), cut.lastIndexOf("؛"), cut.lastIndexOf("\n"));
    text = stop > 500 ? cut.slice(0, stop + 1) : cut;
  }
  if (!text) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "no_text" }));
  }

  for (const provider of [geminiTts, openaiTts]) {
    try {
      const audio = await provider(text);
      res.statusCode = 200;
      res.setHeader("Content-Type", audio.type);
      res.setHeader("Cache-Control", "no-store");
      return res.end(audio.body);
    } catch (e) {
      console.error("tts provider failed, trying next:", e.message || e);
    }
  }

  res.statusCode = 502;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ error: "tts_unavailable" }));
}
