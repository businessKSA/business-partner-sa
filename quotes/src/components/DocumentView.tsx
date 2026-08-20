/**
 * عرض المستند ثنائي اللغة — عمودان متقابلان: الإنجليزي يسار والعربي يمين.
 * نفس المكوّن يُستخدم للصفحة العامة وللـPDF، فيخرج الـPDF مطابقاً للصفحة.
 * ممنوع الإيموجي والأيقونات في هذا المكوّن.
 */
import React from 'react';
import { COMPANY } from '../../config/company';
import { fmtMoney, fmtQty, fmtDate, fmtDateTime } from '../lib/money';
import type { DocModel, Bi } from '../lib/doc-model';

function Pair({ ar, en, title }: { ar: string; en: string; title?: Bi }) {
  return (
    <div className="bi">
      <div className="en" lang="en" dir="ltr">
        {title ? <h4>{title.en}</h4> : null}
        <p>{en}</p>
      </div>
      <div className="ar" lang="ar" dir="rtl">
        {title ? <h4>{title.ar}</h4> : null}
        <p>{ar}</p>
      </div>
    </div>
  );
}

function SectionTitle({ t }: { t: Bi }) {
  return (
    <div className="sec-title">
      <div className="en" lang="en" dir="ltr">{t.en}</div>
      <div className="ar" lang="ar" dir="rtl">{t.ar}</div>
    </div>
  );
}

function ItemsTable({ d }: { d: DocModel }) {
  return (
    <div className="items">
      <table>
        <thead>
          <tr>
            <th className="num" style={{ width: '4%' }}>
              م<span className="en" dir="ltr">No.</span>
            </th>
            <th style={{ width: '40%' }}>
              الخدمة والوصف<span className="en" dir="ltr">Service and description</span>
            </th>
            <th className="num" style={{ width: '9%' }}>
              الكمية<span className="en" dir="ltr">Qty</span>
            </th>
            <th className="num" style={{ width: '13%' }}>
              سعر الوحدة<span className="en" dir="ltr">Unit price</span>
            </th>
            <th className="num" style={{ width: '13%' }}>
              الإجمالي<span className="en" dir="ltr">Line total</span>
            </th>
            <th style={{ width: '21%' }}>
              شروط الدفع ومدة التنفيذ<span className="en" dir="ltr">Payment terms and delivery</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((it, i) => (
            <tr key={i}>
              <td className="num">{i + 1}</td>
              <td>
                <div className="ar">
                  <b>{it.nameAr}</b>
                  {it.descAr ? <div style={{ whiteSpace: 'pre-line' }}>{it.descAr}</div> : null}
                </div>
                <div className="en" lang="en" dir="ltr">
                  <b>{it.nameEn}</b>
                  {it.descEn ? <div style={{ whiteSpace: 'pre-line' }}>{it.descEn}</div> : null}
                  <div style={{ opacity: 0.75 }}>{it.code}</div>
                </div>
              </td>
              <td className="num">
                {fmtQty(it.qty)}
                <div className="en" lang="en" dir="ltr" style={{ textAlign: 'center' }}>
                  {it.unitEn}
                </div>
              </td>
              <td className="num">{fmtMoney(it.unitPrice)}</td>
              <td className="num">{fmtMoney(it.lineTotal)}</td>
              <td>
                <div className="ar">
                  {it.paymentTermsAr}
                  {it.deliveryAr ? <div>مدة التنفيذ: {it.deliveryAr}</div> : null}
                </div>
                <div className="en" lang="en" dir="ltr">
                  {it.paymentTermsEn}
                  {it.deliveryEn ? <div>Delivery: {it.deliveryEn}</div> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <table>
          <tbody>
            <tr>
              <td className="lbl">
                المجموع غير شامل ضريبة القيمة المضافة
                <span className="en" dir="ltr">Subtotal excluding VAT</span>
              </td>
              <td className="num">{fmtMoney(d.subtotal)}</td>
            </tr>
            <tr>
              <td className="lbl">
                ضريبة القيمة المضافة <span dir="ltr">{Math.round(d.vatRate * 100)}%</span>
                <span className="en" dir="ltr">Value added tax {Math.round(d.vatRate * 100)}%</span>
              </td>
              <td className="num">{fmtMoney(d.vatAmount)}</td>
            </tr>
            <tr className="grand">
              <td className="lbl">
                الإجمالي شامل ضريبة القيمة المضافة
                <span className="en" dir="ltr">Total including VAT</span>
              </td>
              <td className="num">{fmtMoney(d.total)} SAR</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        الرسوم الحكومية مستثناة دائماً وتُسدَّد للجهات المختصة مباشرة بالتكلفة الفعلية.
        <span style={{ display: 'block', direction: 'ltr', textAlign: 'left', fontFamily: 'var(--font-en)' }}>
          Government fees are always excluded and are paid directly to the competent authorities at actual cost.
        </span>
      </p>
    </div>
  );
}

function GovFeesAppendix({ d }: { d: DocModel }) {
  if (!d.govFees.length || !d.govFeesTitle) return null;
  return (
    <div className="appendix">
      <SectionTitle t={d.govFeesTitle} />
      {d.govFeesNote ? <Pair ar={d.govFeesNote.ar} en={d.govFeesNote.en} /> : null}
      <div className="items">
        <table>
          <thead>
            <tr>
              <th className="num" style={{ width: '5%' }}>م<span className="en" dir="ltr">No.</span></th>
              <th style={{ width: '60%' }}>البند<span className="en" dir="ltr">Item</span></th>
              <th className="num" style={{ width: '35%' }}>
                الرسم المقدّر (ريال)<span className="en" dir="ltr">Estimated fee (SAR)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {d.govFees.map((g, i) => (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td>
                  <div className="ar">{g.labelAr}</div>
                  <div className="en" lang="en" dir="ltr">{g.labelEn}</div>
                </td>
                <td className="num">
                  <div className="ar">
                    {g.amount === null ? (g.amountNoteAr ?? 'بدون رسوم') : fmtMoney(g.amount)}
                    {g.amount !== null && g.amountNoteAr ? <div style={{ fontSize: 11 }}>{g.amountNoteAr}</div> : null}
                  </div>
                  <div className="en" lang="en" dir="ltr" style={{ textAlign: 'center' }}>
                    {g.amount === null ? (g.amountNoteEn ?? 'no fees') : g.amountNoteEn ?? ''}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BankBlock() {
  return (
    <div className="bi">
      <div className="en" lang="en" dir="ltr">
        <h4>Bank Details</h4>
        <p>
          Bank: {COMPANY.bank.name.en}
          {'\n'}Beneficiary: {COMPANY.bank.beneficiary.en}
          {'\n'}Account number: {COMPANY.bank.account}
          {'\n'}IBAN: {COMPANY.bank.iban}
        </p>
      </div>
      <div className="ar" lang="ar" dir="rtl">
        <h4>البيانات البنكية</h4>
        <p>
          المصرف: {COMPANY.bank.name.ar}
          {'\n'}اسم المستفيد: {COMPANY.bank.beneficiary.ar}
          {'\n'}رقم الحساب: {COMPANY.bank.account}
          {'\n'}الآيبان: {COMPANY.bank.iban}
        </p>
      </div>
    </div>
  );
}

function PartiesBlock({ d }: { d: DocModel }) {
  const c = d.client;
  const clientAr = c.companyAr || c.nameAr;
  const clientEn = c.companyEn || c.nameEn || c.nameAr;
  const ct = d.contract!;
  return (
    <>
      <div className="bi">
        <div className="en" lang="en" dir="ltr">
          <h4>
            {ct.partyFirstLabel.en} — {ct.partyFirstRole.en}
          </h4>
          <p>
            {COMPANY.legalName.en}
            {'\n'}Unified national number / Commercial registration: {COMPANY.crNumber}
            {'\n'}VAT registration number: {COMPANY.vatNumber}
            {'\n'}Address: {COMPANY.address.en}
            {'\n'}Represented by: {COMPANY.representative.name.en} — {COMPANY.representative.title.en}
            {'\n'}Telephone: {COMPANY.phoneDisplay} — Email: {COMPANY.email}
          </p>
        </div>
        <div className="ar" lang="ar" dir="rtl">
          <h4>
            {ct.partyFirstLabel.ar} — {ct.partyFirstRole.ar}
          </h4>
          <p>
            {COMPANY.legalName.ar}
            {'\n'}الرقم الوطني الموحد / السجل التجاري: {COMPANY.crNumber}
            {'\n'}الرقم الضريبي: {COMPANY.vatNumber}
            {'\n'}العنوان: {COMPANY.address.ar}
            {'\n'}ويمثلها: {COMPANY.representative.name.ar} — {COMPANY.representative.title.ar}
            {'\n'}هاتف: {COMPANY.phoneDisplay} — بريد: {COMPANY.email}
          </p>
        </div>
      </div>

      <div className="bi">
        <div className="en" lang="en" dir="ltr">
          <h4>
            {ct.partySecondLabel.en} — {ct.partySecondRole.en}
          </h4>
          <p>
            {clientEn}
            {c.crNumber ? `\nCommercial registration: ${c.crNumber}` : ''}
            {c.vatNumber ? `\nVAT registration number: ${c.vatNumber}` : ''}
            {c.addressEn ? `\nAddress: ${c.addressEn}` : ''}
            {'\n'}Country: {c.country}
            {c.repName ? `\nRepresented by: ${c.repName}${c.repTitle ? ` — ${c.repTitle}` : ''}` : ''}
            {'\n'}Telephone: {c.phone} — Email: {c.email}
          </p>
        </div>
        <div className="ar" lang="ar" dir="rtl">
          <h4>
            {ct.partySecondLabel.ar} — {ct.partySecondRole.ar}
          </h4>
          <p>
            {clientAr}
            {c.crNumber ? `\nالسجل التجاري: ${c.crNumber}` : ''}
            {c.vatNumber ? `\nالرقم الضريبي: ${c.vatNumber}` : ''}
            {c.addressAr ? `\nالعنوان: ${c.addressAr}` : ''}
            {'\n'}الدولة: {c.country}
            {c.repName ? `\nويمثله: ${c.repName}${c.repTitle ? ` — ${c.repTitle}` : ''}` : ''}
            {'\n'}هاتف: {c.phone} — بريد: {c.email}
          </p>
        </div>
      </div>
    </>
  );
}

function Signatures({ d }: { d: DocModel }) {
  const ct = d.contract!;
  const c = d.client;
  return (
    <div className="appendix-none">
      <SectionTitle t={ct.signatureTitle} />
      <Pair ar={ct.signatureNote.ar} en={ct.signatureNote.en} />
      <div className="sign-grid">
        {/* الطرف الأول — بزنس بارتنر: علامات /sig_bp/ و /date_bp/ */}
        <div className="sign-box">
          <div className="role">
            {ct.partyFirstLabel.ar} — {ct.partyFirstRole.ar}
            <span style={{ display: 'block', direction: 'ltr', fontFamily: 'var(--font-en)' }}>
              {ct.partyFirstLabel.en} — {ct.partyFirstRole.en}
            </span>
          </div>
          <div className="who">{COMPANY.legalName.ar}</div>
          <div className="who-en">{COMPANY.legalName.en}</div>
          <div className="who" style={{ marginTop: 6 }}>
            {COMPANY.representative.name.ar} — {COMPANY.representative.title.ar}
          </div>
          <div className="who-en">
            {COMPANY.representative.name.en} — {COMPANY.representative.title.en}
          </div>
          <div className="sign-line">التوقيع / Signature</div>
          {/* علامة ربط DocuSign — معزولة باتجاه LTR في سطر مستقل حتى تبقى
              السلسلة متصلة حرفياً داخل الـPDF ولا يفصلها خوارزم الاتجاهين */}
          <div className="anchor" dir="ltr">/sig_bp/</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>التاريخ / Date</div>
          <div className="anchor" dir="ltr">/date_bp/</div>
        </div>

        {/* الطرف الثاني — العميل: علامات /sig_client/ و /date_client/ */}
        <div className="sign-box">
          <div className="role">
            {ct.partySecondLabel.ar} — {ct.partySecondRole.ar}
            <span style={{ display: 'block', direction: 'ltr', fontFamily: 'var(--font-en)' }}>
              {ct.partySecondLabel.en} — {ct.partySecondRole.en}
            </span>
          </div>
          <div className="who">{c.companyAr || c.nameAr}</div>
          <div className="who-en">{c.companyEn || c.nameEn || ''}</div>
          {c.repName ? (
            <div className="who" style={{ marginTop: 6 }}>
              {c.repName}
              {c.repTitle ? ` — ${c.repTitle}` : ''}
            </div>
          ) : null}
          <div className="sign-line">التوقيع / Signature</div>
          {/* علامة ربط DocuSign — معزولة باتجاه LTR في سطر مستقل */}
          <div className="anchor" dir="ltr">/sig_client/</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>التاريخ / Date</div>
          <div className="anchor" dir="ltr">/date_client/</div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentView({ d }: { d: DocModel }) {
  const isContract = d.type !== 'QUOTE';
  const S = d.quoteSections;

  return (
    <article className="doc" id="document-root">
      <header className="doc-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COMPANY.brand.logo} alt="Business Partner" />
        <div className="meta">
          <div lang="ar" dir="rtl">{COMPANY.legalName.ar}</div>
          <div lang="en" dir="ltr">{COMPANY.legalName.en}</div>
          <div dir="ltr">
            CR {COMPANY.crNumber} — VAT {COMPANY.vatNumber}
          </div>
          <div lang="ar" dir="rtl">
            السجل التجاري {COMPANY.crNumber} — الرقم الضريبي {COMPANY.vatNumber}
          </div>
          <div lang="ar" dir="rtl">{COMPANY.address.ar}</div>
          <div lang="en" dir="ltr">{COMPANY.address.en}</div>
          <div dir="ltr">
            {COMPANY.phoneDisplay} — {COMPANY.email} — {COMPANY.website}
          </div>
        </div>
      </header>

      <div className="doc-title">
        <div className="ar" lang="ar" dir="rtl">{d.titleAr}</div>
        <div className="en" lang="en" dir="ltr">{d.titleEn}</div>
        <div className="num" dir="ltr">
          {d.number} — {fmtDate(d.issuedAt, 'en')}
          {d.validUntil && !isContract ? ` — valid until ${fmtDate(d.validUntil, 'en')}` : ''}
          {d.sourceNumber ? ` — issued from quotation ${d.sourceNumber}` : ''}
        </div>
        <div className="num" dir="rtl" lang="ar">
          {d.number} — صدر بتاريخ {fmtDate(d.issuedAt, 'ar')}
          {d.validUntil && !isContract ? ` — صالح حتى ${fmtDate(d.validUntil, 'ar')}` : ''}
          {d.sourceNumber ? ` — صادر عن العرض ${d.sourceNumber}` : ''}
        </div>
      </div>

      <div className="doc-body">
        {d.acceptedAt ? (
          <div className="stamp">
            <div className="en" lang="en" dir="ltr">
              Accepted electronically by {d.acceptedByName} on {fmtDateTime(d.acceptedAt, 'en')}.
            </div>
            <div className="ar" lang="ar" dir="rtl">
              قُبل إلكترونياً بواسطة {d.acceptedByName} بتاريخ {fmtDateTime(d.acceptedAt, 'ar')}.
            </div>
          </div>
        ) : null}
        {d.signedAt ? (
          <div className="stamp">
            <div className="en" lang="en" dir="ltr">Signed electronically by both parties on {fmtDateTime(d.signedAt, 'en')}.</div>
            <div className="ar" lang="ar" dir="rtl">وُقّع إلكترونياً من الطرفين بتاريخ {fmtDateTime(d.signedAt, 'ar')}.</div>
          </div>
        ) : null}

        {!isContract ? (
          <>
            <SectionTitle t={S.to} />
            <div className="bi">
              <div className="en" lang="en" dir="ltr">
                <p>
                  {d.client.companyEn || d.client.nameEn || d.client.nameAr}
                  {d.client.repName ? `\nAttention: ${d.client.repName}` : ''}
                  {d.client.crNumber ? `\nCommercial registration: ${d.client.crNumber}` : ''}
                  {'\n'}
                  {d.client.email} — {d.client.phone}
                </p>
              </div>
              <div className="ar" lang="ar" dir="rtl">
                <p>
                  {d.client.companyAr || d.client.nameAr}
                  {d.client.repName ? `\nعناية: ${d.client.repName}` : ''}
                  {d.client.crNumber ? `\nالسجل التجاري: ${d.client.crNumber}` : ''}
                  {'\n'}
                  {d.client.email} — {d.client.phone}
                </p>
              </div>
            </div>

            <SectionTitle t={S.subject} />
            <Pair ar={d.introAr || d.titleAr} en={d.introEn || d.titleEn} />

            <SectionTitle t={S.pricing} />
            <ItemsTable d={d} />

            {d.notesAr || d.notesEn ? (
              <>
                <SectionTitle t={S.scope} />
                <Pair ar={d.notesAr || ''} en={d.notesEn || ''} />
              </>
            ) : null}

            <BankBlock />

            <SectionTitle t={S.terms} />
            <div className="bi">
              <div className="en" lang="en" dir="ltr">
                <ol>
                  {d.quoteTerms.map((t, i) => (
                    <li key={i}>{t.en}</li>
                  ))}
                </ol>
              </div>
              <div className="ar" lang="ar" dir="rtl">
                <ol>
                  {d.quoteTerms.map((t, i) => (
                    <li key={i}>{t.ar}</li>
                  ))}
                </ol>
              </div>
            </div>

            <SectionTitle t={S.company} />
            <div className="bi">
              <div className="en" lang="en" dir="ltr">
                <p>
                  {COMPANY.legalName.en}
                  {'\n'}Unified national number / Commercial registration: {COMPANY.crNumber}
                  {'\n'}VAT registration number: {COMPANY.vatNumber}
                  {'\n'}{COMPANY.address.en}
                  {'\n'}{COMPANY.representative.name.en} — {COMPANY.representative.title.en}
                  {'\n'}{COMPANY.phoneDisplay} — {COMPANY.email} — {COMPANY.website}
                </p>
              </div>
              <div className="ar" lang="ar" dir="rtl">
                <p>
                  {COMPANY.legalName.ar}
                  {'\n'}الرقم الوطني الموحد / السجل التجاري: {COMPANY.crNumber}
                  {'\n'}الرقم الضريبي: {COMPANY.vatNumber}
                  {'\n'}{COMPANY.address.ar}
                  {'\n'}{COMPANY.representative.name.ar} — {COMPANY.representative.title.ar}
                  {'\n'}{COMPANY.phoneDisplay} — {COMPANY.email} — {COMPANY.website}
                </p>
              </div>
            </div>

            {d.quoteAcceptanceNote ? (
              <>
                <SectionTitle t={S.acceptance} />
                <Pair ar={d.quoteAcceptanceNote.ar} en={d.quoteAcceptanceNote.en} />
              </>
            ) : null}

            <GovFeesAppendix d={d} />
          </>
        ) : (
          <>
            <Pair ar={d.contract!.preamble.ar} en={d.contract!.preamble.en} />
            <PartiesBlock d={d} />

            <SectionTitle t={d.contract!.recitalsTitle} />
            <div className="bi">
              <div className="en" lang="en" dir="ltr">
                {d.contract!.recitals.map((r, i) => (
                  <p key={i}>{r.en}</p>
                ))}
              </div>
              <div className="ar" lang="ar" dir="rtl">
                {d.contract!.recitals.map((r, i) => (
                  <p key={i}>{r.ar}</p>
                ))}
              </div>
            </div>

            {d.contract!.clauses.map((cl, idx) => (
              <React.Fragment key={cl.key}>
                <SectionTitle
                  t={{
                    ar: `البند (${idx + 1}) — ${cl.title.ar}`,
                    en: `Clause (${idx + 1}) — ${cl.title.en}`,
                  }}
                />
                <Pair ar={cl.body.ar} en={cl.body.en} />
                {cl.renderItemsTable ? <ItemsTable d={d} /> : null}
              </React.Fragment>
            ))}

            {d.notesAr || d.notesEn ? <Pair ar={d.notesAr || ''} en={d.notesEn || ''} /> : null}

            <Signatures d={d} />

            <div className="appendix">
              <SectionTitle t={d.contract!.feeAppendixTitle} />
              <ItemsTable d={d} />
              <BankBlock />
            </div>

            <GovFeesAppendix d={d} />
          </>
        )}

        <footer className="doc-foot">
          <div className="en" lang="en" dir="ltr">
            {COMPANY.legalName.en} — CR {COMPANY.crNumber} — VAT {COMPANY.vatNumber}
            <br />
            {COMPANY.address.en} — {COMPANY.phoneDisplay} — {COMPANY.website}
            <br />
            Document {d.number}
          </div>
          <div className="ar" lang="ar" dir="rtl">
            {COMPANY.legalName.ar} — السجل {COMPANY.crNumber} — الرقم الضريبي {COMPANY.vatNumber}
            <br />
            {COMPANY.address.ar} — {COMPANY.phoneDisplay} — {COMPANY.website}
            <br />
            المستند رقم {d.number}
          </div>
        </footer>
      </div>
    </article>
  );
}
