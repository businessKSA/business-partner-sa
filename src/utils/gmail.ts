import { google } from 'googleapis';

interface EmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class GmailService {
  private auth: any;

  constructor() {
    // Initialize Gmail API with service account
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: process.env.GMAIL_IMPERSONATE_USER, // The email address to impersonate
    });
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });

      // Create the email message
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="boundary123"',
        '',
        '--boundary123',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        textBody,
        '',
        '--boundary123',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        htmlBody,
        '',
        '--boundary123--'
      ].join('\n');

      // Encode the email in base64
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      // Send the email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      console.log('Email sent successfully via Gmail API:', response.data.id);
      return true;
    } catch (error) {
      console.error('Gmail API error:', error);
      return false;
    }
  }
}

// Alternative simpler approach using nodemailer with Gmail SMTP
import nodemailer from 'nodemailer';

export class GmailSMTPService {
  private transporter: any;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    try {
      const mailOptions = {
        from: `Business Partner <${process.env.GMAIL_USER}>`,
        to: to,
        subject: subject,
        text: textBody,
        html: htmlBody,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully via Gmail SMTP:', result.messageId);
      return true;
    } catch (error) {
      console.error('Gmail SMTP error:', error);
      return false;
    }
  }
}

// Export factory function
export function createGmailService(): GmailService | GmailSMTPService | null {
  // Check if we have service account credentials
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new GmailService();
  }
  
  // Check if we have OAuth2 credentials for SMTP
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
    return new GmailSMTPService();
  }

  console.warn('No Gmail credentials found in environment variables');
  return null;
}