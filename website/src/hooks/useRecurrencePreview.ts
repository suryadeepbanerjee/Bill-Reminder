import { useQuery } from "@tanstack/react-query";
import { fetchRecurrencePreview, type RecurrencePreviewParams } from "../lib/api/recurrence";

export function useRecurrencePreview(params: RecurrencePreviewParams | null) {
  const query = useQuery({
    queryKey: ["recurrence-preview", params],
    queryFn:  () => fetchRecurrencePreview(params!),
    enabled:  params !== null,
    staleTime: 60_000,
    retry:    false,
  });

  return {
    dates:     (query.data ?? []) as string[],
    isLoading: query.isFetching,
    error:     query.error as Error | null,
  };
}