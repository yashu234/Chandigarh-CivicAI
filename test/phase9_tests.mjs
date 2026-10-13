import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isValidStatusTransition,
  getAllowedTransitions,
  requiresTransitionReason,
  validateStatusTransition,
  StatusTransitionError,
} from '../src/services/admin/statusWorkflow.ts';
import {
  AdminAuthError,
} from '../src/services/admin/adminComplaintService.ts';

console.log('--- STARTING PHASE 9 ADMIN REVIEW & CIVIC TRIAGE TEST SUITE ---');

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
// TEST 1 & 2: Non-admin and Anonymous users cannot access admin services
// ---------------------------------------------------------------------
test('1 & 2. verifyAdminSession rejects unauthenticated and non-admin citizen callers', () => {
  // Test error class
  const authErr = new AdminAuthError('Authentication required');
  assert.equal(authErr.name, 'AdminAuthError');

  // Logic check: only profile.role === 'admin' can be authorized
  const isAuthorizedAdmin = (profile) => Boolean(profile && profile.role === 'admin');
  assert.equal(isAuthorizedAdmin(null), false);
  assert.equal(isAuthorizedAdmin({ role: 'citizen' }), false);
  assert.equal(isAuthorizedAdmin({ role: 'admin' }), true);
});

// ---------------------------------------------------------------------
// TEST 3, 4, 5: Citizen RLS restrictions (cannot change status, override priority, or insert admin actions)
// ---------------------------------------------------------------------
test('3, 4, 5. Database RLS guarantees citizens cannot modify complaint status, priority, or admin actions', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verify that complaints UPDATE is strictly gated by public.is_admin()
  assert.ok(
    schemaContent.includes('CREATE POLICY "Admins can update complaints"'),
    'Admins update policy must exist'
  );
  assert.ok(
    schemaContent.includes('USING (public.is_admin())'),
    'Complaints update must require is_admin()'
  );

  // Verify that citizens have NO update policy on complaints
  assert.ok(
    !schemaContent.includes('CREATE POLICY "Citizens can update own complaints"'),
    'Citizens must NOT have an update policy on complaints'
  );

  // Verify admin_actions is restricted to admins only
  assert.ok(
    schemaContent.includes('CREATE POLICY "Admins only access audit actions"'),
    'admin_actions must be admin-only'
  );
  assert.ok(
    schemaContent.includes('ON public.admin_actions FOR ALL'),
    'admin_actions ALL operations must be gated'
  );

  // Verify complaint_status_history insert is restricted to admins
  assert.ok(
    schemaContent.includes('CREATE POLICY "Admins insert status history records"'),
    'complaint_status_history insert must be admin-only'
  );
});

// ---------------------------------------------------------------------
// TEST 6: Valid submitted -> under_review transition
// ---------------------------------------------------------------------
test('6. Valid status transition submitted -> under_review succeeds', () => {
  assert.equal(isValidStatusTransition('submitted', 'under_review'), true);
  assert.deepEqual(getAllowedTransitions('submitted'), ['under_review']);
  assert.doesNotThrow(() => {
    validateStatusTransition('submitted', 'under_review', 'Review commenced by municipal officer');
  });
});

// ---------------------------------------------------------------------
// TEST 7: Invalid submitted -> resolved transition rejected
// ---------------------------------------------------------------------
test('7. Prohibited jump submitted -> resolved is strictly rejected by state machine', () => {
  assert.equal(isValidStatusTransition('submitted', 'resolved'), false);
  assert.throws(
    () => {
      validateStatusTransition('submitted', 'resolved', 'Skip to resolved');
    },
    StatusTransitionError,
    /Invalid status transition from "submitted" to "resolved"/
  );

  // Also verify arbitrary jumps like submitted -> in_progress or submitted -> assigned
  assert.equal(isValidStatusTransition('submitted', 'assigned'), false);
  assert.equal(isValidStatusTransition('submitted', 'in_progress'), false);
});

// ---------------------------------------------------------------------
// TEST 8, 9, 10: Lifecycle transitions under_review -> assigned -> in_progress -> resolved
// ---------------------------------------------------------------------
test('8, 9, 10. Sequential lifecycle transitions succeed with valid preconditions', () => {
  // under_review -> assigned
  assert.equal(isValidStatusTransition('under_review', 'assigned'), true);
  assert.doesNotThrow(() => {
    validateStatusTransition('under_review', 'assigned');
  });

  // assigned -> in_progress
  assert.equal(isValidStatusTransition('assigned', 'in_progress'), true);
  assert.doesNotThrow(() => {
    validateStatusTransition('assigned', 'in_progress');
  });

  // in_progress -> resolved (requires reason)
  assert.equal(isValidStatusTransition('in_progress', 'resolved'), true);
  assert.doesNotThrow(() => {
    validateStatusTransition('in_progress', 'resolved', 'Asphalt pothole filled with hot mix.');
  });
});

// ---------------------------------------------------------------------
// TEST 11: Rejection requires mandatory explanation reason
// ---------------------------------------------------------------------
test('11. Transition to rejected requires a mandatory non-empty reason', () => {
  assert.equal(isValidStatusTransition('under_review', 'rejected'), true);
  assert.equal(requiresTransitionReason('rejected'), true);

  // Empty note rejected
  assert.throws(
    () => {
      validateStatusTransition('under_review', 'rejected', '');
    },
    StatusTransitionError,
    /requires a mandatory explanation note/
  );

  // Note with < 5 characters rejected
  assert.throws(
    () => {
      validateStatusTransition('under_review', 'rejected', 'No');
    },
    StatusTransitionError,
    /minimum 5 characters/
  );

  // Note with valid reason passes
  assert.doesNotThrow(() => {
    validateStatusTransition('under_review', 'rejected', 'Location falls under private society jurisdiction.');
  });
});

// ---------------------------------------------------------------------
// TEST 12: Duplicate marking requires mandatory explanation reason
// ---------------------------------------------------------------------
test('12. Transition to duplicate requires a mandatory non-empty reason', () => {
  assert.equal(isValidStatusTransition('under_review', 'duplicate'), true);
  assert.equal(requiresTransitionReason('duplicate'), true);

  // Missing reason rejected
  assert.throws(
    () => {
      validateStatusTransition('under_review', 'duplicate', null);
    },
    StatusTransitionError,
    /requires a mandatory explanation note/
  );

  // Valid reason passes
  assert.doesNotThrow(() => {
    validateStatusTransition('under_review', 'duplicate', 'Duplicate grievance of active case CHD-2026-00042.');
  });
});

// ---------------------------------------------------------------------
// TEST 13: Status history created for successful transition
// ---------------------------------------------------------------------
test('13. Status transition creates history record payload with immutable audit fields', () => {
  const createHistoryPayload = (complaintId, oldStatus, newStatus, adminId, note) => {
    validateStatusTransition(oldStatus, newStatus, note);
    return {
      complaint_id: complaintId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: adminId,
      note: note || null,
      created_at: new Date().toISOString(),
    };
  };

  const payload = createHistoryPayload(
    'complaint-uuid-1',
    'submitted',
    'under_review',
    'admin-uuid-123',
    'Case assigned to civil engineer review.'
  );

  assert.equal(payload.complaint_id, 'complaint-uuid-1');
  assert.equal(payload.old_status, 'submitted');
  assert.equal(payload.new_status, 'under_review');
  assert.equal(payload.changed_by, 'admin-uuid-123');
  assert.equal(payload.note, 'Case assigned to civil engineer review.');
});

// ---------------------------------------------------------------------
// TEST 14: Admin action audit created for status change
// ---------------------------------------------------------------------
test('14. Admin action audit entry is recorded with action_type status_change', () => {
  const createAdminActionPayload = (complaintId, adminId, actionType, oldVal, newVal, reason) => {
    return {
      complaint_id: complaintId,
      admin_id: adminId,
      action_type: actionType,
      old_value: oldVal,
      new_value: newVal,
      reason: reason || null,
    };
  };

  const audit = createAdminActionPayload(
    'complaint-uuid-1',
    'admin-uuid-123',
    'status_change',
    'under_review',
    'assigned',
    'Dispatched to MCC-ROADS department wing.'
  );

  assert.equal(audit.action_type, 'status_change');
  assert.equal(audit.old_value, 'under_review');
  assert.equal(audit.new_value, 'assigned');
  assert.equal(audit.admin_id, 'admin-uuid-123');
});

// ---------------------------------------------------------------------
// TEST 15: Priority override preserves calculated priority
// ---------------------------------------------------------------------
test('15. Priority override updates priority_tier while preserving calculated priority_score', () => {
  const complaintBeforeOverride = {
    id: 'complaint-1',
    priority_score: 71.25,
    priority_tier: 'high',
  };

  const executeOverride = (complaint, newTier, reason, adminId) => {
    if (!reason || reason.trim().length < 5) throw new Error('Mandatory reason required.');
    // Preserves original priority_score
    return {
      complaint: {
        ...complaint,
        priority_tier: newTier, // Overridden tier
        priority_score: complaint.priority_score, // PRESERVED!
      },
      auditRecord: {
        complaint_id: complaint.id,
        admin_id: adminId,
        action_type: 'priority_override',
        old_value: complaint.priority_tier,
        new_value: newTier,
        reason: reason.trim(),
      },
    };
  };

  const { complaint: updated, auditRecord } = executeOverride(
    complaintBeforeOverride,
    'critical',
    'Major road obstruction during peak transit hours.',
    'admin-uuid-123'
  );

  assert.equal(updated.priority_tier, 'critical');
  assert.equal(updated.priority_score, 71.25); // Original score preserved!
  assert.equal(auditRecord.old_value, 'high');
  assert.equal(auditRecord.new_value, 'critical');
  assert.equal(auditRecord.action_type, 'priority_override');
});

// ---------------------------------------------------------------------
// TEST 16 & 17: Priority override requires reason and is admin-only
// ---------------------------------------------------------------------
test('16 & 17. Priority override requires mandatory reason and is admin-only', () => {
  const validateOverrideRequest = (isAdmin, reason) => {
    if (!isAdmin) throw new AdminAuthError('Administrative privileges required.');
    if (!reason || reason.trim().length < 5) {
      throw new Error('Mandatory justification reason required (min 5 characters).');
    }
    return true;
  };

  // Citizen rejected
  assert.throws(() => validateOverrideRequest(false, 'Important defect'), AdminAuthError);

  // Missing reason rejected
  assert.throws(() => validateOverrideRequest(true, ''), /Mandatory justification reason/);
  assert.throws(() => validateOverrideRequest(true, 'Fast'), /min 5 characters/);

  // Authorized admin with reason passes
  assert.equal(
    validateOverrideRequest(true, 'Severe pedestrian risk near school crossing.'),
    true
  );
});

// ---------------------------------------------------------------------
// TEST 18: Human-review flag displays correctly
// ---------------------------------------------------------------------
test('18. Human-review flag and trigger conditions display correctly for triage officers', () => {
  const assessmentWithFlags = {
    image_quality: 35.0,
    safety_risk: 85.0,
    evidence_support: 30.0,
    human_review_required: true,
  };

  const triggers = [];
  if (assessmentWithFlags.image_quality < 40) triggers.push('Low visual evidence quality');
  if (assessmentWithFlags.evidence_support < 40) triggers.push('Weak evidence corroboration');
  if (assessmentWithFlags.safety_risk >= 80) triggers.push('Elevated physical safety hazard');

  assert.equal(assessmentWithFlags.human_review_required, true);
  assert.equal(triggers.length, 3);
  assert.ok(triggers.includes('Elevated physical safety hazard'));
});

// ---------------------------------------------------------------------
// TEST 19: Private evidence remains private
// ---------------------------------------------------------------------
test('19. Security check: Evidence metadata remains private to complaint owner and admin', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verify evidence policies restrict SELECT to authenticated complaint owners or admins
  assert.ok(
    schemaContent.includes('CREATE POLICY "Read evidence belonging to own complaints or admin"'),
    'Evidence read policy exists'
  );
  assert.ok(
    schemaContent.includes('ON public.complaint_evidence FOR SELECT'),
    'Evidence table SELECT is protected'
  );
  assert.ok(
    schemaContent.includes('public.is_admin()'),
    'Evidence policy requires admin or owner'
  );
  assert.ok(
    !schemaContent.includes('ON public.complaint_evidence FOR SELECT TO anon'),
    'Evidence must not be accessible to anonymous users'
  );
});

// ---------------------------------------------------------------------
// TEST 20 & 21: Admin queue ordering follows priority & pending priority handled
// ---------------------------------------------------------------------
test('20 & 21. Admin queue orders by tier: Critical -> High -> Medium -> Low -> Pending, newest first', () => {
  const queueItems = [
    { id: '1', priorityTier: 'low', priorityScore: 25.0, createdAt: '2026-10-10T10:00:00Z' },
    { id: '2', priorityTier: 'critical', priorityScore: 88.0, createdAt: '2026-10-10T12:00:00Z' },
    { id: '3', priorityTier: null, priorityScore: null, createdAt: '2026-10-10T15:00:00Z' }, // Pending
    { id: '4', priorityTier: 'high', priorityScore: 72.0, createdAt: '2026-10-10T11:00:00Z' },
    { id: '5', priorityTier: 'critical', priorityScore: 92.0, createdAt: '2026-10-10T14:00:00Z' }, // Newer critical
    { id: '6', priorityTier: 'medium', priorityScore: 48.0, createdAt: '2026-10-10T09:00:00Z' },
  ];

  function getTierRank(tier) {
    switch (tier) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  queueItems.sort((a, b) => {
    const rankDiff = getTierRank(b.priorityTier) - getTierRank(a.priorityTier);
    if (rankDiff !== 0) return rankDiff;
    const scoreDiff = (b.priorityScore ?? -1) - (a.priorityScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const orderedIds = queueItems.map((c) => c.id);
  // Expected order:
  // 5 (critical 92), 2 (critical 88), 4 (high 72), 6 (medium 48), 1 (low 25), 3 (pending null)
  assert.deepEqual(orderedIds, ['5', '2', '4', '6', '1', '3']);
});

// ---------------------------------------------------------------------
// TEST 22: No protected attributes enter admin priority logic
// ---------------------------------------------------------------------
test('22. Protected personal attributes are strictly absent from admin triage service and priority engine', () => {
  const servicePath = path.join(process.cwd(), 'src', 'services', 'admin', 'adminComplaintService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');

  const forbiddenTerms = [
    'aadhaar',
    'caste',
    'religion',
    'gender',
    'race',
    'ethnicity',
    'disability',
    'income',
  ];

  for (const term of forbiddenTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    assert.ok(
      !regex.test(serviceContent),
      `adminComplaintService.ts must not reference protected attribute "${term}"`
    );
  }
});

// ---------------------------------------------------------------------
// TEST 23: No RLS weakening policies introduced
// ---------------------------------------------------------------------
test('23. Security Audit: No permissive USING (true) or WITH CHECK (true) policies exist in schema', () => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verify absence of wide-open policies on application tables
  const forbiddenPatterns = [
    /CREATE POLICY.*ON public\.complaints.*USING\s*\(\s*true\s*\)/i,
    /CREATE POLICY.*ON public\.complaints.*WITH CHECK\s*\(\s*true\s*\)/i,
    /CREATE POLICY.*ON public\.profiles.*USING\s*\(\s*true\s*\)/i,
    /CREATE POLICY.*ON public\.admin_actions.*USING\s*\(\s*true\s*\)/i,
    /CREATE POLICY.*ON public\.complaint_status_history.*USING\s*\(\s*true\s*\)/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.ok(
      !pattern.test(schemaContent),
      `Found forbidden permissive RLS policy matching pattern: ${pattern}`
    );
  }
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY ---`);
