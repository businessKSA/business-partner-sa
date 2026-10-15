import { workflow, node, trigger, sticky, languageModel, memory, tool, newCredential, ifElse, fromAi, nodeJson, expr } from '@n8n/workflow-sdk';

const SYS =
  'أنت "مُعين" — المساعد الشخصي لباهر بكر مقنص (باللهجة السعودية، طبيعي وودود كأنك جوّ مخّه يريّحه من النسيان والتسويف).\n' +
  'تتحدث دائماً بالعربي، مختصر ومباشر، وتؤكد بجملة قصيرة بعد أي تسجيل. أنت خاص بباهر فقط ولا تخدم عملاء.\n\n' +
  'أدواتك:\n' +
  '- Notion (عبر Notion MCP): اقرأ واكتب في قواعد باهر السبع. استخدم notion-create-pages مع data_source_id الصحيح، وnotion-search / notion-query-data-sources للقراءة، وnotion-update-page للتعديل.\n' +
  '- Gmail: اقرأ ونظّف بريد باهر (استخدم q مثل صيغة بحث جيميل، وحدّد الفترة).\n' +
  '- Google Calendar: أنشئ المواعيد والاجتماعات الزمنية.\n' +
  '- الذاكرة: تتذكر آخر رسائل المحادثة.\n\n' +
  'قواعد نوشن (data_source_id لكل قاعدة + أهم الحقول):\n' +
  '1) المهام 77ba9ef3-f33b-4908-b6d3-622be428ffde — "المهمة"(عنوان), "الحالة"(جديد/قيد التنفيذ/منجز/مؤجل/ملغى), "الأولوية"(عاجل/مهم/عادي/لاحقاً), "الموعد"(تاريخ), "التصنيف", "المصدر", "تذكير", "ملاحظات".\n' +
  '2) الاجتماعات 415ddf85-80c2-473f-b89c-f8d85b076916 — "الاجتماع", "التاريخ", "الحضور", "المكان/الرابط", "الملخص", "الحالة"(قادم/تم/ملغى). نقاط العمل تُسجَّل كمهام.\n' +
  '3) العقارات ae88528f-1ecf-4a1e-ae76-dfc97e2cd47e — "العقار", "النوع", "الغرض"(بيع/إيجار/استثمار/شخصي), "السعر"(رقم), "المساحة م2", "المدينة", "الموقع/الحي", "الحالة", "الوصف". المالك يُربط من جهات الاتصال.\n' +
  '4) جهات الاتصال 729beabb-9361-43dc-bb79-ad21aa0b7e37 — "الاسم", "الجوال", "البريد", "النوع", "الخدمة/المصلحة"(متعدد), "الشركة", "المصدر", "ملاحظات".\n' +
  '5) المصاريف 598de391-12c4-4793-8dbd-5fa4f05381d2 — "البند", "المبلغ"(رقم), "العملة", "التصنيف", "الجهة/المنصة", "التاريخ", "المصدر"(SMS بنك/إيميل شخصي/إيميل شركة/واتساب/يدوي), "الحساب"(شخصي/شركة), "متكرر", "النص الأصلي".\n' +
  '6) الاشتراكات 5e96c111-4484-4c6c-b743-13d1771060e7 — "المنصة", "المبلغ", "العملة", "الدورة"(شهري/سنوي/ربع سنوي/مرة واحدة), "التجديد القادم"(تاريخ), "التصنيف", "الحساب", "الحالة", "طريقة الدفع".\n' +
  '7) الوارد والرموز 9111c167-306d-4962-a687-cdc0753ef176 — "العنوان", "النوع"(OTP/SMS/iMessage/تنبيه بنكي/إشعار), "الكود", "المُرسِل", "النص", "مُعالَج", "ينتهي"(تاريخ).\n\n' +
  'سلوكك حسب نوع الرسالة:\n' +
  '- مهمة/تذكير/"ذكّرني" → أنشئ صفحة في المهام (استنتج الأولوية والموعد)، وإذا لها وقت محدد أنشئ حدثاً في Google Calendar.\n' +
  '- اجتماع/محضر → سجّل في الاجتماعات، وحوّل نقاط العمل إلى مهام، وأنشئ حدث كالندر بالوقت.\n' +
  '- عقار (صورة/وصف: نوع+سعر+موقع) → أنشئ صفحة في العقارات. إن أعطاك مالك/وسيط وجوال أنشئ/حدّث جهة اتصال واربط المصلحة "عقار".\n' +
  '- شخص (اسم + جوال + خدمة/مصلحة) → أنشئ جهة اتصال وصنّف المصلحة صح.\n' +
  '- مصروف/تنبيه بنكي (SMS/إيميل) → استخرج المبلغ والجهة والتاريخ وسجّله في المصاريف بالحساب الصحيح. لو الجهة اشتراك متكرر أنشئ/حدّث صفحة في الاشتراكات بموعد التجديد.\n' +
  '- OTP/رمز → سجّله في الوارد والرموز فقط، ولا ترسله لأي مكان آخر أبداً. أعطِ باهر الرمز في نفس الرد باختصار.\n' +
  '- "نظّف إيميلي / ايش الجديد" → اقرأ عبر Gmail، لخّص، حوّل المهم إلى مهام، والمصاريف إلى قاعدة المصاريف.\n' +
  '- سؤال/طلب معلومة → ابحث في نوشن (والبريد) وأجب من بياناته.\n\n' +
  'قواعد: لا تخترع بيانات؛ إذا نقص شيء اسأل سؤالاً واحداً قصيراً فقط. لا تحذف أو تستبدل صفحات موجودة دون طلب صريح. التاريخ/الوقت بتوقيت الرياض. بعد كل تسجيل قل باختصار وش سجّلت ووين.';

const waIn = trigger({
  type: 'n8n-nodes-base.whatsAppTrigger',
  version: 1,
  config: {
    name: 'Baher WhatsApp In',
    parameters: { updates: ['messages'] },
    credentials: { whatsAppTriggerApi: newCredential('WhatsApp OAuth account 3', '9Lr703bOEkpbIr8d') }
  },
  output: [{ messages: [{ from: '9665XXXXXXXX', type: 'text', text: { body: 'ذكرني بكذا' } }], contacts: [{ profile: { name: 'باهر' } }], metadata: { phone_number_id: '000' } }]
});

const normalize = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'f1', name: 'fromNumber', value: expr('{{ $json.messages[0].from }}'), type: 'string' },
          { id: 'f2', name: 'senderName', value: expr('{{ $json.contacts?.[0]?.profile?.name || "باهر" }}'), type: 'string' },
          { id: 'f3', name: 'msgType', value: expr('{{ $json.messages[0].type }}'), type: 'string' },
          { id: 'f4', name: 'userText', value: expr('{{ $json.messages[0].text?.body || $json.messages[0].image?.caption || $json.messages[0].button?.text || "" }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ fromNumber: '9665XXXXXXXX', senderName: 'باهر', msgType: 'text', userText: 'ذكرني بكذا' }]
});

const ownerOnly = ifElse({
  version: 2.3,
  config: {
    name: 'Owner Only (Baher)',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          { id: 'c1', leftValue: expr('{{ $json.fromNumber }}'), rightValue: 'REPLACE_WITH_BAHER_WHATSAPP_NUMBER', operator: { type: 'string', operation: 'equals' } },
          { id: 'c2', leftValue: expr('{{ $json.msgType }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }
        ]
      }
    }
  },
  output: [{ fromNumber: '9665XXXXXXXX' }]
});

const claude = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Claude Sonnet',
    parameters: { model: { __rl: true, mode: 'list', value: 'claude-sonnet-4-6', cachedResultName: 'Claude Sonnet 4.6' }, options: { maxTokensToSample: 4096 } },
    credentials: { anthropicApi: newCredential('Anthropic account', 'mmbdtwapuZXoY91N') }
  }
});

const chatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Conversation Memory',
    parameters: { sessionIdType: 'customKey', sessionKey: nodeJson(waIn, 'messages.0.from'), contextWindowLength: 20 }
  }
});

const notionTool = tool({
  type: '@n8n/mcp-registry.notion',
  version: 1,
  config: {
    name: 'Notion',
    parameters: { include: 'all', options: { timeout: 60000 } },
    credentials: { notionMcpOAuth2Api: newCredential('Notion MCP OAuth2', 'qUk5IVwo25NaYdnZ') }
  }
});

const gmailReadTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  config: {
    name: 'Read Gmail',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: false,
      limit: 15,
      simple: true,
      filters: {
        q: fromAi('query', 'Gmail search query, Gmail search-box syntax (e.g. newer_than:7d, from:..., subject:...)', 'string'),
        readStatus: 'both'
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail OAuth2 API', '1AQfIiEH6y5Zu61s') }
  }
});

const calendarCreateTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Create Calendar Event',
    parameters: {
      resource: 'event',
      operation: 'create',
      calendar: { __rl: true, mode: 'list', value: 'primary', cachedResultName: 'Primary' },
      start: fromAi('start', 'Event start in ISO 8601 (Asia/Riyadh)', 'string'),
      end: fromAi('end', 'Event end in ISO 8601 (Asia/Riyadh)', 'string'),
      useDefaultReminders: true,
      additionalFields: {
        summary: fromAi('summary', 'Event title', 'string'),
        description: fromAi('description', 'Event details', 'string')
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2 API', 'ucuiwx9hlIuDERcv') }
  }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Muin — Personal Assistant',
    parameters: {
      promptType: 'define',
      text: expr('رسالة من باهر (الاسم: {{ $json.senderName }} · الوقت: {{ $now.setZone("Asia/Riyadh").toFormat("yyyy-MM-dd HH:mm") }} · النوع: {{ $json.msgType }}):\n\n{{ $json.userText }}'),
      options: { systemMessage: SYS, maxIterations: 12 }
    },
    subnodes: { model: claude, memory: chatMemory, tools: [notionTool, gmailReadTool, calendarCreateTool] }
  },
  output: [{ output: 'سجّلت المهمة ✅' }]
});

const reply = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'Reply to Baher',
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: expr('{{ $("Baher WhatsApp In").item.json.metadata.phone_number_id }}'),
      recipientPhoneNumber: expr('{{ $("Baher WhatsApp In").item.json.messages[0].from }}'),
      messageType: 'text',
      textBody: expr('{{ $json.output }}')
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account', 'dPP94SCEPI6Qz1nx') }
  },
  output: [{ messaging_product: 'whatsapp' }]
});

const noteOverview = sticky(
  '## 🧠 مُعين — مساعد باهر الشخصي\n\nواتساب (باهر فقط) → Claude → نوشن (٧ قواعد عبر Notion MCP) + جيميل + كالندر + ذاكرة → رد على واتساب.\n\nقبل التشغيل: عدّل Owner Only وضع رقم باهر بدل REPLACE_WITH_BAHER_WHATSAPP_NUMBER، وتأكد من ربط الاعتمادات.',
  [waIn, agent],
  { color: 4 }
);

export default workflow('baher-personal-assistant', '🧠 مُعين — مساعد باهر الشخصي (WhatsApp)')
  .add(noteOverview)
  .add(waIn)
  .to(normalize)
  .to(ownerOnly.onTrue(agent.to(reply)));
