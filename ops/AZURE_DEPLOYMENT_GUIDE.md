# Azure Deployment Guide

## Prerequisites

1. **Azure Account**: Active subscription with sufficient quota
2. **Azure CLI**: v2.50+ installed
3. **PowerShell**: v7+ for automation scripts
4. **Node.js**: v18+ (for local testing)
5. **Permissions**: Subscription Contributor or Resource Group Owner

---

## Step 1: Create Resource Group

```bash
az group create \
  --name business-partner-rg \
  --location eastus
```

---

## Step 2: Deploy Azure SQL Database

### Create SQL Server

```bash
az sql server create \
  --resource-group business-partner-rg \
  --name business-partner-sql \
  --admin-user bp_admin \
  --admin-password '{STRONG_PASSWORD}' \
  --location eastus \
  --enable-public-endpoint true
```

### Create Database

```bash
az sql db create \
  --resource-group business-partner-rg \
  --server business-partner-sql \
  --name business-partner-db \
  --service-objective S1 \
  --backup-storage-redundancy Geo
```

### Apply Schema

```bash
# Using Azure CLI (sqlcmd)
sqlcmd -S business-partner-sql.database.windows.net \
  -U bp_admin \
  -P '{PASSWORD}' \
  -d business-partner-db \
  -i db/azure-schema.sql
```

### Configure Firewall

```bash
# Allow Azure services
az sql server firewall-rule create \
  --resource-group business-partner-rg \
  --server business-partner-sql \
  --name AllowAzureIps \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your IP
az sql server firewall-rule create \
  --resource-group business-partner-rg \
  --server business-partner-sql \
  --name AllowMyIP \
  --start-ip-address {YOUR_IP} \
  --end-ip-address {YOUR_IP}
```

---

## Step 3: Deploy Azure Communication Services

```bash
az communication service create \
  --resource-group business-partner-rg \
  --name business-partner-comm \
  --location global
```

### Add Email Service

```bash
az communication email service create \
  --resource-group business-partner-rg \
  --name bp-email-service \
  --linked-communication-service business-partner-comm
```

### Configure Email Domain

```bash
az communication email domain service-resource create \
  --resource-group business-partner-rg \
  --name business-partner-sa \
  --email-service-name bp-email-service \
  --domain-name business-partner-sa.onmicrosoft.com
```

### Get Connection String

```bash
az communication service keys list \
  --name business-partner-comm \
  --resource-group business-partner-rg \
  --query primaryConnectionString -o tsv
```

---

## Step 4: Deploy Azure Storage

```bash
az storage account create \
  --name bpartneraz \
  --resource-group business-partner-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind BlobStorage \
  --access-tier Hot

# Create container
az storage container create \
  --account-name bpartneraz \
  --name documents

# Get connection string
az storage account show-connection-string \
  --name bpartneraz \
  --resource-group business-partner-rg
```

---

## Step 5: Create Key Vault

```bash
az keyvault create \
  --resource-group business-partner-rg \
  --name business-partner-kv \
  --location eastus \
  --enabled-for-deployment \
  --enabled-for-template-deployment

# Add secrets
az keyvault secret set \
  --vault-name business-partner-kv \
  --name AzureSqlConnectionString \
  --value "Server=tcp:business-partner-sql.database.windows.net,1433;Initial Catalog=business-partner-db;Persist Security Info=False;User ID=bp_app;Password={PASSWORD};Encrypt=True;Connection Timeout=30;"

az keyvault secret set \
  --vault-name business-partner-kv \
  --name AzureCommunicationConnectionString \
  --value "{CONNECTION_STRING}"

az keyvault secret set \
  --vault-name business-partner-kv \
  --name AzureStorageConnectionString \
  --value "{CONNECTION_STRING}"
```

---

## Step 6: Create Service Principal

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "Business Partner App" \
  --role "Contributor" \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/business-partner-rg

# Save output:
# {
#   "appId": "{AZURE_CLIENT_ID}",
#   "displayName": "Business Partner App",
#   "password": "{AZURE_CLIENT_SECRET}",
#   "tenant": "{AZURE_TENANT_ID}"
# }

# Grant Key Vault access
az keyvault set-policy \
  --name business-partner-kv \
  --object-id {SERVICE_PRINCIPAL_OBJECT_ID} \
  --secret-permissions get list
```

---

## Step 7: Create Azure Cosmos DB (Optional, for audit logs)

```bash
az cosmosdb create \
  --name business-partner-cosmos \
  --resource-group business-partner-rg \
  --default-consistency-level Strong \
  --locations regionName=eastus failoverPriority=0

# Create database
az cosmosdb database create \
  --account-name business-partner-cosmos \
  --name business-partner \
  --resource-group business-partner-rg

# Create containers
az cosmosdb collection create \
  --collection-name audit_logs \
  --database-name business-partner \
  --account-name business-partner-cosmos \
  --resource-group business-partner-rg \
  --partition-key-path /timestamp \
  --throughput 400

az cosmosdb collection create \
  --collection-name ledger_entries \
  --database-name business-partner \
  --account-name business-partner-cosmos \
  --resource-group business-partner-rg \
  --partition-key-path /broker_id \
  --throughput 400

# Get connection string
az cosmosdb keys list \
  --name business-partner-cosmos \
  --resource-group business-partner-rg \
  --type connection-strings
```

---

## Step 8: Create Application Insights

```bash
az monitor app-insights component create \
  --app business-partner-insights \
  --resource-group business-partner-rg \
  --location eastus

# Get instrumentation key
az monitor app-insights component show \
  --app business-partner-insights \
  --resource-group business-partner-rg \
  --query instrumentationKey -o tsv
```

---

## Step 9: Create Logic Apps (Workflows)

### Create Logic App Resource

```bash
az logic workflow create \
  --resource-group business-partner-rg \
  --name referral-processor-workflow \
  --location eastus \
  --definition workflows/referral-processor.json
```

### Deploy Workflow Definitions

Create JSON files in `ops/workflows/`:

**ops/workflows/referral-processor.json**:
```json
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "triggers": {
    "manual": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "schema": {
          "type": "object",
          "properties": {
            "company_name": { "type": "string" },
            "contact_email": { "type": "string" },
            "broker_id": { "type": "string" }
          }
        }
      }
    }
  },
  "actions": {
    "Store_in_SQL": {
      "type": "Http",
      "inputs": {
        "method": "POST",
        "uri": "https://business-partner-sql.database.windows.net/sql/query",
        "body": "@triggerBody()",
        "authentication": {
          "type": "ManagedServiceIdentity",
          "identity": "System"
        }
      }
    },
    "Send_Email": {
      "type": "Http",
      "inputs": {
        "method": "POST",
        "uri": "https://business-partner-sa.communication.azure.com/emails:send?api-version=2023-03-31",
        "body": {
          "senderAddress": "onboarding@business-partner-sa.onmicrosoft.com",
          "recipients": {
            "to": [
              {
                "address": "@triggerBody().contact_email"
              }
            ]
          },
          "content": {
            "subject": "Referral Confirmation",
            "html": "Your referral has been received."
          }
        }
      }
    }
  }
}
```

### Get Webhook URL

```bash
az logic workflow show \
  --resource-group business-partner-rg \
  --name referral-processor-workflow \
  --query properties.definition.triggers.manual.inputs.schema -o json

# Extract trigger URL from workflow
az logic workflow list-triggers \
  --resource-group business-partner-rg \
  --workflow-name referral-processor-workflow
```

---

## Step 10: Configure Environment Variables

### In Vercel

Navigate to Settings → Environment Variables and add:

```
AZURE_TENANT_ID={YOUR_TENANT_ID}
AZURE_CLIENT_ID={YOUR_CLIENT_ID}
AZURE_CLIENT_SECRET={YOUR_CLIENT_SECRET}
AZURE_SUBSCRIPTION_ID={YOUR_SUBSCRIPTION_ID}
AZURE_RESOURCE_GROUP=business-partner-rg

AZURE_SQL_SERVER=business-partner-sql.database.windows.net
AZURE_SQL_DATABASE=business-partner-db
AZURE_SQL_USER=bp_app
AZURE_SQL_PASSWORD={YOUR_PASSWORD}

AZURE_COMMUNICATION_CONNECTION_STRING={CONNECTION_STRING}
AZURE_COMMUNICATION_EMAIL_FROM=onboarding@business-partner-sa.onmicrosoft.com
AZURE_COMM_PHONE_FROM=+9665XXXXXXX

AZURE_STORAGE_ACCOUNT_NAME=bpartneraz
AZURE_STORAGE_CONNECTION_STRING={CONNECTION_STRING}

AZURE_COSMOS_CONNECTION_STRING={CONNECTION_STRING}

AZURE_LOGIC_APPS_WEBHOOK={WEBHOOK_URL}

PANEL_KEY={ADMIN_PANEL_KEY}
OTP_SECRET={OTP_SECRET}
```

---

## Step 11: Test Connection

### Test SQL Connection

```bash
# From Node.js
node -e "
const { Connection } = require('tedious');
const conn = new Connection({
  server: 'business-partner-sql.database.windows.net',
  authentication: {
    type: 'default',
    options: {
      userName: 'bp_app',
      password: '{PASSWORD}'
    }
  },
  options: {
    database: 'business-partner-db',
    encrypt: true,
    trustServerCertificate: false
  }
});
conn.on('connect', () => {
  console.log('✅ SQL connected');
  conn.close();
});
conn.on('error', (err) => console.error('❌ SQL error', err));
conn.connect();
"
```

### Test Communication Services

```bash
curl -X POST https://business-partner-sa.communication.azure.com/emails:send?api-version=2023-03-31 \
  -H "Authorization: Bearer {ACCESSKEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "senderAddress": "onboarding@business-partner-sa.onmicrosoft.com",
    "recipients": {
      "to": [{"address": "test@example.com"}]
    },
    "content": {
      "subject": "Test",
      "html": "Test email"
    }
  }'
```

### Test Storage

```bash
az storage blob upload \
  --account-name bpartneraz \
  --container-name documents \
  --name test.txt \
  --file test.txt
```

---

## Step 12: Set Up Monitoring

```bash
# Create metric alerts
az monitor metrics alert create \
  --name "SQL Connection Errors" \
  --resource-group business-partner-rg \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/business-partner-rg/providers/Microsoft.Sql/servers/business-partner-sql \
  --condition "total sqlConnectionFailed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --actions "/subscriptions/{SUBSCRIPTION_ID}/resourceGroups/business-partner-rg/providers/Microsoft.Insights/actionGroups/bp-alerts"

# Create log alerts
az monitor log-analytics query \
  --resource-group business-partner-rg \
  --workspace-name bp-workspace \
  --analytics-query "AzureDiagnostics | where Status == 'Failed' | summarize count() by bin(TimeGenerated, 5m)"
```

---

## Step 13: Enable Logging & Auditing

```bash
# Enable SQL audit
az sql server audit-policy update \
  --resource-group business-partner-rg \
  --server business-partner-sql \
  --state Enabled \
  --storage-key {STORAGE_KEY} \
  --storage-account bpartneraz \
  --storage-endpoint https://bpartneraz.blob.core.windows.net \
  --retention-days 90

# Enable diagnostic logs
az monitor diagnostic-settings create \
  --resource business-partner-sql \
  --resource-group business-partner-rg \
  --name sql-diagnostics \
  --workspace /subscriptions/{SUBSCRIPTION_ID}/resourcegroups/business-partner-rg/providers/microsoft.operationalinsights/workspaces/bp-workspace \
  --logs '[{"category":"SQLSecurityAuditEvents","enabled":true}]'
```

---

## Step 14: Verify Deployment

```bash
# Check all resources created
az resource list \
  --resource-group business-partner-rg \
  --output table

# Verify SQL connection
sqlcmd -S business-partner-sql.database.windows.net \
  -U bp_app \
  -P '{PASSWORD}' \
  -d business-partner-db \
  -Q "SELECT COUNT(*) FROM brokers;"

# Check Communication Services
az communication service show \
  --name business-partner-comm \
  --resource-group business-partner-rg

# List storage containers
az storage container list \
  --account-name bpartneraz
```

---

## Step 15: Deploy Code

### Update Package Dependencies

```bash
npm install @azure/identity @azure/keyvault-secrets @azure/storage-blob @azure/cosmos tedious
```

### Deploy to Vercel

```bash
# Ensure environment variables are set in Vercel
git add .
git commit -m "feat: Azure infrastructure integration - exclusive Microsoft Azure services"
git push origin claude/quirky-lamport-v4o7ao

# Vercel will automatically deploy
# Verify: https://businesspartner.sa/api/requests?__route=referrals
```

---

## Troubleshooting

### SQL Connection Timeout

```bash
# Check firewall
az sql server firewall-rule list \
  --resource-group business-partner-rg \
  --server business-partner-sql

# Check connectivity
az sql server test-connection \
  --resource-group business-partner-rg \
  --name business-partner-sql
```

### Email Not Sending

```bash
# Check quota
az communication service show \
  --name business-partner-comm \
  --resource-group business-partner-rg

# Check sender domain
az communication email domain service-resource list \
  --email-service-name bp-email-service \
  --resource-group business-partner-rg
```

### High Latency

```bash
# Check Application Insights
az monitor app-insights metrics show \
  --resource business-partner-insights \
  --resource-group business-partner-rg \
  --metric requests/duration

# Review slow queries
az sql server audit-policy show \
  --resource-group business-partner-rg \
  --server business-partner-sql
```

---

## Cleanup (If Needed)

```bash
# Delete entire resource group
az group delete \
  --name business-partner-rg \
  --yes --no-wait
```

---

**Deployment Status**: ✅ Complete
**Last Updated**: 2026-09-15
**Next Steps**: Run Step 11 tests to verify all connections
