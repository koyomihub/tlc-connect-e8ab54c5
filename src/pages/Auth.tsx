import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
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

const NAME_PATTERN = /^[A-Z][a-z]+(-[A-Z][a-z]+)*( [A-Z][a-z]+(-[A-Z][a-z]+)*)*$/;
const SUFFIX_PATTERN = /^[A-Z][a-zA-Z]*\.?$|^(II|III|IV|V)$/;

export default function Auth() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'signin' | 'signup'>('signin');

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

  const [successOpen, setSuccessOpen] = useState(false);
  const [signedUpEmailLocal, setSignedUpEmailLocal] = useState('');

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

    const firstName = signUpData.firstName.trim();
    const lastName = signUpData.lastName.trim();
    const suffix = signUpData.suffix.trim();
    const emailLocal = signUpData.emailLocal.trim().toLowerCase();
    const fullEmail = `${emailLocal}${SCHOOL_DOMAIN}`;

    if (!NAME_PATTERN.test(firstName)) {
      toast({
        title: 'Invalid first name',
        description: 'Each word must start with a capital letter followed by lowercase letters (e.g. "Allan Christian"). No ALL CAPS or unusual casing.',
        variant: 'destructive',
      });
      return;
    }
    if (!NAME_PATTERN.test(lastName)) {
      toast({
        title: 'Invalid last name',
        description: 'Each word must start with a capital letter followed by lowercase letters (e.g. "Dela Cruz").',
        variant: 'destructive',
      });
      return;
    }
    if (suffix && !SUFFIX_PATTERN.test(suffix)) {
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
      const { error } = await supabase.auth.signUp({
        email: fullEmail,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
            suffix: suffix || null,
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      // Sign out any session created by signUp so the user must explicitly sign in.
      await supabase.auth.signOut();

      setSignedUpEmailLocal(emailLocal);
      setSuccessOpen(true);

      // Reset signup form
      setSignUpData({
        firstName: '',
        lastName: '',
        suffix: '',
        emailLocal: '',
        password: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast({
        title: 'Sign up failed',
        description: error?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSignIn = () => {
    setSuccessOpen(false);
    setView('signin');
    setSignInData({ emailLocal: signedUpEmailLocal, password: '' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <img src={logo} alt="TLC-Connect logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-glow object-contain" />
          <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {view === 'signin' ? 'Welcome Back' : 'Create Your Account'}
          </CardTitle>
          <CardDescription>
            {view === 'signin'
              ? 'Sign in to continue to TLC Connect'
              : 'Join your school’s social network powered by blockchain'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {view === 'signin' ? (
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
                  onClick={() => setView('signup')}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign Up Here!
                </button>
              </p>
            </form>
          ) : (
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
                  className="placeholder:italic placeholder:text-muted-foreground/50"
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Use your real name. Names cannot be changed later.
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
                  Only verified Lewis College emails are accepted.
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
        </CardContent>
      </Card>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl">Sign Up Successful!</DialogTitle>
            <DialogDescription>
              Your TLC Connect account has been created. You can now sign in to start exploring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={handleGoToSignIn} className="w-full sm:w-auto shadow-md">
              Sign In Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
