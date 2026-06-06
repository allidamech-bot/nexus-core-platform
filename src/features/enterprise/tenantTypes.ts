export type WorkspaceRole = "owner" | "reviewer" | "developer" | "viewer";
export type TeamRole = "admin" | "member";

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: string;
}

// Approval Quorum
export type ApprovalStatus = "approved" | "rejected" | "pending";

export interface WritebackApproval {
  id: string;
  requestId: string;
  reviewerId: string;
  status: ApprovalStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalQuorumConfig {
  requiredApprovals: number;
  allowedRoles: WorkspaceRole[];
}

// Real-Time Collaboration
export interface ReviewPresenceState {
  userId: string;
  userEmail?: string;
  focusedFileId?: string;
  isCommenting: boolean;
  lastActive: string;
}

export interface RealtimeReviewSession {
  patchSnapshotId: string;
  activeReviewers: ReviewPresenceState[];
  conflictsDetected: boolean;
}
