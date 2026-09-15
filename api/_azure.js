// Business Partner — Microsoft Azure integration (Azure SQL DB, Communication Services, Logic Apps).
// Replaces Supabase, Notion, Resend, and n8n for broker & referral system.
// All automation, data storage, and communication exclusively through Azure.

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { Connection } from "tedious"; // SQL Database
import crypto from "node:crypto";

const envFrom = (names) => {
  for (const n of names) {
    if (process.env[n] && String(process.env[n]).trim()) return String(process.env[n]).trim();
  }
  return "";
};

// Azure Configuration from environment
export const AZURE_TENANT_ID = envFrom(["AZURE_TENANT_ID"]);
export const AZURE_CLIENT_ID = envFrom(["AZURE_CLIENT_ID"]);
export const AZURE_CLIENT_SECRET = envFrom(["AZURE_CLIENT_SECRET"]);
export const AZURE_SUBSCRIPTION_ID = envFrom(["AZURE_SUBSCRIPTION_ID"]);
export const AZURE_RESOURCE_GROUP = envFrom(["AZURE_RESOURCE_GROUP", "business-partner-rg"]);

// Azure SQL Database configuration
export const AZURE_SQL_SERVER = envFrom(["AZURE_SQL_SERVER"]);
export const AZURE_SQL_DATABASE = envFrom(["AZURE_SQL_DATABASE", "business-partner-db"]);
export const AZURE_SQL_USER = envFrom(["AZURE_SQL_USER"]);
export const AZURE_SQL_PASSWORD = envFrom(["AZURE_SQL_PASSWORD"]);

// Azure Communication Services
export const AZURE_COMMUNICATION_CONNECTION_STRING = envFrom([
  "AZURE_COMMUNICATION_CONNECTION_STRING",
  "COMMUNICATION_SERVICES_CONNECTION_STRING",
]);
export const AZURE_COMMUNICATION_EMAIL_FROM = envFrom([
  "AZURE_COMMUNICATION_EMAIL_FROM",
  "onboarding@business-partner-sa.onmicrosoft.com",
]);

// Azure Storage (replaces Supabase Storage)
export const AZURE_STORAGE_ACCOUNT_NAME = envFrom(["AZURE_STORAGE_ACCOUNT_NAME"]);
export const AZURE_STORAGE_ACCOUNT_KEY = envFrom(["AZURE_STORAGE_ACCOUNT_KEY"]);
export const AZURE_STORAGE_CONNECTION_STRING = envFrom(["AZURE_STORAGE_CONNECTION_STRING"]);

// Azure Cosmos DB (optional document store for ledger/audit)
export const AZURE_COSMOS_CONNECTION_STRING = envFrom(["AZURE_COSMOS_CONNECTION_STRING"]);

// Logic Apps webhook URL for async automation triggers
export const AZURE_LOGIC_APPS_WEBHOOK = envFrom(["AZURE_LOGIC_APPS_WEBHOOK_URL"]);

export const AZURE_DB_READY = !!(AZURE_SQL_SERVER && AZURE_SQL_DATABASE && AZURE_SQL_USER && AZURE_SQL_PASSWORD);
export const AZURE_COMM_READY = !!AZURE_COMMUNICATION_CONNECTION_STRING;

/* ------------------------------------------------------------- SQL Database -- */

class AzureSQLConnection {
  constructor() {
    this.pool = null;
    this.config = {
      server: AZURE_SQL_SERVER,
      authentication: {
        type: "default",
        options: {
          userName: AZURE_SQL_USER,
          password: AZURE_SQL_PASSWORD,
        },
      },
      options: {
        database: AZURE_SQL_DATABASE,
        encrypt: true,
        trustServerCertificate: false,
        rowCollectionOnRequestCompletion: false,
        connectionTimeout: 15000,
      },
    };
  }

  async query(sql, params = []) {
    if (!AZURE_DB_READY) throw new Error("azure_sql_not_configured");

    return new Promise((resolve, reject) => {
      const connection = new Connection(this.config);

      connection.on("connect", (err) => {
        if (err) return reject(err);

        const request = connection.newRequest(sql, (err, rowCount, rows) => {
          connection.close();
          if (err) return reject(err);
          resolve(rows);
        });

        params.forEach((param, idx) => {
          request.addParameter(`param${idx}`, null, param);
        });

        connection.execSql(request);
      });

      connection.on("error", (err) => {
        console.error("azure_sql_connection_error", err);
        reject(err);
      });

      connection.connect();
    });
  }

  async execute(sql, params = []) {
    if (!AZURE_DB_READY) throw new Error("azure_sql_not_configured");

    return new Promise((resolve, reject) => {
      const connection = new Connection(this.config);

      connection.on("connect", (err) => {
        if (err) return reject(err);

        const request = connection.newRequest(sql, (err) => {
          connection.close();
          if (err) return reject(err);
          resolve(true);
        });

        params.forEach((param, idx) => {
          request.addParameter(`param${idx}`, null, param);
        });

        connection.execSql(request);
      });

      connection.on("error", (err) => {
        console.error("azure_sql_execution_error", err);
        reject(err);
      });

      connection.connect();
    });
  }
}

let _sqlPool = null;

async function getSQLConnection() {
  if (!_sqlPool) {
    _sqlPool = new AzureSQLConnection();
  }
  return _sqlPool;
}

// Query broker data
export async function azureBrokerQuery(sql, params = []) {
  try {
    const conn = await getSQLConnection();
    return await conn.query(sql, params);
  } catch (err) {
    console.error("azure_broker_query_error", err.message);
    throw new Error("db_failed");
  }
}

// Execute broker operations (insert/update/delete)
export async function azureBrokerExecute(sql, params = []) {
  try {
    const conn = await getSQLConnection();
    return await conn.execute(sql, params);
  } catch (err) {
    console.error("azure_broker_execute_error", err.message);
    throw new Error("db_failed");
  }
}

/* ------------------------------------------ Azure Communication Services -- */

// Send email via Azure Communication Services
export async function azureSendEmail({ to, subject, html, text }) {
  if (!AZURE_COMM_READY) {
    console.warn("azure_communication_not_configured");
    return { id: "mock_" + Date.now() };
  }

  try {
    const endpoint = AZURE_COMMUNICATION_CONNECTION_STRING.split("endpoint=")[1]?.split(";")[0];
    if (!endpoint) throw new Error("invalid_azure_comm_endpoint");

    const response = await fetch(`${endpoint}/emails:send?api-version=2023-03-31`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AZURE_COMMUNICATION_CONNECTION_STRING}`,
      },
      body: JSON.stringify({
        senderAddress: AZURE_COMMUNICATION_EMAIL_FROM,
        recipients: {
          to: [{ address: to }],
        },
        content: {
          subject: subject,
          html: html,
          plainText: text || strip_html(html),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("azure_email_send_error", response.status, error);
      throw new Error("email_send_failed");
    }

    const data = await response.json();
    return { id: data.id, status: "queued" };
  } catch (err) {
    console.error("azure_send_email_error", err.message);
    throw err;
  }
}

// Send SMS via Azure Communication Services
export async function azureSendSMS({ to, message }) {
  if (!AZURE_COMM_READY) {
    console.warn("azure_communication_not_configured");
    return { id: "mock_" + Date.now() };
  }

  try {
    const endpoint = AZURE_COMMUNICATION_CONNECTION_STRING.split("endpoint=")[1]?.split(";")[0];
    if (!endpoint) throw new Error("invalid_azure_comm_endpoint");

    const response = await fetch(`${endpoint}/sms:send?api-version=2021-10-30-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AZURE_COMMUNICATION_CONNECTION_STRING}`,
      },
      body: JSON.stringify({
        from: process.env.AZURE_COMM_PHONE_FROM || "+19665XXXXXXX",
        to: to,
        message: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("azure_sms_send_error", response.status, error);
      throw new Error("sms_send_failed");
    }

    const data = await response.json();
    return { id: data.messageId, status: "queued" };
  } catch (err) {
    console.error("azure_send_sms_error", err.message);
    throw err;
  }
}

/* ------------------------------------------ Azure Storage (Documents) -- */

import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

let _blobServiceClient = null;

function getBlobServiceClient() {
  if (!_blobServiceClient) {
    if (AZURE_STORAGE_CONNECTION_STRING) {
      _blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    } else if (AZURE_STORAGE_ACCOUNT_NAME && AZURE_STORAGE_ACCOUNT_KEY) {
      const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
      _blobServiceClient = new BlobServiceClient(
        `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        sharedKeyCredential
      );
    }
  }
  return _blobServiceClient;
}

const CONTAINER_NAME = "documents";

async function ensureContainer() {
  const client = getBlobServiceClient();
  if (!client) return;
  try {
    const containerClient = client.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists();
  } catch (err) {
    console.error("azure_ensure_container_error", err.message);
  }
}

// Upload document to Azure Blob Storage
export async function azureStoragePut(path, buffer, contentType) {
  await ensureContainer();
  const client = getBlobServiceClient();
  if (!client) throw new Error("azure_storage_not_configured");

  try {
    const containerClient = client.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(path);
    await blockBlobClient.upload(buffer, buffer.length, { blobHTTPHeaders: { blobContentType: contentType } });
    return path;
  } catch (err) {
    console.error("azure_storage_put_error", err.message);
    throw new Error("storage_failed");
  }
}

// Download document from Azure Blob Storage
export async function azureStorageGet(path) {
  const client = getBlobServiceClient();
  if (!client) throw new Error("azure_storage_not_configured");

  try {
    const containerClient = client.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(path);
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const chunks = [];
    for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error("azure_storage_get_error", err.message);
    throw new Error("storage_failed");
  }
}

// Generate signed URL for document download
export async function azureStorageSign(path, expiresInSeconds = 600) {
  const client = getBlobServiceClient();
  if (!client) throw new Error("azure_storage_not_configured");

  try {
    const containerClient = client.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(path);

    const sharedKeyCredential = client.credential;
    if (!sharedKeyCredential) throw new Error("no_shared_key_credential");

    const sasUrl = blockBlobClient.generateSasUrl({
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + expiresInSeconds * 1000),
      permissions: "r", // read only
    });

    return sasUrl;
  } catch (err) {
    console.error("azure_storage_sign_error", err.message);
    throw new Error("storage_sign_failed");
  }
}

// Delete document from Azure Blob Storage
export async function azureStorageDelete(path) {
  const client = getBlobServiceClient();
  if (!client) return;

  try {
    const containerClient = client.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(path);
    await blockBlobClient.delete();
  } catch (err) {
    if (err.code !== "BlobNotFound") {
      console.error("azure_storage_delete_error", err.message);
    }
  }
}

/* ------------------------------------------ Azure Logic Apps Triggers -- */

// Trigger Azure Logic App for async automation
export async function azureTriggerLogicApp(workflowName, payload) {
  if (!AZURE_LOGIC_APPS_WEBHOOK) {
    console.warn("azure_logic_apps_webhook_not_configured", workflowName);
    return { status: "queued_locally" };
  }

  try {
    const url = AZURE_LOGIC_APPS_WEBHOOK.replace("{workflow}", workflowName);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: workflowName,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    if (!response.ok) {
      console.error("azure_logic_app_trigger_error", response.status, await response.text());
      return { status: "queued_locally", error: true };
    }

    return { status: "triggered", id: response.headers.get("x-ms-workflow-run-id") };
  } catch (err) {
    console.error("azure_trigger_logic_app_error", err.message);
    return { status: "queued_locally", error: true };
  }
}

/* ------------------------------------------------- Helper Functions -- */

function strip_html(html) {
  return String(html).replace(/<[^>]*>/g, "");
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Audit logging in Azure Cosmos DB
export async function azureAudit(entry) {
  if (!AZURE_COSMOS_CONNECTION_STRING) return;

  try {
    const { CosmosClient } = await import("@azure/cosmos");
    const client = new CosmosClient({ connectionString: AZURE_COSMOS_CONNECTION_STRING });
    const database = client.database("business-partner");
    const container = database.container("audit_logs");

    await container.items.create({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    });
  } catch (err) {
    console.error("azure_audit_error", err.message);
  }
}
