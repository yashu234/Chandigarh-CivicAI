import { supabase, isSupabaseConfigured } from './client';
import type { ProfileRow, ProfileUpdate, ProfileInsert } from '../../types/database';

/**
 * Profile Service Repository Layer
 *
 * Manages citizen and administrator profiles stored in the public.profiles table.
 * NO Aadhaar numbers are collected, stored, or processed.
 */
export const profileService = {
  /**
   * Fetches profile by user UUID
   */
  async getById(userId: string): Promise<{ data: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Error fetching profile') };
    }
  },

  /**
   * Upserts a profile on registration or login
   */
  async upsert(profile: ProfileInsert): Promise<{ data: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profile)
        .select()
        .single();

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Error upserting profile') };
    }
  },

  /**
   * Updates existing profile fields (e.g. residential sector, mobile number)
   */
  async update(userId: string, updates: ProfileUpdate): Promise<{ data: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) return { data: null, error: new Error(error.message) };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error('Error updating profile') };
    }
  },
};
