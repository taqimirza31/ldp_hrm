import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import admaniLogo from "@assets/generated_images/cool_modern_geometric_logo_for_admani_holdings.png";
import { Building2, Mail, Loader2 } from "lucide-react";

// Microsoft logo for SSO button
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Check if Microsoft SSO is enabled
  const { data: ssoConfig } = useQuery<{ enabled: boolean; tenantId: string }>({
    queryKey: ["/api/auth/microsoft/config"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/microsoft/config");
        return res.json();
      } catch {
        return { enabled: false, tenantId: "" };
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const ssoEnabled = ssoConfig?.enabled ?? false;

  // Handle SSO error from redirect query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      toast.error(decodeURIComponent(error));
      // Clean URL
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back!");
      setLocation("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function handleMicrosoftLogin() {
    setSsoLoading(true);
    // Redirect to backend SSO endpoint (full page redirect)
    window.location.href = "/api/auth/microsoft/login";
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render login form if already logged in (will redirect)
  if (user) {
    return null;
  }

  const ssoConfigLoading = ssoConfig === undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-muted/50 to-muted/20 px-4 py-8">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Logo & title */}
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary rounded-xl p-3 shadow-lg ring-2 ring-primary/20">
            <img src={admaniLogo} alt="Admani" className="h-11 w-11 invert brightness-0" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">Voyager HRIS</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>
        </div>

        <Card className="border-border shadow-lg overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-lg">Log in</CardTitle>
            <CardDescription>Use your work account or email and password.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Microsoft SSO — always visible, enabled when config says so */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Building2 className="h-3.5 w-3.5" />
                Organizational account
              </div>
              {ssoConfigLoading ? (
                <div className="flex items-center justify-center gap-2 h-11 rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking sign-in options…
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-3 font-medium bg-background hover:bg-muted/50 border-2 border-muted-foreground/20"
                  onClick={handleMicrosoftLogin}
                  disabled={ssoLoading || loading || !ssoEnabled}
                >
                  {ssoLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                  ) : (
                    <MicrosoftIcon className="h-5 w-5 shrink-0" />
                  )}
                  Sign in with Microsoft
                </Button>
              )}
              {!ssoConfigLoading && !ssoEnabled && (
                <p className="text-xs text-muted-foreground text-center">
                  Microsoft sign-in is not configured. Use email below.
                </p>
              )}
            </div>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground whitespace-nowrap">
                or
              </span>
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Mail className="h-3.5 w-3.5" />
                Email and password
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="bg-background"
                  disabled={loading || ssoLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="bg-background"
                  disabled={loading || ssoLoading}
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading || ssoLoading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing in…
                  </>
                ) : (
                  "Sign in with email"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-0">
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Demo: <span className="font-mono">admin@admani.com</span> / <span className="font-mono">password123</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
