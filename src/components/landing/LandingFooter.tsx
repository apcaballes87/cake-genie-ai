'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Camera, Cake, Tag, CreditCard, Facebook, Instagram, MessageCircle, Youtube, Star, Mail, Phone, ChevronUp, ShieldCheck, Lock, X } from 'lucide-react';
import LazyImage from '@/components/LazyImage';
import { COMMON_ASSETS } from '@/constants';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

const featureCards = [
  { title: 'Instantly get the price', body: 'Upload your cake design and get your price in 10 seconds.', href: '/customizing', cta: 'Upload here', icon: Camera, accent: 'purple' },
  { title: 'Fresh cakes delivered to you', body: 'Homemade delicious cakes freshly baked just in time for your special day', href: '/about', cta: 'About Us', icon: Cake, accent: 'pink' },
  { title: 'Affordable yummy cakes', body: 'All prices of our cake designs are always updated and affordable', href: '/how-to-order', cta: 'How to order', icon: Tag, accent: 'purple' },
  { title: 'Secure payment options', body: 'E-wallets, over-the-counter and bank payments for your convenience', href: 'https://checkout.xendit.co/od/genieph', cta: 'Payments', icon: CreditCard, accent: 'pink' },
] as const;

const socialLinks = [
  { href: 'https://web.facebook.com/geniephilippines', label: 'Facebook', icon: Facebook, className: 'text-purple-600 hover:bg-purple-600 hover:text-white' },
  { href: 'https://www.instagram.com/genie.ph/', label: 'Instagram', icon: Instagram, className: 'text-purple-600 hover:bg-purple-600 hover:text-white' },
  { href: 'https://www.youtube.com/@genieph', label: 'YouTube', icon: Youtube, className: 'text-red-500 hover:bg-red-600 hover:text-white' },
  { href: 'https://m.me/genieph', label: 'Messenger', icon: MessageCircle, className: 'text-blue-500 hover:bg-blue-600 hover:text-white' },
] as const;

const exploreLinks = ['/customizing|Customize a Cake', '/coldcaking|Cold Caking', '/shop|Shop', '/collections|Collections', '/services|Services', '/about|About Us', '/compare|Compare', '/sitemap-html|HTML Sitemap'];
const helpLinks = ['/contact|Contact Us', '/reviews|Customer Reviews', '/faq|FAQ', '/how-to-order|How to Order', '/delivery-rates|Delivery Rates', '/terms|Terms of Service', '/privacy|Privacy Policy', '/return-policy|Return Policy'];

type LandingFooterProps = {
  reviewSummary?: {
    total: number
    averageRating: number
  }
}

export function LandingFooter({ reviewSummary }: LandingFooterProps) {
  const [showDtiModal, setShowDtiModal] = useState(false);
  const hasReviewSummary = Boolean(reviewSummary && reviewSummary.total > 0 && reviewSummary.averageRating > 0);
  const averageLabel = hasReviewSummary ? reviewSummary!.averageRating.toFixed(1) : null;
  const countLabel = hasReviewSummary
    ? `${averageLabel}/5 based on ${reviewSummary!.total} Happy Customer${reviewSummary!.total === 1 ? '' : 's'}.`
    : 'Verified customer reviews';

  return (
    <footer className="genie-page-bg text-gray-900 pt-0 pb-24 md:pb-8 border-t border-purple-100">

      <div className="border-y border-purple-100 bg-white/45 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {socialLinks.map(({ href, label, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-10 h-10 rounded-full genie-icon-button flex items-center justify-center"><Icon size={18} /></a>)}
            <a href="http://tiktok.com/genie.ph" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 rounded-full genie-icon-button flex items-center justify-center"><svg viewBox="0 0 24 24" fill="currentColor" height="18" width="18"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" /></svg></a>
          </div>
          <div className="flex items-center gap-3 text-sm bg-white/85 px-4 py-2 rounded-full shadow-sm border border-purple-100">
            {averageLabel ? <span className="font-bold text-2xl text-gray-800">{averageLabel}</span> : null}
            <div className="flex text-yellow-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
            <span className="hidden md:inline text-gray-300">|</span>
            <span className="hidden md:inline text-gray-600">{countLabel}</span>
            <span className="hidden md:inline text-gray-300">|</span>
            <span className="flex items-center gap-1 text-green-500 font-bold">Verified</span>
          </div>
        </div>
      </div>

      <div className="border-t border-purple-200 pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
            <div className="md:col-span-2">
              <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={150} height={40} className="h-10 w-auto object-contain mb-4" />
              <div className="text-gray-600 text-sm leading-relaxed mb-4 space-y-3"><p>Genie.ph is where spontaneous celebrations get the cake they deserve. Custom cakes, ordered in minutes, delivered today across Metro Cebu. Your cake wish, granted.</p><p>Our delivery network covers Metro Cebu, including Cebu City, Mandaue City, Lapu-Lapu City, and Talisay City. Genie.ph specializes in custom birthday cakes, minimalist wedding cakes, personalized bento cakes, and edible photo prints with secure online payments via Maya and GCash.</p></div>
              <div className="space-y-2 text-sm text-gray-600 mb-4"><div className="flex items-center gap-2"><Mail size={15} className="genie-icon shrink-0" /><span>{genieBusinessProfile.supportEmail}</span></div><div className="flex items-center gap-2"><Phone size={15} className="genie-icon shrink-0" /><span>{genieBusinessProfile.phoneDisplay}</span></div></div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => setShowDtiModal(true)}
                  className="genie-btn-secondary px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                  aria-label="View DTI Registration"
                >
                  <ShieldCheck size={14} />
                  DTI Registered
                </button>
                <a 
                  href="https://checkout.xendit.co/od/genieph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-green-50 rounded-md text-xs font-semibold text-green-700 flex items-center gap-1.5 border border-green-100 hover:bg-green-100 transition-colors" 
                  aria-label="Secure Checkout"
                >
                  <Lock size={14} />
                  Secure Checkout
                </a>
                <a 
                  href="https://www.facebook.com/photo/?fbid=122301349718225955&set=pcb.122301048476225955"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity flex items-center justify-center h-[34px]"
                  aria-label="Backed by Stellar"
                >
                  <img 
                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/backed%20by%20stellar.webp" 
                    alt="Backed by Stellar" 
                    className="h-full w-auto object-contain"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 md:contents gap-8">
              <nav aria-label="Explore links"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Explore</h4><ul className="space-y-2.5 text-sm text-gray-600">{exploreLinks.map((item) => { const [href, label] = item.split('|'); return <li key={href}><Link href={href} className="genie-link">{label}</Link></li>; })}</ul></nav>
              <nav aria-label="Help links"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Help</h4><ul className="space-y-2.5 text-sm text-gray-600">{helpLinks.map((item) => { const [href, label] = item.split('|'); return <li key={href}><Link href={href} className="genie-link">{label}</Link></li>; })}</ul></nav>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-purple-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400">© 2025 Genie.ph | Alalai Information Technology Solutions</p>
            <a href="#top" className="genie-btn-primary p-2.5 rounded-xl" aria-label="Back to top"><ChevronUp size={20} /></a>
          </div>
      </div>
    </div>
       {/* DTI Zoom Modal */}
       {showDtiModal && (
        <div
          className="fixed inset-0 z-100 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowDtiModal(false)}
        >
          <div className="relative w-full max-w-5xl my-8 bg-white rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-12 right-0 md:-right-12 md:top-0 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors z-110"
              onClick={() => setShowDtiModal(false)}
            >
              <X size={24} />
            </button>
            <img
              src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg"
              alt="DTI Registered Document"
              className="w-full h-auto block rounded-sm shadow-inner"
            />
          </div>
        </div>
      )}
    </footer>
  );
}
