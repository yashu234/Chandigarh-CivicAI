# Chandigarh CivicAI — Deterministic Civic Priority Engine (Phase 8)

## 1. Architectural Philosophy & Governance Principles

In civic public infrastructure, automated prioritization determines which municipal hazards, road collapses, sewer backups, and electrical dangers receive immediate engineering dispatch.

Chandigarh CivicAI enforces three non-negotiable architectural axioms:
1. **Separation of Decision Support & Prioritization**: The multimodal AI model (Phase 7) assesses objective physical and visual dimensions. The AI model **NEVER** decides or assigns the final municipal priority tier.
2. **100% Deterministic & Explainable**: The final priority score is computed through an authoritative, mathematically reproducible weighted sum. Given the same inputs, the engine always yields the exact same score and tier.
3. **Protected Attribute Immunity**: Constitutional non-discrimination is strictly baked into the type contracts. Zero personal or demographic attributes (Aadhaar, name, gender, religion, caste, race, ethnicity, disability, political affiliation, income, phone number, email) are accepted or factored into municipal priority.

---

## 2. Priority Scoring Formula & Weights

The authoritative priority score is defined as:

$$\text{Priority Score} = 0.35 \times \text{Severity} + 0.30 \times \text{Safety Risk} + 0.20 \times \text{Public Impact} + 0.10 \times \text{Recurrence} + 0.05 \times \text{Evidence Support}$$

All inputs are strictly bounded within $[0.00, 100.00]$. The resulting Priority Score is also strictly within $[0.00, 100.00]$.

### Centralized Weight Constants

Located in [`src/services/priority/priorityEngine.ts`](file:///c:/Users/yashu/.gemini/antigravity-ide/scratch/chandigarh-civicai/src/services/priority/priorityEngine.ts):

| Dimension | Weight | Mathematical Factor | Municipal Rationale |
| :--- | :---: | :---: | :--- |
| **Severity** | **35%** | `0.35` | Physical seriousness of the structural or infrastructure defect itself. |
| **Safety Risk** | **30%** | `0.30` | Potential immediate danger to human life, limb, motorists, pedestrians, or property. |
| **Public Impact** | **20%** | `0.20` | Degree of disruption to public mobility, pedestrian walkways, arterial corridors, or sanitation. |
| **Recurrence** | **10%** | `0.10` | Historical frequency of civic defects in the immediate vicinity (backend-controlled). |
| **Evidence Support** | **5%** | `0.05` | Corroboration strength of uploaded photographic evidence against written claims. |
| **Total** | **100%** | `1.00` | Normalized sum guarantees bounded 0.00 to 100.00 scale. |

---

## 3. Priority Tier Thresholds

The resulting numerical score is deterministically mapped to one of four municipal priority tiers:

| Tier | Score Range | SLA / Remediation Target | Example Civic Issues |
| :--- | :---: | :---: | :--- |
| **CRITICAL** | `80.00 – 100.00` | Immediate dispatch (within 2–6 hours) | Open manholes on Madhya Marg, live exposed electrical wires, major water main bursts. |
| **HIGH** | `60.00 – 79.99` | Accelerated dispatch (within 24 hours) | Deep asphalt craters on sector roads, fallen tree limbs blocking traffic, overflowing sewer junctions. |
| **MEDIUM** | `35.00 – 59.99` | Scheduled dispatch (within 3–5 days) | Non-functional streetlamps, broken curb pavers, uncleared horticultural waste. |
| **LOW** | `0.00 – 34.99` | Routine maintenance cycle (within 7–14 days) | Faded road markings, graffiti on utility boxes, minor landscaping maintenance. |

### Exact Boundary Mapping

- `Score < 35.00` (e.g., `34.99`) $\to$ **LOW**
- `Score >= 35.00` and `< 60.00` (e.g., `35.00`, `59.99`) $\to$ **MEDIUM**
- `Score >= 60.00` and `< 80.00` (e.g., `60.00`, `79.99`) $\to$ **HIGH**
- `Score >= 80.00` (e.g., `80.00`, `100.00`) $\to$ **CRITICAL**

---

## 4. Input Validation & Strict Error Handling

Before calculation, `validatePriorityInput` validates all dimensions:
- Any missing or undefined required field triggers `PriorityValidationError`.
- Any value `< 0` or `> 100` triggers `PriorityValidationError`.
- Non-numeric types, strings, `NaN`, and `Infinity` are rejected immediately.
- The engine **never silently clamps** invalid inputs; invalid requests fail loudly.

---

## 5. Recurrence Handling (Phased Architecture)

- **Backend-Controlled**: Recurrence is controlled exclusively by backend and server logic. Citizens cannot pass or inflate recurrence through client API requests.
- **Current Phase Default**: Until Phase 10 duplicate and recurring defect detection is built, newly submitted grievances default to:
  $$\text{Recurrence} = 0.00$$
- This guarantees that recurrence does not artificially inflate intake scores without historical verification.

---

## 6. Missing AI Assessment & Non-Fabrication Guarantee

If a complaint has no completed AI assessment (due to intake pending, missing API key, network timeout, or analysis error):
- **Zero Simulation**: The engine does **NOT** invent fake scores.
- **Pending AI State**: Returns typed status:
  ```typescript
  {
    status: 'pending_ai',
    score: null,
    tier: null,
    breakdown: null,
    humanReviewRequired: false,
    explanation: 'Priority score pending completion of AI evidence analysis.'
  }
  ```
- In the database, `priority_score` remains `NULL` until analysis completes.

---

## 7. Human Review & Safety Escalation

- If the AI assessment flags `human_review_required = true` (due to low image quality, description mismatch, or severe safety risk $\ge 80$), the priority result marks `humanReviewRequired: true`.
- **Non-Distortion Principle**: The human-review flag does **NOT** automatically change the priority tier to "Critical" or alter the mathematical formula.
- A complaint can be **HIGH + Human Review Required**, **MEDIUM + Human Review Required**, etc. Safety review and mathematical priority remain distinct municipal concepts.

---

## 8. Example Calculation & Civic Explainability

Suppose a citizen files a complaint regarding a collapsed drainage slab on a sector arterial road with photographic evidence:

### Input Scores
- **Severity**: $85.00$
- **Safety Risk**: $70.00$
- **Public Impact**: $80.00$
- **Recurrence**: $0.00$
- **Evidence Support**: $90.00$

### Step-by-Step Weighted Contributions
1. $\text{Severity Contribution} = 85.00 \times 0.35 = 29.75$
2. $\text{Safety Risk Contribution} = 70.00 \times 0.30 = 21.00$
3. $\text{Public Impact Contribution} = 80.00 \times 0.20 = 16.00$
4. $\text{Recurrence Contribution} = 0.00 \times 0.10 = 0.00$
5. $\text{Evidence Support Contribution} = 90.00 \times 0.05 = 4.50$

### Total Score
$$\text{Total Score} = 29.75 + 21.00 + 16.00 + 0.00 + 4.50 = 71.25$$

### Final Outcome
- **Priority Score**: `71.25 / 100`
- **Priority Tier**: **HIGH** (`60.00 <= 71.25 < 80.00`)
- **Human Review**: `false`

The complete component breakdown is transparently rendered on the citizen tracking view.

---

## 9. Future Administrative Override Foundation

For future administrative workflows (Phase 9/10):
- Municipal engineers may adjust priority tiers based on ground inspections.
- When an override occurs:
  1. The original AI-derived deterministic calculation (`priority_score`) in `public.ai_assessments` and `public.complaints` is **preserved**.
  2. The override event is logged in `public.admin_actions` with the admin officer's UUID, timestamp, prior tier, new tier, and mandatory justification note.
  3. The original assessment record is never overwritten or destroyed.

---

## 10. Database Consistency & Security (RLS)

- **Atomic Persistence**: `priority_score` and `priority_tier` are computed and persisted together in a single atomic update.
- **Strict Row Level Security**:
  - Citizens have `INSERT` and `SELECT` on `public.complaints`.
  - Citizens have **NO UPDATE** policy on `public.complaints`.
  - Citizens cannot forge or modify `priority_score` or `priority_tier`.
  - Updates occur strictly through administrative actions or trusted server-side Edge Functions running with `service_role`.
