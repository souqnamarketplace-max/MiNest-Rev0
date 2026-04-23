import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,        // Data is fresh for 60s — prevents refetches on back-navigation
      gcTime: 10 * 60 * 1000,      // Keep unused data in cache for 10 minutes
      refetchOnMount: false,        // Don't refetch if data is still fresh (staleTime handles this)
      refetchOnReconnect: true,
    },
  },
});
