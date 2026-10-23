import { supabase, isSupabaseConfigured } from './supabase/client.ts';
import type {
  ComplaintRow,
  ComplaintEvidenceRow,
  AIAssessmentRow,
  AdminActionRow,
} from '../types/database.ts';
import type {
  Complaint,
  ComplaintLocation,
  PriorityScoreBreakdown,
  PriorityLevel,
  ComplaintStatus,
  CitizenStatusTimelineItem,
} from '../types/index.ts';
import {
  EVIDENCE_BUCKET_NAME,
  createSignedEvidenceUrl,
  generateEvidenceStoragePath,
} from './evidenceService.ts';
import { defaultAIProvider } from './ai/aiProvider.ts';
import { calculatePriorityFromAIAssessment, determinePriorityTier } from './priority/priorityEngine.ts';
import {
  CITIZEN_SAFE_STATUS_MAPPINGS,
  getCitizenSafeStatusMessage,
} from './notifications/citizenSafeMessages.ts';
import { createNotification } from './notifications/notificationService.ts';
import {
  triggerComplaintAnalysis,
  type StructuredAIAssessment,
  type AIAnalysisState,
} from './ai/aiAssessmentService.ts';

export interface CreateComplaintInput {
  title: string;
  description: string;
  category: string;
  sector: string;
  landmark?: string;
  streetAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  evidenceFile?: File | null;
  autoAnalyze?: boolean;
}

export interface CreateComplaintResult {
  complaint: ComplaintRow;
  evidence: ComplaintEvidenceRow | null;
  trackingId: string;
  evidenceSignedUrl?: string | null;
  aiAssessment?: StructuredAIAssessment | null;
  aiState?: AIAnalysisState;
  aiError?: string | null;
}

/**
 * Validates the complaint form fields before interacting with Supabase.
 */
export function validateComplaintInput(input: CreateComplaintInput): string | null {
  if (!input.title || !input.title.trim()) {
    return 'Please enter a title for the civic issue.';
  }
  if (input.title.trim().length > 200) {
    return 'Issue title must be 200 characters or fewer.';
  }
  if (!input.category || !input.category.trim()) {
    return 'Please select a civic issue category.';
  }
  if (!input.description || !input.description.trim()) {
    return 'Please provide a detailed description of the problem.';
  }
  if (input.description.trim().length < 10) {
    return 'Description must be at least 10 characters long.';
  }
  if (input.description.trim().length > 2500) {
    return 'Description must not exceed 2500 characters.';
  }
  if (!input.sector || !input.sector.trim()) {
    return 'Please specify the Chandigarh sector.';
  }
  if (input.landmark && input.landmark.trim().length > 255) {
    return 'Landmark must be 255 characters or fewer.';
  }
  if (input.streetAddress && input.streetAddress.trim().length > 500) {
    return 'Street address must be 500 characters or fewer.';
  }

  if (input.evidenceFile) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(input.evidenceFile.type.toLowerCase())) {
      return 'Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.';
    }
    if (input.evidenceFile.size > 10 * 1024 * 1024) {
      return 'Evidence photograph exceeds the 10 MB file size limit.';
    }
  }

  return null;
}

/**
 * Creates a real civic complaint in Supabase with optional private evidence upload.
 * Implements strict transactional compensation/rollback if an upload step fails.
 */
export async function createComplaint(
  input: CreateComplaintInput
): Promise<{ data: CreateComplaintResult | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: new Error('Supabase client is not configured. Please check environment variables.'),
    };
  }

  // 1. Client validation
  const validationError = validateComplaintInput(input);
  if (validationError) {
    return { data: null, error: new Error(validationError) };
  }

  // 2. Authentication check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      data: null,
      error: new Error('Authentication required. Please log in as a citizen before submitting.'),
    };
  }

  let createdComplaint: ComplaintRow | null = null;
  let uploadedStoragePath: string | null = null;

  try {
    // 3. Create complaint record in public.complaints
    // Note: citizen_id is sourced directly from authenticated session, never client input.
    // Tracking ID is automatically populated by database sequence / trigger.
    const { data: complaintData, error: complaintError } = await supabase
      .from('complaints')
      .insert({
        citizen_id: user.id,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim(),
        sector: input.sector.trim(),
        landmark: input.landmark?.trim() || null,
        street_address: input.streetAddress?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        status: 'submitted',
        priority_tier: 'medium',
        priority_score: null, // Strictly null until Phase 6 AI triage
      })
      .select('*')
      .single();

    if (complaintError || !complaintData) {
      throw new Error(
        complaintError?.message || 'Failed to register complaint in the municipal database.'
      );
    }

    createdComplaint = complaintData;

    // Phase 11: Idempotent intake notification for grievance registration
    try {
      await createNotification({
        userId: user.id,
        complaintId: createdComplaint.id,
        notificationType: 'complaint_submitted',
        title: `Grievance Registered (${createdComplaint.tracking_id || 'Intake'})`,
        message: `Your civic grievance "${createdComplaint.title}" has been registered and queued for municipal review.`,
        metadata: {
          tracking_id: createdComplaint.tracking_id,
          sector: createdComplaint.sector,
          category: createdComplaint.category,
        },
        eventKey: `intake_${createdComplaint.id}`,
      });
    } catch (notifErr) {
      console.warn('[complaintsService] Intake notification warning (idempotent fallback):', notifErr);
    }

    // 4. Optional photographic evidence upload
    let evidenceRecord: ComplaintEvidenceRow | null = null;
    let evidenceSignedUrl: string | null = null;

    if (input.evidenceFile) {
      // Strictly follows path required by RLS: complaints/{complaint_id}/{uuid}-{filename}
      const storagePath = generateEvidenceStoragePath(
        createdComplaint.id,
        input.evidenceFile.name
      );

      // Upload to private bucket
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET_NAME)
        .upload(storagePath, input.evidenceFile, {
          contentType: input.evidenceFile.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // Step B Rollback: Clean up created complaint
        console.error('[complaintsService] Evidence upload failed, rolling back complaint:', uploadError.message);
        await supabase.from('complaints').delete().eq('id', createdComplaint.id);
        createdComplaint = null;
        throw new Error(`Evidence upload failed: ${uploadError.message}. Complaint registration was rolled back.`);
      }

      uploadedStoragePath = storagePath;

      // 5. Create evidence metadata record in public.complaint_evidence
      const { data: evidenceData, error: evidenceInsertError } = await supabase
        .from('complaint_evidence')
        .insert({
          complaint_id: createdComplaint.id,
          storage_path: storagePath,
          original_filename: input.evidenceFile.name,
          mime_type: input.evidenceFile.type,
          file_size: input.evidenceFile.size,
        })
        .select('*')
        .single();

      if (evidenceInsertError || !evidenceData) {
        // Step C Rollback: Remove uploaded storage object and delete complaint
        console.error('[complaintsService] Evidence record insert failed, rolling back:', evidenceInsertError?.message);
        await supabase.storage.from(EVIDENCE_BUCKET_NAME).remove([storagePath]);
        await supabase.from('complaints').delete().eq('id', createdComplaint.id);
        createdComplaint = null;
        throw new Error('Failed to record evidence metadata. The submission was rolled back to prevent orphaned records.');
      }

      evidenceRecord = evidenceData;

      // Generate a temporary signed URL for immediate preview (expires in 1 hour)
      const { signedUrl } = await createSignedEvidenceUrl(storagePath, 3600);
      evidenceSignedUrl = signedUrl;
    }

    // 6. Automatic AI Evidence Analysis Trigger (Phase 1)
    let aiAssessment: StructuredAIAssessment | null = null;
    let aiState: AIAnalysisState | undefined = undefined;
    let aiError: string | null = null;

    if (evidenceRecord && input.autoAnalyze !== false) {
      try {
        const analysisRes = await triggerComplaintAnalysis({
          complaintId: createdComplaint.id,
          reanalyze: false,
        });

        aiAssessment = analysisRes.data;
        aiState = analysisRes.state;
        if (analysisRes.error) {
          aiError = analysisRes.error.message;
        }

        // Refresh complaint with updated priority_score and priority_tier from database
        const { data: updatedComp } = await supabase
          .from('complaints')
          .select('*')
          .eq('id', createdComplaint.id)
          .maybeSingle();

        if (updatedComp) {
          createdComplaint = updatedComp;
        }
      } catch (autoErr) {
        aiState = 'failed';
        aiError = autoErr instanceof Error ? autoErr.message : 'AI analysis trigger encountered an error.';
        console.warn('[complaintsService] Auto-analysis warning (non-fatal):', autoErr);
      }
    }

    return {
      data: {
        complaint: createdComplaint,
        evidence: evidenceRecord,
        trackingId: createdComplaint.tracking_id,
        evidenceSignedUrl,
        aiAssessment,
        aiState,
        aiError,
      },
      error: null,
    };
  } catch (err) {
    // If an error occurred and complaint exists but was not rolled back, attempt cleanup
    if (createdComplaint?.id) {
      try {
        if (uploadedStoragePath) {
          await supabase.storage.from(EVIDENCE_BUCKET_NAME).remove([uploadedStoragePath]);
        }
        await supabase.from('complaints').delete().eq('id', createdComplaint.id);
      } catch (cleanupErr) {
        console.warn('[complaintsService] Rollback cleanup warning:', cleanupErr);
      }
    }
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
/**
 * Transforms a Supabase ComplaintRow, optional evidence, AI assessment, and optional override
 * into a domain Complaint model.
 * 
 * CRITICAL CIVIC GOVERNANCE RULE:
 * Preserves the deterministic calculated priority score/tier while respecting
 * persisted administrative priority overrides. AI assessment provides decision support;
 * human municipal review determines final civic action.
 */
export async function mapDbComplaintToModel(
  dbComplaint: ComplaintRow,
  evidence?: ComplaintEvidenceRow | null,
  assessmentRow?: AIAssessmentRow | null,
  overrideRecord?: AdminActionRow | null
): Promise<Complaint> {
  let imageUrl: string | undefined = undefined;

  if (evidence?.storage_path) {
    const { signedUrl } = await createSignedEvidenceUrl(evidence.storage_path, 3600);
    if (signedUrl) {
      imageUrl = signedUrl;
    }
  }

  const location: ComplaintLocation = {
    sector: dbComplaint.sector,
    landmark: dbComplaint.landmark ?? undefined,
    address: dbComplaint.street_address || dbComplaint.sector,
    coordinates:
      dbComplaint.latitude && dbComplaint.longitude
        ? { latitude: dbComplaint.latitude, longitude: dbComplaint.longitude }
        : undefined,
  };

  const aiAnalysisState = assessmentRow
    ? 'completed'
    : defaultAIProvider.isConfigured
    ? 'pending'
    : 'not_configured';

  // 1. Calculate deterministic priority from AI assessment
  const priorityResult = calculatePriorityFromAIAssessment(assessmentRow);

  // 2. Persisted or calculated score (Phase 8 deterministic formula)
  const calculatedScore =
    dbComplaint.priority_score !== null && dbComplaint.priority_score !== undefined
      ? Number(dbComplaint.priority_score)
      : priorityResult.status === 'calculated'
      ? priorityResult.score
      : null;

  // 3. Persisted or calculated tier
  const calculatedTier: PriorityLevel | null =
    priorityResult.status === 'calculated' && priorityResult.tier
      ? (priorityResult.tier as PriorityLevel)
      : calculatedScore !== null
      ? (determinePriorityTier(calculatedScore) as PriorityLevel)
      : null;

  // 4. Resolve administrative override vs effective tier
  let isPriorityOverridden = false;
  let effectivePriorityTier: PriorityLevel | null = null;
  let priorityOverrideReason: string | null = null;
  let priorityOverrideAdminId: string | null = null;
  let priorityOverrideAt: string | null = null;

  if (overrideRecord && overrideRecord.new_value) {
    // Explicit valid override audit log found
    isPriorityOverridden = true;
    effectivePriorityTier = overrideRecord.new_value as PriorityLevel;
    priorityOverrideReason = overrideRecord.reason;
    priorityOverrideAdminId = overrideRecord.admin_id;
    priorityOverrideAt = overrideRecord.created_at;
  } else if (
    calculatedTier !== null &&
    dbComplaint.priority_tier &&
    dbComplaint.priority_tier !== calculatedTier
  ) {
    // Persisted priority_tier differs from deterministic calculated tier
    isPriorityOverridden = true;
    effectivePriorityTier = dbComplaint.priority_tier as PriorityLevel;
    priorityOverrideReason = 'Adjusted by authorized municipal review';
    priorityOverrideAt = dbComplaint.updated_at;
  } else {
    // No override active — effective matches calculated tier (or initial db tier)
    isPriorityOverridden = false;
    effectivePriorityTier = calculatedTier ?? (dbComplaint.priority_tier as PriorityLevel | null);
  }

  const priorityCalculation: PriorityScoreBreakdown | undefined =
    priorityResult.status === 'calculated' &&
    priorityResult.score !== null &&
    priorityResult.tier !== null
      ? {
          baseSeverityScore: Number(assessmentRow?.severity ?? 0),
          safetyRiskScore: Number(assessmentRow?.safety_risk ?? 0),
          publicImpactScore: Number(assessmentRow?.public_impact ?? 0),
          evidenceSupportWeight: 0.05,
          finalScore: priorityResult.score,
          priorityLevel: calculatedTier ?? (priorityResult.tier as PriorityLevel),
          explanation: priorityResult.explanation,
        }
      : undefined;

  return {
    id: dbComplaint.id,
    trackingNumber: dbComplaint.tracking_id,
    citizenId: dbComplaint.citizen_id,
    title: dbComplaint.title,
    description: dbComplaint.description,
    category: dbComplaint.category,
    location,
    imageUrl,
    createdAt: dbComplaint.created_at,
    updatedAt: dbComplaint.updated_at,
    status: dbComplaint.status,
    resolvedAt: dbComplaint.resolved_at ?? null,
    priorityScore: calculatedScore,
    priorityTier: effectivePriorityTier,
    priorityCalculation,
    aiAssessment: undefined, // Fully resolved on ComplaintDetailsPage via getAssessmentForComplaint
    aiAnalysisState,
    // Explicit calculated vs override fields (Phase 9 Patch)
    calculatedPriorityScore: calculatedScore,
    calculatedPriorityTier: calculatedTier,
    effectivePriorityTier,
    isPriorityOverridden,
    priorityOverrideReason,
    priorityOverrideAdminId,
    priorityOverrideAt,
  };
}

/**
 * Fetches a single complaint from Supabase by UUID or human-readable tracking ID.
 */
export async function getComplaintByIdOrTracking(
  idOrTracking: string
): Promise<{ data: Complaint | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }

  try {
    // Check by ID or tracking_id
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrTracking);

    let query = supabase.from('complaints').select('*');
    if (isUuid) {
      query = query.eq('id', idOrTracking);
    } else {
      query = query.eq('tracking_id', idOrTracking);
    }

    const { data: complaintRow, error: complaintError } = await query.maybeSingle();

    if (complaintError) {
      return { data: null, error: complaintError };
    }

    if (!complaintRow) {
      return { data: null, error: null };
    }

    // Fetch evidence record if exists
    const { data: evidenceRow } = await supabase
      .from('complaint_evidence')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .maybeSingle();

    // Fetch assessment record if exists
    const { data: assessmentRow } = await supabase
      .from('ai_assessments')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .maybeSingle();

    // Fetch latest priority override record if exists
    const { data: overrideAction } = await supabase
      .from('admin_actions')
      .select('*')
      .eq('complaint_id', complaintRow.id)
      .eq('action_type', 'priority_override')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const model = await mapDbComplaintToModel(
      complaintRow,
      evidenceRow,
      assessmentRow,
      overrideAction
    );
    return { data: model, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches all live complaints submitted by the authenticated citizen.
 */
export async function getMyLiveComplaints(): Promise<{
  data: Complaint[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: null };
    }

    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('citizen_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error };
    }

    if (!complaints || complaints.length === 0) {
      return { data: [], error: null };
    }

    // Fetch evidence for all complaints
    const complaintIds = complaints.map((c) => c.id);
    const { data: allEvidence } = await supabase
      .from('complaint_evidence')
      .select('*')
      .in('complaint_id', complaintIds);

    // Fetch AI assessments for all complaints
    const { data: allAssessments } = await supabase
      .from('ai_assessments')
      .select('*')
      .in('complaint_id', complaintIds);

    // Fetch latest priority overrides for these complaints
    const { data: allOverrides } = await supabase
      .from('admin_actions')
      .select('*')
      .in('complaint_id', complaintIds)
      .eq('action_type', 'priority_override')
      .order('created_at', { ascending: false });

    const evidenceMap = new Map<string, ComplaintEvidenceRow>();
    if (allEvidence) {
      for (const ev of allEvidence) {
        evidenceMap.set(ev.complaint_id, ev);
      }
    }

    const assessmentMap = new Map<string, AIAssessmentRow>();
    if (allAssessments) {
      for (const ass of allAssessments) {
        assessmentMap.set(ass.complaint_id, ass);
      }
    }

    const overrideMap = new Map<string, AdminActionRow>();
    if (allOverrides) {
      for (const ov of allOverrides) {
        // First encountered is the newest valid override because of created_at DESC order
        if (!overrideMap.has(ov.complaint_id)) {
          overrideMap.set(ov.complaint_id, ov);
        }
      }
    }

    const models = await Promise.all(
      complaints.map((c) =>
        mapDbComplaintToModel(
          c,
          evidenceMap.get(c.id),
          assessmentMap.get(c.id),
          overrideMap.get(c.id)
        )
      )
    );

    return { data: models, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetches the persisted status timeline for a citizen.
 * Strictly queries public.complaint_status_history without leaking admin UUIDs (changed_by)
 * or internal administrative notes (note).
 */
export async function getCitizenStatusTimeline(
  complaintId: string,
  initialCreatedAt?: string,
  currentStatus?: ComplaintStatus
): Promise<{ data: CitizenStatusTimelineItem[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const baseTime = initialCreatedAt ? new Date(initialCreatedAt).getTime() : Date.now() - 3600000 * 24;
    const now = new Date();
    const curr = currentStatus || 'submitted';

    const items: CitizenStatusTimelineItem[] = [
      {
        id: `demo-history-submitted-${complaintId}`,
        status: 'submitted',
        statusLabel: CITIZEN_SAFE_STATUS_MAPPINGS['submitted'].label,
        timestamp: new Date(baseTime).toISOString(),
        safeMessage: CITIZEN_SAFE_STATUS_MAPPINGS['submitted'].explanation,
        isCurrent: curr === 'submitted',
      },
    ];

    if (curr !== 'submitted') {
      items.push({
        id: `demo-history-current-${complaintId}`,
        status: curr,
        statusLabel: CITIZEN_SAFE_STATUS_MAPPINGS[curr]?.label || curr,
        timestamp: now.toISOString(),
        safeMessage: getCitizenSafeStatusMessage(curr),
        isCurrent: true,
      });
    }

    return { data: items, error: null };
  }

  try {
    // Strictly select ONLY safe public fields: id, old_status, new_status, created_at
    // NEVER select changed_by or note!
    const { data: rows, error } = await supabase
      .from('complaint_status_history')
      .select('id, old_status, new_status, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: [], error };
    }

    const items: CitizenStatusTimelineItem[] = [];

    // 1. Initial intake event
    if (initialCreatedAt) {
      items.push({
        id: `intake-${complaintId}`,
        status: 'submitted',
        statusLabel: CITIZEN_SAFE_STATUS_MAPPINGS['submitted'].label,
        timestamp: initialCreatedAt,
        safeMessage: CITIZEN_SAFE_STATUS_MAPPINGS['submitted'].explanation,
        isCurrent: !rows || rows.length === 0,
      });
    }

    // 2. Append persisted transitions in chronological order
    if (rows && rows.length > 0) {
      rows.forEach((r, idx) => {
        const status = r.new_status as ComplaintStatus;
        const isLast = idx === rows.length - 1;
        items.push({
          id: r.id,
          status,
          statusLabel: CITIZEN_SAFE_STATUS_MAPPINGS[status]?.label || status,
          timestamp: r.created_at,
          safeMessage: getCitizenSafeStatusMessage(status),
          isCurrent: isLast,
        });
      });
    }

    return { data: items, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

