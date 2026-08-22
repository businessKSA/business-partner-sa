import { guardClient } from '@/lib/guard';
import { prisma } from '@/lib/db';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

/**
 * بيانات المنشأة يكتبها العميل بنفسه.
 *
 * أدق مصدر لبيانات العميل هو العميل: السجل التجاري والرقم الضريبي والعنوان
 * الوطني تُطبع على الفاتورة الضريبية، وخطأ في أيٍّ منها يجعلها غير مطابقة.
 * البريد غير قابل للتعديل هنا لأنه مفتاح الدخول إلى هذه البوابة.
 */
export default async function ProfilePage() {
  const clientId = await guardClient();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  return (
    <>
      <h1>بيانات منشأتي</h1>
      <p className="sub">
        هذه البيانات تُطبع في عروض الأسعار والعقود والفواتير الضريبية الصادرة لك.
        السجل التجاري والرقم الضريبي والعنوان الوطني مطلوبة لتكون الفاتورة مطابقة
        لمتطلبات هيئة الزكاة والضريبة والجمارك.
      </p>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12.5 }}>البريد الإلكتروني المسجّل — لا يُعدّل من هنا لأنه مفتاح دخولك</div>
        <div dir="ltr" style={{ textAlign: 'left' }}>{client.email}</div>
      </div>
      <ProfileForm profile={client} />
    </>
  );
}
