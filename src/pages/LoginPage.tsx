import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  Lock,
  Mail,
  ArrowLeft,
  UserCheck,
  Users,
  Info,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [roleTab, setRoleTab] = useState<'citizen' | 'admin'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [citizenAuthMode, setCitizenAuthMode] = useState<'otp' | 'password'>('otp');
  const [otpSent, setOtpSent] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { loginWithOtp, verifyOtp, loginWithPassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Destination route after login
  const fromLocation = (location.state as { from?: string } | null)?.from;

  const handleTabChange = (role: 'citizen' | 'admin') => {
    setRoleTab(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpSent(false);
    setOtpToken('');
  };

  /**
   * Citizen OTP Request flow
   */
  const handleRequestCitizenOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address to receive an access code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await loginWithOtp(email.trim());
    setIsLoading(false);

    if (error) {
      setErrorMessage(
        error.message || 'Unable to deliver verification code. Please verify email and try again.'
      );
      return;
    }

    setOtpSent(true);
    setSuccessMessage(
      `A 6-digit verification code and magic link have been dispatched to ${email.trim()}. Please check your inbox.`
    );
  };

  /**
   * Citizen OTP Verification flow
   */
  const handleVerifyCitizenOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken.trim()) {
      setErrorMessage('Please enter the 6-digit code received in your email.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await verifyOtp(email.trim(), otpToken.trim(), 'email');
    setIsLoading(false);

    if (error) {
      setErrorMessage(
        error.message || 'Invalid or expired verification code. Please request a new code.'
      );
      return;
    }

    // Success: navigate to destination or citizen dashboard
    navigate(fromLocation || ROUTES.CITIZEN_DASHBOARD, { replace: true });
  };

  /**
   * Citizen Password Sign-In flow (Alternative)
   */
  const handleCitizenPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your registered email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await loginWithPassword(email.trim(), password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Invalid email or password.');
      return;
    }

    navigate(fromLocation || ROUTES.CITIZEN_DASHBOARD, { replace: true });
  };

  /**
   * Administrator Password Sign-In flow
   */
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your official administration email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await loginWithPassword(email.trim(), password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(
        error.message || 'Official officer authentication failed. Check credentials.'
      );
      return;
    }

    // Refresh profile to verify administrative status from database
    await refreshProfile();

    // Destination
    navigate(fromLocation || ROUTES.ADMIN_DASHBOARD, { replace: true });
  };

  return (
    <PageContainer maxWidth="sm" className="py-12">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to={ROUTES.HOME}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Chandigarh Administration
        </span>
      </div>

      <Card padding="lg" className="border-slate-200 shadow-sm">
        <CardHeader
          title={roleTab === 'citizen' ? 'Citizen Grievance Portal' : 'Municipal Officer Portal'}
          subtitle={
            roleTab === 'citizen'
              ? 'Sign in via email verification to file and track civic grievances'
              : 'Restricted to authorized MCC and UT Engineering department officers'
          }
          action={
            <Badge variant={roleTab === 'citizen' ? 'primary' : 'warning'} size="sm">
              {roleTab === 'citizen' ? 'Resident Access' : 'Officer Access'}
            </Badge>
          }
        />

        {/* Role Switcher Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-1 mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => handleTabChange('citizen')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              roleTab === 'citizen'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Citizen Login
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              roleTab === 'admin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Administrator Login
          </button>
        </div>

        {/* Informational Alerts */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="block font-semibold">Authentication Error</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong className="block font-semibold">Verification Code Sent</strong>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* CITIZEN FLOW */}
        {roleTab === 'citizen' && (
          <div>
            {!otpSent ? (
              <div>
                {/* Method Toggle: OTP / Magic Link vs Password */}
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCitizenAuthMode(citizenAuthMode === 'otp' ? 'password' : 'otp');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-blue-700 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <KeyRound className="h-3 w-3" />
                    {citizenAuthMode === 'otp' ? 'Sign in with Password instead' : 'Sign in with Email OTP instead'}
                  </button>
                </div>

                {citizenAuthMode === 'otp' ? (
                  <form onSubmit={handleRequestCitizenOtp} className="space-y-4">
                    <Input
                      label="Resident Email Address"
                      type="email"
                      placeholder="citizen@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      helperText="A secure one-time verification code or magic link will be sent to your email"
                      leftIcon={<Mail className="h-4 w-4" />}
                    />

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <Info className="h-3.5 w-3.5 text-blue-600" />
                        Privacy Guarantee
                      </div>
                      <p className="text-[11px] text-slate-500">
                        No Aadhaar number or biometric identity is collected. Authentication uses secure Supabase email tokens.
                      </p>
                    </div>

                    <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                      Send Verification Code
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleCitizenPasswordSignIn} className="space-y-4">
                    <Input
                      label="Registered Email Address"
                      type="email"
                      placeholder="citizen@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      leftIcon={<Mail className="h-4 w-4" />}
                    />

                    <Input
                      label="Account Password"
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      leftIcon={<Lock className="h-4 w-4" />}
                    />

                    <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                      Sign In as Resident
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              /* OTP VERIFICATION STEP */
              <form onSubmit={handleVerifyCitizenOtp} className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900 mb-2">
                  <p>
                    Enter the <strong>6-digit code</strong> sent to <strong>{email}</strong>.
                    If you received a magic link in your email, clicking it will also sign you in automatically.
                  </p>
                </div>

                <Input
                  label="6-Digit Verification Code"
                  type="text"
                  placeholder="123456"
                  maxLength={8}
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  required
                  helperText="Enter the verification code from your email inbox"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                  autoFocus
                />

                <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                  Verify & Sign In
                </Button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpToken('');
                    }}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Change Email
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestCitizenOtp}
                    disabled={isLoading}
                    className="text-blue-700 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Resend Code
                  </button>
                </div>
              </form>
            )}

            <div className="pt-4 mt-6 border-t border-slate-100 text-center text-xs text-slate-600">
              Don't have a citizen account yet?{' '}
              <Link to={ROUTES.REGISTER} className="text-blue-700 font-semibold hover:underline">
                Register as Resident
              </Link>
            </div>
          </div>
        )}

        {/* ADMINISTRATOR FLOW */}
        {roleTab === 'admin' && (
          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                Administrative Privilege Policy
              </div>
              <p className="text-[11px] text-amber-800">
                Admin access is verified against the database profile role. Selecting this tab does not grant administrative privileges without database authorization.
              </p>
            </div>

            <Input
              label="Official Administration Email"
              type="email"
              placeholder="officer.dept@chandigarh.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              helperText="Official email of the designated MCC or UT administrative officer"
              leftIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Admin Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="h-4 w-4" />}
            />

            <Button type="submit" variant="primary" className="w-full bg-slate-900 hover:bg-slate-800" isLoading={isLoading}>
              Sign In to Officer Portal
            </Button>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1 mt-4">
              <span className="font-semibold block text-slate-800">Initial Setup Instructions:</span>
              <p className="text-[11px] text-slate-500">
                To provision the first demo administrator, follow the bootstrap instructions in <code>docs/manual-setup.md</code>.
              </p>
            </div>
          </form>
        )}
      </Card>
    </PageContainer>
  );
};
export default LoginPage;
