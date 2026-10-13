import assert from 'node:assert/strict';
import {
  validateAssessmentScores,
  evaluateHumanReviewFlags,
} from '../src/services/ai/aiAssessmentTypes.ts';
import { ServerBackendAIProvider } from '../src/services/ai/aiProvider.ts';
import {
  ACCEPTED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  validateEvidenceFile,
  generateEvidenceStoragePath,
} from '../src/services/evidenceService.ts';

console.log('--- STARTING PHASE 6 TEST SUITE ---');

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

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------
// TEST GROUP 1: Numeric Bounds (0-100) & Assessment Validation
// ---------------------------------------------------------------------

test('Valid scores within 0-100 pass validation', () => {
  const result = validateAssessmentScores({
    severity: 85.5,
    safetyRisk: 90,
    evidenceSupport: 72.3,
    imageQuality: 65,
    descriptionMatch: 80,
    publicImpact: 50,
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('Boundary values (0.0 and 100.0) pass validation', () => {
  const result = validateAssessmentScores({
    severity: 0,
    safetyRisk: 100,
    evidenceSupport: 0,
    imageQuality: 100,
    descriptionMatch: 50,
    publicImpact: 0,
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('Negative scores (< 0) are strictly rejected', () => {
  const result = validateAssessmentScores({
    severity: -1,
    evidenceSupport: 50,
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('severity')));
});

test('Scores greater than 100 (> 100) are strictly rejected', () => {
  const result = validateAssessmentScores({
    severity: 50,
    evidenceSupport: 100.5,
    safetyRisk: 120,
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('evidenceSupport')));
  assert.ok(result.errors.some((e) => e.includes('safetyRisk')));
});

test('NaN and non-numeric score values are rejected', () => {
  const result = validateAssessmentScores({
    severity: Number.NaN,
    // @ts-expect-error Testing runtime injection
    safetyRisk: 'eighty',
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.length >= 2);
});

test('Null and undefined scores are accepted for unanalyzed fields', () => {
  const result = validateAssessmentScores({
    severity: null,
    safetyRisk: null,
    evidenceSupport: null,
    imageQuality: undefined,
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

// ---------------------------------------------------------------------
// TEST GROUP 2: Human Review Flag Logic (Non-Rejection Policy)
// ---------------------------------------------------------------------

test('Low image quality (< 40) flags human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'completed',
    imageQuality: 35,
    evidenceSupport: 75,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('Low visual evidence quality')));
});

test('Low description match (< 40) flags human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'completed',
    imageQuality: 80,
    descriptionMatch: 25,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('Low description consistency')));
});

test('Low evidence support (< 40) flags human review without complaint rejection', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'completed',
    evidenceSupport: 30,
    imageQuality: 50,
    descriptionMatch: 60,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('Low evidence support')));
  // Verify it never returns a "rejected" state
  assert.ok(!JSON.stringify(result).toLowerCase().includes('reject'));
});

test('Severe safety hazard (>= 80) flags expedited human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'completed',
    safetyRisk: 88,
    evidenceSupport: 90,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('Severe public safety hazard')));
});

test('not_configured analysis state flags human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'not_configured',
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('not configured')));
});

test('failed analysis state flags human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'failed',
  });
  assert.equal(result.required, true);
  assert.ok(result.reasons.some((r) => r.includes('failure')));
});

test('Clean, high-confidence assessment does not flag human review', () => {
  const result = evaluateHumanReviewFlags({
    analysisState: 'completed',
    evidenceSupport: 85,
    imageQuality: 80,
    descriptionMatch: 90,
    safetyRisk: 45,
    humanReviewRequired: false,
  });
  assert.equal(result.required, false);
  assert.equal(result.reasons.length, 0);
});

// ---------------------------------------------------------------------
// TEST GROUP 3: AI Provider Abstraction & Truthful State
// ---------------------------------------------------------------------

await asyncTest('ServerBackendAIProvider reports not_configured and avoids fake scores', async () => {
  const provider = new ServerBackendAIProvider();
  assert.equal(provider.isConfigured, false);

  const assessment = await provider.analyzeComplaintEvidence({
    complaintId: 'test-uuid-1234',
    title: 'Damaged pavement near Sector 17',
    description: 'Cracked concrete slab posing trip hazard to pedestrians.',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
  });

  assert.equal(assessment.analysisState, 'not_configured');
  assert.equal(assessment.severity, null);
  assert.equal(assessment.safetyRisk, null);
  assert.equal(assessment.evidenceSupport, null);
  assert.equal(assessment.detectedIssue, null);
  assert.equal(assessment.humanReviewRequired, true);
  assert.ok(assessment.humanReviewReasons.length > 0);
  assert.ok(assessment.reasoningSummary?.includes('not yet configured'));
});

// ---------------------------------------------------------------------
// TEST GROUP 4: Evidence Service Guidelines & Path Convention
// ---------------------------------------------------------------------

test('Evidence MIME types strictly match municipal requirements', () => {
  assert.deepEqual([...ACCEPTED_EVIDENCE_MIME_TYPES], [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);
});

test('Evidence file size limit is strictly 10 MB', () => {
  assert.equal(MAX_EVIDENCE_FILE_SIZE_BYTES, 10 * 1024 * 1024);
});

test('validateEvidenceFile accepts valid image and rejects invalid MIME / oversized files', () => {
  // Valid JPEG
  const validFile = {
    type: 'image/jpeg',
    size: 2 * 1024 * 1024,
    name: 'pothole.jpg',
  };
  const validRes = validateEvidenceFile(validFile);
  assert.equal(validRes.isValid, true);

  // Invalid MIME (e.g. executable or GIF)
  const invalidMime = {
    type: 'application/pdf',
    size: 500 * 1024,
    name: 'document.pdf',
  };
  const invalidMimeRes = validateEvidenceFile(invalidMime);
  assert.equal(invalidMimeRes.isValid, false);
  assert.ok(invalidMimeRes.error?.includes('Unsupported image format'));

  // Oversized file (> 10MB)
  const oversizedFile = {
    type: 'image/png',
    size: 11 * 1024 * 1024,
    name: 'large.png',
  };
  const oversizedRes = validateEvidenceFile(oversizedFile);
  assert.equal(oversizedRes.isValid, false);
  assert.ok(oversizedRes.error?.includes('10 MB limit'));
});

test('generateEvidenceStoragePath follows complaints/{complaint_uuid}/{uuid}-{safe_filename}', () => {
  const complaintId = '11111111-2222-3333-4444-555555555555';
  const filename = 'road hazard & defect!!.png';
  const path = generateEvidenceStoragePath(complaintId, filename);

  assert.ok(path.startsWith(`complaints/${complaintId}/`));
  assert.ok(!path.includes(' '));
  assert.ok(!path.includes('&'));
  assert.ok(!path.includes('!'));
  assert.ok(path.endsWith('.png'));

  // Format regex: complaints/<uuid>/<uuid>-<safe_filename>
  const parts = path.split('/');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'complaints');
  assert.equal(parts[1], complaintId);
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY ---`);
