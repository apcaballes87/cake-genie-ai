'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  MapPin,
  DollarSign,
  Star,
  MessageCircle,
  X,
  ExternalLink,
  ArrowLeft,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  Camera,
  Cake,
  Tag,
  CreditCard
} from 'lucide-react';
import { SUPPLIERS_DATA, SUPPLIER_CATEGORIES, CEBU_LOCATIONS, type Supplier } from '@/data/suppliersData';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { COMMON_ASSETS } from '@/constants';

export default function SuppliersDirectoryClient() {
  const router = useRouter();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('All Locations');
  const [selectedBudget, setSelectedBudget] = useState<string>('all');
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);

  // Filter logic
  const filteredSuppliers = useMemo(() => {
    return SUPPLIERS_DATA.filter((supplier) => {
      // 1. Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        supplier.name.toLowerCase().includes(query) ||
        supplier.tagline.toLowerCase().includes(query) ||
        supplier.description.toLowerCase().includes(query) ||
        supplier.specialties.some((spec) => spec.toLowerCase().includes(query));

      // 2. Category
      const matchesCategory =
        selectedCategory === 'all' || supplier.category === selectedCategory;

      // 3. Location
      const matchesLocation =
        selectedLocation === 'All Locations' ||
        supplier.locationsCovered.includes(selectedLocation);

      // 4. Budget
      const matchesBudget =
        selectedBudget === 'all' || supplier.priceRange === selectedBudget;

      return matchesSearch && matchesCategory && matchesLocation && matchesBudget;
    });
  }, [searchQuery, selectedCategory, selectedLocation, selectedBudget]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLocation('All Locations');
    setSelectedBudget('all');
  };

  return (
    <div className="min-h-screen flex flex-col genie-page-bg">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-purple-100/60 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 text-slate-600 hover:text-purple-700 rounded-full hover:bg-purple-50 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none"
              aria-label="Go back to home"
            >
              <ArrowLeft size={20} />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <img
                src={COMMON_ASSETS.logo}
                alt="Genie.ph Logo"
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/customizing"
              className="hidden sm:inline-flex genie-btn-secondary py-2 px-5 text-sm font-bold rounded-full"
            >
              Price a Cake
            </Link>
            <Link
              href="/shop"
              className="genie-btn-primary py-2 px-5 text-sm font-bold rounded-full"
            >
              Order Online
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Page Hero Section */}
        <section className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100 mb-4">
            <Sparkles size={12} className="text-purple-500" /> Curated Event Directory
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Cebu Party & <span className="text-purple-600">Event Suppliers</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Find the finest planners, stylists, emcees, mobile carts, photographers, and entertainers for your dream celebration in Metro Cebu.
          </p>
        </section>

        {/* Filter Controls Bar */}
        <section className="genie-card rounded-3xl p-6 mb-8 border border-purple-100/80 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <label htmlFor="supplier-search" className="sr-only">Search suppliers</label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <input
                id="supplier-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, specialty, or service..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label="Clear search query"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Location Filter */}
            <div className="md:col-span-3">
              <label htmlFor="location-filter" className="sr-only">Filter by Location</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <MapPin size={16} />
                </div>
                <select
                  id="location-filter"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all text-sm appearance-none cursor-pointer"
                >
                  {CEBU_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Budget Filter */}
            <div className="md:col-span-3">
              <label htmlFor="budget-filter" className="sr-only">Filter by Budget</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign size={16} />
                </div>
                <select
                  id="budget-filter"
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Budgets</option>
                  <option value="Affordable">Affordable</option>
                  <option value="Mid-range">Mid-range</option>
                  <option value="Premium">Premium / Luxury</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

          </div>

          {/* Category Navigation Row */}
          <div className="mt-6 pt-6 border-t border-purple-50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Filter by Category</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
              {Object.entries(SUPPLIER_CATEGORIES).map(([key, label]) => {
                const isActive = selectedCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer focus:ring-2 focus:ring-purple-400 focus:outline-none ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filter Badges */}
          {(searchQuery || selectedCategory !== 'all' || selectedLocation !== 'All Locations' || selectedBudget !== 'all') && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold mr-1">Active filters:</span>
              
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs px-2.5 py-1 rounded-full">
                  Search: &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery('')} aria-label="Remove search filter" className="hover:text-purple-900"><X size={12} /></button>
                </span>
              )}

              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs px-2.5 py-1 rounded-full">
                  Category: {SUPPLIER_CATEGORIES[selectedCategory as keyof typeof SUPPLIER_CATEGORIES]}
                  <button onClick={() => setSelectedCategory('all')} aria-label="Remove category filter" className="hover:text-purple-900"><X size={12} /></button>
                </span>
              )}

              {selectedLocation !== 'All Locations' && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs px-2.5 py-1 rounded-full">
                  Location: {selectedLocation}
                  <button onClick={() => setSelectedLocation('All Locations')} aria-label="Remove location filter" className="hover:text-purple-900"><X size={12} /></button>
                </span>
              )}

              {selectedBudget !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs px-2.5 py-1 rounded-full">
                  Budget: {selectedBudget}
                  <button onClick={() => setSelectedBudget('all')} aria-label="Remove budget filter" className="hover:text-purple-900"><X size={12} /></button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-purple-700 hover:text-purple-950 hover:underline ml-2 transition-all cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}

        </section>

        {/* Suppliers Counter and Results */}
        <section className="mb-6 flex justify-between items-center px-1">
          <p className="text-sm font-semibold text-slate-500">
            Showing <span className="text-slate-800 font-bold">{filteredSuppliers.length}</span> supplier{filteredSuppliers.length === 1 ? '' : 's'} in Metro Cebu
          </p>
        </section>

        {/* Suppliers Grid */}
        {filteredSuppliers.length > 0 ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12" aria-labelledby="directory-heading">
            <h2 id="directory-heading" className="sr-only">Metro Cebu Party Suppliers Grid</h2>
            {filteredSuppliers.map((supplier) => (
              <article
                key={supplier.id}
                className="genie-card genie-card-hover rounded-2xl overflow-hidden flex flex-col justify-between group"
              >
                {/* Header Image */}
                <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                  <img
                    src={supplier.imageUrl}
                    alt={supplier.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                  
                  {/* Category Pill Tag */}
                  <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-purple-700 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                    {SUPPLIER_CATEGORIES[supplier.category as keyof typeof SUPPLIER_CATEGORIES]}
                  </span>

                  {/* Budget Rating Indicator */}
                  <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm text-white ${
                    supplier.priceRange === 'Premium'
                      ? 'bg-purple-600/90'
                      : supplier.priceRange === 'Mid-range'
                      ? 'bg-indigo-600/90'
                      : 'bg-pink-600/90'
                  }`}>
                    {supplier.priceRange}
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    {/* Rating Bar */}
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <div className="flex text-yellow-400">
                        <Star size={14} fill="currentColor" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">{supplier.rating.toFixed(1)}</span>
                      <span className="text-slate-300 text-xs">|</span>
                      <span className="text-xs text-slate-500">{supplier.reviewCount} reviews</span>
                    </div>

                    {/* Supplier Title */}
                    <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1 mb-1">
                      {supplier.name}
                    </h3>
                    
                    {/* Tagline */}
                    <p className="text-xs italic text-slate-500 font-medium line-clamp-1 mb-3">
                      &ldquo;{supplier.tagline}&rdquo;
                    </p>

                    {/* Description Paragraph */}
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-3 mb-4">
                      {supplier.description}
                    </p>
                  </div>

                  {/* Metadata Specs */}
                  <div className="space-y-2 border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                      <MapPin size={14} className="text-purple-500 shrink-0" />
                      <span className="line-clamp-1">{supplier.locationsCovered.slice(0, 3).join(', ')}{supplier.locationsCovered.length > 3 ? '...' : ''}</span>
                    </div>
                    {supplier.startingPrice && (
                      <div className="flex items-center gap-2 text-slate-600 text-xs">
                        <DollarSign size={14} className="text-purple-500 shrink-0" />
                        <span>Starting at <span className="font-bold text-slate-800">{supplier.startingPrice}</span></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveSupplier(supplier)}
                    className="genie-btn-secondary py-2.5 rounded-xl text-xs font-bold w-full cursor-pointer focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    View Details
                  </button>
                  <a
                    href={supplier.contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="genie-btn-primary py-2.5 rounded-xl text-xs font-bold w-full flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    <MessageCircle size={14} />
                    Inquire
                  </a>
                </div>
              </article>
            ))}
          </section>
        ) : (
          /* Empty State */
          <section className="genie-card rounded-3xl p-12 text-center border border-dashed border-purple-200/80 mb-12 bg-white/50">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-100">
              <Filter className="text-purple-600" size={24} />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">No Suppliers Found</h3>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              We couldn&apos;t find any suppliers matching your search and filter criteria. Try resetting filters or choosing different options.
            </p>
            <button
              onClick={handleResetFilters}
              className="genie-btn-primary px-6 py-2.5 rounded-full text-sm font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          </section>
        )}

        {/* Join Directory CTA */}
        <section className="genie-card rounded-3xl p-8 bg-gradient-to-br from-purple-500 to-indigo-600 text-white relative overflow-hidden shadow-lg mb-12">
          {/* Subtle background overlay shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-20 -translate-y-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-20 translate-y-20 pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8">
              <h2 className="text-2xl sm:text-3xl font-black mb-3">Are you a Cebu Party Supplier?</h2>
              <p className="text-purple-100 text-sm sm:text-base leading-relaxed">
                Connect with thousands of parents, wedding couples, and event coordinators looking for premium services. Add your listing to our curated directory for free.
              </p>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <a
                href="https://m.me/genieph"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-purple-700 hover:bg-purple-50 font-black py-3.5 px-8 rounded-full shadow-lg transition-all active:scale-[0.98] text-sm focus:ring-2 focus:ring-white focus:outline-none"
              >
                List Your Business <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* Detail Information Modal */}
      {activeSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
          onClick={() => setActiveSupplier(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-supplier-name"
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image Header */}
            <div className="relative aspect-video w-full bg-slate-100 shrink-0">
              <img
                src={activeSupplier.imageUrl}
                alt={activeSupplier.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              
              {/* Close Button */}
              <button
                onClick={() => setActiveSupplier(null)}
                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors cursor-pointer focus:ring-2 focus:ring-white focus:outline-none"
                aria-label="Close details dialog"
              >
                <X size={18} />
              </button>

              {/* Title & Tagline in Overlay */}
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <span className="inline-block bg-purple-600 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 shadow-sm">
                  {SUPPLIER_CATEGORIES[activeSupplier.category as keyof typeof SUPPLIER_CATEGORIES]}
                </span>
                <h2 id="modal-supplier-name" className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  {activeSupplier.name}
                </h2>
              </div>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow">
              
              {/* Review / Tagline Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-1.5">
                  <div className="flex text-yellow-400">
                    <Star size={16} fill="currentColor" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{activeSupplier.rating.toFixed(1)}</span>
                  <span className="text-slate-300 text-sm">|</span>
                  <span className="text-sm text-slate-500 font-medium">{activeSupplier.reviewCount} satisfied reviews</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                  <DollarSign size={13} /> {activeSupplier.priceRange} Budget
                </div>
              </div>

              {/* About description */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Info size={16} className="text-purple-600" /> About Supplier
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                  {activeSupplier.description}
                </p>
              </div>

              {/* Specialties / Service Offerings */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Briefcase size={16} className="text-purple-600" /> Specialties & Services
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeSupplier.specialties.map((spec) => (
                    <span
                      key={spec}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                    >
                      <Sparkles size={11} className="text-purple-500" /> {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Areas Covered Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={16} className="text-purple-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Coverage</h4>
                      <p className="text-slate-800 text-xs font-bold mt-0.5">{activeSupplier.locationsCovered.join(', ')}</p>
                    </div>
                  </div>
                  {activeSupplier.startingPrice && (
                    <div className="flex items-start gap-2.5">
                      <DollarSign size={16} className="text-purple-600 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Starting Rates</h4>
                        <p className="text-slate-800 text-xs font-bold mt-0.5">{activeSupplier.startingPrice}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveSupplier(null)}
                className="genie-btn-secondary py-3 rounded-full text-sm font-bold w-full cursor-pointer focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                Close Details
              </button>
              <a
                href={activeSupplier.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="genie-btn-primary py-3 rounded-full text-sm font-bold w-full flex items-center justify-center gap-2 focus:ring-2 focus:ring-purple-400 focus:outline-none shadow-md shadow-purple-100"
              >
                <MessageCircle size={16} />
                Send Messenger Inquiry
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Feature Cards Section */}
      <section className="border-t border-purple-100/60 pt-16 pb-12 mt-12 bg-white/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <article className="genie-card genie-card-hover p-6 rounded-3xl text-center transition duration-300">
              <div className="w-12 h-12 genie-icon-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Instantly get the price</h3>
              <p className="text-gray-600 text-sm mb-4">Upload your cake design and get your price in 10 seconds.</p>
              <button onClick={() => router.push('/customizing')} className="genie-btn-primary px-6 py-2 rounded-full text-sm font-bold cursor-pointer">
                Upload here
              </button>
            </article>

            <article className="genie-card genie-card-hover p-6 rounded-3xl text-center transition duration-300">
              <div className="w-12 h-12 genie-icon-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <Cake size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Fresh cakes delivered to you</h3>
              <p className="text-gray-600 text-sm mb-4">Homemade delicious cakes freshly baked just in time for your special day</p>
              <button onClick={() => router.push('/about')} className="genie-btn-primary px-6 py-2 rounded-full text-sm font-bold cursor-pointer">
                About Us
              </button>
            </article>

            <article className="genie-card genie-card-hover p-6 rounded-3xl text-center transition duration-300">
              <div className="w-12 h-12 genie-icon-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Affordable yummy cakes</h3>
              <p className="text-gray-600 text-sm mb-4">All prices of our cake designs are always updated and affordable</p>
              <button onClick={() => router.push('/how-to-order')} className="genie-btn-primary px-6 py-2 rounded-full text-sm font-bold cursor-pointer">
                How to order
              </button>
            </article>

            <article className="genie-card genie-card-hover p-6 rounded-3xl text-center transition duration-300">
              <div className="w-12 h-12 genie-icon-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Secure payment options</h3>
              <p className="text-gray-600 text-sm mb-4">E-wallets, over-the-counter and bank payments for your convenience</p>
              <a 
                href="https://checkout.xendit.co/od/genieph" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="genie-btn-primary px-6 py-2 rounded-full text-sm font-bold inline-flex cursor-pointer"
              >
                Payments
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* Footer component */}
      <LandingFooter />
    </div>
  );
}
