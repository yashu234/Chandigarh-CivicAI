# Chandigarh CivicAI — Duplicate & Recurring Complaint Detection (Phase 10)

## 1. Architectural Principles & Decision-Support Boundaries

Duplicate detection and recurrence analysis in Chandigarh CivicAI are strictly engineered as **advisory decision-support tools** for municipal administrators:

1. **Advisory Decision Support Only**: Algorithms calculate heuristic correlation and suggest candidate duplicate pairs. The system **never automatically merges or deletes complaints**.
2. **Deterministic & Explainable**: Detection relies on transparent, weighted mathematical formulas with explainable breakdowns rather than opaque embeddings or arbitrary matching.
3. **Preservation of Distinct Civic Records**: Confirming a duplicate transitions the candidate complaint's lifecycle to `'duplicate'` while preserving its tracking number, citizen attribution, intake timestamp, and full remediation audit trail.
4. **Canonical Pair Ordering**: Complaint pairings are strictly normalized ($A < B$), preventing self-pairing ($A = A$) and duplicate inverse entries ($A \to B$ vs $B \to A$).
5. **Zero Protected Personal Attributes**: Detection is strictly blind to citizen identity, phone numbers, demographic data, Aadhaar, gender, religion, caste, or personal information.
6. **Photographic Evidence Discipline**: The system **never claims** photographic evidence proves image authenticity, exact camera coordinates, or that two images depict the exact same physical incident. Images assist human review only.

---

## 2. Duplicate Detection Algorithm & Signal Weights

Duplicate similarity is scored on an objective, normalized **0.00 – 100.00%** scale using five explainable civic dimensions.

### Signal Weights ($\sum = 1.00$)

| Dimension | Weight | Input Attributes | Metric / Calculation |
| :--- | :---: | :--- | :--- |
| **Category Match** | **0.25** (25%) | `category` | Exact civic domain match ($100\%$ if identical, $0\%$ if different). |
| **Spatial / Sector Proximity** | **0.25** (25%) | `sector`, `coordinates` (latitude/longitude) | Haversine distance if GPS available ($\le 50\text{m} \to 100\%$, $\le 150\text{m} \to 85\%$, $\le 300\text{m} \to 60\%$, $\le 600\text{m} \to 30\%$). Gracefully falls back to municipal sector match ($85\%$) when coordinates are omitted. |
| **Text Vocabulary Overlap** | **0.30** (30%) | `title`, `description` | Jaccard token overlap on normalized civic vocabulary after standard stop word removal. |
| **Temporal Proximity** | **0.15** (15%) | `created_at` | Time interval between reports ($\le 24\text{h} \to 100\%$, $\le 72\text{h} \to 80\%$, $\le 7\text{d} \to 60\%$, $\le 30\text{d} \to 30\%$). |
| **Address & Landmark Overlap** | **0.05** (5%) | `landmark`, `street_address` | Normalized token overlap on street, block, and landmark descriptors. |

$$\text{Similarity Score} = 0.25 \cdot S_{\text{cat}} + 0.25 \cdot S_{\text{loc}} + 0.30 \cdot S_{\text{text}} + 0.15 \cdot S_{\text{time}} + 0.05 \cdot S_{\text{landmark}}$$

### Advisory Threshold
- **Threshold**: $\ge 60.00\%$ similarity **and** matching category flags an advisory duplicate candidate.
- Initial state is strictly `status = 'suggested'`.

---

## 3. Municipal Recurrence Definition & Signal

Municipal recurrence identifies chronic infrastructure defects within specific UT Chandigarh sectors over a rolling municipal window.

### Recurrence Formula
- **Rolling Window**: 60 days prior to complaint intake.
- **Scope**: Matching `sector` and `category`.
- **Count ($N$)**: Total prior complaints in the sector under the same category within the 60-day window.
- **Recurrence Score**:
  $$\text{Recurrence Score} = \min(100, N \times 25)$$

### Recurrence Levels

| Prior Reports ($N$) | Recurrence Score | Level | Municipal Interpretation |
| :---: | :---: | :--- | :--- |
| **0** | **0** | `none` | Isolated incident in sector within past 60 days. |
| **1** | **25** | `emerging` | Emerging pattern in sector within past 60 days. |
| **2** | **50** | `frequent` | Frequent recurring defect in sector within past 60 days. |
| **3** | **75** | `chronic` | Chronic infrastructure failure in sector. |
| **$\ge 4$** | **100** | `severe` | Severe recurring defect requiring capital works or systemic review. |

### Priority Score Non-Mutation
The recurrence signal is computed on the backend for administrative decision support. To preserve audit integrity and historical reproducibility, historical Phase 8 priority scores remain unchanged until administrative confirmation.

---

## 4. Database Schema & RLS Security Model

### Schema Definition (`public.complaint_duplicates`)

```sql
CREATE TABLE IF NOT EXISTS public.complaint_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_a_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    complaint_b_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 100),
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'dismissed', 'confirmed_duplicate')),
    matching_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_complaint_pair_order CHECK (complaint_a_id < complaint_b_id),
    CONSTRAINT uq_complaint_pair UNIQUE (complaint_a_id, complaint_b_id)
);
```

### Row-Level Security (RLS) Policies
- **Admins**: `FOR ALL` gated by `public.is_admin()`.
- **Citizens**: `FOR SELECT` only, strictly restricted to records where `auth.uid()` matches either `complaint_a.citizen_id` or `complaint_b.citizen_id`.
- **Citizens cannot insert, update, or delete** duplicate records under any circumstance.
- **Zero permissive policies**: No `USING (true)` or `WITH CHECK (true)` anywhere in the database schema.

---

## 5. Administrative Review Workflow

1. **Advisory Discovery**:
   - The admin triage queue displays a `Duplicate Advisory` badge next to complaints with active candidate suggestions.
   - Filtering allows admins to isolate grievances requiring duplicate triage.
2. **Candidate Inspection**:
   - Section E on the complaint detail page displays all candidate pairs, overall similarity score, explainable signal breakdown, and direct link to inspect the candidate complaint.
3. **Administrative Actions**:
   - **Confirm Duplicate**: Requires a mandatory justification reason ($\ge 5$ characters). Transitions the duplicate grievance to `'duplicate'` status via the Phase 9 state machine, updates the suggestion record to `'confirmed_duplicate'`, and logs immutable records in `public.admin_actions` and `public.complaint_status_history`.
   - **Dismiss Suggestion / Keep Separate**: Confirms the complaints represent distinct physical issues and updates suggestion status to `'dismissed'` with an administrative review note. Both complaints remain active in the triage queue.

---

## 6. Technical Limitations & Safeguards

1. **Photographic Evidence**: Image analysis cannot verify physical provenance or camera hardware authenticity. Photos are evaluated solely for content consistency and severity corroboration.
2. **GPS Accuracy**: In urban canyon environments or indoors, mobile device GPS may experience drift of $20\text{m} - 50\text{m}$. Spatial scoring accommodates this with graduated proximity tiers ($50\text{m}$, $150\text{m}$, $300\text{m}$, $600\text{m}$) and sector fallback.
3. **No Automatic Actions**: Even complaints scoring $100.00\%$ similarity remain in `suggested` status until an authorized municipal administrator explicitly reviews and confirms them.
