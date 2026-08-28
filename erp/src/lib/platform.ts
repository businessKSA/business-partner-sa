/**
 * حراسة لوحة المنصة.
 *
 * تعيش هنا لا في ملف `'use server'` لسببٍ أمني لا تنظيمي: كل دالة مُصدَّرة
 * من ملف إجراءات الخادم تصير نقطةَ استدعاءٍ عبر الشبكة يبلغها أيّ متصفّح.
 * ودالةٌ تُعيد كائن الجلسة — بريد المستخدم ومنشأته وصلاحياته — لا يجوز أن
 * تكون كذلك. الاستدعاء المباشر من مكوّنات الخادم هو ما نريده، وهذا الملف
 * يحقّقه.
 */
import { currentSession, type SessionUser } from './auth.ts';
import { DomainError, PermissionError } from './errors.ts';

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const session = await currentSession();
  if (!session) throw new DomainError('الجلسة منتهية. سجّل الدخول من جديد.', 'UNAUTHENTICATED');
  if (!session.isPlatformAdmin) throw new PermissionError('إدارة المنصة');
  return session;
}
