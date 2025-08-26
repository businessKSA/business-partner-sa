import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, company, email, phone, services, message } = data;

    // Log the submission for debugging
    console.log('Contact form submission:', {
      name, company, email, phone, services, message,
      timestamp: new Date().toISOString()
    });

    // Create the email content
    const emailContent = {
      to: 'business@businesspartnerksa.com',
      subject: `New Contact Form: ${name} - ${company || 'Website'}`,
      text: `
New Contact Form Submission

Name: ${name}
Company: ${company || 'Not provided'}  
Email: ${email}
Phone: ${phone}
Services Requested: ${services || 'Not specified'}

Message:
${message || 'No message provided'}

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)
`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="margin: 0;">New Contact Form Submission</h2>
    <p style="margin: 5px 0; opacity: 0.9;">Business Partner Services</p>
  </div>
  
  <div style="background: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Name:</strong><br>
      <span style="background: #f8fafc; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${name}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Company:</strong><br>
      <span style="background: #f8fafc; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${company || 'Not provided'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Email:</strong><br>
      <span style="background: #f8fafc; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${email}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Phone:</strong><br>
      <span style="background: #f8fafc; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${phone}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Services:</strong><br>
      <span style="background: #f8fafc; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${services || 'Not specified'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #0066cc;">Message:</strong><br>
      <div style="background: #f8fafc; padding: 12px; border-radius: 4px; margin-top: 5px; white-space: pre-wrap;">${message || 'No message provided'}</div>
    </div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #666; text-align: center;">
      <p>Submitted on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)</p>
    </div>
  </div>
</div>`
    };

    // Try multiple email delivery methods
    let emailSent = false;
    
    // Method 1: Use Web3Forms (reliable free service)
    try {
      const web3formsResponse = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: process.env.WEB3FORMS_ACCESS_KEY || '0c67b107-5265-4d5c-b7c5-89ff59e96b66',
          name: name,
          email: email,
          subject: emailContent.subject,
          message: `
Company: ${company || 'Not provided'}
Phone: ${phone}
Services: ${services || 'Not specified'}
Email: ${email}

Message:
${message || 'No message provided'}

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)
          `,
          from_name: name,
          to: 'business@businesspartnerksa.com',
          cc: email,
          botcheck: '',
          _template: 'table'
        })
      });

      const web3Result = await web3formsResponse.json();
      
      if (web3formsResponse.ok && web3Result.success) {
        emailSent = true;
        console.log('Email sent via Web3Forms successfully');
      } else {
        console.log('Web3Forms failed:', web3Result);
      }
    } catch (web3Error) {
      console.log('Web3Forms error:', web3Error);
    }

    // Method 2: Backup with Formspree
    if (!emailSent) {
      try {
        const formspreeResponse = await fetch('https://formspree.io/f/xdkowdjq', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            email: email,
            company: company,
            phone: phone,
            services: services,
            message: message,
            _replyto: email,
            _subject: emailContent.subject
          })
        });

        if (formspreeResponse.ok) {
          emailSent = true;
          console.log('Email sent via Formspree successfully');
        }
      } catch (formspreeError) {
        console.log('Formspree failed:', formspreeError);
      }
    }

    // Return success response with email status
    return new Response(JSON.stringify({
      success: true,
      message: emailSent 
        ? 'Thank you! Your message has been sent successfully.' 
        : 'Thank you for your message! We will contact you soon.',
      emailDelivered: emailSent,
      debug: 'Form processed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Sorry, there was an error sending your message. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Test endpoint
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Contact API is working',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};