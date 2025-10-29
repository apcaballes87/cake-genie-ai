

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getSharedDesign } from '../../services/shareService';
import { Loader2, Share2Icon, MagicSparkleIcon, BackIcon, CartIcon } from '../../components/icons';
import { ShareModal } from '../../components/ShareModal';
import { showError } from '../../lib/utils/toast';

interface SharedDesignPageProps {
  designId: string;
  onStartWithDesign: (design: any) => void;
  onNavigateHome: () => void;
  onPurchaseDesign: (design: any) => Promise<void>;
}

// --- Availability Type Definition ---
type AvailabilityType = 'rush' | 'same-day' | 'normal';

interface AvailabilityInfo {
  type: AvailabilityType;
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

// Map the stored availability type to its display properties.
const AVAILABILITY_MAP: Record<AvailabilityType, AvailabilityInfo> = {
  normal: {
    type: 'normal',
    label: 'Standard Order',
    icon: '📅',
    bgColor: 'bg-slate-50', textColor: 'text-slate-800', borderColor: 'border-slate-300'
  },
  'same-day': {
    type: 'same-day',
    label: 'Same-Day Order',
    icon: '🕐',
    bgColor: 'bg-blue-50', textColor: 'text-blue-800', borderColor: 'border-blue-300'
  },
  rush: {
    type: 'rush',
    label: 'Rush Order Available!',
    icon: '⚡',
    bgColor: 'bg-green-50', textColor: 'text-green-800', borderColor: 'border-green-300'
  }
};


function getDynamicTimeInfo(availabilityType: AvailabilityType): string {
    const now = new Date();
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    // Last delivery slot ends at 8 PM (20:00)
    const lastDeliveryHour = 20;

    switch (availabilityType) {
        case 'rush': {
            const startTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
            const endTime = new Date(now.getTime() + 60 * 60 * 1000);   // +60 mins

            if (startTime.getHours() >= lastDeliveryHour) {
                return "It's too late for rush orders today. This design is available for rush delivery tomorrow morning.";
            }
            return `Order now and it can be ready between ${formatTime(startTime)} and ${formatTime(endTime)} today, depending on current demand.`;
        }
        case 'same-day': {
            const readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
            if (readyTime.getHours() >= lastDeliveryHour) {
                return "It's past our cutoff for same-day delivery. This design is available for delivery tomorrow.";
            }
            return `Order now to receive it as early as ${formatTime(readyTime)} today.`;
        }
        case 'normal': {
            const deliveryDate = new Date();
            deliveryDate.setDate(now.getDate() + 1); // Tomorrow
            const formattedDate = deliveryDate.toLocaleDateString('en-US', { weekday: 'long' });
            const currentHour = now.getHours();
        
            if (currentHour >= 15) { // 3 PM cutoff
                return `It's past today's 3 PM cutoff. Order now to receive it tomorrow, with the earliest available slot being 6 PM - 8 PM.`;
            } else {
                return `This intricate design requires a 1-day lead time. Order before 3 PM to secure delivery for tomorrow (${formattedDate}).`;
            }
        }
        default:
            return '';
    }
}


export default function SharedDesignPage({ designId, onStartWithDesign, onNavigateHome, onPurchaseDesign }: SharedDesignPageProps) {
  const [design, setDesign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadDesign = async () => {
      if (!designId) {
        if (isMounted) setLoading(false);
        return;
      }
      if (isMounted) setLoading(true);
      try {
        const data = await getSharedDesign(designId);
        if (isMounted) {
          setDesign(data);
        }
      } catch (err) {
        if (isMounted) {
          showError("Could not load the design.");
        }
        console.error("Failed to load shared design:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDesign();

    return () => {
      isMounted = false;
    };
  }, [designId]);
  
  const availability = useMemo(() => {
      if (!design || !design.availability_type) return AVAILABILITY_MAP.normal; // Default to normal if not set
      return AVAILABILITY_MAP[design.availability_type as AvailabilityType] || AVAILABILITY_MAP.normal;
  }, [design]);

  const timeInfo = useMemo(() => {
      if (!availability) return '';
      return getDynamicTimeInfo(availability.type);
  }, [availability]);


  const handlePurchaseClick = async () => {
    if (!design) return;
    setIsPurchasing(true);
    try {
        await onPurchaseDesign(design);
    } catch (e) {
        // Error is handled in App.tsx
    } finally {
        setIsPurchasing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading design...</p>
        </div>
      </div>
    );
  }

  // Design not found
  if (!design) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Design Not Found
          </h1>
          <p className="text-slate-600 mb-6">
            This cake design doesn't exist or has been removed.
          </p>
          <button
            onClick={onNavigateHome}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/design/${designId}` : '';

  return (
    <div className="min-h-screen py-8 px-4 w-full">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors"
        >
          <BackIcon className="w-5 h-5" />
          <span className="font-medium">Back to Home</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm mb-4">
            <MagicSparkleIcon className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-semibold text-slate-700">
              Genie Shared Design
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            {design.title}
          </h1>
          <p className="text-slate-600 text-lg">
            {design.description}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Image */}
          <div className="relative w-full h-[500px] bg-slate-100">
            <img
              src={design.customized_image_url}
              alt={design.title}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Details */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                  Cake Type
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {design.cake_type}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                  Size
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {design.cake_size}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                  Flavor
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {design.cake_flavor}
                </p>
              </div>
              <div className="bg-pink-50 p-4 rounded-lg border-2 border-pink-200">
                <p className="text-xs text-pink-600 uppercase font-semibold mb-1">
                  Price
                </p>
                <p className="text-2xl font-bold text-pink-600">
                  ₱{design.final_price.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Availability Banner */}
            {availability && timeInfo && (
              <div className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 ${availability.bgColor} ${availability.borderColor}`}>
                <div className="text-3xl flex-shrink-0 mt-1">
                  {availability.icon}
                </div>
                <div className="flex-grow">
                  <h4 className={`text-lg font-bold ${availability.textColor}`}>
                    {availability.label}
                  </h4>
                  <p className={`text-sm mt-1 ${availability.textColor.replace('800', '700')}`}>
                    {timeInfo}
                  </p>
                </div>
              </div>
            )}

            {/* Colors */}
            {design.icing_colors && design.icing_colors.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-3">
                  Icing Colors
                </p>
                <div className="flex flex-wrap gap-2">
                  {design.icing_colors.map((color: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-full border border-slate-200"
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-slate-300 shadow-sm"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {color.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accessories */}
            {design.accessories && design.accessories.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-3">
                  Accessories
                </p>
                <div className="flex flex-wrap gap-2">
                  {design.accessories.map((accessory: string, idx: number) => (
                    <span
                      key={idx}
                      className="bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium border border-purple-200"
                    >
                      {accessory}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 pt-6 border-t border-slate-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {design.view_count || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Views</p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {design.share_count || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Shares</p>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3 pt-6">
              <button
                onClick={handlePurchaseClick}
                disabled={isPurchasing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPurchasing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Adding to Cart...</>
                ) : (
                    <><CartIcon className="w-5 h-5" /> Purchase this Cake</>
                )}
              </button>
              <button
                onClick={() => onStartWithDesign(design)}
                className="w-full bg-white border-2 border-pink-600 text-pink-600 font-bold py-4 px-6 rounded-xl hover:bg-pink-50 transition-all flex items-center justify-center gap-2"
              >
                <MagicSparkleIcon className="w-5 h-5" />
                Customize this design
              </button>
              <div className="flex justify-center">
                <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="text-slate-600 hover:text-slate-800 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
                >
                    <Share2Icon className="w-5 h-5" />
                    Share this design
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {design && <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={shareUrl}
        designId={designId}
        imageUrl={design.customized_image_url}
        shareCount={design.share_count}
      />}
    </div>
  );
}