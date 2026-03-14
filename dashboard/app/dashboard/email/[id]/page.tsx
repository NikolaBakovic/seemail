
"use client";
// app/dashboard/email/[id]/page.tsx
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/withAuth";
import { useAuth } from "@/lib/AuthContext";

import {
  getEmail,
  getOpens,
  getClicks,
  EmailDoc,
  OpenDoc,
  ClickDoc,
} from "@/lib/firebase";
import Navbar from "@/components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────
type TimelineEvent =
  | { type: "open"; data: OpenDoc }
  | { type: "click"; data: ClickDoc };

function ts(doc: OpenDoc | ClickDoc): Date {
  const raw = doc.timestamp;
  if (!raw) return new Date(0);
  return raw.toDate ? raw.toDate() : new Date(raw as any);
}

function fmt(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseUA(ua: string) {
  let browser = "Unknown browser";
  let os = "Unknown OS";

  if (ua.includes("Googlebot")) return { browser: "Google Bot", os: "Bot" };

  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";

  return { browser, os };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TimelineEventCard({ event, index }: { event: TimelineEvent; index: number }) {
  const isOpen = event.type === "open";
  const date = ts(event.data);
  const { browser, os } = parseUA(
    isOpen ? (event.data as OpenDoc).userAgent : "unknown"
  );

  return (
    <div
      className="relative pl-8 pb-6 last:pb-0 animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Vertical line */}
      <div className="absolute left-3 top-5 bottom-0 w-px bg-border last:hidden" />

      {/* Dot */}
      <div
        className={`absolute left-0.5 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
          isOpen
            ? "bg-emerald-500/10 border-emerald-500/40"
            : "bg-rose-500/10 border-rose-500/40"
        }`}
      >
        {isOpen ? (
          <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-2.5 h-2.5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M15.75 2.25H21a.75.75 0 01.75.75v5.25a.75.75 0 01-1.5 0V4.81L8.03 17.03a.75.75 0 01-1.06-1.06L19.19 3.75h-3.44a.75.75 0 010-1.5zm-10.5 4.5a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5V10.5a.75.75 0 011.5 0v8.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V8.25a3 3 0 013-3H13.5a.75.75 0 010 1.5H5.25z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Card */}
      <div
        className={`ml-2 p-4 rounded-xl border ${
          isOpen
            ? "bg-emerald-500/5 border-emerald-500/15"
            : "bg-rose-500/5 border-rose-500/15"
        }`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className={`text-sm font-semibold ${isOpen ? "text-emerald-400" : "text-rose-400"}`}>
              {isOpen ? "Email Opened" : "Link Clicked"}
            </p>
            <p className="text-xs text-text-tertiary mt-0.5 font-mono">{fmt(date)}</p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isOpen ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
            }`}
          >
            #{index + 1}
          </span>
        </div>

        <div className="mt-3 grid gap-1.5">
          {isOpen && (
            <>
              <DetailRow label="Browser" value={browser} />
              <DetailRow label="OS" value={os} />
              <DetailRow label="IP" value={(event.data as OpenDoc).ip || "—"} />
            </>
          )}
          {!isOpen && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-text-tertiary shrink-0 w-14">URL</span>
              <a
                href={(event.data as ClickDoc).url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:underline break-all"
              >
                {(event.data as ClickDoc).url}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple label/value pair (works without custom element in React)
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-tertiary w-14 shrink-0">{label}</span>
      <span className="text-xs font-mono text-text-secondary">{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmailDetailPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const emailId = params?.id as string;

  const [email, setEmail] = useState<EmailDoc | null>(null);
  const [opens, setOpens] = useState<OpenDoc[]>([]);
  const [clicks, setClicks] = useState<ClickDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !emailId) return;
    (async () => {
      try {
        const [emailData, opensData, clicksData] = await Promise.all([
          getEmail(emailId),
          getOpens(emailId),
          getClicks(emailId),
        ]);

        if (!emailData || emailData.userId !== user.uid) {
          setNotFound(true);
          return;
        }

        setEmail(emailData);
        setOpens(opensData);
        setClicks(clicksData);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, emailId]);
  useEffect(() => {
    console.log("[MailTrack] effect ran, user:", user?.email);
    if (!user) return;

    (async () => {
      try {
        const token = await user.getIdToken();
        const chromeApi = (window as any).chrome;

        if (chromeApi?.runtime?.sendMessage) {
          chromeApi.runtime.sendMessage(
            "gheleinpkpkpflljcekhkojmanlpodjo",
            {
              type: "SET_TOKEN",
              token,
              userId: user.uid,
              userEmail: user.email,
            },
            (res: any) => {
              if (chromeApi.runtime.lastError) {
                // Ekstenzija nije instalirana, ignoriši
                return;
              }
              console.log("[MailTrack] Token synced to extension:", res);
            }
          );
        }
      } catch (e) {
        // Silent fail — ekstenzija možda nije instalirana
      }
    })();
  }, [user]);
  // Build chronological timeline
  const timeline: TimelineEvent[] = [
    ...opens.map((o): TimelineEvent => ({ type: "open", data: o })),
    ...clicks.map((c): TimelineEvent => ({ type: "click", data: c })),
  ].sort((a, b) => ts(a.data).getTime() - ts(b.data).getTime());

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-void">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-text-secondary font-display text-lg font-semibold">Email not found</p>
          <p className="text-text-tertiary text-sm mt-1">This email doesn't exist or you don't have access.</p>
          <Link href="/dashboard" className="mt-4 text-amber-400 hover:text-amber-300 text-sm">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to dashboard
        </Link>

        {/* Email header */}
        <div className="bg-panel border border-border rounded-2xl p-6 mb-6 animate-fade-in">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Email Subject</p>
              <h1 className="font-display text-xl font-bold text-text-primary leading-tight">
                {email?.subject}
              </h1>
            </div>
            <div className="flex gap-2">
              <div className="text-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="font-display text-2xl font-bold text-emerald-400">{opens.length}</p>
                <p className="text-xs text-text-tertiary">Opens</p>
              </div>
              <div className="text-center px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="font-display text-2xl font-bold text-rose-400">{clicks.length}</p>
                <p className="text-xs text-text-tertiary">Clicks</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-xl p-3">
              <p className="text-xs text-text-tertiary mb-1">Recipient</p>
              <p className="font-mono text-sm text-text-primary truncate">{email?.recipient}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3">
              <p className="text-xs text-text-tertiary mb-1">Sent at</p>
              <p className="text-sm text-text-primary">
                {email?.sentAt ? fmt(email.sentAt.toDate ? email.sentAt.toDate() : new Date(email.sentAt as any)) : "—"}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3">
              <p className="text-xs text-text-tertiary mb-1">Email ID</p>
              <p className="font-mono text-xs text-text-tertiary truncate">{email?.id}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-panel border border-border rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-text-primary">Activity Timeline</h2>
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                Opens
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                Clicks
              </span>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-10 h-10 bg-muted/30 border border-border rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-secondary">No activity yet</p>
              <p className="text-xs text-text-tertiary mt-1">
                You'll see opens and clicks here as they happen.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {timeline.map((event, i) => (
                <TimelineEventCard key={`${event.type}-${event.data.id}`} event={event} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
