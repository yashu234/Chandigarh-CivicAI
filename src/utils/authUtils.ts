import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Returns the canonical redirect URL for Supabase Auth flows (magic links, confirmations).
 * Prioritizes window.location.origin in the browser, falling back to VITE_APP_URL.
 */
export const getAuthRedirectUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  const envUrl = (
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_APP_URL as string | undefined)
      : undefined
  )?.trim();

  if (envUrl) {
    return `${envUrl.replace(/\/+$/, '')}/auth/callback`;
  }

  return 'https://chandigarh-civic-ai.vercel.app/auth/callback';
};

/**
 * Parses query and hash fragments from the URL to extract authentication parameters,
 * codes, token hashes, or error information dispatched by Supabase Auth.
 */
export interface ParsedAuthCallback {
  code?: string;
  tokenHash?: string;
  type?: EmailOtpType;
  hasHashTokens: boolean;
  error?: string;
  errorCode?: string;
  errorDescription?: string;
}

export const parseAuthCallbackParams = (
  search: string,
  hash: string
): ParsedAuthCallback => {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  
  // Hash can be "#access_token=...&refresh_token=..." or "#error=..."
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);

  const error = searchParams.get('error') || hashParams.get('error') || undefined;
  const errorCode = searchParams.get('error_code') || hashParams.get('error_code') || undefined;
  const errorDescription =
    searchParams.get('error_description') || hashParams.get('error_description') || undefined;

  const code = searchParams.get('code') || undefined;
  const tokenHash = searchParams.get('token_hash') || undefined;
  const rawType = searchParams.get('type') || hashParams.get('type') || undefined;
  const type = (rawType as EmailOtpType) || undefined;

  const hasHashTokens = Boolean(hashParams.get('access_token') || hashParams.get('refresh_token'));

  return {
    code,
    tokenHash,
    type,
    hasHashTokens,
    error,
    errorCode,
    errorDescription,
  };
};

/**
 * Formats low-level Supabase Auth errors into user-friendly, civic-appropriate guidance.
 * Specifically handles rate-limiting, user enumeration cases, token expiration, and auth failure.
 */
export const formatAuthError = (error: unknown): string => {
  if (!error) return 'An unexpected authentication error occurred.';

  const errObj = error as { code?: string; message?: string; status?: number };
  const message = errObj.message || String(error);
  const code = errObj.code || '';
  const status = errObj.status;

  if (
    code === 'over_email_send_rate_limit' ||
    status === 429 ||
    message.toLowerCase().includes('rate limit')
  ) {
    return 'Supabase email delivery rate limit exceeded. The free-tier built-in email service allows only a few emails per hour. Please wait a few minutes before trying again, or use password sign-in if your account is already set up.';
  }

  if (code === 'otp_expired' || message.toLowerCase().includes('expired')) {
    return 'The verification link or access code has expired. Please request a new verification link or code to sign in.';
  }

  if (
    code === 'user_already_exists' ||
    message.toLowerCase().includes('user already registered') ||
    message.toLowerCase().includes('already exists')
  ) {
    return 'An account with this email address already exists. Please sign in or use password authentication.';
  }

  if (
    code === 'invalid_credentials' ||
    message.toLowerCase().includes('invalid login credentials')
  ) {
    return 'Invalid email address or password. Please verify your credentials and try again.';
  }

  if (message.toLowerCase().includes('signup disabled')) {
    return 'Resident registration is temporarily disabled on this portal.';
  }

  return message;
};
