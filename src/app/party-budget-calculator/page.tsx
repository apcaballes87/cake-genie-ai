import { buildMarketingPageMetadata } from '@/lib/utils/metadata';
import { buildFAQPageSchema } from '@/lib/seo/schema';
import LandingHeader from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import PartyBudgetCalculator from './PartyBudgetCalculator';

export const metadata = buildMarketingPageMetadata({
  title: "Birthday Party Budget Calculator Philippines 2026 — Plan in PHP",
  description:
    "Plan your child's birthday party with our free interactive calculator. Get real PHP estimates for Manila & provincial parties, allocate by category, and export to PDF.",
  canonicalPath: 'https://genie.ph/party-budget-calculator',
});

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph/' },
    { '@type': 'ListItem', position: 2, name: 'Party Budget Calculator', item: 'https://genie.ph/party-budget-calculator' },
  ],
};

const faqItems = [
  {
    question: 'How much does an average kids birthday party cost in the Philippines in 2026?',
    answer:
      'The average kids birthday party in the Philippines (2026) costs between ₱30,000 and ₱120,000 depending on venue, guest count, and party theme. Intimate home parties with 20 kids start around ₱15,000, while premium venue parties with 80+ guests can reach ₱200,000. Metro Manila typically runs 20-30% higher than provincial areas.',
  },
  {
    question: 'What is the classic budget split for a Filipino kids birthday party?',
    answer:
      'A recommended starting split is: 40% venue & catering, 15% cakes & desserts, 15% entertainment, 10% decorations, 10% photography, and 10% favors, supplies & contingency. Adjust based on your priorities — if you want an entertainer, allocate more here and trim decorations.',
  },
  {
    question: 'Can I plan a beautiful kids birthday party on a small budget?',
    answer:
      'Absolutely. By hosting at home, doing DIY decorations with balloons and printable banners, booking a budget-friendly caterer, and relying on family for setup and photography, couples regularly host adorable parties for ₱10,000–₱30,000. Book a local baka or pancit supplier instead of full catering, and source balloons from Divisoria or online shops.',
  },
  {
    question: 'When should I start budgeting for a kids birthday party?',
    answer:
      'Start planning at least 2–3 months ahead. Venue and entertainer bookings need 6–8 weeks lead time. Catering menus and cake tastings should be locked 4 weeks before the party. Send invitations (digital saves costs) at least 3 weeks out.',
  },
  {
    question: 'Is my data saved anywhere?',
    answer:
      'Your planner auto-saves locally in your browser. If you press Save Details and sign in or create an account, your party budget is also saved securely to your Genie.ph account so you can open it on another device.',
  },
  {
    question: 'Can I export my budget to PDF?',
    answer:
      'Yes — click "Export PDF" to download a branded, printable summary you can share with your partner, venue, or caterer. The PDF includes your party details, line-item breakdown, and totals in your selected currency.',
  },
];

const faqSchema = buildFAQPageSchema(faqItems, 'https://genie.ph/party-budget-calculator');

const budgetAllocation = [
  { category: 'Venue, catering & rentals', share: '40%', php: '₱48,000', note: 'Food is priced per head; guest count drives 70% of this spend' },
  { category: 'Cakes & desserts', share: '15%', php: '₱18,000', note: 'Themed cakes can double this cost' },
  { category: 'Entertainment', share: '15%', php: '₱18,000', note: 'Clown/mascot or magician is the biggest line here' },
  { category: 'Decorations', share: '10%', php: '₱12,000', note: 'DIY balloons cut this by 60%' },
  { category: 'Photography & video', share: '10%', php: '₱12,000', note: 'Digital gallery vs. printed albums varies widely' },
  { category: 'Favors, supplies & misc', share: '5%', php: '₱6,000', note: 'D1 Store and Divisoria are budget-friendly' },
  { category: 'Contingency', share: '10%', php: '₱12,000', note: 'Covers extra guests and last-minute extras' },
];

const philippineAverages = [
  { category: 'Venue rental (party hall or garden)', typicalShare: '25%', avgCost: '₱30,000', range: '₱10,000 – ₱80,000' },
  { category: 'Catering (food)', typicalShare: '28%', avgCost: '₱33,600', range: '₱150 – ₱400 / guest' },
  { category: 'Bar & beverages', typicalShare: '4%', avgCost: '₱4,800', range: '₱80 – ₱200 / guest' },
  { category: 'Photography', typicalShare: '8%', avgCost: '₱9,600', range: '₱5,000 – ₱20,000' },
  { category: 'Videography', typicalShare: '3%', avgCost: '₱3,600', range: '₱2,000 – ₱10,000' },
  { category: 'Flowers & decor', typicalShare: '12%', avgCost: '₱14,400', range: '₱5,000 – ₱40,000' },
  { category: 'Music / DJ / band', typicalShare: '8%', avgCost: '₱9,600', range: '₱3,000 – ₱25,000' },
  { category: 'Cake & desserts', typicalShare: '10%', avgCost: '₱12,000', range: '₱4,000 – ₱30,000' },
  { category: 'Invitations & stationery', typicalShare: '2%', avgCost: '₱2,400', range: '₱500 – ₱8,000' },
  { category: 'Transportation', typicalShare: '2%', avgCost: '₱2,400', range: '₱500 – ₱5,000' },
  { category: 'Favors & gifts', typicalShare: '5%', avgCost: '₱6,000', range: '₱2,000 – ₱15,000' },
  { category: 'Contingency / misc.', typicalShare: '8%', avgCost: '₱9,600', range: '₱2,000 – ₱20,000' },
];

const costCuttingTips = [
  {
    title: 'Host at home or a public park',
    desc: 'Eliminates venue rental entirely — save ₱30,000–60,000. Barangay halls rent for ₱5,000–10,000.',
  },
  {
    title: 'Book a home-based baker',
    desc: 'Home bakers charge 40–60% less than commercial cakeries for the same quality themed cakes.',
  },
  {
    title: 'Rent a clown/mascot instead of a full package',
    desc: 'A solo entertainer with your own sound system saves ₱5,000–10,000 vs. full-service packages.',
  },
  {
    title: 'Shop supplies at D1 or Divisoria',
    desc: 'Bulk party supplies wholesale can save 60–70% vs. retail party shops.',
  },
  {
    title: 'Go digital for invites',
    desc: 'Facebook event or Viber broadcast eliminates printing and postage costs — save ₱3,000–5,000.',
  },
  {
    title: 'Limit loot bag value per child',
    desc: 'Simple ₱100–150 loot bags with snacks and small toys still delight kids without breaking the bank.',
  },
  {
    title: 'DIY balloon arch or backdrop',
    desc: 'Pre-made backdrops cost ₱2,000–3,000; DIY with balloons from online shops can be done for under ₱500.',
  },
  {
    title: 'Potluck-style add-ons',
    desc: 'Ask parents to contribute one shared snack or dessert — reduces per-guest catering costs.',
  },
];

const partyTimeline = [
  { when: '8 weeks ahead', action: 'Set total budget · Book venue · Hire entertainer' },
  { when: '6 weeks', action: 'Book caterer · Order cake · Buy party supplies' },
  { when: '4 weeks', action: 'Send invitations · Finalize menu · DIY decorations' },
  { when: '2 weeks', action: 'Confirm headcount · Prepare loot bags · Final setup prep' },
  { when: '1 day before', action: 'Set up decorations · chill food · charge sound system' },
  { when: 'Party day', action: 'Welcome guests · oversee catering · capture memories' },
];

export default function PartyBudgetCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <LandingHeader />

      <main className="min-h-screen genie-page-bg px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-purple-100 bg-white p-8 shadow-sm md:p-10">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">Birthday Party Budget Calculator Philippines</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Plan every peso of your child&rsquo;s big day. Enter your budget, adjust guest count, and export a printable PDF.
            </p>
          </section>

          <PartyBudgetCalculator />

          <section className="mt-12 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm md:p-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              How to plan your kids birthday party budget — a complete 2026 guide
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Budgeting is easily the most stressful part of planning a birthday party — and for good
              reason. The average parent in the Philippines now spends between{' '}
              <strong>₱30,000 and ₱120,000</strong> on a kids birthday party, and that range can swing
              dramatically based on city, venue, and party theme. This guide walks you through exactly
              how to use the calculator above, how to allocate your money across every category, and how
              to cut costs intelligently without sacrificing the fun the kids deserve.
            </p>

            <div className="mt-8 space-y-6 text-slate-700">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 1 — Decide the total first</h3>
                <p className="mt-2 leading-7">
                  Before you fall in love with a ₱8,000 themed cake or book a ₱30,000 venue, sit down
                  with your co-parent and agree on a hard ceiling. Enter that number in the{' '}
                  <em>Overall budget</em> field above. The calculator will then show a running progress
                  bar so you can see, line by line, how close you are getting to the edge.
                </p>
                <p className="mt-2 italic">
                  If you do nothing else, agree on the total first. Every downstream decision — guest
                  list, venue, entertainment — flows from this single number.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 2 — Nail the guest count early</h3>
                <p className="mt-2 leading-7">
                  The single biggest lever in your birthday party budget is <strong>how many people you invite</strong>.
                  Catering, party favors, and even venue size are all priced per head. Cutting 10 guests
                  from a 50-child party can realistically save you ₱10,000–15,000 without a single
                  missing smile on the dance floor.
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-6">
                  <li>&bull; <strong>Core list</strong> — your child&rsquo;s classmates, close cousins.</li>
                  <li>&bull; <strong>Parents</strong> — adults who need seating. Trim here first.</li>
                  <li>&bull; <strong>Extended family</strong> — &ldquo;we should probably invite&hellip;&rdquo; Safe to trim.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 3 — Follow the classic 40-15-15-10-10-10 allocation</h3>
                <p className="mt-2 leading-7">
                  Most party planners recommend this starting split before adjusting for your specific priorities:
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-purple-100">
                        <th className="pb-2 font-semibold text-slate-900">Category group</th>
                        <th className="pb-2 font-semibold text-slate-900">Share of budget</th>
                        <th className="pb-2 font-semibold text-slate-900">On a ₱120,000 budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetAllocation.map((row) => (
                        <tr key={row.category} className="border-b border-purple-50">
                          <td className="py-3">
                            <div className="font-medium text-slate-900">{row.category}</div>
                            <p className="text-xs text-slate-500">{row.note}</p>
                          </td>
                          <td className="py-3 font-semibold">{row.share}</td>
                          <td className="py-3 font-semibold text-purple-700">{row.php}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 4 — Build in a real contingency</h3>
                <p className="mt-2 leading-7">
                  Every party has &ldquo;invisible&rdquo; costs: extra catering for hungry teens, additional balloon
                  sets that popped, last-minute thank-you gifts, delivery charges, and the inevitable
                  &ldquo;one more thing&rdquo; your child asks for at the party store. A <strong>5–10% contingency
                  buffer</strong> is not optional — it is the single biggest predictor of whether you stay
                  on budget. Set it at 8% unless you have very firm quotes for every line.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Step 5 — Understand what each category actually includes</h3>
                <ol className="mt-3 space-y-2 text-sm leading-7">
                  <li>1. <strong>Venue &amp; Setup</strong> — hall rental, tables, chairs, balloon setup, cleanup crew.</li>
                  <li>2. <strong>Food &amp; Catering</strong> — kids&rsquo; meal sets, adult meals, snacks, drinks, serving staff.</li>
                  <li>3. <strong>Cakes &amp; Desserts</strong> — themed birthday cake, dessert table, cupcakes, candy bar.</li>
                  <li>4. <strong>Entertainment</strong> — clown, magician, character mascot, DJ, or sound system.</li>
                  <li>5. <strong>Party Decorations</strong> — balloons, photo backdrop, banners, table centerpieces.</li>
                  <li>6. <strong>Photography &amp; Video</strong> — photographer for 2-3 hours, highlight clip, digital gallery.</li>
                  <li>7. <strong>Party Favors</strong> — loot bags, toys, treats, thank-you gifts.</li>
                  <li>8. <strong>Party Supplies</strong> — plates, cups, utensils, napkins, signage.</li>
                  <li>9. <strong>Games &amp; Activities</strong> — inflatables, face painting, arts &amp; crafts station.</li>
                </ol>
              </div>
            </div>

            <section className="mt-10 rounded-2xl border border-purple-100 bg-slate-50 p-6">
              <h3 className="text-xl font-bold text-slate-900">Real 2026 average kids party costs in the Philippines</h3>
              <p className="mt-2 text-sm text-slate-600">
                National medians from 2025–2026 supplier surveys. Use these as a sanity check against
                your own quotes — then overwrite them in the calculator above.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-purple-100">
                        <th className="pb-2 text-left font-semibold text-slate-900">Category</th>
                        <th className="pb-2 text-left font-semibold text-slate-900">Typical share</th>
                        <th className="pb-2 text-left font-semibold text-slate-900">Average cost (PHP)</th>
                        <th className="pb-2 text-left font-semibold text-slate-900">Budget range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {philippineAverages.map((row) => (
                        <tr key={row.category} className="border-b border-purple-50">
                        <td className="py-2.5 font-medium text-slate-900">{row.category}</td>
                        <td className="py-2.5 text-slate-600">{row.typicalShare}</td>
                        <td className="py-2.5 font-semibold text-purple-700">{row.avgCost}</td>
                        <td className="py-2.5 text-slate-600">{row.range}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section className="mt-12 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm md:p-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              10 smart ways to cut kids party costs without cutting fun
            </h2>
            <div className="mt-6 space-y-4">
              {costCuttingTips.map((tip, idx) => (
                <div key={tip.title} className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700 text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{tip.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm md:p-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Kids party budget timeline — when to budget each item
            </h2>
            <p className="mt-4 text-sm text-slate-600">
              Use this timeline alongside the calculator. Each milestone unlocks a deposit or final
              payment, so knowing the rhythm keeps you from feeling cash-flow pressure at the finish line.
            </p>
            <div className="mt-6 space-y-4">
              {partyTimeline.map((item) => (
                <div key={item.when} className="flex gap-4">
                  <div className="w-28 shrink-0 font-bold text-purple-700">{item.when}</div>
                  <div className="text-slate-700">{item.action}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm md:p-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
               Birthday Party Budget Calculator Philippines — FAQ
            </h2>
            <div className="mt-6 space-y-6">
              {faqItems.map((item) => (
                <div key={item.question} className="border-b border-purple-100 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </>
  );
}
