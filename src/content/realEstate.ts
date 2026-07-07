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
  {
    slug: 'colabs-narjis',
    category: 'coworking',
    city: 'riyadh',
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
  {
    slug: 'iwg-hq-wurud',
    category: 'serviced-office',
    city: 'riyadh',
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
  {
    slug: 'roshn-cloud-spaces',
    category: 'serviced-office',
    city: 'riyadh',
    district: { ar: 'روشن فرونت', en: 'Roshn Front' },
    name: { ar: 'كلاود سبيسز – روشن فرونت', en: 'Cloud Spaces – Roshn Front' },
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
    slug: 'servcorp-olaya',
    category: 'coworking',
    city: 'riyadh',
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
  {
    slug: 'downtown-center-takhassusi',
    category: 'commercial-building',
    city: 'riyadh',
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
];

export const categoryLabels: Record<PropertyCategory, { ar: string; en: string }> = {
  'serviced-office': { ar: 'مكتب مخدوم', en: 'Serviced Office' },
  'coworking': { ar: 'مساحة عمل مشتركة', en: 'Co-working' },
  'commercial-building': { ar: 'مبنى تجاري', en: 'Commercial Building' },
};

export const cityLabels: Record<string, { ar: string; en: string }> = {
  riyadh: { ar: 'الرياض', en: 'Riyadh' },
};
