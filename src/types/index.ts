/**
 * Chandigarh CivicAI — Domain and System Types
 * Core data contracts for civic complaint analysis and explainable prioritization.
 */

export type UserRole = 'citizen' | 'admin' | 'department_officer';

export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'negligible';

export type SafetyRiskLevel = 'severe' | 'high' | 'moderate' | 'low' | 'none';

export type ImageQualityRating = 'high' | 'adequate' | 'blurry' | 'insufficient';

export type ConsistencyRating = 'consistent' | 'partially_consistent' | 'inconsistent' | 'inconclusive';

/**
 * IMPORTANT AI PRINCIPLE:
 * We do NOT claim AI proves image authenticity.
 * Instead, "Evidence Support" quantifies how strongly the uploaded visual evidence
 * appears to corroborate the reported civic problem.
 */
export type EvidenceSupportLevel = 'strong' | 'moderate' | 'weak' | 'unsupported';

export type PublicImpactLevel = 'widespread' | 'neighborhood' | 'localized' | 'minimal';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface ComplaintLocation {
  sector: string; // e.g. "Sector 17", "Sector 35"
  landmark?: string;
  address: string;
  coordinates?: LocationCoordinates;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
}

/**
 * AI Assessment output contract
 * Explainable factors generated to assist human administrators
 */
export interface AIAssessment {
  detectedIssue: string;
  severity: SeverityLevel;
  safetyRisk: SafetyRiskLevel;
  evidenceSupport: EvidenceSupportLevel;
  evidenceSupportNotes: string;
  imageQuality: ImageQualityRating;
  descriptionImageConsistency: ConsistencyRating;
  publicImpact: PublicImpactLevel;
  summaryReasoning: string;
  humanReviewRequired?: boolean;
  assessedAt?: string;
}

/**
 * Deterministic Priority Engine output contract
 * Calculates a transparent, explainable score combining objective factors
 */
export interface PriorityScoreBreakdown {
  baseSeverityScore: number;       // 0-100
  safetyRiskScore: number;         // 0-100
  publicImpactScore: number;       // 0-100
  evidenceSupportWeight: number;   // 0.0 - 1.0 (multiplicative confidence modifier)
  finalScore: number;              // 0-100 computed transparently
  priorityLevel: PriorityLevel;
  explanation: string;
}

export interface StatusHistoryEvent {
  status: ComplaintStatus;
  timestamp: string;
  actor: string;
  notes?: string;
}

export interface Complaint {
  id: string;
  trackingNumber: string;
  citizenId: string;
  citizenName?: string;
  title: string;
  description: string;
  category: string;
  location: ComplaintLocation;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  status: ComplaintStatus;
  assignedDepartmentId?: string;
  assignedOfficerName?: string;
  aiAssessment?: AIAssessment;
  aiAnalysisState?: 'pending' | 'completed' | 'failed' | 'not_configured';
  priorityScore?: number | null;
  priorityTier?: PriorityLevel | null;
  priorityCalculation?: PriorityScoreBreakdown;
  adminNotes?: string;
  statusHistory?: StatusHistoryEvent[];
  // Calculated Priority vs Administrative Override (Phase 9 Patch)
  calculatedPriorityScore?: number | null;
  calculatedPriorityTier?: PriorityLevel | null;
  effectivePriorityTier?: PriorityLevel | null;
  isPriorityOverridden?: boolean;
  priorityOverrideReason?: string | null;
  priorityOverrideAdminId?: string | null;
  priorityOverrideAt?: string | null;
  // Duplicate & Recurrence Indicators (Phase 10)
  hasDuplicateAdvisory?: boolean;
  duplicateCandidateCount?: number;
  // Phase 11: Citizen Tracking & Resolution
  resolvedAt?: string | null;
}

export interface CitizenStatusTimelineItem {
  id: string;
  status: ComplaintStatus;
  statusLabel: string;
  timestamp: string;
  safeMessage: string;
  isCurrent: boolean;
}

export type {
  DuplicateCandidateStatus,
  DuplicateMatchingSignals,
  DuplicateCandidate,
  RecurrenceSignal,
  DuplicateCandidateSummary,
} from '../services/duplicates/duplicateTypes.ts';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

