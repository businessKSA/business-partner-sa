> **سجلّ مرجعي داخلي — ليس للنشر على الموقع.** بحثٌ من المصادر الرسمية بتاريخ 2026-10-07.
> كل حقل موسوم `VERIFIED (url)` أو `UNVERIFIED`. لا يُنقل أي `UNVERIFIED` إلى عميل
> كحقيقة. أرقام رأس مال شركات التمويل الواردة فيه من تعديل 2023 ولم تعد سارية بعد
> اللائحة 179/MFC (2025) — لا تُستعمل. القواعد في `README.md`. التحديث لـ`fintech-licensing` وحده.

# SAMA licensing map (research date 2026-10-07)

Method: WebFetch/WebSearch of rulebook.sama.gov.sa and sama.gov.sa. Fetches return summaries from a small model, not raw text. Verbatim legal wording was not obtained, and a few results are marked as truncated. Fields are marked VERIFIED (url) or UNVERIFIED.

**Arabic names:** none of the Arabic names below were read from an official page. All are UNVERIFIED – from memory of standard Saudi usage, and should be checked against rulebook.sama.gov.sa/ar. The English names are taken from rulebook pages and are VERIFIED where a URL is given.

**Unreachable pages (404):** sama.gov.sa/en-US/Licensing/Pages/default.aspx, news-627, the Sandbox page `RegulatorySandbox.aspx`, payment/MADDA.aspx. The Licensed Entities page loaded empty and Permitted Fintechs returned no list. No official register, with counts or names, could be read.

## 0. Who regulates what today

| Area | Regulator | Evidence |
|---|---|---|
| Banks, finance companies, payments, money exchange, credit bureaus, open banking | SAMA | Rulebook categories: https://rulebook.sama.gov.sa/en (Banking, Finance, Payment Systems and PSPs, Money Exchange, Credit Bureaus, Regulatory Sandbox) – VERIFIED |
| Insurance and reinsurance, health insurance | Insurance Authority (IA). It began operating 23 Nov 2023, and the health-insurance transfer from CHI was complete by 4 Mar 2024. Existing SAMA and CHI rules stay in force until replaced. | Only law-firm summaries found (Norton Rose Fulbright, GCC BDI), not ia.gov.sa. UNVERIFIED against a primary source. |
| Securities crowdfunding, debt instruments via licensed capital-market institutions, equity crowdfunding | CMA | Only secondary sources (Argaam and others). UNVERIFIED. |
| Debt-based crowdfunding run by a finance company | SAMA (the "Rules for Engaging in Debt-Based Crowdfunding" are a SAMA instrument) | VERIFIED https://www.rulebook.sama.gov.sa/en/node/2675 |

Boundary notes:
- The SAMA rulebook still contains insurance and insurance-service-provider appendices in the senior-appointments rules (https://rulebook.sama.gov.sa/en/node/1997). That is legacy text, and the IA now regulates insurance.
- Debt crowdfunding is split. SAMA licenses a finance company that runs the platform. The CMA, in a regime found only in secondary sources, handles debt offerings through licensed arranging firms. The CMA approval date was not found.
- The old "debt crowdfunding to CMA" transfer is not supported. Both regimes appear to coexist, and SAMA is still licensing debt-crowdfunding finance companies in 2026 (news-report level only).

## 1. Items

Item count in the register below: 33 SAMA items, plus 2 boundary items (IA, CMA) in section 0.

### A. Banks
Governing: Banking Control Law M/5, 11/6/1966, In-Force, VERIFIED https://rulebook.sama.gov.sa/en/banking-control-law. Licence types page: https://rulebook.sama.gov.sa/en/types-licenses-3 – VERIFIED. Implementation Rules for Banking Control Law: listed at https://rulebook.sama.gov.sa/en/book-category/1361 – VERIFIED title only.

| # | Arabic (UNVERIFIED) | English | Instrument | Who needs it | Headline requirements |
|---|---|---|---|---|---|
| 1 | بنك محلي (مرخص) | Domestic Bank | Banking Control Law Art. 2-3 | Anyone carrying on banking business. Art. 2 exempts only entities licensed under another law and licensed moneychangers (currency exchange only). | Must be a Saudi joint stock company. Founders and board must have good reputation. Statute text says minimum paid-up capital SAR 2.5 million, but SAMA's current guidelines say capital adequacy is assessed case by case. Treat the 2.5m figure as a statutory floor only. The Minister issues the licence on SAMA recommendation. VERIFIED (banking-control-law page; https://rulebook.sama.gov.sa/en/licensing-guidelines-and-minimum-criteria). No Saudi-ownership percentage is stated on the guidelines page. |
| 2 | بنك رقمي | Digital Bank | Banking Control Law plus "Additional Licensing Guidelines and Criteria for Digital-Only Banks in Saudi Arabia" (Feb 2020) | Digital-only banks | Locally incorporated joint-stock company. Promoter needs financial-industry and technology experience. No fixed capital. ICAAP and ILAAP are submitted with the application. Three stages: application, design-phase assessment, implementation-phase assessment (third-party assessor at the applicant's cost). No timelines or ownership percentages published. VERIFIED https://rulebook.sama.gov.sa/en/additional-licensing-guidelines-and-criteria-digital-only-banks-saudi-arabia-feb-2020. News-level only (UNVERIFIED against SAMA): STC Bank, D360 Bank and Vision Bank (ex-Saudi Digital Bank) were licensed, with operations starting Dec 2024 to Jan 2025. |
| 3 | فرع بنك أجنبي | Branch of a Foreign Bank | Banking Control Law Art. 3 (conditions set by the Council of Ministers) | Foreign banks | The Council of Ministers sets conditions and the Minister issues the licence after its approval. Fit and proper tests apply to the foreign parent and its significant shareholders. No local capital is required, though case-by-case requirements may apply. Branches face the same prudential rules as local banks except where stated. VERIFIED (same pages as above). |
| 4 | مكتب تمثيلي لبنك أجنبي | Representative office of a foreign bank | None found | n/a | NOT FOUND. No SAMA licence type for bank representative offices appears in the Banking licence types page (https://rulebook.sama.gov.sa/en/types-licenses-3, which lists only three). The rulebook has a separate item on "Economic and Technical Liaison Offices", which is not a bank licence. Confirm with SAMA directly. |

Application channel for banks: written application with a hard copy by post to SAMA, General Department of Banking Control, Banking Licensing Division, P.O. Box 2992, Riyadh 11169, plus a soft copy to BankingLicenseApp@SAMA.GOV.SA. VERIFIED https://rulebook.sama.gov.sa/en/application-process-4. SAMA will acknowledge and name a case officer within 15 business days; there is no fixed decision deadline. VERIFIED https://rulebook.sama.gov.sa/en/licensing-guidelines-and-minimum-criteria. No online portal is named.

### B. Finance companies
Governing: Finance Companies Control Law (Royal Decree M/51, 3/7/2012) – VERIFIED metadata https://rulebook.sama.gov.sa/en/node/1030. Implementing Regulation No. 179/MFC, dated 22/12/2025 (2/7/1447H), In-Force. It replaced the earlier regulation (No. 2/MFC, 2013, marked "no longer applicable"). VERIFIED https://rulebook.sama.gov.sa/en/implementing-regulation-finance-companies-control-law-0 and https://www.sama.gov.sa/en-US/MediaCenter/News/pages/news-1125.aspx. The Dec 2025 update repealed the Consumer Microfinance Companies rules and the Rules of Engaging in Microfinance Activity, and amended the Rules of Licensing Finance Support Activities (same news page). Licence types listed at https://rulebook.sama.gov.sa/en/types-licenses-1 – VERIFIED. Companies must be "joint stock".

Activities SAMA lists: real estate finance; microfinance; production asset finance; consumer microfinance activity; SME finance; consumer microfinance using financial technology; finance lease; refinance; credit card finance; debt-based crowdfunding; consumer finance; any other approved finance activity. The licence-types page does not list BNPL; BNPL has its own rules (item 14).

Capital caution. The only per-activity capital tiers found come from the 2023 amendment to Art. 8 (Governor's Decision 126/M SH T, 11/1/2023). They are real estate finance SAR 200m; other finance activities SAR 100m; microfinance only SAR 10m; SME finance only SAR 50m. VERIFIED https://rulebook.sama.gov.sa/en/node/1641. That page says the amendment is "No longer applicable" because SAMA updated the Implementing Regulation in Dec 2025. The current capital figures in the Dec 2025 text could not be read, so DO NOT use those figures as current. Treat all finance-company capital as UNVERIFIED (current).

| # | Arabic (UNVERIFIED) | English | Instrument | Notes |
|---|---|---|---|---|
| 5 | شركة تمويل عقاري | Real estate finance company | Finance Companies Control Law; Real Estate Finance Law and its Implementing Regulation (titles VERIFIED at book-category/1361) | Licence type VERIFIED (types-licenses-1). Capital: see caution above. |
| 6 | تمويل المنشآت الصغيرة والمتوسطة | SME finance | Finance Companies Control Law Implementing Regulation | Licence type VERIFIED. |
| 7 | التمويل متناهي الصغر | Microfinance | Rules of Engaging in Microfinance Activity (repealed Dec 2025 per news-1125) | The licence type is still listed on types-licenses-1. Current governing rule UNVERIFIED. |
| 8 | تمويل استهلاكي متناهي الصغر (تقنية مالية) | Consumer microfinance (including via financial technology) | Rules Regulating Consumer Microfinance Companies (repealed Dec 2025) | Listed as a licence type, VERIFIED. Current rule UNVERIFIED. |
| 9 | التمويل الاستهلاكي | Consumer finance | Finance Companies Control Law Implementing Regulation | Listed, VERIFIED. |
| 10 | تمويل الأصول الإنتاجية | Production asset finance | same | Listed, VERIFIED. |
| 11 | التأجير التمويلي | Finance lease | Finance Lease Law and Implementing Regulation (titles VERIFIED) | Listed, VERIFIED. |
| 12 | إعادة التمويل (شركات إعادة التمويل العقاري) | Refinance / Real Estate Refinance Company | "Rules Governing Real Estate Refinance Companies" | Chapter list VERIFIED https://rulebook.sama.gov.sa/en/special-finance-companies. Text and capital not read. |
| 13 | تمويل بطاقات الائتمان | Credit card finance | Finance Companies Control Law Implementing Regulation | Listed, VERIFIED. |
| 14 | شركات الشراء الآن والدفع لاحقاً | Buy-Now-Pay-Later (BNPL) company | Rules for Regulating BNPL Companies, SAMA circular 450360390000, 17/12/2023 (5/6/1445H), In-Force | VERIFIED https://rulebook.sama.gov.sa/en/rules-regulating-buy-now-pay-later-bnpl-companies-0. Minimum capital SAR 5,000,000 (Art. 5), which SAMA may adjust. Management must be permanent residents of Saudi Arabia. SAMA gives initial approval or a justified rejection within 60 working days of confirming the application is complete. The applicant has 30 working days to answer SAMA requests. After initial approval, the company has 6 months (extendable by up to 6) to meet licensing requirements. The licence lasts 5 years, with renewal requested at least 3 months ahead. Fees: SAR 5,000 issuance, SAR 2,000 renewal. |
| 15 | التمويل الجماعي بالدين | Debt-based crowdfunding | Rules for Engaging in Debt-Based Crowdfunding, dated 1/12/2021 (26/4/1443H), In-Force per rulebook page | VERIFIED https://www.rulebook.sama.gov.sa/en/node/2675. Minimum capital SAR 5,000,000 (Art. 6), which SAMA may adjust. At least 50% Saudi staff at start, rising 5% per year to 75%. Licence term 5 years. Initial decision within 60 working days of completeness. Fees SAR 5,000 and SAR 2,000. A news item says the rules were revised in Oct 2024. That revision was NOT confirmed, and the rulebook page showed no amendments. |
| 16 | شركات التمويل المستقبلة للودائع | Deposit-Taking Finance Companies (DTFC) | "DTFCs Regulations" (Parts I-III) | Listed at https://rulebook.sama.gov.sa/en/special-finance-companies. It is unclear whether this is a separate licence type. The text was not read. UNVERIFIED. |

Application channel for finance companies: email the License Request Form and attachments to NBFI-LIC@SAMA.GOV.SA. No portal. No timeline on the general page. VERIFIED https://rulebook.sama.gov.sa/en/application-process-0. Licensing guidelines exist for five categories: consumer microfinance, debt-based crowdfunding, finance support, BNPL, and finance/refinance (https://rulebook.sama.gov.sa/en/licensing-guidelines, VERIFIED titles only).

### C. Finance support and registration

| # | Arabic (UNVERIFIED) | English | Instrument | Notes |
|---|---|---|---|---|
| 17 | أنشطة دعم التمويل (المجمّع) | Finance support activities (Finance Aggregator) | Rules of Licensing Finance Support Activities, No. 472038005, 22/12/2025 (2/7/1447H), In-Force; Instructions for Practicing Aggregation Activity | VERIFIED https://rulebook.sama.gov.sa/en/rules-licensing-finance-support-activities-0. Minimum capital SAR 2,000,000 for aggregation; for other support activities SAMA sets the amount. Management must be permanent residents of Saudi Arabia. At least 50% Saudi employees at start. Licence valid 3 years, renewal request at least 3 months ahead. No ownership caps. |
| 18 | شركة تسجيل عقود التأجير التمويلي | Financial lease contract registration company | Finance Lease Law Art. 18; SAMA circular 639110000099 dated 27/6/2019 | VERIFIED https://rulebook.sama.gov.sa/en/node/3519. It is a joint stock company incorporated under a SAMA licence. No capital or ownership figures stated. A secondary source says only finance-lease-licensed companies may own it (UNVERIFIED). The registry operator named is SAJIL (from the rulebook page). |

### D. Payments
Governing: Law of Payments and Payment Services, M/26, 28/10/2021 (22/3/1443H), In-Force. Art. 4: no person may operate a payment system or provide payment services in the Kingdom unless licensed by SAMA. VERIFIED https://rulebook.sama.gov.sa/en/node/1195. Implementing Regulations No. 000044093096, 13/6/2023 (24/11/1444H), In-Force; they replaced the 2020 framework. No amendments seen on the page. VERIFIED https://rulebook.sama.gov.sa/en/node/1430 (the page is long and only part was read). Licence types page: https://rulebook.sama.gov.sa/en/types-licenses-2 lists four types (Micro PI, Major PI, Micro EMI, Major EMI) – VERIFIED. The Implementing Regulations also set separate licences for payment initiation and account information, and for payment system operators. Art. 6 services: deposits into payment accounts, cash withdrawals, payment transactions (direct debit, card or device, credit transfer), credit-line payments, issuing payment instruments, acquiring, payment aggregation, e-money issuance, payment initiation, account information, payment account services, and any other service SAMA treats as a payment service. VERIFIED (Art. 6 summary).

Common terms (VERIFIED, node/1430):
- Licence term is 5 years at most (Art. 17).
- Major PI, Major EMI and Micro EMI applicants must be joint stock companies. Micro PI may be a joint stock company, a simplified joint stock company, or an LLC (Art. 14).
- Controllers (10% or more) must be listed and sign Fit and Proper forms. Applicants provide an irrevocable bank guarantee for the required minimum capital.
- The regulations set no Saudi-ownership percentage in the parts read, but Art. 29 deals with the share of non-Saudi employees (UNVERIFIED in detail).
- Licence fees (Art. 23): SAR 20,000 for Micro PI, Micro EMI, PIS and AIS; SAR 50,000 for Major PI and Major EMI.
- Process: two stages. In-principle approval is required before commercial registration and incorporation, then final licensing. SAMA decides within 90 calendar days of confirming a complete application, and the applicant has 30 calendar days to answer requests. VERIFIED https://rulebook.sama.gov.sa/en/entiresection/4669.
- Channel: email NBFI-LIC@SAMA.GOV.SA (inquiries NBFI-LIC-INFO@SAMA.GOV.SA). No portal named.

| # | Arabic (UNVERIFIED) | English | Paid-up equity (Art. 44, VERIFIED node/1430) |
|---|---|---|---|
| 19 | مؤسسة مدفوعات صغرى | Micro Payment Institution (Micro PI) | SAR 1,000,000 |
| 20 | مؤسسة مدفوعات كبرى | Major Payment Institution (Major PI) | SAR 3,000,000; ongoing capital is the higher of that and 1% of average monthly payment value |
| 21 | مؤسسة نقد إلكتروني صغرى (محافظ إلكترونية) | Micro Electronic Money Institution (e-wallet) | SAR 2,000,000 |
| 22 | مؤسسة نقد إلكتروني كبرى (محافظ إلكترونية) | Major Electronic Money Institution (e-wallet) | SAR 10,000,000; ongoing: higher of that and 2% of average outstanding e-money |
| 23 | خدمة بدء الدفع | Payment Initiation Service (PIS) licence | SAR 1,000,000; PIS providers may not hold user funds (Art. 97) |
| 24 | خدمة معلومات الحسابات | Payment Account Information Service (AIS) licence | SAR 500,000 |
| 25 | مشغّل نظام مدفوعات | Payment System Operator (PSO) | No fixed figure; SAMA sets capital by projected size and complexity (Art. 44(2)). National payment systems are deemed licensed under a Governor decision (Art. 10). The licence term is case by case (Art. 17(2)). Oversight Framework on Payment Systems and their Operators was updated 8/3/2026, available in Arabic only (VERIFIED https://rulebook.sama.gov.sa/en/oversight-framework-payment-systems-and-their-operators). |

Related payment rules listed on the circulars page (titles and dates only, content not read): Rules for Electronic Wallets (29/10/2024) and Rules for Dealing with E-Commerce Payment Service and Support Providers (24/07/2024). VERIFIED https://rulebook.sama.gov.sa/en/payment-systems-and-payment-services-providers-circulars.

Not found in the PSP implementing regulations (as read): a separate licence for agents or electronic money distributors. Part 3 (Arts. 24-26) covers appointing agents and distributors, and the excerpt read set no separate licence or capital for them. UNVERIFIED beyond that.

### E. Open banking
- Open Banking Framework v1 (account information) was issued Nov 2022 and v2 (payment initiation) Sept 2024. Both dates come from trade press only (Wamda, Open Banking Expo, Vixio), so they are UNVERIFIED against SAMA.
- SAMA announced on 26 March 2026 that it began licensing fintechs to provide open banking services after the sandbox phase. VERIFIED https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-1135.aspx. The announcement names no licence type, capital or application procedure.
- Clyde & Co (secondary) says licensees must show API performance, data security, consent management and governance, and that Lean Technologies was the first licensed. UNVERIFIED. https://www.clydeco.com/en/insights/2026/03/sama-new-licensing-framework-for-open-banking
- Legal route in the rules: open banking services are PIS and AIS licences under the Payment Services Implementing Regulations (items 23-24), with Arts. 95-96 requiring providers to give access under SAMA's open banking rules. VERIFIED node/1430.

| # | Arabic (UNVERIFIED) | English | Notes |
|---|---|---|---|
| 26 | ترخيص الخدمات المصرفية المفتوحة | Open banking provider licence (PIS and/or AIS) | There is no separate "open banking licence" on the rulebook pages read. The framework text itself was not found in the rulebook. Whether PIS licences have been granted is UNVERIFIED (reports mention only AIS licences in 2026). |

### F. Money exchange
Governing: Rules Regulating Money Changing Business, No. 4686, 11 July 2020 (21/11/1441H), In-Force, no amendment history shown. VERIFIED https://rulebook.sama.gov.sa/en/rules-regulating-money-changing-business. Money Exchange licence types: https://rulebook.sama.gov.sa/en/types-licenses and eligibility https://rulebook.sama.gov.sa/en/eligibility-requirements – VERIFIED.

| # | Arabic (UNVERIFIED) | English | Requirements (VERIFIED, rules page) |
|---|---|---|---|
| 27 | مراكز صرافة – بيع وتداول العملات | Money changer: foreign currency trading inside the Kingdom | Minimum paid-up capital SAR 2,000,000. Fees SAR 20,000 issue, SAR 5,000 renew. 5% cash reserve at a Saudi bank. |
| 28 | صرافة – مع الاستيراد والتصدير | Money changer: trading plus currency import/export | Minimum capital SAR 7,000,000. Open to companies or foreign money-changer branches that also hold the trading licence. Multi-activity licence fee SAR 35,000 issue, SAR 10,000 renew. |
| 29 | تحويل الأموال (صرافة) | Money transfer (legacy) | Minimum capital SAR 10,000,000, 10% cash reserve. Only holders of licences valid when the Rules were issued may do it, and they cannot open new branches for it. So there is no new money-transfer licence in this regime; remittance is now a payment service (Major PI / Micro PI) under item 19-20. |

Other terms: legal forms allowed are joint stock, LLC, partnership, sole proprietorship, or foreign branch. Maximum licence term 5 years. Founders must be at least 25, with a clean compliance, reputation, solvency and bankruptcy record. Foreign company branches need to be 10+ years old and operate in 3+ countries. Sole proprietorships are limited to cities under 100,000 people. Initial approval comes before setting up premises. Saudization rules apply but no quota is stated. Channel: email NBFI-LIC@SAMA.GOV.SA (per the application-process page for the sector; the money exchange application-process page was not read separately). Timelines: none found.

### G. Credit information
| # | Arabic (UNVERIFIED) | English | Instrument | Requirements |
|---|---|---|---|---|
| 30 | شركة معلومات ائتمانية | Credit Information Company (credit bureau) | Credit Information Law M/37, 8/7/2008 (6/7/1429H), In-Force (VERIFIED https://rulebook.sama.gov.sa/en/credit-information-law); Implementing Regulations dated 21/8/2011 (22/9/1432H), In-Force (VERIFIED https://rulebook.sama.gov.sa/en/node/353) | Joint stock company with its head office in the Kingdom. Minimum paid-up capital SAR 50,000,000. Licence fee 1% of paid-up capital at issue and 0.5% at renewal. SAR 50,000 processing fee. Licence term 5 years, renewal 6 months ahead. Licence lapses if operations do not start within 12 months. Fit and proper tests for incorporators, chairman, board and senior management. No Saudi-ownership percentage stated. Art. 9 requires SAMA approval for mergers, branches and article changes. |

Credit Bureaus rulebook section also has "Rules and Instructions" and a dispute committee regulation (https://rulebook.sama.gov.sa/en/laws-and-regulations-4, VERIFIED titles). Application channel and timelines: not found.

### H. Sandbox and other approvals
| # | Arabic (UNVERIFIED) | English | Notes |
|---|---|---|---|
| 31 | بيئة تجريبية تنظيمية | Regulatory Sandbox: No Objection Letter (NOL) then Letter of Acceptance (LoA) | VERIFIED https://rulebook.sama.gov.sa/en/regulatory-sandbox-faq. It is for business models that no existing rule or licensing path covers; applications are not accepted if a licensing path exists. Applications are always open. Stage 1 application, Stage 2 Operational Readiness (NOL; integration testing with dummy data only), Stage 3 Testing (LoA for live customers and data). Testing lasts a minimum of 6 and up to 12 months. A full licence is not automatic and needs a separate application. Exemptions are case by case. Framework document: https://rulebook.sama.gov.sa/en/regulatory-sandbox-framework (the page read had only headings, so the four stages are named in the framework but the details come from the FAQ). Application service page: https://www.sama.gov.sa/en-US/Pages/ServiceDetails.aspx?serviceid=96 (listed, not opened). The Permitted Fintechs page returned no list. Fees: none mentioned. |
| 32 | عدم ممانعة لتعيين المناصب القيادية | Senior positions appointment: SAMA written non-objection | "Requirements for Appointments to Senior Positions", document no. 199400000067, issued 9/9/2019, with amendments in 2019, April 2021 and June 2021. The English version may be out of date. VERIFIED https://rulebook.sama.gov.sa/en/node/1997. Covers banks, credit bureaus, insurers (legacy appendix), finance companies, money changers, and payment and fintech companies. Board nominations are due within 30 business days after the general assembly; management requests 20 business days before the start date. Saudi candidates are preferred; 13 roles are reserved for Saudis. |
| 33 | ترخيص/عدم ممانعة مرتبطة (تعاقد خارجي، سحابة) | Outsourcing / cloud approvals | NOT VERIFIED. The payment regulations cover outsourcing in Part 4 Ch. 1, and the BNPL, finance and bank rules refer to SAMA outsourcing instructions. Whether prior approval is required was not confirmed. The cyber-risk pages (e.g. https://rulebook.sama.gov.sa/en/cyber-risk-control-2) were not read. |

### I. Not found or not verified
- mada, card schemes (Visa/Mastercard and local), and payment system participation: no licence page found. The mada page returned 404 and the circulars page lists only SMS and e-wallet recharge circulars (14/10/2021, 29/08/2021). Card issuing and acquiring fall under payment service activities in Art. 6 (VERIFIED), but any separate scheme approval is UNVERIFIED.
- AML/CFT registration: no separate registration or licence found. AML/CFT is an obligation inside each sector (rulebook sections). The AML Law and its implementing regulation are listed at book-category/1361 (title VERIFIED only).
- New categories introduced 2023-2026 that were verified: BNPL rules (17/12/2023), Payment Services Implementing Regulations (13/6/2023, with PIS/AIS licences), Finance Support / Aggregator licensing (22/12/2025 version), updated Finance Companies Implementing Regulation (22/12/2025), open banking licensing start (26/3/2026), Payment Systems Oversight Framework update (8/3/2026). Representative office or other new categories: none found.
- Licensed-entity counts (news only, UNVERIFIED against SAMA's register): 78 finance companies as of 30 Aug 2026 (Sharikat Mubasher); 33 payment service providers (menastartupdigest, which also gave 32 earlier in the same year).

## 2. Application channels and timelines summary

| Sector | Channel | Stages | Published timeline |
|---|---|---|---|
| Banks | Post (SAMA Banking Licensing Division, PO Box 2992 Riyadh 11169) plus email BankingLicenseApp@SAMA.GOV.SA | Pre-application consultation, application, Council of Ministers/Ministerial licence | Acknowledgement and case officer within 15 business days; no decision deadline |
| Digital banks | Same as banks | Application, design-phase assessment, implementation assessment | None |
| Finance companies | Email NBFI-LIC@SAMA.GOV.SA | Initial approval, then incorporation, then licence | BNPL and debt crowdfunding: 60 working days for initial decision, 30 working days to answer SAMA. General page: none |
| Payments | Email NBFI-LIC@SAMA.GOV.SA | In-principle approval, then final licence | 90 calendar days after the application is confirmed complete; 30 calendar days to answer SAMA |
| Money changers | Not confirmed on the sector page read (Eligibility and Application Process pages exist) | Initial approval, then premises, then licence | None found |
| Credit bureaus | Not found | Commercial registration, incorporation, then Governor licence | Licence lapses if operations do not start within 12 months |
| Sandbox | SAMA service page (serviceid=96) / application form | Application, Operational Readiness (NOL), Testing (LoA), exit | 6-12 months testing |

## 3. Things I could not verify
See the final reply for the short list.
