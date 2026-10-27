import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./api/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry client errors (validation, auth, not found, conflicts); retry transient ones once.
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        // Consequential actions are never retried automatically.
        retry: false,
      },
    },
  });
}
