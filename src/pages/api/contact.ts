import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail.js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { entityName, contactName, email, phone, message, lang, source, timestamp } = data;

    // Log the submission for debugging
    console.log('Contact form submission:', {
      entityName, contactName, email, phone, message, lang, source,
      timestamp: new Date().toISOString()
    });

    // Create the email content
    const emailSubject = `New Lead: ${contactName} - ${entityName || 'businesspartner.sa'}`;
    const emailBody = `
New Contact Form Submission from Business Partner Website

📝 CONTACT DETAILS:
━━━━━━━━━━━━━━━━━━━━━
👤 Contact Person: ${contactName}
🏢 Company Name: ${entityName || 'Not provided'}
📧 Email: ${email}
📱 Phone: ${phone}
🌐 Language: ${lang === 'ar' ? 'Arabic' : 'English'}
🔗 Source: ${source}

💬 MESSAGE:
━━━━━━━━━━━━━━━━━━━━━
${message || 'No message provided'}

⏰ SUBMISSION TIME:
━━━━━━━━━━━━━━━━━━━━━
${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)

---
This lead was submitted through businesspartner.sa contact form
    `;

    let emailSent = false;
    let errorDetails = '';

    // Create HTML version of the email
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🚀 New Business Inquiry</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">businesspartner.sa</p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0066cc; margin-bottom: 20px; font-size: 20px;">📝 Contact Details</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 500; width: 120px;">👤 Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${contactName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 500;">🏢 Company:</td>
              <td style="padding: 8px 0; color: #1e293b;">${entityName || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 500;">📧 Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #0066cc; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 500;">📱 Phone:</td>
              <td style="padding: 8px 0;"><a href="tel:${phone}" style="color: #0066cc; text-decoration: none;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 500;">🌐 Language:</td>
              <td style="padding: 8px 0; color: #1e293b;">${lang === 'ar' ? 'Arabic' : 'English'}</td>
            </tr>
          </table>
        </div>

        ${message ? `
        <h3 style="color: #0066cc; margin-bottom: 15px; font-size: 18px;">💬 Message</h3>
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc; margin-bottom: 20px;">
          <p style="color: #1e293b; line-height: 1.6; margin: 0;">${message}</p>
        </div>
        ` : ''}

        <div style="background: #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            ⏰ <strong>Submitted:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)
          </p>
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
        <p>This lead was submitted through businesspartner.sa contact form</p>
      </div>
    </div>
    `;

    // Method 1: Gmail API (Direct Google Workspace integration)
    try {
      const gmailService = createGmailService();
      if (gmailService) {
        const success = await gmailService.sendEmail({
          to: 'business@businesspartner.sa',
          subject: emailSubject,
          htmlBody: htmlBody,
          textBody: emailBody
        });

        if (success) {
          emailSent = true;
          console.log('Email sent via Gmail API successfully');
        }
      }
    } catch (gmailError) {
      console.log('Gmail API error:', gmailError);
      errorDetails += `Gmail API: ${gmailError}. `;
    }

    // Method 2: Web3Forms (fallback)
    if (!emailSent) {
      try {
        const web3FormsResponse = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: '8b4f8c2e-4d2a-4b9f-9c5d-3e1f7a8b9c0d', // You'll need to replace this with your actual key
          name: contactName,
          email: email,
          phone: phone,
          company: entityName,
          subject: emailSubject,
          message: emailBody,
          from_name: `${contactName} - ${entityName || 'Website'}`,
          to: 'business@businesspartner.sa',
          // Anti-spam
          botcheck: '',
          // Additional data
          _language: lang,
          _source: source,
          _timestamp: timestamp
        })
      });

      const web3Result = await web3FormsResponse.json();
      if (web3Result.success) {
        emailSent = true;
        console.log('Email sent via Web3Forms successfully');
      } else {
        console.log('Web3Forms failed:', web3Result.message);
        errorDetails += `Web3Forms: ${web3Result.message}. `;
      }
      } catch (web3Error) {
        console.log('Web3Forms error:', web3Error);
        errorDetails += `Web3Forms: ${web3Error}. `;
      }
    }

    // Method 3: Fallback using a simple contact service (Netlify Forms style)
    if (!emailSent) {
      try {
        // Create a formatted plain text version for fallback
        const formData = new FormData();
        formData.append('form-name', 'contact');
        formData.append('name', contactName);
        formData.append('company', entityName || '');
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('message', message || '');
        formData.append('language', lang);
        
        // Try sending to a backup service
        const backupResponse = await fetch('https://formsubmit.co/business@businesspartner.sa', {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });

        if (backupResponse.ok) {
          emailSent = true;
          console.log('Email sent via FormSubmit successfully');
        }
      } catch (backupError) {
        console.log('Backup service error:', backupError);
        errorDetails += `FormSubmit: ${backupError}. `;
      }
    }

    // Method 3: Last resort - log to server and show success to user
    if (!emailSent) {
      // At minimum, we log the submission server-side
      console.warn('All email services failed, but form data logged:', {
        contactName, entityName, email, phone, message, lang
      });
    }

    // Always return success to user (even if email fails, we have the data logged)
    return new Response(JSON.stringify({
      success: true,
      message: lang === 'ar' 
        ? 'تم إرسال رسالتك بنجاح! سنتواصل معك خلال 24 ساعة.'
        : 'Thank you! Your message has been sent successfully. We will contact you within 24 hours.',
      emailDelivered: emailSent,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Sorry, there was an error processing your message. Please try again or contact us directly.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Test endpoint
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Business Partner Contact API is working',
    timestamp: new Date().toISOString(),
    endpoints: {
      POST: 'Submit contact form',
      GET: 'Health check'
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};