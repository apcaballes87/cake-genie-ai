'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { SearchIcon, CameraIcon, Loader2, LinkIcon, LayersIcon } from './icons';
import { CAKE_SEARCH_KEYWORDS } from '@/constants/searchKeywords';
import { getSuggestedKeywords, getPopularKeywords, logSearchAnalytics, getDesignCategories } from '@/services/supabaseService';
import { trackSearch } from '@/lib/analytics';
import Link from 'next/link';
import { getPreferredProductImageUrl } from '@/lib/utils/imageSelection';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  onUploadClick?: () => void;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  showUploadButton?: boolean;
  className?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

// Static site links configuration
const SITE_LINKS = [
  { label: 'How to Order', href: '/how-to-order', keywords: ['how', 'order', 'guide', 'steps'] },
  { label: 'Payment Options', href: '/payment-options', keywords: ['pay', 'payment', 'gcash', 'bank', 'card', 'checkout'] },
  { label: 'Delivery Rates', href: '/delivery-rates', keywords: ['delivery', 'rates', 'shipping', 'fee', 'transport'] },
  { label: 'Partner Bakeshops', href: '/shop', keywords: ['shop', 'merchants', 'bakeshops', 'stores'] },
  { label: 'About Us', href: '/about', keywords: ['about', 'story', 'company', 'info'] },
  { label: 'Contact Us', href: '/contact', keywords: ['contact', 'email', 'phone', 'support', 'reach'] },
];

// Fallback collection links (will be replaced by dynamic ones)
const FALLBACK_COLLECTIONS = [
  { label: 'Birthday Cakes', href: '/collections/birthday-cake', keywords: ['birthday', 'bday', 'party'] },
  { label: 'Wedding Cakes', href: '/collections/wedding-cake', keywords: ['wedding', 'marriage', 'bridal'] },
  { label: 'Minimalist Cakes', href: '/collections/minimalist-cake', keywords: ['minimalist', 'simple', 'clean'] },
  { label: 'Bento Cakes', href: '/collections/bento-cake', keywords: ['bento', 'lunchbox', 'small'] },
];

// Helper to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1 || query.length === 0) return <>{text}</>;

  return (
    <>
      {text.substring(0, index)}
      <span className="font-bold text-purple-600">
        {text.substring(index, index + query.length)}
      </span>
      {text.substring(index + query.length)}
    </>
  );
}

// Global cache to prevent redundant fetches across remounts
let collectionsCache: { label: string; href: string; keywords: string[] }[] | null = null;

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  onSearch,
  onUploadClick,
  placeholder = 'Search designs or upload an image...',
  value: query,
  onChange: setQuery,
  inputClassName = "w-full pl-5 pr-32 py-4 text-sm border-slate-200 border rounded-full shadow-lg focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow",
  showUploadButton = true,
  className,
  autoFocus = false,
  inputRef,
  onFocus,
  onBlur,
}) => {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // FTS live product results
  const [ftsResults, setFtsResults] = useState<any[]>([]);
  const [isFtsLoading, setIsFtsLoading] = useState(false);
  const ftsDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Filtered links
  const [filteredSiteLinks, setFilteredSiteLinks] = useState<typeof SITE_LINKS>([]);
  const [filteredCollectionLinks, setFilteredCollectionLinks] = useState<{ label: string; href: string; keywords: string[] }[]>([]);
  const [dynamicCollections, setDynamicCollections] = useState<{ label: string; href: string; keywords: string[] }[]>(collectionsCache || []);

  // Compute the visible list of keywords for keyboard navigation
  // When input is empty, show suggested + popular + same-day keywords
  // When input has text, show autocomplete suggestions

  // --- State for suggested and popular keywords ---
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const hasFetchedSuggestions = useRef(false);

  const sameDayKeywords = [
    'minimalist cakes',
    'bento cakes',
    'edible photo cakes',
    'birthday cakes printout only',
  ];

  // Autocomplete filtering effect when user types
  useEffect(() => {
    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      
      // Keyword suggestions
      const matches = CAKE_SEARCH_KEYWORDS
        .filter(keyword => keyword.toLowerCase().includes(lowerQuery))
        .slice(0, 6); // Show max 6 keyword suggestions
      setSuggestions(matches);

      // Filter site links
      const matchedSiteLinks = SITE_LINKS.filter(link => 
        link.label.toLowerCase().includes(lowerQuery) || 
        link.keywords.some(k => k.toLowerCase().includes(lowerQuery))
      );
      setFilteredSiteLinks(matchedSiteLinks);

      // Filter collection links
      const collectionsToFilter = dynamicCollections.length > 0 ? dynamicCollections : FALLBACK_COLLECTIONS;
      const matchedCollections = collectionsToFilter.filter(link => 
        link.label.toLowerCase().includes(lowerQuery) || 
        link.keywords.some(k => k.toLowerCase().includes(lowerQuery))
      ).slice(0, 10); // Show up to 10 matching collections
      setFilteredCollectionLinks(matchedCollections);
    } else {
      setSuggestions([]); // Clear autocomplete if input is empty
      setFtsResults([]);
      setFilteredSiteLinks([]);
      setFilteredCollectionLinks([]);
    }
  }, [query, dynamicCollections]);

  // Load dynamic collections as the LAST thing on the site
  useEffect(() => {
    if (collectionsCache) {
      return;
    }

    const fetchCollections = async () => {
      try {
        const { data, error } = await getDesignCategories();
        if (data && !error) {
          const collections = data.map(cat => ({
            label: cat.keyword,
            href: `/collections/${cat.slug}`,
            keywords: [cat.keyword.toLowerCase()]
          }));
          collectionsCache = collections;
          setDynamicCollections(collections);
        }
      } catch (err) {
        console.error('Failed to fetch collections:', err);
      }
    };

    // Ensure this is the last one to load
    const handleLoad = () => {
      // 2 second delay after window load to be absolutely sure it's last
      setTimeout(fetchCollections, 2000);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  // Debounced FTS product search when user types 3+ characters
  useEffect(() => {
    if (query.trim().length >= 3) {
      if (ftsDebounceRef.current) clearTimeout(ftsDebounceRef.current);
      setIsFtsLoading(true);
      ftsDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=4`);
          const json = await res.json();
          setFtsResults(json.data || []);
        } catch {
          setFtsResults([]);
        } finally {
          setIsFtsLoading(false);
        }
      }, 300);
    } else {
      setFtsResults([]);
      setIsFtsLoading(false);
    }

    return () => {
      if (ftsDebounceRef.current) clearTimeout(ftsDebounceRef.current);
    };
  }, [query]);

  // Compute visible keywords for keyboard navigation
  const getVisibleKeywords = (): (string | { label: string, href: string })[] => {
    if (query.trim().length > 0) {
      return [
        ...suggestions,
        ...filteredSiteLinks,
        ...filteredCollectionLinks
      ];
    }
    // When input is empty, combine all visible keyword lists
    return [...suggestedKeywords, ...popularKeywords, ...sameDayKeywords];
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const visibleItems = getVisibleKeywords();

    // Handle Enter key separately to ensure it always works
    if (e.key === 'Enter') {
      e.preventDefault();
      // If a suggestion is highlighted, select it. Otherwise, search the typed text.
      if (showSuggestions && selectedIndex >= 0 && visibleItems[selectedIndex]) {
        const selected = visibleItems[selectedIndex];
        if (typeof selected === 'string') {
          handleSelectSuggestion(selected);
        } else {
          router.push(selected.href);
          setShowSuggestions(false);
        }
      } else {
        // Search the current input text explicitly
        const currentQuery = query.trim();
        if (currentQuery) {
          logSearchAnalytics(currentQuery, 'typed');
          trackSearch(currentQuery, 'autocomplete_enter');
          onSearch(currentQuery);
          setShowSuggestions(false);
        }
      }
      return; // Stop further execution for Enter key
    }

    // Guard for other navigation keys (Arrows, Escape)
    if (!showSuggestions || visibleItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < visibleItems.length - 1 ? prev + 1 : prev));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    // Directly trigger search, which will update the input value via parent
    setShowSuggestions(false);
    logSearchAnalytics(suggestion, 'clicked');
    trackSearch(suggestion, 'autocomplete_suggestion');
    onSearch(suggestion);
  };

  const handleSearch = () => {
    const currentQuery = query.trim();
    if (currentQuery) {
      logSearchAnalytics(currentQuery, 'typed');
      trackSearch(currentQuery, 'autocomplete_button');
      onSearch(currentQuery);
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // --- Fetch suggested & popular keywords on focus ---
  const handleFocus = () => {
    setShowSuggestions(true);
    if (hasFetchedSuggestions.current || query.trim().length > 0) return;

    setIsLoadingSuggestions(true);
    hasFetchedSuggestions.current = true; // Prevent re-fetching on subsequent focus events

    Promise.all([
      getSuggestedKeywords(),
      getPopularKeywords()
    ]).then(([suggested, popular]) => {
      if (suggested && suggested.length > 0) {
        setSuggestedKeywords(suggested);
      }
      if (popular && popular.length > 0) {
        setPopularKeywords(popular);
      }
    }).catch(err => {
      console.error("Failed to fetch keywords:", err);
    }).finally(() => {
      setIsLoadingSuggestions(false);
    });
  };

  return (
    <div className={`relative w-full ${className || ''}`} ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={(e) => {
            handleFocus();
            onFocus?.(e);
          }}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {showUploadButton && onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
              aria-label="Upload an image"
            >
              <CameraIcon className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleSearch}
            className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        </div>
      </div>

      {showSuggestions && (
        <div
          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
          // Reserve minimum height to prevent CLS when dropdown appears
          style={{ minHeight: '180px' }}
        >
          <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {query.trim().length === 0 ? (
            // Show suggested and popular keywords when input is empty
            <div>
              {isLoadingSuggestions ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {suggestedKeywords.length > 0 && (
                    <div className="p-3">
                      <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Popular Searches</h3>
                      <div className="flex flex-wrap gap-2">
                        {suggestedKeywords.map((keyword, idx) => {
                          const globalIndex = idx;
                          const isSelected = selectedIndex === globalIndex;
                          return (
                            <button
                              key={`sugg-${keyword}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectSuggestion(keyword)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors active:bg-purple-100 ${isSelected
                                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300/40'
                                : 'bg-slate-100 text-slate-700 hover:bg-purple-100 hover:text-purple-700'
                                }`}
                            >
                              {keyword}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {popularKeywords.length > 0 && (
                    <div className={`p-3 ${suggestedKeywords.length > 0 ? 'border-t border-slate-100' : ''}`}>
                      <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Popular Searches</h3>
                      <div className="flex flex-wrap gap-2">
                        {popularKeywords.map((keyword, idx) => {
                          const globalIndex = suggestedKeywords.length + idx;
                          const isSelected = selectedIndex === globalIndex;
                          return (
                            <button
                              key={`pop-${keyword}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectSuggestion(keyword)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors active:bg-purple-100 ${isSelected
                                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300/40'
                                : 'bg-slate-100 text-slate-700 hover:bg-purple-100 hover:text-purple-700'
                                }`}
                            >
                              {keyword}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className={`p-3 ${(suggestedKeywords.length > 0 || popularKeywords.length > 0) ? 'border-t border-slate-100' : ''}`}>
                    <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Available for same-day deliveries</h3>
                    <div className="flex flex-wrap gap-2">
                      {sameDayKeywords.map((keyword, idx) => {
                        const globalIndex = suggestedKeywords.length + popularKeywords.length + idx;
                        const isSelected = selectedIndex === globalIndex;
                        return (
                          <button
                            key={`sameday-${keyword}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectSuggestion(keyword)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors active:bg-purple-200 ${isSelected
                              ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300/40'
                              : 'bg-slate-100 text-slate-700 hover:bg-purple-100 hover:text-purple-700'
                              }`}
                          >
                            {keyword}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {suggestedKeywords.length === 0 && popularKeywords.length === 0 && !isLoadingSuggestions && (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Start typing to search for a cake design.
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // Show autocomplete list + FTS product results when user is typing
            <div className="max-h-112 overflow-y-auto">
              {suggestions.length > 0 && (
                <ul>
                  {suggestions.map((suggestion, index) => (
                    <li key={suggestion}>
                      <button
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer active:bg-purple-100 ${index === selectedIndex ? 'bg-purple-50' : 'hover:bg-purple-50'}`}
                      >
                        <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-700 text-sm">
                          <HighlightMatch text={suggestion} query={query} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Site Links Section */}
              {filteredSiteLinks.length > 0 && (
                <div className={`${suggestions.length > 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="px-4 pt-3 pb-1">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      Site Pages
                    </h3>
                  </div>
                  <ul>
                    {filteredSiteLinks.map((link, index) => {
                      const globalIndex = suggestions.length + index;
                      const isSelected = selectedIndex === globalIndex;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setShowSuggestions(false)}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer active:bg-purple-100 ${isSelected ? 'bg-purple-50' : 'hover:bg-purple-50'}`}
                          >
                            <LinkIcon className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-slate-700 text-sm font-medium">
                              <HighlightMatch text={link.label} query={query} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Collection Links Section */}
              {filteredCollectionLinks.length > 0 && (
                <div className={`${(suggestions.length > 0 || filteredSiteLinks.length > 0) ? 'border-t border-slate-100' : ''}`}>
                  <div className="px-4 pt-3 pb-1">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      Collections
                    </h3>
                  </div>
                  <ul>
                    {filteredCollectionLinks.map((link, index) => {
                      const globalIndex = suggestions.length + filteredSiteLinks.length + index;
                      const isSelected = selectedIndex === globalIndex;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setShowSuggestions(false)}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer active:bg-purple-100 ${isSelected ? 'bg-purple-50' : 'hover:bg-purple-50'}`}
                          >
                            <LayersIcon className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-slate-700 text-sm font-medium">
                              <HighlightMatch text={link.label} query={query} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* FTS Live Product Results */}
              {(ftsResults.length > 0 || isFtsLoading) && (
                <div className={`${(suggestions.length > 0 || filteredSiteLinks.length > 0 || filteredCollectionLinks.length > 0) ? 'border-t border-slate-100' : ''}`}>
                  <div className="px-4 pt-3 pb-1">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      Quick Results
                      {isFtsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    </h3>
                  </div>
                  {ftsResults.map((product) => {
                    const preferredImageUrl = getPreferredProductImageUrl(product.studio_edited_image_url, product.original_image_url);

                    return (
                      <button
                        key={product.slug}
                        onClick={() => {
                          setShowSuggestions(false);
                          logSearchAnalytics(query, 'product_click');
                          router.push(`/customizing/${product.slug}`);
                        }}
                        className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-purple-50 transition-colors"
                      >
                        {preferredImageUrl && (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                            <Image
                              src={preferredImageUrl}
                              alt={product.alt_text || product.keywords || ''}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 truncate">
                            {product.alt_text || product.keywords || product.slug}
                          </p>
                          {product.price && (
                            <p className="text-xs text-slate-900 font-bold">
                              ₱{Number(product.price).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {suggestions.length === 0 && ftsResults.length === 0 && filteredSiteLinks.length === 0 && filteredCollectionLinks.length === 0 && !isFtsLoading && query.trim().length > 0 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  No results found. Try a different search term.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
