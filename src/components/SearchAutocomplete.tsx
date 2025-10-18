

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, CameraIcon } from './icons'; 
import { TRENDING_KEYWORDS, CAKE_SEARCH_KEYWORDS } from '../constants/searchKeywords';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  onUploadClick: () => void;
  placeholder?: string;
}

// Helper to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <>{text}</>;

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
  placeholder = 'Search designs or upload an image...'
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions as user types or show trending on focus
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions(TRENDING_KEYWORDS.slice(0, 8)); // Show trending if input is short
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = CAKE_SEARCH_KEYWORDS
      .filter(keyword => keyword.toLowerCase().includes(lowerQuery))
      .slice(0, 8); // Show max 8 suggestions

    setSuggestions(matches);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key separately to ensure it always works
    if (e.key === 'Enter') {
      e.preventDefault();
      // If a suggestion is highlighted, select it. Otherwise, perform a search.
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        handleSearch();
      }
      return; // Stop further execution for Enter key
    }
    
    // Guard for other navigation keys (Arrows, Escape)
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
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
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
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

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-5 pr-32 py-4 text-sm border-slate-200 border rounded-full shadow-lg focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button
                type="button"
                onClick={onUploadClick}
                className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
                aria-label="Upload an image"
            >
                <CameraIcon className="w-5 h-5" />
            </button>
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

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
           <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <ul className="max-h-80 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion}>
                <button
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors ${index === selectedIndex ? 'bg-purple-50' : ''}`}
                >
                  <SearchIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700 text-sm">
                    <HighlightMatch text={suggestion} query={query} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
