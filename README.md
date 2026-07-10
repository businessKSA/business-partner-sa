# Business Partner - Bilingual Astro Landing Page

> We manage your most essential government platforms so your business runs 24/7!

A complete bilingual (Arabic/English) landing page for Business Partner Services built with Astro, featuring government platform management services in Saudi Arabia.

## 🚀 Features

- **Bilingual Support**: Full Arabic (RTL) and English (LTR) support with Astro i18n
- **Government Platform Focus**: Specialized in Qiwa, GOSI, and Muqeem/Absher Business
- **Modern Tech Stack**: Astro 5.x with TypeScript and Vercel deployment
- **Lead Generation**: Integrated contact forms with configurable endpoint
- **Responsive Design**: Mobile-first approach with smooth language switching
- **SEO Optimized**: Proper meta tags, structured data, and sitemap

## 🏢 Business Information

**Business Partner** - Government Platform Management Services

- **Phone**: 0503793356
- **Email**: business@businesspartner.sa
- **Website**: www.businesspartner.sa
- **Address**: الرياض – حي العارض – شارع ريحانة بنت زيد
- **CR**: 1009008634
- **VAT**: 310887376200003
- **Unified**: 7038696196

### Services & Pricing

#### Core Plan - 999 SAR/month
- Qiwa Platform Management (contracts, visas, sponsorship transfers, Nitaqat)
- GOSI Management (contributors, certificates, billing)
- Muqeem/Absher Business Management (Iqama, exit re-entry visas)

#### Mudad Add-on - +199 SAR/month
- Employee add/remove in Mudad
- Bank-linked payroll processing
- Compliance violations resolution and settlements

## 🛠 Technology Stack

- **Framework**: [Astro](https://astro.build) 5.x
- **Language**: TypeScript
- **Styling**: CSS with RTL/LTR support
- **Deployment**: Vercel with automatic deployments
- **i18n**: Astro's built-in internationalization
- **API**: Server-side rendering for lead capture

## 🏗 Project Structure

```
src/
├── components/
│   ├── Header.astro           # Navigation with language toggle
│   ├── Hero.astro            # Main hero section
│   ├── Features.astro        # Why choose us section
│   ├── Services.astro        # Core services overview
│   ├── Packages.astro        # Pricing packages
│   ├── Contact.astro         # Lead generation form
│   ├── LanguageToggle.astro  # RTL/LTR language switcher
│   ├── CallFab.astro         # Floating call button
│   └── Footer.astro          # Company information
├── content/
│   └── copy.ts              # Centralized bilingual content
├── layouts/
│   └── BaseLayout.astro     # Main layout with SEO
├── pages/
│   ├── index.astro          # Redirect to /en/
│   ├── ar/
│   │   └── index.astro      # Arabic homepage
│   ├── en/
│   │   └── index.astro      # English homepage
│   └── api/
│       └── contact.ts       # Legacy contact API
├── styles/
│   └── global.css          # Global styles with RTL support
└── utils/
    └── i18n.ts            # i18n utilities (legacy)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/businessKSA/business-partner-sa.git
   cd business-partner-sa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your lead endpoint:
   ```env
   PUBLIC_LEAD_ENDPOINT=https://your-webhook-endpoint.com/api/leads
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   
   Visit http://localhost:4321

## 🌐 Routes

- `/` - Redirects to `/en/` (default English)
- `/en/` - English homepage
- `/ar/` - Arabic homepage (RTL)
- `/api/contact` - Contact form submission (legacy)

## 📝 Content Management

All content is centralized in `src/content/copy.ts`:

```typescript
export const copy = {
  ar: {
    meta: { title: '...', description: '...' },
    nav: { home: 'الرئيسية', ... },
    hero: { title: '...', subtitle: '...' },
    // ... other sections
  },
  en: {
    meta: { title: '...', description: '...' },
    nav: { home: 'Home', ... },
    hero: { title: '...', subtitle: '...' },
    // ... other sections
  }
}
```

## 🎨 Language & Direction Support

### RTL/LTR Switching
- Automatic direction switching via HTML `dir` attribute
- Arabic uses RTL layout with appropriate fonts
- Smooth transitions between language switches
- CSS logical properties for universal layout

### Font Stack
```css
/* English */
html[lang="en"] {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  direction: ltr;
}

/* Arabic */
html[lang="ar"] {
  font-family: 'Segoe UI', 'Tahoma', 'Arabic UI Text', sans-serif;
  direction: rtl;
}
```

## 📱 Contact Form & Lead Generation

### Form Fields
- **Entity Name** (اسم المنشأة)
- **Contact Name** (اسم المسؤول)  
- **Email** (البريد الإلكتروني)
- **KSA Phone** (رقم الجوال السعودي)
- **Message** (الرسالة - اختياري)
- **Language** (hidden field)

### Lead Endpoint Integration

The form submits JSON data to `PUBLIC_LEAD_ENDPOINT`:

```javascript
{
  entityName: "Company Name",
  contactName: "John Doe", 
  email: "john@company.com",
  phone: "0501234567",
  message: "Interested in services",
  lang: "en",
  source: "businesspartner.sa",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

### Supported Lead Endpoints
- Google Cloud Functions
- Make.com webhooks
- Zapier webhooks
- Custom CRM APIs
- Any REST API accepting JSON

## 🎥 Webinar Landing Page

Bilingual campaign landing page for paid social/ad traffic: `/ar/webinar` and `/en/webinar`.

- **Pages**: `src/pages/ar/webinar.astro`, `src/pages/en/webinar.astro` — edit the hero title, date/time/platform, and agenda copy directly in these files for each new webinar.
- **Registration form**: `src/components/webinar/WebinarRegisterForm.astro` posts to `/api/webinar-register.ts`, which validates the submission (name, KSA phone, email, residency status: Saudi National / Resident) and:
  1. Creates a row in a Notion database via the Notion API (`src/utils/notion.ts`)
  2. Sends a best-effort notification email via the existing Gmail service
  3. Returns a success message that triggers ad-pixel conversion events client-side

### Notion setup

A database named **"Webinar Registrations - AI Automation (KSA)"** was created for this campaign, with columns: Full Name, Phone, Email, Residency Status, City, Language, Source, UTM Source/Campaign/Medium, Status, Registered At.

To connect the live site to it:
1. Create a Notion internal integration at https://www.notion.so/my-integrations and copy its token.
2. Share the Notion database with that integration (`•••` menu → Connections → add the integration).
3. Set `NOTION_API_KEY` (the integration token) and `NOTION_DATABASE_ID` (from the database URL) in your environment.

If these env vars are not set, the API route logs a warning and skips the Notion sync — the registration still succeeds and the email notification still sends.

### Social/ad pixel tracking

Set any of `PUBLIC_META_PIXEL_ID`, `PUBLIC_TIKTOK_PIXEL_ID`, `PUBLIC_SNAPCHAT_PIXEL_ID` to enable the matching pixel site-wide (`src/layouts/BaseLayout.astro`). Each pixel fires a page-view on load and a `CompleteRegistration`/`SIGN_UP` conversion event when a webinar registration succeeds. Unset pixels are skipped entirely — no placeholder scripts load.

### Sharing

`src/components/webinar/SocialShare.astro` renders WhatsApp/X/Facebook/Telegram share links under the form for organic reach.

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npx vercel
   ```

2. **Configure environment variables**
   In Vercel dashboard, add:
   ```
   PUBLIC_LEAD_ENDPOINT=your-webhook-url
   ```

3. **Deploy**
   ```bash
   npm run build
   npx vercel --prod
   ```

### GitHub Auto-Deploy
The repository is configured for automatic Vercel deployments via GitHub integration.

### Manual Build
```bash
npm run build
npm run preview  # Test production build locally
```

## 🔧 Configuration

### Astro Configuration
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://businesspartner.sa',
  output: 'server', // For API routes
  adapter: vercel(),
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ar'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  }
});
```

### SEO & Meta Tags
Automatically generated per language:
- Open Graph tags
- Twitter Cards  
- Structured data (JSON-LD)
- Canonical URLs
- Hreflang tags

## 🎯 SEO Features

- **Bilingual Sitemap**: Automatic generation
- **Structured Data**: Organization and service markup
- **Meta Tags**: Language-specific titles and descriptions
- **Performance**: Optimized images and lazy loading
- **Accessibility**: ARIA labels and semantic HTML

## 📊 Analytics & Tracking

Add your tracking codes to `src/layouts/BaseLayout.astro`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>

<!-- Facebook Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
// ... rest of pixel code
</script>
```

## 🐛 Troubleshooting

### Build Issues
```bash
# Skip type checking if needed
npx astro build --skip-check

# Check for TypeScript errors
npm run astro check
```

### Language Switching
- Ensure HTML `lang` and `dir` attributes are set
- Check CSS logical properties for RTL compatibility
- Verify route structure matches locale configuration

### Form Submission
- Test `PUBLIC_LEAD_ENDPOINT` in browser network tab
- Check CORS settings on your webhook endpoint
- Verify JSON format matches your CRM expectations

## 📋 Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run astro        # Astro CLI commands
npm run astro check  # Type checking
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📜 License

This project is proprietary to Business Partner Services. All rights reserved.

## 📞 Support

For technical support or inquiries:
- **Email**: business@businesspartner.sa
- **Phone**: 0503793356
- **Website**: https://businesspartner.sa

---

**Built with ❤️ using Astro & TypeScript**

*Proudly serving Saudi businesses since 2008*