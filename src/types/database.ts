/**
 * Supabase Database Contracts & Types for Chandigarh CivicAI
 * 
 * Defines PostgreSQL table shapes, Insert/Update contracts, and domain mapping types.
 * Strictly avoids `any` types.
 * 
 * Phase 3 Patch:
 * - AI assessment fields updated to numeric 0–100 scores.
 * - Privilege escalation safeguards reflected in profile types.
 */

export type UserRole = 'citizen' | 'admin';

export type DbComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate';

export type DbPriorityTier = 'critical' | 'high' | 'medium' | 'low';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // UUID references auth.users(id)
          full_name: string;
          mobile_number: string | null;
          sector: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          mobile_number?: string | null;
          sector?: string | null;
          role?: UserRole; // Enforced to 'citizen' by DB trigger on self-registration
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          mobile_number?: string | null;
          sector?: string | null;
          role?: UserRole; // Modifiable only by verified admin
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      complaints: {
        Row: {
          id: string; // UUID
          tracking_id: string; // Unique human-readable (e.g. CHD-2026-00124)
          citizen_id: string; // UUID references profiles(id)
          title: string;
          description: string;
          category: string;
          sector: string;
          landmark: string | null;
          street_address: string | null;
          latitude: number | null;
          longitude: number | null;
          status: DbComplaintStatus;
          priority_tier: DbPriorityTier;
          priority_score: number | null; // 0.00 to 100.00
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          tracking_id?: string;
          citizen_id: string;
          title: string;
          description: string;
          category: string;
          sector: string;
          landmark?: string | null;
          street_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: DbComplaintStatus;
          priority_tier?: DbPriorityTier;
          priority_score?: number | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          tracking_id?: string;
          citizen_id?: string;
          title?: string;
          description?: string;
          category?: string;
          sector?: string;
          landmark?: string | null;
          street_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: DbComplaintStatus;
          priority_tier?: DbPriorityTier;
          priority_score?: number | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'complaints_citizen_id_fkey';
            columns: ['citizen_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };

      complaint_evidence: {
        Row: {
          id: string; // UUID
          complaint_id: string; // UUID references complaints(id)
          storage_path: string; // complaints/{complaint_id}/{uuid}-{filename}
          original_filename: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          storage_path?: string;
          original_filename?: string;
          mime_type?: string;
          file_size?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'complaint_evidence_complaint_id_fkey';
            columns: ['complaint_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          }
        ];
      };

      ai_assessments: {
        Row: {
          id: string; // UUID
          complaint_id: string; // UUID references complaints(id)
          detected_issue: string | null;
          suggested_category: string | null;
          // Numeric 0.00 to 100.00 scores
          severity: number | null;
          safety_risk: number | null;
          evidence_support: number | null;
          image_quality: number | null;
          description_match: number | null;
          public_impact: number | null;
          reasoning_summary: string | null;
          human_review_required: boolean;
          model_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          detected_issue?: string | null;
          suggested_category?: string | null;
          severity?: number | null; // 0.00 to 100.00
          safety_risk?: number | null; // 0.00 to 100.00
          evidence_support?: number | null; // 0.00 to 100.00
          image_quality?: number | null; // 0.00 to 100.00
          description_match?: number | null; // 0.00 to 100.00
          public_impact?: number | null; // 0.00 to 100.00
          reasoning_summary?: string | null;
          human_review_required?: boolean;
          model_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          detected_issue?: string | null;
          suggested_category?: string | null;
          severity?: number | null;
          safety_risk?: number | null;
          evidence_support?: number | null;
          image_quality?: number | null;
          description_match?: number | null;
          public_impact?: number | null;
          reasoning_summary?: string | null;
          human_review_required?: boolean;
          model_version?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_assessments_complaint_id_fkey';
            columns: ['complaint_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          }
        ];
      };

      complaint_status_history: {
        Row: {
          id: string; // UUID
          complaint_id: string; // UUID references complaints(id)
          old_status: string | null;
          new_status: string;
          changed_by: string | null; // UUID references profiles(id)
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          old_status?: string | null;
          new_status: string;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          old_status?: string | null;
          new_status?: string;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'complaint_status_history_complaint_id_fkey';
            columns: ['complaint_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'complaint_status_history_changed_by_fkey';
            columns: ['changed_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };

      admin_actions: {
        Row: {
          id: string; // UUID
          complaint_id: string; // UUID references complaints(id)
          admin_id: string; // UUID references profiles(id)
          action_type: string;
          old_value: string | null;
          new_value: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          admin_id: string;
          action_type: string;
          old_value?: string | null;
          new_value?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          admin_id?: string;
          action_type?: string;
          old_value?: string | null;
          new_value?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_actions_complaint_id_fkey';
            columns: ['complaint_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_actions_admin_id_fkey';
            columns: ['admin_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };

      complaint_duplicates: {
        Row: {
          id: string; // UUID
          complaint_a_id: string; // UUID references complaints(id)
          complaint_b_id: string; // UUID references complaints(id)
          similarity_score: number; // 0.00 to 100.00
          status: 'suggested' | 'dismissed' | 'confirmed_duplicate';
          matching_signals: Record<string, unknown>;
          review_notes: string | null;
          reviewed_by: string | null; // UUID references profiles(id)
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          complaint_a_id: string;
          complaint_b_id: string;
          similarity_score: number;
          status?: 'suggested' | 'dismissed' | 'confirmed_duplicate';
          matching_signals: Record<string, unknown>;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          complaint_a_id?: string;
          complaint_b_id?: string;
          similarity_score?: number;
          status?: 'suggested' | 'dismissed' | 'confirmed_duplicate';
          matching_signals?: Record<string, unknown>;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'complaint_duplicates_complaint_a_id_fkey';
            columns: ['complaint_a_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'complaint_duplicates_complaint_b_id_fkey';
            columns: ['complaint_b_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'complaint_duplicates_reviewed_by_fkey';
            columns: ['reviewed_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          complaint_id: string | null;
          notification_type:
            | 'complaint_submitted'
            | 'status_changed'
            | 'assigned'
            | 'resolved'
            | 'duplicate_confirmed'
            | 'municipal_update';
          title: string;
          message: string;
          read_at: string | null;
          created_at: string;
          metadata: Record<string, unknown>;
          event_key: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          complaint_id?: string | null;
          notification_type:
            | 'complaint_submitted'
            | 'status_changed'
            | 'assigned'
            | 'resolved'
            | 'duplicate_confirmed'
            | 'municipal_update';
          title: string;
          message: string;
          read_at?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown>;
          event_key?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          complaint_id?: string | null;
          notification_type?:
            | 'complaint_submitted'
            | 'status_changed'
            | 'assigned'
            | 'resolved'
            | 'duplicate_confirmed'
            | 'municipal_update';
          title?: string;
          message?: string;
          read_at?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown>;
          event_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_complaint_id_fkey';
            columns: ['complaint_id'];
            referencedRelation: 'complaints';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      provision_admin: {
        Args: {
          target_user_id: string;
          full_name: string;
          mobile_number?: string | null;
          sector?: string | null;
        };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      next_complaint_tracking_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenient row type aliases
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type ComplaintRow = Database['public']['Tables']['complaints']['Row'];
export type ComplaintInsert = Database['public']['Tables']['complaints']['Insert'];
export type ComplaintUpdate = Database['public']['Tables']['complaints']['Update'];

export type ComplaintEvidenceRow = Database['public']['Tables']['complaint_evidence']['Row'];
export type ComplaintEvidenceInsert = Database['public']['Tables']['complaint_evidence']['Insert'];

export type AIAssessmentRow = Database['public']['Tables']['ai_assessments']['Row'];
export type AIAssessmentInsert = Database['public']['Tables']['ai_assessments']['Insert'];

export type ComplaintStatusHistoryRow = Database['public']['Tables']['complaint_status_history']['Row'];
export type ComplaintStatusHistoryInsert = Database['public']['Tables']['complaint_status_history']['Insert'];

export type AdminActionRow = Database['public']['Tables']['admin_actions']['Row'];
export type AdminActionInsert = Database['public']['Tables']['admin_actions']['Insert'];

export type ComplaintDuplicateRow = Database['public']['Tables']['complaint_duplicates']['Row'];
export type ComplaintDuplicateInsert = Database['public']['Tables']['complaint_duplicates']['Insert'];
export type ComplaintDuplicateUpdate = Database['public']['Tables']['complaint_duplicates']['Update'];

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

