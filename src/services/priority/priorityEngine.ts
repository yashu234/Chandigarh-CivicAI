/**
 * Chandigarh CivicAI — Authoritative Deterministic Priority Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Deterministic & Explainable: Computes municipal priority using a transparent,
 *    mathematically reproducible weighted sum.
 * 2. Decision Support Separation: The AI assessment provides objective dimensions
 *    (severity, safety risk, public impact, evidence support). The AI model NEVER
 *    directly assigns the final priority tier.
 * 3. Protected Attribute Immunity: Zero personal attributes are factored into scoring.
 * 4. Human-in-the-Loop: High safety hazards or low evidence quality trigger
 *    humanReviewRequired without mutating the deterministic priority score.
 */

import type {
  PriorityInput,
  PriorityTier,
  PriorityBreakdown,
  PriorityCalculationResult,
} from './priorityTypes.ts';

/**
 * Centralized, authoritative municipal weighting constants.
 * Must sum exactly to 1.00 (100%).
 */
export const PRIORITY_WEIGHTS = {
  SEVERITY: 0.35,        // 35% weight: Physical defect seriousness
  SAFETY_RISK: 0.30,     // 30% weight: Immediate danger to life / property
  PUBLIC_IMPACT: 0.20,   // 20% weight: Community disruption / corridor scale
  RECURRENCE: 0.10,      // 10% weight: Defect recurrence history
  EVIDENCE_SUPPORT: 0.05 // 5% weight: Corroboration strength from evidence
} as const;

/**
 * Centralized priority tier boundaries:
 * - 80.00 – 100.00 : CRITICAL
 * - 60.00 –  79.99 : HIGH
 * - 35.00 –  59.99 : MEDIUM
 * -  0.00 –  34.99 : LOW
 */
export const PRIORITY_TIER_THRESHOLDS = {
  CRITICAL: 80.0,
  HIGH: 60.0,
  MEDIUM: 35.0,
  LOW: 0.0,
} as const;

export class PriorityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriorityValidationError';
  }
}

/**
 * Validates that all priority dimension inputs are finite numbers strictly within [0, 100].
 * Rejects negative numbers, numbers > 100, NaN, Infinity, strings, and missing values.
 */
export function validatePriorityInput(input: unknown): asserts input is PriorityInput {
  if (!input || typeof input !== 'object') {
    throw new PriorityValidationError('Priority input must be a non-null object.');
  }

  const candidate = input as Record<string, unknown>;
  const requiredFields: Array<{ key: keyof PriorityInput; label: string }> = [
    { key: 'severity', label: 'Severity' },
    { key: 'safetyRisk', label: 'Safety Risk' },
    { key: 'publicImpact', label: 'Public Impact' },
    { key: 'recurrence', label: 'Recurrence' },
    { key: 'evidenceSupport', label: 'Evidence Support' },
  ];

  for (const { key, label } of requiredFields) {
    const val = candidate[key];

    if (val === undefined || val === null) {
      throw new PriorityValidationError(`Missing required dimension "${label}".`);
    }

    if (typeof val !== 'number') {
      throw new PriorityValidationError(
        `Dimension "${label}" must be a number, received ${typeof val}.`
      );
    }

    if (Number.isNaN(val)) {
      throw new PriorityValidationError(`Dimension "${label}" cannot be NaN.`);
    }

    if (!Number.isFinite(val)) {
      throw new PriorityValidationError(`Dimension "${label}" must be a finite number.`);
    }

    if (val < 0) {
      throw new PriorityValidationError(
        `Dimension "${label}" cannot be negative (${val} < 0).`
      );
    }

    if (val > 100) {
      throw new PriorityValidationError(
        `Dimension "${label}" cannot exceed 100 (${val} > 100).`
      );
    }
  }
}

/**
 * Maps a numerical priority score (0–100) to its authoritative municipal tier.
 */
export function determinePriorityTier(score: number): PriorityTier {
  if (score >= PRIORITY_TIER_THRESHOLDS.CRITICAL) {
    return 'critical';
  }
  if (score >= PRIORITY_TIER_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (score >= PRIORITY_TIER_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'low';
}

/**
 * Authoritative deterministic priority calculation function.
 * 
 * Formula:
 * Priority Score = 0.35 * Severity
 *                + 0.30 * Safety Risk
 *                + 0.20 * Public Impact
 *                + 0.10 * Recurrence
 *                + 0.05 * Evidence Support
 */
export function calculatePriorityScore(
  input: PriorityInput,
  humanReviewRequired = false
): PriorityCalculationResult {
  validatePriorityInput(input);

  const severityContrib = input.severity * PRIORITY_WEIGHTS.SEVERITY;
  const safetyRiskContrib = input.safetyRisk * PRIORITY_WEIGHTS.SAFETY_RISK;
  const publicImpactContrib = input.publicImpact * PRIORITY_WEIGHTS.PUBLIC_IMPACT;
  const recurrenceContrib = input.recurrence * PRIORITY_WEIGHTS.RECURRENCE;
  const evidenceSupportContrib = input.evidenceSupport * PRIORITY_WEIGHTS.EVIDENCE_SUPPORT;

  const rawScore =
    severityContrib +
    safetyRiskContrib +
    publicImpactContrib +
    recurrenceContrib +
    evidenceSupportContrib;

  // Round to 2 decimal places for civic display and persistence
  const finalScore = Math.round(rawScore * 100) / 100;
  const tier = determinePriorityTier(finalScore);

  const breakdown: PriorityBreakdown = {
    severity: {
      score: input.severity,
      weight: PRIORITY_WEIGHTS.SEVERITY,
      contribution: Math.round(severityContrib * 100) / 100,
    },
    safetyRisk: {
      score: input.safetyRisk,
      weight: PRIORITY_WEIGHTS.SAFETY_RISK,
      contribution: Math.round(safetyRiskContrib * 100) / 100,
    },
    publicImpact: {
      score: input.publicImpact,
      weight: PRIORITY_WEIGHTS.PUBLIC_IMPACT,
      contribution: Math.round(publicImpactContrib * 100) / 100,
    },
    recurrence: {
      score: input.recurrence,
      weight: PRIORITY_WEIGHTS.RECURRENCE,
      contribution: Math.round(recurrenceContrib * 100) / 100,
    },
    evidenceSupport: {
      score: input.evidenceSupport,
      weight: PRIORITY_WEIGHTS.EVIDENCE_SUPPORT,
      contribution: Math.round(evidenceSupportContrib * 100) / 100,
    },
  };

  const explanation =
    `Priority Score of ${finalScore.toFixed(2)} (${tier.toUpperCase()}) derived via ` +
    `Severity (35% = ${breakdown.severity.contribution.toFixed(2)}), ` +
    `Safety Risk (30% = ${breakdown.safetyRisk.contribution.toFixed(2)}), ` +
    `Public Impact (20% = ${breakdown.publicImpact.contribution.toFixed(2)}), ` +
    `Recurrence (10% = ${breakdown.recurrence.contribution.toFixed(2)}), and ` +
    `Evidence Support (5% = ${breakdown.evidenceSupport.contribution.toFixed(2)}).`;

  return {
    status: 'calculated',
    score: finalScore,
    tier,
    breakdown,
    humanReviewRequired: Boolean(humanReviewRequired),
    explanation,
  };
}

/**
 * Adapter that safely extracts priority dimensions from an AI assessment record
 * and passes backend-controlled recurrence.
 * 
 * If the assessment is missing, unconfigured, or failed:
 * Returns status: 'pending_ai' with null scores (never invents fake numbers).
 */
export function calculatePriorityFromAIAssessment(
  assessment: {
    severity?: number | null;
    safetyRisk?: number | null;
    publicImpact?: number | null;
    evidenceSupport?: number | null;
    humanReviewRequired?: boolean | null;
    analysisState?: string | null;
    // Alternative database column names
    safety_risk?: number | null;
    public_impact?: number | null;
    evidence_support?: number | null;
    human_review_required?: boolean | null;
  } | null | undefined,
  recurrence = 0 // Backend-controlled default (0 for new complaints)
): PriorityCalculationResult {
  if (!assessment) {
    return {
      status: 'pending_ai',
      score: null,
      tier: null,
      breakdown: null,
      humanReviewRequired: false,
      explanation: 'Priority score pending completion of AI evidence analysis.',
    };
  }

  // Handle explicit non-completed states
  if (assessment.analysisState && assessment.analysisState !== 'completed') {
    return {
      status: 'pending_ai',
      score: null,
      tier: null,
      breakdown: null,
      humanReviewRequired: Boolean(
        assessment.humanReviewRequired || assessment.human_review_required
      ),
      explanation: `Priority pending: AI analysis is in state "${assessment.analysisState}".`,
    };
  }

  // Normalize camelCase and snake_case field access
  const severity = assessment.severity ?? null;
  const safetyRisk = assessment.safetyRisk ?? assessment.safety_risk ?? null;
  const publicImpact = assessment.publicImpact ?? assessment.public_impact ?? null;
  const evidenceSupport = assessment.evidenceSupport ?? assessment.evidence_support ?? null;
  const humanReview = Boolean(
    assessment.humanReviewRequired ?? assessment.human_review_required
  );

  // If any core metric is absent, do not invent fallback values
  if (
    severity === null ||
    safetyRisk === null ||
    publicImpact === null ||
    evidenceSupport === null
  ) {
    return {
      status: 'pending_ai',
      score: null,
      tier: null,
      breakdown: null,
      humanReviewRequired: humanReview,
      explanation: 'Priority pending: One or more AI evidence dimensions have not been assessed.',
    };
  }

  try {
    const input: PriorityInput = {
      severity,
      safetyRisk,
      publicImpact,
      recurrence,
      evidenceSupport,
    };
    return calculatePriorityScore(input, humanReview);
  } catch (err) {
    return {
      status: 'error',
      score: null,
      tier: null,
      breakdown: null,
      humanReviewRequired: true,
      explanation: 'Failed to calculate priority due to invalid assessment dimensions.',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
