import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30 * 1000,       // Data is fresh for 30 seconds — prevents duplicate fetches on page navigation
      gcTime: 5 * 60 * 1000,       // Keep unused data in cache for 5 minutes
      refetchOnMount: 'always',     // Still refetch on mount but only if stale (after 30s)
      refetchOnReconnect: true,     // Refetch when internet reconnects
    },
  },
});
