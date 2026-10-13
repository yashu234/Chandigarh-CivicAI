import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES, CHANDIGARH_SECTORS } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
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
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState(CHANDIGARH_SECTORS[0] || 'Sector 17');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { registerCitizen, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal or preferred name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (password && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await registerCitizen({
      fullName: fullName.trim(),
      email: email.trim(),
      mobileNumber: phone.trim(),
      sector,
      password: password || undefined,
    });

    setIsLoading(false);

    if (result.error) {
      setErrorMessage(result.error.message || 'Registration failed. Please check details and try again.');
      return;
    }

    if (result.needsEmailVerification) {
      setStep('verify');
      setSuccessMessage(
        `A verification code or confirmation link has been sent to ${email.trim()}. Please enter the 6-digit code or click the confirmation link in your inbox.`
      );
    } else {
      // User registered and authenticated immediately
      navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await verifyOtp(email.trim(), otpCode.trim(), 'signup');
    setIsLoading(false);

    if (result.error) {
      setErrorMessage(
        result.error.message || 'Invalid or expired verification code. Please try again.'
      );
      return;
    }

    // Success: citizen profile is active, redirect to dashboard
    navigate(ROUTES.CITIZEN_DASHBOARD, { replace: true });
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
          Resident Registration
        </span>
      </div>

      <Card padding="lg" className="border-slate-200 shadow-sm">
        <CardHeader
          title={step === 'form' ? 'Create Citizen Account' : 'Verify Resident Email'}
          subtitle={
            step === 'form'
              ? 'Register as a Chandigarh resident to file and track civic grievances'
              : `Enter the verification code sent to ${email}`
          }
          action={
            <Badge variant="primary" size="sm">
              Citizen Self-Service
            </Badge>
          }
        />

        {/* Informational Status Banners */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <div>
              <strong className="block font-semibold">Registration Notice</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong className="block font-semibold">Verification Dispatched</strong>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
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
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Primary Residential Sector
              </label>
              <div className="relative">
                <select
                  id="resident-sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CHANDIGARH_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
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

            {/* Privacy / Aadhaar Exclusion notice */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                Data Privacy & Governance
              </div>
              <p className="text-[11px] text-slate-500">
                This portal does NOT collect or process Aadhaar numbers or biometric credentials. Self-registration automatically creates a standard resident profile.
              </p>
            </div>

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Register Resident Account
            </Button>

            <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
              Already have an account?{' '}
              <Link to={ROUTES.LOGIN} className="text-blue-700 font-semibold hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        ) : (
          /* OTP / EMAIL CONFIRMATION VERIFICATION STEP */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3.5 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-1.5">
              <p>
                We sent a 6-digit confirmation code to <strong>{email}</strong>.
              </p>
              <p className="text-[11px] text-blue-800">
                Please enter the code below to complete your resident registration. If you received a confirmation link, you can also click it directly.
              </p>
            </div>

            <Input
              label="6-Digit Verification Code"
              type="text"
              placeholder="123456"
              maxLength={8}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              helperText="Check your email inbox or spam folder"
              leftIcon={<KeyRound className="h-4 w-4" />}
              autoFocus
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Verify & Complete Registration
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setOtpCode('');
                }}
                className="text-slate-600 hover:text-slate-900"
              >
                Edit Registration Details
              </button>
              <button
                type="button"
                onClick={handleRegisterSubmit}
                disabled={isLoading}
                className="text-blue-700 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <RefreshCw className="h-3 w-3" />
                Resend Code
              </button>
            </div>
          </form>
        )}
      </Card>
    </PageContainer>
  );
};
export default RegisterPage;
