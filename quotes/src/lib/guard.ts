import { redirect } from 'next/navigation';
import { currentAdmin, currentClientId } from './auth';

/** حارس صفحات لوحة التحكم — يُستدعى في أعلى كل صفحة محمية. */
export async function guardAdmin(): Promise<string> {
  const email = await currentAdmin();
  if (!email) redirect('/admin/login');
  return email;
}

/** حارس بوابة العميل. */
export async function guardClient(): Promise<string> {
  const id = await currentClientId();
  if (!id) redirect('/portal/login');
  return id;
}
