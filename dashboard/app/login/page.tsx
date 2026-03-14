"use client";
// app/login/page.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { signInWithGoogle } from "@/lib/firebase";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setError(null);

    try {
      const user = await signInWithGoogle();

      // 🔐 get Firebase ID token
      const token = await user.getIdToken();
      const chromeApi = (window as any).chrome;
      // 📡 send token to Chrome extension
      if (chromeApi?.runtime?.sendMessage) {
        chromeApi.runtime.sendMessage(
          "gheleinpkpkpflljcekhkojmanlpodjo",
          {
            type: "SET_TOKEN",
            token,
            userId: user.uid,
            userEmail: user.email, 
          },
          (res: any) => console.log("Extension response:", res)
        );
      }

      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-void grid-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
            MailTrack
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            Real-time email intelligence for Gmail
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-1">
            Welcome back
          </h2>
          <p className="text-text-secondary text-sm mb-8">
            Sign in to access your tracking dashboard.
          </p>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-800 rounded-xl font-semibold text-sm transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-black/20"
          >
            {signingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="mt-6 text-center text-xs text-text-tertiary">
            By signing in, you agree to our{" "}
            <span className="text-amber-500 cursor-pointer hover:underline">Terms of Service</span>{" "}
            and{" "}
            <span className="text-amber-500 cursor-pointer hover:underline">Privacy Policy</span>.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {["Real-time Opens", "Click Tracking", "Gmail Integration", "Free Forever"].map((f) => (
            <span
              key={f}
              className="px-3 py-1 text-xs font-medium text-text-tertiary border border-border rounded-full bg-panel"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
