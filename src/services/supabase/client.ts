import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

/**
 * Chandigarh CivicAI — Centralized Supabase Client Foundation
 *
 * Connects to Supabase via standard Vite environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 *
 * CRITICAL SECURITY ARCHITECTURE:
 * - Uses ONLY the public anonymous key (safe for browser with Row Level Security).
 * - NEVER imports or uses a service_role key on the client side.
 * - Fails gracefully with helpful diagnostic messages when variables are unconfigured.
 */

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

/**
 * Checks whether Supabase environment variables are properly set and non-empty.
 */
export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes('your-project-id') || supabaseAnonKey.includes('your-anon-publishable-key')) {
    return false;
  }
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Diagnostic status object to inform developers without crashing React components.
 */
export const SUPABASE_CONFIG_STATUS = {
  isConfigured: isSupabaseConfigured(),
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  missingVariables: [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean) as string[],
} as const;

// Development notice logged once on module load
if (!SUPABASE_CONFIG_STATUS.isConfigured) {
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (isDev) {
    console.info(
      `[Chandigarh CivicAI] Supabase client is in UNCONFIGURED mode. Missing environment variables: ${
        SUPABASE_CONFIG_STATUS.missingVariables.join(', ') || 'Placeholder values detected'
      }. Follow docs/manual-setup.md to connect your Supabase project.`
    );
  }
}

/**
 * Creates and exports the singleton Supabase client instance.
 * If credentials are not present, creates a mock/fallback client with meaningful error handling on execution.
 */
export const supabase: SupabaseClient<Database> = isSupabaseConfigured()
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (createClient<Database>(
      'https://placeholder-project.supabase.co',
      'placeholder-anon-key-chd-civicai',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    ) as SupabaseClient<Database>);
