'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, CameraIcon, Loader2 } from './icons';
import { CAKE_SEARCH_KEYWORDS } from '@/constants/searchKeywords';
import { getSuggestedKeywords, getPopularKeywords } from '@/services/supabaseService';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  onUploadClick?: () => void;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  showUploadButton?: boolean;
  className?: string;
}

// Helper to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1 || query.length === 0) return <>{text}</>;

  return (
    <>
      {text.substring(0, index)}
      <span className="font-bold text-pink-600">
        {text.substring(index, index + query.length)}
      </span>
      {text.substring(index + query.length)}
    </>
  );
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  onSearch,
  onUploadClick,
  placeholder = 'Search designs or upload an image...',
  value: query,
  onChange: setQuery,
  inputClassName = "w-full pl-5 pr-32 py-4 text-sm border-slate-200 border rounded-full shadow-lg focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow",
  showUploadButton = true,
  className
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const matches = CAKE_SEARCH_KEYWORDS
        .filter(keyword => keyword.toLowerCase().includes(lowerQuery))
        .slice(0, 8); // Show max 8 suggestions
      setSuggestions(matches);
    } else {
      setSuggestions([]); // Clear autocomplete if input is empty
    }
  }, [query]);

  // Compute visible keywords for keyboard navigation
  const getVisibleKeywords = (): string[] => {
    if (query.trim().length > 0) {
      return suggestions;
    }
    // When input is empty, combine all visible keyword lists
    return [...suggestedKeywords, ...popularKeywords, ...sameDayKeywords];
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const visibleKeywords = getVisibleKeywords();

    // Handle Enter key separately to ensure it always works
    if (e.key === 'Enter') {
      e.preventDefault();
      // If a suggestion is highlighted, select it. Otherwise, search the typed text.
      if (showSuggestions && selectedIndex >= 0 && visibleKeywords[selectedIndex]) {
        handleSelectSuggestion(visibleKeywords[selectedIndex]);
      } else {
        // Search the current input text explicitly
        const currentQuery = query.trim();
        if (currentQuery) {
          onSearch(currentQuery);
          setShowSuggestions(false);
        }
      }
      return; // Stop further execution for Enter key
    }

    // Guard for other navigation keys (Arrows, Escape)
    if (!showSuggestions || visibleKeywords.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < visibleKeywords.length - 1 ? prev + 1 : prev));
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
    onSearch(suggestion);
  };

  const handleSearch = () => {
    const currentQuery = query.trim();
    if (currentQuery) {
      onSearch(currentQuery);
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Fetch suggested & popular keywords on focus ---
  const handleFocus = () => {
    setShowSuggestions(true);
    if (hasFetchedSuggestions.current || query.trim().length > 0) return;

    setIsLoadingSuggestions(true);
    hasFetchedSuggestions.current = true; // Prevent re-fetching on subsequent focus events

    Promise.all([
      getSuggestedKeywords(),
      Promise.resolve([]) // Popular keywords disabled - RPC function doesn't exist
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
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={handleFocus}
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
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
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
                              onClick={() => handleSelectSuggestion(keyword)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${isSelected
                                ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-300'
                                : 'bg-slate-100 text-slate-700 hover:bg-pink-100 hover:text-pink-700'
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
                              onClick={() => handleSelectSuggestion(keyword)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${isSelected
                                ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-300'
                                : 'bg-slate-100 text-slate-700 hover:bg-pink-100 hover:text-pink-700'
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
                            onClick={() => handleSelectSuggestion(keyword)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${isSelected
                              ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-300'
                              : 'bg-slate-100 text-slate-700 hover:bg-pink-100 hover:text-pink-700'
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
            // Show autocomplete list when user is typing
            suggestions.length > 0 && (
              <ul className="max-h-80 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion}>
                    <button
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors ${index === selectedIndex ? 'bg-purple-50' : ''}`}
                    >
                      <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-700 text-sm">
                        <HighlightMatch text={suggestion} query={query} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
};