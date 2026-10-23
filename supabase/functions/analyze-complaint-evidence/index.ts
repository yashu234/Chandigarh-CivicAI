// Setup type definitions for built-in Supabase Edge Runtime environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CIVIC_AI_SYSTEM_INSTRUCTION = `
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

ASSESSMENT DIMENSIONS (All scores must be numeric between 0 and 100):
1. SEVERITY (0–100): Physical seriousness of the civic defect itself.
2. SAFETY RISK (0–100): Potential immediate danger to public life, physical safety, motorists, pedestrians, or property.
3. EVIDENCE SUPPORT (0–100): How strongly the visual evidence appears to corroborate the reported civic issue.
4. IMAGE QUALITY (0–100): Clarity, focus, lighting, and framing of the photograph for engineering inspection.
5. DESCRIPTION MATCH (0–100): How consistent the visual evidence is with the citizen's category and written statement.
6. PUBLIC IMPACT (0–100): Estimated disruption to public mobility, pedestrian walkways, arterial corridors, sanitation, or community infrastructure.

OUTPUT REQUIREMENTS:
Respond ONLY with a single valid JSON object adhering strictly to the requested schema. No surrounding text or markdown formatting.
`.trim();

interface RequestPayload {
  complaintId: string;
  reanalyze?: boolean;
}

interface RawModelOutput {
  detected_issue?: unknown;
  suggested_category?: unknown;
  severity?: unknown;
  safety_risk?: unknown;
  evidence_support?: unknown;
  image_quality?: unknown;
  description_match?: unknown;
  public_impact?: unknown;
  reasoning_summary?: unknown;
  human_review_required?: unknown;
}

// In-flight concurrency deduplication map
const inFlightAnalyses = new Map<string, Promise<Response>>();

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 16384;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function validateAndSanitizeScores(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Model output is not a JSON object.');
  }

  const obj = raw as RawModelOutput;

  if (typeof obj.detected_issue !== 'string' || !obj.detected_issue.trim()) {
    throw new Error('Model output missing "detected_issue".');
  }
  if (typeof obj.suggested_category !== 'string' || !obj.suggested_category.trim()) {
    throw new Error('Model output missing "suggested_category".');
  }
  if (typeof obj.reasoning_summary !== 'string' || !obj.reasoning_summary.trim()) {
    throw new Error('Model output missing "reasoning_summary".');
  }

  if (obj.reasoning_summary.trim().length > 2500) {
    throw new Error('Model reasoning summary exceeds maximum allowable length (2500 chars).');
  }
  if (obj.detected_issue.trim().length > 500) {
    throw new Error('Model detected_issue exceeds maximum allowable length (500 chars).');
  }
  if (obj.suggested_category.trim().length > 200) {
    throw new Error('Model suggested_category exceeds maximum allowable length (200 chars).');
  }

  const dimensions: Array<{ key: keyof RawModelOutput; label: string }> = [
    { key: 'severity', label: 'severity' },
    { key: 'safety_risk', label: 'safety_risk' },
    { key: 'evidence_support', label: 'evidence_support' },
    { key: 'image_quality', label: 'image_quality' },
    { key: 'description_match', label: 'description_match' },
    { key: 'public_impact', label: 'public_impact' },
  ];

  const parsedScores: Record<string, number> = {};

  for (const { key, label } of dimensions) {
    const val = obj[key];
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      throw new Error(`Dimension "${label}" must be a valid finite number.`);
    }
    if (val < 0 || val > 100) {
      throw new Error(`Dimension "${label}" (${val}) is out of bounds (0–100).`);
    }
    parsedScores[key] = Math.round(val * 100) / 100;
  }

  const rawModelFlag = Boolean(obj.human_review_required);
  const reviewReasons: string[] = [];

  // Deterministic municipal safety rules
  if (parsedScores.image_quality < 40) {
    reviewReasons.push(`Low visual evidence quality (${parsedScores.image_quality}/100).`);
  }
  if (parsedScores.description_match < 40) {
    reviewReasons.push(`Low description consistency (${parsedScores.description_match}/100).`);
  }
  if (parsedScores.evidence_support < 40) {
    reviewReasons.push(`Low evidence support (${parsedScores.evidence_support}/100).`);
  }
  if (parsedScores.safety_risk >= 80) {
    reviewReasons.push(`High public safety hazard flagged (${parsedScores.safety_risk}/100).`);
  }
  if (rawModelFlag && reviewReasons.length === 0) {
    reviewReasons.push('Model flagged subjective ambiguity.');
  }

  const humanReviewRequired = rawModelFlag || reviewReasons.length > 0;

  return {
    detectedIssue: obj.detected_issue.trim().slice(0, 255),
    suggestedCategory: obj.suggested_category.trim().slice(0, 100),
    severity: parsedScores.severity,
    safetyRisk: parsedScores.safety_risk,
    evidenceSupport: parsedScores.evidence_support,
    imageQuality: parsedScores.image_quality,
    descriptionMatch: parsedScores.description_match,
    publicImpact: parsedScores.public_impact,
    reasoningSummary: obj.reasoning_summary.trim().slice(0, 1000),
    humanReviewRequired,
    humanReviewReasons: reviewReasons,
  };
}

/**
 * Sanitizes messages so secrets, API keys, JWTs, and image/binary payloads
 * are never written to server logs or leaked in error responses.
 */
function sanitizeLogMessage(
  rawMessage: string,
  knownSecrets: (string | undefined | null)[] = []
): string {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  let sanitized = rawMessage;

  // 1. Redact known runtime secret values (e.g. GEMINI_API_KEY, tokens)
  for (const secret of knownSecrets) {
    if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
      sanitized = sanitized.replaceAll(secret.trim(), '[REDACTED_SECRET]');
    }
  }

  // 2. Redact Google / Gemini API keys (AIza...)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]');

  // 3. Redact query parameter keys (e.g., ?key=... or &key=...)
  sanitized = sanitized.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED_KEY]');

  // 4. Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');

  // 5. Redact JWT tokens (header.payload.signature)
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+(?:\.[A-Za-z0-9-_.+/=]*)?/g, '[REDACTED_JWT]');

  // 6. Redact base64 image inline data if echoed in errors
  sanitized = sanitized.replace(/"data"\s*:\s*"[^"]{50,}"/g, '"data":"[REDACTED_IMAGE_CONTENT]"');
  sanitized = sanitized.replace(/[A-Za-z0-9+/=]{100,}/g, '[REDACTED_BINARY]');

  // 7. Limit message length
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000) + '... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Authoritative Deterministic Priority Formula (Phase 8):
 * Priority Score = 0.35 * Severity + 0.30 * Safety Risk + 0.20 * Public Impact + 0.10 * Recurrence + 0.05 * Evidence Support
 * Bands:
 * 80.00 – 100.00: Critical
 * 60.00 –  79.99: High
 * 35.00 –  59.99: Medium
 *  0.00 –  34.99: Low
 */
function computeDeterministicPriority(
  severity: number,
  safetyRisk: number,
  publicImpact: number,
  recurrence: number,
  evidenceSupport: number
) {
  const rawPriorityScore =
    0.35 * severity +
    0.30 * safetyRisk +
    0.20 * publicImpact +
    0.10 * recurrence +
    0.05 * evidenceSupport;

  const score = Math.round(rawPriorityScore * 100) / 100;

  let tier = 'low';
  if (score >= 80.0) {
    tier = 'critical';
  } else if (score >= 60.0) {
    tier = 'high';
  } else if (score >= 35.0) {
    tier = 'medium';
  }

  const breakdown = {
    severity: { score: severity, weight: 0.35, contribution: Math.round(severity * 0.35 * 100) / 100 },
    safetyRisk: { score: safetyRisk, weight: 0.30, contribution: Math.round(safetyRisk * 0.30 * 100) / 100 },
    publicImpact: { score: publicImpact, weight: 0.20, contribution: Math.round(publicImpact * 0.20 * 100) / 100 },
    recurrence: { score: recurrence, weight: 0.10, contribution: Math.round(recurrence * 0.10 * 100) / 100 },
    evidenceSupport: { score: evidenceSupport, weight: 0.05, contribution: Math.round(evidenceSupport * 0.05 * 100) / 100 },
  };

  return { score, tier, breakdown };
}

/**
 * Calculates sector recurrence score on the trusted backend:
 * Counts prior complaints in the same sector & category within rolling 60 days.
 * Formula: min(100, priorCount * 25)
 */
async function calculateBackendRecurrence(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  sector: string,
  category: string,
  complaintId: string,
  createdAt?: string
): Promise<number> {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    let query = adminClient
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('sector', sector)
      .eq('category', category)
      .neq('id', complaintId)
      .gte('created_at', sixtyDaysAgo);

    if (createdAt) {
      query = query.lt('created_at', createdAt);
    }

    const { count, error } = await query;
    if (error) {
      console.warn('[EdgeFunction] Warning calculating recurrence:', error.message);
      return 0;
    }
    const priorCount = count ?? 0;
    return Math.min(100, priorCount * 25);
  } catch {
    return 0;
  }
}

async function handleAnalysisRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        state: 'not_configured',
        error: 'Supabase server environment variables are not configured.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Validate authenticated citizen/admin session
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or expired citizen session.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 3. Parse request body
  const body: RequestPayload = await req.json().catch(() => ({} as RequestPayload));
  if (!body.complaintId) {
    return new Response(
      JSON.stringify({ error: 'Missing required field "complaintId".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Load complaint and verify ownership / admin authority
  const { data: complaint, error: compError } = await adminClient
    .from('complaints')
    .select('*')
    .eq('id', body.complaintId)
    .maybeSingle();

  if (compError || !complaint) {
    return new Response(
      JSON.stringify({ error: 'Complaint not found.' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check user profile for admin role
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isOwner = complaint.citizen_id === user.id;

  if (!isOwner && !isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'Access denied: You are not authorized to analyze evidence for this grievance.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 5. Idempotency Check: Return existing completed assessment if reanalyze is not requested
  if (!body.reanalyze) {
    const { data: existingAssessment } = await adminClient
      .from('ai_assessments')
      .select('*')
      .eq('complaint_id', body.complaintId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (existingAssessment) {
      const sev = Number(existingAssessment.severity ?? 0);
      const safe = Number(existingAssessment.safety_risk ?? 0);
      const pub = Number(existingAssessment.public_impact ?? 0);
      const ev = Number(existingAssessment.evidence_support ?? 0);
      const rec = await calculateBackendRecurrence(
        adminClient,
        complaint.sector,
        complaint.category,
        body.complaintId,
        complaint.created_at
      );

      const priorityResult = computeDeterministicPriority(sev, safe, pub, rec, ev);

      if (complaint.priority_score === null || complaint.priority_score === undefined) {
        await adminClient
          .from('complaints')
          .update({ priority_score: priorityResult.score, priority_tier: priorityResult.tier })
          .eq('id', body.complaintId);
      }

      return new Response(
        JSON.stringify({
          state: 'completed',
          data: existingAssessment,
          cached: true,
          priority: {
            score: priorityResult.score,
            tier: priorityResult.tier,
            breakdown: priorityResult.breakdown,
            humanReviewRequired: Boolean(existingAssessment.human_review_required),
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // 6. Check server-side Gemini API key configuration
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    return new Response(
      JSON.stringify({
        state: 'not_configured',
        message:
          'GEMINI_API_KEY is not configured in Supabase Edge Function secrets. Inference pipeline requires server-side key setup.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 7. Load complaint evidence metadata
  const { data: evidence, error: evError } = await adminClient
    .from('complaint_evidence')
    .select('*')
    .eq('complaint_id', body.complaintId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (evError || !evidence) {
    return new Response(
      JSON.stringify({
        state: 'failed',
        error: 'Complaint does not have photographic evidence uploaded for analysis.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 8. Retrieve private image from Supabase Storage
  const bucket =
    Deno.env.get('SUPABASE_EVIDENCE_BUCKET') ||
    Deno.env.get('VITE_SUPABASE_EVIDENCE_BUCKET') ||
    'complaint-evidence';

  const { data: fileBlob, error: downloadError } = await adminClient.storage
    .from(bucket)
    .download(evidence.storage_path);

  if (downloadError || !fileBlob) {
    return new Response(
      JSON.stringify({
        state: 'failed',
        error: 'Failed to retrieve private evidence image from secure storage.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Convert file bytes to base64 using safe chunked buffer processing
  const buffer = await fileBlob.arrayBuffer();
  const base64Bytes = bufferToBase64(buffer);

  // 9. Call Gemini Multimodal Inference API
  const modelVersion = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent`;

  const promptText = `
Please analyze the attached civic grievance photograph and citizen statement:

[GRIEVANCE STATEMENT]
- Title: ${complaint.title}
- Reported Category: ${complaint.category}
- Location Sector: ${complaint.sector}${complaint.landmark ? ` (Near landmark: ${complaint.landmark})` : ''}
- Citizen Statement:
"${complaint.description}"

[REQUIRED JSON OUTPUT SCHEMA]
{
  "detected_issue": "Concise technical summary of physical defect visible in image",
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

  const rawMime = (evidence.mime_type || '').toLowerCase().trim();
  const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime || 'image/jpeg';

  const requestPayload = {
    system_instruction: {
      parts: [{ text: CIVIC_AI_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: normalizedMime,
              data: base64Bytes,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
      max_output_tokens: 1024,
    },
  };

  // Configurable inference timeout (default: 60s, bounds: 10s–120s to stay safely within 150s platform limit)
  const envTimeout = Deno.env.get('GEMINI_TIMEOUT_MS');
  const timeoutMs =
    envTimeout && !isNaN(Number(envTimeout)) && Number(envTimeout) >= 10000 && Number(envTimeout) <= 120000
      ? Number(envTimeout)
      : 60000;
  const timeoutSec = Math.round(timeoutMs / 1000);

  let aiResponse: Response;
  try {
    aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(timeoutMs), // Abortable request cleanly cancels underlying connection on timeout
    });
  } catch (fetchErr: unknown) {
    const isTimeout =
      fetchErr instanceof Error &&
      (fetchErr.name === 'TimeoutError' ||
        fetchErr.name === 'AbortError' ||
        fetchErr.message?.includes('timed out'));

    const errMessage = isTimeout
      ? `AI provider inference timed out after ${timeoutSec} seconds. Please retry with a clearer or smaller image.`
      : 'Network connection to AI provider failed. Please check network connectivity and retry.';

    console.error(`[EdgeFunction] Gemini fetch failure: model=${modelVersion} timeout=${isTimeout} timeoutSec=${timeoutSec}`);

    return new Response(
      JSON.stringify({
        state: 'failed',
        error: errMessage,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    let parsedErrorMsg = '';
    try {
      const parsed = JSON.parse(errText);
      parsedErrorMsg = parsed.error?.message || parsed.message || errText;
    } catch {
      parsedErrorMsg = errText;
    }

    const sanitizedError = sanitizeLogMessage(parsedErrorMsg, [geminiApiKey]);
    console.error(
      `[EdgeFunction] Gemini API HTTP failure: upstream_status=${aiResponse.status} model=${modelVersion} error="${sanitizedError}"`
    );

    let specificErrorMessage = `AI provider error (HTTP ${aiResponse.status}). Model inference could not be completed.`;
    if (aiResponse.status === 404) {
      specificErrorMessage = `Model "${modelVersion}" is not supported or has been retired by Google AI. Please check GEMINI_MODEL configuration in Supabase.`;
    } else if (aiResponse.status === 429) {
      specificErrorMessage = 'Gemini API rate limit exceeded (HTTP 429). The system is temporarily throttling requests; please retry in a few moments.';
    } else if (aiResponse.status === 401 || aiResponse.status === 403) {
      specificErrorMessage = `AI provider authorization failed (HTTP ${aiResponse.status}). Server GEMINI_API_KEY may be invalid, missing, or unauthorized.`;
    } else if (aiResponse.status >= 500) {
      specificErrorMessage = `AI provider service is temporarily unavailable (HTTP ${aiResponse.status}). Upstream server error; please retry shortly.`;
    }

    return new Response(
      JSON.stringify({
        state: 'failed',
        error: specificErrorMessage,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const aiJson = await aiResponse.json();
  const candidate = aiJson.candidates?.[0];
  const candidateText = candidate?.content?.parts?.[0]?.text;

  if (!candidateText) {
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const blockReason = aiJson.promptFeedback?.blockReason || 'NONE';
    console.error(
      `[EdgeFunction] Gemini API response missing content: finishReason=${finishReason} blockReason=${blockReason} model=${modelVersion}`
    );
    return new Response(
      JSON.stringify({
        state: 'failed',
        error: `AI provider returned an empty or unparseable response (Finish Reason: ${finishReason}).`,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(candidateText);
  } catch {
    const sanitizedSnippet = sanitizeLogMessage(candidateText.slice(0, 300), [geminiApiKey]);
    console.error(
      `[EdgeFunction] AI provider returned malformed JSON output: snippet="${sanitizedSnippet}"`
    );
    return new Response(
      JSON.stringify({
        state: 'failed',
        error: 'AI provider returned malformed JSON output.',
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 10. Strict Server-side Score Validation & Deterministic Safety Rules
  const validated = validateAndSanitizeScores(parsedRaw);

  // 11. Persistence: Upsert into public.ai_assessments via adminClient
  const { data: existingRow } = await adminClient
    .from('ai_assessments')
    .select('id')
    .eq('complaint_id', body.complaintId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  let savedAssessment: Record<string, unknown> | null = null;

  if (existingRow?.id) {
    const { data: updatedRow, error: updateErr } = await adminClient
      .from('ai_assessments')
      .update({
        detected_issue: validated.detectedIssue,
        suggested_category: validated.suggestedCategory,
        severity: validated.severity,
        safety_risk: validated.safetyRisk,
        evidence_support: validated.evidenceSupport,
        image_quality: validated.imageQuality,
        description_match: validated.descriptionMatch,
        public_impact: validated.publicImpact,
        reasoning_summary: validated.reasoningSummary,
        human_review_required: validated.humanReviewRequired,
        model_version: modelVersion,
      })
      .eq('id', existingRow.id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;
    savedAssessment = updatedRow;
  } else {
    const { data: insertedRow, error: insertErr } = await adminClient
      .from('ai_assessments')
      .insert({
        complaint_id: body.complaintId,
        detected_issue: validated.detectedIssue,
        suggested_category: validated.suggestedCategory,
        severity: validated.severity,
        safety_risk: validated.safetyRisk,
        evidence_support: validated.evidenceSupport,
        image_quality: validated.imageQuality,
        description_match: validated.descriptionMatch,
        public_impact: validated.publicImpact,
        reasoning_summary: validated.reasoningSummary,
        human_review_required: validated.humanReviewRequired,
        model_version: modelVersion,
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;
    savedAssessment = insertedRow;
  }

  // 12. Authoritative Deterministic Priority Calculation (Phase 8 & Phase 10)
  // Backend-calculated recurrence score (min(100, priorCount * 25))
  const recurrence = await calculateBackendRecurrence(
    adminClient,
    complaint.sector,
    complaint.category,
    body.complaintId,
    complaint.created_at
  );

  const priorityResult = computeDeterministicPriority(
    validated.severity,
    validated.safetyRisk,
    validated.publicImpact,
    recurrence,
    validated.evidenceSupport
  );

  // Persist priority_score and priority_tier atomically into public.complaints
  const { error: complaintUpdateErr } = await adminClient
    .from('complaints')
    .update({
      priority_score: priorityResult.score,
      priority_tier: priorityResult.tier,
    })
    .eq('id', body.complaintId);

  if (complaintUpdateErr) {
    console.warn('[EdgeFunction] Warning updating complaint priority:', complaintUpdateErr);
  }

  // 13. Return completed assessment with deterministic priority
  return new Response(
    JSON.stringify({
      state: 'completed',
      data: {
        ...savedAssessment,
        human_review_reasons: validated.humanReviewReasons,
      },
      priority: {
        score: priorityResult.score,
        tier: priorityResult.tier,
        breakdown: priorityResult.breakdown,
        humanReviewRequired: validated.humanReviewRequired,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let complaintIdKey: string | null = null;
  try {
    // Clone body to extract complaintId for concurrency deduplication
    const clonedReq = req.clone();
    const parsedBody: RequestPayload = await clonedReq.json().catch(() => ({} as RequestPayload));
    if (parsedBody?.complaintId && typeof parsedBody.complaintId === 'string') {
      complaintIdKey = parsedBody.complaintId.trim();
    }
  } catch {
    // Ignore clone parse errors, handler will return 400
  }

  // If a request for this complaintId is currently in flight, deduplicate and reuse it
  if (complaintIdKey && inFlightAnalyses.has(complaintIdKey)) {
    try {
      const activePromise = inFlightAnalyses.get(complaintIdKey)!;
      const res = await activePromise;
      return res.clone();
    } catch {
      // In case of error in previous in-flight promise, continue to fresh attempt
    }
  }

  const analysisPromise = (async () => {
    try {
      return await handleAnalysisRequest(req);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      const sanitizedLog = sanitizeLogMessage(rawMessage, [geminiApiKey]);
      console.error(`[EdgeFunction] Unexpected error during analysis: ${sanitizedLog}`);
      const isSensitive = /syntax error|pg_|auth\.|password|secret|key|bearer|token|stack trace|at line/i.test(rawMessage);
      const safeError = isSensitive ? 'Internal server error during evidence analysis.' : rawMessage;
      return new Response(
        JSON.stringify({
          state: 'failed',
          error: safeError || 'Internal server error during evidence analysis.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })();

  if (complaintIdKey) {
    inFlightAnalyses.set(complaintIdKey, analysisPromise);
    analysisPromise.finally(() => {
      inFlightAnalyses.delete(complaintIdKey!);
    });
  }

  return await analysisPromise;
});
