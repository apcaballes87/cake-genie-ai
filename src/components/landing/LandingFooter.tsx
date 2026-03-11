import Link from 'next/link';
import { Camera, Cake, Tag, CreditCard, Facebook, Instagram, MessageCircle, Youtube, Star, Check, Mail, Phone, ChevronUp, ShieldCheck, Lock } from 'lucide-react';

const featureCards = [
  { title: 'Instantly get the price', body: 'Upload your cake design and we will instantly give you the price in 30 seconds.', href: '/customizing', cta: 'Upload here', icon: Camera, accent: 'purple' },
  { title: 'Fresh cakes delivered to you', body: 'Homemade delicious cakes freshly baked just in time for your special day', href: '/about', cta: 'About Us', icon: Cake, accent: 'pink' },
  { title: 'Affordable yummy cakes', body: 'All prices of our cake designs are always updated and affordable', href: '/how-to-order', cta: 'How to order', icon: Tag, accent: 'purple' },
  { title: 'Secure payment options', body: 'E-wallets, over-the-counter and bank payments for your convenience', href: '/payment-options', cta: 'Payments', icon: CreditCard, accent: 'pink' },
] as const;

const socialLinks = [
  { href: 'https://web.facebook.com/geniephilippines', label: 'Facebook', icon: Facebook, className: 'text-purple-600 hover:bg-purple-600 hover:text-white' },
  { href: 'https://www.instagram.com/genie.ph/', label: 'Instagram', icon: Instagram, className: 'text-purple-600 hover:bg-purple-600 hover:text-white' },
  { href: 'https://www.youtube.com/@genieph', label: 'YouTube', icon: Youtube, className: 'text-red-500 hover:bg-red-600 hover:text-white' },
  { href: 'https://m.me/genieph', label: 'Messenger', icon: MessageCircle, className: 'text-blue-500 hover:bg-blue-600 hover:text-white' },
] as const;

const exploreLinks = ['/customizing|Customize a Cake', '/shop|Shop', '/collections|Collections', '/blog|Blog', '/about|About Us', '/compare|Compare', '/sitemap-html|HTML Sitemap'];
const helpLinks = ['/contact|Contact Us', '/faq|FAQ', '/how-to-order|How to Order', '/delivery-rates|Delivery Rates', '/terms|Terms of Service', '/privacy|Privacy Policy', '/return-policy|Return Policy'];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-purple-50 text-gray-900 pt-16 pb-24 md:pb-8 border-t border-purple-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {featureCards.map(({ title, body, href, cta, icon: Icon, accent }) => (
            <article key={title} className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
              <div className={`w-12 h-12 ${accent === 'pink' ? 'bg-pink-100 text-pink-600' : 'bg-purple-100 text-purple-600'} rounded-full flex items-center justify-center mx-auto mb-4`}><Icon size={24} /></div>
              <h3 className={`font-bold text-lg mb-2 font-serif italic ${accent === 'pink' ? 'text-pink-600' : 'text-purple-700'}`}>{title}</h3>
              <p className="text-gray-600 text-sm mb-4">{body}</p>
              <Link href={href} className={`inline-flex ${accent === 'pink' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-purple-600 hover:bg-purple-700'} text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm`}>{cta}</Link>
            </article>
          ))}
        </div>
      </div>

      <div className="border-t border-purple-200 bg-purple-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {socialLinks.map(({ href, label, icon: Icon, className }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`w-10 h-10 rounded-full bg-white flex items-center justify-center transition shadow-sm ${className}`}><Icon size={18} /></a>)}
            <a href="http://tiktok.com/genie.ph" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 rounded-full bg-white flex items-center justify-center transition text-pink-500 hover:bg-pink-600 hover:text-white shadow-sm"><svg viewBox="0 0 24 24" fill="currentColor" height="18" width="18"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" /></svg></a>
          </div>
          <div className="flex items-center gap-3 text-sm bg-white px-4 py-2 rounded-full shadow-sm border border-purple-100">
            <span className="font-bold text-2xl text-gray-800">4.8</span>
            <div className="flex text-yellow-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
            <span className="hidden md:inline text-gray-300">|</span>
            <span className="text-gray-600">Customers rate us 4.8/5 based on 40 reviews.</span>
            <span className="hidden md:inline text-gray-300">|</span>
            <span className="flex items-center gap-1 text-green-500 font-bold">Verified <Check size={14} /></span>
          </div>
        </div>
      </div>

      <div className="border-t border-purple-200 pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
            <div className="md:col-span-2">
              <img src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp" alt="Genie Logo" width={150} height={40} className="h-10 w-auto object-contain mb-4" />
              <div className="text-gray-600 text-sm leading-relaxed mb-4 space-y-3"><p>Genie.ph is the premier online marketplace for custom cakes in Cebu, Philippines. By leveraging advanced AI design analysis, customers can upload any cake photo and receive instant price estimations from over 50 local artisan bakers and bakeshops.</p><p>Our delivery network covers Metro Cebu, including Cebu City, Mandaue City, Lapu-Lapu City, and Talisay City. Genie.ph specializes in custom birthday cakes, minimalist wedding cakes, personalized bento cakes, and edible photo prints with secure online payments via Maya and GCash.</p></div>
              <div className="space-y-2 text-sm text-gray-600 mb-4"><div className="flex items-center gap-2"><Mail size={15} className="text-purple-500 shrink-0" /><span>support@genie.ph</span></div><div className="flex items-center gap-2"><Phone size={15} className="text-pink-500 shrink-0" /><span>+63 908 940 8747</span></div></div>
              <div className="flex flex-wrap items-center gap-3"><div className="px-3 py-1.5 bg-purple-50 rounded-md text-xs font-semibold text-purple-700 flex items-center gap-1.5 border border-purple-100"><ShieldCheck size={14} />DTI Registered</div><div className="px-3 py-1.5 bg-green-50 rounded-md text-xs font-semibold text-green-700 flex items-center gap-1.5 border border-green-100"><Lock size={14} />Secure Checkout</div></div>
            </div>
            <nav aria-label="Explore links"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Explore</h4><ul className="space-y-2.5 text-sm text-gray-600">{exploreLinks.map((item) => { const [href, label] = item.split('|'); return <li key={href}><Link href={href} className="hover:text-purple-600 transition-colors">{label}</Link></li>; })}</ul></nav>
            <nav aria-label="Help links"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Help</h4><ul className="space-y-2.5 text-sm text-gray-600">{helpLinks.map((item) => { const [href, label] = item.split('|'); return <li key={href}><Link href={href} className="hover:text-purple-600 transition-colors">{label}</Link></li>; })}</ul></nav>
          </div>

          <div className="mt-12 pt-6 border-t border-purple-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">© {year} Genie.ph. All rights reserved.</p>
            <a href="#top" className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 transition shadow-md" aria-label="Back to top"><ChevronUp size={20} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}