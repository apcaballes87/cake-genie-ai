import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

interface AvailabilitySettings {
  rush_to_same_day_enabled: boolean;
  rush_same_to_standard_enabled: boolean; // Alternative column name
  rush_lead_time_minutes?: number;
  same_day_lead_time_hours?: number;
  standard_lead_time_days?: number;
  rush_label?: string;
  same_day_label?: string;
  standard_label?: string;
}

// Cache the settings to avoid repeated database calls
let cachedSettings: AvailabilitySettings | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

export async function fetchAvailabilitySettings(): Promise<AvailabilitySettings> {
  const now = Date.now();

  // Return cached settings if still valid
  if (cachedSettings && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('availability_settings')
      .select('rush_to_same_day_enabled, rush_same_to_standard_enabled, rush_lead_time_minutes, same_day_lead_time_hours, standard_lead_time_days, rush_label, same_day_label, standard_label')
      .single();

    if (error) {
      console.error('Error fetching availability settings:', error);
      // Default values if there's an error
      return {
        rush_to_same_day_enabled: false,
        rush_same_to_standard_enabled: false,
        rush_lead_time_minutes: 30,
        same_day_lead_time_hours: 3,
        standard_lead_time_days: 1
      };
    }

    const settings: AvailabilitySettings = {
      rush_to_same_day_enabled: data?.rush_to_same_day_enabled ?? false,
      rush_same_to_standard_enabled: data?.rush_same_to_standard_enabled ?? false,
      rush_lead_time_minutes: data?.rush_lead_time_minutes ?? 30,
      same_day_lead_time_hours: data?.same_day_lead_time_hours ?? 3,
      standard_lead_time_days: data?.standard_lead_time_days ?? 1,
      rush_label: data?.rush_label,
      same_day_label: data?.same_day_label,
      standard_label: data?.standard_label
    };

    // Update cache
    cachedSettings = settings;
    lastFetchTime = now;

    return settings;
  } catch (err) {
    console.error('Exception fetching availability settings:', err);
    return {
      rush_to_same_day_enabled: false,
      rush_same_to_standard_enabled: false,
      rush_lead_time_minutes: 30,
      same_day_lead_time_hours: 3,
      standard_lead_time_days: 1
    };
  }
}

// Helper function to generate time message
export function getAvailabilityTimeMessage(type: 'rush' | 'same-day' | 'normal', settings: AvailabilitySettings): string {
  switch (type) {
    case 'rush':
      if (settings.rush_label) return settings.rush_label;
      const rushMinutes = settings.rush_lead_time_minutes ?? 30;
      return `Ready in ${rushMinutes} minutes`;

    case 'same-day':
      if (settings.same_day_label) return settings.same_day_label;
      const sameDayHours = settings.same_day_lead_time_hours ?? 3;
      return `Ready in ${sameDayHours} hour${sameDayHours > 1 ? 's' : ''}`;

    case 'normal':
      if (settings.standard_label) return settings.standard_label;
      const standardDays = settings.standard_lead_time_days ?? 1;
      return `Requires ${standardDays} day${standardDays > 1 ? 's' : ''} lead time`;

    default:
      return '';
  }
}

export function useAvailabilitySettings() {
  const [settings, setSettings] = useState<AvailabilitySettings>({
    rush_to_same_day_enabled: false,
    rush_same_to_standard_enabled: false,
    rush_lead_time_minutes: 30,
    same_day_lead_time_hours: 3,
    standard_lead_time_days: 1
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const fetchedSettings = await fetchAvailabilitySettings();
        setSettings(fetchedSettings);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();

    // Optionally: Set up real-time subscription to settings changes
    const subscription = supabase
      .channel('availability_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_settings'
        },
        () => {
          // Invalidate cache and reload
          cachedSettings = null;
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { settings, isLoading };
}
