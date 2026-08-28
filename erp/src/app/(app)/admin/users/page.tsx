import { requireAuth } from '@/lib/auth.ts';
import { withoutTenant, withTenant } from '@/lib/db.ts';
import { PageHead } from '@/components/page-head.tsx';
import { Card, DateText, Empty } from '@/components/ui.tsx';
import { PERMISSIONS } from '@/lib/rbac.ts';

export default async function UsersPage() {
  const session = await requireAuth('admin.user.read');

  const members = await withoutTenant(
    'عرض أعضاء المنشأة: جدول المستخدمين عالمي لأن الحساب الواحد قد يخدم عدة منشآت',
    (tx) => tx.membership.findMany({
      where: { tenantId: session.tenantId },
      include: { user: true, role: true },
      orderBy: { createdAt: 'asc' },
    }),
  );

  const roles = await withTenant(session.tenantId, (tx) =>
    tx.role.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { memberships: true } } },
      orderBy: { code: 'asc' },
    }),
  );

  const totalPerms = Object.keys(PERMISSIONS).length;

  return (
    <>
      <PageHead title="المستخدمون والأدوار" sub={`${members.length} مستخدماً · ${roles.length} أدوار`} />

      <div className="content">
        <Card title="المستخدمون" flush>
          {members.length === 0 ? (
            <Empty title="لا مستخدمون" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th style={{ width: 260 }}>البريد</th>
                    <th style={{ width: 150 }}>الدور</th>
                    <th style={{ width: 130 }}>آخر دخول</th>
                    <th style={{ width: 100 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.user.name}</td>
                      <td className="mono small" dir="ltr" style={{ textAlign: 'left' }}>
                        {m.user.email}
                      </td>
                      <td>{m.role.nameAr}</td>
                      <td><DateText value={m.user.lastLoginAt} /></td>
                      <td>
                        <span className={`badge ${m.active && m.user.active ? 'ok' : 'mute'}`}>
                          {m.active && m.user.active ? 'نشط' : 'معطَّل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="الأدوار"
          hint="الفصل بين الإنشاء والترحيل والاعتماد ليس تعقيداً إدارياً: هو ما يمنع أن يُنشئ شخصٌ واحدٌ فاتورةً ويرحّلها ويقبض قيمتها بلا عينٍ ثانية."
          flush
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>الرمز</th>
                  <th>الاسم</th>
                  <th className="num" style={{ width: 110 }}>الصلاحيات</th>
                  <th className="num" style={{ width: 100 }}>المستخدمون</th>
                  <th style={{ width: 100 }}>النوع</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const perms = (r.permissions as string[]) ?? [];
                  const count = perms.includes('*')
                    ? totalPerms
                    : perms.reduce((n, p) => {
                        if (p.endsWith('.*')) {
                          const prefix = p.slice(0, -1);
                          return n + Object.keys(PERMISSIONS).filter((k) => k.startsWith(prefix)).length;
                        }
                        return n + 1;
                      }, 0);
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.code}</td>
                      <td>{r.nameAr}<div className="muted small">{r.nameEn}</div></td>
                      <td className="num">{count} من {totalPerms}</td>
                      <td className="num">{r._count.memberships}</td>
                      <td>
                        <span className={`badge ${r.isSystem ? 'info' : 'mute'}`}>
                          {r.isSystem ? 'دور نظام' : 'مخصَّص'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
