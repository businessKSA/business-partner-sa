// Gmail SMTP approach using nodemailer - simple and reliable  
import * as nodemailer from 'nodemailer';

interface EmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class GmailService {
  private transporter: any;

  constructor() {
    try {
      // Use Gmail SMTP with app password
      const gmailUser = 'business@businesspartner.sa';
      const gmailPassword = process.env.GMAIL_APP_PASSWORD || 'ymmvfrwmhfuthnsp';
      
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('Gmail SMTP transporter initialized successfully for:', gmailUser);
    } catch (error) {
      console.error('Failed to initialize Gmail SMTP:', error);
      this.transporter = null;
    }
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    if (!this.transporter) {
      console.log('Gmail SMTP not initialized - skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from: 'Business Partner <business@businesspartner.sa>',
        to: to,
        subject: subject,
        text: textBody,
        html: htmlBody,
        replyTo: 'business@businesspartner.sa'
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

// Legacy class - kept for compatibility
export class GmailSMTPService {
  private transporter: any;

  constructor() {
    console.log('GmailSMTPService deprecated - use main GmailService instead');
    this.transporter = null;
  }

  async sendEmail({ to, subject, htmlBody, textBody }: EmailParams): Promise<boolean> {
    console.log('GmailSMTPService deprecated - use main GmailService instead');
    return false;
  }
}

// Export factory function
export function createGmailService(): GmailService | null {
  // Create Gmail SMTP service
  try {
    const gmailService = new GmailService();
    // Check if transporter exists by accessing private property via instance check
    if (gmailService && (gmailService as any).transporter) {
      console.log('Gmail SMTP service created successfully');
      return gmailService;
    } else {
      console.log('Gmail SMTP service creation failed - no valid transporter');
      return null;
    }
  } catch (error) {
    console.error('Error creating Gmail SMTP service:', error);
    return null;
  }
}