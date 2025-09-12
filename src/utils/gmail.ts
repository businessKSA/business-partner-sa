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
    
    // If env vars are not available, try hardcoded credentials (for development)
    const serviceAccount = {
      "type": "service_account",
      "project_id": "website-leads2-470118",
      "private_key_id": "81594dedc1c879f7e2d7daf92c047ef8711b031e",
      "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDfddBW7h+HskO8\nmW3/E5gyRNX5mpdIWSR/7Acj9BIrieaCnn2IRsbF9Ai84jWVSmZ/UC+T44gr6h2A\nifCE6BoQBxtsNLSaiJAx+ODs4eJHQG1gp57hZpJpYofb3qHSeDHntR6FtSm4Bh5E\nRhhrRb/4p6QlVQd/SDazH38PoKSBo7BSwpMU5EMpRQ0KltcvwlCSxxCHDKF/E6e8\nxrbqvcFaMHWGmWGRS8YManj15Qq+IjCpiMNKSAMSjJLRwyJRapOwx89sJW4BlOlN\ncbmaMs5/x6TaNW/3314RIk4oQvrMbuGzsLoJrPLZtLaBX+WFqkhLJPH50tuFlKJ1\ntYhVF4UhAgMBAAECggEABbcNh6WiLo4le5m4dZc+k52NU+uLXjUycOecVKPxwYWO\nvM05JG6793Ta8tq9uFZdafjm6Js/gLEFhWOxwDJv9TQ7VDCCZHfk6TRGa2SJDR21\nlmzfDEB7cuDLXPkUDi4XB6grEkwcd6mHZWNeDUNMyjseYHqM3SlfhcQC08dd4bdd\n5mRTQkS4DAxK/oiRnGA4QYzqZTRScnP05UqMJozm3rtMSD5Hf/wwHu6eHO4kfkeU\n90cm5OQxUSqNG3eWU5fy0OaOfMJ09c/Xabt7Nd/Piw4HfTXvfs9kqF2S3C/uwBsr\nHdklCJ4C3oTBQE4Ik/at65y+pNG6RtzQ80XRXtr7AQKBgQD1nt5Poo+qDBjOi34n\nsUS2mtRYqFGkSXGpgp9F4+sWKWmC29r6xYbmgIfMXYXoZ4uIKCGj3PC4YmywAz5D\n1BrQl5pxow6X2ivPJfMhOmWayJtOd4KFtXFbLSYXmMk9+MFPOERXyuH+WDoupxi3\nylo0MAMjwpZVRvvQrmkK3Ybr4QKBgQDo5za8SFAoqVlezpWeTQzOkB7dzlELo5PG\nGRiT9/FI58h+ArpRJNJuZBTDiTsodZ68E6Vfm0zpiHQADWV053UUvPvl3FeUuVba\nuHRaCv5C1mpIfQTJbCl6J6E53JSIYEzqUf4lwtfJaU8JcAv5ZuNtM0vEnzqtStIL\n7+xNtiHBQQKBgQDGpygshlDleoUxwBZXagMmIVFvJyto0VHRhGjnMPB46yOAB+sy\n+UEi+n9apaVhEyYCCFs02cQDjO9U6Dqax1isroDmObfaz0SxdIMQs9dreaZKr1Ps\napR05q4xVYwlyCQou1xjGR7xBFCCXPkb5NhR7ycK7B2EeTW/UOB6PjMaYQKBgQCR\n/9dNIlu1kaunhgM+z/g2SRxAWURu8mUBatwAbg6AcGQ7sgQQN+/+KZjmltFR5KHU\nLtCdZWJKhzKIkd1G8o1vqaSTDJSOc7zhsX2msHuBdJ39wPlONxKtM8ia2A74ir3M\nqgeSrljNNsnIFcg72Oa6nsxhfpuu5FdWClnswT7ZwQKBgD5aH9wtoKJlq1g5Iasd\nqbkfdIoOLoh5822+tUhUs0Poj/4biKDBPC8SCvjmgm17il0h9MlggWRLY3KTYaue\n46RbfnYCJ2y3HvE1oyB7KiSEhgdkcnTrEXPoybdXSTGvzRdv9L+gFPkX//uRgpjz\nOVLojIa7OSb18FQIuSp4TdS9\n-----END PRIVATE KEY-----\n",
      "client_email": "submit-emsil@website-leads2-470118.iam.gserviceaccount.com",
      "client_id": "101640889148438469286"
    };

    // Use environment variables if available, otherwise use hardcoded
    const credentials = {
      client_email: clientEmail || serviceAccount.client_email,
      private_key: privateKey || serviceAccount.private_key,
      type: 'service_account',
      project_id: serviceAccount.project_id
    };

    console.log('Gmail service initializing with:', {
      client_email: credentials.client_email,
      has_private_key: !!credentials.private_key,
      private_key_length: credentials.private_key?.length || 0
    });

    this.auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: process.env.GMAIL_IMPERSONATE_USER || 'business@businesspartner.sa',
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