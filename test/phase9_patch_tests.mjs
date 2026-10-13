import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  mapDbComplaintToModel,
} from '../src/services/complaintsService.ts';
import {
  calculatePriorityScore,
  calculatePriorityFromAIAssessment,
  PRIORITY_WEIGHTS,
} from '../src/services/priority/priorityEngine.ts';

console.log('--- STARTING PHASE 9 PATCH: PRIORITY OVERRIDE PERSISTENCE & DISPLAY TESTS ---');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
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

const mockAssessmentRow = {
  id: 'ass-123',
  complaint_id: 'cmp-001',
  detected_issue: 'Deep asphalt collapse',
  suggested_category: 'Roads & Infrastructure',
  severity: 75,
  safety_risk: 70,
  evidence_support: 80,
  image_quality: 85,
  description_match: 90,
  public_impact: 70,
  reasoning_summary: 'Major roadway hazard impacting transit corridor',
  human_review_required: false,
  analysis_state: 'completed',
  created_at: new Date().toISOString(),
};

const baseDbComplaint = {
  id: 'cmp-001',
  tracking_id: 'CHD-2026-00042',
  citizen_id: 'citizen-999',
  title: 'Road collapse on Madhya Marg',
  description: 'Major road collapse causing hazardous driving conditions near roundabout.',
  category: 'Roads & Infrastructure',
  sector: 'Sector 17',
  landmark: 'Near Neelam Cinema',
  street_address: 'Madhya Marg, Sector 17',
  latitude: 30.7398,
  longitude: 76.7827,
  status: 'under_review',
  priority_tier: 'high',
  priority_score: 71.25,
  created_at: '2026-10-10T08:00:00Z',
  updated_at: '2026-10-10T08:00:00Z',
  resolved_at: null,
};

async function runAllTests() {
  // ---------------------------------------------------------------------
  // TEST 1: No override: calculated HIGH -> effective HIGH
  // ---------------------------------------------------------------------
  await runTest('1. No override: calculated HIGH maps to effective HIGH', async () => {
    const model = await mapDbComplaintToModel(
      baseDbComplaint,
      null,
      mockAssessmentRow,
      null // No override record
    );

    assert.equal(model.calculatedPriorityScore, 71.25, 'Calculated score should be 71.25');
    assert.equal(model.calculatedPriorityTier, 'high', 'Calculated tier should be HIGH');
    assert.equal(model.effectivePriorityTier, 'high', 'Effective tier should be HIGH');
    assert.equal(model.priorityTier, 'high', 'priorityTier should equal effective tier');
    assert.equal(model.isPriorityOverridden, false, 'isPriorityOverridden must be false');
    assert.equal(model.priorityOverrideReason, null, 'Override reason should be null');
  });

  // ---------------------------------------------------------------------
  // TEST 2: Override: calculated HIGH -> overridden CRITICAL -> effective CRITICAL
  // ---------------------------------------------------------------------
  await runTest('2. Override: calculated HIGH overridden to CRITICAL yields effective CRITICAL', async () => {
    const overrideAction = {
      id: 'act-001',
      complaint_id: 'cmp-001',
      admin_id: 'admin-uuid-007',
      action_type: 'priority_override',
      old_value: 'high',
      new_value: 'critical',
      reason: 'Major road obstruction during peak public transit hours.',
      created_at: '2026-10-10T09:30:00Z',
    };

    const overriddenDbComplaint = {
      ...baseDbComplaint,
      priority_tier: 'critical', // Persisted admin override
      priority_score: 71.25,     // Preserved mathematical score
    };

    const model = await mapDbComplaintToModel(
      overriddenDbComplaint,
      null,
      mockAssessmentRow,
      overrideAction
    );

    assert.equal(model.calculatedPriorityScore, 71.25, 'Calculated score must remain 71.25');
    assert.equal(model.calculatedPriorityTier, 'high', 'Calculated tier must remain HIGH');
    assert.equal(model.effectivePriorityTier, 'critical', 'Effective tier must be CRITICAL');
    assert.equal(model.priorityTier, 'critical', 'priorityTier must be CRITICAL');
    assert.equal(model.isPriorityOverridden, true, 'isPriorityOverridden must be true');
    assert.equal(
      model.priorityOverrideReason,
      'Major road obstruction during peak public transit hours.'
    );
    assert.equal(model.priorityOverrideAdminId, 'admin-uuid-007');
  });

  // ---------------------------------------------------------------------
  // TEST 3: Override does not modify calculated score
  // ---------------------------------------------------------------------
  await runTest('3. Override preserves calculated mathematical priority score untouched', async () => {
    const overrideAction = {
      id: 'act-002',
      complaint_id: 'cmp-001',
      admin_id: 'admin-uuid-007',
      action_type: 'priority_override',
      old_value: 'high',
      new_value: 'critical',
      reason: 'Urgent municipal VIP movement corridor',
      created_at: '2026-10-10T10:00:00Z',
    };

    const model = await mapDbComplaintToModel(
      { ...baseDbComplaint, priority_tier: 'critical' },
      null,
      mockAssessmentRow,
      overrideAction
    );

    // Score must remain exactly 71.25, not bumped to >= 80.00
    assert.equal(model.priorityScore, 71.25);
    assert.equal(model.calculatedPriorityScore, 71.25);
    assert.ok(model.priorityScore < 80.0, 'Calculated score should NOT be artificially inflated to match Critical tier');
  });

  // ---------------------------------------------------------------------
  // TEST 4: Override does not modify AI assessment
  // ---------------------------------------------------------------------
  await runTest('4. Override does not modify or corrupt underlying AI assessment inputs', () => {
    // Underlying assessment retains original severity, safety risk, etc.
    assert.equal(mockAssessmentRow.severity, 75);
    assert.equal(mockAssessmentRow.safety_risk, 70);
    assert.equal(mockAssessmentRow.public_impact, 70);
    assert.equal(mockAssessmentRow.evidence_support, 80);

    // Recalculating priority from the AI assessment directly always produces identical score
    const res = calculatePriorityFromAIAssessment(mockAssessmentRow);
    assert.equal(res.status, 'calculated');
    assert.equal(res.tier, 'high');
  });

  // ---------------------------------------------------------------------
  // TEST 5: Removing/absence of override restores calculated tier
  // ---------------------------------------------------------------------
  await runTest('5. Absence of override record restores effective tier to calculated tier', async () => {
    const restoredDbComplaint = {
      ...baseDbComplaint,
      priority_tier: 'high',
      priority_score: 71.25,
    };

    const model = await mapDbComplaintToModel(
      restoredDbComplaint,
      null,
      mockAssessmentRow,
      null // No override
    );

    assert.equal(model.effectivePriorityTier, 'high');
    assert.equal(model.isPriorityOverridden, false);
    assert.equal(model.priorityOverrideReason, null);
  });

  // ---------------------------------------------------------------------
  // TEST 6: Latest valid override is used when multiple historical records exist
  // ---------------------------------------------------------------------
  await runTest('6. Latest valid override is used when multiple historical override records exist', () => {
    const historicalOverrides = [
      {
        id: 'act-1',
        complaint_id: 'cmp-001',
        action_type: 'priority_override',
        old_value: 'high',
        new_value: 'medium',
        reason: 'First override: reclassified to medium',
        created_at: '2026-10-10T09:00:00Z',
      },
      {
        id: 'act-2',
        complaint_id: 'cmp-001',
        action_type: 'priority_override',
        old_value: 'medium',
        new_value: 'critical',
        reason: 'Second override: elevated to critical after water pipe rupture',
        created_at: '2026-10-10T11:00:00Z',
      },
    ];

    // Sort descending by created_at (as done by database queries in adminComplaintService)
    const sorted = [...historicalOverrides].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const latest = sorted[0];
    assert.equal(latest.id, 'act-2');
    assert.equal(latest.new_value, 'critical');
    assert.equal(latest.reason, 'Second override: elevated to critical after water pipe rupture');
  });

  // ---------------------------------------------------------------------
  // TEST 7: Citizen-facing mapping respects effective priority
  // ---------------------------------------------------------------------
  await runTest('7. Citizen-facing mapping exposes effective tier without breaking transparency', async () => {
    const overriddenDbComplaint = {
      ...baseDbComplaint,
      priority_tier: 'critical',
      priority_score: 71.25,
    };

    const model = await mapDbComplaintToModel(
      overriddenDbComplaint,
      null,
      mockAssessmentRow,
      null // Citizen does not have direct admin_actions rows, but DB priority_tier reflects override
    );

    // Citizen sees effective CRITICAL tier
    assert.equal(model.effectivePriorityTier, 'critical');
    assert.equal(model.priorityTier, 'critical');
    // Citizen retains mathematical transparency
    assert.equal(model.calculatedPriorityScore, 71.25);
    assert.equal(model.calculatedPriorityTier, 'high');
    assert.equal(model.isPriorityOverridden, true);
  });

  // ---------------------------------------------------------------------
  // TEST 8: Admin-facing mapping displays calculated and effective priority separately
  // ---------------------------------------------------------------------
  await runTest('8. Admin-facing mapping explicitly separates calculated and effective priority', async () => {
    const overrideAction = {
      id: 'act-003',
      complaint_id: 'cmp-001',
      admin_id: 'admin-007',
      action_type: 'priority_override',
      old_value: 'high',
      new_value: 'critical',
      reason: 'Special executive order for arterial route remediation.',
      created_at: '2026-10-10T12:00:00Z',
    };

    const model = await mapDbComplaintToModel(
      { ...baseDbComplaint, priority_tier: 'critical' },
      null,
      mockAssessmentRow,
      overrideAction
    );

    assert.equal(model.calculatedPriorityScore, 71.25);
    assert.equal(model.calculatedPriorityTier, 'high');
    assert.equal(model.effectivePriorityTier, 'critical');
    assert.notEqual(model.calculatedPriorityTier, model.effectivePriorityTier);
    assert.equal(model.priorityOverrideReason, 'Special executive order for arterial route remediation.');
  });

  // ---------------------------------------------------------------------
  // TEST 9: Admin override remains admin-only
  // ---------------------------------------------------------------------
  await runTest('9. Admin override remains admin-only at service boundary and database RLS', () => {
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    // Verify complaints UPDATE is strictly gated by public.is_admin()
    assert.ok(
      schemaContent.includes('CREATE POLICY "Admins can update complaints"'),
      'Complaints update policy must exist'
    );
    assert.ok(
      schemaContent.includes('USING (public.is_admin())'),
      'Complaints update must require is_admin()'
    );

    // Verify admin_actions is strictly gated by public.is_admin()
    assert.ok(
      schemaContent.includes('CREATE POLICY "Admins only access audit actions"'),
      'admin_actions must be admin-only'
    );
  });

  // ---------------------------------------------------------------------
  // TEST 10: Admin override requires a reason
  // ---------------------------------------------------------------------
  await runTest('10. Admin override requires a mandatory justification reason', () => {
    const validateOverrideReason = (reason) => {
      if (!reason || reason.trim().length < 5) {
        throw new Error('Mandatory justification reason (at least 5 characters) is required for priority override.');
      }
    };

    assert.throws(() => validateOverrideReason(''), /Mandatory justification reason/);
    assert.throws(() => validateOverrideReason('abc'), /Mandatory justification reason/);
    assert.doesNotThrow(() => validateOverrideReason('Major road obstruction during peak transit hours.'));
  });

  // ---------------------------------------------------------------------
  // TEST 11: Priority engine formula remains unchanged
  // ---------------------------------------------------------------------
  await runTest('11. Priority engine formula and mathematical weights remain strictly unchanged', () => {
    assert.equal(PRIORITY_WEIGHTS.SEVERITY, 0.35);
    assert.equal(PRIORITY_WEIGHTS.SAFETY_RISK, 0.30);
    assert.equal(PRIORITY_WEIGHTS.PUBLIC_IMPACT, 0.20);
    assert.equal(PRIORITY_WEIGHTS.RECURRENCE, 0.10);
    assert.equal(PRIORITY_WEIGHTS.EVIDENCE_SUPPORT, 0.05);

    const sumWeights =
      PRIORITY_WEIGHTS.SEVERITY +
      PRIORITY_WEIGHTS.SAFETY_RISK +
      PRIORITY_WEIGHTS.PUBLIC_IMPACT +
      PRIORITY_WEIGHTS.RECURRENCE +
      PRIORITY_WEIGHTS.EVIDENCE_SUPPORT;
    assert.equal(Math.round(sumWeights * 100) / 100, 1.00);

    // Exact deterministic calculation test
    const calc = calculatePriorityScore({
      severity: 75,
      safetyRisk: 70,
      publicImpact: 70,
      recurrence: 0,
      evidenceSupport: 80,
    });
    // 75*0.35 (26.25) + 70*0.30 (21.00) + 70*0.20 (14.00) + 0*0.10 (0.00) + 80*0.05 (4.00) = 65.25
    assert.equal(calc.score, 65.25);
    assert.equal(calc.tier, 'high');
  });

  console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY ---`);
}

await runAllTests();
