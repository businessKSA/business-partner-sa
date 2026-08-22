/**
 * نموذج العرض الموحّد للمستند — يُستخدم للصفحة العامة وللـPDF معاً
 * حتى يكون الـPDF مطابقاً للصفحة حرفياً.
 */
import { prisma } from './db';
import { COMPANY } from '../../config/company';
import { loadTemplate, renderDeep } from './templates';
import { fmtMoney, fmtDate } from './money';

export interface Bi {
  ar: string;
  en: string;
}

export interface RenderItem {
  code: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unitAr: string;
  unitEn: string;
  paymentTermsAr: string;
  paymentTermsEn: string;
  deliveryAr: string;
  deliveryEn: string;
}

export interface GovFeeRow {
  labelAr: string;
  labelEn: string;
  amount: number | null;
  amountNoteAr: string | null;
  amountNoteEn: string | null;
  included: boolean;
}

export interface ContractClause {
  key: string;
  title: Bi;
  body: Bi;
  renderItemsTable?: boolean;
}

export interface DocModel {
  id: string;
  type: string;
  number: string;
  status: string;
  titleAr: string;
  titleEn: string;
  introAr: string | null;
  introEn: string | null;
  notesAr: string | null;
  notesEn: string | null;
  issuedAt: Date;
  validUntil: Date | null;
  acceptedAt: Date | null;
  acceptedByName: string | null;
  signedAt: Date | null;
  publicToken: string;
  sourceNumber: string | null;
  client: {
    nameAr: string;
    nameEn: string | null;
    companyAr: string | null;
    companyEn: string | null;
    crNumber: string | null;
    vatNumber: string | null;
    email: string;
    phone: string;
    addressAr: string | null;
    addressEn: string | null;
    country: string;
    repName: string | null;
    repTitle: string | null;
  };
  items: RenderItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  govFees: GovFeeRow[];
  govFeesTitle: Bi | null;
  govFeesNote: Bi | null;
  quoteTerms: Bi[];
  quoteSections: Record<string, Bi>;
  quoteAcceptanceNote: Bi | null;
  contract: {
    preamble: Bi;
    recitalsTitle: Bi;
    recitals: Bi[];
    clauses: ContractClause[];
    partyFirstLabel: Bi;
    partySecondLabel: Bi;
    partyFirstRole: Bi;
    partySecondRole: Bi;
    signatureTitle: Bi;
    signatureNote: Bi;
    feeAppendixTitle: Bi;
    govAppendixTitle: Bi;
  } | null;
}

interface QuoteTpl {
  docTitle: Bi;
  sections: Record<string, Bi>;
  terms: Bi[];
  acceptanceNote: Bi;
  govFeesTitle: Bi;
}

interface ContractTpl {
  preamble: Bi;
  recitalsTitle: Bi;
  recitals: Bi[];
  clauses: ContractClause[];
  partyFirstLabel: Bi;
  partySecondLabel: Bi;
  partyFirstRole: Bi;
  partySecondRole: Bi;
  signatureTitle: Bi;
  signatureNote: Bi;
  feeAppendixTitle: Bi;
  govAppendixTitle: Bi;
  govAppendixNote: Bi;
}

export async function buildDocModel(documentId: string): Promise<DocModel | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      sourceQuote: { select: { number: true } },
    },
  });
  if (!doc) return null;

  const govFees = doc.includeGovFees
    ? await prisma.govFee.findMany({
        where: { group: doc.govFeeGroup ?? 'foreign-investment' },
        orderBy: { sortOrder: 'asc' },
      })
    : [];

  const vars = {
    contractDate: fmtDate(doc.issuedAt, 'ar'),
    contractDateEn: fmtDate(doc.issuedAt, 'en'),
    validUntil: fmtDate(doc.validUntil, 'ar'),
    number: doc.number,
    subtotal: fmtMoney(doc.subtotal),
    vatAmount: fmtMoney(doc.vatAmount),
    total: fmtMoney(doc.total),
    bankName: COMPANY.bank.name.ar,
    bankBeneficiary: COMPANY.bank.beneficiary.ar,
    bankAccount: COMPANY.bank.account,
    bankIban: COMPANY.bank.iban,
    clientName: doc.client.companyAr || doc.client.nameAr,
  };

  const quoteTpl = renderDeep(loadTemplate<QuoteTpl>('quote.json'), vars);
  const isContract = doc.type !== 'QUOTE';
  const contractTplRaw = isContract ? loadTemplate<ContractTpl>('contract.json') : null;
  // التاريخ في ديباجة العقد يختلف بين اللغتين
  const contractTpl = contractTplRaw
    ? {
        ...renderDeep(contractTplRaw, vars),
        preamble: {
          ar: renderDeep(contractTplRaw.preamble.ar, vars),
          en: renderDeep(contractTplRaw.preamble.en, { ...vars, contractDate: vars.contractDateEn }),
        },
      }
    : null;

  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    status: doc.status,
    titleAr: doc.titleAr,
    titleEn: doc.titleEn,
    introAr: doc.introAr,
    introEn: doc.introEn,
    notesAr: doc.notesAr,
    notesEn: doc.notesEn,
    issuedAt: doc.issuedAt,
    validUntil: doc.validUntil,
    acceptedAt: doc.acceptedAt,
    acceptedByName: doc.acceptedByName,
    signedAt: doc.signedAt,
    publicToken: doc.publicToken,
    sourceNumber: doc.sourceQuote?.number ?? null,
    client: {
      nameAr: doc.client.nameAr,
      nameEn: doc.client.nameEn,
      companyAr: doc.client.companyAr,
      companyEn: doc.client.companyEn,
      crNumber: doc.client.crNumber,
      vatNumber: doc.client.vatNumber,
      email: doc.client.email,
      phone: doc.client.phone,
      addressAr: doc.client.addressAr,
      addressEn: doc.client.addressEn,
      country: doc.client.country,
      repName: doc.client.repName,
      repTitle: doc.client.repTitle,
    },
    items: doc.items.map((i) => ({
      code: i.code,
      nameAr: i.nameAr,
      nameEn: i.nameEn,
      descAr: i.descAr,
      descEn: i.descEn,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      unitAr: i.unitAr,
      unitEn: i.unitEn,
      paymentTermsAr: i.paymentTermsAr,
      paymentTermsEn: i.paymentTermsEn,
      deliveryAr: i.deliveryAr,
      deliveryEn: i.deliveryEn,
    })),
    subtotal: doc.subtotal,
    vatRate: doc.vatRate,
    vatAmount: doc.vatAmount,
    total: doc.total,
    govFees: govFees.map((g) => ({
      labelAr: g.labelAr,
      labelEn: g.labelEn,
      amount: g.amount,
      amountNoteAr: g.amountNoteAr,
      amountNoteEn: g.amountNoteEn,
      included: g.included,
    })),
    govFeesTitle: isContract ? (contractTpl?.govAppendixTitle ?? null) : quoteTpl.govFeesTitle,
    govFeesNote: contractTplRaw?.govAppendixNote ?? {
      ar: 'الرسوم أدناه تقديرية وصادرة عن الجهات الحكومية المختصة، وهي مستثناة من أتعاب الشركة وتُسدَّد للجهات مباشرة بالتكلفة الفعلية.',
      en: 'The fees below are estimates set by the competent government authorities. They are excluded from the Company fees and are paid directly to those authorities at actual cost.',
    },
    quoteTerms: quoteTpl.terms,
    quoteSections: quoteTpl.sections,
    quoteAcceptanceNote: quoteTpl.acceptanceNote,
    contract: contractTpl
      ? {
          preamble: contractTpl.preamble,
          recitalsTitle: contractTpl.recitalsTitle,
          recitals: contractTpl.recitals,
          clauses: contractTpl.clauses,
          partyFirstLabel: contractTpl.partyFirstLabel,
          partySecondLabel: contractTpl.partySecondLabel,
          partyFirstRole: contractTpl.partyFirstRole,
          partySecondRole: contractTpl.partySecondRole,
          signatureTitle: contractTpl.signatureTitle,
          signatureNote: contractTpl.signatureNote,
          feeAppendixTitle: contractTpl.feeAppendixTitle,
          govAppendixTitle: contractTpl.govAppendixTitle,
        }
      : null,
  };
}
