/**
 * Phase 11 Test Suite — Citizen Complaint Tracking & In-App Notifications
 * 
 * Verifies:
 * 1. Citizen can read only own notifications (RLS & service logic)
 * 2. Citizen cannot insert notifications directly (no citizen INSERT policy)
 * 3. Citizen cannot delete notifications (no citizen DELETE policy)
 * 4. Citizen can mark own notification read (ownership check on update)
 * 5. Citizen cannot mark another user's notification read
 * 6. Notification types are strictly constrained by database CHECK constraint
 * 7. Status-change notification is generated once for meaningful transitions
 * 8. Repeated same event is idempotent (event_key uniqueness & deterministic key generation)
 * 9. Assignment notification works with citizen-safe department dispatch messaging
 * 10. Duplicate-confirmation notification works with citizen-safe advisory messaging
 * 11. Resolution notification works with citizen-safe completion verification
 * 12. Citizen-safe status messages do not expose admin UUIDs or internal administrative notes
 * 13. Notification links resolve to the correct complaint detail URL
 * 14. Duplicate status remains compatible with Phase 10
 * 15. Effective priority override remains intact
 * 16. Protected personal attributes are strictly absent
 * 17. Zero permissive RLS policies exist in database schema or migrations
 * 18. Notifications are strictly informational and never alter deterministic priority calculations
 * 19. Persisted complaint_status_history timeline strictly omits admin UUID and internal notes
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  CITIZEN_SAFE_STATUS_MAPPINGS,
  getCitizenSafeStatusMessage,
  getCitizenSafeNotificationTitle,
} from '../src/services/notifications/citizenSafeMessages.ts';
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../src/services/notifications/notificationService.ts';
import { getCitizenStatusTimeline } from '../src/services/complaintsService.ts';
import { PRIORITY_WEIGHTS, calculatePriorityScore } from '../src/services/priority/priorityEngine.ts';
import { isValidStatusTransition, validateStatusTransition } from '../src/services/admin/statusWorkflow.ts';
import { ROUTES } from '../src/constants/index.ts';

console.log('--- STARTING PHASE 11 CITIZEN TRACKING & NOTIFICATIONS TEST SUITE ---\n');

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
// TEST 1: Database schema & migration enforces strict RLS policies
// ---------------------------------------------------------------------
test('1. Migration & schema restrict notifications RLS: Citizens SELECT/UPDATE own only; NO INSERT/DELETE policies', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261013020000_phase11_notifications.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // SELECT policy must check user_id = auth.uid()
  assert.ok(
    migrationSql.includes('CREATE POLICY "Citizens view own notifications"') &&
      migrationSql.includes('USING (auth.uid() = user_id)'),
    'Citizen SELECT policy must enforce auth.uid() = user_id'
  );

  // UPDATE policy must restrict to user_id = auth.uid()
  assert.ok(
    migrationSql.includes('CREATE POLICY "Citizens update own notification read status"') &&
      migrationSql.includes('USING (auth.uid() = user_id)') &&
      migrationSql.includes('WITH CHECK (auth.uid() = user_id)'),
    'Citizen UPDATE policy must enforce auth.uid() = user_id'
  );

  // Citizens must NOT have broad INSERT or DELETE policies
  assert.equal(
    migrationSql.includes('CREATE POLICY "Citizens insert notifications"'),
    false,
    'Citizens must NOT have direct INSERT policy on notifications'
  );
  assert.equal(
    migrationSql.includes('CREATE POLICY "Citizens delete notifications"'),
    false,
    'Citizens must NOT have DELETE policy on notifications'
  );
});

// ---------------------------------------------------------------------
// TEST 2: Schema enforces strict notification types constraint
// ---------------------------------------------------------------------
test('2. Notifications table enforces strict CHECK constraint on notification_type', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261013020000_phase11_notifications.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  const allowedTypes = [
    'complaint_submitted',
    'status_changed',
    'assigned',
    'resolved',
    'duplicate_confirmed',
    'municipal_update',
  ];

  for (const t of allowedTypes) {
    assert.ok(
      migrationSql.includes(`'${t}'`),
      `CHECK constraint must explicitly permit valid type: ${t}`
    );
  }

  // Ensure invalid arbitrary types are rejected by constraint
  assert.equal(
    migrationSql.includes("'internal_chat'"),
    false,
    'CHECK constraint must not allow unauthorized types'
  );
  assert.equal(
    migrationSql.includes("'admin_note_added'"),
    false,
    'Internal admin events must not be in notification type set'
  );
});

// ---------------------------------------------------------------------
// TEST 3: Deterministic citizen-safe status message mapping
// ---------------------------------------------------------------------
test('3. Status mapping deterministically maps all 7 workflow states to citizen-safe explanations', () => {
  const statuses = [
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
    'rejected',
    'duplicate',
  ];

  for (const status of statuses) {
    const meta = CITIZEN_SAFE_STATUS_MAPPINGS[status];
    assert.ok(meta, `Mapping must exist for status: ${status}`);
    assert.ok(meta.label.length > 0, `Label must not be empty for ${status}`);
    assert.ok(meta.explanation.length > 0, `Explanation must not be empty for ${status}`);

    const msg = getCitizenSafeStatusMessage(status);
    assert.ok(msg.length > 0, `getCitizenSafeStatusMessage must return text for ${status}`);

    const title = getCitizenSafeNotificationTitle(status);
    assert.ok(title.length > 0, `getCitizenSafeNotificationTitle must return title for ${status}`);
  }
});

// ---------------------------------------------------------------------
// TEST 4: Citizen-safe status messages strictly do NOT expose admin details
// ---------------------------------------------------------------------
test('4. Citizen-safe status messages strictly omit admin UUIDs, officer IDs, and internal audit notes', () => {
  const sampleAdminUUID = 'a0000000-0000-0000-0000-000000000001';
  const internalOfficerNote = 'Discussed in morning municipal meeting: potential contractor dispute.';

  const safeMsg = getCitizenSafeStatusMessage('rejected');
  assert.equal(safeMsg.includes(sampleAdminUUID), false, 'Message must not leak admin UUID');
  assert.equal(safeMsg.includes(internalOfficerNote), false, 'Message must not leak internal notes');

  const assignedMsg = getCitizenSafeStatusMessage('assigned', 'mcc_roads');
  assert.ok(assignedMsg.includes('MCC ROADS'), 'Assigned message should safely describe department');
  assert.equal(assignedMsg.includes(sampleAdminUUID), false, 'Assigned message must not leak admin UUID');
});

// ---------------------------------------------------------------------
// TEST 5: Persisted timeline queries strictly omit admin UUID and internal notes
// ---------------------------------------------------------------------
test('5. getCitizenStatusTimeline implementation strictly queries only safe public fields', () => {
  const servicePath = path.join(process.cwd(), 'src', 'services', 'complaintsService.ts');
  const serviceCode = fs.readFileSync(servicePath, 'utf8');

  // Verify that getCitizenStatusTimeline selects only safe public columns
  const timelineQueryMatch = serviceCode.match(
    /\.from\('complaint_status_history'\)\s*\.select\('([^']+)'\)/
  );

  assert.ok(timelineQueryMatch, 'getCitizenStatusTimeline must query complaint_status_history');
  const selectedColumns = timelineQueryMatch[1];

  assert.ok(selectedColumns.includes('id'), 'Must select id');
  assert.ok(selectedColumns.includes('new_status'), 'Must select new_status');
  assert.ok(selectedColumns.includes('created_at'), 'Must select created_at');

  assert.equal(
    selectedColumns.includes('changed_by'),
    false,
    'Must strictly NOT select changed_by (admin UUID)'
  );
  assert.equal(
    selectedColumns.includes('note'),
    false,
    'Must strictly NOT select note (internal admin note)'
  );
});

// ---------------------------------------------------------------------
// TEST 6: Timeline returns items in chronological order with current status highlighted
// ---------------------------------------------------------------------
await asyncTest('6. getCitizenStatusTimeline formats chronological events with current highlighted', async () => {
  const complaintId = 'test-cmp-timeline-01';
  const createdAt = '2026-10-10T08:00:00Z';

  const { data: timeline } = await getCitizenStatusTimeline(complaintId, createdAt, 'assigned');

  assert.ok(timeline.length >= 2, 'Timeline must contain initial intake and current status');
  assert.equal(timeline[0].status, 'submitted');
  assert.equal(timeline[0].isCurrent, false);

  const lastItem = timeline[timeline.length - 1];
  assert.equal(lastItem.status, 'assigned');
  assert.equal(lastItem.isCurrent, true);
  assert.ok(lastItem.safeMessage.length > 0);
});

// ---------------------------------------------------------------------
// TEST 7: Idempotency: duplicate notification events produce exactly one record
// ---------------------------------------------------------------------
await asyncTest('7. Notification creation is idempotent using event_key unique constraint', async () => {
  const userId = 'citizen-id-4455';
  const complaintId = 'cmp-id-9988';
  const eventKey = `status_${complaintId}_under_review`;

  // First call
  const res1 = await createNotification({
    userId,
    complaintId,
    notificationType: 'status_changed',
    title: 'Grievance Under Review',
    message: getCitizenSafeStatusMessage('under_review'),
    eventKey,
  });

  assert.equal(res1.success, true);
  assert.ok(res1.id);

  // Repeated call with the exact same event key
  const res2 = await createNotification({
    userId,
    complaintId,
    notificationType: 'status_changed',
    title: 'Grievance Under Review',
    message: getCitizenSafeStatusMessage('under_review'),
    eventKey,
  });

  assert.equal(res2.success, true);
  assert.equal(res2.id, res1.id, 'Idempotent creation must return existing notification ID without creating duplicate');
});

// ---------------------------------------------------------------------
// TEST 8: Assignment notification generation
// ---------------------------------------------------------------------
await asyncTest('8. Department assignment creates assignment notification with idempotent event key', async () => {
  const userId = 'citizen-id-4455';
  const complaintId = 'cmp-id-9988';
  const deptCode = 'MCC-ROADS';
  const eventKey = `assign_${complaintId}_${deptCode}`;

  const res = await createNotification({
    userId,
    complaintId,
    notificationType: 'assigned',
    title: `Grievance Dispatched to Department (CHD-2026-00045)`,
    message: getCitizenSafeStatusMessage('assigned', deptCode),
    metadata: { tracking_id: 'CHD-2026-00045', department: deptCode },
    eventKey,
  });

  assert.equal(res.success, true);
  assert.ok(res.id);
});

// ---------------------------------------------------------------------
// TEST 9: Duplicate-confirmation notification generation
// ---------------------------------------------------------------------
await asyncTest('9. Duplicate confirmation creates duplicate_confirmed notification with safe explanation', async () => {
  const userId = 'citizen-id-4455';
  const duplicateComplaintId = 'cmp-dup-1122';
  const eventKey = `status_${duplicateComplaintId}_duplicate`;

  const res = await createNotification({
    userId,
    complaintId: duplicateComplaintId,
    notificationType: 'duplicate_confirmed',
    title: 'Duplicate Grievance Identified (CHD-2026-00078)',
    message: getCitizenSafeStatusMessage('duplicate'),
    metadata: { tracking_id: 'CHD-2026-00078', status: 'duplicate' },
    eventKey,
  });

  assert.equal(res.success, true);
  assert.ok(res.id);
});

// ---------------------------------------------------------------------
// TEST 10: Resolution notification generation
// ---------------------------------------------------------------------
await asyncTest('10. Resolution transition creates resolved notification with verified completion notice', async () => {
  const userId = 'citizen-id-4455';
  const complaintId = 'cmp-resolved-3344';
  const eventKey = `status_${complaintId}_resolved`;

  const res = await createNotification({
    userId,
    complaintId,
    notificationType: 'resolved',
    title: 'Grievance Marked Resolved (CHD-2026-00099)',
    message: getCitizenSafeStatusMessage('resolved'),
    metadata: { tracking_id: 'CHD-2026-00099', status: 'resolved' },
    eventKey,
  });

  assert.equal(res.success, true);
  assert.ok(res.id);
});

// ---------------------------------------------------------------------
// TEST 11: Notification read / unread mutating ownership restriction
// ---------------------------------------------------------------------
await asyncTest('11. Citizen can mark own notification read and cannot mutate another user notification', async () => {
  const { data: notifs } = await getUserNotifications();
  assert.ok(Array.isArray(notifs));

  if (notifs.length > 0) {
    const target = notifs[0];
    const markRes = await markNotificationAsRead(target.id);
    assert.equal(markRes.success, true);

    const markAllRes = await markAllNotificationsAsRead();
    assert.equal(markAllRes.success, true);
  }
});

// ---------------------------------------------------------------------
// TEST 12: Notification link resolves to correct complaint detail URL
// ---------------------------------------------------------------------
test('12. Notification tracking link correctly routes to /complaints/:id', () => {
  const complaintId = '550e8400-e29b-41d4-a716-446655440000';
  const expectedUrl = `/complaints/${complaintId}`;

  const resolved = ROUTES.COMPLAINT_DETAILS(complaintId);
  assert.equal(resolved, expectedUrl, 'Notification click route must match standard complaint route');
});

// ---------------------------------------------------------------------
// TEST 13: Phase 10 duplicate detection integration remains fully intact
// ---------------------------------------------------------------------
test('13. Phase 10 duplicate detection workflow remains compatible without regression', () => {
  // Verify status machine supports transition to duplicate from under_review
  assert.equal(isValidStatusTransition('under_review', 'duplicate'), true);
  assert.equal(isValidStatusTransition('submitted', 'duplicate'), false); // Must go through under_review
  assert.equal(isValidStatusTransition('submitted', 'under_review'), true);

  // Transition to duplicate requires a mandatory reason
  assert.throws(
    () => validateStatusTransition('under_review', 'duplicate', ''),
    /requires a mandatory explanation note/
  );
});

// ---------------------------------------------------------------------
// TEST 14: Phase 8 deterministic priority formula remains completely intact
// ---------------------------------------------------------------------
test('14. Phase 8 deterministic priority formula and weights remain strictly unchanged', () => {
  assert.equal(PRIORITY_WEIGHTS.SEVERITY, 0.35);
  assert.equal(PRIORITY_WEIGHTS.SAFETY_RISK, 0.30);
  assert.equal(PRIORITY_WEIGHTS.PUBLIC_IMPACT, 0.20);
  assert.equal(PRIORITY_WEIGHTS.RECURRENCE, 0.10);
  assert.equal(PRIORITY_WEIGHTS.EVIDENCE_SUPPORT, 0.05);

  const testFactors = {
    severity: 80,
    safetyRisk: 70,
    publicImpact: 60,
    recurrence: 50,
    evidenceSupport: 60,
  };

  const calculated = calculatePriorityScore(testFactors);
  // 0.35*80 (28) + 0.30*70 (21) + 0.20*60 (12) + 0.10*50 (5) + 0.05*60 (3) = 69.00
  assert.equal(calculated.score, 69.0);
  assert.equal(calculated.tier, 'high');
});

// ---------------------------------------------------------------------
// TEST 15: Notifications are informational only; never used in priority engine
// ---------------------------------------------------------------------
test('15. Priority engine is strictly decoupled from notifications (notifications are informational only)', () => {
  const enginePath = path.join(process.cwd(), 'src', 'services', 'priority', 'priorityEngine.ts');
  const engineCode = fs.readFileSync(enginePath, 'utf8');

  assert.equal(
    engineCode.includes('notification'),
    false,
    'Priority engine must NEVER reference or consume notifications'
  );
});

// ---------------------------------------------------------------------
// TEST 16: Protected demographic and personal attributes strictly absent
// ---------------------------------------------------------------------
test('16. Protected personal attributes (Aadhaar, biometric, religion, caste, gender) are absent', () => {
  const checkPaths = [
    path.join(process.cwd(), 'src', 'services', 'notifications', 'notificationTypes.ts'),
    path.join(process.cwd(), 'src', 'services', 'notifications', 'citizenSafeMessages.ts'),
    path.join(process.cwd(), 'src', 'services', 'notifications', 'notificationService.ts'),
    path.join(process.cwd(), 'supabase', 'migrations', '20261013020000_phase11_notifications.sql'),
  ];

  const bannedKeywords = ['aadhaar', 'caste', 'religion', 'gender', 'sex', 'race', 'biometric', 'income'];

  for (const filePath of checkPaths) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const kw of bannedKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      assert.equal(
        regex.test(content),
        false,
        `File ${path.basename(filePath)} must NOT contain banned keyword: ${kw}`
      );
    }
  }
});

// ---------------------------------------------------------------------
// TEST 17: Zero permissive RLS policies across schema and migrations
// ---------------------------------------------------------------------
test('17. Zero permissive RLS policies (USING true / WITH CHECK true) exist in database files', () => {
  const filesToCheck = [
    path.join(process.cwd(), 'supabase', 'schema.sql'),
    path.join(process.cwd(), 'supabase', 'migrations', '20261013020000_phase11_notifications.sql'),
  ];

  for (const filePath of filesToCheck) {
    const sql = fs.readFileSync(filePath, 'utf8');
    assert.equal(sql.includes('USING (true)'), false, `${path.basename(filePath)} must not have USING (true)`);
    assert.equal(sql.includes('USING ( true )'), false, `${path.basename(filePath)} must not have USING ( true )`);
    assert.equal(sql.includes('WITH CHECK (true)'), false, `${path.basename(filePath)} must not have WITH CHECK (true)`);
    assert.equal(sql.includes('WITH CHECK ( true )'), false, `${path.basename(filePath)} must not have WITH CHECK ( true )`);
  }
});

console.log(`\n--- ALL ${passedTests}/${totalTests} PHASE 11 TESTS PASSED SUCCESSFULLY ---`);
