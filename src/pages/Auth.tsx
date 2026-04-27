import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import logo from '@/assets/tlc-connect-logo.png';

const SCHOOL_DOMAIN = '@thelewiscollege.edu.ph';

// Each word: capital letter, then lowercase letters; allow hyphenated names; allow multiple words.
const NAME_PATTERN = /^[A-Z][a-z]+(-[A-Z][a-z]+)*( [A-Z][a-z]+(-[A-Z][a-z]+)*)*$/;
// Suffix: e.g. Jr., Sr., II, III, IV
const SUFFIX_PATTERN = /^[A-Z][a-zA-Z]*\.?$|^(II|III|IV|V)$/;

export default function Auth() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    firstName: '',
    lastName: '',
    suffix: '',
    emailLocal: '',
    password: '',
    confirmPassword: '',
  });

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(signInData.email, signInData.password);
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

      setPendingEmail(fullEmail);
      toast({
        title: 'Check your school email',
        description: `We sent a 6-digit verification code to ${fullEmail}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(otp)) {
      toast({ title: 'Invalid code', description: 'Enter the 6-digit code from your email.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: 'signup',
      });
      if (error) throw error;
      toast({ title: 'Account verified!', description: 'Welcome to TLC Connect.' });
      navigate('/feed');
    } catch (error: any) {
      toast({ title: 'Verification failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingEmail) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      if (error) throw error;
      toast({ title: 'Code resent', description: `A new code was sent to ${pendingEmail}.` });
    } catch (error: any) {
      toast({ title: 'Could not resend', description: error.message, variant: 'destructive' });
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
            Welcome to TLC Connect
          </CardTitle>
          <CardDescription>
            Your school's social network powered by blockchain
          </CardDescription>
        </CardHeader>

        <CardContent>
          {pendingEmail ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <strong>{pendingEmail}</strong>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="text-center tracking-[0.5em] text-lg"
                  required
                />
              </div>
              <Button type="submit" className="w-full shadow-md" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={handleResendOtp} className="text-primary hover:underline" disabled={isLoading}>
                  Resend code
                </button>
                <button type="button" onClick={() => { setPendingEmail(null); setOtp(''); }} className="text-muted-foreground hover:underline">
                  Use a different email
                </button>
              </div>
            </form>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">School Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={`you${SCHOOL_DOMAIN}`}
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full shadow-md" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-4">
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
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="At least 8 characters"
                      minLength={8}
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      className="placeholder:italic placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      minLength={8}
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full shadow-md" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>

        <CardFooter className="text-center text-sm text-muted-foreground">
          <p className="mx-auto">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
