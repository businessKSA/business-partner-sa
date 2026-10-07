> **سجلّ مرجعي داخلي — ليس للنشر على الموقع.** بحثٌ من المصادر الرسمية بتاريخ 2026-10-07.
> كل حقل موسوم `VERIFIED (url)` أو `UNVERIFIED`. لا يُنقل أي `UNVERIFIED` إلى عميل
> كحقيقة. القواعد في `README.md`. التحديث لـ`fintech-licensing` وحده.

# Saudi CMA (هيئة السوق المالية) — Licence / Authorisation / Registration Map

Research date: 2026-10-07. Method: official CMA documents downloaded and read in full text (PDFs under `cma.org.sa/en/RulesRegulations/Regulations/Documents/`) plus CMA web pages on `cma.gov.sa` (cma.org.sa 301-redirects to cma.gov.sa). Tags: **VERIFIED (url)** = read on an official CMA page/document; **UNVERIFIED – from memory / secondary** = not confirmed on an official page.

Reachability notes
- cma.gov.sa / cma.org.sa: WebFetch returned 503 once, but direct `curl` worked; all pages and PDFs below were read directly.
- saudiexchange.sa (Tadawul): **HTTP 403 Access Denied** — could not read Listing Rules or exchange pages. Everything about exchange-level listing is therefore UNVERIFIED.
- laws.boe.gov.sa: not queried (CMA PDFs used instead).
- English PDFs are "unofficial translations"; the Arabic text is official (stated on each PDF).
- The Authorisation System portal itself is behind login; requirement lists come from CMA service pages only.

Base URL used below: `D=https://cma.org.sa/en/RulesRegulations/Regulations/Documents`

---

## 0. Governing framework (the core instruments)

| Arabic | English | Latest amendment found | Source |
|---|---|---|---|
| لائحة مؤسسات السوق المالية | Capital Market Institutions Regulations (CMIR; formerly "Authorised Persons Regulations", renamed) | Board Res. 2-3-2026, 18/07/1447H = 07/01/2026 | VERIFIED ($D/the_Capital_Market_Institutions_Regulations-en.pdf) |
| لائحة أعمال الأوراق المالية | Securities Business Regulations (SBR) | Board Res. 2-75-2020, 12/08/2020; Art. 2 (the five activities) effective 01/01/2022 | VERIFIED ($D/Amended Securities Business Regulations.pdf) |
| قائمة المصطلحات المستخدمة في لوائح هيئة السوق المالية وقواعدها | Glossary of Defined Terms | Res. 1-26-2026, 02/03/2026 | VERIFIED ($D/Glossary_of_Defined_Terms_..._en2026.pdf) |
| لائحة صناديق الاستثمار | Investment Funds Regulations | Res. 1-135-2025, 24/11/2025 | VERIFIED ($D/Investment_Funds_Regulations_11_2025_EN.pdf) |
| لائحة صناديق الاستثمار العقاري | Real Estate Investment Funds Regulations | Res. 1-135-2025, 24/11/2025 | VERIFIED ($D/Real_Estate_Investment_Funds_Regulations_11_2025_EN.pdf) |
| قواعد طرح الأوراق المالية والالتزامات المستمرة | Rules on the Offer of Securities and Continuing Obligations (OSCO) | Res. 3-6-2026, 19/01/2026 | VERIFIED ($D/RULES_ON_THE_OFFER_OF_SECURITIES_AND_CONTINUING_OBLIGATIONS_en2026.pdf) |

Arabic names above are VERIFIED from the CMA Arabic regulations list (https://cma.gov.sa/RulesRegulations/Regulations/Pages/default.aspx). Note: the list page shows original issue dates, not latest amendment dates; amendment dates above come from each PDF cover.

**Legal basis of the licensing requirement** — SBR Art. 5: no one may carry on securities business in the Kingdom unless a capital market institution (CMI) authorised by the CMA or an Exempt Person (Annex 1); breach is an offence under Art. 60 of the Capital Market Law. VERIFIED (sbr.pdf). A person is deemed to carry on business in the Kingdom if it deals "with or for a person in the Kingdom" (SBR Art. 4). VERIFIED.

---

## 1. Capital market institution (CMI) licences — the five securities activities

SBR Art. 2 (effective 01/01/2022) defines five securities activities. VERIFIED (sbr.pdf). The public register at https://cma.gov.sa/en/Market/AuthorisedPersons/Pages/default.aspx shows activity codes **Arr, Adv, C, D, MIOF, MI** (six filter codes) and "Count = 242" entries at 05/10/2026. VERIFIED.

### Common licensing requirements (apply to items 1.1–1.6) — VERIFIED (CMIR Arts. 6, 7, 9, 10; Annex 3.1)
- Application on CMA form with Annex 3.1 documents; founders/controlling shareholders may apply before incorporation (Art. 6(a)-(d)).
- Must show: fit and proper; adequate expertise and resources; management, financial systems, risk management, technology, procedures; qualified board/officers/staff (Art. 6(e)).
- Legal form: for **dealing, custody and managing**, must be established in the Kingdom as (1) subsidiary of a local bank, (2) joint stock company, (3) subsidiary of a Saudi JSC engaged in financial services, or (4) subsidiary of a foreign financial institution licensed under the Banking Control Law. For **arranging or advising**, any legal form established in the Kingdom (Art. 6(f)).
- Management and head office must be in the Kingdom (Art. 6(h)).
- Close-links test (Art. 6(i)); fees (Art. 6(j), Art. 17).
- Process: CMA may request extra info (applicant answers within 30 days); once complete, CMA notifies applicant in writing and **decides within a maximum of 30 days from that notice** (approve / approve with conditions / refuse) (Art. 7(a),(c)). Approval states a "permitted business profile"; applicant must meet Annex 3.1 commencement-of-business requirements before starting (Art. 7(d)); cannot carry on or hold out before the decision (Art. 7(f)).
- **Authorisation lasts ten years, automatically renewable** while fit-and-proper, prudential, minimum capital and annual fees are met (Art. 7(g)).
- Fit-and-proper includes: no fraud/dishonesty offence; founders, controllers or registered staff not bankrupt in last ten years; CMA approval needed before altering capital (Art. 9).
- Right of appeal to the Committee for the Resolution of Securities Disputes (Art. 8, "the Committee").
- Prudential rules: `AmendedPrudentialRules.pdf` listed by CMA (قواعد الكفاية المالية, 30/12/2012) — **not opened; content UNVERIFIED**.

### 1.1 Dealing — التعامل
- English: Dealing (as principal or agent; includes selling, buying, managing a subscription, underwriting). VERIFIED (SBR Art. 2(1)).
- Instrument: SBR + CMIR.
- Who needs it: brokers/underwriters and anyone dealing in securities by way of business.
- Capital: **SAR 50 million paid-up** for dealing and custody. VERIFIED (CMIR Art. 6(g)(1)).
- Sub-types (dealing as principal / agent / underwriting / margin): **in the in-force text these are a single "Dealing" activity** (SBR Art. 2(1)). A **draft** (public consultation 18/05/2026 to 17/06/2026) proposes sub-activities: "Dealing as Principal, Underwriting, and Executing Transactions on a Margin Basis" grouped at SAR 20 million, and "Dealing as Agent" at SAR 10 million. VERIFIED as a *proposal only* (https://cma.gov.sa/en/MediaCenter/NEWS/Pages/CMA_N_4054.aspx). **Final approval NOT found** — treat as pending.
- Related: distributor of fund units in the Kingdom must be a CMI licensed for dealing or advising (or local bank / SAMA-licensed e-money institution / investment fund distribution platform). VERIFIED (Investment Funds Regulations, delegation Article).

### 1.2 Arranging — الترتيب
- English: Arranging (introducing parties in relation to offering of securities or arranging underwriting; advising on corporate finance). VERIFIED (SBR Art. 2(2)). Described by King & Spalding as the "investment banking" licence (secondary, UNVERIFIED as official wording).
- Who needs it: corporate-finance houses, financial advisers on IPOs/offers (OSCO Art. 21(a): the issuer's financial adviser must be authorised for arranging), and **securities crowdfunding platforms** (see 1.7).
- Capital: "a capital that covers the expected expenses for a year" VERIFIED (CMIR Art. 6(g)(3)). Draft proposes SAR 2 million for arranging that holds client funds in crowdfunding (VERIFIED as proposal, CMA_N_4054).

### 1.3 Advising — تقديم المشورة
- English: Advising (incl. financial planning and wealth management — CMIR Art. 10(e)). VERIFIED.
- May present itself as an "independent investment advisor" subject to conflict-of-interest limits (CMIR Art. 41(f); Glossary). VERIFIED.
- Capital: one year's expected expenses (Art. 6(g)(3)). VERIFIED.
- Staffing relief: a CMI limited to managing investments, arranging or advising may outsource CFO / compliance officer / MLRO to an accounting firm / law firm / CMI under conditions (Art. 20(e)); minimum persons registered: two (one being CEO) for managing investments or arranging, one (CEO) for advising only (Art. 20(f)). VERIFIED.
- Draft (CMA_N_4054) would let advising-only CMIs engage in other professions with controls. Proposal only.

### 1.4 Custody — الحفظ
- English: Custody (safeguarding assets incl. securities; administrative measures). VERIFIED (SBR Art. 2(5)).
- Capital: **SAR 50 million** in force (CMIR Art. 6(g)(1)) VERIFIED. Draft proposes **SAR 20 million** (VERIFIED as proposal only, CMA_N_4054).
- Client money/assets must be held through a CMI licensed for custody (CMIR Art. 69(c)), except crowdfunding arrangers (1.7). VERIFIED.

### 1.5 Managing Investments — إدارة الاستثمارات (code MI)
- English: Managing Investments = making investment decisions for **non-real-estate** investment funds and client portfolios on a discretionary basis. VERIFIED (Glossary).
- Capital: **SAR 20 million** for "managing investments and operating funds" plus capital covering one year's expected expenses for "managing investments" (wording of Art. 6(g)(2) is ambiguous on which figure applies to MI alone — **read the Arabic text/ask CMA before relying**). VERIFIED text; interpretation UNVERIFIED.
- A MI-only fund manager cannot run a real estate fund or invest in real-estate assets (Simplified Funds Instructions Art. 21(c)). VERIFIED.
- Minimum two registered portfolio managers at all times (CMIR Art. 20(g)). VERIFIED.
- Robo-advisory is a permitted service for MI / MIOF licensees (see 1.8).

### 1.6 Managing Investments and Operating Funds — إدارة الاستثمارات وتشغيل الصناديق (code MIOF)
- English: as 1.5 plus operating investment funds (incl. real estate funds). VERIFIED (Glossary; SBR Art. 2(3) "operates investment funds").
- Capital: SAR 20 million (Art. 6(g)(2)). VERIFIED.
- Needed to offer public funds (Investment Funds Regs Art. 32), real estate funds (Real Estate Funds Regs Art. 7(a): MIOF specifically).
- King & Spalding note "two sub-categories" for asset management (distribute foreign funds / real estate / fund administration) — secondary, UNVERIFIED on official page. The official code split is MI vs MIOF.

### 1.7 Arranging in the course of Securities Crowdfunding (equity and debt) — الترتيب في سياق التمويل الجماعي بالأوراق المالية
- English: Arranging licence used to operate a securities crowdfunding platform; "Securities Crowdfunding Platform: electronic platform at a CMI authorised to carry out arranging". VERIFIED (Glossary).
- Governing instruments: CMIR (equity crowdfunding amendments approved 27/09/2022 — VERIFIED https://cma.gov.sa/en/MediaCenter/NEWS/Pages/CMA_N_3164.aspx); OSCO exempt-offer provisions for crowdfunding **equity and debt** (VERIFIED in OSCO 2026 text); Investment Accounts Instructions.
- Debt-crowdfunding framework consulted 20/03/2025 (VERIFIED https://cma.gov.sa/en/MediaCenter/NEWS/Pages/CMA_N_3757.aspx); the current OSCO and Annex 1(A) already contain debt-instrument crowdfunding rules, so it is in force (VERIFIED in text; the *approval date* not found).
- Headline limits found in OSCO (VERIFIED): equity — issuer cap SAR 10 million per 12 months across platforms; retail subscription cap SAR 25,000 per offering; debt — outstanding financing cap SAR 20 million (SAR 80 million for asset-backed); retail cap SAR 25,000 per outstanding issuer and SAR 100,000 per 12 months; retail may not buy asset-backed debt on platform.
- Client money held by the arranger: not over SAR 80 million, retail not over SAR 100,000 (CMIR Art. 69(d)) VERIFIED.
- Registrable function: an IT Officer is required for arrangers carrying out crowdfunding (CMIR Art. 19(b)(8)). VERIFIED.
- Capital: no dedicated amount in force; "capital covering one year's expenses". SAR 2 million is only a *draft proposal* (CMA_N_4054).
- Fintech-ExPermit holders can graduate to this licence (CMA_N_3164; CMA_N_3757). VERIFIED.

### 1.8 Robo-Advisory permission — خدمات الاستشارة الآلية
- Not a standalone licence. A CMI licensed for MI or MIOF may offer robo-advisory if: no single-asset/issuer concentration; foreign securities supervised by equivalent regulator; algorithm and risk disclosure on platform (CMIR Art. 10(f)); must notify CMA of portfolio construction strategies at least 10 days before launch (Annex notification para. VIII); must have a registered IT Officer (Art. 19(b)(8), 20(b)(5)). VERIFIED (CMIR). Arabic name is my translation — UNVERIFIED.

### 1.9 Offshore Securities Business Licence — ترخيص أعمال الأوراق المالية خارج المملكة (**DRAFT, not in force as far as found**)
- Draft Regulatory Framework published for consultation 25/05/2025 to 28/06/2025; would let local/international CMIs with a Ministry of Investment regional-HQ licence conduct securities activities outside the Kingdom and manage funds investing in Saudi securities, with relaxed legal-structure, minimum capital, registration and financial adequacy requirements. VERIFIED as draft (https://cma.gov.sa/en/MediaCenter/NEWS/Pages/CMA_N_3796.aspx; draft PDF https://cma.gov.sa/RulesRegulations/Consulting/Documents/OffshoreSecuritiesBusinessLicense.en.pdf — returned 404 to me when fetched directly, so only the news page was read).
- The in-force CMIR (07/01/2026), SBR and Glossary contain **no occurrence of "offshore"** (searched), so it was not adopted into those texts as of those dates. Final status: **UNVERIFIED** (a secondary source claims it "launched"; not confirmed).
- Arabic name: my translation — UNVERIFIED.

---

## 2. Individuals — registered persons ("approved persons")

### 2.1 Registered Person (Registrable Functions) — الأشخاص المسجلون / الوظائف الخاضعة للتسجيل
- Arabic Part title "الأشخاص المسجلون" VERIFIED (CMIR Arabic PDF TOC). English: Registered Persons (CMIR Part 4).
- Registrable functions (Art. 19(b)): CEO or managing board member; CFO; board member or partner; senior executives/department heads directly related to securities business; **compliance officer**; **MLRO (AML officer)**; client-facing staff (sales reps, investment advisers, portfolio managers, corporate finance and brokerage professionals as defined by CMA); IT officer for robo-advisory / crowdfunding arrangers. VERIFIED.
- Mandatory permanent positions: CEO/managing member, CFO, compliance officer, MLRO, IT officer (robo). CEO, CFO and compliance officer must be different persons unless CMA approves; compliance officer may not perform a client function (Art. 20). VERIFIED.
- Requirements: CMI applies with person's consent on CMA form; applicant must have passed CMA qualification exams or hold an exemption; fees; **CMA aims to process within 30 days** of receiving all documents; may approve, approve with conditions, defer, or refuse; must be resident in the Kingdom unless exempted; notify CMA within 7 days of departure (Arts. 21–25). VERIFIED.
- Channel: "Fill out the Registration Application form for registrable function" in the Authorisation System (https://cma.gov.sa/en/Services/Pages/PublicServices.aspx). VERIFIED.
- Qualification exams (in cooperation with Financial Academy and CISI) VERIFIED (https://cma.gov.sa/en/AboutCMA/CME/Pages/default.aspx): CME-1A, CME-1B (foundation); CME-2A, CME-2B (compliance & AML); CME-3A, CME-3B (brokers); CME-4A, CME-4B (asset managers/fund managers/portfolio managers/analysts); CME-5A, CME-5B (corporate finance). Holders of previous CME certificates are eligible without new exams. Exact exam-to-function matrix beyond that page: UNVERIFIED (CMA Qualification Examinations Guideline not opened).
- Also: CRA registered persons (CRA Regs Part 5, Art. 35–40) and SPE board members (SPE Rules Art. 29) — see 5.2 and 6.2.

---

## 3. Investment funds and fund-related approvals

All are submitted by a CMI licensed for MI/MIOF (not by the public). Channel: **Unified Business Sector Portal** ("Public Fund Offering Applications" service).

### 3.1 Public investment fund offering approval — الموافقة على طرح وحدات صندوق استثمار عام
- Instrument: Investment Funds Regulations (Arts. 32–33; Annex 2), amended 24/11/2025. VERIFIED.
- Who: MI/MIOF-licensed fund manager. CMA reviews **within 30 days** from notification that application is complete; approve / approve with conditions / reject; units may not be offered until written decision; offer must start within 12 months of the decision or approval lapses. VERIFIED.
- CMA service page: Duration **30 business days**, cost **SAR 10,000–15,000**, channel Unified Business Sector Portal; submit fund terms and conditions, information memorandum, key information summary. VERIFIED (https://cma.gov.sa/en/Services/Pages/Details.aspx?FilterField1=ID&FilterValue1=34&FilterType1=Counter).
- Closed-ended traded fund, money market, feeder, fund of funds, capital protected, endowment funds are "specialized public funds" sub-types under the same regulations (TOC: Arts. 50–60). VERIFIED (TOC).

### 3.2 Private fund offering notification — إشعار الهيئة بطرح وحدات صندوق استثمار خاص
- Instrument: Investment Funds Regulations Part 5 (Arts. 80–83; Annex 6). Notification by MI/MIOF CMI; private placement to institutional/qualified clients, or retail with maximum SAR 200,000 per offeree and retail not above 50% of cash subscriptions; private real estate funds must be closed-ended. VERIFIED. (A notification regime, not an approval.)

### 3.3 Real estate investment fund (public/private) and REIT (Real Estate Investment Traded Fund) — صناديق الاستثمار العقاري / الصندوق العقاري المتداول
- Instrument: Real Estate Investment Funds Regulations (24/11/2025). Applicant must be MIOF-licensed (Art. 7(a)); public offering requires CMA approval of Annex 3 information; CMA decides within 30 days of notice of completeness (Art. 8). Part 4 covers the traded fund / REIT (Arts. 45–51). VERIFIED.
- Same CMA service (Details ID=34) lists Appendices (1),(2),(3) of the RE Funds Regulations for listed/unlisted public RE funds. VERIFIED.
- Listing of REIT units on the exchange also needs exchange (Tadawul) listing approval — UNVERIFIED (saudiexchange.sa was 403).

### 3.4 Simplified Investment Fund — صندوق استثمار مبسط
- Instrument: تعليمات صناديق الاستثمار المبسطة / Instructions of Simplified Investment Funds, Board Res. 1-26-2026, 02/03/2026 (new category, 2026). VERIFIED (simp.pdf; https://cma.org.sa/en/RulesRegulations/Regulations/Documents/Instructions_of_Simplified_Investment_Funds_EN.pdf).
- Fund manager must be MI/MIOF-licensed; offering by **written notice** before the offer date, with declaration (Annex 1), terms and conditions, offering docs, registration fee; CMA may suspend or prohibit; on request issues a no-objection notice if it takes no action (Art. 22). Offers limited to private placement categories (Art. 21). VERIFIED.

### 3.5 Foreign fund in the Kingdom / Cross-border passporting — تسجيل بيني لصناديق الاستثمار
- Instruments: Investment Funds Regs Part 5 (Arts. 99–102, foreign-fund private placement); **لائحة التسجيل البيني لصناديق الاستثمار / Cross-Border Passporting Regulations for Investment Funds** and its Guide (Res. 1-46-2025, 23/04/2025) listed 03/06/2025. Guide VERIFIED (https://cma.org.sa/en/RulesRegulations/Regulations/Documents/Intermediary_Registration_Guide_en.pdf — the file name is misleading; it contains the Passporting Guide). The Regulations document itself not opened.
- Agent in the Kingdom must be a licensed CMI (dealing, investment management or fund operation); declaration, notification on Annex 6, offering documents with CMA disclaimer, passporting fee, local unitholder register. VERIFIED (Guide).

### 3.6 Real Estate Contribution Certificates offering — طرح شهادات المساهمات العقارية
- Instrument: Instructions for Offering Real Estate Contributions Certificates, Res. 3-6-2024, 17/01/2024 (under Real Estate Contributions Law, Royal Decree M/203). VERIFIED. Public offering requires CMA approval (30-day review) and the related Real Estate General Authority licence (referenced as "conditional approval for the license application"); private placement by notification 10 days in advance; offering period max 90 days. VERIFIED (rec.pdf). REGA = real-estate regulator; separate from CMA.

### 3.7 Financing Investment Funds — صناديق الاستثمار التمويلية
- Instructions on the Financing Investment Funds, Res. 1-35-2022 (15/03/2022). Existence VERIFIED (CMA list); text mentions interaction with financing companies licensed by SAMA. Specific approval mechanics: UNVERIFIED (not read closely).

### 3.8 Investment Fund Distribution Platform — منصة توزيع صناديق الاستثمار
- Defined term (Glossary): platforms established by market infrastructure institutions, or by licensed CMIs, or platforms holding a FinTech ExPermit. VERIFIED. No separate licence class found.

---

## 4. Offering / listing approvals (issuer side)

Channel for IPO: **CFI Gate** (service "Public Listing": duration **45 business days**, cost free) — VERIFIED (https://cma.gov.sa/en/Services/Pages/Details.aspx?FilterField1=ID&FilterValue1=42&FilterType1=Counter). Other issuer services on the catalog (Capitalization, Capital Reduction, General Assemblies, E-Forms & Circulars) VERIFIED (https://cma.gov.sa/en/Services/Pages/eServices.aspx).

### 4.1 Registration and public offer of shares (prospectus approval) — تسجيل وطرح أسهم / اعتماد نشرة الإصدار
- OSCO Arts. 15–34. Issuer must appoint a **financial adviser authorised for arranging** and a legal adviser (Arts. 20–22); two issuer representatives (one director, one senior executive) (Art. 18); underwriting; CMA reviews **within 45 days** of receiving all required documents (OSCO, shares chapter); CMA approval is conditional on the exchange's conditional listing approval. VERIFIED.

### 4.2 Public offer of debt instruments / sukuk — طرح أدوات الدين
- OSCO Chapter 3 (Arts. 35–43); review **within 20 days**; requires financial adviser, legal adviser and a representative of debt holders. VERIFIED.

### 4.3 Parallel Market (Nomu) offer/registration — السوق الموازية
- OSCO Part 8 (Arts. 74–95); CMA review **within 30 days**; includes SPAC provisions (Art. 79). VERIFIED. Exchange-side listing (Saudi Exchange): UNVERIFIED (403).

### 4.4 Private placement / limited offers / exempt offers (notification) — الطرح الخاص / الطروحات المحدودة / الطروحات المستثناة
- OSCO Parts 2–3. Notification-based (and crowdfunding is an exempt-offer route — see 1.7). VERIFIED (TOC and crowdfunding text).

### 4.5 Capital increase / reduction approvals; reverse takeover; demerger — زيادة/تخفيض رأس المال
- OSCO Part 6, 9, 10; CMA e-services "Capitalization", "Capital Reduction". VERIFIED (TOC; eServices).

### 4.6 Listing approval itself
- Listing is granted by the exchange (Saudi Exchange) under its Listing Rules, approved by the CMA; UNVERIFIED (saudiexchange.sa 403). The OSCO makes the CMA prospectus approval dependent on the exchange's conditional approval (VERIFIED).

---

## 5. Market infrastructure and other regulated entities

### 5.1 Securities Exchange / Depository Center / Alternative Trading System — سوق مالية / مركز إيداع / نظام تداول بديل
- Instrument: لائحة أسواق ومراكز إيداع الأوراق المالية / Securities Exchanges and Depository Centers Regulations, Res. 4-77-2022, 22/06/2022. VERIFIED.
- Requirements (Art. 6): fit and proper; resources and systems; paid-up capital **SAR 50 million for primary exchanges and depositary centres**; **ATS: capital at CMA discretion commensurate with business**; must be a **joint-stock company**; shareholders with 5% or more disclosed (Arts. 6(c),(e)). Foreign exchanges/depositories: Art. 7 (JSC established outside; subject to equivalent regulator). CMA decides within 30 days of notice of completeness (Art. 8). Variation application aimed at 30 days (Art. 9). VERIFIED.
- Existing authorised bodies (Saudi Exchange/Tadawul, Edaa, Muqassa) — named only in CMA's violation-reporting form as "Infrastructure Institutions" (VERIFIED, service ID=43); their specific authorisation instruments: UNVERIFIED.

### 5.2 Commodity Exchange authorisation — ترخيص مزاولة نشاط بورصة السلع
- **New 2026 licence window**: CMA received applications for **123 days, 01/07/2026 to 31/10/2026**, intending to grant **one** licence for a secondary market for commodity and metals derivatives contracts; applied under the Securities Exchanges and Depository Centers Regulations using a designated form; contact MarketInfrastructure@cma.gov.sa. VERIFIED (https://cma.gov.sa/en/MediaCenter/NEWS/Pages/CMA_N_4086.aspx). **Window closes in 24 days from today.**

### 5.3 Central Counterparty (CCP) / clearing — مركز مقاصة الأوراق المالية
- Instrument: لائحة مراكز مقاصة الأوراق المالية / Securities Central Counterparties Regulations, Res. 3-127-2019, 18/11/2019. VERIFIED.
- Authorisation of a CCP established in the Kingdom (Art. 7), out-of-Kingdom CCP (Art. 10), maintenance/variation (Arts. 11–12); authorised CCP is an exempt person under the SBR (Art. 6(b)); optional designation as **Qualifying Central Counterparty** (Art. 68). CMA decision timeline 30 days (Art. 9). Capital: no fixed SAR minimum found — Art. 20 requires liquid net assets sized to a recovery time span; **no fixed capital figure verified**. VERIFIED (text). Clearing services provided by SAMA to local banks are outside (Art. 1(c)).
- Related: Close-out Netting and related Collateral Arrangements Regulation (03/07/2025) — a framework, not a licence (listed by CMA; not read). 

### 5.4 Credit Rating Agency (CRA) authorisation — وكالات التصنيف الائتماني
- Instrument: لائحة وكالات التصنيف الائتماني / Credit Rating Agencies Regulations, Res. 3-58-2014, 10/11/2014 (no later amendment shown on the PDF cover). VERIFIED. CMA publishes a CRA list (https://cma.gov.sa/en/Market/AuthorisedPersons/Pages/CRAsCompanies.aspx — listed in site nav; not read).
- Requirements: legal person incorporated in the Kingdom or foreign CRA authorised in an equivalent jurisdiction (must set up a Saudi branch and notify home regulator) (Arts. 8, 10); fit and proper; resources, systems; **paid-up capital not less than SAR 2,000,000 or three months' working capital, whichever is higher** (Art. 9(2)); CMA decides within 30 days of notice of completeness (Art. 11(c)). Registered persons (rating analysts etc.) under Part 5. VERIFIED.

### 5.5 Registered accounting firm / auditor of CMA-supervised entities — تسجيل مراجعي الحسابات (المنشآت الخاضعة لإشراف الهيئة)
- Instrument: قواعد مراجعي حسابات المنشآت الخاضعة لإشراف الهيئة / Rules for Auditors of Entities Subject to the Authority's Supervision, Res. 1-135-2018, amended Res. 3-106-2026, 12/08/2026. VERIFIED (aud.pdf).
- Registration of both the accounting firm and individual CPA before appointment; firm: licensed under the Accounting and Auditing Profession Law, no fraud judgments in 10 years, quality management, technology system, indemnity insurance, sufficient audit managers with SOCPA fellowship; CPA: fellowship certificate, 5 years' practice including 3 years supervisory on such audits, full-time. VERIFIED. Application via firm on CMA form. A register of "Registered Accounting Firms" is at https://cma.gov.sa/en/Market/rafs/Pages/default.aspx (listed; not read).

### 5.6 Special Purposes Entity (SPE) licence and board-member registration — ترخيص المنشأة ذات الأغراض الخاصة / تسجيل أعضاء مجلس إدارتها
- Instrument: القواعد المنظمة للمنشآت ذات الأغراض الخاصة / Rules for Special Purposes Entities, Res. 4-123-2017, amended Res. 1-94-2025, 01/09/2025. VERIFIED.
- SPEs (debt issuance/securitisation, or investment funds in SPE form) must be licensed at all times; sponsor applies on CMA form and pays fee (Art. 7); by-laws need CMA approval; a trustee, custodian and auditor are required; SPE board members must be registered (Art. 29) and are listed in CMA registers (Arts. 51–52). Registration form-based. VERIFIED.

---

## 6. Innovation permits

### 6.1 FinTech Experimental Permit (FinTech ExPermit / FinTech Lab) — تصريح تجربة التقنية المالية / مختبر التقنية المالية
- Instrument: تعليمات تصريح تجربة التقنية المالية / Financial Technology Experimental Permit Instructions, Res. 1-4-2018 (10/01/2018), updated Res. 2-9-2021 (04/08/2021). VERIFIED (https://cma.org.sa/en/RulesRegulations/Regulations/Documents/FinTech_en.pdf).
- Who: any person (even non-CMI, local or international) testing an innovative product related to securities activities. VERIFIED.
- Requirements actually found: adequate resources; fit and proper; integrity and due skill; disclose material changes; due diligence on rules; technical and business expertise; defined target clients, milestones, risks and exit strategy; product must involve a regulated securities activity and be advanced enough to test; CMA may impose limits on client numbers, transaction sizes and **capital "if any"**. Commencement requirements typically include establishing a Saudi commercial entity, conflict policies, AML compliance, infosec/technology tests. VERIFIED. No fixed capital amount.
- Duration: **experiment period max two years** from commencement (Art. 10); extension request at least three months before expiry, exceptional only; suspensions total max three months; after expiry either exit or scale up to full compliance. VERIFIED.
- Applications accepted all year, assessed in batches announced on the website (Art. 1(D)). VERIFIED. Application route now per FinTech Lab page: complete the FinTech application form and **email Fintech.Expermit@cma.gov.sa** (page last modified 19/07/2026). VERIFIED (https://cma.gov.sa/en/Market/fintech/Pages/default.aspx). The 2021 instrument says "channels available on FinTech Lab web page".
- Sandbox-like but **no separate "Regulatory Sandbox" instrument** found beyond the ExPermit. List of permitted companies: https://cma.gov.sa/en/Market/fintech/Pages/ExpFinTechs.aspx (not read).

---

## 7. Things that are NOT CMA licences (boundary / absent categories)

- **Foreign investment**: Rules for Foreign Investment in Securities (Res. 2-26-2023, amended 05/01/2026) let foreign natural and legal persons, resident or not, invest in all listed securities, debt and fund units; non-resident foreign investor cap 10% per issuer (except strategic investors), aggregate foreign cap 49%; GCC citizens outside the Rules. VERIFIED (foreign.pdf). So there is **no investor registration/QFI licence in the rules text**. The "opens to all foreign investors from 1 Feb 2026" date comes from secondary sources — UNVERIFIED (https://www.bclplaw.com/en-US/events-insights-news/saudi-arabia-opens-capital-market-to-all-foreign-investors-from-february-2026.html).
- **Digital assets / crypto / tokenisation / open finance**: **No CMA licence category found** in any CMA regulation list, services catalog or news I read. Not found ≠ does not exist; UNVERIFIED either way. (Open banking and payments belong to SAMA — see below.)
- **Shariah governance** (تعليمات الحوكمة الشرعية في مؤسسات السوق المالية, Res. 22/06/2022): obligations on CMIs, not a separate licence. Existence VERIFIED; contents not read.
- **Corporate Governance Regulations, Merger and Acquisition Regulations, Market Conduct Regulations**: conduct regimes, no licence. VERIFIED to exist (list).
- **Independent Financial Advisor (M&A)**: a role under the M&A Regulations (Glossary), appointed by the offeree; the adviser must be CMA-authorised. VERIFIED (Glossary definition), no separate licence.

---

## 8. Application channel, stages, timelines

- **Portal**: "Unified Business Sector Portal" (CMA e-service ID 1: "To apply and manage for Authorization to conduct Securities Business in the Kingdom and apply and manage applications of Capital Market Institutions") — also called "Authorisation System" / "Unified E-Services Platform" on other CMA pages. Hotline 800-245-1111, info@cma.org.sa. VERIFIED (https://cma.gov.sa/en/Services/Pages/Details.aspx?FilterField1=ID&FilterValue1=1&FilterType1=Counter and https://cma.gov.sa/en/Services/Pages/PublicServices.aspx).
- **Service "Apply for Authorisation to Conduct Securities Business"** (ID 38): fees **SAR 15,000–85,000** (study fee varies by activity applied for); channel Unified Business Sector Portal; duration field blank on the page. Documents listed: trade name reservation (Ministry of Commerce), business plan, founding documents, 12-month projected financial statements, organisational structure, ownership structure and key controllers, third-party arrangements, service terms, administrative decision, commercial register if existing; read registrable-function requirements first. VERIFIED. The portal-wide service card says **"0–60 Business Days (varies by service)"**, cost "0–85,000 SAR". VERIFIED.
- **Service "Commencement of Business"** (ID 41): free, same portal. VERIFIED.
- **Typical stages (VERIFIED from CMIR + service pages)**: (1) reserve trade name; pay study fee; (2) submit authorisation application with Annex 3.1 documents and registrable-function applications; (3) CMA enquiries / additional information (applicant has 30 days per request); (4) CMA notifies the file is complete, then decides within a maximum of 30 days; (5) approval letter with permitted business profile and conditions; (6) satisfy Annex 3.1 commencement requirements; (7) submit Commencement of Business request; CMA confirms; (8) licence valid ten years, auto-renewing. King & Spalding's description of a "conditional approval, then approval to commence" matches (secondary, https://www.kslaw.com/insights/articles/establishing-a-regulated-financial-institution-in-saudi-arabia-key-considerations-for-capital-market-institutions).
- **Published timelines (all VERIFIED)**: CMI licence — decision max 30 days after completeness notice (CMIR Art. 7(c)), portal says up to 60 business days overall; registered person — aim 30 days; public fund — 30 days (30 business days on service page); RE fund — 30 days; IPO prospectus — 45 days (service page: 45 business days); debt offer — 20 days; Parallel Market — 30 days; exchange/CRA — 30 days after completeness; Real-estate contribution certificates — 30 days; FinTech ExPermit — no decision deadline published (batch-based).
- **Not found**: any statement of guaranteed end-to-end timeline from first contact to commencement.

---

## 9. Boundaries with SAMA and the Insurance Authority

- **SAMA (البنك المركزي السعودي)**: SBR Annex 1 makes SAMA an exempt person; clearing services SAMA provides to local banks are outside CCP Regs; local banks that become clearing members stay under SAMA supervision with a CMA–SAMA cooperation memorandum; e-money institutions and finance companies "licensed by SAMA" appear in CMA fund rules as permitted distributors / counterparties. VERIFIED (sbr.pdf, ccp.pdf, funds.pdf, finfunds.pdf). A bank doing securities business via a subsidiary needs CMA licence; CMIR Art. 10(c)(1) allows associated activities only if they need no other regulator's authorisation. VERIFIED. SAMA's own licences (payments, open banking, finance companies, credit bureaus) are outside CMA — UNVERIFIED from memory (no SAMA site read).
- **Insurance**: the in-force SBR Annex 1(c) text exempts "an insurance company ... in relation to its insurance activities regulated by SAMA" — i.e., the CMA text still names SAMA, not the newer Insurance Authority (هيئة التأمين). VERIFIED (that wording). That the Insurance Authority now supervises insurers and the exact CMA–IA split on investment-linked products is **UNVERIFIED – from memory**; no official IA page read.

---

## 10. Item count

Distinct licence / authorisation / registration / permit types catalogued (numbered sections): 
1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 (permission), 1.9 (draft) = 9; 2.1 = 1 (plus 9 exams); 3.1–3.8 = 8; 4.1–4.6 = 6; 5.1–5.6 = 6 (counting 5.1 as one, 5.2 commodity exchange separate); 6.1 = 1. 
Total listed items: **31** (of which 3 are draft/proposal-only or non-standalone: 1.8 permission, 1.9 offshore draft, and 3.8 defined term with no separate licence).
