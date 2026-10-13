/**
 * Supabase Service Layer Barrel Export
 * 
 * Provides centralized access to Supabase client and domain repositories.
 */

export { supabase, isSupabaseConfigured, SUPABASE_CONFIG_STATUS } from './client';
export { complaintsService } from './complaintsService';
export { evidenceService } from './evidenceService';
export { profileService } from './profileService';
