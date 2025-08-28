export const copy = {
  ar: {
    // Meta
    meta: {
      title: 'شريك الأعمال - ندير لك منصاتك الحكومية',
      description: 'ندير لك منصاتك الحكومية الأهم لضمان سير أعمالك على مدار الساعة! إدارة قوى، التأمينات، مقيم/أبشر أعمال بخبرة وكفاءة.',
    },

    // Navigation
    nav: {
      home: 'الرئيسية',
      services: 'الخدمات',
      packages: 'الباقات',
      setup: 'الخطوات',
      contact: 'تواصل معنا',
      language: 'English',
    },

    // Hero
    hero: {
      badge: '',
      title: 'ندير لك منصاتك الحكومية الأهم لضمان سير أعمالك على مدار الساعة!',
      subtitle: 'إدارة متكاملة لمنصات قوى، التأمينات الاجتماعية، مقيم/أبشر أعمال بخبرة +15 سنة. نضمن امتثالك الكامل وتجنب الغرامات.',
      ctaPrimary: 'ابدأ الآن',
      ctaSecondary: 'تعرف على خدماتنا',
      stats: {
        founded: { number: '2008', label: 'منذ' },
        experience: { number: '15+', label: 'سنة خبرة' },
        packages: { number: '500+', label: 'عميل راضي' },
      },
    },

    // Features
    features: {
      title: 'لماذا شريك الأعمال؟',
      items: [
        {
          title: 'إدارة شاملة 24/7',
          subtitle: 'مراقبة مستمرة لجميع منصاتك الحكومية',
        },
        {
          title: 'خبرة +15 سنة',
          subtitle: 'فريق متخصص في اللوائح والأنظمة السعودية',
        },
        {
          title: 'ضمان الامتثال',
          subtitle: 'تجنب الغرامات والمخالفات',
        },
      ],
    },

    // Services
    services: {
      title: 'خدماتنا الأساسية',
      items: [
        {
          title: 'إدارة منصة قوى',
          description: 'العقود، التأشيرات، نقل الكفالة، امتثال نطاقات، المخالفات',
        },
        {
          title: 'إدارة التأمينات الاجتماعية',
          description: 'إضافة/حذف المشتركين، الشهادات، الفواتير، أوراق التدقيق',
        },
        {
          title: 'إدارة مقيم/أبشر أعمال',
          description: 'إصدار/تجديد الإقامة، تأشيرات الخروج والعودة، النهائي، نقل الكفالة',
        },
      ],
    },

    // Packages
    packages: {
      title: 'باقات الخدمات',
      items: [
        {
          name: 'الباقة الأساسية',
          nameEn: 'Core Plan',
          price: '999 ريال / شهرياً',
          features: [
            'إدارة منصة قوى (العقود، التأشيرات، نقل الكفالة، نطاقات)',
            'إدارة التأمينات الاجتماعية (المشتركين، الشهادات، الفواتير)',
            'إدارة مقيم/أبشر أعمال (الإقامة، تأشيرات الخروج والعودة)'
          ],
          featured: true,
        },
        {
          name: 'إضافة إدارة منصة مدد لتحويل الرواتب',
          nameEn: 'Mudad Add-on',
          price: '+199 ريال / شهرياً',
          features: [
            'إضافة/حذف الموظفين في منصة مُدد',
            'معالجة الرواتب المربوطة بالبنك',
            'حل مخالفات الامتثال والتسويات'
          ],
        },
      ],
    },

    // Steps (keeping for compatibility)
    steps: {
      title: 'خطوات الخدمة',
      phases: [
        {
          title: 'المرحلة الأولى — الإعداد',
          items: ['تحديد المتطلبات', 'إعداد الحسابات', 'ربط المنصات'],
        },
        {
          title: 'المرحلة الثانية — التشغيل',
          items: ['إدارة يومية', 'متابعة الامتثال', 'التقارير الدورية'],
        },
        {
          title: 'المرحلة الثالثة — الدعم المستمر',
          items: ['صيانة دورية', 'دعم فني', 'تحديثات مستمرة'],
        },
      ],
      interim: {
        title: 'خدمة الدعم الفوري',
        subtitle: 'دعم سريع وحلول عاجلة',
      },
    },

    // Contact
    contact: {
      title: 'تواصل معنا',
      form: {
        entityName: 'اسم المنشأة',
        contactName: 'اسم المسؤول',
        email: 'البريد الإلكتروني',
        phone: 'رقم الجوال (السعودية)',
        message: 'الرسالة (اختياري)',
        submit: 'إرسال',
        submitting: 'جاري الإرسال...',
        success: 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.',
        error: 'حدث خطأ في الإرسال. يرجى المحاولة مرة أخرى.',
      },
      company: {
        title: 'بيانات الشركة',
        details: {
          phone: 'الجوال',
          email: 'البريد الإلكتروني',
          website: 'الموقع الإلكتروني',
          address: 'العنوان',
          cr: 'السجل التجاري',
          vat: 'الرقم الضريبي',
          unified: 'الرقم الموحد',
        },
        values: {
          phone: '0503793356',
          email: 'business@businesspartner.sa',
          website: 'www.businesspartner.sa',
          address: 'الرياض – حي العارض – شارع ريحانة بنت زيد',
          cr: '1009008634',
          vat: '310887376200003',
          unified: '7038696196',
        },
      },
    },

    // Footer
    footer: {
      copyright: '© 2025 شريك الأعمال. جميع الحقوق محفوظة.',
      website: 'www.businesspartner.sa',
    },

    // Common
    common: {
      readMore: 'اقرأ المزيد',
      learnMore: 'اعرف أكثر',
      getStarted: 'ابدأ الآن',
      contactUs: 'تواصل معنا',
    },
  },

  en: {
    // Meta
    meta: {
      title: 'Business Partner - We Manage Your Government Platforms',
      description: 'We manage your most essential government platforms so your business runs 24/7! Expert management of Qiwa, GOSI, Muqeem/Absher Business with expertise and efficiency.',
    },

    // Navigation
    nav: {
      home: 'Home',
      services: 'Services',
      packages: 'Packages',
      setup: 'Steps',
      contact: 'Contact',
      language: 'العربية',
    },

    // Hero
    hero: {
      badge: '',
      title: 'We manage your most essential government platforms so your business runs 24/7!',
      subtitle: 'Complete management of Qiwa, GOSI, Muqeem/Absher Business with 15+ years expertise. We ensure full compliance and help you avoid penalties.',
      ctaPrimary: 'Start now',
      ctaSecondary: 'Learn about our services',
      stats: {
        founded: { number: '2008', label: 'Founded' },
        experience: { number: '15+', label: 'Years expertise' },
        packages: { number: '500+', label: 'Satisfied clients' },
      },
    },

    // Features
    features: {
      title: 'Why Business Partner?',
      items: [
        {
          title: 'Comprehensive 24/7 Management',
          subtitle: 'Continuous monitoring of all your government platforms',
        },
        {
          title: '15+ Years Expertise',
          subtitle: 'Specialized team in Saudi regulations and systems',
        },
        {
          title: 'Compliance Guarantee',
          subtitle: 'Avoid penalties and violations',
        },
      ],
    },

    // Services
    services: {
      title: 'Our Core Services',
      items: [
        {
          title: 'Qiwa Platform Management',
          description: 'Contracts, visas, sponsorship transfers, Nitaqat compliance, violations',
        },
        {
          title: 'GOSI Management',
          description: 'Add/remove contributors, certificates, billing, audit documents',
        },
        {
          title: 'Muqeem/Absher Business Management',
          description: 'Iqama issue/renewal, exit re-entry visas, final exit, sponsorship transfer',
        },
      ],
    },

    // Packages
    packages: {
      title: 'Service Packages',
      items: [
        {
          name: 'Core Plan',
          nameEn: 'Core Plan',
          price: 'SAR 999 / month',
          features: [
            'Qiwa Platform Management (contracts, visas, sponsorship transfers, Nitaqat)',
            'GOSI Management (contributors, certificates, billing)',
            'Muqeem/Absher Business Management (Iqama, exit re-entry visas)'
          ],
          featured: true,
        },
        {
          name: 'Mudad Payroll Add-on',
          nameEn: 'Mudad Add-on',
          price: '+SAR 199 / month',
          features: [
            'Employee add/remove in Mudad',
            'Bank-linked payroll processing',
            'Compliance violations resolution and settlements'
          ],
        },
      ],
    },

    // Steps (keeping for compatibility)
    steps: {
      title: 'Service Steps',
      phases: [
        {
          title: 'Phase 1 — Setup',
          items: ['Requirements analysis', 'Account setup', 'Platform integration'],
        },
        {
          title: 'Phase 2 — Operations',
          items: ['Daily management', 'Compliance monitoring', 'Regular reporting'],
        },
        {
          title: 'Phase 3 — Ongoing Support',
          items: ['Regular maintenance', 'Technical support', 'Continuous updates'],
        },
      ],
      interim: {
        title: 'Immediate Support Service',
        subtitle: 'Quick support and urgent solutions',
      },
    },

    // Contact
    contact: {
      title: 'Contact us',
      form: {
        entityName: 'Entity Name',
        contactName: 'Contact Name',
        email: 'Email',
        phone: 'KSA Phone',
        message: 'Message (Optional)',
        submit: 'Send',
        submitting: 'Sending...',
        success: 'Your message has been sent successfully! We will contact you soon.',
        error: 'An error occurred while sending. Please try again.',
      },
      company: {
        title: 'Company Details',
        details: {
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          address: 'Address',
          cr: 'Commercial Registration',
          vat: 'VAT Number',
          unified: 'Unified Number',
        },
        values: {
          phone: '0503793356',
          email: 'business@businesspartner.sa',
          website: 'www.businesspartner.sa',
          address: 'Riyadh – Al-Arid – Rayhana bint Zayd St.',
          cr: '1009008634',
          vat: '310887376200003',
          unified: '7038696196',
        },
      },
    },

    // Footer
    footer: {
      copyright: '© 2025 Business Partner. All rights reserved.',
      website: 'www.businesspartner.sa',
    },

    // Common
    common: {
      readMore: 'Read more',
      learnMore: 'Learn more',
      getStarted: 'Get started',
      contactUs: 'Contact us',
    },
  },
} as const;

// Helper function to get content by locale
export function getContent(locale: 'ar' | 'en') {
  return copy[locale];
}