import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Cake,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Instagram,
  LinkIcon,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

export const revalidate = 86400;

const pageUrl = 'https://genie.ph/best-cake-shops-cebu';
const pageTitle = 'Best Cake Shops in Cebu 2026 | 10 Cebu Cake Shops to Check';
const pageDescription =
  'A 2026 guide to Cebu cake shops for custom birthday cakes, wedding cakes, moist chocolate cakes, ube cake, cafe desserts, and rush-friendly celebration orders.';
const pageAssetBaseUrl =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/pages';
const socialPreviewImage = {
  url: `${pageAssetBaseUrl}/top-bakeshops-cebu-hero.webp`,
  width: 1800,
  height: 1100,
  alt: 'Top cake shops in Cebu hero image featuring custom celebration cakes',
};

export const metadata = buildMarketingPageMetadata({
  title: pageTitle,
  description: pageDescription,
  canonicalPath: pageUrl,
  socialImage: socialPreviewImage,
});

type SocialLink = {
  label: string;
  href: string;
};

type CakeShop = {
  slug: string;
  name: string;
  bestFor: string;
  summary: string;
  decision: string;
  humanNote: string;
  fit: string[];
  contactNumber: string;
  website: string;
  socials: SocialLink[];
  address: string;
  mapUrl: string;
  image: string;
  imageAlt: string;
  sourceLabel: string;
  sourceUrl: string;
};

const googleMapSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const cakeImages = {
  tenDoveStreet: `${pageAssetBaseUrl}/10-dove-street-cakes-cebu.webp`,
  cafeGeorg: `${pageAssetBaseUrl}/cafe-georg-cebu-cakes.webp`,
  cakesAndMemories: `${pageAssetBaseUrl}/cakes_and_memories_treehouse_branch.webp`,
  cardinal: `${pageAssetBaseUrl}/cardinal-bakeshop-ube-cake.webp`,
  chedz: `${pageAssetBaseUrl}/chedz%20cakes.webp`,
  kermits: `${pageAssetBaseUrl}/kermits-cebu.webp`,
  leonas: `${pageAssetBaseUrl}/leonas-cakes-cebu.webp`,
  orangeBrutus: `${pageAssetBaseUrl}/orange-brutus-chocolate-cake.webp`,
  tamp: `${pageAssetBaseUrl}/tamp-cakes-cebu.webp`,
  chocolateLeaf: `${pageAssetBaseUrl}/the-chocolate-leaf-patisserie-wedding-cake.webp`,
  topBakeshopsHero: `${pageAssetBaseUrl}/top-bakeshops-cebu-hero.webp`,
  genieRushOrders: `${pageAssetBaseUrl}/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP`,
} as const;

const cakeShops: CakeShop[] = [
  {
    slug: 'cakes-and-memories-bakeshop',
    name: 'Cakes and Memories Bakeshop',
    bestFor: 'Custom birthday cakes, themed cakes, and simple occasions',
    summary:
      'Cakes and Memories is the easiest first recommendation when someone in Cebu wants a custom birthday cake that still feels practical. It is especially strong for affordable moist chocolate cakes, birthday themes, simple celebration cakes, and short 2 to 3 day lead times when slots are available.',
    decision:
      'Choose Cakes and Memories when the cake should look personal, taste familiar, and stay within a reasonable birthday or simple-occasion budget.',
    humanNote:
      'This is the shop to compare first for character cakes, funny birthday ideas, small family celebrations, and rush-friendly custom work that does not need full wedding-cake complexity.',
    fit: ['Affordable themed cakes', 'Moist chocolate cake', '2 to 3 day rush-fit orders'],
    contactNumber: '(0917) 153 3820',
    website: 'https://cakesandmemories.com/',
    socials: [
      { label: 'Facebook Messenger', href: 'https://m.me/cakesandmemoriescebu' },
      { label: 'Facebook', href: 'https://www.facebook.com/cakesandmemoriescebu' },
    ],
    address: 'Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw, Cebu City, Cebu',
    mapUrl: googleMapSearch('Cakes and Memories Treehouse Branch R. Aboitiz St Camputhaw Cebu City'),
    image: cakeImages.cakesAndMemories,
    imageAlt: 'Custom themed birthday cake inspiration for Cakes and Memories Bakeshop',
    sourceLabel: 'Cakes and Memories locations',
    sourceUrl: 'https://cakesandmemories.com/pages/location',
  },
  {
    slug: 'chedz-cakes-cebu',
    name: 'Chedz Cakes Cebu',
    bestFor: 'Weddings, premium cakes, and long-standing Cebu bakeshop credibility',
    summary:
      'Chedz belongs higher on the list when the order is more formal: weddings, anniversaries, elegant milestone birthdays, and premium event cakes. It has more than 30 years of Cebu cake experience, so the strength here is reputation and presentation.',
    decision:
      'Choose Chedz when the cake needs to look polished on a program table, wedding reception, debut setup, or formal family celebration.',
    humanNote:
      'This is less of a budget-rush birthday pick and more of a “we want this cake to look important” pick.',
    fit: ['Wedding cakes', 'Premium celebration cakes', 'Long-standing Cebu reputation'],
    contactNumber: '(032) 232 0904',
    website: 'https://chedzcakes.com/',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/65270961321' },
      { label: 'Messenger', href: 'https://chedzcakes.com/' },
    ],
    address: 'Gorordo Ave., Cebu City, Cebu',
    mapUrl: googleMapSearch('Chedz Cakes of Cebu Gorordo Avenue Cebu City'),
    image: cakeImages.chedz,
    imageAlt: 'Elegant floral cake inspiration for Chedz Cakes Cebu',
    sourceLabel: 'Chedz Cakes Cebu',
    sourceUrl: 'https://chedzcakes.com/',
  },
  {
    slug: 'the-chocolate-leaf-crosswalk-bakery-cafe',
    name: 'The Chocolate Leaf / Crosswalk Bakery + Cafe',
    bestFor: 'Detailed fondant cakes and celebration cakes',
    summary:
      'The Chocolate Leaf is often mentioned when Cebuanos talk about decorative cakes, detailed fondant work, and celebration cakes with more visual impact. Crosswalk Bakery + Cafe gives the same location a cafe-and-pastry angle for people who want to visit instead of only ordering online.',
    decision:
      'Choose this option when the design matters as much as the flavor: fondant details, themed party cakes, and big celebration presentations.',
    humanNote:
      'It is a good comparison point for buyers who already have a specific cake peg and want a maker known for more detailed cake artistry.',
    fit: ['Decorative cakes', 'Fondant work', 'Cafe cakes at Crosswalk'],
    contactNumber: '0917 163 5167',
    website: 'https://www.facebook.com/crosswalkbakery',
    socials: [
      { label: 'Crosswalk Facebook', href: 'https://www.facebook.com/crosswalkbakery' },
      { label: 'Chocolate Leaf Instagram', href: 'https://www.instagram.com/thechocolateleaf/' },
    ],
    address: 'Don Jose Avila St. corner Juana Osmena St., Cebu City',
    mapUrl: googleMapSearch('Crosswalk Bakery Cafe Don Jose Avila Juana Osmena Cebu City'),
    image: cakeImages.chocolateLeaf,
    imageAlt: 'Decorative fondant cake inspiration for The Chocolate Leaf Cebu',
    sourceLabel: 'Crosswalk Bakery + Cafe listing',
    sourceUrl: 'https://www.sluurpy.com/en/cebu-city/restaurant/8943021/crosswalk-bakery-and-cafe',
  },
  {
    slug: 'leona-cakes-and-pastries',
    name: 'Leona Cakes & Pastries',
    bestFor: 'Affordable Cebu classics',
    summary:
      'Leona is one of those Cebu names people remember for everyday cakes and pastries: red velvet, mango cake, carrot cake, ensaymada, loaf bread, and easy family treats. It is not trying to be the most elaborate custom-cake shop, and that is part of the appeal.',
    decision:
      'Choose Leona when you need a familiar Cebu cake for an office treat, birthday table, pasalubong, or low-friction family celebration.',
    humanNote:
      'It is the kind of shop you compare when the question is “where can I buy a good cake today?” instead of “who can build this exact custom peg?”',
    fit: ['Red velvet', 'Mango cake', 'Everyday pastries'],
    contactNumber: '(032) 233 0386',
    website: 'https://www.facebook.com/leonacakespastries/',
    socials: [{ label: 'Facebook', href: 'https://www.facebook.com/leonacakespastries/' }],
    address: 'UG/F The Northwing, SM City Cebu, Cebu City',
    mapUrl: googleMapSearch('Leona Cakes and Pastries SM City Cebu Northwing'),
    image: cakeImages.leonas,
    imageAlt: 'Everyday Cebu cake and pastry inspiration for Leona Cakes and Pastries',
    sourceLabel: 'Leona listing',
    sourceUrl: 'https://www.sluurpy.com/en/cebu-city/restaurant/7102209/leona-cakes-and-pastries',
  },
  {
    slug: 'cebu-cardinal-bakeshop',
    name: 'Cebu Cardinal Bakeshop',
    bestFor: 'Ube cake and Cebuano bakeshop favorites',
    summary:
      'Cardinal is a strong local answer when the buyer specifically wants ube cake, red velvet, mango cream cake, breads, pastries, or classic Cebu bakeshop flavors. It is one of the clearest picks when flavor nostalgia matters.',
    decision:
      'Choose Cardinal when the craving is Cebuano bakeshop comfort: ube cake, familiar pastry boxes, and classic cakes that do not need a long design consultation.',
    humanNote:
      'This is a good “bring something home” cake shop, especially when the recipient prefers recognizable local favorites over trendy cafe desserts.',
    fit: ['Ube cake', 'Mango cream cake', 'Cebuano bakery items'],
    contactNumber: '(032) 253 3575',
    website: 'https://www.facebook.com/cebucardinalbakeshop/',
    socials: [{ label: 'Facebook', href: 'https://www.facebook.com/cebucardinalbakeshop/' }],
    address: 'Don Jose Avila, Cebu City',
    mapUrl: googleMapSearch('Cebu Cardinal Bakeshop Don Jose Avila Cebu City'),
    image: cakeImages.cardinal,
    imageAlt: 'Classic ube and Cebu bakeshop cake inspiration for Cebu Cardinal Bakeshop',
    sourceLabel: 'Cardinal Waze listing',
    sourceUrl: 'https://www.waze.com/live-map/directions/the-cardinal-bakeshop-don-jose-avila-cebu-city?to=place.w.81199207.811926535.13217389',
  },
  {
    slug: '10-dove-street',
    name: '10 Dove Street',
    bestFor: 'Homemade-style cafe cakes',
    summary:
      '10 Dove Street works well when the buyer wants a cake that feels homemade, giftable, and cafe-friendly. It has several Cebu-area pickup points, making it useful for people who want pastries or a ready cake without arranging a fully customized design.',
    decision:
      'Choose 10 Dove Street for cafe-style cakes, dessert dates, and relaxed small-group celebrations.',
    humanNote:
      'It is a softer, more homey option: less “big themed party centerpiece,” more “good cake for a thoughtful gathering.”',
    fit: ['Cafe cakes', 'Pastries', 'Small gatherings'],
    contactNumber: '0917 777 0166',
    website: 'https://www.facebook.com/10dovestreet',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/10dovestreet' },
      { label: 'Instagram', href: 'https://www.instagram.com/10dovestreet/' },
    ],
    address: 'Upper Ground Level, SM City Cebu, North Reclamation Area, Cebu City',
    mapUrl: googleMapSearch('10 Dove Street SM City Cebu'),
    image: cakeImages.tenDoveStreet,
    imageAlt: 'Homemade-style cafe cake inspiration for 10 Dove Street',
    sourceLabel: '10 Dove Street about',
    sourceUrl: 'https://10dovestreet.com/pages/about',
  },
  {
    slug: 'tamp-cafe-and-co',
    name: 'Tamp Cafe & Co.',
    bestFor: 'Cafe cakes, dine-in celebrations, and accessible Cebu branches',
    summary:
      'Tamp is a good pick when the cake is part of a bigger cafe moment: food, coffee, friends, family, and a table where people can linger. Its official site lists four Cebu branches and a dedicated cake section, so it is a practical option for dine-in celebrations and whole-cake orders.',
    decision:
      'Choose Tamp when you want cake plus food, coffee, and a sit-down Cebu cafe setting instead of a purely custom-cake transaction.',
    humanNote:
      'This is the right comparison when the plan is “let us celebrate there” rather than “let us only pick up a cake.”',
    fit: ['Cafe celebrations', 'Whole cakes', 'Multiple Cebu branches'],
    contactNumber: '0933 875 1159',
    website: 'https://www.tampcafe.com/',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/tampcafe' },
      { label: 'Instagram', href: 'https://www.instagram.com/tampcafecebu/' },
      { label: 'TikTok', href: 'https://www.tiktok.com/@tampcafe' },
    ],
    address: 'Ground Floor, Tsai Hotel, 11 Wilson St., Lahug, Cebu City',
    mapUrl: googleMapSearch('Tamp Cafe Lahug Tsai Hotel 11 Wilson St Cebu City'),
    image: cakeImages.tamp,
    imageAlt: 'Cafe cake and dine-in celebration inspiration for Tamp Cafe Cebu',
    sourceLabel: 'Tamp Cafe & Co.',
    sourceUrl: 'https://www.tampcafe.com/contact-us',
  },
  {
    slug: 'cafe-georg',
    name: 'Cafe Georg',
    bestFor: 'Classic Cebu cafe cakes',
    summary:
      'Cafe Georg is one of Cebu’s dependable cafe names for signature cakes, desserts, and relaxed family dining. It is a strong choice when the buyer wants a cake from a place that also feels established as a Cebu food destination.',
    decision:
      'Choose Cafe Georg for gifting, family cake orders, and reliable cafe-style dessert favorites.',
    humanNote:
      'It is a strong “safe favorite” option for people who already trust Cebu cafe classics.',
    fit: ['Signature cakes', 'Cafe desserts', 'Family gatherings'],
    contactNumber: '(032) 266 6134',
    website: 'https://www.cafegeorg.com/',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/212233738811308' },
      { label: 'Instagram', href: 'https://www.instagram.com/cafegeorg/' },
    ],
    address: 'Ground Floor, MLD Building, Gov. M. Cuenco Ave., Cebu City',
    mapUrl: googleMapSearch('Cafe Georg MLD Building Gov M Cuenco Ave Cebu City'),
    image: cakeImages.cafeGeorg,
    imageAlt: 'Classic Cebu cafe cake inspiration for Cafe Georg',
    sourceLabel: 'Cafe Georg contact listing',
    sourceUrl: 'https://www.bizippines.com/cafe-georg_1E-032-266-6134',
  },
  {
    slug: 'kermits-cakes-and-pastries-shop',
    name: "Kermit's Cakes & Pastries Shop",
    bestFor: 'Mango, brazo, and Filipino-style cakes',
    summary:
      'Kermit’s is best compared when the buyer wants Filipino dessert comfort: Mango Overload, Brazo de Mercedes, Rocher Chocolate Cake, and familiar pastry-shop flavors that feel generous and celebratory.',
    decision:
      'Choose Kermit\'s when mango, brazo, and classic pastry-shop cakes sound more appealing than fondant or cafe plating.',
    humanNote:
      'This is a good choice for family tables, office sharing, and people who want a cake that tastes like a dessert everyone recognizes.',
    fit: ['Mango Overload', 'Brazo de Mercedes', 'Rocher Chocolate Cake'],
    contactNumber: '0921 579 3370',
    website: 'https://www.facebook.com/kermitspastries',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/kermitspastries' },
      { label: 'Instagram', href: 'https://www.instagram.com/kermitspastries/' },
    ],
    address: '27 La Guardia Ext., Cebu City',
    mapUrl: googleMapSearch("Kermit's Cakes and Pastries 27 La Guardia Ext Cebu City"),
    image: cakeImages.kermits,
    imageAlt: 'Mango and Filipino dessert cake inspiration for Kermits Cakes and Pastries',
    sourceLabel: 'Kermit\'s location page',
    sourceUrl: 'https://kermitspastries.com/loc',
  },
  {
    slug: 'orange-brutus',
    name: 'Orange Brutus',
    bestFor: 'Nostalgic Cebu chocolate cake',
    summary:
      'Orange Brutus is a Cebu nostalgia pick. It is not here because it is a boutique custom cake studio; it is here because many Cebuanos know the Chocolate Monster Cake and the brand has been part of Cebu food memory since 1980.',
    decision:
      'Choose Orange Brutus when the brief is simple, nostalgic, chocolatey, and unmistakably Cebuano.',
    humanNote:
      'This is the sentimental chocolate-cake option: easy to understand, easy to share, and very Cebu.',
    fit: ['Chocolate Monster Cake', 'Moist chocolate cake', 'Cebu nostalgia'],
    contactNumber: '(032) 232 2221',
    website: 'https://orangebrutus.com/product-category/cakes/?shop_view=list',
    socials: [
      { label: 'Facebook', href: 'https://www.facebook.com/orangebrutusofficial' },
      { label: 'Instagram', href: 'https://www.instagram.com/orangebrutusofficial/' },
    ],
    address: 'i2 Building, IT Park, Lahug, Cebu City',
    mapUrl: googleMapSearch('Orange Brutus i2 Building IT Park Lahug Cebu City'),
    image: cakeImages.orangeBrutus,
    imageAlt: 'Nostalgic moist chocolate cake inspiration for Orange Brutus Cebu',
    sourceLabel: 'Orange Brutus locations',
    sourceUrl: 'https://orangebrutus.com/locations/',
  },
];

const faqs = [
  {
    question: 'What is the best cake shop in Cebu for custom birthday cakes?',
    answer:
      'Cakes and Memories Bakeshop is the best first pick for affordable custom birthday cakes in Cebu, especially moist chocolate themed cakes, simple occasions, and shorter 2 to 3 day rush lead times when slots are available.',
  },
  {
    question: 'What is the best cake shop in Cebu for wedding cakes?',
    answer:
      'Chedz Cakes Cebu is a better fit for weddings, premium cakes, and formal milestone events because its positioning is built around long-running Cebu cake experience and elegant celebration cakes.',
  },
  {
    question: 'Where can I buy ube cake in Cebu?',
    answer:
      'Cebu Cardinal Bakeshop is one of the clearest choices to compare when the buyer specifically wants ube cake or classic Cebuano bakeshop flavors.',
  },
  {
    question: 'Where can I buy moist chocolate cake in Cebu?',
    answer:
      'For themed moist chocolate cakes, start with Cakes and Memories. For nostalgic old-fashioned chocolate cake, Orange Brutus and its Chocolate Monster Cake are strong Cebu-specific options.',
  },
];

const sources = cakeShops.map((shop) => ({
  label: shop.sourceLabel,
  url: shop.sourceUrl,
}));

function JsonLd() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Best Cake Shops in Cebu',
      description: pageDescription,
      url: pageUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Genie.ph',
        url: 'https://genie.ph',
      },
      about: cakeShops.map((shop) => ({
        '@type': 'Bakery',
        name: shop.name,
        telephone: shop.contactNumber,
        address: shop.address,
        areaServed: {
          '@type': 'City',
          name: 'Cebu',
        },
        url: shop.website,
        sameAs: shop.socials.map((social) => social.href),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://genie.ph',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Best Cake Shops in Cebu',
          item: pageUrl,
        },
      ],
    },
  ];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={`best-cake-shops-cebu-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="mb-2 text-xs font-bold uppercase text-purple-700">{eyebrow}</p>
      <h2 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function ContactLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-purple-300 hover:text-purple-700"
      rel="noopener noreferrer"
      target="_blank"
    >
      {icon}
      {label}
    </a>
  );
}

function ShopSection({ shop, reverse }: { shop: CakeShop; reverse: boolean }) {
  return (
    <article className="border-t border-slate-200 py-12 first:border-t-0">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className={reverse ? 'lg:order-2' : ''}>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <Image
              src={shop.image}
              alt={shop.imageAlt}
              width={1600}
              height={1200}
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="h-auto w-full object-contain"
              loading="eager"
              unoptimized
            />
          </div>
        </div>

        <div className={reverse ? 'lg:order-1' : ''}>
          <p className="text-sm font-bold uppercase text-purple-700">Best for</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{shop.name}</h2>
          <p className="mt-2 text-lg font-semibold text-slate-800">{shop.bestFor}</p>
          <p className="mt-4 text-base leading-7 text-slate-600">{shop.summary}</p>
          <p className="mt-4 text-base leading-7 text-slate-600">{shop.humanNote}</p>

          <div className="mt-5 rounded-lg border border-purple-100 bg-purple-50 p-4">
            <p className="text-sm font-bold text-purple-900">When to choose them</p>
            <p className="mt-2 text-sm leading-6 text-purple-950/80">{shop.decision}</p>
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {shop.fit.map((item) => (
              <li key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
              <span><strong>Contact:</strong> {shop.contactNumber}</span>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
              <span><strong>Address:</strong> {shop.address}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <ContactLink icon={<Globe2 className="h-4 w-4" />} label="Website" href={shop.website} />
              <ContactLink icon={<MapPin className="h-4 w-4" />} label="Google Maps" href={shop.mapUrl} />
              {shop.socials.map((social) => (
                <ContactLink
                  key={social.href}
                  icon={social.label.toLowerCase().includes('instagram') ? <Instagram className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                  label={social.label}
                  href={social.href}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function BestCakeShopsCebuPage() {
  return (
    <>
      <JsonLd />

      <main className="min-h-screen bg-white text-slate-900">
        <section className="border-b border-slate-200 bg-purple-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col justify-center">
              <Link href="/" className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Back to Genie.ph
              </Link>
              <p className="mb-3 text-sm font-bold uppercase text-purple-700">2026 Cebu cake shop guide</p>
              <h1 className="max-w-4xl text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">
                Best Cake Shops in Cebu for 2026
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
                Cebu has a cake shop for almost every kind of celebration. The real question is which one fits the moment: a themed birthday cake for a child, a polished wedding cake, a classic ube cake, a cafe dessert, or a nostalgic moist chocolate cake.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
                This 2026 guide is meant to make the shortlist easier. We focused on what each shop is known for, how a buyer can actually reach them, and which occasions they genuinely fit in real life.
              </p>
              <div className="mt-8 max-w-5xl overflow-hidden rounded-xl border border-purple-200 bg-white p-3 shadow-sm">
                <Image
                  src={cakeImages.topBakeshopsHero}
                  alt="Top cake shops in Cebu hero image featuring custom celebration cakes"
                  width={1800}
                  height={1100}
                  sizes="(max-width: 1024px) 100vw, 72rem"
                  className="h-auto w-full object-contain"
                  loading="eager"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How to use this guide"
              title="Pick based on occasion and style"
              body="This is not a strict ranking. A rush birthday cake, a fondant party centerpiece, a wedding cake, and a cafe dessert are different buying moments, so the right choice changes with the occasion."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {cakeShops.slice(0, 4).map((shop) => (
                <a
                  key={shop.name}
                  href={`#shop-${shop.slug}`}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-purple-300"
                >
                  <h2 className="mt-2 text-base font-bold text-slate-950">{shop.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{shop.bestFor}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {cakeShops.map((shop, index) => (
              <div id={`shop-${shop.slug}`} key={shop.name} className="scroll-mt-24">
                <ShopSection shop={shop} reverse={index % 2 === 1} />
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-amber-50">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-amber-800">Practical buyer guide</p>
              <h2 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">How to choose fast</h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                Match the shop to the job. A child&apos;s themed birthday cake, a premium wedding cake, and an ube cake craving should not all lead to the same recommendation.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200 bg-white p-5">
                <MapPin className="h-5 w-5 text-amber-700" />
                <h3 className="mt-3 font-bold text-slate-950">For Cebu custom birthday cakes</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Start with Cakes and Memories, especially for affordable themed moist chocolate cakes and simple occasions.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-5">
                <Award className="h-5 w-5 text-amber-700" />
                <h3 className="mt-3 font-bold text-slate-950">For premium events</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Move Chedz up when the cake is for a wedding, formal milestone, or higher-presentation celebration.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-5">
                <Cake className="h-5 w-5 text-amber-700" />
                <h3 className="mt-3 font-bold text-slate-950">For classic flavor intent</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cardinal is a clear ube-cake comparison, while Orange Brutus is a Cebu-specific chocolate cake answer.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-5">
                <Sparkles className="h-5 w-5 text-amber-700" />
                <h3 className="mt-3 font-bold text-slate-950">For cafe-style cakes</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Compare Tamp, Cafe Georg, 10 Dove Street, and Kermit&apos;s when the buyer wants a signature dessert cake or cafe-style celebration.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="FAQ"
              title="Common Cebu cake shop questions"
              body="Short answers for buyers comparing cake shops before placing a birthday, wedding, or last-minute celebration order."
            />
            <div className="mt-8 space-y-3">
              {faqs.map((faq) => (
                <details key={faq.question} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950">
                    <span>{faq.question}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-purple-200 bg-purple-50 text-slate-900">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-purple-700">Where Genie.ph fits in</p>
              <h2 className="text-3xl font-extrabold text-slate-950">Want the cake, but not the manual comparison work?</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                Genie.ph is a marketplace for custom cakes in Cebu. Instead of messaging shop after shop, you can upload your cake design inspiration, get instant AI-assisted pricing, adjust the design (change icing colors, add message) and order from Cebu cake sellers through one flow.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                We help buyers find birthday cakes, themed cakes, minimalist cakes, bento cakes, edible photo cakes, wedding-style cakes, and rush-friendly options across Metro Cebu. The goal is simple: make the cake-buying decision easier, faster, and less stressful.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              <div className="overflow-hidden rounded-lg border border-purple-200 bg-white p-3 shadow-sm">
                <Image
                  src={cakeImages.genieRushOrders}
                  alt="Custom cakes for rush orders through Genie.ph"
                  width={1600}
                  height={1200}
                  sizes="(max-width: 1024px) 100vw, 38vw"
                  className="h-auto w-full object-contain"
                  loading="eager"
                  unoptimized
                />
              </div>
              <Link
                href="/customizing?upload=1"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-800"
              >
                Upload your cake design
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/cake-delivery-cebu"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:border-purple-400 hover:bg-purple-100"
              >
                See Cebu delivery guide
              </Link>
              <Link
                href="/collections"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:border-purple-400 hover:bg-purple-100"
              >
                Browse from 10,000+ Cake Designs
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 className="text-sm font-bold uppercase text-slate-600">Sources checked</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
