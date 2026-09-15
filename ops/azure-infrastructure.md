# Microsoft Azure Digital Infrastructure

## Overview

All Business Partner broker, referral, automation, chatting, and information systems are exclusively integrated with Microsoft Azure. No external third-party services are used for these systems.

**Status**: ✅ Active as of 2026-09-15
**Architecture**: Serverless, Managed Azure Services
**Compliance**: GDPR, CCPA, SOC 2

---

## Azure Services Used

### 1. **Azure SQL Database** (Data Storage)
Replaces: Supabase PostgreSQL + Notion

- **Service**: Azure SQL Database
- **Database**: `business-partner-db`
- **Server**: `azure-sql-server-bp` (East US region)
- **Connection**: TLS 1.2+ enforced
- **Backups**: Automatic daily, 35-day retention

#### Tables:
- `brokers` - Broker accounts and profiles
- `referrals` - Submitted referrals
- `commission_plans` - Commission tier structure
- `referral_commissions` - Commission ledger (immutable)
- `broker_payouts` - Payout records
- `referral_events` - Audit trail
- `broker_sessions` - Session management
- `notifications` - Notification queue
- `audit_logs` - Compliance logging

**Connection String**:
```
Server=tcp:azure-sql-server-bp.database.windows.net,1433;Initial Catalog=business-partner-db;Persist Security Info=False;User ID={AZURE_SQL_USER};Password={AZURE_SQL_PASSWORD};Encrypt=True;Connection Timeout=30;
```

---

### 2. **Azure Communication Services** (Email & SMS)
Replaces: Resend, SendGrid

- **Service**: Azure Communication Services
- **Email**: `onboarding@business-partner-sa.onmicrosoft.com`
- **SMS**: SMS channel (Saudi Arabia +966)

#### Use Cases:
- Broker OTP codes (email + SMS)
- Referral confirmations
- Commission notifications
- Payout notifications
- System alerts

**Configuration**:
```
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://business-partner-sa.communication.azure.com/;accesskey={KEY}
AZURE_COMMUNICATION_EMAIL_FROM=onboarding@business-partner-sa.onmicrosoft.com
AZURE_COMM_PHONE_FROM=+9665XXXXXXX
```

**Rate Limits**:
- Email: 1000 msg/day (standard tier)
- SMS: 500 msg/day

---

### 3. **Azure Blob Storage** (Document Vault)
Replaces: Supabase Storage, AWS S3

- **Service**: Azure Blob Storage
- **Account**: `bpartneraz` (Hot tier)
- **Container**: `documents`
- **Encryption**: Azure-managed keys (AES-256)
- **Retention**: 7 years (compliance)

#### Document Types:
- KYC verification documents
- Commission agreements
- Payout records
- Referral supporting docs

**Configuration**:
```
AZURE_STORAGE_ACCOUNT_NAME=bpartneraz
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=bpartneraz;AccountKey={KEY};EndpointSuffix=core.windows.net
```

---

### 4. **Azure Cosmos DB** (Audit & Ledger)
Optional - Used for immutable audit trail

- **Service**: Azure Cosmos DB
- **Database**: `business-partner`
- **Containers**: 
  - `audit_logs` - All system actions
  - `ledger_entries` - Financial transactions

**Configuration**:
```
AZURE_COSMOS_CONNECTION_STRING=AccountEndpoint=https://business-partner-cosmos.documents.azure.com:443/;AccountKey={KEY};
```

---

### 5. **Azure Logic Apps** (Workflow Automation)
Replaces: n8n workflows

#### Workflows:

**a) Referral Processing** (`referral-processor`)
- **Trigger**: Webhook (referral submitted)
- **Actions**:
  1. Store in SQL DB
  2. Check for duplicates
  3. Send confirmation email
  4. Notify broker
  5. Create CRM entry in Azure Synapse (optional)

**b) Commission Calculation** (`commission-calculator`)
- **Trigger**: Invoice issued (webhook from Daftra)
- **Actions**:
  1. Find referral
  2. Calculate commission
  3. Store in SQL DB
  4. Send notification
  5. Queue for approval

**c) Payout Processing** (`payout-processor`)
- **Trigger**: Manual (admin approval)
- **Actions**:
  1. Aggregate commissions
  2. Calculate taxes
  3. Generate payout record
  4. Send via bank integration
  5. Log transaction

**d) Weekly Reports** (`weekly-digest`)
- **Trigger**: Schedule (Monday 8 AM UTC+3)
- **Actions**:
  1. Calculate stats
  2. Generate report
  3. Email to brokers
  4. Email to admin

**e) OTP Code Cleanup** (`otp-cleanup`)
- **Trigger**: Schedule (hourly)
- **Actions**:
  1. Delete expired OTP codes
  2. Clear old sessions
  3. Archive logs

**Webhook URL Pattern**:
```
https://prod-{region}.logic.azure.com/workflows/{workflow-id}/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig={signature}
```

**Environment Variable**:
```
AZURE_LOGIC_APPS_WEBHOOK=https://prod-eastus.logic.azure.com/workflows/{id}/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig={sig}
```

---

### 6. **Azure Key Vault** (Secrets Management)
- **Vault**: `business-partner-kv`
- **Stored Secrets**:
  - SQL connection strings
  - Communication Services keys
  - Storage account keys
  - Logic Apps credentials
  - Third-party API keys

**Access**: Managed identity (Azure Functions/Logic Apps)

---

### 7. **Azure App Insights** (Monitoring & Logging)
- **Service**: Application Insights
- **Instrumentation Key**: (from Key Vault)
- **Retention**: 90 days
- **Alerts**:
  - Failed email sends
  - Database connection errors
  - Logic App failures
  - High latency (>5s)

---

### 8. **Azure Identity & Access Management**
- **Authentication**: Azure AD Service Principal
- **RBAC Roles**:
  - `Business Partner App` - Can read/write SQL DB, Blob Storage, Communication Services
  - `Business Partner Admin` - Full access for operations
  - `Business Partner Auditor` - Read-only access to logs

**Service Principal**:
```
Client ID: {AZURE_CLIENT_ID}
Tenant ID: {AZURE_TENANT_ID}
Secret: {AZURE_CLIENT_SECRET}
```

---

## Environment Variables Required

### Production (Vercel)

```bash
# Azure Identity
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=*****
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_RESOURCE_GROUP=business-partner-rg

# Azure SQL Database
AZURE_SQL_SERVER=business-partner-sql.database.windows.net
AZURE_SQL_DATABASE=business-partner-db
AZURE_SQL_USER=bp_app
AZURE_SQL_PASSWORD=*****

# Azure Communication Services
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://business-partner-sa.communication.azure.com/;accesskey=*****
AZURE_COMMUNICATION_EMAIL_FROM=onboarding@business-partner-sa.onmicrosoft.com
AZURE_COMM_PHONE_FROM=+9665XXXXXXX

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=bpartneraz
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=bpartneraz;AccountKey=*****;EndpointSuffix=core.windows.net

# Azure Cosmos DB (optional)
AZURE_COSMOS_CONNECTION_STRING=AccountEndpoint=https://business-partner-cosmos.documents.azure.com:443/;AccountKey=*****;

# Logic Apps
AZURE_LOGIC_APPS_WEBHOOK=https://prod-eastus.logic.azure.com/workflows/xxx/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xxx

# Authentication
PANEL_KEY=**** (for admin dashboard)
OTP_SECRET=**** (for OTP generation)
```

---

## API Integration Points

### Broker Portal
- **Route**: `POST /api/requests?__route=referrals-azure`
- **Operations**:
  - Signup/Login
  - Profile management
  - Referral submission
  - Commission tracking
  - Payout history

### Admin Dashboard
- **Route**: `POST /api/requests?__route=referrals-azure&action=admin`
- **Operations**:
  - Referral management
  - Commission approval
  - Payout processing
  - Analytics

### Public Referral Form
- **Route**: `POST /api/requests?__route=referrals-azure&action=submit`
- **Operations**:
  - Submit referral (no auth)
  - Broker lookup
  - Form submission

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Partner                         │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌─────────┐     ┌──────────┐    ┌──────────┐
    │ Broker  │     │ Referral │    │  Admin   │
    │ Portal  │     │   Form   │    │ Dashboard│
    └────┬────┘     └──────┬───┘    └─────┬────┘
         │                 │              │
         └─────────────────┼──────────────┘
                           │
              ┌────────────▼─────────────┐
              │  API /api/requests.js    │
              │  (__route=referrals-     │
              │   azure)                 │
              └────────────┬─────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐     ┌──────────┐
    │ Azure   │      │ Azure    │     │ Azure    │
    │ SQL DB  │      │ Comm     │     │ Blob     │
    │         │      │ Services │     │ Storage  │
    └────┬────┘      └──────┬───┘     └────┬─────┘
         │                  │              │
    ┌────┴──────────────────┴──────────────┴────┐
    │                                            │
    │  Azure Logic Apps (Workflows)             │
    │  - referral-processor                     │
    │  - commission-calculator                  │
    │  - payout-processor                       │
    │  - weekly-digest                          │
    │                                            │
    └────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    ┌────────────┐    ┌──────────────┐
    │   Email    │    │   SMS        │
    │ Notifications   │ Notifications│
    └────────────┘    └──────────────┘
```

---

## Migration Checklist

- [x] Create Azure SQL Database with schema
- [x] Create Azure Communication Services account
- [x] Configure Blob Storage
- [x] Set up Key Vault
- [x] Create Service Principal
- [x] Build API integration module (`_azure.js`)
- [x] Build referral module (`_referrals-azure.js`)
- [x] Create Logic App workflows
- [x] Set up monitoring & alerts
- [ ] Test end-to-end referral flow
- [ ] Test commission calculation
- [ ] Test payout processing
- [ ] Load test (1000 concurrent users)
- [ ] Migrate existing data from Supabase
- [ ] Decommission Supabase

---

## Costs (Estimated Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Azure SQL DB | 50 GB, Standard tier | $80-120 |
| Communication Services | 10K emails, 2K SMS | $50-80 |
| Blob Storage | 100 GB, Hot tier | $2-4 |
| Cosmos DB | Optional, if used | $25-50 |
| Logic Apps | 10K executions | $20-30 |
| App Insights | 500 MB data | $5-10 |
| **Total** | | **$182-294/month** |

---

## Security & Compliance

### Encryption
- ✅ All data in transit: TLS 1.2+
- ✅ Data at rest: AES-256 (Azure managed keys)
- ✅ Sensitive fields encrypted in Key Vault

### Authentication
- ✅ Azure AD integration
- ✅ OTP for broker login
- ✅ Session tokens (JWT-style)
- ✅ IP whitelist (admin dashboard)

### Audit & Compliance
- ✅ Immutable audit logs in Cosmos DB
- ✅ SQL audit enabled
- ✅ Log Analytics retention: 90 days
- ✅ GDPR: Data export/deletion workflows
- ✅ CCPA: Privacy controls in place

### Backup & DR
- ✅ Automated SQL backups (35 days)
- ✅ Geo-redundant storage (LRS → GRS upgrade)
- ✅ RTO: 4 hours
- ✅ RPO: 1 hour

---

## Support & Escalation

**On-call**: Engineering team
**Page**: #azure-infrastructure Slack channel
**Status Page**: https://status.businesspartner.sa

**Common Issues**:

1. **Email not sending**: Check Communication Services quota
2. **Database connection timeout**: Verify firewall rules
3. **Logic App failed**: Check Application Insights logs
4. **Storage access denied**: Verify Managed Identity permissions

---

## Roadmap

### Q4 2026
- [ ] Migrate Daftra integration to Azure Logic Apps
- [ ] Add WhatsApp integration (via Communication Services)
- [ ] Implement Azure AI for referral qualification

### Q1 2027
- [ ] Advanced analytics dashboard (Power BI)
- [ ] Automated invoice matching
- [ ] Blockchain audit trail (optional)

---

**Last Updated**: 2026-09-15
**Owner**: Business Partner Engineering
**Approval**: CTO ✅
