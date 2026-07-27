# Business Partner Network Operating Model

## 1. Core proposition

Business Partner helps companies build two commercial networks:

1. **Customer Network** — qualified buyers, leads, introductions, meetings and sales opportunities.
2. **Supplier Network** — vetted suppliers, recruitment partners, contractors, service providers and strategic partners.

Business Partner does not merely sell contact lists. It qualifies both sides, confirms interest, arranges meetings, tracks negotiations and protects its commercial entitlement through documented mandates and introduction records.

## 2. Commercial roles

### Buyer mandate
A company appoints Business Partner to find customers, distributors, channels, investors, suppliers or strategic partners.

### Supplier mandate
A supplier appoints Business Partner to generate qualified opportunities and introduce it to buyers.

### Dual-sided transaction
Business Partner may have separate agreements with both sides when this is disclosed and legally permissible. Each agreement must define the exact service, commission trigger and payment responsibility.

## 3. Primary request types

- Customer acquisition
- Supplier sourcing
- Recruitment partner sourcing
- Distribution partner sourcing
- Investor introduction
- Strategic partnership
- Deal matching
- General business introduction

## 4. Intake data model

### Organization
- Legal name
- Brand name
- Country
- City
- Sector
- Website
- Company size
- Commercial registration or equivalent
- Decision-maker name and title

### Mandate
- Request type
- Requirement summary
- Target sector
- Target geography
- Target company size
- Minimum contract value
- Expected volume
- Urgency
- Exclusivity status
- Mandate start and end dates

### Commercial terms
- Fee model
- Commission percentage
- Fixed setup fee
- Minimum success fee
- Retainer
- Payment milestone
- VAT treatment
- Commission protection period

### Qualification
- Budget confirmed
- Authority confirmed
- Need confirmed
- Timeline confirmed
- Documents received
- Compliance approved

## 5. Pipeline stages

1. New Request
2. Initial Review
3. Qualification Required
4. Qualified
5. Mandate Drafted
6. Mandate Signed
7. Research in Progress
8. Prospects Identified
9. Outreach Started
10. Interest Confirmed
11. Meeting Scheduled
12. Meeting Completed
13. Proposal or Negotiation
14. Agreement Reached
15. Commission Due
16. Commission Paid
17. Closed Won
18. Closed Lost
19. On Hold

## 6. Matching engine

Each opportunity and each company receives structured attributes. Matching uses weighted criteria:

- Sector fit: 25%
- Geography fit: 15%
- Product or service fit: 20%
- Company size fit: 10%
- Commercial capacity: 10%
- Timing and readiness: 10%
- Compliance and reputation: 10%

### Match score bands

- 85–100: Priority Match
- 70–84: Strong Match
- 55–69: Review Match
- Below 55: Do Not Introduce Yet

No introduction should be made solely from an AI score. A human review is required before sending either party's details.

## 7. Introduction protection

Every introduction should generate an immutable introduction record containing:

- Introduction ID
- Date and time
- Mandate ID
- Buyer company
- Supplier or target company
- Introduced contacts
- Communication channel
- Meeting date
- Responsible Business Partner representative
- Evidence links
- Protection period end date

The introduction email must keep Business Partner copied. Meeting invitations should be created by Business Partner whenever possible.

## 8. Required agreements

### Client acquisition mandate
Defines target customers, territory, exclusivity, success fee, commission trigger and protection period.

### Supplier representation agreement
Defines the supplier's services, target buyers, lead qualification standard, fee and non-circumvention obligations.

### Introduction acknowledgement
A short acknowledgement sent after the introduction confirming that Business Partner originated the opportunity.

### Non-circumvention clause
Protects Business Partner from the parties bypassing it during the agreed protection period.

### Commission confirmation
Issued when the parties reach a commercial agreement and records the commission amount, due date and supporting evidence.

## 9. Recommended commercial models

### Model A — Retainer plus success fee
Best for long or complex mandates.

- Monthly retainer covers research, qualification and outreach.
- Success fee applies when a defined commercial event occurs.

### Model B — Fixed setup fee plus commission
Best for SMEs and structured campaigns.

- Setup fee covers onboarding, positioning, target-list preparation and campaign setup.
- Commission applies to won business.

### Model C — Success fee only
Use selectively where the opportunity value is high, scope is narrow, buyer authority is verified and the mandate is exclusive.

### Model D — Introduction fee
A fixed fee becomes due after a qualified meeting or accepted introduction. Suitable where transaction tracking is difficult.

## 10. Commission triggers

The agreement must choose one or more precise triggers:

- Qualified meeting completed
- Proposal requested
- Letter of intent signed
- Purchase order issued
- Contract signed
- First invoice issued
- First payment received
- Revenue collected during protection period

Avoid using only the phrase “deal completed” because it is ambiguous.

## 11. Automation workflow library

### WF-01 Universal Intake
Receives requests from website, WhatsApp, email or manual entry; validates data; creates or updates organization and contact records; creates a mandate.

### WF-02 Qualification
Sends structured questions, scores readiness and creates follow-up tasks.

### WF-03 Mandate Generation
Creates the correct agreement from a template and sends it for signature.

### WF-04 Target Research
Builds candidate company lists from approved data sources and removes duplicates.

### WF-05 Outreach
Runs approved bilingual outreach sequences with timezone-aware sending.

### WF-06 Reply Classification
Classifies replies as interested, not interested, referral, follow-up, wrong contact or unsubscribe.

### WF-07 Meeting Coordination
Offers time slots, creates calendar events, keeps Business Partner in the invitation and logs the meeting.

### WF-08 Match Scoring
Scores compatible buyer and supplier records and sends high-scoring matches for human approval.

### WF-09 Introduction Record
Creates the formal introduction record and sends acknowledgement messages.

### WF-10 Deal Tracking
Tracks proposals, negotiations, contracts, purchase orders, invoices and payments.

### WF-11 Commission Control
Calculates commission, generates reminders and flags overdue amounts.

### WF-12 Daily Management Report
Reports new mandates, outreach, replies, meetings, open negotiations, expected commissions and blocked items.

## 12. Dashboards

### Owner dashboard
- Active mandates
- Qualified opportunities
- Meetings this week
- Negotiations in progress
- Expected commission
- Collected commission
- Overdue commission
- Performance by source and sector

### Client dashboard
- Mandate status
- Target profile
- Prospects reviewed
- Outreach progress
- Interested companies
- Meetings
- Documents
- Commercial outcomes

### Supplier dashboard
- Buyer opportunities
- Match score
- Introduction status
- Meetings
- Proposals
- Agreements
- Commission obligations

## 13. Governance rules

- No outreach without an approved mandate or internal authorization.
- No sharing of confidential details before both sides pass qualification.
- Every introduction must have an audit trail.
- Every commission must reference a mandate and an introduction record.
- Sensitive records must be segregated by client workspace.
- One client's information must never appear in another client's agent context.
- AI may recommend, summarize and score; humans approve introductions and commercial commitments.

## 14. Initial MVP

The first release should include:

1. Universal intake form
2. Company and contact records
3. Mandate record
4. Qualification checklist
5. Buyer and supplier pipelines
6. Matching score
7. Meeting scheduling
8. Introduction record
9. Commission tracker
10. Daily report

## 15. Definition of done

The system is ready for live use when one request can move end-to-end from intake to qualification, signed mandate, approved target list, outreach, reply, meeting, introduction, agreement and commission tracking without manual duplication across systems.
