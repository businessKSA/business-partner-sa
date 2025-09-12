// Gmail API implementation using service account with domain-wide delegation
import { google } from 'googleapis';

interface EmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class GmailService {
  private auth: any;
  private initialized: boolean = false;

  constructor() {
    try {
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      if (!clientEmail || !privateKey) {
        console.log('Gmail API credentials not found in environment variables');
        this.auth = null;
        return;
      }

      // Clean up the private key - handle various formats
      privateKey = privateKey
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .trim();
      
      // Ensure proper formatting
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
      }
      if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
        privateKey = privateKey + '\n-----END PRIVATE KEY-----';
      }

      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID || 'website-leads2-470118',
        private_key_id: '81594dedc1c879f7e2d7daf92c047ef8711b031e',
        private_key: privateKey,
        client_email: clientEmail,
        client_id: process.env.GOOGLE_CLIENT_ID || '101640889148438469286',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
        universe_domain: 'googleapis.com'
      };

      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: [
          'https://www.googleapis.com/auth/gmail.send'
        ]
      });

      this.initialized = true;
      console.log('Gmail API service account initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gmail API:', error);
      this.auth = null;
    }
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    if (!this.auth || !this.initialized) {
      console.log('Gmail API not initialized - skipping email send');
      return false;
    }

    try {
      // Create Gmail client with domain-wide delegation (impersonation)
      const client = await this.auth.getClient();
      client.subject = process.env.GMAIL_IMPERSONATE_USER || 'business@businesspartner.sa';
      
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Create the email message in RFC 2822 format
      const message = [
        `To: ${to}`,
        `From: Business Partner <${process.env.GMAIL_IMPERSONATE_USER || 'business@businesspartner.sa'}>`,
        `Reply-To: ${process.env.GMAIL_IMPERSONATE_USER || 'business@businesspartner.sa'}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="boundary123"`,
        ``,
        `--boundary123`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        textBody,
        ``,
        `--boundary123`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        htmlBody,
        ``,
        `--boundary123--`
      ].join('\n');

      // Encode the message in base64url format
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log('Email sent successfully via Gmail API');
      return true;
    } catch (error) {
      console.error('Gmail API error:', error);
      
      // Check if it's a domain-wide delegation issue
      if (error?.message?.includes('Precondition check failed') || error?.message?.includes('FAILED_PRECONDITION')) {
        console.log('Domain-wide delegation may not be fully propagated yet. Please wait a few minutes and try again.');
      }
      
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.auth !== null;
  }
}

// Export factory function
export function createGmailService(): GmailService | null {
  try {
    const gmailService = new GmailService();
    if (gmailService.isInitialized()) {
      console.log('Gmail API service created successfully');
      return gmailService;
    } else {
      console.log('Gmail API service creation failed - missing credentials');
      return null;
    }
  } catch (error) {
    console.error('Error creating Gmail service:', error);
    return null;
  }
}