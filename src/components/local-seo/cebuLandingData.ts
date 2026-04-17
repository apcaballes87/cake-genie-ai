export type LandingPageConfig = {
  slug: string;
  metadataTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  h1: string;
  heroBody: string;
  heroHighlights: string[];
  completedOrdersProof: string;
  sampleQuery: string;
  galleryTitle: string;
  galleryIntro: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
  coverageIntro: string;
  coverageAreas: string[];
  deliveryCards: {
    title: string;
    badge: string;
    body: string;
  }[];
  pricingCards: {
    label: string;
    price: string;
    detail: string;
  }[];
  pricingNote: string;
  steps: {
    title: string;
    body: string;
  }[];
  whyGenie: {
    title: string;
    body: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
  relatedLinks: {
    label: string;
    href: string;
  }[];
  finalCtaTitle: string;
  finalCtaBody: string;
};

const searchHref = (query: string) => `/search?q=${encodeURIComponent(query)}`;

export const CEBU_LANDING_PAGES: Record<string, LandingPageConfig> = {
  'bento-cake-cebu': {
    slug: 'bento-cake-cebu',
    metadataTitle: 'Bento Cake Cebu Delivery | Affordable Bento Cakes in Metro Cebu',
    metaDescription:
      'Order affordable bento cakes in Cebu with fast delivery across Metro Cebu. See minimalist bento cake samples, same-day ordering guidance, and easy custom cake checkout on Genie.ph.',
    heroEyebrow: 'Affordable Bento Cakes in Metro Cebu',
    h1: 'Bento Cake Delivery in Cebu for Last-Minute Gifts and Simple Celebrations',
    heroBody:
      'Need a giftable cake without the custom cake back-and-forth? Genie.ph makes it easy to order bento cakes in Cebu with clear starting prices, same-day options for simple designs, and minimalist sample styles you can customize in minutes.',
    heroHighlights: [
      'Bento cakes start from around P349 for simple designs.',
      'Best for birthdays, monthsaries, office gifting, and surprise deliveries in Cebu City.',
      'Upload a peg or tweak colors, message text, and toppers before checkout.',
    ],
    completedOrdersProof:
      'Rush bento and minimalist cake orders are fulfilled across Cebu City and nearby Metro Cebu drop-offs every week.',
    sampleQuery: 'bento cake',
    galleryTitle: 'Popular bento cake styles Cebuanos order right now',
    galleryIntro:
      'These sample designs give buyers a fast starting point for minimalist greetings, romantic gifts, and quick birthday surprises.',
    primaryCta: {
      label: 'Customize a Bento Cake',
      href: '/customizing',
    },
    secondaryCta: {
      label: 'Browse Bento Cake Samples',
      href: '/collections/bento-cake',
    },
    coverageIntro:
      'Fast-moving bento orders usually go out first in Cebu City, Mandaue, Lapu-Lapu, and Talisay. For the smoothest same-day slot, place the order before 4PM and keep the design simple.',
    coverageAreas: ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Talisay', 'Consolacion', 'Minglanilla'],
    deliveryCards: [
      {
        title: 'Same-day when the design is simple',
        badge: 'Before 4PM cutoff',
        body: 'Minimalist bentos, message cakes, and clean Korean-style layouts are the easiest rush orders to fulfill.',
      },
      {
        title: 'Metro Cebu delivery coverage',
        badge: 'City-to-city delivery',
        body: 'We coordinate with Cebu bakers that already deliver into Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby areas.',
      },
      {
        title: 'Better for gifting than grocery cakes',
        badge: 'Personalized',
        body: 'Add a custom message, color palette, or peg so the cake feels intentional even when the order is last-minute.',
      },
    ],
    pricingCards: [
      {
        label: 'Simple bento cakes',
        price: 'From P349',
        detail: 'Best for minimalist greetings, Korean-style layouts, and short message cakes.',
      },
      {
        label: 'Bento with topper or theme tweaks',
        price: 'From P449',
        detail: 'Good for birthdays, surprise gifts, and more stylized minimalist layouts.',
      },
      {
        label: 'Rush-friendly add-ons',
        price: 'Priced per design',
        detail: 'Photo pegs, elaborate piping, and specialty toppers can affect both price and lead time.',
      },
    ],
    pricingNote:
      'Final price depends on the exact design, delivery area, and add-ons, but these ranges help Cebu buyers know what to expect before they start.',
    steps: [
      {
        title: 'Pick a sample or upload your peg',
        body: 'Start with a minimalist bento style you like, or upload any inspiration image into Genie.ph.',
      },
      {
        title: 'Confirm the message, colors, and delivery area',
        body: 'We show the practical details that matter for Cebu buyers: design scope, rush viability, and delivery timing.',
      },
      {
        title: 'Checkout and let the baker fulfill it',
        body: 'Once you approve the setup, your order goes to a vetted Cebu baker for production and delivery.',
      },
    ],
    whyGenie: [
      {
        title: 'Built for quick decisions',
        body: 'The flow is designed for people who need to order now, not message five bakers just to ask for a quote.',
      },
      {
        title: 'Real Cebu delivery promise',
        body: 'The pages are written around actual Metro Cebu fulfillment, not generic nationwide copy that leaves buyers guessing.',
      },
      {
        title: 'Strong sample-led conversion',
        body: 'Buyers can jump straight from inspiration to customization, which helps bento cake traffic convert faster.',
      },
    ],
    faqs: [
      {
        question: 'Can I order a bento cake for same-day delivery in Cebu?',
        answer:
          'Yes, often for simple minimalist layouts. Same-day depends on the baker, the delivery area, and whether the design is realistic for the remaining production window before the 4PM cutoff.',
      },
      {
        question: 'How much do bento cakes usually cost in Cebu?',
        answer:
          'Simple bento cakes generally start around P349. Message changes, toppers, printed elements, and more detailed piping can move the price up.',
      },
      {
        question: 'What kind of bento cake styles are easiest to order fast?',
        answer:
          'Minimalist bentos, Korean-style message cakes, and clean giftable designs are usually the easiest options for rush fulfillment in Metro Cebu.',
      },
      {
        question: 'Can I use my own reference photo?',
        answer:
          'Yes. Upload your peg, then use the Genie.ph customization flow to make the design closer to what you want before checkout.',
      },
    ],
    relatedLinks: [
      { label: 'Cake Delivery Cebu', href: '/cake-delivery-cebu' },
      { label: 'Birthday Cake Delivery Cebu City', href: '/birthday-cake-delivery-cebu-city' },
      { label: 'Search minimalist bento cakes', href: searchHref('minimalist bento cake') },
      { label: 'Customize your own cake', href: '/customizing' },
    ],
    finalCtaTitle: 'Need a bento cake in Cebu today?',
    finalCtaBody:
      'Start with a simple sample, adjust the message and colors, and head straight into the Genie.ph customization flow while rush slots are still open.',
  },
  'cake-delivery-cebu': {
    slug: 'cake-delivery-cebu',
    metadataTitle: 'Cake Delivery Cebu | Fast Custom Cake Delivery Across Metro Cebu',
    metaDescription:
      'Looking for cake delivery in Cebu? Order custom birthday, minimalist, bento, and themed cakes with fast Metro Cebu fulfillment, clear pricing guidance, and easy online checkout on Genie.ph.',
    heroEyebrow: 'Metro Cebu Cake Delivery',
    h1: 'Fast Cake Delivery in Cebu for Birthdays, Surprises, and Custom Orders',
    heroBody:
      'Genie.ph is built for Cebu buyers who want cake delivery without chasing quotes in DMs. Browse real sample designs, get clear starting-price guidance, and order a custom cake for delivery across Metro Cebu from vetted local bakers.',
    heroHighlights: [
      'Coverage includes Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby Metro Cebu areas.',
      'Simple rush-friendly designs can still be possible for same-day or next-available delivery.',
      'From bentos to themed birthday cakes, buyers can go from sample to checkout in one flow.',
    ],
    completedOrdersProof:
      'Metro Cebu delivery orders are completed weekly for birthdays, gifts, office surprises, and scheduled celebrations.',
    sampleQuery: 'birthday cake',
    galleryTitle: 'Cake designs buyers use before they checkout delivery orders',
    galleryIntro:
      'These are the kinds of cake pegs buyers start with when they need a dependable delivery option in Cebu fast.',
    primaryCta: {
      label: 'Start Your Cake Order',
      href: '/customizing',
    },
    secondaryCta: {
      label: 'Search Cake Delivery Designs',
      href: searchHref('cake delivery cebu birthday cake'),
    },
    coverageIntro:
      'This page is for broad Metro Cebu cake delivery intent. If you need a specific barangay or tighter Cebu City targeting, jump to the more localized Cebu City pages below.',
    coverageAreas: ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City', 'Liloan', 'Consolacion'],
    deliveryCards: [
      {
        title: 'Delivery built for Metro Cebu buyers',
        badge: 'Wide coverage',
        body: 'We keep the local promise clear so shoppers know we are focused on Metro Cebu, not vague nationwide fulfillment.',
      },
      {
        title: 'Rush-friendly simple designs',
        badge: 'Before 4PM',
        body: 'Same-day is most realistic for simpler layouts and buyers who place their order before the cutoff window closes.',
      },
      {
        title: 'Custom without the chaos',
        badge: 'Clear process',
        body: 'Upload a peg, set the message and style, and go directly into checkout instead of starting from a blank inquiry thread.',
      },
    ],
    pricingCards: [
      {
        label: 'Bento and gift cakes',
        price: 'From P349',
        detail: 'A practical entry point for affordable Cebu delivery orders and small surprise gifts.',
      },
      {
        label: 'Simple round celebration cakes',
        price: 'From P799',
        detail: 'Great for standard birthday delivery orders and cleaner custom layouts.',
      },
      {
        label: 'Detailed themed cakes',
        price: 'From P1,499',
        detail: 'Best for more involved birthday, character, and event-specific cake work.',
      },
    ],
    pricingNote:
      'Delivery fees and rush viability depend on the exact address, baker, and design complexity, so treat these as starting guides rather than flat store pricing.',
    steps: [
      {
        title: 'Choose a design direction',
        body: 'Start from a sample design, a search result, or your own peg so the order already has a clear visual brief.',
      },
      {
        title: 'Lock the Cebu delivery details',
        body: 'Confirm the event date, delivery area, and the level of urgency so the order stays realistic.',
      },
      {
        title: 'Checkout with confidence',
        body: 'Once the design and delivery plan look good, move forward with the Genie.ph ordering flow.',
      },
    ],
    whyGenie: [
      {
        title: 'Stronger than generic marketplace search',
        body: 'Instead of browsing blindly, buyers get a more directed path from commercial-intent search to actual order completion.',
      },
      {
        title: 'Useful for urgent buying moments',
        body: 'The page answers the practical questions that matter when somebody is ready to buy: speed, delivery reach, and price range.',
      },
      {
        title: 'Better sample-to-order journey',
        body: 'Real cake samples, review proof, and strong CTAs remove friction and make Cebu delivery traffic easier to close.',
      },
    ],
    faqs: [
      {
        question: 'Do you deliver cakes across all of Metro Cebu?',
        answer:
          'We cover Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby Metro Cebu areas. Exact availability still depends on the baker and delivery schedule for your chosen design.',
      },
      {
        question: 'Can I order a custom cake for same-day delivery?',
        answer:
          'Sometimes, especially for simpler minimalist or bento-style cakes. More complex custom builds usually need more lead time.',
      },
      {
        question: 'What types of cakes can I order for delivery in Cebu?',
        answer:
          'Buyers commonly order bento cakes, birthday cakes, minimalist cakes, floral cakes, and other custom celebration cakes through Genie.ph.',
      },
      {
        question: 'Do I need to know my exact design before starting?',
        answer:
          'No. You can begin with a rough peg or browse sample designs first, then refine the message, color palette, and other details inside the order flow.',
      },
    ],
    relatedLinks: [
      { label: 'Cake Delivery Cebu City', href: '/cake-delivery-cebu-city' },
      { label: 'Birthday Cake Delivery Cebu City', href: '/birthday-cake-delivery-cebu-city' },
      { label: 'Kids Party Cakes Cebu', href: '/kids-party-cakes-cebu' },
      { label: 'Browse more custom cakes', href: '/collections' },
    ],
    finalCtaTitle: 'Ready to lock in cake delivery anywhere in Metro Cebu?',
    finalCtaBody:
      'Go straight into the Genie.ph customization flow, or browse more sample designs first if you still need a fast visual starting point.',
  },
  'cake-delivery-cebu-city': {
    slug: 'cake-delivery-cebu-city',
    metadataTitle: 'Cake Delivery Cebu City | Reliable Custom Cake Delivery in Cebu City',
    metaDescription:
      'Order cake delivery in Cebu City with practical fulfillment guidance, clear starting prices, and real sample designs. Genie.ph helps Cebu City buyers order custom cakes faster.',
    heroEyebrow: 'Cebu City Delivery Focus',
    h1: 'Cake Delivery in Cebu City with Clear Timing, Coverage, and Easy Custom Ordering',
    heroBody:
      'If you are searching specifically for cake delivery in Cebu City, Genie.ph gives you a tighter local promise. We help buyers ordering to IT Park, Lahug, Mabolo, Banilad, Talamban, Guadalupe, Capitol, and nearby Cebu City areas move faster from design idea to confirmed order.',
    heroHighlights: [
      'Designed for Cebu City commercial-intent buyers who need practical delivery guidance now.',
      'Best for office surprises, condo deliveries, birthdays, and scheduled family celebrations inside the city.',
      'A strong fit for minimalist, birthday, and custom message cakes with realistic lead times.',
    ],
    completedOrdersProof:
      'Cebu City drop-offs are a regular part of the Metro Cebu fulfillment mix, especially for offices, homes, and condo deliveries.',
    sampleQuery: 'minimalist cake',
    galleryTitle: 'Cebu City-friendly cake styles buyers ask for most',
    galleryIntro:
      'These sample designs work well for straightforward custom orders and practical city deliveries where timing matters.',
    primaryCta: {
      label: 'Order a Cebu City Cake',
      href: '/customizing',
    },
    secondaryCta: {
      label: 'See Cebu City Cake Ideas',
      href: searchHref('cebu city cake delivery minimalist birthday cake'),
    },
    coverageIntro:
      'This page leans into exact Cebu City buyer needs: faster local expectation-setting, more practical delivery language, and cleaner paths for urgent celebrations.',
    coverageAreas: ['IT Park', 'Lahug', 'Banilad', 'Talamban', 'Mabolo', 'Guadalupe', 'Capitol', 'Cebu Business Park'],
    deliveryCards: [
      {
        title: 'Made for Cebu City delivery addresses',
        badge: 'Practical local promise',
        body: 'Great for buyers sending cakes to homes, offices, and condo lobbies within Cebu City.',
      },
      {
        title: 'Earlier ordering wins better slots',
        badge: 'Before 4PM',
        body: 'For same-day Cebu City requests, earlier checkout gives the best chance of matching with a baker and delivery window.',
      },
      {
        title: 'Best fit for straightforward custom work',
        badge: 'Faster approval',
        body: 'Simple round cakes, message cakes, and minimalist layouts usually move through the fastest.',
      },
    ],
    pricingCards: [
      {
        label: 'Giftable bentos and minis',
        price: 'From P349',
        detail: 'Useful for condo deliveries, quick office greetings, and smaller celebrations.',
      },
      {
        label: 'Simple city birthday cakes',
        price: 'From P799',
        detail: 'A strong range for practical Cebu City birthday orders with manageable design scope.',
      },
      {
        label: 'More polished custom builds',
        price: 'From P1,499',
        detail: 'For buyers who want cleaner styling, more detail, or larger celebration formats.',
      },
    ],
    pricingNote:
      'Exact quote still depends on design complexity and where in Cebu City the order is going, but these ranges help serious buyers decide faster.',
    steps: [
      {
        title: 'Start with a city-friendly sample',
        body: 'Pick a design that already fits your timing, budget, and delivery expectations inside Cebu City.',
      },
      {
        title: 'Set the delivery details clearly',
        body: 'Use the event date, message, and location details to avoid the usual back-and-forth that slows city orders down.',
      },
      {
        title: 'Checkout once the plan is realistic',
        body: 'When the design and timing align, the order can move straight to a Cebu baker for fulfillment.',
      },
    ],
    whyGenie: [
      {
        title: 'Locally useful copy',
        body: 'This page answers the actual commercial questions Cebu City buyers have before they commit to an order.',
      },
      {
        title: 'Designed for high-intent traffic',
        body: 'The structure is built to convert people who already know they want cake delivery in Cebu City, not casual browsers.',
      },
      {
        title: 'Real order path',
        body: 'Every major CTA leads to a real search or customization flow so buyers are never left at a dead end.',
      },
    ],
    faqs: [
      {
        question: 'Do you handle deliveries inside Cebu City only?',
        answer:
          'This page focuses on Cebu City intent, but Genie.ph also supports wider Metro Cebu coverage. If your address is outside the city, you can still continue through the order flow.',
      },
      {
        question: 'What cake styles are most reliable for Cebu City rush orders?',
        answer:
          'Simple message cakes, bentos, and minimalist round cakes are usually the most practical choices when you need faster delivery inside Cebu City.',
      },
      {
        question: 'Can I send a cake to an office or condo in Cebu City?',
        answer:
          'Yes. Buyers commonly use Genie.ph for office surprises, lobby drop-offs, and home deliveries around Cebu City, subject to delivery instructions and building access.',
      },
      {
        question: 'Is there a difference between Cebu and Cebu City pages?',
        answer:
          'Yes. This page is written for buyers who want a more exact Cebu City promise, while the broader Cebu page covers Metro Cebu delivery intent more generally.',
      },
    ],
    relatedLinks: [
      { label: 'Cake Delivery Cebu', href: '/cake-delivery-cebu' },
      { label: 'Birthday Cake Delivery Cebu City', href: '/birthday-cake-delivery-cebu-city' },
      { label: 'Search same-day birthday cakes', href: searchHref('same day birthday cake cebu city') },
      { label: 'Browse all cake collections', href: '/collections' },
    ],
    finalCtaTitle: 'Need a Cebu City cake delivery page that turns into an actual order?',
    finalCtaBody:
      'Use the same Genie.ph flow the homepage pushes buyers into: sample first, customize fast, then checkout while the delivery slot still makes sense.',
  },
  'birthday-cake-delivery-cebu-city': {
    slug: 'birthday-cake-delivery-cebu-city',
    metadataTitle: 'Birthday Cake Delivery Cebu City | Fast Cebu City Birthday Cakes',
    metaDescription:
      'Order birthday cake delivery in Cebu City with fast customization, practical rush-order guidance, and real sample designs. Genie.ph helps Cebu City buyers close birthday orders quickly.',
    heroEyebrow: 'Urgent Birthday Cake Intent in Cebu City',
    h1: 'Birthday Cake Delivery in Cebu City for Last-Minute Celebrations and Easy Custom Orders',
    heroBody:
      'Need a birthday cake in Cebu City without wasting time on slow quote threads? Genie.ph helps high-intent buyers move quickly with real cake samples, clear starting-price guidance, and a direct path to custom ordering for birthdays, surprises, and after-work celebrations.',
    heroHighlights: [
      'Best for urgent birthday buying moments in Cebu City.',
      'Strong fit for message cakes, minimalist birthday cakes, and themed celebration cakes with practical delivery timing.',
      'Built to move buyers from search to order before the celebration window closes.',
    ],
    completedOrdersProof:
      'Birthday cake orders are one of the most common Cebu City use cases on Genie.ph, including rush gifts and scheduled surprise deliveries.',
    sampleQuery: 'birthday cake',
    galleryTitle: 'Birthday cake samples that convert fast in Cebu City',
    galleryIntro:
      'These are the kinds of birthday cake pegs people use when they are ready to buy and need a cleaner order path immediately.',
    primaryCta: {
      label: 'Customize a Birthday Cake',
      href: '/customizing',
    },
    secondaryCta: {
      label: 'Browse Birthday Cake Ideas',
      href: searchHref('birthday cake cebu city'),
    },
    coverageIntro:
      'The page is tuned for buyers ordering birthday cakes into Cebu City neighborhoods, homes, offices, and condo buildings where timing matters more than browsing forever.',
    coverageAreas: ['Lahug', 'Banawa', 'Mabolo', 'Banilad', 'Talamban', 'Capitol', 'Guadalupe', 'Cebu Business Park'],
    deliveryCards: [
      {
        title: 'Birthday-focused rush ordering',
        badge: 'Fast buyer flow',
        body: 'The page is written around urgent birthday decisions, so the copy stays direct, useful, and easy to act on.',
      },
      {
        title: 'Cebu City delivery logic',
        badge: 'Local coverage',
        body: 'We keep the promise practical for city buyers instead of burying location details inside generic brand messaging.',
      },
      {
        title: 'Easy custom message setup',
        badge: 'Personalized',
        body: 'Short birthday messages, color changes, and topper tweaks can be handled without making the whole order feel complicated.',
      },
    ],
    pricingCards: [
      {
        label: 'Simple birthday bentos',
        price: 'From P349',
        detail: 'Great for compact surprise gifts, quick greetings, and smaller birthday setups.',
      },
      {
        label: 'Classic birthday round cakes',
        price: 'From P799',
        detail: 'The most practical range for standard Cebu City birthday cake delivery orders.',
      },
      {
        label: 'Themed birthday cakes',
        price: 'From P1,499',
        detail: 'Ideal for more detailed celebration cakes, character themes, and bigger presentation moments.',
      },
    ],
    pricingNote:
      'For truly urgent birthday orders, the best-value option is usually a simple design with a clear message and manageable delivery distance inside Cebu City.',
    steps: [
      {
        title: 'Choose a birthday peg that matches your timeline',
        body: 'A cleaner design usually means a faster order path, which matters when the celebration is close.',
      },
      {
        title: 'Set the birthday message and delivery plan',
        body: 'Lock the wording, date, and Cebu City destination so the order can move with fewer revisions.',
      },
      {
        title: 'Checkout before the good slots disappear',
        body: 'Once the design is realistic for the schedule, push it through the Genie.ph customization flow immediately.',
      },
    ],
    whyGenie: [
      {
        title: 'Made for buyers who are ready now',
        body: 'The page avoids fluffy SEO filler and answers the birthday objections that slow urgent buyers down.',
      },
      {
        title: 'Better sample proof',
        body: 'Real design examples help birthday buyers decide faster than generic marketing statements ever could.',
      },
      {
        title: 'Cebu City relevance',
        body: 'This page keeps the birthday delivery promise specific to Cebu City, which makes it more credible and more useful.',
      },
    ],
    faqs: [
      {
        question: 'Can I still order a birthday cake in Cebu City today?',
        answer:
          'Sometimes, yes. Same-day depends on the design, the time of checkout, and whether a Cebu baker can still fulfill it before the celebration window closes.',
      },
      {
        question: 'What kind of birthday cakes are easiest to order fast?',
        answer:
          'Simple birthday messages, minimalist styles, bentos, and cleaner round cakes usually move faster than highly detailed themed builds.',
      },
      {
        question: 'How much does birthday cake delivery in Cebu City usually start at?',
        answer:
          'Compact bento birthday cakes typically start around P349, while simple round birthday cakes usually start around P799 before delivery and upgrades.',
      },
      {
        question: 'Can I personalize the cake even if I am ordering last-minute?',
        answer:
          'Yes. You can still personalize the message, colors, and some styling details. The key is keeping the design practical for the remaining lead time.',
      },
    ],
    relatedLinks: [
      { label: 'Cake Delivery Cebu City', href: '/cake-delivery-cebu-city' },
      { label: 'Cake Delivery Cebu', href: '/cake-delivery-cebu' },
      { label: 'Kids Party Cakes Cebu', href: '/kids-party-cakes-cebu' },
      { label: 'Search minimalist birthday cakes', href: searchHref('minimalist birthday cake') },
    ],
    finalCtaTitle: 'Need a birthday cake in Cebu City before the moment passes?',
    finalCtaBody:
      'Open the Genie.ph customization flow now, set the message and date, and move while the most realistic delivery windows are still available.',
  },
  'kids-party-cakes-cebu': {
    slug: 'kids-party-cakes-cebu',
    metadataTitle: 'Kids Party Cakes Cebu | Themed Birthday Cakes for Kids in Cebu',
    metaDescription:
      'Order kids party cakes in Cebu with themed birthday cake ideas, clear starting-price guidance, and easy customization. Genie.ph helps parents order character and themed cakes across Metro Cebu.',
    heroEyebrow: 'Themed Kids Cakes in Metro Cebu',
    h1: 'Kids Party Cakes in Cebu for Themed Birthdays, Character Designs, and Easy Custom Ordering',
    heroBody:
      'Planning a kids birthday party in Cebu? Genie.ph helps parents and gift-givers order themed cakes faster with real sample designs, flexible customization, and Metro Cebu delivery guidance that makes sense for party timelines.',
    heroHighlights: [
      'Great for princess, dinosaur, cartoon, gaming, school, and character-party themes.',
      'Parents can upload a peg and fine-tune the cake before checkout instead of starting from scratch.',
      'Useful for home parties, school celebrations, Jollibee-style party add-ons, and family gatherings across Metro Cebu.',
    ],
    completedOrdersProof:
      'Themed birthday cakes for kids are a regular Metro Cebu order type, especially for weekend parties and milestone birthdays.',
    sampleQuery: 'character cake',
    galleryTitle: 'Kids cake themes that work well for Cebu birthday parties',
    galleryIntro:
      'These sample designs are a strong visual starting point for parents planning themed birthdays and needing a custom cake that looks party-ready.',
    primaryCta: {
      label: 'Customize a Kids Party Cake',
      href: '/customizing',
    },
    secondaryCta: {
      label: 'Search Kids Cake Ideas',
      href: searchHref('kids birthday cake theme'),
    },
    coverageIntro:
      'Most kids party cake buyers need two things: a theme that matches the party plan and a baker who can deliver across Metro Cebu without making the process stressful.',
    coverageAreas: ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Talisay', 'Consolacion', 'Liloan'],
    deliveryCards: [
      {
        title: 'Theme-led custom cakes',
        badge: 'Party-ready',
        body: 'Character cakes, color-matched party cakes, and topper-led designs are easier to plan when you can start from real sample work.',
      },
      {
        title: 'Metro Cebu birthday coverage',
        badge: 'Weekend-friendly',
        body: 'Useful for family parties, school events, and weekend birthday setups across Cebu City and nearby Metro Cebu areas.',
      },
      {
        title: 'Clearer planning for parents',
        badge: 'Less stress',
        body: 'The page helps parents understand what is realistic on budget, timing, and design complexity before they commit.',
      },
    ],
    pricingCards: [
      {
        label: 'Simple themed birthday cakes',
        price: 'From P799',
        detail: 'A good starting point for cleaner color-themed or message-led kids cakes.',
      },
      {
        label: 'Character and topper-led designs',
        price: 'From P1,499',
        detail: 'Best for stronger party themes, licensed-character inspiration, and more decorative setups.',
      },
      {
        label: 'Larger party centerpiece cakes',
        price: 'From P2,199',
        detail: 'Ideal when the cake needs to visually anchor the whole birthday table or serve more guests.',
      },
    ],
    pricingNote:
      'Character work, specialty toppers, and more elaborate sculpted details usually need more lead time, so earlier ordering is the safest move for kids parties.',
    steps: [
      {
        title: 'Choose the party theme',
        body: 'Start with the color palette, character peg, or party concept so the design direction is obvious from the first click.',
      },
      {
        title: 'Refine the cake for age and setup',
        body: 'Adjust the message, topper direction, and size based on the number of guests and the style of party you are planning.',
      },
      {
        title: 'Place the order before party week gets tight',
        body: 'Once the design looks right, send it through the Genie.ph flow so the baker has a clean production brief.',
      },
    ],
    whyGenie: [
      {
        title: 'Better inspiration for parents',
        body: 'Parents can browse real themed cake directions instead of trying to explain the whole concept in chat from the beginning.',
      },
      {
        title: 'Built for conversion, not fluff',
        body: 'The page stays useful and practical so party-planning traffic can make a decision instead of bouncing back to search.',
      },
      {
        title: 'Strong internal paths',
        body: 'Every related link keeps buyers moving toward sample discovery, customization, or another relevant Cebu landing page.',
      },
    ],
    faqs: [
      {
        question: 'What kinds of kids party cake themes can I order in Cebu?',
        answer:
          'Parents commonly order princess, dinosaur, cartoon, gaming, sports, and school-themed cakes, plus color-coordinated party cakes with matching toppers.',
      },
      {
        question: 'How early should I order a themed kids cake?',
        answer:
          'Earlier is always better for more detailed themes. Simpler party cakes are easier to fulfill fast, but character-heavy cakes usually need more lead time.',
      },
      {
        question: 'Can I send a peg from Pinterest or Facebook?',
        answer:
          'Yes. Upload the peg, then use the Genie.ph customization flow to make the design more practical for your budget and timeline.',
      },
      {
        question: 'Do you deliver kids birthday cakes outside Cebu City?',
        answer:
          'Yes. Genie.ph supports Metro Cebu delivery coverage, including Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby areas depending on the baker.',
      },
    ],
    relatedLinks: [
      { label: 'Birthday Cake Delivery Cebu City', href: '/birthday-cake-delivery-cebu-city' },
      { label: 'Cake Delivery Cebu', href: '/cake-delivery-cebu' },
      { label: 'Search character cakes', href: searchHref('character cake') },
      { label: 'Customize any cake theme', href: '/customizing' },
    ],
    finalCtaTitle: 'Need a themed kids party cake in Cebu without the planning headache?',
    finalCtaBody:
      'Start from a real sample, customize the theme details quickly, and turn your party idea into an actual Metro Cebu cake order.',
  },
};

export const LOCAL_SEO_ROUTES = Object.keys(CEBU_LANDING_PAGES).map((slug) => `/${slug}`);
