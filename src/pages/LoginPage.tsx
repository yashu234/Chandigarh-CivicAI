import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
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
  Cpu,
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
  const fromLocation = (location.state as { from?: string } | null)?.from;

  const handleTabChange = (role: 'citizen' | 'admin') => {
    setRoleTab(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpSent(false);
    setOtpToken('');
  };

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
      setErrorMessage(error.message || 'Unable to deliver verification code. Please verify email and try again.');
      return;
    }
    setOtpSent(true);
    setSuccessMessage(`A 6-digit verification code and magic link have been dispatched to ${email.trim()}. Please check your inbox.`);
  };

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
      setErrorMessage(error.message || 'Invalid or expired verification code. Please request a new code.');
      return;
    }
    navigate(fromLocation || ROUTES.CITIZEN_DASHBOARD, { replace: true });
  };

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
      setErrorMessage(error.message || 'Official officer authentication failed. Check credentials.');
      return;
    }
    await refreshProfile();
    navigate(fromLocation || ROUTES.ADMIN_DASHBOARD, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-slate-100 flex flex-col justify-center py-12">
      <PageContainer maxWidth="sm" className="py-0">
        {/* Back + Brand header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-700 transition-colors font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#0a1628] border border-sky-500/20 flex items-center justify-center">
              <Cpu className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Chandigarh CivicAI
            </span>
          </div>
        </div>

        <Card padding="lg" className="border-slate-200 shadow-lg rounded-2xl">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-5 mb-5">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {roleTab === 'citizen' ? 'Citizen Grievance Portal' : 'Municipal Officer Portal'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {roleTab === 'citizen'
                  ? 'Sign in via email verification to file and track civic grievances'
                  : 'Restricted to authorized MCC and UT Engineering department officers'}
              </p>
            </div>
            <Badge variant={roleTab === 'citizen' ? 'medium' : 'gold'} size="sm">
              {roleTab === 'citizen' ? 'Resident Access' : 'Officer Access'}
            </Badge>
          </div>

          {/* Role Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => handleTabChange('citizen')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                roleTab === 'citizen'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Citizen Login
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                roleTab === 'admin'
                  ? 'bg-[#0a1628] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Administrator Login
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <strong className="block font-bold">Authentication Error</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <strong className="block font-bold">Verification Code Sent</strong>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* CITIZEN FLOW */}
          {roleTab === 'citizen' && (
            <div className="animate-fade-in">
              {!otpSent ? (
                <div>
                  <div className="flex justify-end mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCitizenAuthMode(citizenAuthMode === 'otp' ? 'password' : 'otp');
                        setErrorMessage(null);
                      }}
                      className="text-xs text-sky-600 hover:text-sky-700 hover:underline font-semibold inline-flex items-center gap-1"
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
                        helperText="A secure one-time verification code or magic link will be sent"
                        leftIcon={<Mail className="h-4 w-4" />}
                      />
                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                        <span>No Aadhaar number or biometric identity collected. Secure Supabase email token authentication.</span>
                      </div>
                      <Button type="submit" variant="sky" className="w-full" isLoading={isLoading}>
                        Send Verification Code
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleCitizenPasswordSignIn} className="space-y-4">
                      <Input label="Registered Email" type="email" placeholder="citizen@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required leftIcon={<Mail className="h-4 w-4" />} />
                      <Input label="Account Password" type="password" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required leftIcon={<Lock className="h-4 w-4" />} />
                      <Button type="submit" variant="sky" className="w-full" isLoading={isLoading}>
                        Sign In as Resident
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleVerifyCitizenOtp} className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900">
                    <p>Enter the <strong>6-digit code</strong> sent to <strong>{email}</strong>. Clicking the magic link in your email will also sign you in automatically.</p>
                  </div>
                  <Input label="6-Digit Verification Code" type="text" placeholder="123456" maxLength={8} value={otpToken} onChange={(e) => setOtpToken(e.target.value)} required helperText="Check your email inbox or spam folder" leftIcon={<KeyRound className="h-4 w-4" />} autoFocus />
                  <Button type="submit" variant="sky" className="w-full" isLoading={isLoading}>
                    Verify &amp; Sign In
                  </Button>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button type="button" onClick={() => { setOtpSent(false); setOtpToken(''); }} className="text-slate-500 hover:text-slate-800 font-medium">
                      Change Email
                    </button>
                    <button type="button" onClick={handleRequestCitizenOtp} disabled={isLoading} className="text-sky-600 hover:underline inline-flex items-center gap-1 font-bold">
                      <RefreshCw className="h-3 w-3" />
                      Resend Code
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-4 mt-5 border-t border-slate-100 text-center text-xs text-slate-500">
                Don't have an account?{' '}
                <Link to={ROUTES.REGISTER} className="text-sky-700 font-bold hover:underline">
                  Register as Resident
                </Link>
              </div>
            </div>
          )}

          {/* ADMIN FLOW */}
          {roleTab === 'admin' && (
            <form onSubmit={handleAdminSignIn} className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Administrative Privilege Policy</span>
                  <span className="text-amber-800 text-[11px]">Admin access is verified against the database profile role. Selecting this tab does not grant administrative privileges without database authorization.</span>
                </div>
              </div>
              <Input label="Official Administration Email" type="email" placeholder="officer.dept@chandigarh.gov.in" value={email} onChange={(e) => setEmail(e.target.value)} required helperText="Official email of the designated MCC or UT administrative officer" leftIcon={<Mail className="h-4 w-4" />} />
              <Input label="Admin Password" type="password" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required leftIcon={<Lock className="h-4 w-4" />} />
              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Sign In to Officer Portal
              </Button>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <span className="font-bold block text-slate-700 mb-0.5">Initial Setup:</span>
                To provision the first demo administrator, follow the bootstrap instructions in <code className="font-mono text-sky-700">docs/manual-setup.md</code>.
              </div>
            </form>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default LoginPage;
