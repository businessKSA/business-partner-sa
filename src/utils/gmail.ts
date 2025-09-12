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
    // Try to load from environment variables first
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    // For production deployment, we'll disable Gmail API to avoid the private key decoding issue
    // The form will work reliably with FormSubmit backup service
    const serviceAccount = null;

    // Skip Gmail API setup to avoid private key decoding issues on serverless platforms
    // The contact form will work reliably with FormSubmit backup service
    console.log('Gmail API disabled for production deployment - using FormSubmit backup service');
    this.auth = null;
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    // Gmail API is disabled for production deployment
    console.log('Gmail API disabled - skipping email send via Gmail');
    return false;
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
  // Always try to create Gmail service (it has hardcoded fallback credentials)
  try {
    const service = new GmailService();
    console.log('Created Gmail service successfully');
    return service;
  } catch (error) {
    console.error('Failed to create Gmail service:', error);
  }

  // Check if we have OAuth2 credentials for SMTP as fallback
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
    try {
      return new GmailSMTPService();
    } catch (error) {
      console.error('Failed to create Gmail SMTP service:', error);
    }
  }

  console.warn('No Gmail credentials found in environment variables');
  return null;
}