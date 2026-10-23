import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import { ROUTES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { parseAuthCallbackParams, formatAuthError } from '../utils/authUtils';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, Home, LogIn } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetDashboard, setTargetDashboard] = useState<string>(ROUTES.CITIZEN_DASHBOARD);
  
  // Guard against React 19 strict-mode duplicate execution
  const executionRef = useRef<boolean>(false);

  useEffect(() => {
    if (executionRef.current) return;
    executionRef.current = true;

    let isMounted = true;

    const processVerification = async () => {
      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Authentication service is not configured.');
        }
        return;
      }

      const parsed = parseAuthCallbackParams(location.search, location.hash);

      // 1. Check for incoming URL errors (e.g. otp_expired, access_denied)
      if (parsed.error || parsed.errorCode || parsed.errorDescription) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            formatAuthError({
              code: parsed.errorCode || parsed.error,
              message: parsed.errorDescription || parsed.error || 'Authentication verification failed.',
            })
          );
        }
        return;
      }

      // 2. Check if a valid session is ALREADY active (e.g. user refreshed or already verified)
      try {
        const { data: currentSessionData } = await supabase.auth.getSession();
        if (currentSessionData.session?.user) {
          await routeAuthenticatedUser(currentSessionData.session.user.id);
          return;
        }
      } catch {
        // Fall through to parse tokens/codes
      }

      // 3. Handle PKCE code exchange (?code=...)
      if (parsed.code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (error) {
            // Check if user has an existing session despite code exchange failure (e.g. on page refresh)
            const { data: fallbackSession } = await supabase.auth.getSession();
            if (fallbackSession.session?.user) {
              await routeAuthenticatedUser(fallbackSession.session.user.id);
              return;
            }
            if (isMounted) {
              setStatus('error');
              setErrorMessage(formatAuthError(error));
            }
            return;
          }

          if (data.session?.user) {
            await routeAuthenticatedUser(data.session.user.id);
            return;
          }
        } catch (err) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(formatAuthError(err));
          }
          return;
        }
      }

      // 4. Handle token_hash verification (?token_hash=...&type=...)
      if (parsed.tokenHash && parsed.type) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: parsed.type,
          });

          if (error) {
            // Check if session exists (refresh resilience)
            const { data: fallbackSession } = await supabase.auth.getSession();
            if (fallbackSession.session?.user) {
              await routeAuthenticatedUser(fallbackSession.session.user.id);
              return;
            }
            if (isMounted) {
              setStatus('error');
              setErrorMessage(formatAuthError(error));
            }
            return;
          }

          if (data.session?.user || data.user) {
            await routeAuthenticatedUser(data.session?.user?.id || data.user!.id);
            return;
          }
        } catch (err) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(formatAuthError(err));
          }
          return;
        }
      }

      // 5. Handle hash fragment tokens (#access_token=...&refresh_token=...)
      if (parsed.hasHashTokens) {
        // Supabase client with detectSessionInUrl: true parses hash automatically.
        // Wait briefly for onAuthStateChange / getSession to capture it
        try {
          let resolvedUser: string | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data: checkSession } = await supabase.auth.getSession();
            if (checkSession.session?.user) {
              resolvedUser = checkSession.session.user.id;
              break;
            }
            await new Promise((r) => setTimeout(r, 300));
          }

          if (resolvedUser) {
            await routeAuthenticatedUser(resolvedUser);
            return;
          }
        } catch (err) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(formatAuthError(err));
          }
          return;
        }
      }

      // 6. No tokens or codes present: check if user is already logged in
      const { data: finalSession } = await supabase.auth.getSession();
      if (finalSession.session?.user) {
        await routeAuthenticatedUser(finalSession.session.user.id);
        return;
      }

      // If nothing worked and no session
      if (isMounted) {
        setStatus('error');
        setErrorMessage(
          'No valid authentication code, verification token, or active session was detected. The link may have expired or was already used.'
        );
      }
    };

    const routeAuthenticatedUser = async (userId: string) => {
      try {
        await refreshProfile();
        // Query profile directly to check role accurately
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        const role = profile?.role;
        const destination = role === 'admin' ? ROUTES.ADMIN_DASHBOARD : ROUTES.CITIZEN_DASHBOARD;

        if (isMounted) {
          setTargetDashboard(destination);
          setStatus('success');
        }

        // Clean up hash/search from URL and redirect smoothly
        setTimeout(() => {
          if (isMounted) {
            navigate(destination, { replace: true });
          }
        }, 1200);
      } catch {
        if (isMounted) {
          setStatus('success');
          navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true });
        }
      }
    };

    processVerification();

    return () => {
      isMounted = false;
    };
  }, [location.search, location.hash, navigate, refreshProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-slate-100 flex flex-col justify-center py-12">
      <PageContainer maxWidth="sm" className="py-0">
        <Card padding="lg" className="border-slate-200 shadow-xl rounded-2xl text-center">
          {status === 'verifying' && (
            <div className="py-8 space-y-4 animate-fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100">
                <Loader2 className="h-7 w-7 text-sky-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Verifying Civic Credentials
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Securely confirming your email verification token with the Chandigarh CivicAI authentication service...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8 space-y-4 animate-fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Authentication Confirmed
              </h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Your credentials have been verified. Redirecting you to your municipal dashboard...
              </p>
              <div className="pt-2">
                <Link to={targetDashboard}>
                  <Button variant="sky" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Continue to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 space-y-4 animate-fade-in text-left">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Verification Notice
                  </h2>
                  <p className="text-xs text-slate-500">
                    Authentication link expired, invalid, or already used
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                {errorMessage}
              </div>

              <div className="pt-2 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">What should you do?</p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                  <li>If the link expired, sign in to request a fresh verification link.</li>
                  <li>If you already confirmed earlier, sign in with your email or password.</li>
                  <li>If you registered recently, you can sign in directly on the login page.</li>
                </ul>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
                <Link to={ROUTES.LOGIN} className="flex-1">
                  <Button variant="sky" className="w-full" leftIcon={<LogIn className="h-4 w-4" />}>
                    Go to Sign In
                  </Button>
                </Link>
                <Link to={ROUTES.HOME} className="flex-1">
                  <Button variant="outline" className="w-full" leftIcon={<Home className="h-4 w-4" />}>
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default AuthCallbackPage;
