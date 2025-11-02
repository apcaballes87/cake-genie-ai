
'use client';

import React, { useState, useEffect } from 'react';
import { getSharedDesign } from '../../services/shareService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ArrowLeft, Edit, ShoppingCart, Share2, CopyIcon as Copy, CheckCircle } from 'lucide-react';
import { showSuccess, showError } from '../../lib/utils/toast';
import LazyImage from '../../components/LazyImage';
import { AvailabilityType } from '../../lib/utils/availability';

interface SharedDesign {
  design_id: string;
  customized_image_url: string;
  title: string;
  description: string;
  alt_text: string;
  cake_type: string;
  cake_size: string;
  cake_flavor: string;
  cake_thickness: string;
  icing_colors: { name: string; hex: string }[];
  accessories: string[];
  base_price: number;
  final_price: number;
  availability_type: AvailabilityType;
  creator_name: string | null;
}

interface SharedDesignPageProps {
  designId: string;
  onStartWithDesign: (design: SharedDesign) => void;
  onNavigateHome: () => void;
  onPurchaseDesign: (design: SharedDesign) => void;
}

const AVAILABILITY_INFO: Record<AvailabilityType, { label: string; time: string; icon: string; bgColor: string; textColor: string }> = {
    rush: { label: 'Rush Order', time: 'Ready in 30 minutes', icon: '⚡', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    'same-day': { label: 'Same-Day', time: 'Ready in 3 hours', icon: '🕐', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    normal: { label: 'Standard Order', time: '1-day lead time', icon: '📅', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
};

const SharedDesignPage: React.FC<SharedDesignPageProps> = ({
  designId,
  onStartWithDesign,
  onNavigateHome,
  onPurchaseDesign,
}) => {
  const [design, setDesign] = useState<SharedDesign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    const fetchDesign = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getSharedDesign(designId);
        if (!data) {
          throw new Error("Design not found or it may have been removed.");
        }
        setDesign(data as SharedDesign);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the design.");
        showError(err instanceof Error ? err.message : "Could not load the design.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDesign();
  }, [designId]);

  const handleCopyLink = () => {
    setIsCopying(true);
    navigator.clipboard.writeText(window.location.href).then(() => {
      showSuccess("Link copied to clipboard!");
      setTimeout(() => setIsCopying(false), 2000);
    }).catch(err => {
      showError("Failed to copy link.");
      setIsCopying(false);
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }

  if (error || !design) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
        <p className="text-slate-600 mb-6">{error || "This design could not be loaded."}</p>
        <button onClick={onNavigateHome} className="text-pink-600 font-semibold hover:underline">Return Home</button>
      </div>
    );
  }

  const availability = AVAILABILITY_INFO[design.availability_type] || AVAILABILITY_INFO.normal;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onNavigateHome} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text truncate">
          {design.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div className="relative">
          <LazyImage src={design.customized_image_url} alt={design.alt_text} className="w-full aspect-square object-cover rounded-xl shadow-lg border border-slate-200" />
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={handleCopyLink} className="p-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-md hover:bg-white transition-colors">
              {isCopying ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col">
          <p className="text-slate-600 leading-relaxed">{design.description}</p>
          
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${availability.bgColor} border border-transparent`}>
            <span className="text-2xl">{availability.icon}</span>
            <div>
              <p className={`font-bold text-sm ${availability.textColor}`}>{availability.label}</p>
              <p className={`text-xs ${availability.textColor.replace('800', '700')}`}>{availability.time}</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Type:</span>
              <span className="text-slate-800 font-semibold">{design.cake_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Size:</span>
              <span className="text-slate-800 font-semibold">{design.cake_size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Flavor:</span>
              <span className="text-slate-800 font-semibold">{design.cake_flavor}</span>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-slate-500 font-medium">Price:</span>
              <span className="text-3xl font-bold text-pink-600">₱{design.final_price.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-auto pt-6 space-y-3">
            <button
              onClick={() => onPurchaseDesign(design)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
            >
              <ShoppingCart className="w-5 h-5" />
              Purchase This Design
            </button>
            <button
              onClick={() => onStartWithDesign(design)}
              className="w-full flex items-center justify-center gap-2 text-center bg-white border-2 border-purple-500 text-purple-600 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-purple-50 transition-all text-base"
            >
              <Edit className="w-5 h-5" />
              Customize This Design
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedDesignPage;
