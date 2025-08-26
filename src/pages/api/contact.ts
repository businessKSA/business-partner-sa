import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false; // This API route needs server-side rendering

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, company, email, phone, services, message } = data;

    // Create a transporter using Gmail service
    // For production, use environment variables for credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        // Use environment variables in production
        // For now, using Gmail App Password method
        user: process.env.GMAIL_USER || 'business@businesspartnerksa.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password-here'
      }
    });

    // Alternative: Use SMTP settings
    // const transporter = nodemailer.createTransporter({
    //   host: 'smtp.gmail.com',
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.GMAIL_USER,
    //     pass: process.env.GMAIL_APP_PASSWORD
    //   }
    // });

    // Email content
    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: 'business@businesspartnerksa.com',
      subject: `New Contact Form Submission from ${company || 'Website'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #0066cc; }
            .value { margin-top: 5px; padding: 10px; background: white; border-radius: 4px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">New Contact Form Submission</h2>
              <p style="margin: 5px 0; opacity: 0.9;">Business Partner Services</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${name}</div>
              </div>
              
              <div class="field">
                <div class="label">Company:</div>
                <div class="value">${company || 'Not provided'}</div>
              </div>
              
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${email}</div>
              </div>
              
              <div class="field">
                <div class="label">Phone:</div>
                <div class="value">${phone}</div>
              </div>
              
              <div class="field">
                <div class="label">Services of Interest:</div>
                <div class="value">${services || 'Not specified'}</div>
              </div>
              
              <div class="field">
                <div class="label">Message:</div>
                <div class="value">${message || 'No message provided'}</div>
              </div>
              
              <div class="footer">
                <p>This email was sent from the Business Partner Services website contact form.</p>
                <p>Submitted on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Contact Form Submission
        
        Name: ${name}
        Company: ${company || 'Not provided'}
        Email: ${email}
        Phone: ${phone}
        Services: ${services || 'Not specified'}
        Message: ${message || 'No message provided'}
        
        Submitted on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}
      `
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: info.messageId 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    
    // In development, return success even if email fails
    // This allows testing without email configuration
    if (process.env.NODE_ENV !== 'production') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Development mode: Email simulated',
          debug: 'Email would be sent in production'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

// Handle GET requests (for testing)
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ 
      message: 'Contact API endpoint is working',
      method: 'Use POST to send contact form data'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};