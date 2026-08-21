import { prisma } from './db';
import { NUMBER_PREFIX } from '../../config/company';

/** عائلة الكود: FI-100 -> FI ، PKG-G -> PKG ، REV-GROWTH -> REV */
export function codeFamily(code: string | null | undefined): string {
  if (!code) return 'GEN';
  const head = code.trim().toUpperCase().split('-')[0];
  return /^[A-Z]{2,5}$/.test(head) ? head : 'GEN';
}

async function nextInScope(scope: string): Promise<number> {
  const row = await prisma.counter.upsert({
    where: { id: scope },
    create: { id: scope, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/**
 * ترقيم المستندات: BP-<عائلة الكود>-<السنة>-<رقم>  مثال BP-FI-2026-001
 * العدّاد مشترك بين العرض والعقد لنفس العائلة والسنة حتى لا يتكرر رقم.
 */
export async function nextDocumentNumber(family: string, year = new Date().getUTCFullYear()) {
  const fam = codeFamily(family);
  const n = await nextInScope(`DOC:${fam}:${year}`);
  return `${NUMBER_PREFIX}-${fam}-${year}-${String(n).padStart(3, '0')}`;
}

export async function nextInvoiceNumber(year = new Date().getUTCFullYear()) {
  const n = await nextInScope(`INV:${year}`);
  return `INV-${year}-${String(n).padStart(3, '0')}`;
}

export async function nextSupplyRequestNumber(year = new Date().getUTCFullYear()) {
  const n = await nextInScope(`SR:${year}`);
  return `SR-${year}-${String(n).padStart(3, '0')}`;
}
