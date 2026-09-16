/**
 * الوكيل الذكي — يولّد عرض السعر والعقد كاملين لخدمة غير موجودة في الكتالوج.
 * كل ما يولّده يُحفَظ **كمسودة إلزامياً** ولا يُرسَل إلا بعد الاعتماد البشري.
 * القوالب المعتمدة موضوعة كأمثلة few-shot في templates/agent-prompt.md
 */
import { prisma } from './db';
import { loadText } from './templates';
import { checkContent, sanitizeDeep } from './content-guard';
import { createQuote, generateContractFromQuote } from './documents';
import { logEvent } from './timeline';
import { round2 } from './money';

export interface AgentInput {
  clientId: string;
  nameAr: string;
  nameEn: string;
  summaryAr: string;
  summaryEn?: string;
  price: number;
  qty?: number;
  paymentTermsAr: string;
  paymentTermsEn?: string;
  deliveryAr: string;
  deliveryEn?: string;
}

export interface AgentOutput {
  service: {
    code: string;
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    unitAr: string;
    unitEn: string;
  };
  quote: {
    titleAr: string;
    titleEn: string;
    introAr: string;
    introEn: string;
    scopeAr: string;
    scopeEn: string;
  };
  contract: {
    recitalAr: string;
    recitalEn: string;
    scopeClauseAr: string;
    scopeClauseEn: string;
  };
}

export class AgentUnavailable extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AgentUnavailable';
  }
}

export function agentReady(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT,
  );
}

/** اسم النشر على أزور — لا اسم نموذج: النشر هو ما يُنادى في المسار. */
export function agentModel(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || '';
}

function azureUrl(): string {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
  const version = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01';
  return `${endpoint}/openai/deployments/${encodeURIComponent(agentModel())}/chat/completions?api-version=${encodeURIComponent(version)}`;
}

function userMessage(i: AgentInput): string {
  return [
    'ولّد عرض سعر وعقداً لهذه الخدمة الجديدة غير الموجودة في الكتالوج.',
    '',
    `الاسم العربي: ${i.nameAr}`,
    `الاسم الإنجليزي: ${i.nameEn}`,
    `وصف موجز: ${i.summaryAr}`,
    i.summaryEn ? `Brief description: ${i.summaryEn}` : '',
    `السعر: ${i.price} ريال${i.qty && i.qty > 1 ? ` لكل وحدة، والكمية ${i.qty}` : ''} غير شامل ضريبة القيمة المضافة`,
    `شروط الدفع: ${i.paymentTermsAr}`,
    `مدة التنفيذ: ${i.deliveryAr}`,
    '',
    'أعد كائن JSON فقط بالبنية المطلوبة، بلا أي نص خارج الكائن.',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractJson(text: string): AgentOutput {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('لم يُرجع الوكيل كائن JSON صالحاً');
  try {
    return JSON.parse(raw.slice(start, end + 1)) as AgentOutput;
  } catch (e) {
    // رسالة المحلّل وحدها («Expected , or }») لا تدل على شيء لمن يقرأها في
    // الشاشة. يُذكر الموضع وطول النص ليتبيّن أن الرد مبتور لا معطوب.
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      `تعذّر تحليل مخرجات الوكيل: ${why}. طول الرد ${raw.length} حرفاً — ` +
        'إن كان مبتوراً فالسبب طول المطلوب، فاختصر الوصف وأعد المحاولة.',
    );
  }
}

export async function generateServiceContent(input: AgentInput): Promise<AgentOutput> {
  if (!agentReady()) {
    throw new AgentUnavailable(
      'إعداد Azure OpenAI ناقص — الوكيل الذكي غير مفعّل. اضبط AZURE_OPENAI_ENDPOINT و AZURE_OPENAI_API_KEY و AZURE_OPENAI_DEPLOYMENT في ملف .env ثم أعد المحاولة.',
    );
  }
  const system = loadText('agent-prompt.md');

  const res = await fetch(azureUrl(), {
    method: 'POST',
    headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY as string, 'content-type': 'application/json' },
    body: JSON.stringify({
      // العرض والعقد بالعربية والإنجليزية معاً يتجاوزان أربعة آلاف رمز بسهولة،
      // والنص العربي مكلف بالرموز. السقف المنخفض كان يقطع الرد في منتصف الكائن
      // فيظهر للمستخدم خطأ تحليل JSON بدل السبب الحقيقي.
      max_tokens: 16000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage(input) },
      ],
    }),
  });

  if (!res.ok) {
    throw new AgentUnavailable(
      `تعذّر نداء Azure OpenAI (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];

  if (choice?.finish_reason === 'length') {
    throw new Error(
      'رد الوكيل قُطع قبل اكتماله لبلوغه حد الطول. اختصر الوصف الموجز ثم أعد المحاولة.',
    );
  }

  const text = choice?.message?.content || '';

  const parsed = extractJson(text);
  // حارس المحتوى: إزالة أي إيموجي وتوسيع أي اختصار حكومي
  const clean = sanitizeDeep(parsed, 'ar');
  const issues = checkContent(clean);
  if (issues.length) {
    throw new Error(
      `مخرجات الوكيل خالفت قواعد المحتوى بعد التنظيف: ${issues.map((i) => `${i.field}/${i.rule}`).join(', ')}`,
    );
  }
  return clean;
}

/**
 * التوليد الكامل: عرض سعر + عقد، كلاهما **مسودة** إلزامياً.
 * الخدمة لا تُضاف للكتالوج الآن — تُضاف تلقائياً بعد اعتماد العرض
 * (راجع promoteAgentServiceToCatalog).
 */
export async function generateQuoteAndContract(input: AgentInput, actor = 'admin') {
  const out = await generateServiceContent(input);
  const qty = input.qty && input.qty > 0 ? input.qty : 1;

  const quote = await createQuote(
    {
      clientId: input.clientId,
      titleAr: out.quote.titleAr,
      titleEn: out.quote.titleEn,
      introAr: out.quote.introAr,
      introEn: out.quote.introEn,
      notesAr: out.quote.scopeAr,
      notesEn: out.quote.scopeEn,
      aiGenerated: true,
      aiSourceNote: JSON.stringify({ input, service: out.service, contract: out.contract }),
      items: [
        {
          serviceId: null,
          code: out.service.code,
          nameAr: out.service.nameAr,
          nameEn: out.service.nameEn,
          descAr: out.service.descAr,
          descEn: out.service.descEn,
          qty,
          unitPrice: round2(input.price),
          unitAr: out.service.unitAr,
          unitEn: out.service.unitEn,
          paymentTermsAr: input.paymentTermsAr,
          paymentTermsEn: input.paymentTermsEn || input.paymentTermsAr,
          deliveryAr: input.deliveryAr,
          deliveryEn: input.deliveryEn || input.deliveryAr,
        },
      ],
    },
    'ai-agent',
  );

  const contract = await generateContractFromQuote(quote.id, 'ai-agent');
  // البند الخاص بالخدمة والحيثية يُخزَّنان في العقد كنص إضافي
  await prisma.document.update({
    where: { id: contract.id },
    data: {
      aiGenerated: true,
      aiSourceNote: quote.aiSourceNote,
      notesAr: `${out.contract.recitalAr}\n\n${out.contract.scopeClauseAr}`,
      notesEn: `${out.contract.recitalEn}\n\n${out.contract.scopeClauseEn}`,
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: quote.id,
    clientId: input.clientId,
    code: 'AI_GENERATED',
    titleAr: `ولّد الوكيل الذكي العرض ${quote.number} والعقد ${contract.number} كمسودتين بانتظار الاعتماد`,
    titleEn: `The AI agent generated quotation ${quote.number} and agreement ${contract.number} as drafts awaiting approval`,
    actor,
    actorKind: 'system',
    clientVisible: false,
  });

  return { quote, contract, generated: out };
}

/** بعد الاعتماد: تُضاف الخدمة للكتالوج تلقائياً لإعادة الاستخدام. */
export async function promoteAgentServiceToCatalog(documentId: string, actor = 'admin') {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!doc.aiGenerated || !doc.aiSourceNote) return null;

  let parsed: { service?: AgentOutput['service'] };
  try {
    parsed = JSON.parse(doc.aiSourceNote) as { service?: AgentOutput['service'] };
  } catch {
    return null;
  }
  const svc = parsed.service;
  const item = doc.items[0];
  if (!svc || !item) return null;

  const exists = await prisma.service.findUnique({ where: { code: svc.code } });
  if (exists) return exists;

  const created = await prisma.service.create({
    data: {
      code: svc.code,
      category: 'ai-generated',
      nameAr: svc.nameAr,
      nameEn: svc.nameEn,
      descAr: svc.descAr,
      descEn: svc.descEn,
      unitPrice: item.unitPrice,
      unitAr: svc.unitAr,
      unitEn: svc.unitEn,
      paymentTermsAr: item.paymentTermsAr,
      paymentTermsEn: item.paymentTermsEn,
      deliveryAr: item.deliveryAr,
      deliveryEn: item.deliveryEn,
      aiCreated: true,
      sortOrder: 200,
    },
  });

  await logEvent({
    entityType: 'document',
    entityId: documentId,
    clientId: doc.clientId,
    code: 'SERVICE_PROMOTED',
    titleAr: `أُضيفت الخدمة ${created.code} إلى الكتالوج تلقائياً بعد الاعتماد لإعادة الاستخدام`,
    titleEn: `Service ${created.code} added to the catalogue automatically after approval for reuse`,
    actor,
    actorKind: 'admin',
    clientVisible: false,
  });

  return created;
}
