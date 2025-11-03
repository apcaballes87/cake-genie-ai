import React, { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';
import { AlertCircle, Calendar, Info } from 'lucide-react';

const supabase = getSupabaseClient();

interface AvailableDate {
  available_date: string;
  day_of_week: string;
  is_rush_available: boolean;
  is_same_day_available: boolean;
  is_standard_available: boolean;
}

interface BlockedDateInfo {
  is_blocked: boolean;
  reason: string | null;
  category: string | null;
}

interface DeliveryDatePickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  minDate?: string;
  className?: string;
}

export const DeliveryDatePicker: React.FC<DeliveryDatePickerProps> = ({
  selectedDate,
  onDateChange,
  minDate,
  className = '',
}) => {
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate start date (use minDate or today)
  const startDate = useMemo(() => {
    if (minDate) return minDate;
    return new Date().toISOString().split('T')[0];
  }, [minDate]);

  // ✅ STEP 1: Fetch available dates when component loads
  useEffect(() => {
    async function fetchAvailableDates() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .rpc('get_available_delivery_dates', {
            start_date: startDate,
            num_days: 30 // Next 30 days
          });

        if (error) {
          console.error('Error fetching available dates:', error);
          throw error;
        }

        setAvailableDates(data || []);
      } catch (err) {
        console.error('Error fetching dates:', err);
        setError('Failed to load available delivery dates. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchAvailableDates();
  }, [startDate]);

  // ✅ STEP 2: Check if selected date is blocked
  const handleDateSelect = async (date: string) => {
    try {
      setBlockedReason(null);

      const { data, error } = await supabase
        .rpc('is_date_blocked', {
          check_date: date,
          check_time: null
        });

      if (error) {
        console.error('Error checking if date is blocked:', error);
        throw error;
      }

      const result: BlockedDateInfo = data?.[0]; // Returns array with one item

      if (result?.is_blocked) {
        // Show error to user
        setBlockedReason(result.reason || 'This date is not available');
        return;
      }

      // Date is available, proceed
      setBlockedReason(null);
      onDateChange(date);

    } catch (err) {
      console.error('Error checking date:', err);
      setBlockedReason('Unable to verify date availability. Please try again.');
    }
  };

  // ✅ STEP 3: Determine if a date should be disabled in the calendar
  const isDateDisabled = (date: string): boolean => {
    const dateInfo = availableDates.find(d => d.available_date === date);

    if (!dateInfo) return true; // Not in available dates list

    // Check if ANY order type is available for this date
    return !(
      dateInfo.is_rush_available ||
      dateInfo.is_same_day_available ||
      dateInfo.is_standard_available
    );
  };

  // Get availability info for a date
  const getDateAvailability = (date: string): string[] => {
    const dateInfo = availableDates.find(d => d.available_date === date);
    if (!dateInfo) return [];

    const available: string[] = [];
    if (dateInfo.is_rush_available) available.push('Rush');
    if (dateInfo.is_same_day_available) available.push('Same Day');
    if (dateInfo.is_standard_available) available.push('Standard');

    return available;
  };

  // Get disabled dates for the native date input
  const disabledDatesSet = useMemo(() => {
    return new Set(
      availableDates
        .filter(d => isDateDisabled(d.available_date))
        .map(d => d.available_date)
    );
  }, [availableDates]);

  const inputStyle = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-slate-700";

  if (loading) {
    return (
      <div className={className}>
        <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Date of Event
        </label>
        <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 animate-pulse">
          <div className="h-6 bg-slate-200 rounded"></div>
        </div>
        <p className="text-xs text-slate-500 mt-1">Loading available dates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Date of Event
        </label>
        <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Date of Event
      </label>

      <input
        type="date"
        id="eventDate"
        value={selectedDate}
        onChange={(e) => handleDateSelect(e.target.value)}
        min={startDate}
        className={inputStyle}
      />

      {/* Show availability info for selected date */}
      {selectedDate && !blockedReason && (
        <div className="mt-1 flex items-start gap-1 text-xs text-slate-600">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Available: {getDateAvailability(selectedDate).join(', ') || 'Standard delivery'}
          </span>
        </div>
      )}

      {/* Show blocked reason if date is blocked */}
      {blockedReason && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Date Not Available</p>
              <p className="text-xs mt-1">{blockedReason}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDatePicker;
