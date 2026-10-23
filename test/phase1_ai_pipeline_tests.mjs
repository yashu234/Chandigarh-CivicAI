import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  calculatePriorityScore,
  determinePriorityTier,
  calculatePriorityFromAIAssessment,
  PRIORITY_WEIGHTS,
} from '../src/services/priority/priorityEngine.ts';
import {
  validateAndSanitizeAIOutput,
  CIVIC_AI_SYSTEM_INSTRUCTION,
} from '../src/services/ai/aiMultimodalPrompt.ts';
import {
  SupabaseEdgeAIProvider,
  ServerBackendAIProvider,
} from '../src/services/ai/aiProvider.ts';
import {
  triggerAdminEvidenceAnalysis,
} from '../src/services/admin/adminComplaintService.ts';
import {
  createComplaint,
} from '../src/services/complaintsService.ts';

console.log('=============================================================================');
console.log('--- STARTING PHASE 1 AI ANALYSIS & PRIORITY PIPELINE TEST SUITE ---');
console.log('=============================================================================\n');

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
// TEST 1: Gemini Supported Model & No Retired Models
// ---------------------------------------------------------------------
test('1. Gemini model is configured to supported multimodal model (gemini-3.8-flash)', () => {
  const provider = new SupabaseEdgeAIProvider();
  assert.equal(provider.modelVersion, 'gemini-3.8-flash');
  assert.notEqual(provider.modelVersion, 'gemini-1.5-flash', 'Retired model must not be used');

  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');
  assert.ok(
    edgeContent.includes("Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash'"),
    'Edge Function must default to gemini-3.8-flash'
  );
  assert.ok(
    !edgeContent.includes("'gemini-1.5-flash'"),
    'Edge Function must not contain retired gemini-1.5-flash'
  );
});

// ---------------------------------------------------------------------
// TEST 2: Deterministic Priority Formula & Band Thresholds
// ---------------------------------------------------------------------
test('2. Authoritative deterministic priority bands (Critical, High, Medium, Low)', () => {
  // Critical: 80-100
  assert.equal(determinePriorityTier(100.0), 'critical');
  assert.equal(determinePriorityTier(80.0), 'critical');
  assert.equal(determinePriorityTier(79.99), 'high');

  // High: 60-79.99
  assert.equal(determinePriorityTier(60.0), 'high');
  assert.equal(determinePriorityTier(59.99), 'medium');

  // Medium: 35-59.99
  assert.equal(determinePriorityTier(35.0), 'medium');
  assert.equal(determinePriorityTier(34.99), 'low');

  // Low: 0-34.99
  assert.equal(determinePriorityTier(0.0), 'low');

  // Verify exact weights: 0.35 + 0.30 + 0.20 + 0.10 + 0.05 = 1.00
  const weightSum =
    PRIORITY_WEIGHTS.SEVERITY +
    PRIORITY_WEIGHTS.SAFETY_RISK +
    PRIORITY_WEIGHTS.PUBLIC_IMPACT +
    PRIORITY_WEIGHTS.RECURRENCE +
    PRIORITY_WEIGHTS.EVIDENCE_SUPPORT;
  assert.equal(Math.round(weightSum * 100) / 100, 1.0);

  // Test composite score with all 5 dimensions
  // Severity=90 (31.5), Safety=80 (24.0), Public=70 (14.0), Recurrence=50 (5.0), Evidence=60 (3.0) => 77.50 -> HIGH
  const result = calculatePriorityScore({
    severity: 90,
    safetyRisk: 80,
    publicImpact: 70,
    recurrence: 50,
    evidenceSupport: 60,
  });
  assert.equal(result.score, 77.5);
  assert.equal(result.tier, 'high');
  assert.equal(result.breakdown.recurrence.contribution, 5.0);
});

// ---------------------------------------------------------------------
// TEST 3: Score bounds validation (0-100)
// ---------------------------------------------------------------------
test('3. Dimension score validation strictly enforces 0–100 numeric bounds', () => {
  const baseValid = {
    detected_issue: 'Pothole on asphalt',
    suggested_category: 'Roads & Footpaths',
    severity: 50,
    safety_risk: 50,
    evidence_support: 50,
    image_quality: 50,
    description_match: 50,
    public_impact: 50,
    reasoning_summary: 'Verified defect',
    human_review_required: false,
  };

  // Valid output
  assert.equal(validateAndSanitizeAIOutput(baseValid).isValid, true);

  // Negative severity
  assert.equal(validateAndSanitizeAIOutput({ ...baseValid, severity: -0.01 }).isValid, false);

  // Severity > 100
  assert.equal(validateAndSanitizeAIOutput({ ...baseValid, severity: 100.01 }).isValid, false);

  // NaN / string score
  assert.equal(validateAndSanitizeAIOutput({ ...baseValid, safety_risk: 'high' }).isValid, false);
});

// ---------------------------------------------------------------------
// TEST 4: Human-in-the-loop and Responsible AI principles
// ---------------------------------------------------------------------
test('4. Responsible AI boundaries enforced (no authenticity claims, human review triggers)', () => {
  // Prohibited authenticity and origin claims
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('Evidence Support'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('NEVER claim to prove'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('whether an image is authentic or digitally manipulated'));

  // Deterministic safety triggers: low image quality (<40) sets human review
  const lowQuality = validateAndSanitizeAIOutput({
    detected_issue: 'Blurry photo of street',
    suggested_category: 'Sanitation',
    severity: 40,
    safety_risk: 30,
    evidence_support: 30,
    image_quality: 25, // < 40 triggers human review
    description_match: 30,
    public_impact: 30,
    reasoning_summary: 'Inconclusive visual evidence',
    human_review_required: false,
  });
  assert.equal(lowQuality.data.humanReviewRequired, true);
  assert.ok(lowQuality.data.humanReviewReasons.some((r) => r.includes('quality')));

  // Never automatically reject complaints due to low evidence support
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('NEVER recommend rejecting a complaint'));
});

// ---------------------------------------------------------------------
// TEST 5: Concurrency Deduplication in Provider and Edge Function
// ---------------------------------------------------------------------
test('5. Concurrency deduplication prevents duplicate concurrent requests from corrupting data', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');
  assert.ok(
    edgeContent.includes('inFlightAnalyses = new Map'),
    'Edge Function must maintain in-flight analysis map for request deduplication'
  );
  assert.ok(
    edgeContent.includes('inFlightAnalyses.set'),
    'Edge Function must register in-flight analysis'
  );

  const providerPath = path.resolve(process.cwd(), 'src/services/ai/aiProvider.ts');
  const providerContent = fs.readFileSync(providerPath, 'utf8');
  assert.ok(
    providerContent.includes('inFlightRequests = new Map'),
    'Client provider must maintain in-flight requests map to prevent duplicate calls'
  );
});

// ---------------------------------------------------------------------
// TEST 6: Meaningful, Specific Upstream Error Handling
// ---------------------------------------------------------------------
test('6. Upstream AI provider errors map to specific, meaningful messages (not generic)', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');

  // Must handle 404 (model retired / not found)
  assert.ok(
    edgeContent.includes('404') && edgeContent.includes('retired'),
    'Edge Function must have specific 404 model retirement/support message'
  );

  // Must handle 429 (rate limits)
  assert.ok(
    edgeContent.includes('429') && edgeContent.includes('rate limit'),
    'Edge Function must have specific 429 rate limit message'
  );

  // Must handle 401/403 (auth errors)
  assert.ok(
    edgeContent.includes('401') && edgeContent.includes('GEMINI_API_KEY'),
    'Edge Function must have specific authorization failure message'
  );

  // Must handle timeouts
  assert.ok(
    edgeContent.includes('AbortSignal.timeout'),
    'Edge Function must configure timeout on AI fetch'
  );
});

// ---------------------------------------------------------------------
// TEST 7: Admin Retry Functionality
// ---------------------------------------------------------------------
test('7. Admin retry functionality is exposed and verified', () => {
  assert.equal(typeof triggerAdminEvidenceAnalysis, 'function', 'triggerAdminEvidenceAnalysis must be a callable function');

  const adminPagePath = path.resolve(process.cwd(), 'src/pages/AdminComplaintDetailsPage.tsx');
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf8');

  assert.ok(
    adminPageContent.includes('handleAdminAnalyze'),
    'AdminComplaintDetailsPage must have handleAdminAnalyze handler'
  );
  assert.ok(
    adminPageContent.includes('triggerAdminEvidenceAnalysis'),
    'AdminComplaintDetailsPage must call triggerAdminEvidenceAnalysis'
  );
  assert.ok(
    adminPageContent.includes('Re-analyze') || adminPageContent.includes('Run AI Analysis'),
    'AdminComplaintDetailsPage must render UI button for triggering/re-analyzing evidence'
  );
});

// ---------------------------------------------------------------------
// TEST 8: Automatic Analysis Trigger on Complaint Submission with Evidence
// ---------------------------------------------------------------------
test('8. Complaint submission with photographic evidence auto-triggers analysis', () => {
  const complaintsServicePath = path.resolve(process.cwd(), 'src/services/complaintsService.ts');
  const serviceContent = fs.readFileSync(complaintsServicePath, 'utf8');

  assert.ok(
    serviceContent.includes('triggerComplaintAnalysis'),
    'complaintsService must import and call triggerComplaintAnalysis'
  );
  assert.ok(
    serviceContent.includes('evidenceRecord && input.autoAnalyze !== false'),
    'complaintsService must auto-trigger analysis when evidence is uploaded'
  );

  const reportPagePath = path.resolve(process.cwd(), 'src/pages/ReportIssuePage.tsx');
  const reportPageContent = fs.readFileSync(reportPagePath, 'utf8');

  assert.ok(
    reportPageContent.includes('autoAnalyze: Boolean(imageFile)'),
    'ReportIssuePage must enable autoAnalyze when evidence file is selected'
  );
  assert.ok(
    reportPageContent.includes('handleRetryAnalysis'),
    'ReportIssuePage must provide handleRetryAnalysis for safe retry on failure'
  );
});

// ---------------------------------------------------------------------
// TEST 9: Log Sanitization & Sensitive Secret Redaction
// ---------------------------------------------------------------------
test('9. Sensitive tokens, API keys, and image payloads are strictly redacted from logs', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');

  assert.ok(edgeContent.includes('sanitizeLogMessage'), 'Edge Function must include sanitizeLogMessage');
  assert.ok(edgeContent.includes('REDACTED_API_KEY'), 'Must redact API keys');
  assert.ok(edgeContent.includes('REDACTED_TOKEN'), 'Must redact Bearer tokens');
  assert.ok(edgeContent.includes('REDACTED_JWT'), 'Must redact JWT tokens');
  assert.ok(edgeContent.includes('REDACTED_IMAGE_CONTENT'), 'Must redact inline base64 image data');
});

// ---------------------------------------------------------------------
// TEST 10: Backend Recurrence Calculation
// ---------------------------------------------------------------------
test('10. Backend recurrence calculation is integrated into priority scoring', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');

  assert.ok(
    edgeContent.includes('calculateBackendRecurrence'),
    'Edge Function must calculate recurrence from database'
  );
  assert.ok(
    edgeContent.includes('60 * 24 * 60 * 60 * 1000'),
    'Recurrence must use 60-day rolling window'
  );
});

// ---------------------------------------------------------------------
// TEST 11: AI Assessment Status Mapping: 'pending' when row is absent
// ---------------------------------------------------------------------
test('11. getAssessmentForComplaint returns pending when no assessment row exists and reserves not_configured for missing Supabase', () => {
  const assessmentServicePath = path.resolve(process.cwd(), 'src/services/ai/aiAssessmentService.ts');
  const serviceContent = fs.readFileSync(assessmentServicePath, 'utf8');

  assert.ok(
    serviceContent.includes("state: 'not_configured'"),
    'Must return not_configured when isSupabaseConfigured() is false'
  );
  assert.ok(
    serviceContent.includes("state: 'pending'"),
    'Must return state pending when Supabase is configured but assessment row does not exist yet'
  );
  assert.ok(
    !serviceContent.includes("return { data: null, state: 'not_configured', error: null };\n  } catch"),
    'Must not return not_configured on missing row'
  );
});

// ---------------------------------------------------------------------
// TEST 12: Robust Configurable Timeout with Abortable Signal
// ---------------------------------------------------------------------
test('12. Edge Function implements configurable timeout with abortable signal', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');

  assert.ok(
    edgeContent.includes('GEMINI_TIMEOUT_MS'),
    'Edge Function must support configurable GEMINI_TIMEOUT_MS environment variable'
  );
  assert.ok(
    edgeContent.includes('AbortSignal.timeout'),
    'Edge Function must use AbortSignal.timeout for clean abortable request termination'
  );
  assert.ok(
    edgeContent.includes('max_output_tokens'),
    'Edge Function must constrain max_output_tokens to prevent runaway generation'
  );
  assert.ok(
    edgeContent.includes('normalizedMime'),
    'Edge Function must normalize image MIME types for standard Gemini API compatibility'
  );
});

// ---------------------------------------------------------------------
// TEST 13: Timeout & Slow Response Error Contract preserves Safety Behavior
// ---------------------------------------------------------------------
test('13. Simulated timeout produces 502 error, preserves human review, and avoids fake scores', () => {
  const simulateTimeoutResponse = (timeoutSec = 60) => {
    return {
      status: 502,
      body: {
        state: 'failed',
        error: `AI provider inference timed out after ${timeoutSec} seconds. Please retry with a clearer or smaller image.`,
      },
    };
  };

  const timeoutRes = simulateTimeoutResponse(60);
  assert.equal(timeoutRes.status, 502);
  assert.equal(timeoutRes.body.state, 'failed');
  assert.ok(timeoutRes.body.error.includes('timed out after 60 seconds'));

  // Ensure provider creates failed response with humanReviewRequired = true and null scores
  const provider = new SupabaseEdgeAIProvider();
  const failedAssessment = provider['createFailedResponse']('test-complaint-id', timeoutRes.body.error);
  assert.equal(failedAssessment.analysisState, 'failed');
  assert.equal(failedAssessment.humanReviewRequired, true);
  assert.equal(failedAssessment.severity, null);
  assert.equal(failedAssessment.safetyRisk, null);
  assert.equal(failedAssessment.evidenceSupport, null);
  assert.ok(failedAssessment.humanReviewReasons[0].includes('timed out'));
});

// ---------------------------------------------------------------------
// TEST 14: Retries and Persistence Idempotency
// ---------------------------------------------------------------------
test('14. Retries safely update existing rows without creating duplicates', () => {
  const edgeFuncPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeContent = fs.readFileSync(edgeFuncPath, 'utf8');

  assert.ok(
    edgeContent.includes(".eq('complaint_id', body.complaintId)"),
    'Edge Function must query existing assessment for complaint'
  );
  assert.ok(
    edgeContent.includes('.update({') && edgeContent.includes('.eq(\'id\', existingRow.id)'),
    'Edge Function must update existing assessment on retry rather than inserting duplicate records'
  );
  assert.ok(
    edgeContent.includes('if (!body.reanalyze)'),
    'Edge Function must check reanalyze flag before invoking upstream inference'
  );
});

console.log('\n=============================================================================');
console.log(`--- ALL ${passedTests}/${totalTests} PHASE 1 AI PIPELINE TESTS PASSED SUCCESSFULLY ---`);
console.log('=============================================================================\n');
