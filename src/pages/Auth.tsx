import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, CheckCircle2 } from 'lucide-react';
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

function formatSuffix(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^(ii|iii|iv|v)$/i.test(trimmed)) return trimmed.toUpperCase();
  const cleaned = trimmed.replace(/\.+$/, '');
  const cased = cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
  return cased + '.';
}

type View = 'signin' | 'signup-form' | 'signup-sent';

export default function Auth() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const initialView: View =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'signup'
      ? 'signup-form'
      : 'signin';
  const [view, setView] = useState<View>(initialView);

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

  const [sentToEmail, setSentToEmail] = useState('');

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

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
      setSignUpData((d) => ({ ...d, firstName, lastName, suffix }));

      const { data, error } = await supabase.auth.signUp({
        email: fullEmail,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/feed`,
          data: {
            first_name: firstName,
            last_name: lastName,
            suffix: suffix || null,
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      // Supabase returns a user with an EMPTY identities array when the email
      // is already registered (this is its way of signaling duplicate signup
      // without leaking account existence). Block that case.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        toast({
          title: 'Email already registered',
          description: 'An account with this email already exists. Please sign in instead.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setSentToEmail(fullEmail);
      setView('signup-sent');
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        toast({
          title: 'Email already registered',
          description: 'An account with this email already exists. Please sign in instead.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sign up failed',
          description: error?.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
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
            {view === 'signup-sent' && 'Check Your Email'}
          </CardTitle>
          <CardDescription>
            {view === 'signin' && 'Sign in to continue to TLC Connect'}
            {view === 'signup-form' && 'Join your school’s social network powered by blockchain'}
            {view === 'signup-sent' && `We sent a confirmation link to ${sentToEmail}`}
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
            <form onSubmit={handleSignUp} className="space-y-4">
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
                  We’ll send a confirmation link to your school email.
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
                {isLoading ? 'Creating account...' : 'Create Account'}
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

          {view === 'signup-sent' && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Click the confirmation link in the email we sent to{' '}
                  <span className="font-semibold text-foreground">{sentToEmail}</span> to activate
                  your account. After confirming, you can sign in with your email and password.
                </p>
                <p className="text-xs text-muted-foreground">
                  Don’t see it? Check your spam folder.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const emailLocal = sentToEmail.replace(SCHOOL_DOMAIN, '');
                  setSignInData({ emailLocal, password: '' });
                  setSignUpData({
                    firstName: '',
                    lastName: '',
                    suffix: '',
                    emailLocal: '',
                    password: '',
                    confirmPassword: '',
                  });
                  setSentToEmail('');
                  setView('signin');
                }}
              >
                Back to Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
