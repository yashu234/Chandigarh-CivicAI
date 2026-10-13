# Chandigarh CivicAI — In-App Notifications & Citizen Tracking

## 1. Overview & Architecture

Phase 11 introduces a secure, real-time in-app notification and citizen complaint tracking layer for the Chandigarh CivicAI platform.

### Core Principles
1. **Strictly Informational**: Notifications keep citizens informed of remediation progress. They are strictly decoupled from municipal priority logic and **never** influence or alter deterministic priority scores or tiers.
2. **Citizen-Safe Data Boundary**: Citizens only receive public-facing, deterministic remediation updates. Internal administrative audit logs, officer discussions, admin notes, and administrative UUIDs (`changed_by`, `admin_id`) **never leak** to residents.
3. **Idempotent by Design**: Every notification event has a deterministic `event_key` protected by database-level unique constraints. Repeated status transitions or service retries will never generate duplicate notifications.
4. **Zero Permissive RLS**: Citizens have granular `SELECT` and `UPDATE` permissions restricted to their own notifications (`auth.uid() = user_id`). Direct `INSERT` or `DELETE` permissions for citizens are strictly prohibited.
5. **No External SMS/Email Coupling**: In-app notifications are self-contained and fully functional without external telecom or mailing dependencies. External gateways (e.g., NIC SMS / Gov email) remain a future operational concern.

---

## 2. Notification Data Model

Table: `public.notifications` (Schema Table 8)

```sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'complaint_submitted',
    'status_changed',
    'assigned',
    'resolved',
    'duplicate_confirmed',
    'municipal_update'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_key TEXT UNIQUE
);
```

### Constrained Notification Types
- `complaint_submitted`: Grievance intake recorded and assigned a municipal tracking ID.
- `status_changed`: General municipal workflow stage advancement.
- `assigned`: Dispatched to a specialized municipal wing (e.g., MCC Roads, UT Electricity).
- `resolved`: Physical remediation completed and verified by civic authorities.
- `duplicate_confirmed`: Grievance verified as an active incident already tracking under a sector master report.
- `municipal_update`: General informational broadcast regarding the complaint.

---

## 3. Idempotency & Event Key Strategy

To prevent spam or duplicate notifications from rapid re-evaluations or service retries:

| Event Trigger | Event Key Structure | Example |
| :--- | :--- | :--- |
| Initial Intake | `intake_${complaint_id}` | `intake_550e8400-e29b-41d4-a716-446655440000` |
| Status Transition | `status_${complaint_id}_${target_status}` | `status_550e8400..._in_progress` |
| Department Assignment | `assign_${complaint_id}_${dept_code}` | `assign_550e8400..._MCC-ROADS` |
| Duplicate Confirmation | `status_${complaint_id}_duplicate` | `status_550e8400..._duplicate` |
| Resolution Verification | `status_${complaint_id}_resolved` | `status_550e8400..._resolved` |

The unique constraint `event_key TEXT UNIQUE` combined with `ON CONFLICT (event_key) DO NOTHING` guarantees that repeated operations result in a clean no-op at the database level.

---

## 4. Row-Level Security (RLS) Policies

All database access is governed by strict RLS:

| Actor | Action | Policy | Enforcement |
| :--- | :--- | :--- | :--- |
| **Citizen** | `SELECT` | `"Citizens view own notifications"` | `USING (auth.uid() = user_id)` |
| **Citizen** | `UPDATE` | `"Citizens update own notification read status"` | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| **Citizen** | `INSERT` | **None** | Denied (Citizens cannot synthesize notifications) |
| **Citizen** | `DELETE` | **None** | Denied (Notifications are audit-preserved) |
| **Administrator** | `ALL` | `"Admins manage all notifications"` | `USING (public.is_admin()) WITH CHECK (public.is_admin())` |

---

## 5. Citizen-Safe Status Messaging

Internal administrative triage notes and officer discussion records are strictly separated from citizen-facing tracking messages. The system applies a deterministic mapping (`CITIZEN_SAFE_STATUS_MAPPINGS`):

| Internal Status | Citizen-Facing Label | Citizen Explanation |
| :--- | :--- | :--- |
| `submitted` | Complaint Received | Your grievance has been safely recorded by the municipal intake desk and assigned a tracking reference. |
| `under_review` | Under Municipal Review | The municipal inspection team is reviewing your grievance and assessing field remediation requirements. |
| `assigned` | Assigned to Department | Your grievance has been dispatched to the specialized municipal department wing for field action. |
| `in_progress` | Remediation In Progress | Field workers and engineering personnel have commenced physical remediation work at the reported site. |
| `resolved` | Remediation Resolved | Municipal works at the location have been completed and verified by civic authorities. |
| `rejected` | Submission Not Accepted | This report could not be accepted under municipal civic guidelines (e.g., outside jurisdiction or non-civic matter). |
| `duplicate` | Duplicate Grievance Identified | This complaint refers to an active civic issue already reported in this sector. Field remediation is tracking under the primary report. |

### Persisted Status Timeline
When a resident views their grievance details on `ComplaintDetailsPage`:
1. The timeline is constructed by querying `public.complaint_status_history`.
2. The query selects strictly: `id, old_status, new_status, created_at`.
3. The query strictly omits `changed_by` (admin UUID) and `note` (internal admin note).
4. Status codes are mapped to deterministic public explanations.
5. The timeline renders chronologically, with the active status highlighted.

---

## 6. User Interface Components

1. **`NotificationBell` (Navbar)**:
   - Real-time unread badge counter in top navigation.
   - Popover panel listing latest notifications with relative timestamps.
   - Distinct unread vs. read visual treatment.
   - Click-to-navigate directly to the corresponding complaint (`/complaints/:id`).
   - "Mark all as read" and individual mark-as-read controls.
2. **`ComplaintDetailsPage` Status Timeline**:
   - Prominent "Latest Civic Update" banner with safe summary.
   - Chronological audit-verified step sequence.
   - Verification timestamp and department wing allocation details.
   - Transparency on effective priority while strictly protecting internal admin audit logs.

---

## 7. Future Integrations (Phase 12+)

- **SMS / WhatsApp Gateways**: Can be hooked into the backend without altering frontend schemas by listening to `notifications` inserts via Supabase Database Webhooks.
- **Push Notifications**: Standard Web Push API can subscribe to notifications by user ID.
