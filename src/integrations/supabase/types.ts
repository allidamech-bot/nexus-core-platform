export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_email_allowlist: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          project_id: string | null;
          severity: string;
          thread_id: string | null;
          user_id: string | null;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          project_id?: string | null;
          severity?: string;
          thread_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          project_id?: string | null;
          severity?: string;
          thread_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_plans: {
        Row: {
          created_at: string;
          id: string;
          monthly_price_cents: number | null;
          name: string;
          status: string;
          stripe_price_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          monthly_price_cents?: number | null;
          name: string;
          status?: string;
          stripe_price_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          monthly_price_cents?: number | null;
          name?: string;
          status?: string;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_usage_limits: {
        Row: {
          created_at: string;
          max_active_threads: number | null;
          max_ai_requests_monthly: number | null;
          max_chat_context_previews: number | null;
          max_context_payload_bytes: number | null;
          max_context_previews: number | null;
          max_indexed_preview_bytes: number | null;
          max_projects: number | null;
          max_text_preview_files: number | null;
          max_upload_mb: number | null;
          max_uploads_monthly: number | null;
          plan_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          max_active_threads?: number | null;
          max_ai_requests_monthly?: number | null;
          max_chat_context_previews?: number | null;
          max_context_payload_bytes?: number | null;
          max_context_previews?: number | null;
          max_indexed_preview_bytes?: number | null;
          max_projects?: number | null;
          max_text_preview_files?: number | null;
          max_upload_mb?: number | null;
          max_uploads_monthly?: number | null;
          plan_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          max_active_threads?: number | null;
          max_ai_requests_monthly?: number | null;
          max_chat_context_previews?: number | null;
          max_context_payload_bytes?: number | null;
          max_context_previews?: number | null;
          max_indexed_preview_bytes?: number | null;
          max_projects?: number | null;
          max_text_preview_files?: number | null;
          max_upload_mb?: number | null;
          max_uploads_monthly?: number | null;
          plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_usage_limits_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: true;
            referencedRelation: "billing_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      project_files: {
        Row: {
          checksum: string | null;
          content_sha256: string | null;
          created_at: string;
          extension: string | null;
          id: string;
          indexed_at: string | null;
          ingestion_job_id: string | null;
          is_previewable: boolean;
          is_text: boolean;
          mime_type: string | null;
          name: string;
          path: string;
          project_id: string;
          skip_reason: string | null;
          skipped: boolean;
          size_bytes: number | null;
          user_id: string;
        };
        Insert: {
          checksum?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          extension?: string | null;
          id?: string;
          indexed_at?: string | null;
          ingestion_job_id?: string | null;
          is_previewable?: boolean;
          is_text?: boolean;
          mime_type?: string | null;
          name: string;
          path: string;
          project_id: string;
          skip_reason?: string | null;
          skipped?: boolean;
          size_bytes?: number | null;
          user_id: string;
        };
        Update: {
          checksum?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          extension?: string | null;
          id?: string;
          indexed_at?: string | null;
          ingestion_job_id?: string | null;
          is_previewable?: boolean;
          is_text?: boolean;
          mime_type?: string | null;
          name?: string;
          path?: string;
          project_id?: string;
          skip_reason?: string | null;
          skipped?: boolean;
          size_bytes?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_files_ingestion_job_id_fkey";
            columns: ["ingestion_job_id"];
            isOneToOne: false;
            referencedRelation: "project_ingestion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_ingestion_jobs: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          metadata: Json;
          project_id: string;
          stage: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          project_id: string;
          stage?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json;
          project_id?: string;
          stage?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_ingestion_jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_patch_previews: {
        Row: {
          created_at: string;
          created_by: string;
          diff: Json;
          grounded_files: Json;
          id: string;
          ingestion_job_id: string | null;
          metadata: Json;
          project_id: string;
          source: string;
          status: string;
          summary: string | null;
          title: string | null;
          updated_at: string;
          warnings: Json;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          diff?: Json;
          grounded_files?: Json;
          id?: string;
          ingestion_job_id?: string | null;
          metadata?: Json;
          project_id: string;
          source?: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          warnings?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          diff?: Json;
          grounded_files?: Json;
          id?: string;
          ingestion_job_id?: string | null;
          metadata?: Json;
          project_id?: string;
          source?: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
          updated_at?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "project_patch_previews_ingestion_job_id_fkey";
            columns: ["ingestion_job_id"];
            isOneToOne: false;
            referencedRelation: "project_ingestion_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_patch_previews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_patch_snapshot_files: {
        Row: {
          blockers: Json;
          changed: boolean;
          created_at: string;
          file_path: string;
          id: string;
          original_content_sha256: string | null;
          original_preview_text: string | null;
          patched_content_sha256: string | null;
          patched_preview_text: string | null;
          patch_preview_id: string;
          preview_limited: boolean;
          project_id: string;
          snapshot_id: string;
          truncated: boolean;
          warnings: Json;
        };
        Insert: {
          blockers?: Json;
          changed?: boolean;
          created_at?: string;
          file_path: string;
          id?: string;
          original_content_sha256?: string | null;
          original_preview_text?: string | null;
          patched_content_sha256?: string | null;
          patched_preview_text?: string | null;
          patch_preview_id: string;
          preview_limited?: boolean;
          project_id: string;
          snapshot_id: string;
          truncated?: boolean;
          warnings?: Json;
        };
        Update: {
          blockers?: Json;
          changed?: boolean;
          created_at?: string;
          file_path?: string;
          id?: string;
          original_content_sha256?: string | null;
          original_preview_text?: string | null;
          patched_content_sha256?: string | null;
          patched_preview_text?: string | null;
          patch_preview_id?: string;
          preview_limited?: boolean;
          project_id?: string;
          snapshot_id?: string;
          truncated?: boolean;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "project_patch_snapshot_files_patch_preview_id_fkey";
            columns: ["patch_preview_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_previews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_patch_snapshot_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_patch_snapshot_files_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      project_patch_snapshots: {
        Row: {
          blockers: Json;
          changed_files_count: number;
          created_at: string;
          created_by: string;
          id: string;
          metadata: Json;
          patch_preview_id: string;
          project_id: string;
          source: string;
          status: string;
          summary: string | null;
          title: string | null;
          verification_status: string;
          warnings: Json;
        };
        Insert: {
          blockers?: Json;
          changed_files_count?: number;
          created_at?: string;
          created_by: string;
          id?: string;
          metadata?: Json;
          patch_preview_id: string;
          project_id: string;
          source?: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
          verification_status: string;
          warnings?: Json;
        };
        Update: {
          blockers?: Json;
          changed_files_count?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          metadata?: Json;
          patch_preview_id?: string;
          project_id?: string;
          source?: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
          verification_status?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "project_patch_snapshots_patch_preview_id_fkey";
            columns: ["patch_preview_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_previews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_patch_snapshots_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_working_copies: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          metadata: Json;
          project_id: string;
          request_id: string;
          snapshot_id: string;
          status: string;
          summary: string | null;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          metadata?: Json;
          project_id: string;
          request_id: string;
          snapshot_id: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          metadata?: Json;
          project_id?: string;
          request_id?: string;
          snapshot_id?: string;
          status?: string;
          summary?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_working_copies_patch_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_working_copies_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_working_copies_writeback_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "project_writeback_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      project_working_copy_files: {
        Row: {
          blockers: Json;
          changed: boolean;
          created_at: string;
          file_path: string;
          id: string;
          original_preview_text: string | null;
          project_id: string;
          warnings: Json;
          working_copy_id: string;
          working_copy_text: string | null;
        };
        Insert: {
          blockers?: Json;
          changed?: boolean;
          created_at?: string;
          file_path: string;
          id?: string;
          original_preview_text?: string | null;
          project_id: string;
          warnings?: Json;
          working_copy_id: string;
          working_copy_text?: string | null;
        };
        Update: {
          blockers?: Json;
          changed?: boolean;
          created_at?: string;
          file_path?: string;
          id?: string;
          original_preview_text?: string | null;
          project_id?: string;
          warnings?: Json;
          working_copy_id?: string;
          working_copy_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_working_copy_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_working_copy_files_working_copy_id_fkey";
            columns: ["working_copy_id"];
            isOneToOne: false;
            referencedRelation: "project_working_copies";
            referencedColumns: ["id"];
          },
        ];
      };
      project_writeback_requests: {
        Row: {
          blockers: Json;
          changed_files_count: number;
          created_at: string;
          current_approvals: number;
          id: string;
          metadata: Json;
          patch_preview_id: string;
          project_id: string;
          requested_by: string;
          requester_note: string | null;
          required_approvals: number;
          review_decision: string | null;
          review_metadata: Json;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewer_note: string | null;
          risk_level: string;
          snapshot_id: string;
          snapshot_summary: Json;
          status: string;
          submitted_at: string | null;
          title: string | null;
          updated_at: string;
          warnings: Json;
        };
        Insert: {
          blockers?: Json;
          changed_files_count?: number;
          created_at?: string;
          current_approvals?: number;
          id?: string;
          metadata?: Json;
          patch_preview_id: string;
          project_id: string;
          requested_by: string;
          requester_note?: string | null;
          required_approvals?: number;
          review_decision?: string | null;
          review_metadata?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_note?: string | null;
          risk_level?: string;
          snapshot_id: string;
          snapshot_summary?: Json;
          status?: string;
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string;
          warnings?: Json;
        };
        Update: {
          blockers?: Json;
          changed_files_count?: number;
          created_at?: string;
          current_approvals?: number;
          id?: string;
          metadata?: Json;
          patch_preview_id?: string;
          project_id?: string;
          requested_by?: string;
          requester_note?: string | null;
          required_approvals?: number;
          review_decision?: string | null;
          review_metadata?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_note?: string | null;
          risk_level?: string;
          snapshot_id?: string;
          snapshot_summary?: Json;
          status?: string;
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "project_writeback_requests_patch_preview_id_fkey";
            columns: ["patch_preview_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_previews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_writeback_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_writeback_requests_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "project_patch_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      project_security_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          project_id: string | null;
          severity: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          project_id?: string | null;
          severity: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          project_id?: string | null;
          severity?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_security_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_text_previews: {
        Row: {
          created_at: string;
          detected_language: string | null;
          file_id: string;
          id: string;
          indexed_at: string;
          line_count: number;
          metadata: Json;
          preview_text: string;
          project_id: string;
          summary: string;
          token_estimate: number;
          truncated: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          detected_language?: string | null;
          file_id: string;
          id?: string;
          indexed_at?: string;
          line_count?: number;
          metadata?: Json;
          preview_text: string;
          project_id: string;
          summary: string;
          token_estimate?: number;
          truncated?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          detected_language?: string | null;
          file_id?: string;
          id?: string;
          indexed_at?: string;
          line_count?: number;
          metadata?: Json;
          preview_text?: string;
          project_id?: string;
          summary?: string;
          token_estimate?: number;
          truncated?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_text_previews_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "project_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_text_previews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          source_type: string;
          status: string;
          updated_at: string;
          user_id: string;
          github_installation_id: string | null;
          github_repo_full_name: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          github_installation_id?: string | null;
          github_repo_full_name?: string | null;
          id?: string;
          name: string;
          organization_id?: string | null;
          source_type?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          github_installation_id?: string | null;
          github_repo_full_name?: string | null;
          id?: string;
          name?: string;
          organization_id?: string | null;
          source_type?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      thread_context_selections: {
        Row: {
          action: string;
          created_at: string;
          current_approvals: number;
          file_id: string | null;
          id: string;
          metadata: Json;
          pipeline: string | null;
          preview_id: string | null;
          project_id: string;
          required_approvals: number;
          status: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          current_approvals?: number;
          file_id?: string | null;
          id?: string;
          metadata?: Json;
          pipeline?: string | null;
          preview_id?: string | null;
          project_id: string;
          required_approvals?: number;
          status?: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          current_approvals?: number;
          file_id?: string | null;
          id?: string;
          metadata?: Json;
          pipeline?: string | null;
          preview_id?: string | null;
          project_id?: string;
          required_approvals?: number;
          status?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_context_selections_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "project_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_context_selections_preview_id_fkey";
            columns: ["preview_id"];
            isOneToOne: false;
            referencedRelation: "project_text_previews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_context_selections_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_context_selections_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          id: string;
          mode: string;
          project_id: string | null;
          project_name: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          id?: string;
          mode?: string;
          project_id?: string | null;
          project_name?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          id?: string;
          mode?: string;
          project_id?: string | null;
          project_name?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "threads_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_daily_snapshots: {
        Row: {
          created_at: string;
          id: string;
          metrics: Json;
          plan_id: string;
          snapshot_date: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metrics?: Json;
          plan_id: string;
          snapshot_date: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metrics?: Json;
          plan_id?: string;
          snapshot_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_daily_snapshots_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "billing_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          project_id: string | null;
          quantity: number;
          size_bytes: number;
          thread_id: string | null;
          token_estimate: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          project_id?: string | null;
          quantity?: number;
          size_bytes?: number;
          thread_id?: string | null;
          token_estimate?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          project_id?: string | null;
          quantity?: number;
          size_bytes?: number;
          thread_id?: string | null;
          token_estimate?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_events_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: {
          billing_status: string;
          created_at: string;
          current_period_end: string | null;
          plan_id: string;
          status: string;
          updated_at: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
        };
        Insert: {
          billing_status?: string;
          created_at?: string;
          current_period_end?: string | null;
          plan_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: {
          billing_status?: string;
          created_at?: string;
          current_period_end?: string | null;
          plan_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "billing_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      user_github_installations: {
        Row: {
          id: string;
          user_id: string;
          installation_id: string;
          account_login: string;
          account_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          installation_id: string;
          account_login: string;
          account_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          installation_id?: string;
          account_login?: string;
          account_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          role: string;
          token: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          role: string;
          token: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role?: string;
          token?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      writeback_approvals: {
        Row: {
          id: string;
          request_id: string;
          reviewer_id: string;
          decision: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          reviewer_id: string;
          decision: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          reviewer_id?: string;
          decision?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "writeback_approvals_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "project_writeback_requests";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_effective_plan_id: {
        Args: { check_user_id?: string };
        Returns: string;
      };
      get_plan_limit: {
        Args: { check_user_id: string; limit_key: string };
        Returns: number;
      };
      get_usage_total: {
        Args: { check_user_id: string; metric_name: string; since_at?: string };
        Returns: number;
      };
      is_admin: { Args: { check_user_id?: string }; Returns: boolean };
      is_within_usage_limit: {
        Args: { check_user_id: string; increment?: number; limit_key: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
