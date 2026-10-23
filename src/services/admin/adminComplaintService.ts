/**
 * Chandigarh CivicAI — Administrator Review & Civic Triage Service
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Authoritative Backend Validation: All administrative mutations verify the
 *    authenticated Supabase session against public.profiles.role = 'admin'.
 * 2. Immutable Audit Logging: Every status change and manual priority override
 *    records persistent audit entries in complaint_status_history and admin_actions.
 * 3. Preservation of AI & Priority: Manual priority overrides do NOT overwrite
 *    or destroy the underlying deterministic Phase 8 calculation or AI assessment.
 */

import { supabase, isSupabaseConfigured } from '../supabase/client.ts';
import type {
  ComplaintEvidenceRow,
  AIAssessmentRow,
  AdminActionRow,
  ComplaintUpdate,
  DbComplaintStatus,
  DbPriorityTier,
} from '../../types/database.ts';
import type {
  Complaint,
  ComplaintStatus,
  PriorityLevel,
  StatusHistoryEvent,
} from '../../types/index.ts';
import type { PriorityTier, PriorityCalculationResult } from '../priority/priorityTypes.ts';
import { calculatePriorityFromAIAssessment, determinePriorityTier } from '../priority/priorityEngine.ts';
import { validateStatusTransition } from './statusWorkflow.ts';
import { createSignedEvidenceUrl } from '../evidenceService.ts';
import type {
  DuplicateCandidateSummary,
  RecurrenceSignal,
} from '../duplicates/duplicateTypes.ts';
import {
  getDuplicateSuggestionsForComplaint,
  calculateSectorRecurrenceSignal,
} from '../duplicates/duplicateDetectionService.ts';
import { createNotification } from '../notifications/notificationService.ts';
import {
  getCitizenSafeNotificationTitle,
  getCitizenSafeStatusMessage,
} from '../notifications/citizenSafeMessages.ts';
import type { NotificationType } from '../notifications/notificationTypes.ts';
import {
  triggerComplaintAnalysis,
  type AssessmentFetchResult,
} from '../ai/aiAssessmentService.ts';

export interface AdminMetrics {
  total: number;
  submitted: number;
  underReview: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  criticalPriority: number;
  highPriority: number;
  humanReviewRequired: number;
}

export interface AdminComplaintFilters {
  searchQuery?: string;
  category?: string;
  status?: string;
  priorityTier?: string;
  sector?: string;
  humanReviewRequiredOnly?: boolean;
}

export interface AdminActionRecord {
  id: string;
  complaintId: string;
  adminId: string;
  adminName?: string;
  actionType: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminComplaintDetailResult {
  complaint: Complaint;
  evidence: ComplaintEvidenceRow | null;
  evidenceSignedUrl: string | null;
  assessment: AIAssessmentRow | null;
  priorityResult: PriorityCalculationResult;
  statusHistory: StatusHistoryEvent[];
  adminActions: AdminActionRecord[];
  isOverridden: boolean;
  activePriorityTier: PriorityTier | null;
  calculatedPriorityTier: PriorityTier | null;
  calculatedPriorityScore: number | null;
  overrideRecord: AdminActionRecord | null;
  duplicateSuggestions: DuplicateCandidateSummary[];
  recurrenceSignal: RecurrenceSignal | null;
}

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

/**
 * Verifies that the current active session belongs to an authorized administrator.
 * Authoritative check against public.profiles.role = 'admin'.
 */
export async function verifyAdminSession(): Promise<{ userId: string; fullName: string }> {
  if (!isSupabaseConfigured()) {
    throw new AdminAuthError('Supabase client is not configured.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AdminAuthError('Authentication required. Please sign in as an administrator.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new AdminAuthError('Failed to verify user profile.');
  }

  if (profile.role !== 'admin') {
    throw new AdminAuthError('Access denied: User does not possess the administrative role.');
  }

  return { userId: user.id, fullName: profile.full_name || 'Administrator' };
}

/**
 * Priority Tier sorting weight (higher number = higher triage urgency).
 */
function getPriorityTierRank(tier: PriorityLevel | string | null | undefined): number {
  switch (tier) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0; // null or pending
  }
}

/**
 * Fetches real municipal intake metrics from live Supabase tables.
 */
export async function getLiveAdminMetrics(): Promise<{
  data: AdminMetrics | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      data: {
        total: 0,
        submitted: 0,
        underReview: 0,
        assigned: 0,
        inProgress: 0,
        resolved: 0,
        rejected: 0,
        criticalPriority: 0,
        highPriority: 0,
        humanReviewRequired: 0,
      },
      error: null,
    };
  }

  try {
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('id, status, priority_tier');

    if (complaintsError) throw complaintsError;

    const { data: assessments, error: assessmentsError } = await supabase
      .from('ai_assessments')
      .select('complaint_id, human_review_required');

    if (assessmentsError) throw assessmentsError;

    const humanReviewComplaintIds = new Set(
      (assessments || [])
        .filter((a) => a.human_review_required)
        .map((a) => a.complaint_id)
    );

    const metrics: AdminMetrics = {
      total: complaints?.length ?? 0,
      submitted: 0,
      underReview: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
      criticalPriority: 0,
      highPriority: 0,
      humanReviewRequired: humanReviewComplaintIds.size,
    };

    if (complaints) {
      for (const c of complaints) {
        if (c.status === 'submitted') metrics.submitted++;
        else if (c.status === 'under_review') metrics.underReview++;
        else if (c.status === 'assigned') metrics.assigned++;
        else if (c.status === 'in_progress') metrics.inProgress++;
        else if (c.status === 'resolved') metrics.resolved++;
        else if (c.status === 'rejected' || c.status === 'duplicate') metrics.rejected++;

        if (c.priority_tier === 'critical') metrics.criticalPriority++;
        else if (c.priority_tier === 'high') metrics.highPriority++;
      }
    }

    return { data: metrics, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches live complaints for the administrator priority queue.
 * Orders strictly: Critical -> High -> Medium -> Low -> Pending, newest first.
 */
export async function getLiveAdminComplaints(
  filters?: AdminComplaintFilters
): Promise<{
  data: Complaint[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  try {
    // 1. Fetch complaints
    let query = supabase.from('complaints').select('*');

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as DbComplaintStatus);
    }
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters?.sector && filters.sector !== 'all') {
      query = query.eq('sector', filters.sector);
    }
    if (filters?.priorityTier && filters.priorityTier !== 'all') {
      query = query.eq('priority_tier', filters.priorityTier as DbPriorityTier);
    }

    const { data: complaintRows, error: complaintsError } = await query;
    if (complaintsError) throw complaintsError;

    if (!complaintRows || complaintRows.length === 0) {
      return { data: [], error: null };
    }

    const complaintIds = complaintRows.map((c) => c.id);

    // 2. Fetch evidence metadata
    const { data: allEvidence } = await supabase
      .from('complaint_evidence')
      .select('*')
      .in('complaint_id', complaintIds);

    const evidenceMap = new Map<string, ComplaintEvidenceRow>();
    if (allEvidence) {
      for (const ev of allEvidence) {
        evidenceMap.set(ev.complaint_id, ev);
      }
    }

    // 3. Fetch AI assessments
    const { data: allAssessments } = await supabase
      .from('ai_assessments')
      .select('*')
      .in('complaint_id', complaintIds);

    const assessmentMap = new Map<string, AIAssessmentRow>();
    if (allAssessments) {
      for (const ass of allAssessments) {
        assessmentMap.set(ass.complaint_id, ass);
      }
    }

    // 4. Fetch latest priority overrides from admin_actions
    const { data: allOverrides } = await supabase
      .from('admin_actions')
      .select('*')
      .in('complaint_id', complaintIds)
      .eq('action_type', 'priority_override')
      .order('created_at', { ascending: false });

    const overrideMap = new Map<string, AdminActionRow>();
    if (allOverrides) {
      for (const ov of allOverrides) {
        // First encountered is the newest valid override because of created_at DESC order
        if (!overrideMap.has(ov.complaint_id)) {
          overrideMap.set(ov.complaint_id, ov);
        }
      }
    }

    // 4b. Fetch pending duplicate suggestions for advisory badges
    const { data: allDuplicates } = await supabase
      .from('complaint_duplicates')
      .select('complaint_a_id, complaint_b_id')
      .eq('status', 'suggested');

    const duplicateCountMap = new Map<string, number>();
    if (allDuplicates) {
      for (const d of allDuplicates) {
        duplicateCountMap.set(d.complaint_a_id, (duplicateCountMap.get(d.complaint_a_id) || 0) + 1);
        duplicateCountMap.set(d.complaint_b_id, (duplicateCountMap.get(d.complaint_b_id) || 0) + 1);
      }
    }

    // 5. Transform to domain models
    const complaints: Complaint[] = complaintRows.map((row) => {
      const assessmentRow = assessmentMap.get(row.id);
      const priorityResult = calculatePriorityFromAIAssessment(assessmentRow);
      const latestOverride = overrideMap.get(row.id);

      const calculatedScore =
        row.priority_score !== null && row.priority_score !== undefined
          ? Number(row.priority_score)
          : priorityResult.status === 'calculated'
          ? priorityResult.score
          : null;

      const calculatedTier =
        priorityResult.status === 'calculated' && priorityResult.tier
          ? (priorityResult.tier as PriorityLevel)
          : calculatedScore !== null
          ? (determinePriorityTier(calculatedScore) as PriorityLevel)
          : null;

      let isPriorityOverridden = false;
      let effectivePriorityTier: PriorityLevel | null = null;
      let priorityOverrideReason: string | null = null;
      let priorityOverrideAdminId: string | null = null;
      let priorityOverrideAt: string | null = null;

      if (latestOverride && latestOverride.new_value) {
        isPriorityOverridden = true;
        effectivePriorityTier = latestOverride.new_value as PriorityLevel;
        priorityOverrideReason = latestOverride.reason;
        priorityOverrideAdminId = latestOverride.admin_id;
        priorityOverrideAt = latestOverride.created_at;
      } else if (
        calculatedTier !== null &&
        row.priority_tier &&
        row.priority_tier !== calculatedTier
      ) {
        isPriorityOverridden = true;
        effectivePriorityTier = row.priority_tier as PriorityLevel;
        priorityOverrideReason = 'Adjusted by authorized municipal review';
        priorityOverrideAt = row.updated_at;
      } else {
        isPriorityOverridden = false;
        effectivePriorityTier = calculatedTier ?? (row.priority_tier as PriorityLevel | null);
      }

      return {
        id: row.id,
        trackingNumber: row.tracking_id,
        citizenId: row.citizen_id,
        title: row.title,
        description: row.description,
        category: row.category,
        location: {
          sector: row.sector,
          landmark: row.landmark ?? undefined,
          address: row.street_address || row.sector,
          coordinates:
            row.latitude && row.longitude
              ? { latitude: row.latitude, longitude: row.longitude }
              : undefined,
        },
        imageUrl: undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status as ComplaintStatus,
        priorityScore: calculatedScore,
        priorityTier: effectivePriorityTier,
        aiAnalysisState: assessmentRow ? 'completed' : 'pending',
        calculatedPriorityScore: calculatedScore,
        calculatedPriorityTier: calculatedTier,
        effectivePriorityTier,
        isPriorityOverridden,
        priorityOverrideReason,
        priorityOverrideAdminId,
        priorityOverrideAt,
        hasDuplicateAdvisory: (duplicateCountMap.get(row.id) || 0) > 0,
        duplicateCandidateCount: duplicateCountMap.get(row.id) || 0,
      };
    });

    // 5. Apply client search filter if provided
    let filtered = complaints;
    if (filters?.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.trackingNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.location.sector.toLowerCase().includes(q)
      );
    }

    if (filters?.humanReviewRequiredOnly) {
      filtered = filtered.filter((c) => {
        const ass = assessmentMap.get(c.id);
        return Boolean(ass?.human_review_required);
      });
    }

    // 6. Authoritative Queue Sorting:
    // Order: Critical (4) -> High (3) -> Medium (2) -> Low (1) -> Pending (0)
    // Secondary: Score descending
    // Tertiary: Submission date newest first (created_at DESC)
    filtered.sort((a, b) => {
      const rankA = getPriorityTierRank(a.priorityTier);
      const rankB = getPriorityTierRank(b.priorityTier);

      if (rankB !== rankA) {
        return rankB - rankA;
      }

      const scoreA = a.priorityScore ?? -1;
      const scoreB = b.priorityScore ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { data: filtered, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Loads comprehensive complaint details for administrative triage.
 */
export async function getAdminComplaintDetails(
  idOrTracking: string
): Promise<{
  data: AdminComplaintDetailResult | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrTracking);

    let query = supabase.from('complaints').select('*');
    if (isUuid) {
      query = query.eq('id', idOrTracking);
    } else {
      query = query.eq('tracking_id', idOrTracking);
    }

    const { data: complaintRow, error: complaintError } = await query.maybeSingle();
    if (complaintError) throw complaintError;
    if (!complaintRow) return { data: null, error: null };

    // Fetch evidence record
    const { data: evidenceRow } = await supabase
      .from('complaint_evidence')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .maybeSingle();

    let signedUrl: string | null = null;
    if (evidenceRow?.storage_path) {
      const { signedUrl: sUrl } = await createSignedEvidenceUrl(evidenceRow.storage_path, 3600);
      signedUrl = sUrl;
    }

    // Fetch AI assessment
    const { data: assessmentRow } = await supabase
      .from('ai_assessments')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .maybeSingle();

    // Compute deterministic priority
    const priorityResult = calculatePriorityFromAIAssessment(assessmentRow);

    // Fetch status history
    const { data: historyRows } = await supabase
      .from('complaint_status_history')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .order('created_at', { ascending: false });

    const statusHistory: StatusHistoryEvent[] = (historyRows || []).map((h) => ({
      status: h.new_status as ComplaintStatus,
      timestamp: h.created_at,
      actor: h.changed_by ? 'Municipal Officer' : 'System Intake',
      notes: h.note ?? undefined,
    }));

    // Fetch admin action audit logs
    const { data: actionRows } = await supabase
      .from('admin_actions')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .order('created_at', { ascending: false });

    const adminActions: AdminActionRecord[] = (actionRows || []).map((a) => ({
      id: a.id,
      complaintId: a.complaint_id,
      adminId: a.admin_id,
      actionType: a.action_type,
      oldValue: a.old_value,
      newValue: a.new_value,
      reason: a.reason,
      createdAt: a.created_at,
    }));

    // Check for existing priority override
    const latestOverride = adminActions.find((a) => a.actionType === 'priority_override') || null;

    const calculatedPriorityScore =
      complaintRow.priority_score !== null && complaintRow.priority_score !== undefined
        ? Number(complaintRow.priority_score)
        : priorityResult.score;

    const calculatedPriorityTier: PriorityTier | null =
      priorityResult.status === 'calculated' && priorityResult.tier
        ? priorityResult.tier
        : calculatedPriorityScore !== null
        ? determinePriorityTier(calculatedPriorityScore)
        : null;

    let isOverridden = false;
    let activePriorityTier: PriorityTier | null = null;

    if (latestOverride && latestOverride.newValue) {
      isOverridden = true;
      activePriorityTier = latestOverride.newValue as PriorityTier;
    } else if (
      calculatedPriorityTier !== null &&
      complaintRow.priority_tier &&
      complaintRow.priority_tier !== calculatedPriorityTier
    ) {
      isOverridden = true;
      activePriorityTier = complaintRow.priority_tier as PriorityTier;
    } else {
      isOverridden = false;
      activePriorityTier = calculatedPriorityTier ?? (complaintRow.priority_tier as PriorityTier | null);
    }

    // Phase 10: Fetch duplicate candidate suggestions
    const { data: duplicateSuggestions } = await getDuplicateSuggestionsForComplaint(complaintRow.id);

    // Phase 10: Compute sector recurrence signal (60-day rolling window)
    const { data: priorSectorRows } = await supabase
      .from('complaints')
      .select('id, sector, category, created_at')
      .eq('sector', complaintRow.sector)
      .eq('category', complaintRow.category);

    const recurrenceSignal = calculateSectorRecurrenceSignal(
      complaintRow.sector,
      complaintRow.category,
      complaintRow.created_at,
      (priorSectorRows || []).map((r) => ({
        id: r.id,
        sector: r.sector,
        category: r.category,
        createdAt: r.created_at,
      })),
      complaintRow.id
    );

    const complaint: Complaint = {
      id: complaintRow.id,
      trackingNumber: complaintRow.tracking_id,
      citizenId: complaintRow.citizen_id,
      title: complaintRow.title,
      description: complaintRow.description,
      category: complaintRow.category,
      location: {
        sector: complaintRow.sector,
        landmark: complaintRow.landmark ?? undefined,
        address: complaintRow.street_address || complaintRow.sector,
        coordinates:
          complaintRow.latitude && complaintRow.longitude
            ? { latitude: complaintRow.latitude, longitude: complaintRow.longitude }
            : undefined,
      },
      imageUrl: signedUrl || undefined,
      createdAt: complaintRow.created_at,
      updatedAt: complaintRow.updated_at,
      status: complaintRow.status as ComplaintStatus,
      priorityScore: calculatedPriorityScore,
      priorityTier: activePriorityTier as PriorityLevel,
      aiAnalysisState: assessmentRow ? 'completed' : 'pending',
      statusHistory,
      calculatedPriorityScore,
      calculatedPriorityTier: calculatedPriorityTier as PriorityLevel,
      effectivePriorityTier: activePriorityTier as PriorityLevel,
      isPriorityOverridden: isOverridden,
      priorityOverrideReason: latestOverride?.reason ?? (isOverridden ? 'Adjusted by authorized municipal review' : null),
      priorityOverrideAdminId: latestOverride?.adminId ?? null,
      priorityOverrideAt: latestOverride?.createdAt ?? null,
      hasDuplicateAdvisory: (duplicateSuggestions || []).some((s) => s.candidate.status === 'suggested'),
      duplicateCandidateCount: (duplicateSuggestions || []).filter((s) => s.candidate.status === 'suggested').length,
    };

    return {
      data: {
        complaint,
        evidence: evidenceRow,
        evidenceSignedUrl: signedUrl,
        assessment: assessmentRow,
        priorityResult,
        statusHistory,
        adminActions,
        isOverridden,
        activePriorityTier,
        calculatedPriorityTier,
        calculatedPriorityScore,
        overrideRecord: latestOverride,
        duplicateSuggestions: duplicateSuggestions || [],
        recurrenceSignal,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Transitions complaint status with atomic status history and admin action audit logging.
 */
export async function transitionComplaintStatus(
  complaintId: string,
  targetStatus: ComplaintStatus,
  note?: string | null
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId } = await verifyAdminSession();

    // 1. Fetch current status and complaint details
    const { data: complaint, error: fetchErr } = await supabase
      .from('complaints')
      .select('id, tracking_id, citizen_id, title, status, sector')
      .eq('id', complaintId)
      .single();

    if (fetchErr || !complaint) {
      throw new Error('Complaint not found.');
    }

    const currentStatus = complaint.status as ComplaintStatus;

    // 2. Validate transition through authoritative state machine
    validateStatusTransition(currentStatus, targetStatus, note);

    // 3. Update complaints table
    const updatePayload: ComplaintUpdate = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
      ...(targetStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    };

    const { error: updateErr } = await supabase
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId);

    if (updateErr) throw updateErr;

    // 4. Insert status history record
    const { error: historyErr } = await supabase.from('complaint_status_history').insert({
      complaint_id: complaintId,
      old_status: currentStatus,
      new_status: targetStatus,
      changed_by: userId,
      note: note?.trim() || null,
    });

    if (historyErr) {
      console.warn('[adminComplaintService] Warning recording status history:', historyErr);
    }

    // 5. Insert admin action audit log
    const { error: actionErr } = await supabase.from('admin_actions').insert({
      complaint_id: complaintId,
      admin_id: userId,
      action_type: 'status_change',
      old_value: currentStatus,
      new_value: targetStatus,
      reason: note?.trim() || null,
    });

    if (actionErr) {
      console.warn('[adminComplaintService] Warning recording admin action:', actionErr);
    }

    // 6. Phase 11: Idempotent citizen notification for meaningful status transition
    if (complaint.citizen_id && targetStatus !== currentStatus) {
      let notificationType: NotificationType = 'status_changed';
      if (targetStatus === 'assigned') {
        notificationType = 'assigned';
      } else if (targetStatus === 'resolved') {
        notificationType = 'resolved';
      } else if (targetStatus === 'duplicate') {
        notificationType = 'duplicate_confirmed';
      }

      const safeTitle = `${getCitizenSafeNotificationTitle(targetStatus)} (${complaint.tracking_id || 'Ref'})`;
      const safeMessage = getCitizenSafeStatusMessage(targetStatus);
      const eventKey = `status_${complaintId}_${targetStatus}`;

      try {
        await createNotification({
          userId: complaint.citizen_id,
          complaintId: complaint.id,
          notificationType,
          title: safeTitle,
          message: safeMessage,
          metadata: {
            tracking_id: complaint.tracking_id,
            sector: complaint.sector,
            old_status: currentStatus,
            new_status: targetStatus,
          },
          eventKey,
        });
      } catch (notifErr) {
        console.warn('[adminComplaintService] Warning creating citizen notification:', notifErr);
      }
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Executes a controlled administrative priority tier override.
 * Preserves the original calculated priority score and records the justification.
 */
export async function overridePriority(
  complaintId: string,
  newTier: PriorityTier,
  reason: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId } = await verifyAdminSession();

    if (!reason || reason.trim().length < 5) {
      throw new Error('Administrative priority override requires a mandatory justification reason (min 5 characters).');
    }
    if (reason.trim().length > 2000) {
      throw new Error('Administrative priority override reason exceeds maximum allowable length of 2000 characters.');
    }

    // 1. Fetch current complaint priority
    const { data: complaint, error: fetchErr } = await supabase
      .from('complaints')
      .select('id, priority_tier, priority_score')
      .eq('id', complaintId)
      .single();

    if (fetchErr || !complaint) {
      throw new Error('Complaint not found.');
    }

    const oldTier = complaint.priority_tier;

    // 2. Update priority_tier on complaints (preserving priority_score)
    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        priority_tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', complaintId);

    if (updateErr) throw updateErr;

    // 3. Record audit entry in admin_actions
    const { error: actionErr } = await supabase.from('admin_actions').insert({
      complaint_id: complaintId,
      admin_id: userId,
      action_type: 'priority_override',
      old_value: oldTier,
      new_value: newTier,
      reason: reason.trim(),
    });

    if (actionErr) throw actionErr;

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Assigns a complaint to a municipal department wing.
 */
export async function assignDepartment(
  complaintId: string,
  departmentCode: string,
  note?: string | null
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId } = await verifyAdminSession();

    const { data: complaint } = await supabase
      .from('complaints')
      .select('id, tracking_id, citizen_id, status')
      .eq('id', complaintId)
      .single();

    // If currently under_review, transition status to assigned
    if (complaint?.status === 'under_review') {
      await transitionComplaintStatus(
        complaintId,
        'assigned',
        note || `Dispatched to municipal wing: ${departmentCode}`
      );
    }

    // Record assignment action in admin_actions
    await supabase.from('admin_actions').insert({
      complaint_id: complaintId,
      admin_id: userId,
      action_type: 'assign_department',
      new_value: departmentCode,
      reason: note?.trim() || `Assigned to department wing ${departmentCode}`,
    });

    // Phase 11: Departmental assignment notification for citizen (idempotent)
    if (complaint?.citizen_id) {
      try {
        await createNotification({
          userId: complaint.citizen_id,
          complaintId: complaint.id,
          notificationType: 'assigned',
          title: `Grievance Dispatched to Department (${complaint.tracking_id || 'Ref'})`,
          message: getCitizenSafeStatusMessage('assigned', departmentCode),
          metadata: {
            tracking_id: complaint.tracking_id,
            department: departmentCode,
          },
          eventKey: `assign_${complaintId}_${departmentCode}`,
        });
      } catch (notifErr) {
        console.warn('[adminComplaintService] Warning creating assignment notification:', notifErr);
      }
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Triggers or re-runs photographic evidence analysis for a complaint as an authenticated municipal administrator.
 * Validates admin session before invoking the backend multimodal pipeline.
 */
export async function triggerAdminEvidenceAnalysis(
  complaintId: string,
  reanalyze = true
): Promise<AssessmentFetchResult> {
  try {
    await verifyAdminSession();

    return await triggerComplaintAnalysis({
      complaintId,
      reanalyze,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      data: null,
      state: 'failed',
      error,
    };
  }
}

