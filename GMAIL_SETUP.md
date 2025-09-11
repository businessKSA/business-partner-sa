# Gmail API Setup Guide for Business Partner

This guide will help you set up direct Google Workspace integration for your contact form.

## Option 1: Service Account with Domain-wide Delegation (Recommended)

This is the most secure and reliable method for server-side email sending.

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Name it something like "businesspartner-sa-email"

### Step 2: Enable Gmail API

1. Go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click **Enable**

### Step 3: Create Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **Service account**
3. Fill in details:
   - **Service account name**: `businesspartner-email-service`
   - **Description**: `Service account for sending emails from contact form`
4. Click **CREATE AND CONTINUE**
5. Skip role assignment (click **CONTINUE**)
6. Click **DONE**

### Step 4: Generate Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **ADD KEY** > **Create new key**
4. Choose **JSON** format
5. Download the key file (keep it secure!)

### Step 5: Enable Domain-wide Delegation

1. In your service account details, check **Enable Google Workspace Domain-wide Delegation**
2. Add a **Product name for consent screen**: "Business Partner Contact Form"
3. Save the changes
4. Note down the **Client ID** (you'll need it for step 6)

### Step 6: Set up Domain-wide Delegation in Google Workspace Admin

1. Go to [Google Admin Console](https://admin.google.com/)
2. Navigate to **Security** > **API Controls**
3. Click **Domain-wide Delegation**
4. Click **Add new**
5. Enter the **Client ID** from your service account
6. In **OAuth scopes**, add: `https://www.googleapis.com/auth/gmail.send`
7. Click **Authorize**

### Step 7: Update Your Environment Variables

Add these to your `.env` file:

```bash
# Gmail API Configuration
GOOGLE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GMAIL_IMPERSONATE_USER=business@businesspartner.sa
```

**Important**: 
- Copy the `client_email` from your downloaded JSON key file
- Copy the entire `private_key` from the JSON file (including the `\n` characters)
- Set `GMAIL_IMPERSONATE_USER` to your business email address

---

## Option 2: OAuth2 SMTP (Alternative Method)

If you prefer OAuth2 SMTP instead of the Gmail API:

### Step 1-3: Same as Option 1 (Create project, enable Gmail API, create credentials)

But instead of service account, create **OAuth2 credentials**:

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Web application**
4. Add your website URL to authorized domains
5. Download the client credentials

### Step 2: Get Refresh Token

You'll need to use a tool like [Google OAuth2 Playground](https://developers.google.com/oauthplayground/) to get a refresh token.

### Step 3: Update Environment Variables

```bash
# OAuth2 SMTP Configuration
GMAIL_USER=business@businesspartner.sa
GMAIL_CLIENT_ID=your-client-id.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
```

---

## Testing

Once configured, test your setup:

1. Fill out the contact form on your website
2. Check the server logs for success/error messages
3. Check your `business@businesspartner.sa` inbox

The system will automatically fall back to Web3Forms and FormSubmit if Gmail API fails.

---

## Troubleshooting

- **"insufficient authentication scopes"**: Make sure domain-wide delegation is set up correctly
- **"invalid_grant"**: Check that your private key and client email are correct
- **"access_denied"**: Verify the service account has proper permissions in Google Workspace Admin

For support, check the server logs at `/api/contact` endpoint.