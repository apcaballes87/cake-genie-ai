import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh for 5 mins
      // FIX: `cacheTime` was renamed to `gcTime` in TanStack Query v5.
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache for 10 mins
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
      refetchOnReconnect: true, // Refetch when internet reconnects
    },
  },
});
