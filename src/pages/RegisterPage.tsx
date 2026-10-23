import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES, CHANDIGARH_SECTORS } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  User,
  Phone,
  ArrowLeft,
  Mail,
  Lock,
  Info,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { formatAuthError } from '../utils/authUtils';

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState(CHANDIGARH_SECTORS[0] || 'Sector 17');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);

  const { registerCitizen, verifyOtp, resendVerification } = useAuth();
  const navigate = useNavigate();

  // Handle countdown for resend cooldown
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setErrorMessage('Please enter your full legal or preferred name.'); return; }
    if (!email.trim() || !email.includes('@')) { setErrorMessage('Please provide a valid email address.'); return; }
    if (password && password.length < 6) { setErrorMessage('Password must be at least 6 characters long.'); return; }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsExistingUser(false);

    const result = await registerCitizen({
      fullName: fullName.trim(),
      email: email.trim(),
      mobileNumber: phone.trim(),
      sector,
      password: password || undefined,
    });

    setIsLoading(false);

    if (result.alreadyRegistered) {
      setIsExistingUser(true);
      setErrorMessage(
        'An account with this email address already exists. Please sign in instead.'
      );
      return;
    }

    if (result.error) {
      setErrorMessage(formatAuthError(result.error));
      return;
    }

    if (result.needsEmailVerification) {
      setStep('verify');
      setResendCooldown(60);
      setSuccessMessage(
        `A verification email has been dispatched to ${email.trim()}. Click the link in the email or enter the 6-digit code below.`
      );
    } else {
      navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true });
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await resendVerification(email.trim(), 'signup');
    setIsLoading(false);

    if (error) {
      setErrorMessage(formatAuthError(error));
      return;
    }

    setResendCooldown(60);
    setSuccessMessage(`A fresh verification email has been dispatched to ${email.trim()}.`);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) { setErrorMessage('Please enter the 6-digit verification code.'); return; }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await verifyOtp(email.trim(), otpCode.trim(), 'signup');
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(formatAuthError(result.error));
      return;
    }

    navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-slate-100 flex flex-col justify-center py-12">
      <PageContainer maxWidth="sm" className="py-0">
        {/* Header */}
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
          {/* Card header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-5 mb-5">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {step === 'form' ? 'Create Citizen Account' : 'Verify Resident Email'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {step === 'form'
                  ? 'Register as a Chandigarh resident to file and track civic grievances'
                  : `Enter the verification code sent to ${email}`}
              </p>
            </div>
            <Badge variant="medium" size="sm">Citizen Self-Service</Badge>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <strong className="block font-bold">Registration Notice</strong>
                <span>{errorMessage}</span>
                {isExistingUser && (
                  <div className="mt-2.5">
                    <Link to={ROUTES.LOGIN}>
                      <Button variant="sky" size="sm">
                        Go to Sign In
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <strong className="block font-bold">Verification Dispatched</strong>
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {step === 'form' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-fade-in">
              <Input
                label="Full Name"
                placeholder="e.g. Jaswinder Singh"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                leftIcon={<User className="h-4 w-4" />}
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="citizen@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                helperText="Used for authentication, grievance status updates, and verification"
                leftIcon={<Mail className="h-4 w-4" />}
              />
              <Input
                label="Mobile Number (Optional)"
                placeholder="+91 98XXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                helperText="For municipal SMS notifications and ground crew contact"
                leftIcon={<Phone className="h-4 w-4" />}
              />

              <div>
                <label
                  htmlFor="resident-sector"
                  className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"
                >
                  Primary Residential Sector
                </label>
                <select
                  id="resident-sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="civic-select"
                >
                  {CHANDIGARH_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Account Password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                helperText="Used to access your citizen dashboard alongside email verification"
                leftIcon={<Lock className="h-4 w-4" />}
              />

              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>This portal does <strong>NOT</strong> collect Aadhaar numbers or biometric credentials. Self-registration automatically creates a standard resident profile.</span>
              </div>

              <Button type="submit" variant="sky" className="w-full" isLoading={isLoading}>
                Register Resident Account
              </Button>

              <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <Link to={ROUTES.LOGIN} className="text-sky-700 font-bold hover:underline">
                  Sign In
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
              <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 space-y-1.5">
                <p>A verification email was dispatched to <strong>{email}</strong>.</p>
                <p className="text-sky-800">
                  <strong>Click the confirmation link in the email</strong> to verify your resident account instantly, or enter the 6-digit code below if one was provided in the message.
                </p>
              </div>

              <Input
                label="6-Digit Verification Code (Optional if clicking email link)"
                type="text"
                placeholder="123456"
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                helperText="If your email contains a 6-digit code, enter it here. Otherwise, click the link directly."
                leftIcon={<KeyRound className="h-4 w-4" />}
                autoFocus
              />

              <Button type="submit" variant="sky" className="w-full" isLoading={isLoading} disabled={!otpCode.trim()}>
                Verify with 6-Digit Code
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtpCode(''); }}
                  className="text-slate-500 hover:text-slate-800 font-medium"
                >
                  Edit Registration Details
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading || resendCooldown > 0}
                  className={`inline-flex items-center gap-1 font-bold ${
                    resendCooldown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-sky-600 hover:underline'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                Already verified via email?{' '}
                <Link to={ROUTES.LOGIN} className="text-sky-700 font-bold hover:underline">
                  Sign In to Dashboard
                </Link>
              </div>
            </form>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default RegisterPage;
