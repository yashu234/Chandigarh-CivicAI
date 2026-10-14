import { supabase, isSupabaseConfigured } from './client';
import type { ComplaintEvidenceRow, ComplaintEvidenceInsert } from '../../types/database';

const EVIDENCE_BUCKET = (import.meta.env.VITE_SUPABASE_EVIDENCE_BUCKET as string) || 'complaint-evidence';

/**
 * Evidence Storage Service
 *
 * Manages uploads and signed URL generation for photographic evidence.
 * Enforces the private storage path structure: complaints/{complaint_id}/{uuid}-{filename}
 */
export const evidenceService = {
  getBucketName(): string {
    return EVIDENCE_BUCKET;
  },

  /**
   * Uploads an evidence file to the private bucket and records metadata in complaint_evidence
   */
  async upload(
    complaintId: string,
    file: File
  ): Promise<{ data: ComplaintEvidenceRow | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Storage uploads are disabled.'),
      };
    }

    try {
      // Generate clean predictable unique path: complaints/{complaint_id}/{uuid}-{sanitizedFilename}
      const safeComplaintId = complaintId.replace(/[^a-zA-Z0-9-]/g, '');
      const fileId = crypto.randomUUID();
      const sanitizedName = file.name.replace(/\.\./g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      const storagePath = `complaints/${safeComplaintId}/${fileId}-${sanitizedName}`;

      // 1. Upload to private Supabase Storage bucket
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return { data: null, error: new Error(`Storage upload failed: ${uploadError.message}`) };
      }

      // 2. Insert metadata record in complaint_evidence table
      const insertRecord: ComplaintEvidenceInsert = {
        complaint_id: complaintId,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
      };

      const { data: record, error: dbError } = await supabase
        .from('complaint_evidence')
        .insert(insertRecord)
        .select()
        .single();

      if (dbError) {
        return { data: null, error: new Error(`Database evidence log failed: ${dbError.message}`) };
      }

      return { data: record, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Unknown error uploading evidence') };
    }
  },

  /**
   * Generates a temporary signed URL to view private evidence securely
   */
  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<{ url: string | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { url: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error) return { url: null, error: new Error(error.message) };
      return { url: data.signedUrl, error: null };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err : new Error('Error creating signed URL') };
    }
  },

  /**
   * Fetches all evidence records for a complaint
   */
  async getByComplaintId(complaintId: string): Promise<{ data: ComplaintEvidenceRow[] | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('complaint_evidence')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Error fetching complaint evidence') };
    }
  },
};
