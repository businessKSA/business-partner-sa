import { guardAdmin } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { agentReady, agentModel } from '@/lib/agent';
import AgentForm from './AgentForm';

export const dynamic = 'force-dynamic';

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await guardAdmin();
  const sp = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <>
      <h1>الوكيل الذكي — خدمة جديدة غير مكتلجة</h1>
      <p className="sub">
        أدخل الحد الأدنى من المعلومات، ويولّد الوكيل عرض السعر والعقد كاملين تلقائياً بنفس القوالب المعتمدة.
        كل ما يولّده يُحفَظ مسودة إلزامياً ولا يُرسَل قبل مراجعتك واعتمادك.
      </p>
      {!agentReady() ? (
        <div className="notice bad">
          متغيرات AZURE_OPENAI_ENDPOINT وAZURE_OPENAI_API_KEY وAZURE_OPENAI_DEPLOYMENT غير مضبوطة — الوكيل غير مفعّل. اضبطها في بيئة التشغيل ثم أعد المحاولة.
          بقية النظام يعمل بشكل طبيعي.
        </div>
      ) : (
        <div className="notice">النموذج المستخدم: <span className="mono">{agentModel()}</span></div>
      )}
      <AgentForm
        ready={agentReady()}
        preselected={sp.client ?? ''}
        clients={clients.map((c) => ({ id: c.id, label: `${c.companyAr || c.nameAr} — ${c.email}` }))}
      />
    </>
  );
}
