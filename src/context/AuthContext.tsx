import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import type { Database, ProfileRow, UserRole } from '../types/database';
import { getAuthRedirectUrl } from '../utils/authUtils';

export interface CitizenRegistrationData {
  fullName: string;
  email: string;
  mobileNumber: string;
  sector: string;
  password?: string;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCitizen: boolean;
  loginWithOtp: (email: string) => Promise<{ error: AuthError | Error | null }>;
  verifyOtp: (
    email: string,
    token: string,
    type?: 'email' | 'signup'
  ) => Promise<{ error: AuthError | Error | null }>;
  loginWithPassword: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  registerCitizen: (
    data: CitizenRegistrationData
  ) => Promise<{ error: AuthError | Error | null; needsEmailVerification: boolean; alreadyRegistered?: boolean }>;
  resendVerification: (
    email: string,
    type?: 'signup' | 'email_change'
  ) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured());

  /**
   * Fetches the user profile from public.profiles.
   * If a profile does not exist yet (e.g. after magic-link verification),
   * creates a default citizen profile using user metadata.
   */
  const fetchOrCreateProfile = useCallback(
    async (currentUser: User): Promise<ProfileRow | null> => {
      if (!isSupabaseConfigured()) {
        return null;
      }

      try {
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.warn('[AuthContext] Error fetching profile:', fetchError.message);
        }

        if (existingProfile) {
          return existingProfile;
        }

        // Profile does not exist yet: create citizen profile using user metadata
        const metadata = currentUser.user_metadata || {};
        const newProfile: Database['public']['Tables']['profiles']['Insert'] = {
          id: currentUser.id,
          full_name: (metadata.full_name as string) || currentUser.email?.split('@')[0] || 'Resident',
          mobile_number: (metadata.mobile_number as string) || null,
          sector: (metadata.sector as string) || 'Sector 17',
          role: 'citizen', // Enforced to 'citizen' by DB trigger regardless of input
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select('*')
          .single();

        if (insertError) {
          console.warn('[AuthContext] Could not auto-provision profile:', insertError.message);
          return null;
        }

        return insertedProfile;
      } catch (err) {
        console.error('[AuthContext] Unexpected profile resolution error:', err);
        return null;
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const prof = await fetchOrCreateProfile(user);
    setProfile(prof);
  }, [user, fetchOrCreateProfile]);

  // Initialize and observe Supabase Auth session
  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured()) {
      return;
    }

    const initAuth = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[AuthContext] Error restoring session:', error.message);
        }

        if (isMounted) {
          const currentSession = sessionData.session;
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            const prof = await fetchOrCreateProfile(currentSession.user);
            if (isMounted) {
              setProfile(prof);
            }
          } else {
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen to real-time auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const prof = await fetchOrCreateProfile(currentUser);
        if (isMounted) {
          setProfile(prof);
        }
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchOrCreateProfile]);

  /**
   * Citizen OTP / Magic link request
   */
  const loginWithOtp = useCallback(
    async (email: string): Promise<{ error: AuthError | Error | null }> => {
      if (!isSupabaseConfigured()) {
        return { error: new Error('Supabase is not configured.') };
      }
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        return { error };
      } catch (err) {
        return { error: err as Error };
      }
    },
    []
  );

  /**
   * Verify 6-digit OTP code sent to email
   */
  const verifyOtp = useCallback(
    async (
      email: string,
      token: string,
      type: 'email' | 'signup' = 'email'
    ): Promise<{ error: AuthError | Error | null }> => {
      if (!isSupabaseConfigured()) {
        return { error: new Error('Supabase is not configured.') };
      }
      try {
        // First try the requested OTP type
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type,
        });

        // If 'email' failed and it might have been a new signup, fallback to 'signup'
        if (error && type === 'email') {
          const fallbackResult = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup',
          });
          if (!fallbackResult.error && fallbackResult.data.user) {
            const prof = await fetchOrCreateProfile(fallbackResult.data.user);
            setProfile(prof);
            return { error: null };
          }
        }

        if (error) {
          return { error };
        }

        if (data.user) {
          const prof = await fetchOrCreateProfile(data.user);
          setProfile(prof);
        }

        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [fetchOrCreateProfile]
  );

  /**
   * Email and password sign-in (Used by administrators or credentialed users)
   */
  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | Error | null }> => {
      if (!isSupabaseConfigured()) {
        return { error: new Error('Supabase is not configured.') };
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { error };
        }

        if (data.user) {
          const prof = await fetchOrCreateProfile(data.user);
          setProfile(prof);
        }

        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [fetchOrCreateProfile]
  );

  /**
   * Citizen registration
   */
  const registerCitizen = useCallback(
    async (
      data: CitizenRegistrationData
    ): Promise<{ error: AuthError | Error | null; needsEmailVerification: boolean; alreadyRegistered?: boolean }> => {
      if (!isSupabaseConfigured()) {
        return { error: new Error('Supabase is not configured.'), needsEmailVerification: false };
      }

      const { fullName, email, mobileNumber, sector, password } = data;

      try {
        // If password is provided, use signUp with user metadata
        if (password) {
          const { data: signUpData, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                mobile_number: mobileNumber,
                sector: sector,
              },
              emailRedirectTo: getAuthRedirectUrl(),
            },
          });

          if (error) {
            return { error, needsEmailVerification: false };
          }

          // Supabase User Enumeration Defense: if user already exists, GoTrue returns a user with empty identities []
          if (
            signUpData.user &&
            Array.isArray(signUpData.user.identities) &&
            signUpData.user.identities.length === 0
          ) {
            return {
              error: new Error('An account with this email address already exists. Please sign in instead.'),
              needsEmailVerification: false,
              alreadyRegistered: true,
            };
          }

          // If session returned immediately (email confirmation disabled in Supabase)
          if (signUpData.session && signUpData.user) {
            // Explicitly create profile
            const { error: profileError } = await supabase.from('profiles').upsert({
              id: signUpData.user.id,
              full_name: fullName,
              mobile_number: mobileNumber || null,
              sector: sector,
              role: 'citizen',
            });

            if (profileError) {
              console.warn('[AuthContext] Profile upsert notice:', profileError.message);
            }

            const prof = await fetchOrCreateProfile(signUpData.user);
            setProfile(prof);
            return { error: null, needsEmailVerification: false };
          }

          // Email confirmation is required by Supabase
          return { error: null, needsEmailVerification: true };
        }

        // Otherwise use passwordless OTP registration
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: {
              full_name: fullName,
              mobile_number: mobileNumber,
              sector: sector,
            },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });

        if (otpError) {
          return { error: otpError, needsEmailVerification: false };
        }

        return { error: null, needsEmailVerification: true };
      } catch (err) {
        return { error: err as Error, needsEmailVerification: false };
      }
    },
    [fetchOrCreateProfile]
  );

  /**
   * Resend verification email for signup confirmation
   */
  const resendVerification = useCallback(
    async (
      email: string,
      type: 'signup' | 'email_change' = 'signup'
    ): Promise<{ error: AuthError | Error | null }> => {
      if (!isSupabaseConfigured()) {
        return { error: new Error('Supabase is not configured.') };
      }
      try {
        const { error } = await supabase.auth.resend({
          type,
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        return { error };
      } catch (err) {
        return { error: err as Error };
      }
    },
    []
  );

  /**
   * Sign out cleanly
   */
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  }, []);

  // Compute authorization flags strictly from database profile role
  const role: UserRole | null = profile?.role ?? (user ? 'citizen' : null);
  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user && profile?.role === 'admin');
  const isCitizen = Boolean(user && (!profile || profile.role === 'citizen'));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role,
      isLoading,
      isAuthenticated,
      isAdmin,
      isCitizen,
      loginWithOtp,
      verifyOtp,
      loginWithPassword,
      registerCitizen,
      resendVerification,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      role,
      isLoading,
      isAuthenticated,
      isAdmin,
      isCitizen,
      loginWithOtp,
      verifyOtp,
      loginWithPassword,
      registerCitizen,
      resendVerification,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext };
export default AuthProvider;
