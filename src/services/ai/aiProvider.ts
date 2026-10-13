/**
 * Chandigarh CivicAI — AI Analysis Provider Interface & Server Edge Abstraction
 *
 * CRITICAL SECURITY & ARCHITECTURAL BOUNDARY:
 * - Multimodal model inference (Gemini 1.5 Flash) runs STRICTLY on the backend server
 *   via Supabase Edge Functions.
 * - NEVER store AI API keys in client-side Vite/React environment variables (VITE_*).
 * - NEVER pretend a mock or synthetic result is a real AI assessment.
 * - If the backend Edge Function or server secret (GEMINI_API_KEY) is unconfigured,
 *   the provider truthfully returns the `not_configured` analysis state.
 */

import { supabase, isSupabaseConfigured } from '../supabase/client.ts';
import type {
  AIAnalysisInput,
  StructuredAIAssessment,
} from './aiAssessmentTypes.ts';
import {
  evaluateHumanReviewFlags,
  mapDbAssessmentToDomain,
} from './aiAssessmentTypes.ts';

export interface AIAnalysisProvider {
  readonly providerName: string;
  readonly modelVersion: string;
  readonly isConfigured: boolean;
  analyzeComplaintEvidence(input: AIAnalysisInput): Promise<StructuredAIAssessment>;
}

/**
 * Fallback unconfigured provider used when testing or operating in offline development.
 */
export class ServerBackendAIProvider implements AIAnalysisProvider {
  public readonly providerName = 'Chandigarh CivicAI Server Pipeline (Unconfigured)';
  public readonly modelVersion = 'civicai-multimodal-foundation-v1';
  public readonly isConfigured = false;

  public async analyzeComplaintEvidence(
    input: AIAnalysisInput
  ): Promise<StructuredAIAssessment> {
    const baseAssessment: StructuredAIAssessment = {
      complaintId: input.complaintId,
      detectedIssue: null,
      suggestedCategory: null,
      severity: null,
      safetyRisk: null,
      evidenceSupport: null,
      imageQuality: null,
      descriptionMatch: null,
      publicImpact: null,
      reasoningSummary:
        'AI multimodal inference pipeline is not yet configured on the server. The grievance has been registered with status "submitted" and queued for human officer inspection.',
      humanReviewRequired: true,
      humanReviewReasons: [
        'AI inference pipeline is not configured in this environment. Requires municipal engineer triage.',
      ],
      analysisState: 'not_configured',
      modelVersion: this.modelVersion,
      createdAt: new Date().toISOString(),
    };

    const reviewEvaluation = evaluateHumanReviewFlags(baseAssessment);
    baseAssessment.humanReviewRequired = reviewEvaluation.required;
    baseAssessment.humanReviewReasons = reviewEvaluation.reasons;

    return baseAssessment;
  }
}

/**
 * Real server-side multimodal AI provider invoking the Supabase Edge Function:
 * `analyze-complaint-evidence`.
 * All Gemini multimodal API keys remain strictly on the server as function secrets.
 */
export class SupabaseEdgeAIProvider implements AIAnalysisProvider {
  public readonly providerName = 'Google Gemini Multimodal (Supabase Edge Function)';
  public readonly modelVersion = 'gemini-1.5-flash';
  public readonly isConfigured = true;

  public async analyzeComplaintEvidence(
    input: AIAnalysisInput
  ): Promise<StructuredAIAssessment> {
    if (!isSupabaseConfigured()) {
      return this.createUnconfiguredResponse(
        input.complaintId,
        'Supabase client is not configured. Missing environment variables.'
      );
    }

    try {
      // 1. Verify authenticated citizen / admin session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        return this.createFailedResponse(
          input.complaintId,
          'Authentication required to analyze complaint evidence. Please sign in.'
        );
      }

      // 2. Invoke the server-side Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        'analyze-complaint-evidence',
        {
          body: {
            complaintId: input.complaintId,
            reanalyze: Boolean(input.reanalyze),
          },
        }
      );

      if (error) {
        // Detect if function has not been deployed to the remote project yet
        const errMsg = error.message || String(error);
        const isNotDeployed =
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('FunctionsFetchError') ||
          errMsg.includes('Failed to send a request');

        if (isNotDeployed) {
          return this.createUnconfiguredResponse(
            input.complaintId,
            "Edge Function 'analyze-complaint-evidence' is not deployed to the Supabase project."
          );
        }

        return this.createFailedResponse(
          input.complaintId,
          errMsg || 'Server-side Edge function invocation failed.'
        );
      }

      // 3. Handle server-side analysis states
      if (data?.state === 'not_configured') {
        return this.createUnconfiguredResponse(
          input.complaintId,
          data.message || 'GEMINI_API_KEY is not configured on the backend server.'
        );
      }

      if (data?.state === 'failed' || data?.error) {
        return this.createFailedResponse(
          input.complaintId,
          data.error || 'Server-side AI analysis encountered an error.'
        );
      }

      if (data?.state === 'completed' && data?.data) {
        // Map database record returned by Edge Function into domain model
        return mapDbAssessmentToDomain(data.data);
      }

      return this.createFailedResponse(
        input.complaintId,
        'Unexpected response received from analysis server.'
      );
    } catch (err) {
      return this.createFailedResponse(
        input.complaintId,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  private createUnconfiguredResponse(
    complaintId: string,
    message: string
  ): StructuredAIAssessment {
    return {
      complaintId,
      detectedIssue: null,
      suggestedCategory: null,
      severity: null,
      safetyRisk: null,
      evidenceSupport: null,
      imageQuality: null,
      descriptionMatch: null,
      publicImpact: null,
      reasoningSummary: message,
      humanReviewRequired: true,
      humanReviewReasons: ['AI inference pipeline is not configured on the server.'],
      analysisState: 'not_configured',
      modelVersion: this.modelVersion,
      createdAt: new Date().toISOString(),
    };
  }

  private createFailedResponse(
    complaintId: string,
    errorMessage: string
  ): StructuredAIAssessment {
    return {
      complaintId,
      detectedIssue: null,
      suggestedCategory: null,
      severity: null,
      safetyRisk: null,
      evidenceSupport: null,
      imageQuality: null,
      descriptionMatch: null,
      publicImpact: null,
      reasoningSummary: `Analysis failed: ${errorMessage}`,
      humanReviewRequired: true,
      humanReviewReasons: [`AI analysis failure: ${errorMessage}`],
      analysisState: 'failed',
      modelVersion: this.modelVersion,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Singleton provider instance exported for application use.
 * Connects to the Supabase Edge Function server architecture.
 */
export const defaultAIProvider: AIAnalysisProvider = new SupabaseEdgeAIProvider();
