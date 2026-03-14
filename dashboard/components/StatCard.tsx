// components/StatCard.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "amber" | "emerald" | "rose" | "violet";
  sub?: string;
}

const accentMap = {
  amber: {
    icon: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    val: "text-amber-400",
  },
  emerald: {
    icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    val: "text-emerald-400",
  },
  rose: {
    icon: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    val: "text-rose-400",
  },
  violet: {
    icon: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    val: "text-violet-400",
  },
};

export default function StatCard({
  label,
  value,
  icon,
  accent = "amber",
  sub,
}: StatCardProps) {
  const cls = accentMap[accent];

  return (
    <div className="bg-panel border border-border rounded-2xl p-5 flex items-start gap-4 hover:border-muted transition-colors">
      <div className={`p-2.5 rounded-xl border ${cls.icon} shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className={`font-display text-2xl font-bold tabular-nums ${cls.val}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
