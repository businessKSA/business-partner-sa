import type { APIRoute } from 'astro';
import { createGmailService } from '../../utils/gmail';
import { createWebinarRegistration } from '../../utils/notion';

export const prerender = false;

const PHONE_PATTERN = /^(?:\+?966|0)?5\d{8}$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const {
      fullName,
      phone,
      email,
      residencyStatus,
      city,
      lang,
      source,
      utmSource,
      utmCampaign,
      utmMedium,
    } = data;

    const isAr = lang === 'ar';

    if (!fullName || !phone || !email || !residencyStatus) {
      return new Response(
        JSON.stringify({
          success: false,
          message: isAr
            ? 'يرجى تعبئة جميع الحقول المطلوبة.'
            : 'Please fill in all required fields.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!PHONE_PATTERN.test(phone)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: isAr
            ? 'رقم الجوال غير صحيح. يرجى إدخال رقم سعودي صحيح.'
            : 'Invalid phone number. Please enter a valid Saudi mobile number.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['Saudi National', 'Resident (Muqeem)'].includes(residencyStatus)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: isAr ? 'يرجى تحديد صفتك.' : 'Please select your residency status.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const savedToNotion = await createWebinarRegistration({
      fullName,
      phone,
      email,
      residencyStatus,
      city,
      lang: isAr ? 'ar' : 'en',
      source,
      utmSource,
      utmCampaign,
      utmMedium,
    });

    // Best-effort notification email; registration still succeeds if this fails.
    try {
      const gmailService = createGmailService();
      if (gmailService) {
        await gmailService.sendEmail({
          to: 'business@businesspartnerksa.com',
          subject: `New Webinar Registration: ${fullName}`,
          textBody: `New webinar registration\n\nName: ${fullName}\nPhone: ${phone}\nEmail: ${email}\nResidency: ${residencyStatus}\nCity: ${city || 'N/A'}\nLanguage: ${lang}\nSource: ${source || 'N/A'}\nUTM Source: ${utmSource || 'N/A'}\nUTM Campaign: ${utmCampaign || 'N/A'}\nUTM Medium: ${utmMedium || 'N/A'}\nSynced to Notion: ${savedToNotion}`,
          htmlBody: `<h2>New Webinar Registration</h2>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Residency:</strong> ${residencyStatus}</p>
            <p><strong>City:</strong> ${city || 'N/A'}</p>
            <p><strong>Language:</strong> ${lang}</p>
            <p><strong>Source:</strong> ${source || 'N/A'}</p>
            <p><strong>UTM:</strong> ${utmSource || 'N/A'} / ${utmCampaign || 'N/A'} / ${utmMedium || 'N/A'}</p>
            <p><strong>Synced to Notion:</strong> ${savedToNotion}</p>`,
        });
      }
    } catch (emailError) {
      console.error('Webinar registration email error:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isAr
          ? 'تم تسجيلك بنجاح! ستصلك تفاصيل الدخول عبر البريد الإلكتروني وواتساب.'
          : 'You are registered! Access details will be sent to you by email and WhatsApp.',
        savedToNotion,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webinar registration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Sorry, there was an error processing your registration. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
