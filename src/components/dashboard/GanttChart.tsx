"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const HEALTH_COLOR: Record<string, string> = {
  good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A",
};
const MS_STATUS_COLOR: Record<string, string> = {
  planned: "#7BA7C8", in_progress: "#2E86FF", completed: "#00D4A0", cancelled: "#4A7099",
};

const PERIOD_OPTIONS = [
  { label: "1개월", months: 1 },
  { label: "3개월", months: 3 },
  { label: "6개월", months: 6 },
  { label: "1년",   months: 12 },
];

function getWeeks(start: Date, end: Date) {
  const weeks: Date[] = [];
  const cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay());
  while (cur <= end) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }
  return weeks;
}

function dateToX(date: Date, rangeStart: Date, totalDays: number, width: number) {
  const days = (date.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.min(width, (days / totalDays) * width));
}

export default function GanttChart() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [today] = useState(new Date());
  const [periodMonths, setPeriodMonths] = useState(3);

  const load = useCallback(async () => {
    const { data: projects } = await supabase
      .from("projects").select("*").eq("status", "active").order("created_at");
    const { data: milestones } = await supabase
      .from("milestones").select("*").order("sort_order");
    if (!projects) return;
    setRows(projects.map(p => ({
      ...p,
      milestones: (milestones ?? []).filter(m => m.project_id === p.id),
    })));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 필터 기간
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 7); // 1주 전부터
  const rangeEnd = new Date(today);
  rangeEnd.setMonth(rangeEnd.getMonth() + periodMonths);

  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);

  const LABEL_W = 160;
  const BAR_W = Math.min(2000, Math.max(600, Math.round(totalDays * 6)));
  const ROW_H = 36;
  const HEADER_H = 40;

  const weeks = getWeeks(rangeStart, rangeEnd);
  const todayX = LABEL_W + dateToX(today, rangeStart, totalDays, BAR_W);

  let totalRows = 0;
  rows.forEach(p => { totalRows += 1 + (p.milestones?.length ?? 0); });
  const svgH = HEADER_H + totalRows * ROW_H + 20;

  let rowIdx = 0;
  const elements: React.ReactNode[] = [];

  rows.forEach((p, pi) => {
    const py = HEADER_H + rowIdx * ROW_H;
    const hc = HEALTH_COLOR[p.health] ?? "#7BA7C8";

    elements.push(
      <rect key={`pbg-${pi}`} x={0} y={py} width={LABEL_W + BAR_W} height={ROW_H}
        fill={pi % 2 === 0 ? "var(--bg-3)" : "var(--bg-2)"} />
    );
    elements.push(
      <text key={`plabel-${pi}`} x={12} y={py + ROW_H / 2 + 1}
        fill="var(--text-1)" fontSize={11} fontWeight={600} fontFamily="Pretendard, sans-serif"
        dominantBaseline="middle">
        ⬡ {p.name.length > 16 ? p.name.slice(0, 16) + "…" : p.name}
      </text>
    );

    if (p.end_date) {
      const startD = p.start_date ? new Date(p.start_date) : new Date();
      const endD = new Date(p.end_date);
      // 기간 밖이면 클리핑
      const x1 = LABEL_W + dateToX(startD, rangeStart, totalDays, BAR_W);
      const x2 = LABEL_W + dateToX(endD, rangeStart, totalDays, BAR_W);
      const bw = Math.max(x2 - x1, 4);
      if (x2 > LABEL_W) { // 화면 안에 있는 경우만
        elements.push(
          <g key={`pbar-${pi}`}>
            <rect x={Math.max(x1, LABEL_W)} y={py + 10}
              width={Math.min(bw, LABEL_W + BAR_W - Math.max(x1, LABEL_W))} height={ROW_H - 20} rx={4}
              fill={`${hc}33`} stroke={hc} strokeWidth={1.5} />
            <text x={Math.max(x1, LABEL_W) + 6} y={py + ROW_H / 2 + 1} fill={hc} fontSize={10}
              fontFamily="Pretendard, sans-serif" dominantBaseline="middle">
              {p.name.length > 10 ? p.name.slice(0, 10) + "…" : p.name}
            </text>
          </g>
        );
      }
    } else {
      const label = p.start_date ? "마감 미정" : "대기";
      elements.push(
        <g key={`pbar-${pi}`}>
          <rect x={LABEL_W + 8} y={py + 11} width={60} height={ROW_H - 22} rx={4}
            fill="rgba(74,112,153,0.10)" stroke="#4A709955" strokeWidth={1} strokeDasharray="4 2" />
          <text x={LABEL_W + 38} y={py + ROW_H / 2 + 1} fill="#4A7099" fontSize={9}
            fontFamily="Pretendard, sans-serif" dominantBaseline="middle" textAnchor="middle">
            {label}
          </text>
        </g>
      );
    }

    rowIdx++;

    p.milestones?.forEach((m: any, mi: number) => {
      const my = HEADER_H + rowIdx * ROW_H;
      const mc = MS_STATUS_COLOR[m.status] ?? "#7BA7C8";
      const isOverdue = m.due_date && m.status !== "completed" && new Date(m.due_date) < today;

      elements.push(
        <rect key={`mbg-${pi}-${mi}`} x={0} y={my} width={LABEL_W + BAR_W} height={ROW_H}
          fill={(pi + mi) % 2 === 0 ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)"} />
      );
      elements.push(
        <text key={`mlabel-${pi}-${mi}`} x={24} y={my + ROW_H / 2 + 1}
          fill={m.status === "completed" ? "var(--text-3)" : "var(--text-2)"}
          fontSize={10} fontFamily="Pretendard, sans-serif" dominantBaseline="middle"
          textDecoration={m.status === "completed" ? "line-through" : undefined}>
          · {m.title.length > 14 ? m.title.slice(0, 14) + "…" : m.title}
        </text>
      );

      if (m.due_date) {
        const sd = m.start_date ? new Date(m.start_date) : new Date(m.due_date);
        const ed = new Date(m.due_date);
        const x1 = LABEL_W + dateToX(sd, rangeStart, totalDays, BAR_W);
        const x2 = LABEL_W + dateToX(ed, rangeStart, totalDays, BAR_W);
        const bw = Math.max(x2 - x1, m.start_date ? 4 : 8);
        if (x2 > LABEL_W) {
          elements.push(
            <g key={`mbar-${pi}-${mi}`}>
              <rect x={Math.max(x1, LABEL_W)} y={my + 12}
                width={Math.min(bw, 8)} height={ROW_H - 24} rx={3}
                fill={isOverdue ? "rgba(255,77,106,0.3)" : `${mc}33`}
                stroke={isOverdue ? "#FF4D6A" : mc} strokeWidth={1} />
              {!m.start_date && (
                <polygon points={`${x2},${my + 12} ${x2 + 6},${my + 6} ${x2 - 6},${my + 6}`}
                  fill={isOverdue ? "#FF4D6A" : mc} />
              )}
            </g>
          );
        }
      } else {
        const mlabel = m.start_date ? "마감 미정" : "대기";
        elements.push(
          <g key={`mbar-${pi}-${mi}`}>
            <rect x={LABEL_W + 8} y={my + 13} width={52} height={ROW_H - 26} rx={3}
              fill="rgba(74,112,153,0.08)" stroke="#4A709944" strokeWidth={1} strokeDasharray="3 2" />
            <text x={LABEL_W + 34} y={my + ROW_H / 2 + 1} fill="#4A7099" fontSize={8}
              fontFamily="Pretendard, sans-serif" dominantBaseline="middle" textAnchor="middle">
              {mlabel}
            </text>
          </g>
        );
      }

      rowIdx++;
    });
  });

  if (rows.length === 0) return (
    <div className="rounded-xl py-10 text-center"
      style={{ background: "var(--bg-3)", border: "1px dashed var(--border)" }}>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>프로젝트 없음</p>
    </div>
  );

  return (
    <div>
      {/* 기간 필터 */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-xs mr-2" style={{ color: "var(--text-3)" }}>표시 기간</span>
        {PERIOD_OPTIONS.map(opt => (
          <button key={opt.months} onClick={() => setPeriodMonths(opt.months)}
            className="rounded-lg px-3 py-1 text-xs font-medium transition-all"
            style={{
              background: periodMonths === opt.months ? "var(--cyan-bg)" : "var(--bg-3)",
              color: periodMonths === opt.months ? "var(--cyan)" : "var(--text-3)",
              border: `1px solid ${periodMonths === opt.months ? "var(--cyan)33" : "var(--border)"}`,
            }}>
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "var(--text-3)" }}>
          {rangeStart.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} ~{" "}
          {rangeEnd.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
        </span>
      </div>

      <div className="overflow-x-auto" style={{ borderRadius: 12 }}>
        <svg width={LABEL_W + BAR_W} height={svgH}
          style={{ background: "var(--bg-2)", borderRadius: 12, display: "block" }}>
          <defs>
            <clipPath id="clip-label">
              <rect x={0} y={0} width={LABEL_W - 8} height={svgH} />
            </clipPath>
          </defs>

          <rect x={0} y={0} width={LABEL_W + BAR_W} height={HEADER_H} fill="var(--bg-3)" />

          {weeks.map((w, i) => {
            const wx = LABEL_W + dateToX(w, rangeStart, totalDays, BAR_W);
            const nextWx = i + 1 < weeks.length
              ? LABEL_W + dateToX(weeks[i + 1], rangeStart, totalDays, BAR_W)
              : wx + 999;
            const showLabel = nextWx - wx >= 20;
            return (
              <g key={i}>
                <line x1={wx} y1={HEADER_H} x2={wx} y2={svgH}
                  stroke="var(--border)" strokeWidth={0.5} />
                {showLabel && (
                  <text x={wx + 3} y={HEADER_H / 2 + 1}
                    fill="var(--text-3)" fontSize={8} fontFamily="Pretendard, sans-serif"
                    dominantBaseline="middle">
                    {w.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                  </text>
                )}
              </g>
            );
          })}

          <text x={12} y={HEADER_H / 2 + 1} fill="var(--text-3)" fontSize={10}
            fontFamily="Pretendard, sans-serif" dominantBaseline="middle" fontWeight={600}>
            프로젝트 / 마일스톤
          </text>

          {elements}

          <line x1={todayX} y1={HEADER_H} x2={todayX} y2={svgH}
            stroke="var(--cyan)" strokeWidth={1.5} strokeDasharray="4 3" />
          <rect x={todayX - 14} y={0} width={28} height={HEADER_H} fill="var(--cyan-bg)" />
          <text x={todayX} y={HEADER_H / 2 + 1} fill="var(--cyan)" fontSize={9}
            fontFamily="Pretendard, sans-serif" dominantBaseline="middle" textAnchor="middle"
            fontWeight={700}>오늘</text>

          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH}
            stroke="var(--border-2)" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
