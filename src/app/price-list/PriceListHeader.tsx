'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, ShoppingBag, User } from 'lucide-react';

import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { COMMON_ASSETS } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

export default function PriceListHeader() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { itemCount } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  const handleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleUpload = () => {
    router.push('/?upload=1');
  };

  const handleAccount = () => {
    router.push(isAuthenticated && !user?.is_anonymous ? '/account' : '/login');
  };

  const showCompactSearch = isScrolled || isSearchFocused;

  return (
    <nav
      className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${
        showCompactSearch
          ? 'border-purple-100 bg-white/[0.95] shadow-sm'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative flex w-full items-center justify-between py-[11px] md:py-[14px]">
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <Link
              href="/"
              className="rounded-full p-2 text-slate-600 transition-colors hover:text-purple-700 md:hidden"
              aria-label="Open Genie home"
            >
              <Menu size={24} />
            </Link>

            <Link
              href="/"
              className={`hidden shrink-0 transition-all duration-300 md:block ${
                isScrolled ? 'pointer-events-none absolute -translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
              }`}
            >
              <Image
                src={COMMON_ASSETS.logo}
                alt="Genie Logo"
                width={135}
                height={43}
                className="h-[41px] w-auto object-contain"
              />
            </Link>
          </div>

          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 md:hidden ${
              showCompactSearch ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <Link href="/" className="flex items-center">
              <Image
                src={COMMON_ASSETS.logo}
                alt="Genie Logo"
                width={105}
                height={32}
                className="h-[32px] w-auto object-contain"
              />
            </Link>
          </div>

          <div
            className={`mx-2 flex-1 transition-all duration-300 md:mx-4 ${
              showCompactSearch
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none hidden translate-x-4 opacity-0 md:block md:translate-x-0 md:opacity-100 md:pointer-events-auto'
            }`}
          >
            <SearchAutocomplete
              inputRef={searchInputRef}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onSearch={handleSearch}
              onUploadClick={handleUpload}
              placeholder="Search for other designs..."
              value={searchQuery}
              onChange={setSearchQuery}
              showUploadButton={false}
              inputClassName="w-full rounded-full border border-purple-100 bg-white py-3 pl-5 pr-12 text-sm shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            {!showCompactSearch && (
              <button
                onClick={() => {
                  setIsSearchFocused(true);
                  window.scrollTo({ top: 50, behavior: 'smooth' });
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="rounded-full p-2 text-slate-600 transition-colors hover:text-purple-700 md:hidden"
                aria-label="Search"
              >
                <Search size={24} />
              </button>
            )}

            <button
              onClick={handleAccount}
              className={`hidden rounded-full p-1.5 transition-all duration-300 md:flex ${
                isScrolled ? 'pointer-events-none absolute translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
              }`}
              aria-label="Account"
            >
              <User size={22} />
            </button>

            <button
              onClick={() => router.push('/cart')}
              className="relative shrink-0 rounded-full p-2 text-slate-600 transition-colors hover:text-purple-700"
              aria-label={`View cart with ${itemCount} items`}
            >
              <ShoppingBag size={24} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
