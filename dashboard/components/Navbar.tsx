"use client";
// components/Navbar.tsx
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { signOutUser } from "@/lib/firebase";
import Link from "next/link";

export default function Navbar() {
  const { user, userDoc } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.push("/login");
  }

  const plan = userDoc?.plan ?? "free";

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <span className="font-display font-bold text-text-primary text-base tracking-tight">
              MailTrack
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Plan badge */}
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                plan === "pro"
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}
            >
              {plan === "pro" ? "✦ Pro" : "Free Plan"}
            </span>

            {/* User avatar */}
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? "User"}
                className="w-7 h-7 rounded-full ring-1 ring-border"
              />
            )}

            {/* User email */}
            <span className="hidden md:block text-xs text-text-secondary max-w-[160px] truncate">
              {user?.email}
            </span>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 rounded-md hover:bg-panel"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
