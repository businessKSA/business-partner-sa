// Real estate & commercial workspace opportunities shown on /real-estate.
// Sourced from Business Partner's own vendor proposals (Google Drive: Real Estate Workspace Center)
// and the internal Real Estate & Workspace Center (Notion). Prices/areas are as quoted by vendors
// at proposal time and should be reconfirmed before a client signs.

export type PropertyCategory =
  | 'serviced-office'
  | 'coworking'
  | 'commercial-building';

export interface RealEstateOpportunity {
  slug: string;
  category: PropertyCategory;
  city: 'riyadh';
  brand: string; // grouping key
  brandLabel: { ar: string; en: string };
  district: { ar: string; en: string };
  name: { ar: string; en: string };
  vendor: string;
  summary: { ar: string; en: string };
  areaSqm?: number;
  capacity?: number;
  monthlyPrice?: number; // SAR
  priceNote: { ar: string; en: string };
  features: { ar: string[]; en: string[] };
  badge: { ar: string; en: string };
}

export const realEstateOpportunities: RealEstateOpportunity[] = [
  // ── COLABS ─────────────────────────────────────────────────────────────
  {
    slug: 'colabs-narjis',
    category: 'coworking',
    city: 'riyadh',
    brand: 'colabs',
    brandLabel: { ar: 'كولابس', en: 'COLABS' },
    district: { ar: 'حي النرجس', en: 'Al Narjis' },
    name: { ar: 'كولابس النرجس', en: 'COLABS Narjis' },
    vendor: 'COLABS',
    summary: {
      ar: 'مساحة عمل مجتمعية مخدومة بالكامل في حي النرجس شمال الرياض، مصممة للشركات الناشئة والفرق المؤسسية المتوسعة.',
      en: 'A founder-led, community-first fully serviced workspace in Al Narjis, North Riyadh, designed for startups and scaling enterprise teams.',
    },
    areaSqm: 311,
    capacity: 65,
    monthlyPrice: 156000,
    priceNote: { ar: 'شهريًا (بعد خصم 22%) — شامل الضريبة 179,400', en: 'per month (22% discount applied) — SAR 179,400 incl. VAT' },
    features: {
      ar: ['32 محطة عمل', '7 مكاتب تنفيذية', '2 غرفة اجتماعات', 'مكتب رئيس تنفيذي', 'غرفة تركيز وغرفة VC', 'شرفة وحديقة داخلية ومواقف'],
      en: ['32 workstations', '7 executive offices', '2 conference rooms', 'Executive CEO office', 'Focus room & VC room', 'Balcony, indoor garden, parking'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },

  // ── IWG ────────────────────────────────────────────────────────────────
  {
    slug: 'iwg-hq-wurud',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'iwg',
    brandLabel: { ar: 'IWG', en: 'IWG' },
    district: { ar: 'حي الورود', en: 'Al Wurood' },
    name: { ar: 'HQ الورود', en: 'HQ – Al Wurood' },
    vendor: 'IWG',
    summary: {
      ar: 'مكتب مخدوم على طريق الأمير عبدالله الفرعي بحي الورود، ضمن شبكة IWG العالمية بأكثر من 120 دولة.',
      en: 'A serviced office on King Abdullah Branch Road, Al Wurood — part of IWG’s global network spanning 120+ countries.',
    },
    capacity: 66,
    monthlyPrice: 181500,
    priceNote: { ar: 'شهريًا (عقد سنة) — غير شامل الضريبة', en: 'per month (1-year contract) — excl. VAT' },
    features: {
      ar: ['استقبال ثنائي اللغة', 'قاعات اجتماعات', 'إنترنت فائق السرعة', 'دعم تقني على مدار الساعة', 'وصول لأكثر من 4,200 صالة أعمال عالميًا'],
      en: ['Bilingual reception', 'Meeting rooms', 'Ultra-fast internet', '24/7 IT support', 'Access to 4,200+ business lounges worldwide'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },
  {
    slug: 'iwg-kafd',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'iwg',
    brandLabel: { ar: 'IWG', en: 'IWG' },
    district: { ar: 'مركز الملك عبدالله المالي (كافد)', en: 'King Abdullah Financial District (KAFD)' },
    name: { ar: 'مكتب مخدوم – كافد 4.04', en: 'Serviced Office – KAFD 4.04' },
    vendor: 'IWG',
    summary: {
      ar: 'عنوان مرموق داخل برج كافد بمركز الملك عبدالله المالي، مثالي للشركات التي تبحث عن حضور مؤسسي في قلب الرياض المالي.',
      en: 'A prestigious address inside a KAFD tower — ideal for companies seeking a flagship presence in Riyadh’s financial district.',
    },
    capacity: 62,
    monthlyPrice: 354640,
    priceNote: { ar: 'شهريًا (عقد سنة) — غير شامل الضريبة', en: 'per month (1-year contract) — excl. VAT' },
    features: {
      ar: ['عنوان كافد المميز', 'أثاث مكتبي متكامل', 'صيانة وتنظيف وتكييف', 'مرونة في التوسع', 'بطاقة عضوية لصالات الأعمال العالمية'],
      en: ['Premium KAFD address', 'Fully furnished offices', 'Maintenance, cleaning & AC included', 'Flexible scale up/down', 'Global business lounge membership'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },
  {
    slug: 'iwg-regus-tamkeen',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'iwg',
    brandLabel: { ar: 'IWG', en: 'IWG' },
    district: { ar: 'طريق الملك فهد', en: 'King Fahd Road' },
    name: { ar: 'ريجس – برج تمكين', en: 'Regus – Tamkeen Tower' },
    vendor: 'IWG / Regus',
    summary: {
      ar: 'مكتب مخدوم في برج تمكين على طريق الملك فهد، خيار متوازن بين الموقع المركزي والتكلفة.',
      en: 'A serviced office in Tamkeen Tower on King Fahd Road — a balanced choice between central location and cost.',
    },
    capacity: 65,
    monthlyPrice: 197000,
    priceNote: { ar: 'شهريًا (عقد سنة) — غير شامل الضريبة', en: 'per month (1-year contract) — excl. VAT' },
    features: {
      ar: ['موقع مركزي على طريق الملك فهد', 'قاعات اجتماعات مجهزة بالتقنية', 'خدمات إدارية وحسابات ذاتية', 'مرونة الانتقال المجاني بين مراكز IWG'],
      en: ['Central King Fahd Road location', 'Tech-equipped meeting rooms', 'Admin support & self-service portal', 'Free relocation across IWG centers'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },

  // ── Cloud Spaces ───────────────────────────────────────────────────────
  {
    slug: 'roshn-cloud-spaces',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'cloud-spaces',
    brandLabel: { ar: 'كلاود سبيسز', en: 'Cloud Spaces' },
    district: { ar: 'روشن فرونت', en: 'Roshn Front' },
    name: { ar: 'كلاود سبيسز – روشن فرونت (65 مقعد)', en: 'Cloud Spaces – Roshn Front (65 seats)' },
    vendor: 'Cloud Spaces',
    summary: {
      ar: 'مكتب سحابي داخل مشروع روشن فرونت مع عنوان وطني وخدمات استقبال ومرونة وصول 24/7.',
      en: 'A Cloud Suite office inside the Roshn Front development, with National Address, reception services, and 24/7 access.',
    },
    areaSqm: 165,
    capacity: 65,
    monthlyPrice: 230165,
    priceNote: { ar: 'إجمالي شهري (إيجار + مصاريف تشغيل) — عقد سنة', en: 'total monthly (rent + outgoings) — 1-year term' },
    features: {
      ar: ['عنوان وطني', 'وصول 24/7 لجناح مخصص', 'استقبال يرد باسم شركتك', 'خط هاتف IP مخصص لكل مكتب', 'خصم 15% على قاعات الاجتماعات والاستوديوهات'],
      en: ['National Address', '24/7 access to dedicated suite', 'Receptionist answering in your company name', 'Dedicated IP phone per office', '15% member discount on meeting rooms & studios'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },
  {
    slug: 'roshn-cloud-spaces-200pax',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'cloud-spaces',
    brandLabel: { ar: 'كلاود سبيسز', en: 'Cloud Spaces' },
    district: { ar: 'روشن فرونت', en: 'Roshn Front' },
    name: { ar: 'كلاود سبيسز – روشن فرونت (200 مقعد)', en: 'Cloud Spaces – Roshn Front (200 seats)' },
    vendor: 'Cloud Spaces',
    summary: {
      ar: 'جناح سحابي أكبر (600 م²) داخل روشن فرونت لفرق تصل إلى 200 موظف، بنفس امتيازات العضوية والاستقبال.',
      en: 'A larger 600 sqm Cloud Suite inside Roshn Front for teams up to 200 people, with the same membership perks and reception services.',
    },
    areaSqm: 600,
    capacity: 200,
    monthlyPrice: 810000,
    priceNote: { ar: 'إجمالي شهري تقريبي — إجمالي سنوي 9,720,000 ر.س', en: 'approx. total monthly — SAR 9,720,000 annual total' },
    features: {
      ar: ['600 م² جناح مخصص', 'عنوان وطني وشهادة إيجار', 'استقبال وخدمة بريد', 'دعم تقني موقعي', '4 ساعات شهريًا استخدام مجاني للمرافق'],
      en: ['600 sqm dedicated suite', 'National Address & Ejari', 'Reception & mail handling', 'On-site IT support', '4 hrs/month complimentary facility use'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },
  {
    slug: 'cloud-spaces-kingdom-centre',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'cloud-spaces',
    brandLabel: { ar: 'كلاود سبيسز', en: 'Cloud Spaces' },
    district: { ar: 'العليا – مركز المملكة', en: 'Al Olaya – Kingdom Centre' },
    name: { ar: 'كلاود سبيسز – مركز المملكة', en: 'Cloud Spaces – Kingdom Centre' },
    vendor: 'Cloud Spaces',
    summary: {
      ar: 'مكاتب مفروشة وصالات عمل مشتركة داخل برج المملكة الأيقوني بحي العليا، قريبة من المطار والمركز المالي والدبلوماسي.',
      en: 'Furnished offices and stylish coworking lounges inside the iconic Kingdom Tower in Al Olaya, close to the airport and the financial/diplomatic district.',
    },
    priceNote: { ar: 'السعر حسب المساحة والمدة — تواصل لعرض سعر', en: 'Price depends on size & term — contact for a quote' },
    features: {
      ar: ['عنوان برج المملكة المميز', 'مكاتب مخدومة بالكامل', 'خدمات تأسيس الشركات والبلدية', 'مقهى مختص وتطبيق أعضاء', 'وصول 24/7'],
      en: ['Prestigious Kingdom Tower address', 'Fully serviced offices', 'Company setup & Balady support', 'Speciality cafe & member app', '24/7 access'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },

  // ── Servcorp ───────────────────────────────────────────────────────────
  {
    slug: 'servcorp-olaya',
    category: 'coworking',
    city: 'riyadh',
    brand: 'servcorp',
    brandLabel: { ar: 'سيرفكورب', en: 'Servcorp' },
    district: { ar: 'العليا الجديدة', en: 'New Olaya' },
    name: { ar: 'سيرفكورب – برج العليا', en: 'Servcorp – Olaya Tower' },
    vendor: 'Servcorp',
    summary: {
      ar: 'مساحة عمل مشتركة بتصميم 50 مكتبًا في برج بالعليا الجديدة، مع مناطق عمل مشتركة وركن قهوة واسع.',
      en: 'A 50-desk coworking layout in a New Olaya tower, with generous shared coworking areas and a coffee spot.',
    },
    areaSqm: 208,
    priceNote: { ar: 'السعر حسب التخطيط والمدة — تواصل لعرض سعر', en: 'Price depends on layout & term — contact for a quote' },
    features: {
      ar: ['مساحة مكاتب 208م² + 565م² مساحات مشتركة', 'قاعة اجتماعات رئيسية (14 شخص)', 'غرف اجتماعات إضافية', 'ركن قهوة ومنطقة نسخ وطباعة'],
      en: ['208 sqm offices + 565 sqm common area', 'Main boardroom (14 pax)', 'Additional meeting rooms', 'Coffee spot & copy/print area'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },
  {
    slug: 'servcorp-stc-square',
    category: 'coworking',
    city: 'riyadh',
    brand: 'servcorp',
    brandLabel: { ar: 'سيرفكورب', en: 'Servcorp' },
    district: { ar: 'مربع الاتصالات', en: 'STC Square' },
    name: { ar: 'سيرفكورب – مربع الاتصالات', en: 'Servcorp – STC Square' },
    vendor: 'Servcorp',
    summary: {
      ar: 'مساحة عمل مشتركة في مربع الاتصالات (الدور الرابع) بتصميم 50 مكتبًا ومكاتب هادئة ومصلى.',
      en: 'A 50-desk coworking floor at STC Square (Level 4), with quiet desks, booths, and a prayer room.',
    },
    areaSqm: 213.5,
    priceNote: { ar: 'السعر حسب التخطيط والمدة — تواصل لعرض سعر', en: 'Price depends on layout & term — contact for a quote' },
    features: {
      ar: ['مساحة مكاتب 213.5م² + 765م² مساحات مشتركة', 'مكاتب هادئة ومقصورات تركيز', 'قاعات اجتماعات وغرفة مجلس إدارة', 'مصلى ودورات مياه مخصصة'],
      en: ['213.5 sqm offices + 765 sqm common area', 'Quiet desks & focus booths', 'Meeting rooms & boardroom', 'Prayer room & dedicated ablution'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },

  // ── Offices Zone ───────────────────────────────────────────────────────
  {
    slug: 'offices-zone-al-nuzha',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'offices-zone',
    brandLabel: { ar: 'أوفيسز زون', en: 'Offices Zone' },
    district: { ar: 'حي النزهة', en: 'Al Nuzha' },
    name: { ar: 'أوفيسز زون – النزهة', en: 'Offices Zone – Al Nuzha' },
    vendor: 'Offices Zone',
    summary: {
      ar: 'مساحة عمل بوتيكية على الدورين 5 و6 في حي النزهة (1,600 م²)، ضمن أسرع مشغّل مساحات عمل مرنة نموًا في السعودية.',
      en: 'A boutique workspace across the 5th & 6th floors in Al Nuzha (1,600 sqm), part of Saudi Arabia’s fastest-growing flexible workspace operator.',
    },
    areaSqm: 1600,
    capacity: 273,
    monthlyPrice: 1658333,
    priceNote: { ar: 'تقريبًا شهريًا — العقد السنوي 19,900,000 ر.س + الضريبة', en: 'approx. monthly — annual rate SAR 19,900,000 + VAT' },
    features: {
      ar: ['273 محطة عمل بين مكاتب خاصة ومساحات مشتركة', 'مقهى داخلي وتراس على السطح وملاعب بادل', 'غرف اجتماعات وطباعة وتصوير', 'مواقف آمنة وخدمة تنظيف يومية'],
      en: ['273 workstations across private offices & coworking', 'In-house cafe, rooftop terrace & padel courts', 'Meeting rooms & printing/copying', 'Secure parking & daily cleaning'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },
  {
    slug: 'offices-zone-olaya',
    category: 'serviced-office',
    city: 'riyadh',
    brand: 'offices-zone',
    brandLabel: { ar: 'أوفيسز زون', en: 'Offices Zone' },
    district: { ar: 'العليا', en: 'Al Olaya' },
    name: { ar: 'أوفيسز زون – العليا', en: 'Offices Zone – Al Olaya' },
    vendor: 'Offices Zone',
    summary: {
      ar: 'مساحة عمل بوتيكية في حي العليا (1,300 م²) على بعد دقيقتين مشيًا من برج المملكة، مع صالة رياضية ومسبح.',
      en: 'A boutique workspace in Al Olaya (1,300 sqm), a 2-minute walk from Kingdom Tower, with gym and swimming pool access.',
    },
    areaSqm: 1300,
    capacity: 165,
    monthlyPrice: 875000,
    priceNote: { ar: 'تقريبًا شهريًا — العقد السنوي 10,500,000 ر.س + الضريبة', en: 'approx. monthly — annual rate SAR 10,500,000 + VAT' },
    features: {
      ar: ['165 محطة عمل (141 مكتب خاص + 24 مكتب مشترك)', 'قاعتا اجتماعات (10 و4 أشخاص)', 'مصلى ودورات مياه خاصة', 'وصول لصالة رياضية ومسبح ARRAY'],
      en: ['165 workstations (141 private offices + 24 dedicated desks)', '2 meeting rooms (10 & 4 pax)', 'Prayer room & private restrooms', 'ARRAY gym & swimming pool access'],
    },
    badge: { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  },

  // ── The Ceremony ───────────────────────────────────────────────────────
  {
    slug: 'the-ceremony',
    category: 'coworking',
    city: 'riyadh',
    brand: 'the-ceremony',
    brandLabel: { ar: 'ذا سيريموني', en: 'The Ceremony' },
    district: { ar: 'طريق الأمير محمد بن عبدالعزيز', en: 'Prince Mohammed bin Abdulaziz Road' },
    name: { ar: 'ذا سيريموني – مساحة عمل مشتركة', en: 'The Ceremony – Coworking Space' },
    vendor: 'The Ceremony',
    summary: {
      ar: 'مساحة عمل مشتركة مرنة بعقود قصيرة تبدأ من 3 أشهر، تشمل استقبال وخدمات سكرتارية وقاعة اجتماعات.',
      en: 'A flexible coworking space with short-term contracts starting from 3 months, including reception, secretarial services, and a meeting room.',
    },
    monthlyPrice: 4000,
    priceNote: { ar: 'مكتب خاص من 16,500 ر.س/3 أشهر · محطة عمل من 5,400 ر.س/3 أشهر (غير شامل الضريبة)', en: 'Private office from SAR 16,500/3mo · Workstation from SAR 5,400/3mo (excl. VAT)' },
    features: {
      ar: ['استقبال وخدمات سكرتارية', 'استقبال وتحويل مكالمات', 'إنترنت عالي السرعة', 'طباعة وتصوير وخدمات ضيافة', 'مواقف سيارات وقاعة اجتماعات'],
      en: ['Reception & secretarial services', 'Call answering & transfer', 'High-speed internet', 'Printing, copying & hospitality services', 'Car parking & meeting room'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },

  // ── R House ────────────────────────────────────────────────────────────
  {
    slug: 'r-house',
    category: 'coworking',
    city: 'riyadh',
    brand: 'r-house',
    brandLabel: { ar: 'آر هاوس', en: 'R House' },
    district: { ar: 'الرياض', en: 'Riyadh' },
    name: { ar: 'آر هاوس – مساحة عمل مشتركة خاصة', en: 'R House – Private Coworking' },
    vendor: 'R House',
    summary: {
      ar: 'مساحة عمل عصرية بتصميم صناعي مفتوح، استوديوهات خاصة، وغرف اجتماعات زجاجية، بعضويات مرنة تناسب الأفراد والفرق.',
      en: 'A modern open-concept coworking space with industrial design, private studios, and glass-walled meeting rooms, with flexible memberships for individuals and teams.',
    },
    monthlyPrice: 2950,
    priceNote: { ar: 'عضوية Resident من 7,274 ر.س/شهر · Collaborator من 2,950 ر.س/شهر · Nomad من 950 ر.س/شهر', en: 'Resident membership from SAR 7,274/mo · Collaborator from SAR 2,950/mo · Nomad from SAR 950/mo' },
    features: {
      ar: ['استوديوهات خاصة (1-6 أشخاص)', 'غرفة اجتماعات كبرى (Boardroom) وورشة عمل حتى 20 شخصًا', 'استقبال وواي فاي وطباعة', 'تراس خارجي وفناء مركزي', 'قهوة مختصة ومطبخ ومواقف'],
      en: ['Private studios (1-6 people)', 'Boardroom & workshop space up to 20 people', 'Reception, WiFi & printing', 'Outside terrace & central courtyard', 'Artisan coffee, kitchen & parking'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },

  // ── SuperOffice ────────────────────────────────────────────────────────
  {
    slug: 'superoffice',
    category: 'coworking',
    city: 'riyadh',
    brand: 'superoffice',
    brandLabel: { ar: 'سوبر أوفيس', en: 'SuperOffice' },
    district: { ar: 'فروع متعددة (السويدي، الزهرة، منفوحة، العارض وغيرها)', en: 'Multiple branches (Al Suwaidi, Az Zahrah, Manfouhah, Al Aarid & more)' },
    name: { ar: 'سوبر أوفيس – مساحات عمل مشتركة', en: 'SuperOffice – Shared Workspaces' },
    vendor: 'SuperOffice',
    summary: {
      ar: 'شبكة فروع مساحات عمل مشتركة ومكاتب خاصة مفروشة في أحياء متعددة بالرياض، مع مستودعات ومكاتب افتراضية وعنوان وطني.',
      en: 'A network of shared workspace and furnished private office branches across multiple Riyadh districts, plus warehouses, virtual offices, and National Address.',
    },
    priceNote: { ar: 'باقات بالساعة/اليوم/الأسبوع/الشهر حتى السنة — تواصل لعرض سعر', en: 'Hourly/daily/weekly/monthly to yearly plans — contact for a quote' },
    features: {
      ar: ['مكاتب خاصة مفروشة بالكامل', 'مساحات عمل مشتركة وقاعات اجتماعات', 'مستودعات تخزين ومكاتب افتراضية', 'عنوان وطني ورخصة حكومية', 'صالة سينما وجيم وحديقة'],
      en: ['Fully furnished private offices', 'Shared workspaces & meeting rooms', 'Storage warehouses & virtual offices', 'National Address & government license', 'Cinema hall, gym & garden'],
    },
    badge: { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  },

  // ── Rwaq Business (Al Majediah) ───────────────────────────────────────
  {
    slug: 'rwaq-business',
    category: 'coworking',
    city: 'riyadh',
    brand: 'rwaq-business',
    brandLabel: { ar: 'رواق الأعمال', en: 'Rwaq Business' },
    district: { ar: 'حي القيروان', en: 'Al Qirawan' },
    name: { ar: 'رواق الأعمال', en: 'Rwaq Business' },
    vendor: 'Al Majediah',
    summary: {
      ar: 'مجمع مكاتب في قلب حي القيروان شمال الرياض على طريق الأمير سعود بن عبدالله بن جلوي، بمساحة مكتبية إجمالية 3,812م².',
      en: 'An office hub in the heart of Al Qirawan, North Riyadh, on Prince Saud bin Abdullah bin Jiluwi Road, with 3,812 sqm of total office space.',
    },
    areaSqm: 3812,
    priceNote: { ar: 'السعر حسب المكتب والمساحة — تواصل لعرض سعر', en: 'Price depends on unit & area — contact for a quote' },
    features: {
      ar: ['130 موقف سيارة', 'حديقة خضراء بمساحة 240م² وصالة رياضية', 'نظام أمني عالي ومنطقة ألعاب', '4 مناطق مكاتب (Zones) بأحدث التقنيات'],
      en: ['130 parking spaces', '240 sqm green area & gym', 'High-security system & play area', '4 office zones with the latest tech'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── RAFD ───────────────────────────────────────────────────────────────
  {
    slug: 'rafd-complex',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'rafd',
    brandLabel: { ar: 'مجمع رافد', en: 'RAFD Complex' },
    district: { ar: 'حي حطين', en: 'Hittin' },
    name: { ar: 'مجمع رافد المكتبي', en: 'RAFD Office Complex' },
    vendor: 'Al-Ramz Real Estate',
    summary: {
      ar: 'مجمع مكاتب ذكي وآمن وصديق للبيئة بحي حطين الراقي، على طريق الإمام فيصل بن سعود، بمفهوم "تحت سقف واحد".',
      en: 'A smart, secure, environment-friendly office complex in the prestigious Hittin district, on Al-Imam Faisal bin Saud Road, built around a "under one roof" concept.',
    },
    areaSqm: 1319,
    monthlyPrice: 219833,
    priceNote: { ar: 'مثال: وحدة 1,319م² — إيجار سنوي 2,638,000 ر.س (شامل الضريبة ≈7,499,437 لكامل المجمع)', en: 'Example: 1,319 sqm unit — SAR 2,638,000 annual rent (VAT-inclusive complex total ≈ SAR 7,499,437)' },
    features: {
      ar: ['دقيقتان من البوليفارد', '19 دقيقة من مطار الملك خالد الدولي', 'واجهات زجاجية وحدائق خارجية ومقهى', 'نظام أمني ذكي وكاميرات مراقبة متقدمة', 'مواقف VIP ومواقف جانبية'],
      en: ['2 minutes from The Boulevard', '19 minutes from King Khalid International Airport', 'Glass facades, outdoor gardens & cafe', 'Smart 24/7 security & advanced CCTV', 'VIP & side parking'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Narjis View & Narjis Business Park ──────────────────────────────────
  {
    slug: 'narjis-view',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'narjis-view',
    brandLabel: { ar: 'النرجس فيو', en: 'Narjis View' },
    district: { ar: 'حي النرجس', en: 'Al Narjis' },
    name: { ar: 'النرجس فيو', en: 'Narjis View' },
    vendor: 'Narjis View',
    summary: {
      ar: 'مشروع مكاتب ومعارض ومحلات متكامل شمال الرياض عند تقاطع طريق الأمير سعود بن عبدالله بن جلوي وطريق أبي بكر الصديق.',
      en: 'An integrated offices, showrooms, and F&B project in North Riyadh at the intersection of Prince Saud bin Abdullah bin Jiluwi St. and Abu Bakr Al Siddiq Rd.',
    },
    areaSqm: 21083,
    priceNote: { ar: 'فرصة استثمارية/تأجير مكاتب ومعارض — تواصل للتفاصيل', en: 'Investment/leasing opportunity for offices & showrooms — contact for details' },
    features: {
      ar: ['21,083م² مكاتب + 9,948م² مطاعم ومحلات', '1,400 موقف سيارة', 'عيادات (6,600م²) ومناطق ترفيه', 'أنظمة ذكية للمواقف وشحن السيارات الكهربائية'],
      en: ['21,083 sqm offices + 9,948 sqm F&B/shops', '1,400 parking spaces', 'Clinics (6,600 sqm) & entertainment zones', 'Smart parking guidance & EV chargers'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },
  {
    slug: 'narjis-business-park',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'narjis-business-park',
    brandLabel: { ar: 'النرجس بزنس بارك', en: 'Narjis Business Park' },
    district: { ar: 'حي النرجس', en: 'Al Narjis' },
    name: { ar: 'النرجس بزنس بارك', en: 'Narjis Business Park' },
    vendor: 'Narjis Business Park',
    summary: {
      ar: 'مجمع مكاتب واسع شمال الرياض على بعد 10 دقائق من مطار الملك خالد الدولي، بمساحات مكتبية تتجاوز 46 ألف م².',
      en: 'A large-scale office park in North Riyadh, 10 minutes from King Khalid International Airport, with over 46,000 sqm of office space.',
    },
    areaSqm: 46030,
    priceNote: { ar: 'فرصة استثمارية/تأجير مكاتب — تواصل للتفاصيل', en: 'Investment/leasing opportunity for offices — contact for details' },
    features: {
      ar: ['46,030م² مساحات مكتبية', '2,018 موقف سيارة', '14,000م² مساحات خضراء', 'مرافق بدروم بمساحة 5,000م²'],
      en: ['46,030 sqm of office space', '2,018 parking spaces', '14,000 sqm of green areas', '5,000 sqm of basement utilities'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Downtown Center ──────────────────────────────────────────────────
  {
    slug: 'downtown-center-takhassusi',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'downtown-center',
    brandLabel: { ar: 'داون تاون سنتر', en: 'Downtown Center' },
    district: { ar: 'شارع التخصصي', en: 'Al Takhassusi Street' },
    name: { ar: 'داون تاون سنتر – التخصصي', en: 'Downtown Center – Al Takhassusi' },
    vendor: 'Downtown Center',
    summary: {
      ar: 'أحدث المشاريع التجارية على شارع التخصصي، بمساحة أرض 7,500م² ومسطح بناء 9,830م²، يجمع بين المعارض والمكاتب.',
      en: 'One of the newest commercial developments on Al Takhassusi Street — 7,500 sqm land, 9,830 sqm built-up area, combining showrooms and offices.',
    },
    areaSqm: 9830,
    priceNote: { ar: 'فرصة استثمارية / تأجير معارض ومكاتب — تواصل للتفاصيل', en: 'Investment / leasing opportunity for showrooms & offices — contact for details' },
    features: {
      ar: ['331 موقف سيارة على دورين + بدروم', '13 معرضًا تجاريًا', '26 مكتبًا', 'استخدام مكتبي وتجاري', 'قرب أبرز المعالم (برج رافال، مستشفى الملكة، فندق كافيه)'],
      en: ['331 parking spaces across 2 floors + basement', '13 commercial showrooms', '26 offices', 'Office & commercial use', 'Near major landmarks (Al Faisaliah Tower, hospitals, cafés)'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Dar Sanad ────────────────────────────────────────────────────────
  {
    slug: 'dar-sanad-strip-mall',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'dar-sanad',
    brandLabel: { ar: 'دار سند', en: 'Dar Sanad' },
    district: { ar: 'حي النرجس', en: 'Al Narjis' },
    name: { ar: 'دار سند – ستريب مول', en: 'Dar Sanad – Strip Mall' },
    vendor: 'Dar Sanad',
    summary: {
      ar: 'ستريب مول تجاري/مكتبي في حي النرجس، يجمع بين محلات تجارية ومكاتب إدارية مع مواقف مخصصة.',
      en: 'A retail/office strip mall in Al Narjis, combining commercial shops and administrative offices with dedicated parking.',
    },
    areaSqm: 1094,
    priceNote: { ar: 'محلات 460م² ومكاتب 634م² — تواصل لعرض سعر', en: '460 sqm shops & 634 sqm offices — contact for a quote' },
    features: {
      ar: ['30 موقف سيارة', 'محلات تجارية بواجهة مباشرة', 'مكاتب إدارية بمداخل منفصلة', 'تصميم عصري وواجهات جذابة'],
      en: ['30 parking spaces', 'Street-facing retail shops', 'Administrative offices with separate entrances', 'Modern design & attractive facades'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Al Anjaz Tanfeethi ───────────────────────────────────────────────
  {
    slug: 'al-anjaz-tanfeethi',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'al-anjaz-tanfeethi',
    brandLabel: { ar: 'الإنجاز التنفيذي', en: 'Al Anjaz Tanfeethi' },
    district: { ar: 'حي الصحافة', en: 'Al Sahafa' },
    name: { ar: 'مبنى إداري تجاري – شارع التخصصي', en: 'Admin/Commercial Building – Al Takhassusi St' },
    vendor: 'Al Anjaz Tanfeethi Commercial Services',
    summary: {
      ar: 'مبنى إداري تجاري حديث للإيجار على شارع التخصصي الرئيسي بحي الصحافة، فرصة استثمارية مميزة لمقرات الشركات الكبرى.',
      en: 'A modern administrative/commercial building for rent on the main Al Takhassusi Street in Al Sahafa — a prime investment opportunity for major company HQs.',
    },
    areaSqm: 2608.5,
    monthlyPrice: 543437,
    priceNote: { ar: 'إجمالي القيمة الإيجارية السنوية شامل الضريبة ≈7,499,437 ر.س', en: 'Total annual rent value incl. VAT ≈ SAR 7,499,437' },
    features: {
      ar: ['مساحة تأجيرية 2,608.5م² على 4 أدوار + ميزانين', '30 موقف مخصص للموظفين والزوار + 30 موقف بالقبو', 'مناسب للمقرات الرئيسية والشركات متعددة الأقسام', 'كافة التصاريح مستخرجة'],
      en: ['2,608.5 sqm rentable area across 4 floors + mezzanines', '30 dedicated parking + ~30 basement parking', 'Suitable for HQs & multi-department companies', 'All permits already issued'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Plaza Al-Mousa ───────────────────────────────────────────────────
  {
    slug: 'plaza-al-mousa',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'plaza-al-mousa',
    brandLabel: { ar: 'بلازا الموسى', en: 'Plaza Al-Mousa' },
    district: { ar: 'حي العارض', en: 'Al Aarid' },
    name: { ar: 'بلازا الموسى – العارض', en: 'Plaza Al-Mousa – Al Aarid' },
    vendor: 'Al-Mousa',
    summary: {
      ar: 'مشروع معارض تجارية ومكتبية في قلب حي العارض المتنامي، بموقع استراتيجي يسهل الوصول إليه من مختلف المناطق.',
      en: 'A commercial showroom and office project in the heart of the growing Al Aarid district, strategically located for easy access from surrounding areas.',
    },
    areaSqm: 5314.78,
    priceNote: { ar: 'فرصة استثمارية / تأجير معارض ومكاتب — تواصل للتفاصيل', en: 'Investment/leasing opportunity for showrooms & offices — contact for details' },
    features: {
      ar: ['مسطح بناء 5,314.78م²', 'يجمع الابتكار التجاري والتنظيم المكتبي', 'موقع حيوي بحي العارض', 'مناسب للمستثمرين والمستأجرين'],
      en: ['5,314.78 sqm built-up area', 'Combines commercial innovation & office organization', 'Vibrant Al Aarid location', 'Suited for investors & tenants'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Al Qadah Towers ──────────────────────────────────────────────────
  {
    slug: 'al-qadah-towers',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'al-qadah-towers',
    brandLabel: { ar: 'أبراج القدح', en: 'Al Qadah Towers' },
    district: { ar: 'طريق الملك فهد', en: 'King Fahd Road' },
    name: { ar: 'برج تجاري للإيجار – طريق الملك فهد', en: 'Commercial Tower for Rent – King Fahd Road' },
    vendor: 'Al Qadah',
    summary: {
      ar: 'برج تجاري متكامل قرب طريق الملك فهد، يضم معارض أرضية وميزانين و12 دورًا مكتبيًا، بقرب من برج الفيصلية ومركز الملك عبدالله المالي.',
      en: 'A full commercial tower near King Fahd Road with ground/mezzanine showrooms and 12 office floors, close to Al Faisaliah Tower and KAFD.',
    },
    areaSqm: 10518,
    priceNote: { ar: 'إجمالي المساحة التأجيرية 10,518م² — تواصل لعرض سعر', en: 'Total rentable area 10,518 sqm — contact for a quote' },
    features: {
      ar: ['معرضان أرضي وميزانين', '12 دورًا مكتبيًا (817م² لكل دور تقريبًا)', '243 موقف سيارة', 'مصاعد ميتسوبيشي وأنظمة إنذار وإطفاء حريق'],
      en: ['2 ground/mezzanine showrooms', '12 office floors (~817 sqm each)', '243 parking spaces', 'Mitsubishi elevators & fire alarm/suppression systems'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Selective ────────────────────────────────────────────────────────
  {
    slug: 'selective-narjis',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'selective',
    brandLabel: { ar: 'سيليكتيف', en: 'Selective' },
    district: { ar: 'شمال الرياض', en: 'North Riyadh' },
    name: { ar: 'مبنى سيليكتيف المكتبي', en: 'Selective Office Building' },
    vendor: 'Arqam Al Arabia',
    summary: {
      ar: 'مبنى وحدات مكتبية عند تقاطع طريق أنس بن مالك، بموقع بارز شمال شرق الرياض، على بعد 13 دقيقة من مطار الملك خالد.',
      en: 'An office-units building at the intersection of Anas bin Malik Road, a prominent location in northeast Riyadh, 13 minutes from King Khalid Airport.',
    },
    areaSqm: 151,
    priceNote: { ar: 'وحدات من 151م² — تواصل لعرض سعر', en: 'Units from 151 sqm — contact for a quote' },
    features: {
      ar: ['حضور بارز على تقاطع طريق أنس بن مالك', 'قرب من جامعة الأميرة نورة وجامعة الإمام', 'قريب من بوابة الأعمال وغرناطة مول', 'مخططات أدوار متعددة الأحجام'],
      en: ['Prominent presence at Anas bin Malik Rd intersection', 'Near Princess Nourah & Imam Universities', 'Close to Business Gate & Granada Mall', 'Multiple floor plan sizes available'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Al Ghadeer ───────────────────────────────────────────────────────
  {
    slug: 'al-ghadeer-admin-offices',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'al-ghadeer',
    brandLabel: { ar: 'الغدير', en: 'Al Ghadeer' },
    district: { ar: 'حي الغدير', en: 'Al Ghadeer' },
    name: { ar: 'مكاتب إدارية – الغدير', en: 'Al Ghadeer Administrative Offices' },
    vendor: 'مؤسسة البصمة الزرقاء للعقارات',
    summary: {
      ar: 'مبنى مكاتب إدارية بتصميم عصري في حي الغدير، بواجهات زجاجية وتكسيات حجر طبيعي على 3 أدوار.',
      en: 'A modern administrative offices building in Al Ghadeer, with glass facades and natural stone cladding across 3 floors.',
    },
    areaSqm: 1000,
    priceNote: { ar: 'مساحات مكتبية 1000م² — تواصل لعرض سعر', en: '1,000 sqm of office space — contact for a quote' },
    features: {
      ar: ['3 أدوار من المكاتب الإدارية', '22 موقف سيارة مظلل', 'واجهات زجاجية وتكسيات حجرية', 'مساحات خضراء'],
      en: ['3 floors of administrative offices', '22 shaded parking spaces', 'Glass facades & natural stone cladding', 'Green landscaped areas'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── Q Square / Al Ayed Oasis ─────────────────────────────────────────
  {
    slug: 'q-square-al-ayed-oasis',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 'q-square',
    brandLabel: { ar: 'كيو سكوير', en: 'Q Square' },
    district: { ar: 'حي النرجس', en: 'Al Narjis' },
    name: { ar: 'كيو سكوير – العايد أويسيس', en: 'Q Square – Al Ayed Oasis' },
    vendor: 'Tawreed',
    summary: {
      ar: 'مجمع تجاري ومكتبي في حي النرجس على شارع عبدالله بن جلوي، وسط منطقة سكنية راقية ومجمعات سكنية مخططة.',
      en: 'A commercial and office complex in Al Narjis on Abdullah Bin Jalawi Street, amid an upscale residential district and master-planned communities.',
    },
    priceNote: { ar: 'مكاتب ومعارض تجارية — تواصل لعرض سعر', en: 'Offices & commercial showrooms — contact for a quote' },
    features: {
      ar: ['مواقف سيارات وشحن كهربائي', 'صالة رياضية ومصلى وكاميرات مراقبة', 'ضمن 15 كم من مطار الملك خالد الدولي ومركز كافد', 'محاط بمستشفيات ومجمعات سكنية فاخرة'],
      en: ['Parking & EV chargers', 'Gym, prayer area & CCTV', 'Within 15 km of King Khalid Airport & KAFD', 'Surrounded by hospitals & upscale residential compounds'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },

  // ── S2 Offices ───────────────────────────────────────────────────────
  {
    slug: 's2-offices-esport',
    category: 'commercial-building',
    city: 'riyadh',
    brand: 's2-offices',
    brandLabel: { ar: 'S2 أوفيسز', en: 'S2 Offices' },
    district: { ar: 'الرياض', en: 'Riyadh' },
    name: { ar: 'S2 أوفيسز — تصميم مكاتب اتحاد الرياضة الإلكترونية', en: 'S2 Offices — Esports Federation Office Design' },
    vendor: 'S2 Offices',
    summary: {
      ar: 'تصميم مكاتب إدارية على دورين لجهة رياضية كبرى، يشمل مكاتب تنفيذية ومحطات عمل وقاعات اجتماعات كبيرة وصغيرة.',
      en: 'A two-floor administrative office design for a major sports federation, including executive offices, workstations, and large/small meeting rooms.',
    },
    priceNote: { ar: 'نموذج تصميم/بناء حسب الطلب — تواصل للتفاصيل', en: 'Design/build-to-suit model — contact for details' },
    features: {
      ar: ['8 مكاتب تنفيذية و78 محطة عمل صغيرة بالدور الثاني', '3 مكاتب مغلقة و32 محطة عمل بالدور الثالث', 'قاعة اجتماعات كبرى وصغرى', 'شرفة ومنطقة تجمع'],
      en: ['8 executive offices & 78 small workstations on floor 2', '3 closed offices & 32 workstations on floor 3', 'Large & small meeting rooms', 'Balcony & gathering area'],
    },
    badge: { ar: 'مبنى تجاري', en: 'Commercial Building' },
  },
];

export const categoryLabels: Record<PropertyCategory, { ar: string; en: string }> = {
  'serviced-office': { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  'coworking': { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  'commercial-building': { ar: 'مبنى تجاري', en: 'Commercial Building' },
};

export const cityLabels: Record<string, { ar: string; en: string }> = {
  riyadh: { ar: 'الرياض', en: 'Riyadh' },
};

// Ordered list of brand keys, driving the grouped display order on the page.
export const brandOrder: string[] = [
  'colabs',
  'iwg',
  'cloud-spaces',
  'servcorp',
  'offices-zone',
  'the-ceremony',
  'r-house',
  'superoffice',
  'rwaq-business',
  'rafd',
  'narjis-view',
  'narjis-business-park',
  'downtown-center',
  'dar-sanad',
  'al-anjaz-tanfeethi',
  'plaza-al-mousa',
  'al-qadah-towers',
  'selective',
  'al-ghadeer',
  'q-square',
  's2-offices',
];
