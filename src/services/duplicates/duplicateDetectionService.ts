/**
 * Chandigarh CivicAI — Authoritative Duplicate & Recurring Complaint Detection Service
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Advisory Decision Support: Duplicate detection NEVER merges complaints automatically.
 *    Suggestions are advisory flags presented for human municipal administrator review.
 * 2. Deterministic & Explainable: Detection relies on a transparent weighted sum of
 *    category match, normalized text similarity, spatial proximity, temporal proximity,
 *    and address overlap.
 * 3. Protected Attribute Immunity: Zero personal/demographic attributes are used.
 * 4. Canonical Pair Ordering: Normalized so complaint_a_id < complaint_b_id. Self-pairing
 *    (A = A) is strictly prohibited. Duplicate candidate insertion is idempotent.
 * 5. Robust Location Fallback: When coordinates are missing, location proximity falls back
 *    to municipal sector matching without failing detection.
 * 6. Evidence Discipline: We never claim photographic evidence proves image authenticity
 *    or that two images depict the exact same physical incident. Images assist human review only.
 */

import { supabase, isSupabaseConfigured } from '../supabase/client.ts';
import type { Complaint } from '../../types/index.ts';
import type {
  DuplicateCandidate,
  DuplicateCandidateStatus,
  DuplicateMatchingSignals,
  RecurrenceSignal,
} from './duplicateTypes.ts';
import { verifyAdminSession } from '../admin/adminComplaintService.ts';
import { transitionComplaintStatus } from '../admin/adminComplaintService.ts';

/**
 * Authoritative weights for duplicate similarity calculation.
 * Must sum exactly to 1.00 (100%).
 */
export const DUPLICATE_WEIGHTS = {
  CATEGORY: 0.25,        // 25% weight: Civic issue domain match
  LOCATION: 0.25,        // 25% weight: Spatial/sector proximity
  TEXT_SIMILARITY: 0.30, // 30% weight: Title & description Jaccard token overlap
  TEMPORAL: 0.15,        // 15% weight: Submission date proximity
  LANDMARK: 0.05,        // 5% weight: Street / landmark token overlap
} as const;

/**
 * Similarity threshold for flagging an advisory duplicate candidate (0–100 scale).
 */
export const DUPLICATE_SUGGESTION_THRESHOLD = 60.0;

/**
 * Standard stop words filtered during civic text normalization.
 */
const CIVIC_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
  'near', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'please', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'chandigarh', 'sector', 'sec', 'area', 'road', 'lane',
]);

/**
 * Enforces canonical pair ordering (complaint_a_id < complaint_b_id).
 * Throws if comparing a complaint against itself.
 */
export function normalizeComplaintPair(idA: string, idB: string): [string, string] {
  if (!idA || !idB) {
    throw new Error('Both complaint IDs must be non-empty strings.');
  }
  if (idA === idB) {
    throw new Error('A complaint cannot be compared or paired with itself.');
  }
  return idA < idB ? [idA, idB] : [idB, idA];
}

/**
 * Tokenizes and normalizes text into a clean set of meaningful words.
 */
export function tokenizeAndNormalize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ').filter((w) => w.length > 2 && !CIVIC_STOP_WORDS.has(w));
  return new Set(tokens);
}

/**
 * Calculates Jaccard token similarity between two text strings (0–100 scale).
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  const setA = tokenizeAndNormalize(textA);
  const setB = tokenizeAndNormalize(textB);

  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...setA, ...setB]).size;
  if (unionCount === 0) return 0;

  const score = (intersectionCount / unionCount) * 100;
  return Math.round(score * 100) / 100;
}

/**
 * Calculates Haversine distance in meters between two geographical coordinates.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes location proximity score (0–100) using GPS coordinates when available,
 * or gracefully falls back to municipal sector matching.
 */
export function calculateLocationProximity(
  locA: { sector: string; coordinates?: { latitude: number; longitude: number } | null },
  locB: { sector: string; coordinates?: { latitude: number; longitude: number } | null }
): { score: number; distanceMeters: number | null; reason: string } {
  // Case 1: Both complaints have valid coordinates
  if (locA.coordinates && locB.coordinates) {
    const dist = calculateHaversineDistance(
      locA.coordinates.latitude,
      locA.coordinates.longitude,
      locB.coordinates.latitude,
      locB.coordinates.longitude
    );
    const roundedDist = Math.round(dist);

    let score = 0;
    if (dist <= 50) {
      score = 100;
    } else if (dist <= 150) {
      score = 85;
    } else if (dist <= 300) {
      score = 60;
    } else if (dist <= 600) {
      score = 30;
    } else {
      score = 0;
    }

    return {
      score,
      distanceMeters: roundedDist,
      reason: `Coordinates verified within ${roundedDist}m distance (${score}% spatial proximity)`,
    };
  }

  // Case 2: Missing coordinates on either/both -> fallback to sector match
  const normSectorA = locA.sector.trim().toLowerCase();
  const normSectorB = locB.sector.trim().toLowerCase();

  if (normSectorA === normSectorB && normSectorA.length > 0) {
    return {
      score: 85,
      distanceMeters: null,
      reason: `Sector match (${locA.sector}); coordinates not provided (85% proximity)`,
    };
  }

  return {
    score: 0,
    distanceMeters: null,
    reason: `Different municipal sectors (${locA.sector} vs ${locB.sector}); 0% spatial proximity`,
  };
}

/**
 * Calculates temporal proximity score (0–100) based on hours between complaints.
 */
export function calculateTemporalProximity(
  dateAStr: string,
  dateBStr: string
): { score: number; deltaHours: number; reason: string } {
  const timeA = new Date(dateAStr).getTime();
  const timeB = new Date(dateBStr).getTime();

  const diffMs = Math.abs(timeA - timeB);
  const deltaHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;

  let score = 0;
  if (deltaHours <= 24) {
    score = 100; // Within 24 hours
  } else if (deltaHours <= 72) {
    score = 80;  // Within 3 days
  } else if (deltaHours <= 168) {
    score = 60;  // Within 7 days
  } else if (deltaHours <= 720) {
    score = 30;  // Within 30 days
  } else {
    score = 0;   // Over 30 days
  }

  const days = Math.round(deltaHours / 24);
  const timeDesc = deltaHours < 24 ? `${deltaHours} hours` : `${days} days`;

  return {
    score,
    deltaHours,
    reason: `Intake timestamps recorded ${timeDesc} apart (${score}% temporal proximity)`,
  };
}

/**
 * Calculates similarity between two complaints and returns explainable signals.
 */
export function evaluateComplaintSimilarity(
  complaintA: Complaint,
  complaintB: Complaint
): { similarityScore: number; signals: DuplicateMatchingSignals } {
  // Normalize pair ordering
  normalizeComplaintPair(complaintA.id, complaintB.id);

  const signalReasons: string[] = [];

  // 1. Category Signal
  const catA = complaintA.category.trim().toLowerCase();
  const catB = complaintB.category.trim().toLowerCase();
  const categoryMatched = catA === catB;
  const categoryScore = categoryMatched ? 100 : 0;
  signalReasons.push(
    categoryMatched
      ? `Category match: ${complaintA.category}`
      : `Different categories: "${complaintA.category}" vs "${complaintB.category}"`
  );

  // 2. Spatial / Sector Location Signal
  const locationResult = calculateLocationProximity(complaintA.location, complaintB.location);
  signalReasons.push(locationResult.reason);

  // 3. Text Similarity (Title & Description)
  const fullTextA = `${complaintA.title} ${complaintA.description}`;
  const fullTextB = `${complaintB.title} ${complaintB.description}`;
  const textScore = calculateTextSimilarity(fullTextA, fullTextB);
  signalReasons.push(`Title & statement vocabulary similarity: ${textScore}%`);

  // 4. Temporal Proximity
  const temporalResult = calculateTemporalProximity(complaintA.createdAt, complaintB.createdAt);
  signalReasons.push(temporalResult.reason);

  // 5. Landmark / Address Similarity
  const landmarkTextA = `${complaintA.location.landmark || ''} ${complaintA.location.address || ''}`;
  const landmarkTextB = `${complaintB.location.landmark || ''} ${complaintB.location.address || ''}`;
  const landmarkScore = calculateTextSimilarity(landmarkTextA, landmarkTextB);
  if (landmarkScore > 0) {
    signalReasons.push(`Address & landmark overlap: ${landmarkScore}%`);
  }

  // 6. Weighted Sum Total
  // Note: If category does not match, civic defects are fundamentally different categories
  const rawSimilarity =
    categoryScore * DUPLICATE_WEIGHTS.CATEGORY +
    locationResult.score * DUPLICATE_WEIGHTS.LOCATION +
    textScore * DUPLICATE_WEIGHTS.TEXT_SIMILARITY +
    temporalResult.score * DUPLICATE_WEIGHTS.TEMPORAL +
    landmarkScore * DUPLICATE_WEIGHTS.LANDMARK;

  const similarityScore = Math.round(rawSimilarity * 100) / 100;

  const signals: DuplicateMatchingSignals = {
    categoryScore,
    categoryMatched,
    locationScore: locationResult.score,
    textScore,
    temporalScore: temporalResult.score,
    landmarkScore,
    distanceMeters: locationResult.distanceMeters,
    deltaHours: temporalResult.deltaHours,
    signalReasons,
  };

  return { similarityScore, signals };
}

/**
 * Scans a target complaint against a set of existing complaints to discover
 * potential duplicate suggestions.
 */
export function detectDuplicateCandidates(
  targetComplaint: Complaint,
  existingComplaints: Complaint[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (const other of existingComplaints) {
    if (other.id === targetComplaint.id) continue;

    try {
      const [idA, idB] = normalizeComplaintPair(targetComplaint.id, other.id);
      const { similarityScore, signals } = evaluateComplaintSimilarity(targetComplaint, other);

      // Flag candidate if score meets threshold and category matches
      if (similarityScore >= DUPLICATE_SUGGESTION_THRESHOLD && signals.categoryMatched) {
        candidates.push({
          id: `${idA}_${idB}`,
          sourceComplaintId: idA,
          candidateComplaintId: idB,
          similarityScore,
          status: 'suggested', // Advisory suggestion, NEVER auto-confirmed
          matchingSignals: signals,
          reviewNotes: null,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Self-pair error or invalid ID handled gracefully
      continue;
    }
  }

  return candidates;
}

/**
 * Calculates deterministic sector recurrence signal based on historical complaints
 * in the same sector and category within a 60-day rolling window.
 * 
 * Formula: Recurrence Score = min(100, N * 25)
 * N = count of prior related complaints within past 60 days
 */
export function calculateSectorRecurrenceSignal(
  sector: string,
  category: string,
  complaintDateStr: string,
  allComplaints: Array<{ id: string; sector: string; category: string; createdAt: string }>,
  currentComplaintId?: string
): RecurrenceSignal {
  const targetTime = new Date(complaintDateStr).getTime();
  const windowMs = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
  const normSector = sector.trim().toLowerCase();
  const normCat = category.trim().toLowerCase();

  let priorCount = 0;

  for (const c of allComplaints) {
    if (currentComplaintId && c.id === currentComplaintId) continue;

    const cNormSector = c.sector.trim().toLowerCase();
    const cNormCat = c.category.trim().toLowerCase();

    if (cNormSector === normSector && cNormCat === normCat) {
      const cTime = new Date(c.createdAt).getTime();
      const diffMs = targetTime - cTime;
      // Prior complaint within rolling 60 days window
      if (diffMs > 0 && diffMs <= windowMs) {
        priorCount++;
      }
    }
  }

  // Deterministic Recurrence Score: min(100, N * 25)
  const recurrenceScore = Math.min(100, priorCount * 25);

  let level: RecurrenceSignal['level'] = 'none';
  let explanation = '';

  if (priorCount === 0) {
    level = 'none';
    explanation = `Isolated incident: No prior complaints in ${sector} under "${category}" in the last 60 days.`;
  } else if (priorCount === 1) {
    level = 'emerging';
    explanation = `Emerging pattern: 1 prior complaint in ${sector} under "${category}" in the last 60 days.`;
  } else if (priorCount === 2) {
    level = 'frequent';
    explanation = `Frequent civic issue: 2 prior complaints in ${sector} under "${category}" in the last 60 days.`;
  } else if (priorCount === 3) {
    level = 'chronic';
    explanation = `Chronic municipal defect: 3 prior complaints in ${sector} under "${category}" in the last 60 days.`;
  } else {
    level = 'severe';
    explanation = `Severe recurring problem: ${priorCount} prior complaints recorded in ${sector} under "${category}" in the last 60 days.`;
  }

  return {
    sector,
    category,
    windowDays: 60,
    priorComplaintsCount: priorCount,
    recurrenceScore,
    level,
    explanation,
  };
}

/**
 * Persists a detected duplicate suggestion idempotently in public.complaint_duplicates.
 * If candidate pair already exists, does NOT overwrite human decisions (dismissed or confirmed).
 */
export async function persistDuplicateSuggestion(
  candidate: DuplicateCandidate
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }

  try {
    const [idA, idB] = normalizeComplaintPair(
      candidate.sourceComplaintId,
      candidate.candidateComplaintId
    );

    // 1. Check if candidate pair already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('complaint_duplicates')
      .select('id, status')
      .eq('complaint_a_id', idA)
      .eq('complaint_b_id', idB)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    // If human decision already taken, preserve it
    if (existing && existing.status !== 'suggested') {
      return { success: true, error: null };
    }

    if (!existing) {
      const { error: insertErr } = await supabase.from('complaint_duplicates').insert({
        complaint_a_id: idA,
        complaint_b_id: idB,
        similarity_score: candidate.similarityScore,
        status: 'suggested',
        matching_signals: candidate.matchingSignals as unknown as Record<string, unknown>,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt,
      });

      if (insertErr) throw insertErr;
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
 * Fetches all duplicate suggestions and candidate details for a given complaint ID.
 */
export async function getDuplicateSuggestionsForComplaint(
  complaintId: string
): Promise<{
  data: Array<{
    candidate: DuplicateCandidate;
    otherComplaint: {
      id: string;
      trackingId: string;
      title: string;
      category: string;
      sector: string;
      status: string;
      createdAt: string;
    };
  }>;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }

  try {
    const safeComplaintId = complaintId.replace(/[^a-zA-Z0-9-]/g, '');
    if (!safeComplaintId) {
      return { data: [], error: new Error('Invalid complaintId provided.') };
    }

    // Fetch suggestions where complaint is either A or B
    const { data: rows, error: fetchErr } = await supabase
      .from('complaint_duplicates')
      .select('*')
      .or(`complaint_a_id.eq.${safeComplaintId},complaint_b_id.eq.${safeComplaintId}`)
      .order('similarity_score', { ascending: false });

    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return { data: [], error: null };
    }

    // Collect other complaint IDs
    const otherIds = rows.map((r) =>
      r.complaint_a_id === complaintId ? r.complaint_b_id : r.complaint_a_id
    );

    const { data: otherComplaints, error: otherErr } = await supabase
      .from('complaints')
      .select('id, tracking_id, title, category, sector, status, created_at')
      .in('id', otherIds);

    if (otherErr) throw otherErr;

    const otherMap = new Map(
      (otherComplaints || []).map((c) => [c.id, c])
    );

    const results = rows.map((r) => {
      const otherId = r.complaint_a_id === complaintId ? r.complaint_b_id : r.complaint_a_id;
      const other = otherMap.get(otherId);

      const candidate: DuplicateCandidate = {
        id: r.id,
        sourceComplaintId: r.complaint_a_id,
        candidateComplaintId: r.complaint_b_id,
        similarityScore: Number(r.similarity_score),
        status: r.status as DuplicateCandidateStatus,
        matchingSignals: r.matching_signals as unknown as DuplicateMatchingSignals,
        reviewNotes: r.review_notes,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };

      return {
        candidate,
        otherComplaint: {
          id: other?.id || otherId,
          trackingId: other?.tracking_id || 'UNKNOWN',
          title: other?.title || 'Unknown Complaint',
          category: other?.category || '',
          sector: other?.sector || '',
          status: other?.status || 'unknown',
          createdAt: other?.created_at || r.created_at,
        },
      };
    });

    return { data: results, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Dismisses an advisory duplicate suggestion with an optional administrator note.
 */
export async function dismissDuplicateSuggestion(
  suggestionId: string,
  note?: string | null
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId } = await verifyAdminSession();

    if (note && note.trim().length > 2000) {
      throw new Error('Dismissal note exceeds maximum allowable length of 2000 characters.');
    }

    if (!isSupabaseConfigured()) {
      return { success: true, error: null };
    }

    const { error: updateErr } = await supabase
      .from('complaint_duplicates')
      .update({
        status: 'dismissed',
        review_notes: note?.trim() || 'Dismissed by authorized administrator: Verified as distinct grievance.',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', suggestionId);

    if (updateErr) throw updateErr;

    // Log admin action audit entry
    const { data: suggestion } = await supabase
      .from('complaint_duplicates')
      .select('complaint_a_id')
      .eq('id', suggestionId)
      .maybeSingle();

    if (suggestion) {
      await supabase.from('admin_actions').insert({
        complaint_id: suggestion.complaint_a_id,
        admin_id: userId,
        action_type: 'dismiss_duplicate_suggestion',
        reason: note?.trim() || 'Dismissed duplicate suggestion as distinct incident.',
      });
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
 * Confirms an advisory duplicate candidate:
 * 1. Requires a mandatory reason (minimum 5 characters).
 * 2. Integrates with Phase 9 status workflow by transitioning the duplicate
 *    complaint to 'duplicate' status.
 * 3. Does NOT merge or delete records.
 * 4. Records immutable audit logs in complaint_status_history and admin_actions.
 */
export async function confirmDuplicateSuggestion(
  suggestionId: string,
  duplicateComplaintId: string,
  primaryComplaintId: string,
  reason: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId } = await verifyAdminSession();

    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      throw new Error('Confirming a duplicate complaint requires a mandatory justification reason (min 5 characters).');
    }
    if (trimmedReason.length > 2000) {
      throw new Error('Duplicate justification reason exceeds maximum allowable length of 2000 characters.');
    }

    // 1. Transition duplicate complaint status using Phase 9 state machine
    const transitionResult = await transitionComplaintStatus(
      duplicateComplaintId,
      'duplicate',
      `Confirmed duplicate of complaint ${primaryComplaintId}. Reason: ${trimmedReason}`
    );

    if (!transitionResult.success && transitionResult.error) {
      throw transitionResult.error;
    }

    // 2. Update complaint_duplicates suggestion row
    if (isSupabaseConfigured()) {
      const { error: updateErr } = await supabase
        .from('complaint_duplicates')
        .update({
          status: 'confirmed_duplicate',
          review_notes: trimmedReason,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateErr) throw updateErr;

      // 3. Log audit action
      await supabase.from('admin_actions').insert({
        complaint_id: duplicateComplaintId,
        admin_id: userId,
        action_type: 'confirm_duplicate',
        old_value: 'suggested',
        new_value: 'confirmed_duplicate',
        reason: trimmedReason,
      });
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
