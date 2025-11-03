import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

interface AvailabilitySettings {
  rush_to_same_day_enabled: boolean;
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
      .select('rush_to_same_day_enabled')
      .single();

    if (error) {
      console.error('Error fetching availability settings:', error);
      // Default to false if there's an error
      return { rush_to_same_day_enabled: false };
    }

    const settings: AvailabilitySettings = {
      rush_to_same_day_enabled: data?.rush_to_same_day_enabled ?? false
    };

    // Update cache
    cachedSettings = settings;
    lastFetchTime = now;

    return settings;
  } catch (err) {
    console.error('Exception fetching availability settings:', err);
    return { rush_to_same_day_enabled: false };
  }
}

export function useAvailabilitySettings() {
  const [settings, setSettings] = useState<AvailabilitySettings>({
    rush_to_same_day_enabled: false
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
