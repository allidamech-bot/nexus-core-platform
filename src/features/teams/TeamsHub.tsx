import { useState } from "react";
import { toast } from "sonner";
import {
  useOrganizations,
  useCreateOrganization,
  useGenerateInvitation,
  useOrganizationInvitations,
  useAcceptInvitation,
} from "./teamsQueries";
import { Copy, Plus, Users, Shield, Link as LinkIcon, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TeamsHub() {
  const { data: orgs, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const acceptInv = useAcceptInvitation();

  const [newOrgName, setNewOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    try {
      await createOrg.mutateAsync(newOrgName);
      setNewOrgName("");
      toast.success("Organization created successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to create organization");
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken.trim()) return;
    try {
      await acceptInv.mutateAsync(inviteToken.trim());
      setInviteToken("");
      toast.success("Joined organization successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to join organization");
    }
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading Teams...</div>;

  return (
    <div className="space-y-8" dir="ltr">
      {/* Accept Invite */}
      <div className="rounded-xl border border-border bg-surface-elevated/50 p-4">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          Join via Invitation Token
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste token here..."
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={inviteToken}
            onChange={(e) => setInviteToken(e.target.value)}
          />
          <Button
            size="sm"
            onClick={handleAcceptInvite}
            disabled={acceptInv.isPending || !inviteToken}
          >
            {acceptInv.isPending ? "Joining..." : "Join"}
          </Button>
        </div>
      </div>

      {/* Orgs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Your Organizations
          </h3>
        </div>

        {orgs?.length === 0 ? (
          <p className="text-xs text-muted-foreground">You are not a member of any organization yet.</p>
        ) : (
          <div className="grid gap-4">
            {orgs?.map((org) => (
              <OrganizationCard key={org.id} org={org} />
            ))}
          </div>
        )}

        {/* Create New */}
        <div className="pt-4 border-t border-border mt-6">
          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-widest">Create New Organization</h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization Name"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateOrg}
              disabled={createOrg.isPending || !newOrgName}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrganizationCard({ org }: { org: any }) {
  const { data: invitations } = useOrganizationInvitations(org.id);
  const generateInv = useGenerateInvitation();
  const [roleToInvite, setRoleToInvite] = useState<'admin' | 'reviewer' | 'developer'>('reviewer');

  const handleGenerate = async () => {
    try {
      const inv = await generateInv.mutateAsync({ organizationId: org.id, role: roleToInvite });
      toast.success("Token generated. Share it securely.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate token");
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copied to clipboard");
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">{org.name}</span>
        </div>
        <div className="text-xs px-2 py-1 bg-surface-elevated rounded-full border border-border">
          {org.organization_members?.length} Members
        </div>
      </div>

      {/* Invitations Section */}
      <div className="bg-surface-elevated/30 rounded-lg p-3 border border-border/50">
        <h5 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Invite Members
        </h5>
        <div className="flex gap-2 mb-3">
          <select 
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={roleToInvite}
            onChange={(e) => setRoleToInvite(e.target.value as any)}
          >
            <option value="developer">Developer</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={handleGenerate}
            disabled={generateInv.isPending}
          >
            Generate Token
          </Button>
        </div>

        {invitations && invitations.length > 0 && (
          <div className="space-y-2 mt-3">
            {invitations.filter((i: any) => i.status === 'pending').map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between bg-background p-2 rounded-md border border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-muted-foreground font-medium w-16">{inv.role}</span>
                  <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-[10px] tracking-wider truncate max-w-[120px]">
                    {inv.token}
                  </code>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToken(inv.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
