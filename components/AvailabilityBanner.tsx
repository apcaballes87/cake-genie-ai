import React from 'react';
import { AvailabilityType } from '../lib/utils/availability';

interface AvailabilityInfo {
  type: AvailabilityType;
  label: string;
  time: string;
  icon: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const AVAILABILITY_MAP: Record<AvailabilityType, AvailabilityInfo> = {
  rush: {
    type: 'rush',
    label: 'Rush Order Available!',
    time: 'Ready in 30 minutes',
    icon: '⚡',
    description: 'Simple design - we can make this super fast!',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-300'
  },
  'same-day': {
    type: 'same-day',
    label: 'Same-Day Order!',
    time: 'Ready in 3 hours',
    icon: '🕐',
    description: 'Quick turnaround - order now for today!',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300'
  },
  normal: {
    type: 'normal',
    label: 'Standard Order',
    time: 'Requires 1 day lead time',
    icon: '📅',
    description: 'Order by 3 PM for next-day delivery slots. Complex designs need time for perfection!',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300'
  }
};

interface AvailabilityBannerProps {
  availability: AvailabilityType;
  isLoading?: boolean;
  isUpdating?: boolean;
}

const AvailabilityBanner: React.FC<AvailabilityBannerProps> = ({ 
  availability, 
  isLoading = false,
  isUpdating = false
}) => {
  // Show loading state if cart is loading or items are updating
  if (isLoading || isUpdating) {
    return (
      <div className="w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all duration-300 animate-fade-in bg-slate-50 border-slate-200">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
        </div>
        <div className="flex-grow">
          <div className="h-5 w-1/3 bg-slate-200 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-1/2 bg-slate-200 rounded mb-2 animate-pulse"></div>
          <div className="h-3 w-2/3 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const availabilityInfo = AVAILABILITY_MAP[availability];

  return (
    <div className={`w-full p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in ${availabilityInfo.bgColor} ${availabilityInfo.borderColor}`}>
      {/* Icon */}
      <div className="text-3xl flex-shrink-0 mt-1">
        {availabilityInfo.icon}
      </div>
      
      {/* Content */}
      <div className="flex-grow">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className={`text-lg font-bold ${availabilityInfo.textColor}`}>
            {availabilityInfo.label}
          </h4>
          <span className={`
            px-2 py-0.5 text-xs font-semibold rounded-full
            ${availability === 'rush' ? 'bg-green-200 text-green-800' : ''}
            ${availability === 'same-day' ? 'bg-blue-200 text-blue-800' : ''}
            ${availability === 'normal' ? 'bg-slate-200 text-slate-700' : ''}
          `}>
            {availabilityInfo.time}
          </span>
        </div>
        
        <p className={`text-sm mt-1 ${availabilityInfo.textColor.replace('800', '700')}`}>
          {availabilityInfo.description}
        </p>
        
        {/* Additional info based on type */}
        {availability === 'rush' && (
          <p className="text-xs mt-2 text-green-600">
            💨 Perfect for last-minute celebrations!
          </p>
        )}
        
        {availability === 'same-day' && (
          <p className="text-xs mt-2 text-blue-600">
            ⏰ Order before 12 PM for same-day pickup!
          </p>
        )}
        
        {availability === 'normal' && (
          <p className="text-xs mt-2 text-slate-600">
            🎨 Complex designs take time - but they're worth the wait!
          </p>
        )}
      </div>
    </div>
  );
};

export default AvailabilityBanner;