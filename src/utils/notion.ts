// Server-side integration with Notion API for webinar registrations.
// Requires a Notion internal integration token shared with the target database.
export interface WebinarRegistration {
  fullName: string;
  phone: string;
  email: string;
  residencyStatus: 'Saudi National' | 'Resident (Muqeem)';
  city?: string;
  lang: 'ar' | 'en';
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
}

export async function createWebinarRegistration(data: WebinarRegistration): Promise<boolean> {
  const token = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    console.log('Notion API not configured - skipping registration sync');
    return false;
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          'Full Name': { title: [{ text: { content: data.fullName } }] },
          Phone: { phone_number: data.phone },
          Email: { email: data.email },
          'Residency Status': { select: { name: data.residencyStatus } },
          City: { rich_text: [{ text: { content: data.city || '' } }] },
          Language: { select: { name: data.lang } },
          Source: { rich_text: [{ text: { content: data.source || '' } }] },
          'UTM Source': { rich_text: [{ text: { content: data.utmSource || '' } }] },
          'UTM Campaign': { rich_text: [{ text: { content: data.utmCampaign || '' } }] },
          'UTM Medium': { rich_text: [{ text: { content: data.utmMedium || '' } }] },
          Status: { status: { name: 'Not started' } },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Notion API request failed:', error);
    return false;
  }
}
