import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, updateProfile } from "../lib/api/household";
import { useAuthStore } from "../stores/auth-store";

export function useProfile() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn:  () => fetchProfile(user!.id),
    enabled:  Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: { display_name?: string; avatar_url?: string; email?: string; email_notifications_enabled?: boolean }) =>
      updateProfile(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}