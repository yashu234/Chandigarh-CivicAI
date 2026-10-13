import { supabase, isSupabaseConfigured } from './client';
import type {
  ComplaintRow,
  ComplaintInsert,
  ComplaintUpdate,
  DbComplaintStatus,
  AIAssessmentRow,
  ComplaintEvidenceRow,
} from '../../types/database';
import type { Complaint } from '../../types';

/**
 * Complaints Service Repository Layer
 * 
 * Provides an isolated data abstraction for complaint operations.
 * Future phases can call this service without embedding Supabase queries directly in React components.
 */

export const complaintsService = {
  /**
   * Fetches all complaints with sorting
   */
  async getAll(): Promise<{ data: ComplaintRow[] | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      };
    }

    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching complaints') };
    }
  },

  /**
   * Fetches a single complaint by tracking ID or UUID primary key
   */
  async getById(idOrTrackingId: string): Promise<{
    data: {
      complaint: ComplaintRow;
      evidence: ComplaintEvidenceRow[];
      assessment: AIAssessmentRow | null;
    } | null;
    error: Error | null;
  }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      };
    }

    try {
      // Check whether querying by UUID or tracking ID
      const query = supabase
        .from('complaints')
        .select('*, complaint_evidence(*), ai_assessments(*)')
        .or(`id.eq.${idOrTrackingId},tracking_id.eq.${idOrTrackingId}`)
        .maybeSingle();

      const { data, error } = await query;
      if (error) return { data: null, error: new Error(error.message) };
      if (!data) return { data: null, error: new Error('Complaint not found') };

      const evidence = (data.complaint_evidence as unknown as ComplaintEvidenceRow[]) || [];
      const assessments = (data.ai_assessments as unknown as AIAssessmentRow[]) || [];

      return {
        data: {
          complaint: data as unknown as ComplaintRow,
          evidence,
          assessment: assessments[0] || null,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching complaint') };
    }
  },

  /**
   * Fetches complaints submitted by a specific citizen
   */
  async getByCitizenId(citizenId: string): Promise<{ data: ComplaintRow[] | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      };
    }

    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('citizen_id', citizenId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching citizen complaints') };
    }
  },

  /**
   * Fetches the administrator priority queue sorted deterministically by priority_score descending
   */
  async getAdminPriorityQueue(): Promise<{ data: ComplaintRow[] | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      };
    }

    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('priority_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching admin priority queue') };
    }
  },

  /**
   * Creates a new complaint in the database
   */
  async create(complaint: ComplaintInsert): Promise<{ data: ComplaintRow | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
      };
    }

    try {
      const { data, error } = await supabase
        .from('complaints')
        .insert(complaint)
        .select()
        .single();

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error creating complaint') };
    }
  },

  /**
   * Updates complaint status and records a status history entry
   */
  async updateStatus(
    complaintId: string,
    newStatus: DbComplaintStatus,
    adminId?: string,
    note?: string
  ): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured.') };
    }

    try {
      // 1. Fetch current status
      const { data: current, error: fetchErr } = await supabase
        .from('complaints')
        .select('status')
        .eq('id', complaintId)
        .single();

      if (fetchErr) return { error: new Error(fetchErr.message) };

      const oldStatus = current.status;

      // 2. Update complaint table
      const updates: ComplaintUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      };

      const { error: updateErr } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId);

      if (updateErr) return { error: new Error(updateErr.message) };

      // 3. Log history entry
      const { error: histErr } = await supabase.from('complaint_status_history').insert({
        complaint_id: complaintId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: adminId || null,
        note: note || null,
      });

      if (histErr) return { error: new Error(histErr.message) };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error updating status') };
    }
  },

  /**
   * Helper to convert a database row into the existing UI domain model
   */
  mapDbToDomain(
    row: ComplaintRow,
    evidence?: ComplaintEvidenceRow[],
    assessment?: AIAssessmentRow | null
  ): Complaint {
    const toSeverity = (v: number | null): 'critical' | 'high' | 'moderate' | 'low' | 'negligible' => {
      if (v === null) return 'moderate';
      if (v >= 85) return 'critical';
      if (v >= 70) return 'high';
      if (v >= 40) return 'moderate';
      if (v >= 15) return 'low';
      return 'negligible';
    };

    const toSafetyRisk = (v: number | null): 'severe' | 'high' | 'moderate' | 'low' | 'none' => {
      if (v === null) return 'moderate';
      if (v >= 85) return 'severe';
      if (v >= 70) return 'high';
      if (v >= 40) return 'moderate';
      if (v >= 15) return 'low';
      return 'none';
    };

    const toEvidenceSupport = (v: number | null): 'strong' | 'moderate' | 'weak' | 'unsupported' => {
      if (v === null) return 'moderate';
      if (v >= 75) return 'strong';
      if (v >= 45) return 'moderate';
      if (v >= 20) return 'weak';
      return 'unsupported';
    };

    const toImageQuality = (v: number | null): 'high' | 'adequate' | 'blurry' | 'insufficient' => {
      if (v === null) return 'adequate';
      if (v >= 75) return 'high';
      if (v >= 45) return 'adequate';
      if (v >= 20) return 'blurry';
      return 'insufficient';
    };

    const toDescriptionMatch = (v: number | null): 'consistent' | 'partially_consistent' | 'inconsistent' | 'inconclusive' => {
      if (v === null) return 'consistent';
      if (v >= 70) return 'consistent';
      if (v >= 40) return 'partially_consistent';
      if (v >= 15) return 'inconclusive';
      return 'inconsistent';
    };

    const toPublicImpact = (v: number | null): 'widespread' | 'neighborhood' | 'localized' | 'minimal' => {
      if (v === null) return 'localized';
      if (v >= 80) return 'widespread';
      if (v >= 50) return 'neighborhood';
      if (v >= 20) return 'localized';
      return 'minimal';
    };

    return {
      id: row.id,
      trackingNumber: row.tracking_id,
      citizenId: row.citizen_id,
      title: row.title,
      description: row.description,
      category: row.category,
      location: {
        sector: row.sector,
        address: row.street_address || `${row.sector}, Chandigarh`,
        landmark: row.landmark || undefined,
        coordinates:
          row.latitude && row.longitude
            ? { latitude: row.latitude, longitude: row.longitude }
            : undefined,
      },
      imageUrl: evidence && evidence[0] ? evidence[0].storage_path : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      aiAssessment: assessment
        ? {
            detectedIssue: assessment.detected_issue || 'Detected civic defect',
            severity: toSeverity(assessment.severity),
            safetyRisk: toSafetyRisk(assessment.safety_risk),
            evidenceSupport: toEvidenceSupport(assessment.evidence_support),
            evidenceSupportNotes: assessment.reasoning_summary || 'Corroboration logged',
            imageQuality: toImageQuality(assessment.image_quality),
            descriptionImageConsistency: toDescriptionMatch(assessment.description_match),
            publicImpact: toPublicImpact(assessment.public_impact),
            summaryReasoning: assessment.reasoning_summary || '',
            assessedAt: assessment.created_at,
          }
        : undefined,
      priorityCalculation: row.priority_score !== null
        ? {
            baseSeverityScore: Math.min(100, row.priority_score),
            safetyRiskScore: Math.min(100, row.priority_score),
            publicImpactScore: Math.min(100, row.priority_score),
            evidenceSupportWeight: 0.95,
            finalScore: Number(row.priority_score),
            priorityLevel: row.priority_tier,
            explanation: `Computed score ${row.priority_score} for priority tier ${row.priority_tier}.`,
          }
        : undefined,
    };
  },
};
