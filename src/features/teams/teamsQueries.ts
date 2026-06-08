import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*, organization_members(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("organizations")
        .insert({ name, owner_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Auto-add owner as admin member
      await supabase
        .from("organization_members")
        .insert({ organization_id: data.id, user_id: user.id, role: "admin" });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useGenerateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      role,
    }: {
      organizationId: string;
      role: "admin" | "reviewer" | "developer";
    }) => {
      const token =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const { data, error } = await supabase
        .from("organization_invitations")
        .insert({
          organization_id: organizationId,
          role,
          token,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_invitations"] });
    },
  });
}

export function useOrganizationInvitations(organizationId: string) {
  return useQuery({
    queryKey: ["organization_invitations", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/teams/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to accept invitation");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
