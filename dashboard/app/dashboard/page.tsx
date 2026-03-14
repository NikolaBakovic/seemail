"use client";
// app/dashboard/page.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/withAuth";
import { useAuth } from "@/lib/AuthContext";
import { getEmails, EmailDoc, checkPlanLimit } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";

function formatDate(ts: any): string {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OpenRateBadge({ opens }: { opens: number }) {
  if (opens === 0)
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-text-tertiary">
        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
        Not opened
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400 status-live" />
      {opens} open{opens > 1 ? "s" : ""}
    </span>
  );
}

export default function DashboardPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user, userDoc } = useAuth();
  const [emails, setEmails] = useState<EmailDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await getEmails(user.uid);
        setEmails(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);
  useEffect(() => {
    console.log("[MailTrack] effect ran, user:", user?.email);
    if (!user) return;

    const sendToken = async () => {
      console.log("[MailTrack] sendToken called");
      try {
        const token = await user.getIdToken(true);
        console.log("[MailTrack] token obtained:", token.substring(0, 20) + "...");
        
        const chromeApi = (window as any).chrome;
        console.log("[MailTrack] chrome:", !!chromeApi?.runtime?.sendMessage);

        if (chromeApi?.runtime?.sendMessage) {
          chromeApi.runtime.sendMessage(
            "gheleinpkpkpflljcekhkojmanlpodjo",
            { type: "SET_TOKEN", token, userId: user.uid, userEmail: user.email },
            (res: any) => {
              console.log("[MailTrack] response:", res);
              console.log("[MailTrack] lastError:", chromeApi.runtime.lastError);
            }
          );
        }
      } catch (e) {
        console.error("[MailTrack] Error:", e);
      }
    };

    const timer = setTimeout(sendToken, 1000);
    return () => clearTimeout(timer);
  }, [user]);
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-text-tertiary text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const plan = userDoc?.plan ?? "free";
  const planLimits = checkPlanLimit(plan, emails.length);
  const totalOpens = emails.reduce((s, e) => s + (e.openCount || 0), 0);
  const totalClicks = emails.reduce((s, e) => s + (e.clickCount || 0), 0);
  const openedEmails = emails.filter((e) => e.openCount > 0).length;

  const filtered = emails.filter(
    (e) =>
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.recipient.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-void">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Email Intelligence Nikola
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Track opens and clicks across all your Gmail messages.
          </p>
        </div>

        {/* Plan usage bar */}
        {plan === "free" && (
          <div className="mb-6 p-4 bg-panel border border-border rounded-xl flex items-center gap-4 animate-slide-up">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-text-secondary">
                  Free plan usage
                </span>
                <span className="text-xs font-mono text-amber-400">
                  {emails.length} / 50 emails
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (emails.length / 50) * 100)}%` }}
                />
              </div>
            </div>
            <button className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-void rounded-lg transition-colors">
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <StatCard
            label="Emails Tracked"
            value={emails.length}
            accent="amber"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            }
          />
          <StatCard
            label="Total Opens"
            value={totalOpens}
            accent="emerald"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            label="Emails Opened"
            value={`${openedEmails}`}
            sub={emails.length ? `${Math.round((openedEmails / emails.length) * 100)}% open rate` : undefined}
            accent="violet"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <StatCard
            label="Total Clicks"
            value={totalClicks}
            accent="rose"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
              </svg>
            }
          />
        </div>

        {/* Table */}
        <div className="bg-panel border border-border rounded-2xl overflow-hidden animate-slide-up">
          {/* Table Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-text-primary text-sm">
              Tracked Emails
            </h2>
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
              </svg>
              <input
                type="text"
                placeholder="Search emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber-500/50 w-48"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 bg-muted/30 border border-border rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-text-secondary font-medium text-sm">No emails tracked yet</p>
              <p className="text-text-tertiary text-xs mt-1">
                Install the Chrome extension and send your first email to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Subject", "Recipient", "Sent", "Opens", "Clicks", ""].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((email) => (
                    <tr key={email.id} className="hover:bg-surface/60 transition-colors group">
                      <td className="px-5 py-3.5 max-w-[220px]">
                        <p className="truncate font-medium text-text-primary">
                          {email.subject}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="truncate text-text-secondary font-mono text-xs max-w-[180px]">
                          {email.recipient}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-text-secondary text-xs">
                          {formatDate(email.sentAt)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <OpenRateBadge opens={email.openCount || 0} />
                      </td>
                      <td className="px-5 py-3.5">
                        {email.clickCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {email.clickCount} click{email.clickCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard/email/${email.id}`}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
