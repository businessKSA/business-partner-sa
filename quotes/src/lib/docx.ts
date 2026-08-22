/**
 * تصدير المستند بصيغة DOCX من نفس نموذج العرض الذي يغذّي الصفحة والـPDF،
 * فتبقى الصيغ الثلاث متطابقة المحتوى.
 *
 * العربية في DOCX تحتاج ثلاثة أشياء معاً وإلا خرجت مقلوبة:
 *   bidirectional على الفقرة  ·  rightToLeft على النص  ·  اتجاه الجدول
 * الأعمدة المتقابلة تُبنى كجداول بعمودين: الإنجليزي يسار والعربي يمين.
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, VerticalAlign, ShadingType,
} from 'docx';
import { COMPANY } from '../../config/company';
import { buildDocModel, type DocModel, type Bi } from './doc-model';
import { fmtMoney, fmtQty, fmtDate } from './money';
import { prisma } from './db';
import { storage, fileKey, clientFolderPath } from './storage';

const NAVY = '0B1B5A';
const INK = '1F2430';
const MUTED = '5B6172';
const LINE = 'D9DDE7';
const WASH = 'F5F7FB';
const AR_FONT = 'Tajawal';
const EN_FONT = 'Inter';

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE } as const;
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };

/** فقرة عربية: RTL كامل على الفقرة وعلى النص معاً. */
function ar(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.align ?? AlignmentType.RIGHT,
    spacing: { after: 60 },
    children: (text || '').split('\n').flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        rightToLeft: true,
        font: AR_FONT,
        size: (opts.size ?? 10) * 2,
        bold: opts.bold,
        color: opts.color ?? INK,
      }),
    ]),
  });
}

function en(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({
    bidirectional: false,
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    children: (text || '').split('\n').flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        font: EN_FONT,
        size: (opts.size ?? 9.5) * 2,
        bold: opts.bold,
        color: opts.color ?? INK,
      }),
    ]),
  });
}

function cell(children: Paragraph[], opts: { shade?: string; width?: number } = {}) {
  return new TableCell({
    children,
    borders: cellBorders,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    ...(opts.width ? { width: { size: opts.width, type: WidthType.PERCENTAGE } } : {}),
    ...(opts.shade ? { shading: { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } } : {}),
  });
}

/** صف عنوان القسم — شريط كحلي بعمودين. */
function sectionBar(t: Bi) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // اتجاه الجدول من اليمين لليسار ليقع العمود العربي يميناً
    visuallyRightToLeft: true,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          cell([ar(t.ar, { bold: true, color: 'FFFFFF', size: 10.5 })], { shade: NAVY, width: 50 }),
          cell([en(t.en, { bold: true, color: 'FFFFFF', size: 10 })], { shade: NAVY, width: 50 }),
        ],
      }),
    ],
  });
}

/** كتلة ثنائية اللغة — عمودان متقابلان. */
function biBlock(a: string, e: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: [
          cell([ar(a)], { width: 50 }),
          cell([en(e)], { width: 50 }),
        ],
      }),
    ],
  });
}

function spacer(h = 120) {
  return new Paragraph({ spacing: { after: h }, children: [] });
}

function itemsTable(d: DocModel) {
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell([ar('م', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER })], { shade: WASH, width: 5 }),
      cell([ar('الخدمة والوصف', { bold: true, size: 8.5, color: NAVY }), en('Service and description', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 38 }),
      cell([ar('الكمية', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER }), en('Qty', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 9 }),
      cell([ar('سعر الوحدة', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER }), en('Unit price', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 13 }),
      cell([ar('الإجمالي', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER }), en('Line total', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 13 }),
      cell([ar('شروط الدفع ومدة التنفيذ', { bold: true, size: 8.5, color: NAVY }), en('Payment and delivery', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 22 }),
    ],
  });

  const rows = d.items.map((it, i) =>
    new TableRow({
      children: [
        cell([ar(String(i + 1), { size: 9, align: AlignmentType.CENTER })], { width: 5 }),
        cell([
          ar(it.nameAr, { bold: true, size: 9.5 }),
          ...(it.descAr ? [ar(it.descAr, { size: 8.5, color: MUTED })] : []),
          en(it.nameEn, { bold: true, size: 9 }),
          ...(it.descEn ? [en(it.descEn, { size: 8, color: MUTED })] : []),
          en(it.code, { size: 7.5, color: MUTED }),
        ], { width: 38 }),
        cell([ar(`${fmtQty(it.qty)} ${it.unitAr}`, { size: 9, align: AlignmentType.CENTER })], { width: 9 }),
        cell([en(fmtMoney(it.unitPrice), { size: 9 })], { width: 13 }),
        cell([en(fmtMoney(it.lineTotal), { size: 9 })], { width: 13 }),
        cell([
          ar(it.paymentTermsAr, { size: 8.5 }),
          ...(it.deliveryAr ? [ar(`مدة التنفيذ: ${it.deliveryAr}`, { size: 8.5 })] : []),
          en(it.paymentTermsEn, { size: 8, color: MUTED }),
          ...(it.deliveryEn ? [en(`Delivery: ${it.deliveryEn}`, { size: 8, color: MUTED })] : []),
        ], { width: 22 }),
      ],
    }),
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: [head, ...rows] });
}

function totalsTable(d: DocModel) {
  const line = (arLabel: string, enLabel: string, value: string, grand = false) =>
    new TableRow({
      children: [
        cell([
          ar(arLabel, { bold: grand, size: 9.5, color: grand ? 'FFFFFF' : INK }),
          en(enLabel, { size: 8, color: grand ? 'D6DEF7' : MUTED }),
        ], { shade: grand ? NAVY : undefined, width: 68 }),
        cell([en(value, { bold: grand, size: 10, color: grand ? 'FFFFFF' : INK })], { shade: grand ? NAVY : undefined, width: 32 }),
      ],
    });

  return new Table({
    width: { size: 62, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    visuallyRightToLeft: true,
    rows: [
      line('المجموع غير شامل ضريبة القيمة المضافة', 'Subtotal excluding VAT', fmtMoney(d.subtotal)),
      line(`ضريبة القيمة المضافة ${Math.round(d.vatRate * 100)}%`, `Value added tax ${Math.round(d.vatRate * 100)}%`, fmtMoney(d.vatAmount)),
      line('الإجمالي شامل ضريبة القيمة المضافة', 'Total including VAT', `${fmtMoney(d.total)} SAR`, true),
    ],
  });
}

function govFeesTable(d: DocModel) {
  if (!d.govFees.length || !d.govFeesTitle) return [];
  const head = new TableRow({
    tableHeader: true,
    children: [
      cell([ar('م', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER })], { shade: WASH, width: 6 }),
      cell([ar('البند', { bold: true, size: 8.5, color: NAVY }), en('Item', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 64 }),
      cell([ar('الرسم المقدّر (ريال)', { bold: true, size: 8.5, color: NAVY, align: AlignmentType.CENTER }), en('Estimated fee (SAR)', { bold: true, size: 8, color: NAVY })], { shade: WASH, width: 30 }),
    ],
  });
  const rows = d.govFees.map((g, i) =>
    new TableRow({
      children: [
        cell([ar(String(i + 1), { size: 9, align: AlignmentType.CENTER })], { width: 6 }),
        cell([ar(g.labelAr, { size: 9 }), en(g.labelEn, { size: 8, color: MUTED })], { width: 64 }),
        cell([
          ar(g.amount === null ? (g.amountNoteAr ?? 'بدون رسوم') : fmtMoney(g.amount), { size: 9, align: AlignmentType.CENTER }),
          ...(g.amount !== null && g.amountNoteAr ? [ar(g.amountNoteAr, { size: 7.5, color: MUTED, align: AlignmentType.CENTER })] : []),
        ], { width: 30 }),
      ],
    }),
  );

  return [
    new Paragraph({ pageBreakBefore: true, children: [] }),
    sectionBar(d.govFeesTitle),
    ...(d.govFeesNote ? [biBlock(d.govFeesNote.ar, d.govFeesNote.en)] : []),
    spacer(),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: [head, ...rows] }),
  ];
}

function header(d: DocModel) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: true,
      borders: { top: noBorder, bottom: thin, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
      rows: [
        new TableRow({
          children: [
            cell([
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'BUSINESS PARTNER', font: EN_FONT, size: 26, bold: true, color: NAVY })],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'PARTNERING FOR YOUR SUCCESS', font: EN_FONT, size: 12, color: NAVY, characterSpacing: 60 })],
              }),
            ], { width: 42 }),
            cell([
              ar(COMPANY.legalName.ar, { size: 8 }),
              en(COMPANY.legalName.en, { size: 7.5 }),
              en(`CR ${COMPANY.crNumber} — VAT ${COMPANY.vatNumber}`, { size: 7.5, color: MUTED }),
              ar(COMPANY.address.ar, { size: 7.5, color: MUTED }),
              en(`${COMPANY.phoneDisplay} — ${COMPANY.email} — ${COMPANY.website}`, { size: 7.5, color: MUTED }),
            ], { width: 58 }),
          ],
        }),
      ],
    }),
    spacer(200),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      children: [new TextRun({ text: d.titleAr, rightToLeft: true, font: AR_FONT, size: 28, bold: true, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: d.titleEn, font: EN_FONT, size: 22, bold: true, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: `${d.number} — ${fmtDate(d.issuedAt, 'en')}${d.validUntil && d.type === 'QUOTE' ? ` — valid until ${fmtDate(d.validUntil, 'en')}` : ''}${d.sourceNumber ? ` — issued from quotation ${d.sourceNumber}` : ''}`,
        font: EN_FONT, size: 17, color: MUTED,
      })],
    }),
  ];
}

function bankBlock() {
  return biBlock(
    `المصرف: ${COMPANY.bank.name.ar}\nاسم المستفيد: ${COMPANY.bank.beneficiary.ar}\nرقم الحساب: ${COMPANY.bank.account}\nالآيبان: ${COMPANY.bank.iban}`,
    `Bank: ${COMPANY.bank.name.en}\nBeneficiary: ${COMPANY.bank.beneficiary.en}\nAccount number: ${COMPANY.bank.account}\nIBAN: ${COMPANY.bank.iban}`,
  );
}

function signatures(d: DocModel) {
  const c = d.client;
  const ct = d.contract!;
  const box = (roleAr: string, roleEn: string, whoAr: string, whoEn: string, repAr: string, repEn: string, sigAnchor: string, dateAnchor: string) =>
    cell([
      ar(`${roleAr}`, { size: 8, color: MUTED }),
      en(`${roleEn}`, { size: 7.5, color: MUTED }),
      ar(whoAr, { bold: true, size: 9.5, color: NAVY }),
      en(whoEn, { size: 8, color: MUTED }),
      ...(repAr ? [ar(repAr, { bold: true, size: 9, color: NAVY })] : []),
      ...(repEn ? [en(repEn, { size: 8, color: MUTED })] : []),
      spacer(300),
      ar('التوقيع / Signature', { size: 8, color: MUTED }),
      // علامة ربط DocuSign — بيضاء فلا تُرى، ومعزولة في فقرة مستقلة
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: sigAnchor, font: EN_FONT, size: 12, color: 'FFFFFF' })] }),
      ar('التاريخ / Date', { size: 8, color: MUTED }),
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: dateAnchor, font: EN_FONT, size: 12, color: 'FFFFFF' })] }),
    ], { width: 50 });

  return [
    sectionBar(ct.signatureTitle),
    biBlock(ct.signatureNote.ar, ct.signatureNote.en),
    spacer(),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: true,
      rows: [
        new TableRow({
          children: [
            box(`${ct.partyFirstLabel.ar} — ${ct.partyFirstRole.ar}`, `${ct.partyFirstLabel.en} — ${ct.partyFirstRole.en}`,
              COMPANY.legalName.ar, COMPANY.legalName.en,
              `${COMPANY.representative.name.ar} — ${COMPANY.representative.title.ar}`,
              `${COMPANY.representative.name.en} — ${COMPANY.representative.title.en}`,
              '/sig_bp/', '/date_bp/'),
            box(`${ct.partySecondLabel.ar} — ${ct.partySecondRole.ar}`, `${ct.partySecondLabel.en} — ${ct.partySecondRole.en}`,
              c.companyAr || c.nameAr, c.companyEn || c.nameEn || '',
              c.repName ? `${c.repName}${c.repTitle ? ` — ${c.repTitle}` : ''}` : '', '',
              '/sig_client/', '/date_client/'),
          ],
        }),
      ],
    }),
  ];
}

export async function buildDocx(documentId: string): Promise<Buffer> {
  const d = await buildDocModel(documentId);
  if (!d) throw new Error('مستند غير موجود');
  const isContract = d.type !== 'QUOTE';
  const S = d.quoteSections;
  const body: (Paragraph | Table)[] = [...header(d)];

  if (!isContract) {
    body.push(sectionBar(S.to));
    body.push(biBlock(
      `${d.client.companyAr || d.client.nameAr}${d.client.repName ? `\nعناية: ${d.client.repName}` : ''}${d.client.crNumber ? `\nالسجل التجاري: ${d.client.crNumber}` : ''}\n${d.client.email} — ${d.client.phone}`,
      `${d.client.companyEn || d.client.nameEn || d.client.nameAr}${d.client.repName ? `\nAttention: ${d.client.repName}` : ''}${d.client.crNumber ? `\nCommercial registration: ${d.client.crNumber}` : ''}\n${d.client.email} — ${d.client.phone}`,
    ));
    body.push(spacer());
    body.push(sectionBar(S.subject));
    body.push(biBlock(d.introAr || d.titleAr, d.introEn || d.titleEn));
    body.push(spacer());
    body.push(sectionBar(S.pricing));
    body.push(spacer(80));
    body.push(itemsTable(d));
    body.push(spacer());
    body.push(totalsTable(d));
    body.push(spacer());
    body.push(ar('الرسوم الحكومية مستثناة دائماً وتُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.', { size: 8.5, color: MUTED }));
    body.push(en('Government fees are always excluded and are paid directly to the competent authorities at actual cost.', { size: 8, color: MUTED }));
    if (d.notesAr || d.notesEn) {
      body.push(spacer());
      body.push(sectionBar(S.scope));
      body.push(biBlock(d.notesAr || '', d.notesEn || ''));
    }
    body.push(spacer());
    body.push(sectionBar(S.bank));
    body.push(bankBlock());
    body.push(spacer());
    body.push(sectionBar(S.terms));
    body.push(biBlock(
      d.quoteTerms.map((t, i) => `${i + 1}. ${t.ar}`).join('\n'),
      d.quoteTerms.map((t, i) => `${i + 1}. ${t.en}`).join('\n'),
    ));
    if (d.quoteAcceptanceNote) {
      body.push(spacer());
      body.push(sectionBar(S.acceptance));
      body.push(biBlock(d.quoteAcceptanceNote.ar, d.quoteAcceptanceNote.en));
    }
  } else {
    const ct = d.contract!;
    body.push(biBlock(ct.preamble.ar, ct.preamble.en));
    body.push(spacer());
    body.push(biBlock(
      `${ct.partyFirstLabel.ar} — ${ct.partyFirstRole.ar}\n${COMPANY.legalName.ar}\nالسجل التجاري: ${COMPANY.crNumber}\nالرقم الضريبي: ${COMPANY.vatNumber}\n${COMPANY.address.ar}\nويمثلها: ${COMPANY.representative.name.ar} — ${COMPANY.representative.title.ar}`,
      `${ct.partyFirstLabel.en} — ${ct.partyFirstRole.en}\n${COMPANY.legalName.en}\nCommercial registration: ${COMPANY.crNumber}\nVAT: ${COMPANY.vatNumber}\n${COMPANY.address.en}\nRepresented by: ${COMPANY.representative.name.en} — ${COMPANY.representative.title.en}`,
    ));
    body.push(biBlock(
      `${ct.partySecondLabel.ar} — ${ct.partySecondRole.ar}\n${d.client.companyAr || d.client.nameAr}${d.client.crNumber ? `\nالسجل التجاري: ${d.client.crNumber}` : ''}${d.client.repName ? `\nويمثله: ${d.client.repName}${d.client.repTitle ? ` — ${d.client.repTitle}` : ''}` : ''}\n${d.client.email} — ${d.client.phone}`,
      `${ct.partySecondLabel.en} — ${ct.partySecondRole.en}\n${d.client.companyEn || d.client.nameEn || d.client.nameAr}${d.client.crNumber ? `\nCommercial registration: ${d.client.crNumber}` : ''}${d.client.repName ? `\nRepresented by: ${d.client.repName}${d.client.repTitle ? ` — ${d.client.repTitle}` : ''}` : ''}\n${d.client.email} — ${d.client.phone}`,
    ));
    body.push(spacer());
    body.push(sectionBar(ct.recitalsTitle));
    body.push(biBlock(ct.recitals.map((r) => r.ar).join('\n'), ct.recitals.map((r) => r.en).join('\n')));

    ct.clauses.forEach((cl, idx) => {
      body.push(spacer());
      body.push(sectionBar({ ar: `البند (${idx + 1}) — ${cl.title.ar}`, en: `Clause (${idx + 1}) — ${cl.title.en}` }));
      body.push(biBlock(cl.body.ar, cl.body.en));
      if (cl.renderItemsTable) {
        body.push(spacer(80));
        body.push(itemsTable(d));
        body.push(spacer());
        body.push(totalsTable(d));
      }
    });

    if (d.notesAr || d.notesEn) {
      body.push(spacer());
      body.push(biBlock(d.notesAr || '', d.notesEn || ''));
    }
    body.push(spacer(240));
    body.push(...signatures(d));
    body.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    body.push(sectionBar(ct.feeAppendixTitle));
    body.push(spacer(80));
    body.push(itemsTable(d));
    body.push(spacer());
    body.push(totalsTable(d));
    body.push(spacer());
    body.push(bankBlock());
  }

  body.push(...govFeesTable(d));

  const doc = new Document({
    creator: COMPANY.legalName.en,
    title: `${d.number} — ${d.titleEn}`,
    description: d.titleAr,
    styles: { default: { document: { run: { font: AR_FONT, size: 20, color: INK } } } },
    sections: [{
      properties: {
        page: { margin: { top: 800, right: 700, bottom: 900, left: 700 } },
      },
      children: body,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

/** يولّد الـDOCX ويؤرشفه في مجلد العميل الصحيح. */
export async function buildAndArchiveDocx(documentId: string): Promise<{ buffer: Buffer; key: string }> {
  const buffer = await buildDocx(documentId);
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { client: true },
  });
  const base = doc.client.folderPath || clientFolderPath(doc.client.id, doc.client.companyAr || doc.client.nameAr);
  const folder = doc.type === 'QUOTE' ? 'quotes' : 'contracts';
  const key = fileKey(base, folder, `${doc.number}.docx`);
  await storage().put(key, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  await prisma.fileAsset.upsert({
    where: { id: `docx-${documentId}` },
    create: {
      id: `docx-${documentId}`,
      clientId: doc.clientId,
      documentId,
      folder,
      name: `${doc.number}.docx`,
      path: key,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: buffer.length,
      source: 'system',
    },
    update: { path: key, size: buffer.length },
  });

  return { buffer, key };
}
