# Chandigarh CivicAI — Demo Guide
**Phase 13: Demo & Presentation Walkthrough**

> [!IMPORTANT]
> This guide is for demonstration purposes using **synthetic demo data only**.
> All accounts, complaints, and results shown here are pre-seeded test data (prefix `[DEMO]` / tracking IDs `CHD-TEST-*`).
> No real citizen information is used or displayed.

---

## 1. Pre-Demo Setup

### Confirm Demo Seed is Applied
Run in Supabase SQL Editor (staging project only):
```sql
SELECT check_name, status, detail FROM public.demo_readiness_check();
```
All rows should show `PASS`.

### Confirm Demo Data Present
```sql
SELECT tracking_id, title, status, priority_tier, priority_score
FROM public.complaints
WHERE tracking_id LIKE 'CHD-TEST-%'
ORDER BY priority_score DESC;
```

Expected 6 demo complaints:

| Tracking ID | Title | Status | Priority | Score |
|---|---|---|---|---|
| CHD-TEST-0001 | [DEMO] Deep asphalt cavity, Sector 17 | resolved | critical | 91.80 |
| CHD-TEST-0003 | [DEMO] Exposed electrical cable, Sector 22 | assigned | high | 87.50 |
| CHD-TEST-0002 | [DEMO] Water main rupture, Sector 35 | in_progress | high | 83.20 |
| CHD-TEST-0005 | [DEMO] Non-functional streetlights, Sector 11 | submitted | medium | 62.10 |
| CHD-TEST-0004 | [DEMO] Illegal garbage dumping, Sector 22 | under_review | medium | 58.40 |
| CHD-TEST-0006 | [DEMO] Broken signboard, Sector 8 | submitted | low | 34.20 |

---

## 2. Demo Credentials

> [!CAUTION]
> These credentials are for demo/staging only. Never use them in production. Change all passwords before a live demo.

| Role | Email | Password (example — set your own) |
|---|---|---|
| Citizen (Priya) | `demo.citizen1@example.local` | Set via Supabase Auth → Users |
| Citizen (Rahul) | `demo.citizen2@example.local` | Set via Supabase Auth → Users |
| Admin Officer | `demo.admin@example.local` | Set via Supabase Auth → Users |

To set a demo password in Supabase Dashboard:
1. Go to **Authentication → Users**.
2. Find the demo user, click **...** → **Send password recovery** (or set manually via API).

---

## 3. Demo Script

### Scene 1: Citizen Reports a Pothole (2 minutes)

**Narrative:** *"A citizen in Sector 17 notices a dangerous pothole near the Fountain Chowk. They open Chandigarh CivicAI on their phone and submit a report."*

**Steps:**
1. Open the app at `https://your-deployment-url/`.
2. Click **"Report a Civic Issue"** → **Register** or **Login** as `demo.citizen1@example.local`.
3. Navigate to **Submit Complaint**.
4. Fill in:
   - Category: `Pothole / Road Hazard`
   - Sector: `Sector 17`
   - Title: "Deep pothole near roundabout"
   - Description: "A large cavity has appeared on the main corridor..."
   - Upload a sample photo.
5. Click **Submit**.
6. Show the **Tracking ID** generated (e.g. `CHD-2026-00107`).

**Key Points to Highlight:**
- Tracking ID is auto-generated and guaranteed unique.
- Image is uploaded to a private, encrypted storage bucket.
- AI analysis begins in the background.

---

### Scene 2: AI Evidence Analysis (2 minutes)

**Narrative:** *"The AI system analyzes the photographic evidence to assist the municipal officer — not to make autonomous decisions."*

**Steps:**
1. Show the existing demo complaint **CHD-TEST-0001** in the admin view.
2. Open its **AI Assessment** panel.
3. Walk through the scores:
   - Severity: 92/100
   - Safety Risk: 95/100
   - Evidence Support: 94/100
   - Image Quality: 90/100
4. Show the **reasoning summary** text.

**Key Points to Highlight:**
- The AI does **not** claim the image is authentic.
- It evaluates **Evidence Support** — how strongly the photo corroborates the description.
- `human_review_required` flag ensures critical cases get manual verification.
- All scores are bounded 0–100 with database-level CHECK constraints.

---

### Scene 3: Priority Engine & Admin Triage (3 minutes)

**Narrative:** *"The municipal administrator sees an automatically prioritized queue. No manual sorting needed — the deterministic formula surfaces the most urgent cases first."*

**Steps:**
1. Log in as `demo.admin@example.local`.
2. Navigate to **Admin Dashboard**.
3. Show the priority queue sorted by score:
   - CHD-TEST-0001: Critical (91.80) — Resolved ✅
   - CHD-TEST-0003: High (87.50) — Electrical hazard
   - CHD-TEST-0002: High (83.20) — Water leak
4. Open **CHD-TEST-0003** (exposed electrical cable).
5. Show the priority formula breakdown:
   - Severity × 0.35 + Safety Risk × 0.40 + Public Impact × 0.25
   - × Evidence Support modifier (0.50–1.00)
6. Transition the status: **assigned → in_progress**.
7. Add a note: "Emergency electrical crew dispatched."
8. Show the **status history audit trail** updating.

**Key Points to Highlight:**
- Formula is deterministic, explainable, and auditable.
- Weights: Safety Risk 40%, Severity 35%, Public Impact 25%.
- Evidence support is a multiplicative modifier (not additive).
- Every status change is logged with officer ID, timestamp, and notes.

---

### Scene 4: Duplicate Detection (2 minutes)

**Narrative:** *"Two separate citizens reported issues at the same Sector 22 bus stand footpath location. The system detected them as a potential duplicate cluster."*

**Steps:**
1. In Admin Dashboard, navigate to **Duplicate Management**.
2. Show the duplicate candidate pair:
   - **CHD-TEST-0003**: Exposed electrical wire
   - **CHD-TEST-0004**: Garbage dumping
   - Similarity Score: 78.50%
   - Matching Signals: `location_proximity_m: 28, sector_match, landmark_match`
3. Show that the admin can **Confirm Duplicate**, **Dismiss**, or leave as **Suggested**.
4. Explain: dismissal preserves both complaints as independent work orders.

**Key Points to Highlight:**
- Canonical pair ordering (`complaint_a_id < complaint_b_id`) prevents duplicate duplicate entries.
- No automated dismissal — admin always decides.
- Self-pairing is structurally impossible by database constraint.

---

### Scene 5: Citizen Tracking (1 minute)

**Narrative:** *"The citizen can track their complaint status in real-time without needing to contact the municipal office."*

**Steps:**
1. Log back in as `demo.citizen1@example.local`.
2. Navigate to **Track Complaint** and enter `CHD-TEST-0001`.
3. Show the visual status timeline:
   - ✅ Submitted → ✅ Under Review → ✅ Assigned → ✅ In Progress → ✅ **Resolved**
4. Show the notifications panel — two unread notifications for this complaint.

**Key Points to Highlight:**
- No phone calls or visits required.
- Notifications use idempotent `event_key` — no duplicate messages.
- Citizens can only see and mark-read their own notifications (RLS enforced).

---

### Scene 6: Security & Compliance (1 minute)

**Narrative:** *"Chandigarh CivicAI is built for civic-grade trust. No citizen data is accessible outside of its owner, and no sensitive identity attributes are stored."*

**Key Points to Highlight:**
- Row Level Security (RLS) on all 8 database tables — citizens cannot see each other's complaints.
- No Aadhaar, biometric, religion, caste, or gender data stored.
- Service-role key is never in client-side code — verified by automated test 21.
- 28-test security suite verifies authorization, injection prevention, and RLS at every phase.
- AI edge function is server-side only — Gemini API key never reaches the browser.

---

## 4. Q&A Preparation

**Q: Is the AI making autonomous decisions?**
> No. The AI provides an evidence support assessment that assists human administrators. Every AI recommendation is reviewed by a municipal officer before any action is taken. The system is explicitly designed to support human discretion, not replace it.

**Q: What happens if the AI is unavailable?**
> Complaints continue to be accepted normally. The `human_review_required` flag is automatically set to `true`, routing the complaint for manual assessment. The priority engine operates independently of the AI pipeline.

**Q: How is citizen privacy protected?**
> Row Level Security is enforced at the database level — citizens can only access their own data. No Aadhaar or other identity attributes are collected. Evidence photos are stored in a private bucket accessible only via time-limited signed URLs.

**Q: Can a citizen inflate their own priority score?**
> No. Citizens cannot write to `priority_score` or `priority_tier` columns — this is enforced by RLS policy and verified by automated test 6 in the security suite.

**Q: How are fake or malicious complaints handled?**
> The AI evidence support score explicitly measures whether the photo corroborates the description. Low evidence support results in a multiplicative score penalty. Administrators review all cases before action and can mark complaints as `rejected`.

---

## 5. Post-Demo Cleanup

After each demo session, optionally reset the demo state:

```sql
-- Reset demo complaint statuses (staging only — never run in production)
UPDATE public.complaints
SET status = 'submitted', updated_at = NOW()
WHERE tracking_id IN ('CHD-TEST-0002','CHD-TEST-0003','CHD-TEST-0004','CHD-TEST-0005','CHD-TEST-0006');

-- Reset demo notifications read status
UPDATE public.notifications
SET read_at = NULL
WHERE event_key LIKE 'demo-evt-%';
```

> [!WARNING]
> Run these SQL statements on **staging only**. Never run destructive resets on a project with real citizen data.
