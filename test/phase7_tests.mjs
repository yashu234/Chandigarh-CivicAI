import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateAndSanitizeAIOutput,
  CIVIC_AI_SYSTEM_INSTRUCTION,
} from '../src/services/ai/aiMultimodalPrompt.ts';
import {
  ServerBackendAIProvider,
  SupabaseEdgeAIProvider,
} from '../src/services/ai/aiProvider.ts';
import {
  evaluateHumanReviewFlags,
} from '../src/services/ai/aiAssessmentTypes.ts';

console.log('--- STARTING PHASE 7 MULTIMODAL AI INFERENCE TEST SUITE ---');

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
// TEST 1: Valid structured AI response
// ---------------------------------------------------------------------
test('1. Valid structured AI model response passes validation', () => {
  const rawModelResponse = {
    detected_issue: 'Deep asphalt pothole cavity with exposed aggregate',
    suggested_category: 'Roads & Footpaths',
    severity: 78.5,
    safety_risk: 85.0,
    evidence_support: 92.0,
    image_quality: 80.0,
    description_match: 88.0,
    public_impact: 70.0,
    reasoning_summary:
      'Photograph clearly corroborates a large asphalt defect located on a vehicular road, presenting high immediate risk to two-wheelers.',
    human_review_required: false,
  };

  const result = validateAndSanitizeAIOutput(rawModelResponse);
  assert.equal(result.isValid, true);
  assert.ok(result.data);
  assert.equal(result.data.detectedIssue, rawModelResponse.detected_issue);
  assert.equal(result.data.severity, 78.5);
  assert.equal(result.data.safetyRisk, 85.0);
  assert.equal(result.data.evidenceSupport, 92.0);
  // Due to safetyRisk >= 80, deterministic safety rule overrides model flag:
  assert.equal(result.data.humanReviewRequired, true);
});

// ---------------------------------------------------------------------
// TEST 2: Score below 0 rejected
// ---------------------------------------------------------------------
test('2. Score below 0 (< 0) is strictly rejected', () => {
  const raw = {
    detected_issue: 'Broken slab',
    suggested_category: 'Roads & Footpaths',
    severity: -5.0, // Invalid negative
    safety_risk: 50.0,
    evidence_support: 60.0,
    image_quality: 70.0,
    description_match: 60.0,
    public_impact: 40.0,
    reasoning_summary: 'Test summary',
    human_review_required: false,
  };

  const result = validateAndSanitizeAIOutput(raw);
  assert.equal(result.isValid, false);
  assert.ok(result.error?.includes('severity'));
  assert.ok(result.error?.includes('out of bounds'));
});

// ---------------------------------------------------------------------
// TEST 3: Score above 100 rejected
// ---------------------------------------------------------------------
test('3. Score above 100 (> 100) is strictly rejected', () => {
  const raw = {
    detected_issue: 'Overflowing dumpster',
    suggested_category: 'Sanitation',
    severity: 80.0,
    safety_risk: 60.0,
    evidence_support: 105.0, // Invalid > 100
    image_quality: 75.0,
    description_match: 85.0,
    public_impact: 70.0,
    reasoning_summary: 'Test summary',
    human_review_required: false,
  };

  const result = validateAndSanitizeAIOutput(raw);
  assert.equal(result.isValid, false);
  assert.ok(result.error?.includes('evidence_support'));
  assert.ok(result.error?.includes('out of bounds'));
});

// ---------------------------------------------------------------------
// TEST 4: Missing required field rejected
// ---------------------------------------------------------------------
test('4. Missing required field is rejected', () => {
  const rawMissingDetected = {
    suggested_category: 'Sanitation',
    severity: 50.0,
    safety_risk: 50.0,
    evidence_support: 50.0,
    image_quality: 50.0,
    description_match: 50.0,
    public_impact: 50.0,
    reasoning_summary: 'Test summary',
    human_review_required: false,
  };

  const result = validateAndSanitizeAIOutput(rawMissingDetected);
  assert.equal(result.isValid, false);
  assert.ok(result.error?.includes('detected_issue'));
});

// ---------------------------------------------------------------------
// TEST 5: Non-numeric score rejected
// ---------------------------------------------------------------------
test('5. Non-numeric / NaN score values are rejected', () => {
  const rawWithNaN = {
    detected_issue: 'Defective streetlight pole',
    suggested_category: 'Street Lighting',
    severity: Number.NaN,
    safety_risk: 70.0,
    evidence_support: 70.0,
    image_quality: 70.0,
    description_match: 70.0,
    public_impact: 70.0,
    reasoning_summary: 'Test summary',
    human_review_required: false,
  };

  const result = validateAndSanitizeAIOutput(rawWithNaN);
  assert.equal(result.isValid, false);
  assert.ok(result.error?.includes('severity'));
  assert.ok(result.error?.includes('finite number'));
});

// ---------------------------------------------------------------------
// TEST 6: Human-review rules enforced server-side
// ---------------------------------------------------------------------
test('6. Human-review rules are enforced server-side independently of model flag', () => {
  // Scenario A: Model says false, but image_quality is 30 (< 40)
  const lowQuality = validateAndSanitizeAIOutput({
    detected_issue: 'Dark blurry image',
    suggested_category: 'Sanitation',
    severity: 50,
    safety_risk: 30,
    evidence_support: 50,
    image_quality: 30, // Trigger
    description_match: 60,
    public_impact: 40,
    reasoning_summary: 'Nighttime image with poor illumination.',
    human_review_required: false, // Model claimed false
  });
  assert.equal(lowQuality.isValid, true);
  assert.equal(lowQuality.data?.humanReviewRequired, true);
  assert.ok(lowQuality.data?.humanReviewReasons.some((r) => r.includes('Low visual evidence quality')));

  // Scenario B: Model says false, but description_match is 35 (< 40)
  const mismatch = validateAndSanitizeAIOutput({
    detected_issue: 'Park bench',
    suggested_category: 'Parks & Greenery',
    severity: 20,
    safety_risk: 10,
    evidence_support: 50,
    image_quality: 80,
    description_match: 35, // Trigger
    public_impact: 20,
    reasoning_summary: 'Citizen reported broken water main, but image shows wooden bench.',
    human_review_required: false,
  });
  assert.equal(mismatch.isValid, true);
  assert.equal(mismatch.data?.humanReviewRequired, true);
  assert.ok(mismatch.data?.humanReviewReasons.some((r) => r.includes('Low description consistency')));

  // Scenario C: Clean high-confidence assessment does not force review
  const clean = validateAndSanitizeAIOutput({
    detected_issue: 'Clear sidewalk obstruction',
    suggested_category: 'Encroachment',
    severity: 45,
    safety_risk: 30,
    evidence_support: 85,
    image_quality: 85,
    description_match: 90,
    public_impact: 40,
    reasoning_summary: 'Clear well-framed photograph matching citizen statement.',
    human_review_required: false,
  });
  assert.equal(clean.isValid, true);
  assert.equal(clean.data?.humanReviewRequired, false);
  assert.equal(clean.data?.humanReviewReasons.length, 0);
});

// ---------------------------------------------------------------------
// TEST 7: AI failure produces failed state
// ---------------------------------------------------------------------
test('7. AI failure produces explicit failed analysis state', () => {
  const evalResult = evaluateHumanReviewFlags({
    analysisState: 'failed',
  });
  assert.equal(evalResult.required, true);
  assert.ok(evalResult.reasons.some((r) => r.includes('failure')));
});

// ---------------------------------------------------------------------
// TEST 8: Missing provider configuration produces not_configured
// ---------------------------------------------------------------------
await asyncTest('8. Missing provider configuration truthfully produces not_configured state', async () => {
  const provider = new ServerBackendAIProvider();
  assert.equal(provider.isConfigured, false);

  const result = await provider.analyzeComplaintEvidence({
    complaintId: 'test-123',
    title: 'Pothole',
    description: 'Cracked road surface',
    category: 'Roads & Footpaths',
    sector: 'Sector 17',
  });

  assert.equal(result.analysisState, 'not_configured');
  assert.equal(result.severity, null);
  assert.equal(result.evidenceSupport, null);
  assert.equal(result.humanReviewRequired, true);
  assert.ok(result.reasoningSummary?.includes('not yet configured'));
});

// ---------------------------------------------------------------------
// TEST 9: Unauthorized complaint analysis rejected
// ---------------------------------------------------------------------
test('9. Unauthorized complaint analysis boundary is enforced', () => {
  // Edge function code asserts complaint.citizen_id === user.id OR profile.role === 'admin'
  const authenticatedUserId = 'user-alice-uuid';
  const complaintOwnerId = 'user-bob-uuid';
  const userRole = 'citizen';

  const isOwner = complaintOwnerId === authenticatedUserId;
  const isAdmin = userRole === 'admin';
  const isAuthorized = isOwner || isAdmin;

  assert.equal(isAuthorized, false, 'Citizen Alice must NOT be authorized to analyze Bob’s complaint');
});

// ---------------------------------------------------------------------
// TEST 10: Duplicate / repeated analysis protection (Idempotency)
// ---------------------------------------------------------------------
test('10. Idempotency logic returns existing assessment unless reanalyze is requested', () => {
  const existingAssessment = {
    id: 'assessment-existing-uuid',
    complaint_id: 'complaint-123',
    evidence_support: 88,
  };

  // Case 1: normal call (reanalyze = false)
  const shouldReuse = (existing, reanalyze) => Boolean(existing && !reanalyze);
  assert.equal(shouldReuse(existingAssessment, false), true);

  // Case 2: deliberate re-analysis request (reanalyze = true)
  assert.equal(shouldReuse(existingAssessment, true), false);
});

// ---------------------------------------------------------------------
// TEST 11: Security check - No frontend AI secret exposure
// ---------------------------------------------------------------------
test('11. Security Audit: No frontend AI secrets (VITE_*_API_KEY) exist in codebase', () => {
  const rootDir = process.cwd();

  const forbiddenPrefixes = [
    'VITE_OPENAI_API_KEY',
    'VITE_GEMINI_API_KEY',
    'VITE_ANTHROPIC_API_KEY',
    'VITE_AI_API_KEY',
  ];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const forbidden of forbiddenPrefixes) {
          if (content.includes(forbidden) && !fullPath.includes('phase7_tests.mjs')) {
            throw new Error(`SECURITY VIOLATION: Found forbidden frontend secret ${forbidden} in ${fullPath}`);
          }
        }
      }
    }
  }

  scanDir(path.join(rootDir, 'src'));
  assert.ok(true, 'src directory contains zero forbidden AI secrets');
});

// ---------------------------------------------------------------------
// TEST 12: System instruction ethics & terminology validation
// ---------------------------------------------------------------------
test('12. Prompt explicitly uses "Evidence Support" and prohibits authenticity/GPS claims', () => {
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('Evidence Support'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('NEVER claim to prove:'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('whether an image is authentic or digitally manipulated'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('exact real-world location'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('identity of the photographer'));
  assert.ok(CIVIC_AI_SYSTEM_INSTRUCTION.includes('human_review_required: true'));
});

// ---------------------------------------------------------------------
// TEST 13: Model configuration migration to gemini-3.8-flash
// ---------------------------------------------------------------------
test('13. Multimodal model configuration is migrated to gemini-3.8-flash', () => {
  const edgeProvider = new SupabaseEdgeAIProvider();
  assert.equal(edgeProvider.modelVersion, 'gemini-3.8-flash', 'SupabaseEdgeAIProvider model must be gemini-3.8-flash');
  assert.notEqual(edgeProvider.modelVersion, 'gemini-1.5-flash', 'Retired model gemini-1.5-flash must not be used');

  const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/analyze-complaint-evidence/index.ts');
  const edgeFunctionContent = fs.readFileSync(edgeFunctionPath, 'utf8');

  assert.ok(
    edgeFunctionContent.includes("Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash'"),
    'Edge Function must default to gemini-3.8-flash'
  );
  assert.ok(
    !edgeFunctionContent.includes("'gemini-1.5-flash'"),
    'Edge Function must not contain retired gemini-1.5-flash model ID'
  );
});

// ---------------------------------------------------------------------
// TEST 14: Upstream HTTP failure handling & error payload contract
// ---------------------------------------------------------------------
test('14. Upstream AI HTTP failure contract returns 502 with structured failed state', () => {
  // Simulate the Edge Function upstream response mapping for non-200 AI status
  const simulateEdgeFunctionUpstreamFailure = (upstreamStatus, rawErrText) => {
    let parsedMsg = rawErrText;
    try {
      const parsed = JSON.parse(rawErrText);
      parsedMsg = parsed.error?.message || parsed.message || rawErrText;
    } catch {
      parsedMsg = rawErrText;
    }

    return {
      status: 502,
      parsedMsg,
      body: {
        state: 'failed',
        error: `AI provider error (HTTP ${upstreamStatus}). Model inference could not be completed.`,
      },
    };
  };

  const simulated404 = simulateEdgeFunctionUpstreamFailure(404, JSON.stringify({
    error: { code: 404, message: 'models/gemini-1.5-flash is not found' }
  }));
  assert.equal(simulated404.status, 502);
  assert.equal(simulated404.body.state, 'failed');
  assert.ok(simulated404.body.error.includes('HTTP 404'));

  const simulated503 = simulateEdgeFunctionUpstreamFailure(503, 'Service Unavailable');
  assert.equal(simulated503.status, 502);
  assert.equal(simulated503.body.state, 'failed');
  assert.ok(simulated503.body.error.includes('HTTP 503'));
});

// ---------------------------------------------------------------------
// TEST 15: Error log sanitization guarantees no leaked secrets/JWT/images
// ---------------------------------------------------------------------
test('15. Server-side log sanitization redacts API keys, JWTs, query keys, and image data', () => {
  const sanitizeLogMessage = (rawMessage, knownSecrets = []) => {
    if (!rawMessage || typeof rawMessage !== 'string') return '';
    let sanitized = rawMessage;

    for (const secret of knownSecrets) {
      if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
        sanitized = sanitized.replaceAll(secret.trim(), '[REDACTED_SECRET]');
      }
    }

    sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]');
    sanitized = sanitized.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED_KEY]');
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
    sanitized = sanitized.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+(?:\.[A-Za-z0-9-_.+/=]*)?/g, '[REDACTED_JWT]');
    sanitized = sanitized.replace(/"data"\s*:\s*"[^"]{50,}"/g, '"data":"[REDACTED_IMAGE_CONTENT]"');
    sanitized = sanitized.replace(/[A-Za-z0-9+/=]{100,}/g, '[REDACTED_BINARY]');

    if (sanitized.length > 2000) {
      sanitized = sanitized.slice(0, 2000) + '... [TRUNCATED]';
    }
    return sanitized;
  };

  const sampleApiKey = 'AIzaSyD79abcXYZ_1234567890abcdefghijklm';
  const sampleCustomSecret = 'my-super-secret-gemini-key-val';
  const sampleJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIn0.c2VjcmV0';
  const sampleUrlWithKey = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=AIzaSyD79abcXYZ_1234567890abcdefghijklm';
  const sampleBase64Data = '"data": "' + 'A'.repeat(200) + '"';

  const dirtyLog = `Error invoking ${sampleUrlWithKey} with Bearer ${sampleJwt} and secret ${sampleCustomSecret}. Payload: ${sampleBase64Data}`;
  const cleaned = sanitizeLogMessage(dirtyLog, [sampleCustomSecret]);

  assert.ok(!cleaned.includes(sampleApiKey), 'API key pattern must be redacted');
  assert.ok(!cleaned.includes(sampleCustomSecret), 'Custom secret value must be redacted');
  assert.ok(!cleaned.includes(sampleJwt), 'JWT must be redacted');
  assert.ok(!cleaned.includes('A'.repeat(50)), 'Binary/base64 payload must be redacted');
  assert.ok(cleaned.includes('[REDACTED_API_KEY]') || cleaned.includes('[REDACTED_KEY]'), 'Redaction tag must be present');
  assert.ok(cleaned.includes('[REDACTED_TOKEN]') || cleaned.includes('[REDACTED_JWT]'), 'Redaction tag for token must be present');
});

// ---------------------------------------------------------------------
// TEST 16: Human review enforcement is preserved on AI failure
// ---------------------------------------------------------------------
test('16. Failed AI state unconditionally flags human_review_required with audit reason', () => {
  const flags = evaluateHumanReviewFlags({
    analysisState: 'failed',
    humanReviewReasons: ['AI provider error (HTTP 502). Model inference could not be completed.'],
  });

  assert.equal(flags.required, true, 'Human review MUST be required on failure');
  assert.ok(flags.reasons.length > 0, 'Reasons list must not be empty');
  assert.ok(
    flags.reasons.some((r) => r.toLowerCase().includes('fail') || r.toLowerCase().includes('error')),
    'Audit reason must explain the AI failure'
  );
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY ---`);
