import { useQuery } from '@tanstack/react-query';
import { getAvailabilitySettings } from '@/services/supabaseService';
import { AvailabilitySettings } from '@/types';

export function useAvailabilitySettings() {
  const { data, isLoading, error, refetch } = useQuery<AvailabilitySettings, Error>({
    queryKey: ['availability-settings'],
    queryFn: async () => {
      const { data, error } = await getAvailabilitySettings();
      if (error) throw error;
      if (!data) throw new Error('Availability settings not found.');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes, settings don't change often
    refetchOnWindowFocus: true, // Refetch in case admin changed settings
  });

  return {
    settings: data,
    loading: isLoading,
    error,
    refetch,
  };
}
