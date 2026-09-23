// الفريق: باهر منسّقاً، ومازن وبدر وفرح ومحمد متخصصين.
//
// التنسيق هنا **أداةٌ لا بنيةٌ تحتية**: كل متخصص يظهر لباهر دالةً يستدعيها
// باسمها ومهمتها، فيُدار الفريق بمنطق مقروء في ملف واحد بدل رسمٍ في لوحة.
// هذا هو الفرق العملي عن n8n: ما يجري هنا يُقرأ ويُختبر ويُراجَع في git.
//
// وكل متخصص جلسةٌ مستقلة بذاتها: لا يرى محادثة باهر ولا محادثة زميله. هذا
// متعمَّد — التكليف الذي يعتمد على «كما ذكرنا فوق» ينهار حين يُنفَّذ وحده.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./engine.mjs";
import { TOOL_DEFS, runTool } from "./tools.mjs";

const PROMPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");
const readPrompt = (f) => readFileSync(join(PROMPTS, f), "utf8");

export const SPECIALISTS = {
  mazen: { file: "mazen.md", label: "مازن — استقبال ومتابعة العملاء" },
  badr: { file: "badr.md", label: "بدر — المبيعات والعروض" },
  farah: { file: "farah.md", label: "فرح — التسويق والمحتوى" },
  mohammed: { file: "mohammed-site.md", label: "محمد — الموقع والتقنية" },
};

// سياق تشغيلي يُحقن في كل جلسة. بلا تاريخ اليوم يحسب النموذج «٤٨ ساعة» من
// تاريخ تدريبه، فيتابع عملاء العام الماضي.
function runtimeNote() {
  const now = new Date();
  const riyadh = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh", dateStyle: "full", timeStyle: "short",
  }).format(now);
  return `\n\n## الآن\n${riyadh} (توقيت الرياض) — ${now.toISOString()}.\n`
    + `أدواتك حقيقية وتمسّ بيانات وعملاء فعليين. لا تدّعِ إنجازاً لم تستدعِ له أداة.\n`
    + `ما يُرفض إرساله لاحتوائه التزاماً يُسجَّل بـpending_approval، ولا يُعاد صوغه للالتفاف على الحاجز.`;
}

/* حلقة الأدوات. الحدّ ليس تجميلاً: نموذج يدور بين أداتين بلا تقدّم يحرق
   الحصة ويقف. وبلوغ الحدّ يُقال صراحةً في الناتج بدل أن يُسلَّم نصف عمل
   على أنه تمام. */
const MAX_TURNS = 12;

async function runAgent({ system, user, tools = TOOL_DEFS, maxTurns = MAX_TURNS, onStep }) {
  const messages = [
    { role: "system", content: system + runtimeNote() },
    { role: "user", content: user },
  ];
  const used = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const msg = await chat(messages, { tools });
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) return { text: msg.content || "", toolsUsed: used, truncated: false };

    for (const c of calls) {
      let args = {};
      try { args = JSON.parse(c.function.arguments || "{}"); }
      catch { args = {}; }
      const result = await runTool(c.function.name, args);
      used.push({ name: c.function.name, args, result });
      if (onStep) onStep(c.function.name, args, result);
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }

  return {
    text: "بلغتُ حدّ الخطوات قبل إنهاء المهمة. ما تمّ مذكور في الأدوات المستدعاة، والباقي لم يُنفَّذ.",
    toolsUsed: used,
    truncated: true,
  };
}

export async function runSpecialist(key, task, opts = {}) {
  const spec = SPECIALISTS[key];
  if (!spec) throw new Error(`لا متخصص باسم ${key}`);
  return runAgent({ system: readPrompt(spec.file), user: task, ...opts });
}

// المتخصصون كأدوات لباهر.
const DELEGATE_DEFS = Object.entries(SPECIALISTS).map(([key, s]) => ({
  type: "function",
  function: {
    name: `ask_${key}`,
    description: `يكلّف ${s.label}. التكليف يجب أن يكون مكتفياً بذاته: السياق والمطلوب بالضبط وشكل التقرير — فهو لا يرى محادثتك.`,
    parameters: {
      type: "object",
      properties: { task: { type: "string", description: "التكليف كاملاً" } },
      required: ["task"],
    },
  },
}));

export async function runCoordinator(message, { onStep } = {}) {
  const system = readPrompt("baher.md") + runtimeNote();
  const messages = [
    { role: "system", content: system },
    { role: "user", content: message },
  ];
  const trace = [];
  const tools = [...TOOL_DEFS, ...DELEGATE_DEFS];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const msg = await chat(messages, { tools, maxTokens: 3000 });
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) return { text: msg.content || "", trace, truncated: false };

    // المهام المستقلة بالتوازي — هذا نصّ تعليمات باهر، وهو هنا سلوك لا وعد.
    const results = await Promise.all(calls.map(async (c) => {
      let args = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch {}
      const name = c.function.name;
      if (name.startsWith("ask_")) {
        const key = name.slice(4);
        if (onStep) onStep("delegate", key, args.task);
        try {
          // توقيع onStep للمتخصص (name, args, result) يخالف توقيع المنسّق
          // (kind, a, b)، وتمريره كما هو كان يطبع «[object Object]».
          const r = await runSpecialist(key, String(args.task || ""), {
            onStep: onStep ? (toolName) => onStep("tool", `${key}/${toolName}`) : undefined,
          });
          trace.push({ agent: key, task: args.task, tools: r.toolsUsed.map((t) => t.name), truncated: r.truncated });
          return { id: c.id, content: r.text + (r.truncated ? "\n\n[تنبيه: بلغ حدّ الخطوات]" : "") };
        } catch (e) {
          // تعثّر متخصص خبرٌ لباهر ليعيد التكليف، لا نهاية الجولة.
          trace.push({ agent: key, task: args.task, error: String(e.message || e) });
          return { id: c.id, content: `تعذّر تنفيذ التكليف: ${String(e.message || e).slice(0, 200)}` };
        }
      }
      const out = await runTool(name, args);
      trace.push({ tool: name, args });
      if (onStep) onStep("tool", name, out);
      return { id: c.id, content: JSON.stringify(out).slice(0, 8000) };
    }));

    for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
  }

  return { text: "بلغتُ حدّ الخطوات. ما تمّ في السجلّ، والباقي لم يُنفَّذ.", trace, truncated: true };
}
