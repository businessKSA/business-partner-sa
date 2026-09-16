// نداء نماذج الذكاء عبر Azure OpenAI — المزود الوحيد.
//
// كانت في المستودع أربع سلاسل مزوّدين متوازية (جيميني ثم جروك ثم أوبن إيه آي
// ثم أنثروبيك ثم وكيل n8n)، مكتوبة مرتين: مرة في المحادثة ومرة في قراءة
// المستندات. وأسوأ ما في سلسلة الاحتياط أنها تبتلع العطل: حين تقاعد جوجل
// نموذجاً وردّت 404، انتقلت السلسلة إلى التالي وما ظهر للمستخدم إلا «صار خلل
// بسيط» — فبقي السبب مخفياً. صار المزوّد واحداً، وعطله يُقال باسمه.
//
// مسار أزور: {endpoint}/openai/deployments/{deployment}/chat/completions
// والمفتاح في ترويسة api-key لا Bearer.

const trim = (v) => String(v || "").trim();

function config() {
  return {
    endpoint: trim(process.env.AZURE_OPENAI_ENDPOINT).replace(/\/+$/, ""),
    apiKey: trim(process.env.AZURE_OPENAI_API_KEY),
    deployment: trim(process.env.AZURE_OPENAI_DEPLOYMENT),
    // النشر القادر على الصور قد يكون غير نشر النص؛ وإن لم يُفرد استُعمل الأول.
    visionDeployment:
      trim(process.env.AZURE_OPENAI_VISION_DEPLOYMENT) || trim(process.env.AZURE_OPENAI_DEPLOYMENT),
    // إصدار الواجهة يتغيّر، ولا يُخمَّن: يُضبط متغيّراً ويُثبَّت هنا افتراضاً.
    apiVersion: trim(process.env.AZURE_OPENAI_API_VERSION) || "2024-12-01",
  };
}

export function aiConfigured() {
  const c = config();
  return Boolean(c.endpoint && c.apiKey && c.deployment);
}

/** حالة الإعداد بالأسماء لا بالقيم — تُعرض في نقاط الفحص العامة. */
export function aiStatus() {
  const c = config();
  return {
    provider: "azure-openai",
    endpointSet: Boolean(c.endpoint),
    apiKeySet: Boolean(c.apiKey),
    deployment: c.deployment || null,
    visionDeployment: c.visionDeployment || null,
    apiVersion: c.apiVersion,
  };
}

function urlFor(deployment, c) {
  return `${c.endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(c.apiVersion)}`;
}

// النماذج الأحدث على أزور ترفض max_tokens وتطلب max_completion_tokens، والأقدم
// بالعكس. لا سبيل لمعرفة أيّهما من اسم النشر — فالاسم يختاره المالك — فتُجرَّب
// الأولى ويُقرأ نصّ الرفض: إن سمّى الحقل البديل أُعيد الطلب به مرة واحدة.
// بلا هذا يسقط النظام كله على ترقية نموذج لا علاقة لها بالكود.
async function post(deployment, payload, c) {
  const url = urlFor(deployment, c);
  const send = (body) =>
    fetch(url, {
      method: "POST",
      headers: { "api-key": c.apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  let r = await send(payload);
  if (r.status === 400 && payload.max_tokens != null) {
    const detail = await r.text().catch(() => "");
    if (detail.includes("max_completion_tokens")) {
      const { max_tokens, ...rest } = payload;
      r = await send({ ...rest, max_completion_tokens: max_tokens });
    } else {
      throw new Error(`azure-openai 400: ${detail.slice(0, 300)}`);
    }
  }
  if (!r.ok) throw new Error(`azure-openai ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
  const data = await r.json();
  return trim(data?.choices?.[0]?.message?.content);
}

/**
 * محادثة نصية. `messages` بصيغة [{role:"user"|"assistant", content}] و`system`
 * تعليمات النظام. يرمي عند العطل — المستدعي هو من يقرر ما يقوله للمستخدم.
 */
export async function chat(messages, system, { maxTokens = 1024, deployment } = {}) {
  const c = config();
  if (!aiConfigured()) throw new Error("azure_openai_not_configured");
  return post(
    deployment || c.deployment,
    {
      max_tokens: maxTokens,
      messages: [...(system ? [{ role: "system", content: system }] : []), ...messages],
    },
    c,
  );
}

/**
 * قراءة صورة أو صفحة ممسوحة. الصورة تُمرَّر base64 ويُبنى منها data URL،
 * وهي الصيغة التي تقبلها واجهة أزور في image_url.
 */
export async function vision(base64, mime, prompt, { maxTokens = 2048 } = {}) {
  const c = config();
  if (!aiConfigured()) throw new Error("azure_openai_not_configured");
  return post(
    c.visionDeployment,
    {
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime || "image/png"};base64,${base64}` } },
          ],
        },
      ],
    },
    c,
  );
}

export default { chat, vision, aiConfigured, aiStatus };
