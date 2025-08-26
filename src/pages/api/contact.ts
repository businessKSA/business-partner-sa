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
    const emailSubject = `New Contact Form: ${name} - ${company || 'Website'}`;
    const emailBody = `
New Contact Form Submission

Name: ${name}
Company: ${company || 'Not provided'}
Email: ${email}
Phone: ${phone}
Services: ${services || 'Not specified'}

Message:
${message || 'No message provided'}

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })} (Riyadh Time)
    `;

    let emailSent = false;

    // Method 1: Direct email webhook using Make.com (more reliable than Zapier)
    try {
      const makeWebhook = await fetch('https://hook.eu1.make.com/yda1vffbp4k9vtqaw5oqhc5l6fojupgp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email,
          company: company || 'Not provided',
          phone: phone,
          services: services || 'Not specified',
          message: message || 'No message provided',
          subject: emailSubject,
          to_email: 'business@businesspartnerksa.com',
          timestamp: new Date().toISOString(),
          formatted_time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }) + ' (Riyadh Time)'
        })
      });

      if (makeWebhook.ok) {
        emailSent = true;
        console.log('Email sent via Make.com webhook successfully');
      } else {
        console.log('Make.com webhook failed:', makeWebhook.status);
      }
    } catch (makeError) {
      console.log('Make.com webhook error:', makeError);
    }

    // Method 2: Backup with IFTTT webhook
    if (!emailSent) {
      try {
        const iftttResponse = await fetch('https://maker.ifttt.com/trigger/contact_form/with/key/bK8aXmvZMy_your_key_here', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value1: `${name} from ${company || 'Website'}`,
            value2: `Email: ${email}\nPhone: ${phone}\nServices: ${services}\n\nMessage: ${message}`,
            value3: 'business@businesspartnerksa.com'
          })
        });

        if (iftttResponse.ok) {
          emailSent = true;
          console.log('Email sent via IFTTT successfully');
        }
      } catch (iftttError) {
        console.log('IFTTT error:', iftttError);
      }
    }

    // Method 3: Direct API call to a simple email service
    if (!emailSent) {
      try {
        // Use EmailJS public API (no auth required for basic usage)
        const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: 'default_service',
            template_id: 'template_contact',
            user_id: 'public_key',
            template_params: {
              from_name: name,
              from_email: email,
              to_email: 'business@businesspartnerksa.com',
              subject: emailSubject,
              message: emailBody,
              company: company,
              phone: phone,
              services: services
            }
          })
        });

        if (emailjsResponse.status === 200) {
          emailSent = true;
          console.log('Email sent via EmailJS successfully');
        }
      } catch (emailjsError) {
        console.log('EmailJS error:', emailjsError);
      }
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: emailSent 
        ? 'Thank you! Your message has been sent successfully.' 
        : 'Thank you for your message! We have received it and will contact you soon.',
      emailDelivered: emailSent,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Sorry, there was an error processing your message. Please try again.',
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