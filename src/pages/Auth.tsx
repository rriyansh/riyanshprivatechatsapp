import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Mail, User as UserIcon, Eye, EyeOff, ArrowRight, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  signInSchema,
  signUpSchema,
  resetSchema,
  friendlyAuthError,
} from "@/lib/authSchemas";
import { usernameSchema } from "@/lib/profileSchemas";
import {
  checkLoginAllowed,
  recordFailedLogin,
  resetLoginAttempts,
} from "@/lib/loginRateLimit";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "reset";

const Auth = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialMode = (params.get("mode") as Mode) || "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => setParams({ mode }, { replace: true }), [mode, setParams]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const resolveUsernameToEmail = async (uname: string): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("resolve-username", {
      body: { username: uname },
    });
    if (error) {
      // Edge function returned non-2xx
      const msg = (error as { message?: string }).message || "Lookup failed";
      toast.error(msg.includes("404") ? "No account with that username" : msg);
      return null;
    }
    if (!data?.email) {
      toast.error("No account with that username");
      return null;
    }
    return data.email as string;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const gate = checkLoginAllowed();
    if (!gate.allowed) {
      toast.error(`Too many attempts. Try again in ${gate.retryInSec}s`);
      triggerShake();
      return;
    }

    const u = usernameSchema.safeParse(username);
    if (!u.success) {
      toast.error(u.error.errors[0].message);
      triggerShake();
      return;
    }
    setLoading(true);
    const resolvedEmail = await resolveUsernameToEmail(u.data);
    setLoading(false);
    if (!resolvedEmail) {
      triggerShake();
      return;
    }

    const parsed = signInSchema.safeParse({ email: resolvedEmail, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      triggerShake();
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      recordFailedLogin();
      toast.error(friendlyAuthError(error.message));
      triggerShake();
      return;
    }
    resetLoginAttempts();
    toast.success("Welcome back");
    navigate("/", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      triggerShake();
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: parsed.data.displayName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      triggerShake();
      return;
    }
    toast.success("Account created. Let's set up your profile!");
    navigate("/welcome", { replace: true });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      triggerShake();
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    toast.success("Reset link sent. Check your inbox.");
    setMode("signin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className={`w-full max-w-[390px] animate-scale-in rounded-[2rem] border border-border bg-card/95 p-8 shadow-[var(--shadow-soft)] ${
          shake ? "animate-shake" : ""
        }`}
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border bg-background shadow-sm">
            <Lock className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-semibold tracking-normal">PrivateChats</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Sign in to continue"}
            {mode === "signup" && "Create your account"}
            {mode === "reset" && "Reset your password"}
          </p>
        </div>

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4 animate-fade-in">
            {/* Email / Username tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              <TabBtn
                active={signInTab === "email"}
                onClick={() => setSignInTab("email")}
                icon={<Mail className="h-4 w-4" />}
                label="Email"
              />
              <TabBtn
                active={signInTab === "username"}
                onClick={() => setSignInTab("username")}
                icon={<AtSign className="h-4 w-4" />}
                label="Username"
              />
            </div>

            {signInTab === "email" ? (
              <Field
                id="email"
                label="Email"
                icon={<Mail className="h-4 w-4" />}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(v) => setEmail(v)}
                placeholder="you@example.com"
              />
            ) : (
              <Field
                id="username"
                label="Username"
                icon={<AtSign className="h-4 w-4" />}
                autoComplete="username"
                value={username}
                onChange={(v) =>
                  setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder="janedoe"
              />
            )}
            <Field
              id="password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(v) => setPassword(v)}
              placeholder="••••••••"
              trailing={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode("reset")}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <SubmitButton loading={loading}>Sign in</SubmitButton>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </p>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4 animate-fade-in">
            <Field
              id="name"
              label="Name"
              icon={<UserIcon className="h-4 w-4" />}
              value={displayName}
              onChange={setDisplayName}
              placeholder="Jane Doe"
              autoComplete="name"
            />
            <Field
              id="email"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              id="password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              trailing={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <SubmitButton loading={loading}>Create account</SubmitButton>
            <p className="text-center text-sm text-muted-foreground">
              You'll pick your username next.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset} className="space-y-4 animate-fade-in">
            <Field
              id="email"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <SubmitButton loading={loading}>Send reset link</SubmitButton>
            <p className="text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode("signin")}
              >
                ← Back to sign in
              </button>
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

// ---------------- helpers ----------------

const TabBtn = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

const Field = ({
  id,
  label,
  icon,
  trailing,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-sm font-medium">
      {label}
    </Label>
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 rounded-xl bg-background/60 pl-10 pr-10 text-base"
      />
      {trailing && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>
      )}
    </div>
  </div>
);

const SubmitButton = ({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) => (
  <Button
    type="submit"
    disabled={loading}
    className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-base font-semibold shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
  >
    {loading ? (
      <Loader2 className="h-5 w-5 animate-spin" />
    ) : (
      <>
        {children} <ArrowRight className="ml-1 h-4 w-4" />
      </>
    )}
  </Button>
);

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.227c0-.682-.061-1.337-.175-1.966H12v3.72h5.385a4.604 4.604 0 0 1-1.997 3.018v2.51h3.232c1.892-1.742 2.98-4.31 2.98-7.282z"/>
    <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.62-2.422l-3.232-2.51c-.896.6-2.04.957-3.388.957-2.605 0-4.81-1.76-5.598-4.124H3.064v2.59A9.997 9.997 0 0 0 12 22z"/>
    <path fill="#FBBC05" d="M6.402 13.901a5.99 5.99 0 0 1 0-3.802V7.51H3.064a10 10 0 0 0 0 8.98l3.338-2.59z"/>
    <path fill="#EA4335" d="M12 5.977c1.47 0 2.787.505 3.825 1.498l2.868-2.868C16.96 2.99 14.696 2 12 2 8.087 2 4.71 4.246 3.064 7.51l3.338 2.59C7.19 7.737 9.395 5.977 12 5.977z"/>
  </svg>
);

export default Auth;
