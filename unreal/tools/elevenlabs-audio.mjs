// يولّد السرد والموسيقى الناقصة عبر واجهة ElevenLabs مباشرة (يحتاج ELEVENLABS_API_KEY ورصيداً).
// الاستعمال: ELEVENLABS_API_KEY=... node unreal/tools/elevenlabs-audio.mjs
// المخرجات تُكتب في game/audio/ بالأسماء التي تلتقطها اللعبة تلقائياً.
import fs from 'node:fs'; import path from 'node:path';
const KEY = process.env.ELEVENLABS_API_KEY; if (!KEY) { console.error('ELEVENLABS_API_KEY missing'); process.exit(1); }
const VOICE = 'MI88rOZjXbH22N8KHXUo'; // Ali — صوت سعودي رزين
const outDir = path.resolve('game/audio'); fs.mkdirSync(outDir, { recursive: true });
const NARR = {
  'narr-3.mp3': 'خرج عبدالعزيز بن عبدالرحمن من الكويت في أواخر عام ألفٍ وتسعمئةٍ وواحد مع نحو أربعين رجلاً. أشهرٌ في الصحراء، ثم الرياض أمامه في ظلمة الليل. الخطة: يتسوّر الرجال الجدار، ويكمنون في بيتٍ يلاصق المصمك، حتى يخرج عجلان أمير الرياض من قبل ابن رشيد عند الفجر. أنت سالم بن ماجد، كشّاف الركب. تقدّم الرجال، وافتح لهم الطريق بصمت.',
  'narr-5.mp3': 'الأحساء، واحة النخيل على طريق الخليج. حاميةٌ عثمانية في حيّ الكوت بالهفوف، وعبدالعزيز يريد الساحل. الخطة نفسها التي نجحت في الرياض: سلالم من جذوع النخل على السور، ورجالٌ يدخلون بصمت في الليل ويفتحون الكوت من الداخل.',
  'narr-6.mp3': 'ثلاثون عاماً بعد فجر المصمك. من الرياض إلى الحجاز، ومن الأحساء إلى عسير، صارت الأرض واحدة. في الثالث والعشرين من سبتمبر عام ألفٍ وتسعمئةٍ واثنين وثلاثين أُعلن توحيد البلاد باسم المملكة العربية السعودية، والراية الخضراء فوق كل بلد. ثلاثة أجيال من الكشّافين حملوا الرسائل ورفعوا الرايات. هذه راية واحدة، وهذا وطنٌ واحد.'
};
const MUSIC = {
  'stealth.mp3': { prompt: 'Tense quiet stealth loop, night infiltration in an old Arabian mud-brick city: sparse oud in maqam Bayati, low drone, distant frame-drum heartbeat, ney breaths, desert wind. Instrumental, seamless loop.', ms: 60000 },
  'chase.mp3':   { prompt: 'Fast driving chase music, Arabian rooftop pursuit: rapid daf and darbuka, urgent oud tremolo in maqam Hijaz, pulsing low strings, staccato brass hits. Instrumental, seamless loop.', ms: 45000 },
};
const save = async (name, res) => { if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`); fs.writeFileSync(path.join(outDir, name), Buffer.from(await res.arrayBuffer())); console.log('saved', name); };
for (const [name, text] of Object.entries(NARR)) if (!fs.existsSync(path.join(outDir, name)))
  await save(name, await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: .55, similarity_boost: .8, style: .3 } }) }));
for (const [name, m] of Object.entries(MUSIC)) if (!fs.existsSync(path.join(outDir, name)))
  await save(name, await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ prompt: m.prompt, music_length_ms: m.ms, force_instrumental: true }) }));
