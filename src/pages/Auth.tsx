import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
import logo from '@/assets/tlc-connect-logo.png';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  show: boolean;
  onToggleShow: () => void;
}

function PasswordInput({ id, value, onChange, placeholder, required, minLength, show, onToggleShow }: PasswordInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="pr-10 placeholder:italic placeholder:text-muted-foreground/50"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const SCHOOL_DOMAIN = '@thelewiscollege.edu.ph';
const SUFFIX_PATTERN = /^[A-Za-z]+\.?$|^(II|III|IV|V|2nd|3rd|4th)$/i;

/**
 * Title-case a name: trim, lowercase, then capitalize the first letter
 * of each space- or hyphen-delimited word. "ALLAN christian" -> "Allan Christian",
 * "dela-cruz" -> "Dela-Cruz".
 */
function titleCaseName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/(\s+)/)
    .map((segment) =>
      /\s+/.test(segment)
        ? ' '
        : segment
            .split('-')
            .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
            .join('-'),
    )
    .join('');
}

/** Title-case a suffix but preserve roman numerals (II, III, IV, V) as uppercase. */
function formatSuffix(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^(ii|iii|iv|v)$/i.test(trimmed)) return trimmed.toUpperCase();
  // "jr" -> "Jr.", "jr." -> "Jr.", "sr" -> "Sr."
  const cleaned = trimmed.replace(/\.+$/, '');
  const cased = cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
  return cased + '.';
}

type View = 'signin' | 'signup-form' | 'signup-otp';

export default function Auth() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>('signin');

  const [signInData, setSignInData] = useState({ emailLocal: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    firstName: '',
    lastName: '',
    suffix: '',
    emailLocal: '',
    password: '',
    confirmPassword: '',
  });

  const [showSignInPw, setShowSignInPw] = useState(false);
  const [showSignUpPw, setShowSignUpPw] = useState(false);
  const [showSignUpConfirmPw, setShowSignUpConfirmPw] = useState(false);

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const fullEmail = `${signInData.emailLocal.trim().toLowerCase()}${SCHOOL_DOMAIN}`;
      await signIn(fullEmail, signInData.password);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (email: string, metadata: Record<string, any>) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: metadata,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const handleStartSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-format names
    const firstName = titleCaseName(signUpData.firstName);
    const lastName = titleCaseName(signUpData.lastName);
    const suffix = formatSuffix(signUpData.suffix);
    const emailLocal = signUpData.emailLocal.trim().toLowerCase();
    const fullEmail = `${emailLocal}${SCHOOL_DOMAIN}`;

    if (!firstName) {
      toast({ title: 'First name required', variant: 'destructive' });
      return;
    }
    if (!lastName) {
      toast({ title: 'Last name required', variant: 'destructive' });
      return;
    }
    if (suffix && !SUFFIX_PATTERN.test(suffix.replace(/\.$/, ''))) {
      toast({
        title: 'Invalid suffix',
        description: 'Use formats like "Jr.", "Sr.", "II", or "III".',
        variant: 'destructive',
      });
      return;
    }
    if (!emailLocal || emailLocal.includes('@')) {
      toast({
        title: 'Invalid email',
        description: `Enter the part before ${SCHOOL_DOMAIN} only.`,
        variant: 'destructive',
      });
      return;
    }
    if (signUpData.password.length < 8) {
      toast({
        title: 'Weak password',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are identical.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const displayName = `${firstName} ${lastName}${suffix ? ' ' + suffix : ''}`;
      // Reflect the auto-formatted values back into the form so the user sees the result.
      setSignUpData((d) => ({ ...d, firstName, lastName, suffix }));

      await sendOtp(fullEmail, {
        first_name: firstName,
        last_name: lastName,
        suffix: suffix || null,
        display_name: displayName,
        // Stash the password so we can set it after OTP verification creates the user.
        pending_password: signUpData.password,
      });

      setOtpEmail(fullEmail);
      setOtp('');
      setResendCooldown(60);
      setView('signup-otp');
      toast({
        title: 'Verification code sent',
        description: `Check ${fullEmail} for a 6-digit code.`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not send code',
        description: error?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      // Verify the email OTP — this creates and confirms the user.
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp,
        type: 'email',
      });
      if (verifyError) throw verifyError;

      // The user is now signed in. Set the password they chose so they can
      // sign in with email + password from now on.
      if (signUpData.password) {
        const { error: pwError } = await supabase.auth.updateUser({
          password: signUpData.password,
        });
        if (pwError) {
          console.warn('Could not set password after OTP signup:', pwError.message);
        }
      }

      // Sign the user out so they explicitly sign in.
      await supabase.auth.signOut();

      const emailLocal = otpEmail.replace(SCHOOL_DOMAIN, '');
      toast({
        title: 'Account verified!',
        description: 'You can now sign in with your email and password.',
      });

      setSignInData({ emailLocal, password: '' });
      setSignUpData({
        firstName: '',
        lastName: '',
        suffix: '',
        emailLocal: '',
        password: '',
        confirmPassword: '',
      });
      setOtp('');
      setOtpEmail('');
      setView('signin');
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error?.message || 'The code is invalid or expired.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0 || !otpEmail) return;
    setIsLoading(true);
    try {
      const displayName = `${signUpData.firstName} ${signUpData.lastName}${signUpData.suffix ? ' ' + signUpData.suffix : ''}`;
      await sendOtp(otpEmail, {
        first_name: signUpData.firstName,
        last_name: signUpData.lastName,
        suffix: signUpData.suffix || null,
        display_name: displayName,
        pending_password: signUpData.password,
      });
      setResendCooldown(60);
      toast({ title: 'Code resent', description: `New code sent to ${otpEmail}.` });
    } catch (error: any) {
      toast({ title: 'Could not resend', description: error?.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <img src={logo} alt="TLC-Connect logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-glow object-contain" />
          <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {view === 'signin' && 'Welcome Back'}
            {view === 'signup-form' && 'Create Your Account'}
            {view === 'signup-otp' && 'Verify Your Email'}
          </CardTitle>
          <CardDescription>
            {view === 'signin' && 'Sign in to continue to TLC Connect'}
            {view === 'signup-form' && 'Join your school’s social network powered by blockchain'}
            {view === 'signup-otp' && `Enter the 6-digit code sent to ${otpEmail}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">School Email</Label>
                <div className="flex">
                  <Input
                    id="signin-email"
                    type="text"
                    placeholder="firstnamelastname"
                    value={signInData.emailLocal}
                    onChange={(e) => setSignInData({ ...signInData, emailLocal: e.target.value })}
                    className="rounded-r-none placeholder:italic placeholder:text-muted-foreground/50"
                    required
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground whitespace-nowrap">
                    {SCHOOL_DOMAIN}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <PasswordInput
                  id="signin-password"
                  placeholder="Enter your password"
                  value={signInData.password}
                  onChange={(v) => setSignInData({ ...signInData, password: v })}
                  required
                  show={showSignInPw}
                  onToggleShow={() => setShowSignInPw((s) => !s)}
                />
              </div>
              <Button type="submit" className="w-full shadow-md" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Don’t have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => setView('signup-form')}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign Up Here!
                </button>
              </p>
            </form>
          )}

          {view === 'signup-form' && (
            <form onSubmit={handleStartSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="signup-first">First Name</Label>
                  <Input
                    id="signup-first"
                    type="text"
                    placeholder="Juan"
                    value={signUpData.firstName}
                    onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                    onBlur={(e) => setSignUpData({ ...signUpData, firstName: titleCaseName(e.target.value) })}
                    required
                    className="placeholder:italic placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-last">Last Name</Label>
                  <Input
                    id="signup-last"
                    type="text"
                    placeholder="Dela Cruz"
                    value={signUpData.lastName}
                    onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                    onBlur={(e) => setSignUpData({ ...signUpData, lastName: titleCaseName(e.target.value) })}
                    required
                    className="placeholder:italic placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-suffix">Suffix <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="signup-suffix"
                  type="text"
                  placeholder="Jr., Sr., II, etc."
                  value={signUpData.suffix}
                  onChange={(e) => setSignUpData({ ...signUpData, suffix: e.target.value })}
                  onBlur={(e) => setSignUpData({ ...signUpData, suffix: formatSuffix(e.target.value) })}
                  className="placeholder:italic placeholder:text-muted-foreground/50"
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Use your real name. Names cannot be changed later. Capitalization is fixed automatically.
              </p>
              <div className="space-y-2">
                <Label htmlFor="signup-email">School Email</Label>
                <div className="flex">
                  <Input
                    id="signup-email"
                    type="text"
                    placeholder="firstnamelastname"
                    value={signUpData.emailLocal}
                    onChange={(e) => setSignUpData({ ...signUpData, emailLocal: e.target.value })}
                    className="rounded-r-none placeholder:italic placeholder:text-muted-foreground/50"
                    required
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground whitespace-nowrap">
                    {SCHOOL_DOMAIN}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  We’ll send a 6-digit verification code to your school email.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  value={signUpData.password}
                  onChange={(v) => setSignUpData({ ...signUpData, password: v })}
                  required
                  show={showSignUpPw}
                  onToggleShow={() => setShowSignUpPw((s) => !s)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <PasswordInput
                  id="signup-confirm"
                  placeholder="Re-enter your password"
                  minLength={8}
                  value={signUpData.confirmPassword}
                  onChange={(v) => setSignUpData({ ...signUpData, confirmPassword: v })}
                  required
                  show={showSignUpConfirmPw}
                  onToggleShow={() => setShowSignUpConfirmPw((s) => !s)}
                />
              </div>
              <Button type="submit" className="w-full shadow-md" disabled={isLoading}>
                <Mail className="h-4 w-4 mr-2" />
                {isLoading ? 'Sending code...' : 'Send Verification Code'}
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign In Here!
                </button>
              </p>
            </form>
          )}

          {view === 'signup-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex flex-col items-center space-y-3">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground text-center">
                  The code expires in a few minutes. Check your spam folder if it doesn’t arrive.
                </p>
              </div>

              <Button type="submit" className="w-full shadow-md" disabled={isLoading || otp.length !== 6}>
                {isLoading ? 'Verifying...' : 'Verify & Create Account'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setView('signup-form')}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Edit details
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="font-semibold text-primary disabled:text-muted-foreground hover:underline disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
