# Chandigarh CivicAI — Admin Review & Civic Triage Workflow (Phase 9)

## 1. Architectural Philosophy & Governance Principles

In Chandigarh CivicAI, **the municipal administrator is the authoritative human decision-maker**.

Multimodal AI assessment (Phase 7) and the deterministic priority engine (Phase 8) serve exclusively as **decision-support systems**. Algorithms propose scores, highlight safety hazards, and structure evidence; however, municipal action, status transitions, department routing, and priority overrides remain firmly under authenticated human municipal authority.

---

## 2. Administrator Security & Authorization Model

### Authoritative Backend Security
Administrative privileges are enforced at the database and API layer. The application enforces **zero trust** in client-side state:
- Frontend role state, `localStorage`, URL parameters, or client-supplied bodies are **never trusted**.
- Database-level Row-Level Security (RLS) policies and session verification functions are authoritative.

### Security Implementation
- **Profiles Role**: Gated by `public.profiles.role = 'admin'`.
- **Database Function**: `public.is_admin()` executes `auth.uid() = id AND role = 'admin'`.
- **Session Verification**: `verifyAdminSession()` in [`src/services/admin/adminComplaintService.ts`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/src/services/admin/adminComplaintService.ts) verifies:
  1. Active Supabase session exists (`auth.getUser()`).
  2. Public profile exists with `role === 'admin'`.
  3. Throws `AdminAuthError` if unauthenticated or caller is an ordinary citizen.

---

## 3. Civic Complaint Lifecycle & Status State Machine

### Status State Transition Diagram

```text
       ┌─────────────┐
       │  SUBMITTED  │
       └──────┬──────┘
              │ (Start Review)
              ▼
       ┌─────────────┐
       │UNDER_REVIEW ├───────────────────────┬────────────────────────┐
       └──────┬──────┘                       │ (Reject)               │ (Mark Duplicate)
              │ (Assign)                     ▼                        ▼
              ▼                       ┌─────────────┐          ┌─────────────┐
       ┌─────────────┐                │  REJECTED   │          │  DUPLICATE  │
       │  ASSIGNED   │                └─────────────┘          └─────────────┘
       └──────┬──────┘
              │ (Start Work)
              ▼
       ┌─────────────┐
       │ IN_PROGRESS │
       └──────┬──────┘
              │ (Resolve Works)
              ▼
       ┌─────────────┐
       │  RESOLVED   │
       └─────────────┘
```

### Valid Status Transitions

| Current Status | Allowed Target Status | Action Label | Justification / Note Requirement |
| :--- | :--- | :--- | :--- |
| `submitted` | `under_review` | Start Review | Optional note |
| `under_review` | `assigned` | Assign Department | Optional routing note |
| `under_review` | `rejected` | Reject Complaint | **Mandatory** reason (min 5 characters) |
| `under_review` | `duplicate` | Mark Duplicate | **Mandatory** reason (min 5 characters) |
| `assigned` | `in_progress` | Start Work | Optional note |
| `in_progress` | `resolved` | Resolve Complaint | **Mandatory** remediation summary (min 5 characters) |
| `resolved` | *Terminal* | — | No further transitions permitted |
| `rejected` | *Terminal* | — | No further transitions permitted |
| `duplicate` | *Terminal* | — | No further transitions permitted |

### Prohibited Transitions & Arbitrary Jumps
Arbitrary state jumps (such as `submitted → resolved`, `submitted → assigned`, or `in_progress → duplicate`) are strictly prohibited and rejected by [`src/services/admin/statusWorkflow.ts`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/src/services/admin/statusWorkflow.ts) via `StatusTransitionError`.

---

## 4. Immutable Status History (`complaint_status_history`)

Every state transition generates an immutable record in `public.complaint_status_history`:
- `complaint_id`: Target complaint UUID.
- `old_status`: Previous status.
- `new_status`: Target status.
- `changed_by`: Authenticated administrator UUID (never spoofed or client-supplied).
- `changed_at`: Server timestamp (`now()`).
- `note`: Administrative note or mandatory justification.

### Append-Only RLS Guarantees
- **Citizens**: Allowed `SELECT` for their own complaints (`auth.uid() = citizen_id`). Zero `INSERT`, `UPDATE`, or `DELETE` capabilities.
- **Administrators**: Allowed `INSERT` and `SELECT` via `public.is_admin()`. `UPDATE` and `DELETE` are disallowed to maintain audit integrity.

---

## 5. Administrative Audit Trail (`admin_actions`)

Material administrative decisions are recorded in `public.admin_actions`:
- `status_change`: Captures status transitions with old and new values.
- `priority_override`: Captures tier changes and reason.
- `assign_department`: Captures department routing and personnel assignment.

Table properties:
- `admin_id`: Authenticated admin user UUID.
- `complaint_id`: Target complaint UUID.
- `action_type`: String identifier of triage action.
- `old_value` / `new_value`: Before and after state values.
- `reason`: Explanation or justification.
- `created_at`: Immutable timestamp.

---

## 6. Controlled Priority Override

The deterministic Phase 8 priority score must **never be destroyed or overwritten** by an administrative override.

### Preservation of Calculations & Effective Tier Separation
- `calculatedPriorityScore`: The deterministic mathematical formula score ($0.00 - 100.00$) remains untouched.
- `calculatedPriorityTier`: Derived deterministically from the formula score (e.g. `HIGH` for $71.25$).
- `effectivePriorityTier`: Reflects the persisted municipal triage decision (e.g. `CRITICAL`).
- `priority_tier` in `public.complaints`: Stores the active effective tier.
- `admin_actions`: Audit record logged with `action_type: 'priority_override'`, preserving `old_value` (original calculated tier), `new_value` (overridden tier), `reason`, `admin_id`, and `created_at`.
- **Mapping Guard**: Complaint mappers (`mapDbComplaintToModel`, `getLiveAdminComplaints`, `getAdminComplaintDetails`) never overwrite a persisted override with in-memory recalculated values from the AI assessment. If multiple historical overrides exist, the most recent valid record (`order('created_at', { ascending: false })`) is authoritative.

### UI Representation
- **Administrator Console (`AdminComplaintDetailsPage`)**:
  - Displays side-by-side:
    - **Calculated Priority**: `71.25 — HIGH` (formula inputs from AI assessment).
    - **Administrative Override**: `CRITICAL` (Reason: *"Major road obstruction during peak public transit hours."*), or `None` if no override is active.
    - **Effective Civic Priority**: `CRITICAL` (labeled as human administrative override).
- **Citizen Grievance Tracking (`ComplaintDetailsPage`)**:
  - Displays:
    - **Current Civic Priority**: `CRITICAL`.
    - **Municipal Review Note**: *"Priority tier was adjusted by authorized municipal review."*
    - Formula score remains visible for civic transparency (`71.25/100`), without claiming the AI generated the overridden tier, and without exposing internal admin IDs.
- **Citizen Grievance List (`MyComplaintsPage`)**:
  - Displays the effective priority tier (`CRITICAL`) rather than recalculating `HIGH` from raw AI assessment.

Citizens cannot execute priority overrides or modify AI assessment records.

---

## 7. Human Review Flag & Triage Indicators

When `human_review_required = true`, the triage console displays prominent review indicators:

### Trigger Conditions
1. **Low Image Quality** (`imageQuality < 40`): Blurry, unidentifiable, or corrupted evidence.
2. **Description Mismatch** (`descriptionImageConsistency < 40`): Uploaded photo depicts an issue different from the citizen's text.
3. **Low Evidence Support** (`evidenceSupport < 40`): Visual evidence fails to corroborate the reported problem.
4. **Severe Safety Hazard** (`safetyRisk >= 80`): High-voltage line, open deep trench, chemical leak, or severe collapse hazard requiring urgent human inspection.
5. **AI Service State** (`failed` or `not_configured`): Model inference failure or API unavailability.

The triage UI clarifies that AI analysis is purely consultative; municipal staff verify and approve all work orders.

---

## 8. Department Assignment Foundation

Phase 9 implements the foundational routing layer:
- **Predefined Chandigarh Municipal Departments**:
  - `MOH` — Medical Officer of Health (Sanitation, Waste, Stray Animals)
  - `B&R` — Buildings & Roads (Potholes, Road Cave-ins, Paver Blocks)
  - `HORT` — Horticulture Division (Fallen Trees, Park Maintenance)
  - `ELEC` — Electrical Wing (Streetlights, High-Mast Lights, Cable Hazards)
  - `PH` — Public Health (Water Leakage, Contamination, Sewerage)
- Assignments update `assignedDepartmentId`, record an `assign_department` audit trail, and transition status to `assigned`.
- Deep personnel directory integration and employee dispatch are deferred to future phases.

---

## 9. Row-Level Security (RLS) Verification

| Table | Citizen Access | Admin Access | Permissive `USING (true)`? |
| :--- | :--- | :--- | :---: |
| `public.profiles` | Read own, insert own as citizen | Read all, update role | **NO** |
| `public.complaints` | Read own, insert own | Read all, update status/priority | **NO** |
| `public.complaint_evidence` | Read own, insert own | Read all | **NO** |
| `public.ai_assessments` | Read own | Read all, insert/update | **NO** |
| `public.complaint_status_history` | Read own, no writes | Read all, insert history | **NO** |
| `public.admin_actions` | No access | Full audit access (`is_admin()`) | **NO** |
| `public.complaint_duplicates` | Read own complaints duplicate status only | Full manage access (`is_admin()`) | **NO** |
| Storage (`complaint-evidence`) | Read own, upload own | Read all via signed URLs | **NO** |

---

## 10. Duplicate & Recurring Defect Advisory Triage (Phase 10)

Phase 10 introduces advisory duplicate and recurrence detection for administrative triage:
- **Advisory Only**: Candidate pairs are suggested if similarity $\ge 60.00\%$ and category matches; records are **never automatically merged**.
- **Admin Review Console**: Section E displays candidates with explainable signals (Category 25%, Spatial 25%, Text 30%, Temporal 15%, Landmark 5%).
- **Confirm Duplicate Action**: Requires mandatory justification ($\ge 5$ chars), transitions the duplicate complaint to `'duplicate'` status via the Phase 9 status state machine, updates suggestion to `'confirmed_duplicate'`, and logs immutable records in `admin_actions` and `complaint_status_history`.
- **Dismiss Suggestion Action**: Updates suggestion to `'dismissed'` with review note; both complaints remain distinct and active.
- **Municipal Sector Recurrence Signal**: Calculates deterministic 60-day frequency $\min(100, N \times 25)$ without mutating historical priority scores.
- For full details, see [`docs/duplicate-detection.md`](./duplicate-detection.md).

---

## 11. Citizen Notification Dispatch Integration (Phase 11)

Phase 11 integrates administrative actions with the citizen-safe in-app notification layer:
- **Status Change**: Transitioning a complaint generates a citizen notification (`status_changed`, `assigned`, or `resolved`) using deterministic, citizen-safe messages (`CITIZEN_SAFE_STATUS_MAPPINGS`). Internal officer notes and admin UUIDs are strictly omitted.
- **Department Wing Assignment**: Dispatches an idempotent `assigned` notification associating the complaint and informing the citizen of the responsible department wing.
- **Duplicate Confirmation**: When an admin confirms a duplicate grievance, a `duplicate_confirmed` notification is issued to the citizen with transparent notice that the grievance is tracking under the sector master report.
- **Idempotency**: All notification generation uses deterministic `event_key` entries (`status_${id}_${target}`, `assign_${id}_${dept}`) ensuring zero duplicate notifications across retries.
- For full details, see [`docs/notifications.md`](./notifications.md).

---

## 12. Scope Boundaries (Deferred Features)

The following capabilities are deliberately excluded from Phase 11:
- Automatic merging or deletion of complaint records.
- External telecom gateways (real SMS/WhatsApp/external email).
- Production cloud deployment (Phase 12+).
- Live employee biometric/directory integration.
- Predictive route optimization.

