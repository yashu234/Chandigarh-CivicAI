/**
 * Chandigarh CivicAI — Deterministic Priority Engine Contracts
 * 
 * Defines the strongly-typed contracts, weight structures, and breakdown
 * representations for the municipal priority engine.
 * 
 * ETHICAL & CONSTITUTIONAL PRINCIPLES:
 * - Priority calculation is 100% deterministic, explainable, and reproducible.
 * - Raw AI inference is an INPUT to this engine; AI does NOT decide priority tiers.
 * - NO protected or personal attributes (Aadhaar, caste, religion, gender, income,
 *   name, phone, email) are ever accepted or factored into municipal priority.
 */

export type PriorityTier = 'critical' | 'high' | 'medium' | 'low';

export type PriorityEngineStatus = 'calculated' | 'pending_ai' | 'error';

/**
 * Validated numerical inputs for the deterministic priority formula.
 * All inputs must be strictly bounded between 0.00 and 100.00.
 */
export interface PriorityInput {
  severity: number;        // Physical seriousness of civic defect (0–100)
  safetyRisk: number;      // Immediate danger to life / limb / property (0–100)
  publicImpact: number;    // Mobility / arterial corridor / community impact (0–100)
  recurrence: number;      // Backend-controlled defect recurrence score (0–100)
  evidenceSupport: number; // Visual corroboration strength from evidence analysis (0–100)
}

/**
 * Transparent contribution breakdown for municipal explainability.
 * Each dimension contributes: Score * Weight.
 */
export interface PriorityDimensionContribution {
  score: number;
  weight: number;
  contribution: number;
}

export interface PriorityBreakdown {
  severity: PriorityDimensionContribution;
  safetyRisk: PriorityDimensionContribution;
  publicImpact: PriorityDimensionContribution;
  recurrence: PriorityDimensionContribution;
  evidenceSupport: PriorityDimensionContribution;
}

/**
 * Complete result of the deterministic priority calculation.
 */
export interface PriorityCalculationResult {
  status: PriorityEngineStatus;
  score: number | null;
  tier: PriorityTier | null;
  breakdown: PriorityBreakdown | null;
  humanReviewRequired: boolean;
  explanation: string;
  errorMessage?: string;
}

/**
 * Architectural foundation for future Phase 9/10 manual admin overrides.
 * Preserves the original AI-derived deterministic calculation while logging
 * an administrative discretion decision.
 */
export interface AdminPriorityOverride {
  complaintId: string;
  originalScore: number;
  originalTier: PriorityTier;
  overrideTier: PriorityTier;
  overrideReason: string;
  adminId: string;
  timestamp: string;
}
