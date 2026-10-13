import { supabase, isSupabaseConfigured } from '../supabase/client';
import type {
  StructuredAIAssessment,
  AIAnalysisState,
  AIAnalysisInput,
} from './aiAssessmentTypes';
import {
  validateAssessmentScores,
  mapDbAssessmentToDomain,
} from './aiAssessmentTypes';
import { defaultAIProvider } from './aiProvider';

export { mapDbAssessmentToDomain };

export interface AssessmentFetchResult {
  data: StructuredAIAssessment | null;
  state: AIAnalysisState;
  error: Error | null;
}

/**
 * Fetches the real AI assessment row for a complaint from Supabase.
 * If no row exists, truthfully reports 'not_configured' or 'pending'.
 */
export async function getAssessmentForComplaint(
  complaintId: string
): Promise<AssessmentFetchResult> {
  if (!isSupabaseConfigured()) {
    return { data: null, state: 'not_configured', error: null };
  }

  try {
    const { data: row, error } = await supabase
      .from('ai_assessments')
      .select('*')
      .eq('complaint_id', complaintId)
      .maybeSingle();

    if (error) {
      return { data: null, state: 'failed', error };
    }

    if (row) {
      const domainModel = mapDbAssessmentToDomain(row);
      return { data: domainModel, state: 'completed', error: null };
    }

    // No completed row exists yet in public.ai_assessments
    return { data: null, state: 'not_configured', error: null };
  } catch (err) {
    return {
      data: null,
      state: 'failed',
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Triggers real server-side multimodal AI analysis for a complaint via the configured AI provider.
 * Passes reanalyze flag to prevent accidental duplicate work.
 */
export async function triggerComplaintAnalysis(
  input: AIAnalysisInput
): Promise<AssessmentFetchResult> {
  try {
    const assessment = await defaultAIProvider.analyzeComplaintEvidence(input);
    return {
      data: assessment,
      state: assessment.analysisState,
      error:
        assessment.analysisState === 'failed'
          ? new Error(assessment.reasoningSummary || 'AI analysis failed')
          : null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      data: null,
      state: 'failed',
      error,
    };
  }
}

/**
 * Validates and records an AI assessment in public.ai_assessments.
 * Protected by database Row Level Security (Admins and service-role only).
 */
export async function recordAssessment(
  assessment: StructuredAIAssessment
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') };
  }

  // 1. Strict numeric bounds validation (0.00 to 100.00)
  const validation = validateAssessmentScores(assessment);
  if (!validation.isValid) {
    return {
      success: false,
      error: new Error(`Assessment score validation failed: ${validation.errors.join(' ')}`),
    };
  }

  try {
    const { error } = await supabase.from('ai_assessments').insert({
      complaint_id: assessment.complaintId,
      detected_issue: assessment.detectedIssue,
      suggested_category: assessment.suggestedCategory,
      severity: assessment.severity,
      safety_risk: assessment.safetyRisk,
      evidence_support: assessment.evidenceSupport,
      image_quality: assessment.imageQuality,
      description_match: assessment.descriptionMatch,
      public_impact: assessment.publicImpact,
      reasoning_summary: assessment.reasoningSummary,
      human_review_required: assessment.humanReviewRequired,
      model_version: assessment.modelVersion,
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
