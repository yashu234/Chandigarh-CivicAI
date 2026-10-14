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

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
    const body: RequestPayload = await req.json().catch(() => ({}));
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
        .maybeSingle();

      if (existingAssessment) {
        const sev = Number(existingAssessment.severity ?? 0);
        const safe = Number(existingAssessment.safety_risk ?? 0);
        const pub = Number(existingAssessment.public_impact ?? 0);
        const ev = Number(existingAssessment.evidence_support ?? 0);
        const rec = 0;
        const pScore = Math.round((0.35 * sev + 0.30 * safe + 0.20 * pub + 0.10 * rec + 0.05 * ev) * 100) / 100;
        let pTier = 'low';
        if (pScore >= 80.0) pTier = 'critical';
        else if (pScore >= 60.0) pTier = 'high';
        else if (pScore >= 35.0) pTier = 'medium';

        if (complaint.priority_score === null || complaint.priority_score === undefined) {
          await adminClient
            .from('complaints')
            .update({ priority_score: pScore, priority_tier: pTier })
            .eq('id', body.complaintId);
        }

        return new Response(
          JSON.stringify({
            state: 'completed',
            data: existingAssessment,
            cached: true,
            priority: {
              score: pScore,
              tier: pTier,
              breakdown: {
                severity: { score: sev, weight: 0.35, contribution: Math.round(sev * 0.35 * 100) / 100 },
                safetyRisk: { score: safe, weight: 0.30, contribution: Math.round(safe * 0.30 * 100) / 100 },
                publicImpact: { score: pub, weight: 0.20, contribution: Math.round(pub * 0.20 * 100) / 100 },
                recurrence: { score: rec, weight: 0.10, contribution: 0 },
                evidenceSupport: { score: ev, weight: 0.05, contribution: Math.round(ev * 0.05 * 100) / 100 },
              },
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
      .maybeSingle();

    if (evError || !evidence) {
      return new Response(
        JSON.stringify({
          error: 'Complaint does not have photographic evidence uploaded for analysis.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Retrieve private image from Supabase Storage
    const bucket = Deno.env.get('SUPABASE_EVIDENCE_BUCKET') || Deno.env.get('VITE_SUPABASE_EVIDENCE_BUCKET') || 'complaint-evidence';
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

    // Convert file bytes to base64
    const buffer = await fileBlob.arrayBuffer();
    const base64Bytes = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 9. Call Gemini Multimodal Inference API
    const modelVersion = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${geminiApiKey}`;

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

    const requestPayload = {
      system_instruction: {
        parts: [{ text: CIVIC_AI_SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: evidence.mime_type,
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
      },
    };

    const aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[EdgeFunction] Gemini API HTTP error:', aiResponse.status, errText);
      return new Response(
        JSON.stringify({
          state: 'failed',
          error: `AI provider error (HTTP ${aiResponse.status}). Model inference could not be completed.`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiJson = await aiResponse.json();
    const candidateText =
      aiJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return new Response(
        JSON.stringify({
          state: 'failed',
          error: 'AI provider returned an empty or unparseable response.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(candidateText);
    } catch {
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

    // 12. Authoritative Deterministic Priority Calculation (Phase 8)
    // Formula: 0.35 * Severity + 0.30 * Safety Risk + 0.20 * Public Impact + 0.10 * Recurrence + 0.05 * Evidence Support
    const recurrence = 0; // Backend-controlled default (0 for new complaints until Phase 10)
    const rawPriorityScore =
      0.35 * validated.severity +
      0.30 * validated.safetyRisk +
      0.20 * validated.publicImpact +
      0.10 * recurrence +
      0.05 * validated.evidenceSupport;

    const priorityScore = Math.round(rawPriorityScore * 100) / 100;

    let priorityTier = 'low';
    if (priorityScore >= 80.0) {
      priorityTier = 'critical';
    } else if (priorityScore >= 60.0) {
      priorityTier = 'high';
    } else if (priorityScore >= 35.0) {
      priorityTier = 'medium';
    }

    // Persist priority_score and priority_tier atomically into public.complaints
    const { error: complaintUpdateErr } = await adminClient
      .from('complaints')
      .update({
        priority_score: priorityScore,
        priority_tier: priorityTier,
      })
      .eq('id', body.complaintId);

    if (complaintUpdateErr) {
      console.warn('[EdgeFunction] Warning updating complaint priority:', complaintUpdateErr);
    }

    // 13. Return completed assessment with deterministic priority
    return new Response(
      JSON.stringify({
        state: 'completed',
        data: savedAssessment,
        priority: {
          score: priorityScore,
          tier: priorityTier,
          breakdown: {
            severity: { score: validated.severity, weight: 0.35, contribution: Math.round(validated.severity * 0.35 * 100) / 100 },
            safetyRisk: { score: validated.safetyRisk, weight: 0.30, contribution: Math.round(validated.safetyRisk * 0.30 * 100) / 100 },
            publicImpact: { score: validated.publicImpact, weight: 0.20, contribution: Math.round(validated.publicImpact * 0.20 * 100) / 100 },
            recurrence: { score: recurrence, weight: 0.10, contribution: 0 },
            evidenceSupport: { score: validated.evidenceSupport, weight: 0.05, contribution: Math.round(validated.evidenceSupport * 0.05 * 100) / 100 },
          },
          humanReviewRequired: validated.humanReviewRequired,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error('[EdgeFunction] Unexpected error:', rawMessage);
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
});
