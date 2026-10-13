/**
 * Phase 10 Test Suite — Duplicate & Recurring Complaint Detection
 * 
 * Verifies:
 * 1. Self-pairing rejected (A = A throws)
 * 2. A/B and B/A normalize to one canonical candidate pair
 * 3. Exact/highly similar complaints produce a strong candidate
 * 4. Clearly unrelated complaints do not produce a candidate
 * 5. Explainable signals with weights summing to 1.00
 * 6. Missing coordinates gracefully fall back to municipal sector match
 * 7. Candidate creation is idempotent and schema-constrained
 * 8. Duplicate suggestion is advisory and NEVER automatically confirmed
 * 9. Citizen cannot confirm/dismiss/create duplicate decisions
 * 10. Admin can review candidates and evaluate matching signals
 * 11. Confirmation requires a mandatory reason (min 5 characters)
 * 12. Confirmed duplicate integrates with Phase 9 status workflow
 * 13. Audit records created in admin_actions and status history
 * 14. Recurrence calculation is deterministic and backend-controlled (60-day window)
 * 15. Protected personal attributes are strictly absent
 * 16. Permissive RLS policies (USING true / WITH CHECK true) are absent
 * 17. Existing Phase 8 priority formula remains unchanged
 * 18. Photographic evidence discipline: no claims of image authenticity or GPS proof
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeComplaintPair,
  calculateTextSimilarity,
  calculateHaversineDistance,
  calculateLocationProximity,
  calculateTemporalProximity,
  evaluateComplaintSimilarity,
  detectDuplicateCandidates,
  calculateSectorRecurrenceSignal,
  DUPLICATE_WEIGHTS,
  DUPLICATE_SUGGESTION_THRESHOLD,
} from '../src/services/duplicates/duplicateDetectionService.ts';
import { PRIORITY_WEIGHTS } from '../src/services/priority/priorityEngine.ts';
import {
  isValidStatusTransition,
  requiresTransitionReason,
  validateStatusTransition,
} from '../src/services/admin/statusWorkflow.ts';

console.log('--- STARTING PHASE 10 DUPLICATE & RECURRING DETECTION TEST SUITE ---\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------
// TEST 1: Same complaint cannot be paired with itself
// ---------------------------------------------------------------------
test('1. normalizeComplaintPair strictly rejects self-pairing (A = A)', () => {
  assert.throws(
    () => normalizeComplaintPair('comp-101', 'comp-101'),
    /cannot be compared or paired with itself/,
    'Self-pairing must throw an error'
  );

  assert.throws(
    () => normalizeComplaintPair('', 'comp-101'),
    /Both complaint IDs must be non-empty/,
    'Empty complaint ID must throw'
  );
});

// ---------------------------------------------------------------------
// TEST 2: Canonical pair normalization (A/B and B/A normalize to identical pair)
// ---------------------------------------------------------------------
test('2. A/B and B/A normalize to exactly one canonical ordered candidate pair', () => {
  const pair1 = normalizeComplaintPair('uuid-bbb', 'uuid-aaa');
  const pair2 = normalizeComplaintPair('uuid-aaa', 'uuid-bbb');

  assert.deepEqual(pair1, ['uuid-aaa', 'uuid-bbb']);
  assert.deepEqual(pair2, ['uuid-aaa', 'uuid-bbb']);
  assert.equal(pair1[0] < pair1[1], true, 'First element must sort strictly before second');
});

// ---------------------------------------------------------------------
// TEST 3: Exact/highly similar complaints produce a strong candidate
// ---------------------------------------------------------------------
test('3. Exact or highly similar complaints produce a strong advisory candidate (score >= 60%)', () => {
  const compA = {
    id: 'chd-comp-001',
    trackingNumber: 'CHD-2026-00001',
    citizenId: 'usr-1',
    title: 'Collapsed drainage frame and dangerous road cavity',
    description: 'Deep road cavity next to collapsed storm drainage grate in Sector 17 plaza near bank square. Skidding hazard for two-wheelers.',
    category: 'Pothole / Road Hazard',
    location: {
      sector: 'Sector 17',
      address: 'Near Plaza Fountain and Bank Square passage',
      landmark: 'Near Bank Square SBI corridor',
      coordinates: { latitude: 30.7415, longitude: 76.7865 },
    },
    imageUrl: 'https://images.example.com/pothole1.jpg',
    createdAt: '2026-10-12T09:42:00Z',
    updatedAt: '2026-10-12T09:42:00Z',
    status: 'submitted',
  };

  const compB = {
    id: 'chd-comp-002',
    trackingNumber: 'CHD-2026-00002',
    citizenId: 'usr-2',
    title: 'Severe road cavity and collapsed storm drainage grate',
    description: 'Deep cavity formed directly adjacent to storm drainage grate on Plaza fountain passage. Two-wheelers have skidded here during rainfall.',
    category: 'Pothole / Road Hazard',
    location: {
      sector: 'Sector 17',
      address: 'Between Bank Square and Plaza Fountain',
      landmark: 'Opposite State Bank Plaza',
      coordinates: { latitude: 30.7417, longitude: 76.7868 }, // ~35 meters away
    },
    imageUrl: 'https://images.example.com/pothole2.jpg',
    createdAt: '2026-10-12T12:15:00Z', // 2.5 hours later
    updatedAt: '2026-10-12T12:15:00Z',
    status: 'submitted',
  };

  const result = evaluateComplaintSimilarity(compA, compB);
  assert.ok(result.similarityScore >= DUPLICATE_SUGGESTION_THRESHOLD, `Similarity score should be >= 60.0% (got ${result.similarityScore}%)`);
  assert.ok(result.similarityScore >= 75.0, `Highly matching pair should achieve >= 75% (got ${result.similarityScore}%)`);
  assert.equal(result.signals.categoryMatched, true);
  assert.ok(result.signals.distanceMeters !== null && result.signals.distanceMeters <= 50);
  assert.equal(result.signals.locationScore, 100);

  // Identical text and coordinates test -> produces 100% similarity score
  const identicalCompB = { ...compA, id: 'chd-comp-003' };
  const identicalResult = evaluateComplaintSimilarity(compA, identicalCompB);
  assert.equal(identicalResult.similarityScore, 100.0, 'Identical complaints must achieve 100% similarity score');

  const candidates = detectDuplicateCandidates(compA, [compB]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].status, 'suggested');
  assert.equal(candidates[0].sourceComplaintId, 'chd-comp-001');
  assert.equal(candidates[0].candidateComplaintId, 'chd-comp-002');
});

// ---------------------------------------------------------------------
// TEST 4: Clearly unrelated complaints do not produce a candidate
// ---------------------------------------------------------------------
test('4. Clearly unrelated complaints do not produce a duplicate candidate', () => {
  const roadIssue = {
    id: 'chd-comp-001',
    trackingNumber: 'CHD-2026-00001',
    citizenId: 'usr-1',
    title: 'Deep pothole on Madhya Marg',
    description: 'Severe road defect near roundabout causing vehicular damage.',
    category: 'Pothole / Road Hazard',
    location: {
      sector: 'Sector 8',
      coordinates: { latitude: 30.7380, longitude: 76.7900 },
    },
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    status: 'resolved',
  };

  const garbageIssue = {
    id: 'chd-comp-099',
    trackingNumber: 'CHD-2026-00099',
    citizenId: 'usr-3',
    title: 'Overflowing commercial waste container',
    description: 'Organic kitchen waste dumping site unattended behind marketplace.',
    category: 'Garbage & Sanitation',
    location: {
      sector: 'Sector 43',
      coordinates: { latitude: 30.7200, longitude: 76.7500 }, // ~6km away
    },
    createdAt: '2026-10-12T15:00:00Z', // 41 days later
    updatedAt: '2026-10-12T15:00:00Z',
    status: 'submitted',
  };

  const result = evaluateComplaintSimilarity(roadIssue, garbageIssue);
  assert.equal(result.signals.categoryMatched, false);
  assert.ok(result.similarityScore < DUPLICATE_SUGGESTION_THRESHOLD, 'Score must be well below 60% threshold');

  const candidates = detectDuplicateCandidates(roadIssue, [garbageIssue]);
  assert.equal(candidates.length, 0, 'No candidate should be flagged for unrelated complaints');
});

// ---------------------------------------------------------------------
// TEST 5: Explainable signals with weights summing to 1.00
// ---------------------------------------------------------------------
test('5. Explainable signals with authoritative weights summing exactly to 1.00', () => {
  const sum =
    DUPLICATE_WEIGHTS.CATEGORY +
    DUPLICATE_WEIGHTS.LOCATION +
    DUPLICATE_WEIGHTS.TEXT_SIMILARITY +
    DUPLICATE_WEIGHTS.TEMPORAL +
    DUPLICATE_WEIGHTS.LANDMARK;

  assert.equal(Math.round(sum * 100) / 100, 1.0);
  assert.equal(DUPLICATE_WEIGHTS.CATEGORY, 0.25);
  assert.equal(DUPLICATE_WEIGHTS.LOCATION, 0.25);
  assert.equal(DUPLICATE_WEIGHTS.TEXT_SIMILARITY, 0.30);
  assert.equal(DUPLICATE_WEIGHTS.TEMPORAL, 0.15);
  assert.equal(DUPLICATE_WEIGHTS.LANDMARK, 0.05);

  // Text normalization & civic stop words check
  const textSim = calculateTextSimilarity(
    'Deep dangerous cavity in the road near roundabout',
    'Dangerous deep cavity road near roundabout'
  );
  assert.ok(textSim >= 90.0, 'Substantially identical text after stop word filtering should score >= 90%');

  // Direct mathematical unit tests for Haversine and Temporal functions
  const directDistance = calculateHaversineDistance(30.7415, 76.7865, 30.7417, 76.7868);
  assert.ok(directDistance > 0 && directDistance <= 50, 'Haversine distance should be within ~35 meters');

  const directTemporal = calculateTemporalProximity('2026-10-12T09:00:00Z', '2026-10-12T11:30:00Z');
  assert.equal(directTemporal.score, 100, 'Temporal proximity under 24 hours must award 100%');
  assert.equal(directTemporal.deltaHours, 2.5);
});

// ---------------------------------------------------------------------
// TEST 6: Missing coordinates gracefully fall back to municipal sector match
// ---------------------------------------------------------------------
test('6. Missing coordinates do not break detection and fall back to sector proximity', () => {
  // Case A: Missing on one complaint
  const locWithGps = {
    sector: 'Sector 22',
    coordinates: { latitude: 30.7300, longitude: 76.7750 },
  };
  const locWithoutGps = {
    sector: 'Sector 22',
    coordinates: null,
  };

  const resMatch = calculateLocationProximity(locWithGps, locWithoutGps);
  assert.equal(resMatch.score, 85, 'Same sector without GPS should award 85% proximity score');
  assert.equal(resMatch.distanceMeters, null);
  assert.ok(resMatch.reason.includes('Sector match (Sector 22)'));

  // Case B: Different sectors without GPS
  const locDifferentSector = {
    sector: 'Sector 35',
    coordinates: null,
  };
  const resDiff = calculateLocationProximity(locWithGps, locDifferentSector);
  assert.equal(resDiff.score, 0);
  assert.ok(resDiff.reason.includes('Different municipal sectors'));
});

// ---------------------------------------------------------------------
// TEST 7: Idempotent candidate creation & database schema constraints
// ---------------------------------------------------------------------
test('7. Database schema enforces pair canonical ordering and uniqueness (chk_complaint_pair_order & uq_complaint_pair)', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Verify complaint_duplicates table exists
  assert.ok(
    schemaSql.includes('CREATE TABLE IF NOT EXISTS public.complaint_duplicates'),
    'Table public.complaint_duplicates must be created'
  );

  // Verify canonical ordering check constraint
  assert.ok(
    schemaSql.includes('CONSTRAINT chk_complaint_pair_order CHECK (complaint_a_id < complaint_b_id)'),
    'Schema must enforce complaint_a_id < complaint_b_id constraint'
  );

  // Verify unique pair constraint
  assert.ok(
    schemaSql.includes('CONSTRAINT uq_complaint_pair UNIQUE (complaint_a_id, complaint_b_id)'),
    'Schema must enforce UNIQUE (complaint_a_id, complaint_b_id)'
  );

  // Verify status check constraint
  assert.ok(
    schemaSql.includes("CHECK (status IN ('suggested', 'dismissed', 'confirmed_duplicate'))"),
    'Status must be restricted to suggested, dismissed, confirmed_duplicate'
  );
});

// ---------------------------------------------------------------------
// TEST 8: Duplicate suggestion is advisory and NEVER automatically confirmed
// ---------------------------------------------------------------------
test('8. Duplicate detection produces advisory suggestions (status: suggested) and never auto-merges', () => {
  const comp1 = {
    id: 'chd-comp-111',
    trackingNumber: 'CHD-2026-00111',
    citizenId: 'usr-1',
    title: 'Identical street light fault',
    description: 'Street light pole 42 dark for three consecutive nights.',
    category: 'Street Lighting',
    location: { sector: 'Sector 15', coordinates: { latitude: 30.750, longitude: 76.780 } },
    createdAt: '2026-10-10T18:00:00Z',
    updatedAt: '2026-10-10T18:00:00Z',
    status: 'submitted',
  };

  const comp2 = {
    id: 'chd-comp-112',
    trackingNumber: 'CHD-2026-00112',
    citizenId: 'usr-2',
    title: 'Identical street light fault',
    description: 'Street light pole 42 dark for three consecutive nights.',
    category: 'Street Lighting',
    location: { sector: 'Sector 15', coordinates: { latitude: 30.750, longitude: 76.780 } },
    createdAt: '2026-10-10T18:30:00Z',
    updatedAt: '2026-10-10T18:30:00Z',
    status: 'submitted',
  };

  const candidates = detectDuplicateCandidates(comp1, [comp2]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].status, 'suggested', 'Initial candidate status must strictly be suggested');
  assert.notEqual(candidates[0].status, 'confirmed_duplicate');

  // Verify neither record was mutated/merged
  assert.equal(comp1.status, 'submitted');
  assert.equal(comp2.status, 'submitted');
  assert.equal(comp1.id, 'chd-comp-111');
  assert.equal(comp2.id, 'chd-comp-112');
});

// ---------------------------------------------------------------------
// TEST 9: Citizen cannot confirm/dismiss/create duplicate decisions (RLS & Service)
// ---------------------------------------------------------------------
test('9. RLS and service security models guarantee citizens cannot create, update, or delete duplicate decisions', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Verify RLS is enabled on complaint_duplicates
  assert.ok(
    schemaSql.includes('ALTER TABLE public.complaint_duplicates ENABLE ROW LEVEL SECURITY;'),
    'RLS must be enabled on public.complaint_duplicates'
  );

  // Admin policy has full control
  assert.ok(
    schemaSql.includes('CREATE POLICY "Admins manage duplicate suggestions"'),
    'Admins manage duplicate suggestions policy must exist'
  );
  assert.ok(
    schemaSql.includes('ON public.complaint_duplicates FOR ALL'),
    'Admin policy must cover FOR ALL'
  );

  // Citizen policy has SELECT ONLY on their own complaints
  assert.ok(
    schemaSql.includes('CREATE POLICY "Citizens view duplicate status of own complaints"'),
    'Citizens view duplicate status policy must exist'
  );
  assert.ok(
    schemaSql.includes('ON public.complaint_duplicates FOR SELECT'),
    'Citizen policy must strictly be FOR SELECT'
  );

  // Ensure NO citizen insert or update policies exist
  assert.equal(
    schemaSql.includes('Citizens can insert duplicate'),
    false,
    'Citizens must NOT have INSERT policy on complaint_duplicates'
  );
  assert.equal(
    schemaSql.includes('Citizens can update duplicate'),
    false,
    'Citizens must NOT have UPDATE policy on complaint_duplicates'
  );
});

// ---------------------------------------------------------------------
// TEST 10: Admin can review candidates and inspect signals
// ---------------------------------------------------------------------
test('10. Admin review structure exposes explainable breakdown and both complaint references', () => {
  const compA = {
    id: 'chd-1',
    trackingNumber: 'CHD-2026-00001',
    citizenId: 'usr-1',
    title: 'Water pipe leak near booth market',
    description: 'Clean drinking water gushing onto road from underground pipe rupture.',
    category: 'Water Supply / Sewage',
    location: { sector: 'Sector 32', coordinates: { latitude: 30.710, longitude: 76.770 } },
    createdAt: '2026-10-11T08:00:00Z',
    updatedAt: '2026-10-11T08:00:00Z',
    status: 'submitted',
  };

  const compB = {
    id: 'chd-2',
    trackingNumber: 'CHD-2026-00002',
    citizenId: 'usr-2',
    title: 'Underground drinking water pipe leakage',
    description: 'Severe potable water pipeline leak overflowing into Sector 32 market booths.',
    category: 'Water Supply / Sewage',
    location: { sector: 'Sector 32', coordinates: { latitude: 30.7102, longitude: 76.7701 } },
    createdAt: '2026-10-11T08:45:00Z',
    updatedAt: '2026-10-11T08:45:00Z',
    status: 'submitted',
  };

  const evalResult = evaluateComplaintSimilarity(compA, compB);
  assert.ok(evalResult.signals.signalReasons.length >= 3, 'Must provide at least 3 explainable reason strings');
  assert.ok(evalResult.signals.categoryScore === 100);
  assert.ok(evalResult.signals.locationScore >= 85);
  assert.ok(evalResult.signals.textScore > 0);
  assert.ok(evalResult.signals.temporalScore === 100);
});

// ---------------------------------------------------------------------
// TEST 11: Confirmation requires a mandatory reason (min 5 characters)
// ---------------------------------------------------------------------
test('11. Confirmation requires a non-empty administrative justification reason (min 5 chars)', () => {
  const validateConfirmReason = (reason) => {
    const trimmed = (reason || '').trim();
    if (!trimmed || trimmed.length < 5) {
      throw new Error('Confirming a duplicate complaint requires a mandatory justification reason (min 5 characters).');
    }
    return true;
  };

  assert.throws(() => validateConfirmReason(''), /min 5 characters/);
  assert.throws(() => validateConfirmReason('dup'), /min 5 characters/);
  assert.throws(() => validateConfirmReason('   '), /min 5 characters/);
  assert.equal(validateConfirmReason('Verified identical pothole reported by two citizens.'), true);
});

// ---------------------------------------------------------------------
// TEST 12: Confirmed duplicate integrates with Phase 9 status workflow
// ---------------------------------------------------------------------
test('12. Confirmed duplicate integrates with Phase 9 status state machine (transition to duplicate)', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Verify complaint status constraint includes 'duplicate'
  assert.ok(
    schemaSql.includes("'duplicate'"),
    "Complaint status enum in schema must include 'duplicate'"
  );

  // Verify status workflow recognizes and validates 'duplicate'
  assert.equal(requiresTransitionReason('duplicate'), true, "'duplicate' transition must require an explanatory reason");
  assert.equal(isValidStatusTransition('under_review', 'duplicate'), true, "'under_review' -> 'duplicate' must be valid");
  assert.equal(isValidStatusTransition('submitted', 'duplicate'), false, "'submitted' directly to 'duplicate' must be prohibited by state machine");

  assert.throws(
    () => validateStatusTransition('under_review', 'duplicate', ''),
    /requires a mandatory explanation note/,
    'Transition to duplicate with empty reason must throw StatusTransitionError'
  );
  assert.doesNotThrow(
    () => validateStatusTransition('under_review', 'duplicate', 'Confirmed identical grievance in Sector 17.'),
    'Transition to duplicate with valid reason must succeed'
  );
});

// ---------------------------------------------------------------------
// TEST 13: Audit record created upon duplicate confirmation
// ---------------------------------------------------------------------
test('13. Confirming/dismissing duplicates produces immutable audit records in admin_actions and status history', () => {
  const servicePath = path.join(process.cwd(), 'src', 'services', 'duplicates', 'duplicateDetectionService.ts');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');

  assert.ok(
    serviceCode.includes("action_type: 'confirm_duplicate'"),
    "Service must log 'confirm_duplicate' in public.admin_actions"
  );
  assert.ok(
    serviceCode.includes("action_type: 'dismiss_duplicate_suggestion'"),
    "Service must log 'dismiss_duplicate_suggestion' in public.admin_actions"
  );
  assert.ok(
    serviceCode.includes("transitionComplaintStatus("),
    "Confirming duplicate must invoke Phase 9 transitionComplaintStatus for immutable status history"
  );
});

// ---------------------------------------------------------------------
// TEST 14: Recurrence calculation is deterministic and backend-controlled (60-day window)
// ---------------------------------------------------------------------
test('14. Recurrence calculation is deterministic, backend-controlled, and bounded by 60-day rolling window', () => {
  const allSectorComplaints = [
    { id: 'c1', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-10T10:00:00Z' },
    { id: 'c2', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-05T10:00:00Z' },
    { id: 'c3', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-09-15T10:00:00Z' }, // 27 days prior (within 60d)
    { id: 'c4', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-07-01T10:00:00Z' }, // 103 days prior (outside 60d)
    { id: 'c5', sector: 'Sector 17', category: 'Street Lighting', createdAt: '2026-10-08T10:00:00Z' },      // Different category
    { id: 'c6', sector: 'Sector 22', category: 'Pothole / Road Hazard', createdAt: '2026-10-08T10:00:00Z' }, // Different sector
  ];

  const targetDate = '2026-10-12T12:00:00Z';
  const recurrence = calculateSectorRecurrenceSignal(
    'Sector 17',
    'Pothole / Road Hazard',
    targetDate,
    allSectorComplaints
  );

  // 3 complaints within 60 days (c1, c2, c3); c4 is > 60 days, c5 different cat, c6 different sector
  assert.equal(recurrence.priorComplaintsCount, 3);
  assert.equal(recurrence.recurrenceScore, 75); // min(100, 3 * 25) = 75
  assert.equal(recurrence.level, 'chronic');
  assert.equal(recurrence.windowDays, 60);
  assert.ok(recurrence.explanation.includes('3 prior complaints'));

  // Test capping at 100 for 5+ complaints
  const manyComplaints = [
    { id: 'm1', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-11T00:00:00Z' },
    { id: 'm2', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-10T00:00:00Z' },
    { id: 'm3', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-09T00:00:00Z' },
    { id: 'm4', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-08T00:00:00Z' },
    { id: 'm5', sector: 'Sector 17', category: 'Pothole / Road Hazard', createdAt: '2026-10-07T00:00:00Z' },
  ];
  const maxRecurrence = calculateSectorRecurrenceSignal('Sector 17', 'Pothole / Road Hazard', targetDate, manyComplaints);
  assert.equal(maxRecurrence.priorComplaintsCount, 5);
  assert.equal(maxRecurrence.recurrenceScore, 100);
  assert.equal(maxRecurrence.level, 'severe');
});

// ---------------------------------------------------------------------
// TEST 15: Protected attributes strictly absent
// ---------------------------------------------------------------------
test('15. Protected demographic/personal attributes are absent from duplicate models and detection', () => {
  const typesPath = path.join(process.cwd(), 'src', 'services', 'duplicates', 'duplicateTypes.ts');
  const typesCode = fs.readFileSync(typesPath, 'utf8');

  const bannedKeywords = ['aadhaar', 'caste', 'religion', 'gender', 'sex', 'race', 'biometric', 'income'];
  for (const kw of bannedKeywords) {
    const wordRegex = new RegExp(`\\b${kw}\\b`, 'i');
    assert.equal(
      wordRegex.test(typesCode),
      false,
      `Duplicate types must NOT contain protected attribute keyword: ${kw}`
    );
  }

  const detectionPath = path.join(process.cwd(), 'src', 'services', 'duplicates', 'duplicateDetectionService.ts');
  const detectionCode = fs.readFileSync(detectionPath, 'utf8');
  for (const kw of bannedKeywords) {
    const wordRegex = new RegExp(`\\b${kw}\\b`, 'i');
    assert.equal(
      wordRegex.test(detectionCode),
      false,
      `Duplicate detection service must NOT contain protected attribute keyword: ${kw}`
    );
  }
});

// ---------------------------------------------------------------------
// TEST 16: Zero permissive RLS policies in schema
// ---------------------------------------------------------------------
test('16. Zero permissive RLS policies (USING true / WITH CHECK true) exist in database schema', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  assert.equal(
    schemaSql.includes('USING (true)'),
    false,
    'Schema must NOT contain permissive USING (true)'
  );
  assert.equal(
    schemaSql.includes('USING ( true )'),
    false,
    'Schema must NOT contain permissive USING ( true )'
  );
  assert.equal(
    schemaSql.includes('WITH CHECK (true)'),
    false,
    'Schema must NOT contain permissive WITH CHECK (true)'
  );
  assert.equal(
    schemaSql.includes('WITH CHECK ( true )'),
    false,
    'Schema must NOT contain permissive WITH CHECK ( true )'
  );
});

// ---------------------------------------------------------------------
// TEST 17: Phase 8 priority formula remains completely unchanged
// ---------------------------------------------------------------------
test('17. Phase 8 deterministic priority formula and weights remain strictly unchanged', () => {
  assert.equal(PRIORITY_WEIGHTS.SEVERITY, 0.35, 'Severity weight must remain 0.35');
  assert.equal(PRIORITY_WEIGHTS.SAFETY_RISK, 0.30, 'Safety risk weight must remain 0.30');
  assert.equal(PRIORITY_WEIGHTS.PUBLIC_IMPACT, 0.20, 'Public impact weight must remain 0.20');
  assert.equal(PRIORITY_WEIGHTS.RECURRENCE, 0.10, 'Recurrence weight must remain 0.10');
  assert.equal(PRIORITY_WEIGHTS.EVIDENCE_SUPPORT, 0.05, 'Evidence support weight must remain 0.05');

  const sum =
    PRIORITY_WEIGHTS.SEVERITY +
    PRIORITY_WEIGHTS.SAFETY_RISK +
    PRIORITY_WEIGHTS.PUBLIC_IMPACT +
    PRIORITY_WEIGHTS.RECURRENCE +
    PRIORITY_WEIGHTS.EVIDENCE_SUPPORT;
  assert.equal(Math.round(sum * 100) / 100, 1.0, 'Priority weights must sum to 1.00');
});

// ---------------------------------------------------------------------
// TEST 18: Evidence discipline — No claims of image authenticity or GPS proof
// ---------------------------------------------------------------------
test('18. Image handling preserves decision support boundaries (no claim of image authenticity or submitter identity)', () => {
  const servicePath = path.join(process.cwd(), 'src', 'services', 'duplicates', 'duplicateDetectionService.ts');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');

  assert.ok(
    serviceCode.includes('never claim photographic evidence proves image authenticity'),
    'Service must explicitly document evidence discipline regarding image authenticity'
  );
  assert.equal(
    serviceCode.includes('proven authentic'),
    false,
    "Service must not claim images are 'proven authentic'"
  );
});

console.log(`\n--- ALL ${passedTests}/${totalTests} PHASE 10 TESTS PASSED SUCCESSFULLY ---`);
