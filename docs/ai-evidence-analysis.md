# Chandigarh CivicAI — Image Evidence Analysis Foundation (Phase 6)

## 1. Architectural Philosophy & Ethical AI Framework

### 1.1 "Evidence Support" vs. "Authenticity"
In civic governance, automated machine learning models cannot and must not make unsubstantiated claims of authenticity. Chandigarh CivicAI enforces a strict terminology standard:

> **"Evidence Support"**
> The quantifiable degree (0.00 to 100.00) to which visual features in an uploaded photograph corroborate the specific physical defect, hazard scale, and municipal issue reported in the citizen's statement.

### 1.2 What the AI Cannot and Does Not Claim to Prove
The system explicitly disclaims the ability to prove forensic origins:
- **Cannot prove authenticity:** Deep neural networks cannot guarantee an image is genuine or unedited.
- **Cannot prove capture location:** Image pixels alone do not prove geographic coordinates (GPS metadata can be spoofed or stripped).
- **Cannot prove capture timestamp:** An image does not prove when an incident occurred.
- **Cannot prove photographer identity:** The model cannot verify who captured the media.

### 1.3 Advisory Decision Support (Human-in-the-Loop)
AI models serve strictly as **decision support** for Chandigarh municipal engineers and administrative officers:
- AI scores are never final municipal determinations.
- AI scores never automatically reject a citizen grievance.
- A low confidence score or poor image quality sets `human_review_required = true`, routing the issue into the officer queue for manual inspection.

---

## 2. Security Architecture & Zero Frontend Secrets

### 2.1 Backend-Only Secret Isolation
In accordance with zero-trust web architecture:
- **No AI API keys in client-side code:** There are no `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, or `VITE_ANTHROPIC_API_KEY` environment variables.
- Inference calls are strictly designed for execution within a secured server-side environment (Supabase Edge Functions, FastAPI service, or private background workers).
- Private storage bucket credentials (service-role keys) are never exposed to browser bundles.

### 2.2 Short-Lived Signed Evidence URLs
- Citizen complaint photographs are uploaded directly to the private Supabase Storage bucket (`complaint-evidence`).
- The storage bucket is **never public**.
- Access is strictly gated by database Row Level Security (`public.complaint_evidence` and `storage.objects`).
- Images are resolved through short-lived signed URLs (default expiry: 3600 seconds) created via `evidenceService.ts`.

---

## 3. Structured AI Assessment Contract

All assessment outputs conform to `StructuredAIAssessment` (`src/services/ai/aiAssessmentTypes.ts`):

```typescript
export type AIAnalysisState = 'pending' | 'completed' | 'failed' | 'not_configured';

export interface StructuredAIAssessment {
  id?: string;
  complaintId: string;
  detectedIssue: string | null;
  suggestedCategory: string | null;
  
  // Strictly bounded numeric dimensions (0.00 to 100.00)
  severity: number | null;
  safetyRisk: number | null;
  evidenceSupport: number | null;
  imageQuality: number | null;
  descriptionMatch: number | null;
  publicImpact: number | null;
  
  reasoningSummary: string | null;
  humanReviewRequired: boolean;
  humanReviewReasons: string[];
  analysisState: AIAnalysisState;
  modelVersion: string | null;
  createdAt: string;
}
```

### 3.1 Strict 0.00 to 100.00 Numeric Bounds
Before any assessment is committed to `public.ai_assessments`, `validateAssessmentScores` enforces that:
- Any non-null score must be a finite number.
- Scores must be strictly within `[0.00, 100.00]`.
- Out-of-bounds, NaN, or non-numeric values are rejected immediately.

---

## 4. Human Review Flagging Logic

Complaints require human review under any of the following objective conditions (`evaluateHumanReviewFlags`):
1. **Unconfigured Pipeline (`analysisState === 'not_configured'`):** Pipeline has not yet run in this environment; manual triage required.
2. **Analysis Failure (`analysisState === 'failed'`):** Processing error occurred; complaint preserved for manual handling.
3. **Low Evidence Support (`evidenceSupport < 40`):** Visual evidence does not conclusively corroborate written claims.
4. **Poor Visual Quality (`imageQuality < 40`):** Image is blurry, obstructed, or dark.
5. **Description Mismatch (`descriptionMatch < 40`):** Visual contents differ substantially from the citizen's category or text statement.
6. **Severe Safety Hazard (`safetyRisk >= 80`):** High hazard severity triggers expedited human verification.

**Non-Rejection Guarantee:** None of these conditions cause grievance rejection. The complaint remains in status `submitted` or `under_review` awaiting officer intervention.

---

## 5. Lifecycle Analysis States & Truthful UI

| State | Definition | UI Presentation |
| :--- | :--- | :--- |
| `not_configured` | The server-side inference pipeline is not configured in this environment. | "AI Evidence Analysis: Pending Pipeline Processing" with clear decision-support principles. No simulated scores are invented. |
| `pending` | The complaint intake has been logged, awaiting backend worker execution. | "AI Evidence Analysis: Pending Intake Evaluation". |
| `completed` | Real multimodal inference completed; row stored in `public.ai_assessments`. | Full 6-dimension metric meters, reasoning summary, Evidence Support score, and human review status. |
| `failed` | The evidence pipeline encountered a processing or timeout error. | "Evidence Analysis Processing Failed — Routed to municipal engineers with human_review_required = true". |

---

## 6. Real Multimodal AI Inference (Phase 7)

### 6.1 Server-Side Execution Architecture
- **Location**: Supabase Edge Function (`supabase/functions/analyze-complaint-evidence/index.ts`).
- **Provider**: Google Gemini (`gemini-1.5-flash` multimodal model).
- **Client Provider Adapter**: `SupabaseEdgeAIProvider` in `src/services/ai/aiProvider.ts`, invoked via `supabase.functions.invoke('analyze-complaint-evidence')`.
- **Zero Frontend Secret Guarantee**: The `GEMINI_API_KEY` exists exclusively as a server-side secret (`supabase secrets set GEMINI_API_KEY=...`). No frontend Vite variable (`VITE_*_API_KEY`) exists in the repository.

### 6.2 Authentication & Authorization Enforcement
1. **User JWT Validation**: The Edge Function verifies the `Authorization: Bearer <token>` header with Supabase Auth (`supabase.auth.getUser(token)`).
2. **Ownership Verification**: The function verifies that either:
   - The authenticated user's ID matches the complaint's `citizen_id`, OR
   - The user has role `admin` in `public.profiles`.
3. **Private Evidence Retrieval**: The function retrieves the evidence row from `public.complaint_evidence` and downloads the image blob directly from the private `complaint-evidence` bucket using server-side storage credentials. No permanent public URLs are ever created or persisted.

### 6.3 Prompt Engineering & Structured Output
- **System Instruction**: Enforces municipal civic decision support role. Explicitly instructs model **NEVER** to claim authenticity, GPS certainty, or photographer verification.
- **Multimodal Payload**: Receives image MIME type and base64 data, citizen textual description, and reported category.
- **Structured JSON Schema**:
  ```json
  {
    "detected_issue": "string",
    "suggested_category": "string",
    "severity": 0,
    "safety_risk": 0,
    "evidence_support": 0,
    "image_quality": 0,
    "description_match": 0,
    "public_impact": 0,
    "reasoning_summary": "string",
    "human_review_required": false
  }
  ```
- **Validation Rules**:
  - All six numeric metrics must be finite numbers in `[0, 100]`.
  - Non-numeric, negative, or >100 values trigger rejection and failed state.
  - `reasoning_summary` is truncated to a safe 1000-character ceiling.

### 6.4 Human Review Enforcement
The backend enforces human review independently of the model's boolean flag:
```
human_review_required = model_flag || deterministic_safety_rules
```
Triggers:
- `image_quality < 40`
- `description_match < 40`
- `evidence_support < 40`
- `safety_risk >= 80`
- Processing failure / unconfigured state

### 6.5 Idempotency & Re-analysis Safety
- If a completed assessment already exists for a complaint, calling analysis returns the existing assessment without invoking Gemini, preventing duplicate billable inference.
- Passing `reanalyze: true` allows authorized users to perform an explicit re-analysis.
- In-memory concurrent lock prevents parallel processing for the same complaint ID.

### 6.6 Database Persistence
Assessments are stored in `public.ai_assessments` using upsert on `complaint_id`. Zero API keys, tokens, or raw authorization headers are persisted.

---

## 7. Implementation Scope Boundaries

### What Phase 7 Implements
1. **Multimodal Prompt & Validation (`src/services/ai/aiMultimodalPrompt.ts`)**: Structured JSON schema, system instructions with non-authenticity bounds, 0–100 score validation, human-review enforcement.
2. **Supabase Edge Function (`supabase/functions/analyze-complaint-evidence/index.ts`)**: Authenticated multimodal inference endpoint with Gemini 1.5 Flash, server-side private storage retrieval, and RLS persistence.
3. **Provider Integration (`src/services/ai/aiProvider.ts`)**: `SupabaseEdgeAIProvider` invoking backend endpoint, handling `not_configured`, `completed`, and `failed` truthfully.
4. **Interactive Frontend UI (`ComplaintDetailsPage.tsx`)**: "Analyze Evidence", "Re-analyze Evidence", and "Retry Analysis" actions with active progress states.
5. **Comprehensive Automated Tests (`test/phase7_tests.mjs`)**: 12 automated unit and integration boundary tests.

### What Remains for Subsequent Phases
- **Phase 8:** Priority Engine (Deterministic mathematical formula combining severity, safety, impact, and evidence support into priority scores and Critical/High/Medium/Low tiers).
- **Phase 9:** Duplicate Grievance & Recurring Defect Detection.
- **Phase 10:** Admin Triage, Department Routing, and Field Officer Assignment.
- **Phase 11:** Automated Citizen Notifications.
- **Phase 12:** Production Deployment.
