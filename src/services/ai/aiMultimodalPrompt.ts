/**
 * Chandigarh CivicAI — Multimodal Prompt Engineering & Structured Output Contracts
 *
 * CRITICAL CIVIC AI PRINCIPLES:
 * 1. AI is advisory decision-support for human municipal engineers.
 * 2. The model evaluates "Evidence Support" (degree to which visual evidence corroborates
 *    the citizen's reported issue), NEVER forensic "authenticity".
 * 3. The model must NOT claim it can determine:
 *    - whether an image is authentic or edited
 *    - exact geographic location or GPS veracity
 *    - exact capture date/time
 *    - photographer identity or personal witness status
 * 4. All numeric dimensions must be strictly bounded between 0 and 100.
 */

export const CIVIC_AI_SYSTEM_INSTRUCTION = `
You are an explainable civic decision-support AI for the Municipal Corporation of Chandigarh, Union Territory, India.
Your role is to assist municipal civil engineers and public works officers in triaging citizen grievances by evaluating photographic evidence alongside written complaint statements.

CRITICAL OPERATIONAL & ETHICAL BOUNDARIES:
- You are strictly an advisory decision-support system, NOT a final administrative decider.
- You evaluate "Evidence Support" — how strongly the photographic evidence appears to corroborate the reported physical defect.
- You must NEVER claim to prove:
  * whether an image is authentic or digitally manipulated/edited
  * the exact real-world location where the photo was taken
  * the date, time, or lighting timestamp of capture
  * the identity of the photographer or citizen
- You must NEVER recommend rejecting a complaint. If an image is unclear, ambiguous, or lacks evidence, flag "human_review_required: true".

ASSESSMENT DIMENSIONS (All scores must be integers or decimals strictly between 0 and 100):
1. SEVERITY (0–100):
   Physical seriousness of the civic defect itself (e.g. deep crater pothole vs hairline crack, ruptured main vs minor leak).
2. SAFETY RISK (0–100):
   Potential immediate danger to public life, physical safety, motorists, pedestrians, or property.
3. EVIDENCE SUPPORT (0–100):
   How strongly the visual evidence appears to corroborate the reported civic issue. High score means clear visual correspondence; low score means inconclusive or unrelated visuals.
4. IMAGE QUALITY (0–100):
   Clarity, focus, lighting, and framing of the photograph for engineering inspection.
5. DESCRIPTION MATCH (0–100):
   How consistent the visual evidence is with the citizen's category and written statement.
6. PUBLIC IMPACT (0–100):
   Estimated disruption to public mobility, pedestrian walkways, arterial corridors, sanitation, or community infrastructure.

OUTPUT REQUIREMENTS:
You MUST respond with a single valid JSON object adhering strictly to the requested schema. No markdown formatting outside the JSON, no surrounding text.
`.trim();

export interface RawAIModelOutput {
  detected_issue: string;
  suggested_category: string;
  severity: number;
  safety_risk: number;
  evidence_support: number;
  image_quality: number;
  description_match: number;
  public_impact: number;
  reasoning_summary: string;
  human_review_required: boolean;
}

export interface ValidatedAIOutput {
  detectedIssue: string;
  suggestedCategory: string;
  severity: number;
  safetyRisk: number;
  evidenceSupport: number;
  imageQuality: number;
  descriptionMatch: number;
  publicImpact: number;
  reasoningSummary: string;
  humanReviewRequired: boolean;
  humanReviewReasons: string[];
}

/**
 * Builds the user prompt payload sent to Gemini multimodal API.
 */
export function buildCivicAnalysisPrompt(input: {
  title: string;
  description: string;
  category: string;
  sector: string;
  landmark?: string | null;
}): string {
  return `
Please analyze the attached civic grievance photograph and citizen statement:

[GRIEVANCE STATEMENT]
- Title: ${input.title}
- Reported Category: ${input.category}
- Location Sector: ${input.sector}${input.landmark ? ` (Near landmark: ${input.landmark})` : ''}
- Citizen Statement:
"${input.description}"

[REQUIRED JSON OUTPUT SCHEMA]
{
  "detected_issue": "Concise summary of physical defect visible in image (e.g., 'Asphalt crater pothole on vehicular carriageway')",
  "suggested_category": "Municipal category most applicable to this visual evidence",
  "severity": <numeric score 0 to 100>,
  "safety_risk": <numeric score 0 to 100>,
  "evidence_support": <numeric score 0 to 100>,
  "image_quality": <numeric score 0 to 100>,
  "description_match": <numeric score 0 to 100>,
  "public_impact": <numeric score 0 to 100>,
  "reasoning_summary": "Objective 2-3 sentence technical justification of the scores",
  "human_review_required": <true or false>
}
`.trim();
}

/**
 * Validates and sanitizes raw model output against the municipal contract.
 * Enforces strict 0–100 bounds and applies independent deterministic safety rules.
 */
export function validateAndSanitizeAIOutput(raw: unknown): {
  isValid: boolean;
  data: ValidatedAIOutput | null;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { isValid: false, data: null, error: 'Model output is not a valid JSON object.' };
  }

  const obj = raw as Record<string, unknown>;

  // Check required string fields
  if (typeof obj.detected_issue !== 'string' || !obj.detected_issue.trim()) {
    return { isValid: false, data: null, error: 'Missing or invalid "detected_issue" field.' };
  }
  if (typeof obj.suggested_category !== 'string' || !obj.suggested_category.trim()) {
    return { isValid: false, data: null, error: 'Missing or invalid "suggested_category" field.' };
  }
  if (typeof obj.reasoning_summary !== 'string' || !obj.reasoning_summary.trim()) {
    return { isValid: false, data: null, error: 'Missing or invalid "reasoning_summary" field.' };
  }
  if (obj.reasoning_summary.trim().length > 2500) {
    return { isValid: false, data: null, error: 'Reasoning summary is excessively long (exceeds 2500 characters).' };
  }

  // Validate numeric score dimensions (0.00 to 100.00)
  const scoreKeys: Array<{ key: keyof RawAIModelOutput; label: string }> = [
    { key: 'severity', label: 'severity' },
    { key: 'safety_risk', label: 'safety_risk' },
    { key: 'evidence_support', label: 'evidence_support' },
    { key: 'image_quality', label: 'image_quality' },
    { key: 'description_match', label: 'description_match' },
    { key: 'public_impact', label: 'public_impact' },
  ];

  const parsedScores: Record<string, number> = {};

  for (const { key, label } of scoreKeys) {
    const val = obj[key];
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      return {
        isValid: false,
        data: null,
        error: `Field "${label}" must be a valid finite number. Received: ${String(val)}`,
      };
    }
    if (val < 0 || val > 100) {
      return {
        isValid: false,
        data: null,
        error: `Field "${label}" score (${val}) is out of bounds. Must be between 0.00 and 100.00.`,
      };
    }
    parsedScores[key] = Math.round(val * 100) / 100; // standard 2-decimal precision
  }

  const rawModelFlag = Boolean(obj.human_review_required);
  const reviewReasons: string[] = [];

  // Deterministic municipal safety triggers (independent of model flag)
  if (parsedScores.image_quality < 40) {
    reviewReasons.push(`Low visual evidence quality (${parsedScores.image_quality}/100). Image is blurry or obstructed.`);
  }
  if (parsedScores.description_match < 40) {
    reviewReasons.push(`Low description consistency (${parsedScores.description_match}/100). Visuals do not match written report.`);
  }
  if (parsedScores.evidence_support < 40) {
    reviewReasons.push(`Low evidence support (${parsedScores.evidence_support}/100). Visual evidence provides weak corroboration.`);
  }
  if (parsedScores.safety_risk >= 80) {
    reviewReasons.push(`High public safety hazard flagged (${parsedScores.safety_risk}/100). Expedited engineer review required.`);
  }
  if (rawModelFlag && reviewReasons.length === 0) {
    reviewReasons.push('Model flagged subjective ambiguity or localized complexity.');
  }

  // Combined rule: human_review_required = model_flag OR deterministic_safety_rules
  const humanReviewRequired = rawModelFlag || reviewReasons.length > 0;

  // Sanitize reasoning_summary length (max 1000 characters)
  const sanitizedReasoning = obj.reasoning_summary.trim().slice(0, 1000);
  const sanitizedDetected = obj.detected_issue.trim().slice(0, 255);
  const sanitizedCategory = obj.suggested_category.trim().slice(0, 100);

  return {
    isValid: true,
    data: {
      detectedIssue: sanitizedDetected,
      suggestedCategory: sanitizedCategory,
      severity: parsedScores.severity,
      safetyRisk: parsedScores.safety_risk,
      evidenceSupport: parsedScores.evidence_support,
      imageQuality: parsedScores.image_quality,
      descriptionMatch: parsedScores.description_match,
      publicImpact: parsedScores.public_impact,
      reasoningSummary: sanitizedReasoning,
      humanReviewRequired,
      humanReviewReasons: reviewReasons,
    },
  };
}
