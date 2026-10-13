/**
 * Chandigarh CivicAI — Duplicate & Recurring Complaint Detection Contracts
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Advisory Decision Support: Duplicate suggestions are strictly recommendations
 *    for authorized municipal administrators. Zero automated merging of complaints.
 * 2. Deterministic & Explainable: Candidate matching is computed from explainable
 *    weighted signals (category, normalized text, spatial proximity, temporal proximity).
 * 3. Protected Attribute Immunity: Zero personal/demographic attributes are used.
 * 4. Canonical Pair Ordering: Complaint pairs (A, B) and (B, A) normalize to a single
 *    ordered representation (A < B). Self-pairing (A = A) is strictly prohibited.
 */

export type DuplicateCandidateStatus = 'suggested' | 'dismissed' | 'confirmed_duplicate';

export interface DuplicateMatchingSignals {
  categoryScore: number;       // 0 or 100
  categoryMatched: boolean;
  locationScore: number;       // 0 to 100 (Haversine distance score or sector match fallback)
  textScore: number;           // 0 to 100 (Jaccard token similarity on normalized title + description)
  temporalScore: number;       // 0 to 100 (Proximity based on submission time difference)
  landmarkScore: number;       // 0 to 100 (Token overlap of address/landmark)
  distanceMeters?: number | null; // Available when coordinates exist
  deltaHours: number;          // Hours between submissions
  signalReasons: string[];     // Human-readable explainable rationale for each factor
}

export interface DuplicateCandidate {
  id: string;
  sourceComplaintId: string;    // First complaint ID (canonical A)
  candidateComplaintId: string; // Second complaint ID (canonical B)
  similarityScore: number;      // 0.00 to 100.00
  status: DuplicateCandidateStatus;
  matchingSignals: DuplicateMatchingSignals;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceSignal {
  sector: string;
  category: string;
  windowDays: number;
  priorComplaintsCount: number;
  recurrenceScore: number; // 0 to 100 (deterministic: min(100, N * 25))
  level: 'none' | 'emerging' | 'frequent' | 'chronic' | 'severe';
  explanation: string;
}

export interface DuplicateCandidateSummary {
  candidate: DuplicateCandidate;
  otherComplaint: {
    id: string;
    trackingId: string;
    title: string;
    category: string;
    sector: string;
    landmark?: string | null;
    status: string;
    createdAt: string;
  };
}
