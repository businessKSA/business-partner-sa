// Resilient wrapper for /api/chat — helper, not a route.
// Keeps the existing advisor implementation intact, but guarantees that the
// public Simple V1 intake chat still answers when every model provider is
// unavailable, out of credit, or misconfigured.
//
// This began life as api/chat-safe.js, a second Vercel function that imported
// chat.js and was reached through a rewrite. Two functions for one endpoint put
// api/ at 13 against a cap of 12, which fails the build guard and would 500 the
// whole API on deploy. The advisor handler is now passed in as an argument —
// same behaviour, one function, and no import cycle between the two files.

const N8N_URL = "https://businesspartnerai.app.n8n.cloud/webhook/f08bf4a4-62e9-4aa6-9a44-bf3080682fb3/chat";

function parseBody(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  if (req && typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch {}
  }
  return {};
}

function captureResponse() {
  const headers = {};
  return {
    statusCode: 200,
    body: "",
    headers,
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    getHeader(name) { return headers[String(name).toLowerCase()]; },
    end(chunk = "") { this.body += chunk == null ? "" : String(chunk); },
  };
}

function sendCaptured(realRes, captured) {
  for (const [k, v] of Object.entries(captured.headers || {})) {
    try { realRes.setHeader(k, v); } catch {}
  }
  realRes.statusCode = captured.statusCode || 200;
  return realRes.end(captured.body || "");
}

const COPY = {
  ar: {
    consulting: {
      first: "تمام. عشان أرتب الاستشارة صح: وش النشاط أو نوع الشركة؟ ووش القرار أو المشكلة اللي تبغى نركز عليها؟",
      title: "استشارة أعمال",
      intro: "رتبت لك نطاق مبدئي للاستشارة. راجعه وعدّل عليه قبل ما نجهز عرض السعر.",
      items: [
        "فهم الموضوع والحالة الحالية",
        "تحديد الجهات والمتطلبات ذات العلاقة",
        "تحديد الخطوات والتوصيات المطلوبة"
      ],
      needs: ["السجل التجاري أو بيانات المنشأة", "أي مستندات أو إشعارات مرتبطة بالحالة"]
    },
    government: {
      first: "تمام. وش المنصة أو الجهة الحكومية؟ ووش الإجراء المطلوب أو رسالة المشكلة اللي تظهر لك؟",
      title: "طلب خدمة حكومية",
      intro: "رتبت لك نطاق مبدئي للخدمة الحكومية. راجعه وعدّل عليه قبل ما نجهز عرض السعر.",
      items: [
        "فحص الحالة الحالية في المنصة",
        "تحديد المتطلبات والإجراء المناسب",
        "تجهيز ومتابعة المعاملة المطلوبة"
      ],
      needs: ["صورة رسالة الخطأ أو الإشعار إن وجد", "السجل التجاري", "بيانات المعاملة أو الموظفين المعنيين"]
    },
    formation: {
      first: "ممتاز. هل التأسيس لفرع شركة أجنبية قائمة أو لمشروع ريادي؟ ووش النشاط والمدينة المستهدفة؟",
      title: "تأسيس شركة في السعودية",
      intro: "رتبت لك نطاق مبدئي للتأسيس. راجعه وعدّل عليه قبل ما نجهز عرض السعر.",
      items: [
        "تحديد مسار التأسيس المناسب",
        "تجهيز متطلبات ووثائق التأسيس",
        "إجراءات التأسيس والتسجيلات الحكومية الأساسية"
      ],
      needs: ["جوازات أو هويات الملاك", "بيانات النشاط والمدينة", "مستندات الشركة الأم إن وجدت"]
    }
  },
  en: {
    consulting: {
      first: "Got it. What does the company do, and what decision or problem should the consultation focus on?",
      title: "Business consultation",
      intro: "I prepared an initial scope for your consultation. Please review and edit it before we prepare the quotation.",
      items: ["Review the current situation", "Identify relevant authorities and requirements", "Define the recommended next steps"],
      needs: ["Commercial registration or company details", "Any documents or notices related to the case"]
    },
    government: {
      first: "Got it. Which government platform or authority is involved, and what action or error are you dealing with?",
      title: "Government service request",
      intro: "I prepared an initial scope for the government service. Please review and edit it before we prepare the quotation.",
      items: ["Review the current platform status", "Identify the required procedure and requirements", "Prepare and follow up the required transaction"],
      needs: ["Screenshot of any error or notice", "Commercial registration", "Relevant transaction or employee details"]
    },
    formation: {
      first: "Great. Is this for a foreign company branch or an entrepreneurship setup, and what activity and city are you targeting?",
      title: "Company formation in Saudi Arabia",
      intro: "I prepared an initial formation scope. Please review and edit it before we prepare the quotation.",
      items: ["Determine the appropriate formation route", "Prepare formation requirements and documents", "Complete core formation and government registrations"],
      needs: ["Owners' passport or ID details", "Business activity and target city", "Parent company documents if applicable"]
    }
  },
  fr: {
    consulting: {
      first: "D’accord. Quelle est l’activité de l’entreprise, et quelle décision ou difficulté souhaitez-vous traiter pendant la consultation ?",
      title: "Conseil aux entreprises",
      intro: "J’ai préparé un périmètre initial. Vous pouvez le vérifier et le modifier avant le devis.",
      items: ["Analyser la situation actuelle", "Identifier les autorités et exigences concernées", "Définir les prochaines étapes recommandées"],
      needs: ["Registre commercial ou informations de l’entreprise", "Documents ou notifications liés au dossier"]
    },
    government: {
      first: "D’accord. Quelle plateforme ou autorité est concernée, et quelle opération ou erreur rencontrez-vous ?",
      title: "Demande de service gouvernemental",
      intro: "J’ai préparé un périmètre initial. Vous pouvez le vérifier et le modifier avant le devis.",
      items: ["Vérifier la situation actuelle sur la plateforme", "Identifier la procédure et les exigences", "Préparer et suivre la démarche requise"],
      needs: ["Capture d’écran de l’erreur ou notification", "Registre commercial", "Informations sur la transaction ou les employés concernés"]
    },
    formation: {
      first: "Très bien. S’agit-il d’une succursale d’une société étrangère ou d’un projet entrepreneurial, et quelle activité et quelle ville visez-vous ?",
      title: "Création d’entreprise en Arabie saoudite",
      intro: "J’ai préparé un périmètre initial. Vous pouvez le vérifier et le modifier avant le devis.",
      items: ["Déterminer le parcours de création adapté", "Préparer les exigences et documents", "Réaliser les principales formalités de création et d’enregistrement"] ,
      needs: ["Passeports ou pièces d’identité des propriétaires", "Activité et ville ciblée", "Documents de la société mère le cas échéant"]
    }
  },
  zh: {
    consulting: {
      first: "好的。请告诉我公司的业务类型，以及这次咨询最需要解决的问题或决策是什么？",
      title: "企业咨询",
      intro: "我已为您整理了初步服务范围。您可以在报价前进行检查和修改。",
      items: ["了解当前情况", "确认相关政府部门和要求", "确定建议的下一步行动"],
      needs: ["商业登记或公司基本资料", "与当前事项有关的文件或通知"]
    },
    government: {
      first: "好的。请告诉我涉及哪个政府平台或部门，以及您需要办理什么事项或遇到什么错误？",
      title: "政府服务申请",
      intro: "我已为您整理了初步服务范围。您可以在报价前进行检查和修改。",
      items: ["检查平台当前状态", "确认所需流程和要求", "准备并跟进相关政府事务"],
      needs: ["错误或通知截图（如有）", "商业登记", "相关交易或员工信息"]
    },
    formation: {
      first: "好的。您计划设立外国公司分支机构还是创业公司？目标业务和城市是什么？",
      title: "在沙特设立公司",
      intro: "我已为您整理了初步设立范围。您可以在报价前进行检查和修改。",
      items: ["确定合适的公司设立路径", "准备设立要求和文件", "完成核心设立和政府登记流程"],
      needs: ["股东护照或身份证明", "业务活动和目标城市", "如适用，母公司文件"]
    }
  }
};

function intakePreset(context, lang) {
  const l = COPY[lang] || COPY.ar;
  return l[context] || l.consulting;
}

function requestType(context) {
  if (context === "government") return "GOVERNMENT_SERVICE";
  if (context === "formation") return "COMPANY_FORMATION";
  return "CONSULTATION";
}

function deterministicIntake(body) {
  const context = ["consulting", "government", "formation"].includes(body.context) ? body.context : "consulting";
  const lang = ["ar", "en", "fr", "zh"].includes(body.lang) ? body.lang : "ar";
  const preset = intakePreset(context, lang);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const users = messages.filter((m) => m && m.role === "user" && typeof m.content === "string");
  if (users.length < 2) return preset.first;
  const last = users[users.length - 1]?.content || "";
  const scope = {
    ready: true,
    type: requestType(context),
    title: preset.title,
    summary: last.slice(0, 500),
    items: preset.items.map((title) => ({ code: "", title, why: "" })),
    needs: preset.needs,
  };
  return `${preset.intro}\n\n<<SCOPE>>${JSON.stringify(scope)}<<END>>`;
}

async function n8nReply(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const transcript = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => `${m.role === "user" ? "الزائر" : "المساعد"}: ${m.content}`)
    .join("\n")
    .slice(-6000);
  if (!transcript) return "";
  const r = await fetch(N8N_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "sendMessage",
      sessionId: "site-safe-" + Math.random().toString(36).slice(2),
      chatInput: "زائر موقع Business Partner يتحدث مع مساعد الخدمات. رد باختصار واطلب فقط المعلومات الضرورية:\n" + transcript,
    }),
  });
  if (!r.ok) throw new Error(`n8n ${r.status}`);
  const data = await r.json().catch(() => ({}));
  return String(data?.output || data?.text || data?.reply || "").trim();
}

export async function withIntakeFallback(originalHandler, req, res) {
  const captured = captureResponse();
  try {
    await originalHandler(req, captured);
  } catch (e) {
    captured.statusCode = 502;
    captured.body = JSON.stringify({ error: "upstream_exception", reply: "" });
    console.error("chat-safe original handler exception:", e?.message || e);
  }

  // Healthy responses, auth errors, bad requests, etc. are preserved exactly.
  if ((captured.statusCode || 200) < 500) return sendCaptured(res, captured);

  const body = parseBody(req);
  const isIntake = body.mode === "intake";
  if (!isIntake) return sendCaptured(res, captured);

  // For the public three-service intake, never show an outage just because
  // external model credits/keys are unavailable. Try the existing n8n agent;
  // if it is unavailable too, use a deterministic intake flow that still
  // creates an editable scope after the second customer turn.
  let reply = "";
  try { reply = await n8nReply(body); } catch (e) {
    console.error("chat-safe n8n fallback failed:", e?.message || e);
  }

  const userTurns = Array.isArray(body.messages)
    ? body.messages.filter((m) => m && m.role === "user" && typeof m.content === "string").length
    : 0;
  if (!reply || userTurns >= 2) {
    const deterministic = deterministicIntake(body);
    if (!reply || !reply.includes("<<SCOPE>>")) reply = deterministic;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  return res.end(JSON.stringify({ reply, provider: reply.includes("<<SCOPE>>") ? "safe-intake" : "baher-n8n" }));
}
