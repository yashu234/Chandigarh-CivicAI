/**
 * Chandigarh CivicAI — Structured AI Assessment Contracts & Validation
 *
 * CRITICAL CIVIC AI ARCHITECTURE PRINCIPLES:
 * 1. AI is strictly decision-support for human municipal engineers.
 * 2. NEVER claim "authenticity detection". We use "Evidence Support",
 *    which measures how strongly the uploaded visual evidence corroborates
 *    the citizen's described hazard.
 * 3. AI cannot prove if an image was edited, when it was taken, or who took it.
 * 4. Low AI confidence NEVER rejects a complaint; it sets human_review_required = true.
 * 5. All numeric dimensions are strictly bounded between 0.00 and 100.00.
 */

export type AIAnalysisState = 'pending' | 'completed' | 'failed' | 'not_configured';

export interface StructuredAIAssessment {
  id?: string;
  complaintId: string;
  detectedIssue: string | null;
  suggestedCategory: string | null;
  // Bounded numeric metrics (0.00 to 100.00)
  severity: number | null;
  safetyRisk: number | null;
  evidenceSupport: number | null; // Core metric: degree of visual corroboration
  imageQuality: number | null;
  descriptionMatch: number | null;
  publicImpact: number | null;
  reasoningSummary: string | null;
  humanReviewRequired: boolean;
  humanReviewReasons: string[];
  analysisState: AIAnalysisState;
  modelVersion: string | null;
  createdAt: string;
}

import type { AIAssessmentRow } from '../../types/database';

export interface AIAnalysisInput {
  complaintId: string;
  title?: string;
  description?: string;
  category?: string;
  sector?: string;
  imageSignedUrl?: string | null;
  imageMimeType?: string | null;
  reanalyze?: boolean;
}

/**
 * Maps a database AIAssessmentRow into a domain StructuredAIAssessment.
 */
export function mapDbAssessmentToDomain(
  row: AIAssessmentRow
): StructuredAIAssessment {
  const base: StructuredAIAssessment = {
    id: row.id,
    complaintId: row.complaint_id,
    detectedIssue: row.detected_issue,
    suggestedCategory: row.suggested_category,
    severity: row.severity,
    safetyRisk: row.safety_risk,
    evidenceSupport: row.evidence_support,
    imageQuality: row.image_quality,
    descriptionMatch: row.description_match,
    publicImpact: row.public_impact,
    reasoningSummary: row.reasoning_summary,
    humanReviewRequired: row.human_review_required,
    humanReviewReasons: [],
    analysisState: 'completed',
    modelVersion: row.model_version,
    createdAt: row.created_at,
  };

  const reviewEval = evaluateHumanReviewFlags(base);
  base.humanReviewRequired = row.human_review_required || reviewEval.required;
  base.humanReviewReasons = reviewEval.reasons;

  return base;
}

export interface ScoreValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface HumanReviewEvaluationResult {
  required: boolean;
  reasons: string[];
}

/**
 * Validates that all numeric assessment dimensions conform to the 0–100 bounds.
 */
export function validateAssessmentScores(
  assessment: Partial<StructuredAIAssessment>
): ScoreValidationResult {
  const errors: string[] = [];

  const numericFields: Array<{
    name: string;
    value: number | null | undefined;
  }> = [
    { name: 'severity', value: assessment.severity },
    { name: 'safetyRisk', value: assessment.safetyRisk },
    { name: 'evidenceSupport', value: assessment.evidenceSupport },
    { name: 'imageQuality', value: assessment.imageQuality },
    { name: 'descriptionMatch', value: assessment.descriptionMatch },
    { name: 'publicImpact', value: assessment.publicImpact },
  ];

  for (const { name, value } of numericFields) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`${name} must be a valid numeric score.`);
      continue;
    }
    if (value < 0 || value > 100) {
      errors.push(`${name} score (${value}) is out of bounds. Must be between 0.00 and 100.00.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates whether a complaint requires human engineer review.
 * Low confidence or missing AI results trigger human review, NEVER automatic rejection.
 */
export function evaluateHumanReviewFlags(
  assessment: Partial<StructuredAIAssessment>
): HumanReviewEvaluationResult {
  const reasons: string[] = [];

  // State-based triggers
  if (assessment.analysisState === 'not_configured') {
    reasons.push('Automated AI analysis pipeline is not configured in this environment. Requires human triage.');
  } else if (assessment.analysisState === 'failed') {
    reasons.push('AI evidence analysis encountered an processing failure. Routed to municipal engineers.');
  } else if (assessment.analysisState === 'pending') {
    reasons.push('Analysis is pending intake evaluation.');
  }

  // Quality & consistency triggers
  if (assessment.imageQuality !== null && assessment.imageQuality !== undefined && assessment.imageQuality < 40) {
    reasons.push(`Low visual evidence quality (${assessment.imageQuality.toFixed(0)}/100). Image may be blurry or obstructed.`);
  }

  if (assessment.descriptionMatch !== null && assessment.descriptionMatch !== undefined && assessment.descriptionMatch < 40) {
    reasons.push(`Low description consistency (${assessment.descriptionMatch.toFixed(0)}/100). Visual evidence does not clearly match written statement.`);
  }

  if (assessment.evidenceSupport !== null && assessment.evidenceSupport !== undefined && assessment.evidenceSupport < 40) {
    reasons.push(`Low evidence support (${assessment.evidenceSupport.toFixed(0)}/100). Visual evidence provides inconclusive corroboration.`);
  }

  // High safety urgency trigger
  if (assessment.safetyRisk !== null && assessment.safetyRisk !== undefined && assessment.safetyRisk >= 80) {
    reasons.push(`Severe public safety hazard flagged (${assessment.safetyRisk.toFixed(0)}/100). Expedited human verification required.`);
  }

  return {
    required: reasons.length > 0 || Boolean(assessment.humanReviewRequired),
    reasons,
  };
}
