'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, ShoppingBag, User } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import SameDayCutoffBanner from '@/components/SameDayCutoffBanner';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { COMMON_ASSETS } from '@/constants';

const subscribeToHydration = () => () => {};

const categoriesList = [
  { id: 'Birthdays', name: 'Birthdays' },
  { id: 'Anniversaries', name: 'Anniversaries' },
  { id: 'Christmas Day', name: 'Christmas Day' },
  { id: 'New Year', name: 'New Year' },
  { id: 'Wedding', name: 'Wedding' },
  { id: 'Baptismal', name: 'Baptismal' },
];

const otherNavLinks = [
  { label: 'Cold Caking', href: '/coldcaking', emoji: '🧊' },
  { label: 'How to Order', href: '/how-to-order', emoji: '📋' },
  { label: 'Payment Options', href: '/payment-options', emoji: '💳' },
  { label: 'Delivery Rates', href: '/delivery-rates', emoji: '🚚' },
  { label: 'About Us', href: '/about', emoji: 'ℹ️' },
  { label: 'Contact', href: '/contact', emoji: '📞' },
];

export default function LandingHeader() {
  const router = useRouter();
  const { itemCount } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOccasionOpen, setIsOccasionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    let rafId = 0;
    let pending = false;

    const updateScrollState = () => {
      if (pending) return;
      pending = true;
      rafId = window.requestAnimationFrame(() => {
        pending = false;
        setIsScrolled(window.scrollY > 12);
      });
    };

    rafId = window.requestAnimationFrame(() => setIsScrolled(window.scrollY > 12));
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updateScrollState);
    };
  }, []);

  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <div className="w-full bg-purple-400 py-[4.5px] flex justify-center items-center">
        <SameDayCutoffBanner />
      </div>

      <nav className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${(isScrolled || isSearchFocused) ? 'border-purple-100 bg-white/[0.95] shadow-sm' : 'border-transparent bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="w-full flex items-center justify-between py-2.5 md:py-[14px] relative">
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <button onClick={() => setIsMenuOpen(true)} className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors" aria-label="Open menu">
                <Menu size={24} />
              </button>
              <Link href="/" className={`hidden md:block shrink-0 transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute -translate-x-4' : 'opacity-100 translate-x-0'}`}>
                <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={135} height={43} className="h-[41px] w-auto object-contain" />
              </Link>
            </div>

            <div className={`md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}>
              <Link href="/" className="flex items-center">
                <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={105} height={32} className="h-[27px] md:h-[32px] w-auto object-contain" />
              </Link>
            </div>

            <div className={`flex-1 mx-2 md:mx-4 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-100 translate-x-0' : 'hidden md:block md:opacity-100 md:translate-x-0 opacity-0 translate-x-4 pointer-events-none md:pointer-events-auto'}`}>
              <SearchAutocomplete
                inputRef={searchInputRef}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onSearch={handleSearch}
                placeholder="Search for other designs..."
                value={searchQuery}
                onChange={setSearchQuery}
                showUploadButton={false}
                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
              />
            </div>

            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {!(isScrolled || isSearchFocused) && (
                <button onClick={() => { setIsSearchFocused(true); window.scrollTo({ top: 50, behavior: 'smooth' }); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="md:hidden p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors" aria-label="Search">
                  <Search size={24} />
                </button>
              )}
              <button onClick={() => router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login')} className={`hidden md:flex p-1.5 genie-icon-button rounded-full transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute translate-x-4' : 'opacity-100 translate-x-0'}`} aria-label="Account">
                <User size={22} />
              </button>
              <button onClick={() => router.push('/cart')} className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label={`View cart with ${isMounted ? itemCount : 0} items`}>
                <ShoppingBag className="h-5 w-5 md:h-6 md:w-6" />
                {isMounted && itemCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white text-[9px] md:text-[10px] font-bold">{itemCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className={`fixed inset-0 z-[90] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)} aria-hidden="true" style={{ background: 'rgba(0,0,0,0.45)' }} />
      <aside className={`fixed top-0 left-0 z-[100] h-full w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Side navigation">
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-purple-50">
          <img src={COMMON_ASSETS.logo} alt="Genie Logo" width={140} height={50} className="h-12 w-auto object-contain" />
          <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors" aria-label="Close menu">
            <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <Link href="/collections" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"><span className="text-xl w-7 text-center leading-none">🎂</span><span className="group-hover:translate-x-0.5 transition-transform duration-150">Browse Cakes</span></Link>
          <div>
            <button onClick={() => setIsOccasionOpen((prev) => !prev)} className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px]" aria-expanded={isOccasionOpen}><span className="text-xl w-7 text-center leading-none">🎉</span><span className="flex-1 text-left">Shop by Occasion</span><svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isOccasionOpen ? 'rotate-180' : 'rotate-0'}`}><polyline points="6 9 12 15 18 9" /></svg></button>
            <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isOccasionOpen ? `${categoriesList.length * 52}px` : '0px' }}><div className="pl-10 pb-1 flex flex-col gap-0.5">{categoriesList.map((cat) => <Link key={cat.id} href={`/search?q=${encodeURIComponent(cat.name)}`} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors text-[14px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-purple-300 shrink-0" />{cat.name}</Link>)}</div></div>
          </div>
          {otherNavLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3.5 px-3 py-3.5 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors font-medium text-[15px] group"><span className="text-xl w-7 text-center leading-none">{item.emoji}</span><span className="group-hover:translate-x-0.5 transition-transform duration-150">{item.label}</span></Link>)}
        </nav>
        <div className="px-5 py-5 border-t border-purple-50"><p className="text-[10px] text-gray-400 text-center" suppressHydrationWarning>&copy; {new Date().getFullYear()} Genie.ph — Your Cake Wish, Granted.</p></div>
      </aside>
    </>
  );
}
