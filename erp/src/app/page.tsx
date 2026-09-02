import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth.ts';

export default async function Home() {
  const session = await currentSession();
  redirect(session ? '/dashboard' : '/login');
}
