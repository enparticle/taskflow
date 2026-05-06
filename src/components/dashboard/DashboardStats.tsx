interface Props {
  stats: { todayCount: number; blockedCount: number; reviewCount: number; overdueCount: number; };
}

const cards = [
  { key: "todayCount",   label: "오늘 마감",   color: "var(--amber)",  bg: "var(--amber-bg)",  glow: "rgba(245,166,35,0.2)",  icon: "◷" },
  { key: "blockedCount", label: "Blocked",     color: "var(--red)",    bg: "var(--red-bg)",    glow: "rgba(255,77,106,0.2)",   icon: "⊘" },
  { key: "reviewCount",  label: "Review 대기", color: "var(--cyan)",   bg: "var(--cyan-bg)",   glow: "rgba(0,194,204,0.2)",    icon: "◈" },
  { key: "overdueCount", label: "지연 업무",   color: "var(--purple)", bg: "var(--purple-bg)", glow: "rgba(167,139,250,0.2)",  icon: "⚠" },
] as const;

export default function DashboardStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ key, label, color, bg, glow, icon }) => (
        <div key={key} className="rounded-xl p-4 transition-all"
          style={{
            background: bg,
            border: `1px solid ${color}33`,
            boxShadow: `0 0 20px ${glow}`,
          }}>
          <div className="flex items-start justify-between mb-2">
            <span className="text-lg" style={{ color }}>{icon}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}>
              {label}
            </span>
          </div>
          <p className="text-4xl font-bold tabular-nums" style={{ color }}>{stats[key]}</p>
        </div>
      ))}
    </div>
  );
}
