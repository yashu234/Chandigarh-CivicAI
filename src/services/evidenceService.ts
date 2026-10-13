import { supabase, isSupabaseConfigured } from './supabase/client.ts';
import type { ComplaintEvidenceRow } from '../types/database.ts';

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

export const EVIDENCE_BUCKET_NAME =
  getEnvVar('VITE_SUPABASE_EVIDENCE_BUCKET') ?? 'complaint-evidence';

export const ACCEPTED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface EvidenceResolutionResult {
  evidence: ComplaintEvidenceRow | null;
  signedUrl: string | null;
  expiresInSeconds: number;
  hasAccess: boolean;
  error?: string;
}

export interface EvidenceValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an image file before upload according to municipal evidence guidelines.
 */
export function validateEvidenceFile(file: File): EvidenceValidationResult {
  if (!file) {
    return { isValid: false, error: 'No image file provided.' };
  }

  const normalizedType = file.type.toLowerCase();
  const isAcceptedType = ACCEPTED_EVIDENCE_MIME_TYPES.some(
    (t) => t === normalizedType
  );

  if (!isAcceptedType) {
    return {
      isValid: false,
      error: 'Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.',
    };
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB uploaded).`,
    };
  }

  return { isValid: true };
}

/**
 * Generates a storage path adhering strictly to municipal evidence RLS policy:
 * complaints/{complaint_uuid}/{uuid}-{safe_filename}
 */
export function generateEvidenceStoragePath(complaintId: string, filename: string): string {
  const fileId = crypto.randomUUID();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return `complaints/${complaintId}/${fileId}-${safeFilename}`;
}

/**
 * Creates a short-lived signed URL for a private storage object.
 * Private bucket files are NEVER exposed publicly.
 */
export async function createSignedEvidenceUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<{ signedUrl: string | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { signedUrl: null, error: new Error('Supabase is not configured.') };
  }

  try {
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      return { signedUrl: null, error };
    }

    return { signedUrl: data?.signedUrl ?? null, error: null };
  } catch (err) {
    return {
      signedUrl: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Resolves photographic evidence metadata and a signed access URL for a complaint.
 * Access is guarded strictly by Row Level Security on public.complaint_evidence,
 * public.complaints, and storage.objects.
 */
export async function getEvidenceForComplaint(
  complaintId: string,
  expiresInSeconds: number = 3600
): Promise<EvidenceResolutionResult> {
  if (!isSupabaseConfigured()) {
    return {
      evidence: null,
      signedUrl: null,
      expiresInSeconds,
      hasAccess: false,
      error: 'Supabase is not configured.',
    };
  }

  try {
    // 1. Resolve authenticated user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        evidence: null,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: false,
        error: 'Authentication required to access complaint evidence.',
      };
    }

    // 2. Load complaint through RLS to verify ownership or admin privilege
    const { data: complaintRow, error: complaintError } = await supabase
      .from('complaints')
      .select('id, citizen_id')
      .eq('id', complaintId)
      .maybeSingle();

    if (complaintError) {
      return {
        evidence: null,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: false,
        error: `Complaint access verification failed: ${complaintError.message}`,
      };
    }

    if (!complaintRow) {
      return {
        evidence: null,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: false,
        error: 'Complaint not found or access denied by municipal security policies.',
      };
    }

    // 3. Fetch evidence metadata row from public.complaint_evidence
    const { data: evidenceRow, error: metadataError } = await supabase
      .from('complaint_evidence')
      .select('*')
      .eq('complaint_id', complaintId)
      .maybeSingle();

    if (metadataError) {
      return {
        evidence: null,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: false,
        error: metadataError.message,
      };
    }

    if (!evidenceRow) {
      return {
        evidence: null,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: true, // Complaint has no evidence attached
      };
    }

    // 4. Generate short-lived signed URL for private bucket file
    const { signedUrl, error: urlError } = await createSignedEvidenceUrl(
      evidenceRow.storage_path,
      expiresInSeconds
    );

    if (urlError || !signedUrl) {
      return {
        evidence: evidenceRow,
        signedUrl: null,
        expiresInSeconds,
        hasAccess: false,
        error: urlError?.message || 'Failed to generate signed URL for private evidence.',
      };
    }

    return {
      evidence: evidenceRow,
      signedUrl,
      expiresInSeconds,
      hasAccess: true,
    };
  } catch (err) {
    return {
      evidence: null,
      signedUrl: null,
      expiresInSeconds,
      hasAccess: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
