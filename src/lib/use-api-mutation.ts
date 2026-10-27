"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "./api/errors";

/**
 * Mutation wrapper used for every write: waits for the server's answer (no optimistic updates for
 * consequential actions), shows the real result, and refreshes affected server state.
 */
export function useApiMutation<TVars, TResult>({
  mutationFn,
  invalidate = [],
  success,
  onSuccess,
  errorToast = false,
}: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  /** Query-key prefixes to refetch after success. */
  invalidate?: QueryKey[];
  success?: string | ((result: TResult, vars: TVars) => string);
  onSuccess?: (result: TResult, vars: TVars) => void;
  /** Dialogs show errors inline; set true for actions without a dialog. */
  errorToast?: boolean;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result, vars) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (success) toast.success(typeof success === "function" ? success(result, vars) : success);
      onSuccess?.(result, vars);
    },
    onError: (error) => {
      if (errorToast) toast.error(errorMessage(error));
    },
  });
}
