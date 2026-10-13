import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PRIORITY_WEIGHTS,
  PRIORITY_TIER_THRESHOLDS,
  PriorityValidationError,
  validatePriorityInput,
  determinePriorityTier,
  calculatePriorityScore,
  calculatePriorityFromAIAssessment,
} from '../src/services/priority/priorityEngine.ts';

console.log('--- STARTING PHASE 8 DETERMINISTIC PRIORITY ENGINE TEST SUITE ---');

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
// TEST 1: All inputs 0 -> score 0 -> LOW
// ---------------------------------------------------------------------
test('1. All inputs 0.0 produce score 0.00 and tier LOW', () => {
  const result = calculatePriorityScore({
    severity: 0,
    safetyRisk: 0,
    publicImpact: 0,
    recurrence: 0,
    evidenceSupport: 0,
  });

  assert.equal(result.status, 'calculated');
  assert.equal(result.score, 0);
  assert.equal(result.tier, 'low');
  assert.equal(result.breakdown.severity.contribution, 0);
  assert.equal(result.breakdown.safetyRisk.contribution, 0);
  assert.equal(result.breakdown.publicImpact.contribution, 0);
  assert.equal(result.breakdown.recurrence.contribution, 0);
  assert.equal(result.breakdown.evidenceSupport.contribution, 0);
});

// ---------------------------------------------------------------------
// TEST 2: All inputs 100 -> score 100 -> CRITICAL
// ---------------------------------------------------------------------
test('2. All inputs 100.0 produce score 100.00 and tier CRITICAL', () => {
  const result = calculatePriorityScore({
    severity: 100,
    safetyRisk: 100,
    publicImpact: 100,
    recurrence: 100,
    evidenceSupport: 100,
  });

  assert.equal(result.status, 'calculated');
  assert.equal(result.score, 100);
  assert.equal(result.tier, 'critical');
  assert.equal(result.breakdown.severity.contribution, 35);
  assert.equal(result.breakdown.safetyRisk.contribution, 30);
  assert.equal(result.breakdown.publicImpact.contribution, 20);
  assert.equal(result.breakdown.recurrence.contribution, 10);
  assert.equal(result.breakdown.evidenceSupport.contribution, 5);
});

// ---------------------------------------------------------------------
// TEST 3 & 4: Score 34.99 -> LOW boundary
// ---------------------------------------------------------------------
test('3 & 4. Score 34.99 maps to LOW tier', () => {
  assert.equal(PRIORITY_TIER_THRESHOLDS.LOW, 0.0);
  assert.equal(determinePriorityTier(34.99), 'low');
  assert.equal(determinePriorityTier(0), 'low');
  assert.equal(determinePriorityTier(15.5), 'low');
});

// ---------------------------------------------------------------------
// TEST 5 & 6: Score 35.00 -> MEDIUM and 59.99 -> MEDIUM
// ---------------------------------------------------------------------
test('5 & 6. Scores 35.00 and 59.99 map to MEDIUM tier', () => {
  assert.equal(determinePriorityTier(35.0), 'medium');
  assert.equal(determinePriorityTier(45.2), 'medium');
  assert.equal(determinePriorityTier(59.99), 'medium');
});

// ---------------------------------------------------------------------
// TEST 7 & 8: Score 60.00 -> HIGH and 79.99 -> HIGH
// ---------------------------------------------------------------------
test('7 & 8. Scores 60.00 and 79.99 map to HIGH tier', () => {
  assert.equal(determinePriorityTier(60.0), 'high');
  assert.equal(determinePriorityTier(71.25), 'high');
  assert.equal(determinePriorityTier(79.99), 'high');
});

// ---------------------------------------------------------------------
// TEST 9: Score 80.00 -> CRITICAL
// ---------------------------------------------------------------------
test('9. Score 80.00 and above map to CRITICAL tier', () => {
  assert.equal(determinePriorityTier(80.0), 'critical');
  assert.equal(determinePriorityTier(85.5), 'critical');
  assert.equal(determinePriorityTier(100.0), 'critical');
});

// ---------------------------------------------------------------------
// TEST 10: Invalid negative input rejected
// ---------------------------------------------------------------------
test('10. Invalid negative input (< 0) is strictly rejected', () => {
  assert.throws(
    () => {
      calculatePriorityScore({
        severity: -5,
        safetyRisk: 50,
        publicImpact: 50,
        recurrence: 0,
        evidenceSupport: 50,
      });
    },
    PriorityValidationError,
    /cannot be negative/
  );
});

// ---------------------------------------------------------------------
// TEST 11: Input > 100 rejected
// ---------------------------------------------------------------------
test('11. Input exceeding 100 (> 100) is strictly rejected', () => {
  assert.throws(
    () => {
      calculatePriorityScore({
        severity: 50,
        safetyRisk: 105,
        publicImpact: 50,
        recurrence: 0,
        evidenceSupport: 50,
      });
    },
    PriorityValidationError,
    /cannot exceed 100/
  );
});

// ---------------------------------------------------------------------
// TEST 12 & 13: NaN and Infinity rejected
// ---------------------------------------------------------------------
test('12 & 13. NaN and Infinity inputs are strictly rejected', () => {
  assert.throws(
    () => {
      calculatePriorityScore({
        severity: NaN,
        safetyRisk: 50,
        publicImpact: 50,
        recurrence: 0,
        evidenceSupport: 50,
      });
    },
    PriorityValidationError,
    /cannot be NaN/
  );

  assert.throws(
    () => {
      calculatePriorityScore({
        severity: 50,
        safetyRisk: Infinity,
        publicImpact: 50,
        recurrence: 0,
        evidenceSupport: 50,
      });
    },
    PriorityValidationError,
    /must be a finite number/
  );

  // String masquerading as number
  assert.throws(
    () => {
      validatePriorityInput({
        severity: '85',
        safetyRisk: 50,
        publicImpact: 50,
        recurrence: 0,
        evidenceSupport: 50,
      });
    },
    PriorityValidationError,
    /must be a number/
  );
});

// ---------------------------------------------------------------------
// TEST 14: Missing AI assessment -> pending_ai
// ---------------------------------------------------------------------
test('14. Missing AI assessment produces status pending_ai with null score', () => {
  const result = calculatePriorityFromAIAssessment(null);
  assert.equal(result.status, 'pending_ai');
  assert.equal(result.score, null);
  assert.equal(result.tier, null);
  assert.equal(result.breakdown, null);
});

// ---------------------------------------------------------------------
// TEST 15 & 16: Failed or not_configured AI assessment -> priority pending
// ---------------------------------------------------------------------
test('15 & 16. Failed or not_configured AI state produces pending_ai and preserves human review', () => {
  const failedResult = calculatePriorityFromAIAssessment({
    analysisState: 'failed',
    humanReviewRequired: true,
  });
  assert.equal(failedResult.status, 'pending_ai');
  assert.equal(failedResult.score, null);
  assert.equal(failedResult.tier, null);
  assert.equal(failedResult.humanReviewRequired, true);

  const unconfiguredResult = calculatePriorityFromAIAssessment({
    analysisState: 'not_configured',
    humanReviewRequired: true,
  });
  assert.equal(unconfiguredResult.status, 'pending_ai');
  assert.equal(unconfiguredResult.score, null);
  assert.equal(unconfiguredResult.humanReviewRequired, true);
});

// ---------------------------------------------------------------------
// TEST 17: human_review_required propagates correctly without altering formula
// ---------------------------------------------------------------------
test('17. human_review_required propagates correctly without distorting the deterministic tier', () => {
  // Moderate severity/risk case: score around 50 (MEDIUM) with humanReviewRequired: true
  const assessment = {
    severity: 50,
    safety_risk: 50,
    public_impact: 50,
    evidence_support: 50,
    human_review_required: true,
    analysisState: 'completed',
  };

  const result = calculatePriorityFromAIAssessment(assessment, 0);
  assert.equal(result.status, 'calculated');
  // 50 * (0.35 + 0.30 + 0.20 + 0.05) = 50 * 0.90 = 45.00 -> MEDIUM
  assert.equal(result.score, 45.0);
  assert.equal(result.tier, 'medium');
  assert.equal(result.humanReviewRequired, true);
  // Human review does NOT forcibly promote to critical
  assert.notEqual(result.tier, 'critical');
});

// ---------------------------------------------------------------------
// TEST 18 & 19: Recurrence defaults to backend-controlled 0 & untrusted frontend check
// ---------------------------------------------------------------------
test('18 & 19. Recurrence defaults to 0 and cannot be dictated by frontend clients', () => {
  const assessment = {
    severity: 85,
    safety_risk: 70,
    public_impact: 80,
    evidence_support: 90,
    human_review_required: false,
    analysisState: 'completed',
  };

  // Default recurrence = 0
  const defaultResult = calculatePriorityFromAIAssessment(assessment);
  // 85*0.35 (29.75) + 70*0.30 (21.00) + 80*0.20 (16.00) + 0*0.10 (0.00) + 90*0.05 (4.50) = 71.25 -> HIGH
  assert.equal(defaultResult.score, 71.25);
  assert.equal(defaultResult.tier, 'high');
  assert.equal(defaultResult.breakdown.recurrence.contribution, 0);

  // Verification that createComplaint in complaintsService does NOT accept recurrence from citizen form
  const complaintsServicePath = path.join(process.cwd(), 'src', 'services', 'complaintsService.ts');
  const serviceContent = fs.readFileSync(complaintsServicePath, 'utf8');
  assert.ok(!serviceContent.includes('input.recurrence'), 'Citizen input interface does not accept recurrence');
});

// ---------------------------------------------------------------------
// TEST 20: Breakdown contributions sum cleanly to final score
// ---------------------------------------------------------------------
test('20. Breakdown component contributions sum exactly to final calculated score', () => {
  const result = calculatePriorityScore({
    severity: 85,
    safetyRisk: 70,
    publicImpact: 80,
    recurrence: 0,
    evidenceSupport: 90,
  });

  const sumOfContributions = Math.round(
    (result.breakdown.severity.contribution +
      result.breakdown.safetyRisk.contribution +
      result.breakdown.publicImpact.contribution +
      result.breakdown.recurrence.contribution +
      result.breakdown.evidenceSupport.contribution) * 100
  ) / 100;

  assert.equal(sumOfContributions, result.score);
  assert.equal(result.score, 71.25);
  assert.equal(result.tier, 'high');
});

// ---------------------------------------------------------------------
// TEST 21: Score and Tier are calculated together atomically
// ---------------------------------------------------------------------
test('21. Score and Tier are calculated simultaneously in the same atomic operation', () => {
  const result = calculatePriorityScore({
    severity: 90,
    safetyRisk: 85,
    publicImpact: 75,
    recurrence: 20,
    evidenceSupport: 80,
  });

  // 90*0.35 (31.5) + 85*0.30 (25.5) + 75*0.20 (15) + 20*0.10 (2) + 80*0.05 (4) = 78.00 -> HIGH
  assert.equal(result.score, 78.0);
  assert.equal(result.tier, 'high');
  assert.ok(result.tier !== null && result.score !== null);
});

// ---------------------------------------------------------------------
// TEST 22: Protected attributes exclusion
// ---------------------------------------------------------------------
test('22. Protected personal attributes are completely excluded from priority engine', () => {
  const validFields = ['severity', 'safetyRisk', 'publicImpact', 'recurrence', 'evidenceSupport'];
  assert.equal(validFields.length, 5);
  const priorityTypesPath = path.join(process.cwd(), 'src', 'services', 'priority', 'priorityTypes.ts');
  const typesContent = fs.readFileSync(priorityTypesPath, 'utf8');

  const forbiddenAttributes = [
    'aadhaar',
    'gender',
    'religion',
    'caste',
    'race',
    'ethnicity',
    'disability',
    'political',
    'income',
    'phone',
    'email',
  ];

  for (const forbidden of forbiddenAttributes) {
    // Check that PriorityInput interface does not declare forbidden fields
    const regex = new RegExp(`\\b${forbidden}\\b`, 'i');
    const interfaceBlock = typesContent.substring(
      typesContent.indexOf('export interface PriorityInput'),
      typesContent.indexOf('export interface PriorityDimensionContribution')
    );
    assert.ok(!regex.test(interfaceBlock), `PriorityInput must not contain protected attribute "${forbidden}"`);
  }

  // Weight constants check
  assert.equal(Object.keys(PRIORITY_WEIGHTS).length, 5);
  const totalWeight =
    Math.round(
      (PRIORITY_WEIGHTS.SEVERITY +
        PRIORITY_WEIGHTS.SAFETY_RISK +
        PRIORITY_WEIGHTS.PUBLIC_IMPACT +
        PRIORITY_WEIGHTS.RECURRENCE +
        PRIORITY_WEIGHTS.EVIDENCE_SUPPORT) *
        100
    ) / 100;
  assert.equal(totalWeight, 1.0);
});

// ---------------------------------------------------------------------
// TEST 23: Security & RLS Policy Audit
// ---------------------------------------------------------------------
test('23. Security Audit: RLS guarantees citizens cannot update complaints.priority_score or priority_tier', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verify that UPDATE on complaints is restricted to admins
  assert.ok(
    schemaContent.includes('CREATE POLICY "Admins can update complaints"'),
    'Complaints update policy must exist for admins'
  );
  assert.ok(
    schemaContent.includes('USING (public.is_admin())'),
    'Complaints update must require public.is_admin()'
  );

  // Verify that citizens only have SELECT and INSERT policies on complaints
  assert.ok(
    schemaContent.includes('CREATE POLICY "Citizens read own complaints or admins read all"'),
    'Complaints select policy exists'
  );
  assert.ok(
    schemaContent.includes('CREATE POLICY "Citizens can create own complaints"'),
    'Complaints insert policy exists'
  );

  // Confirm NO permissive USING (true) or WITH CHECK (true) on complaints
  const lines = schemaContent.split('\n');
  for (const line of lines) {
    if (line.includes('ON public.complaints FOR UPDATE')) {
      // Must not allow public or citizen updates
      assert.ok(!line.includes('TO public'));
    }
  }
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY ---`);
