// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface Props {
  projectId: string;
  startDate?: string;
  endDate?: string;
}

export default function BurndownChart({ projectId, startDate, endDate }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: project } = await supabase
      .from("projects").select("start_date, end_date, name").eq("id", projectId).single();

    const start = startDate ?? project?.start_date;
    const end = endDate ?? project?.end_date;

    if (!start || !end) {
      setLoading(false);
      return;
    }

    const { data: tasks } = await supabase
      .from("tasks").select("id, status, created_at, completed_at, due_date")
      .eq("project_id", projectId);

    if (!tasks) { setLoading(false); return; }

    const startD = new Date(start);
    const endD = new Date(end);
    const totalDays = Math.ceil((endD.getTime() - startD.getTime()) / 86400000);
    const totalTasks = tasks.length;

    // 날짜별 남은 업무 수 계산
    const points: { date: string; remaining: number; ideal: number; label: string }[] = [];
    const step = Math.max(1, Math.floor(totalDays / 12)); // 최대 12개 포인트

    for (let d = 0; d <= totalDays; d += step) {
      const cur = new Date(startD);
      cur.setDate(cur.getDate() + d);
      const curStr = cur.toISOString();

      const done = tasks.filter(t =>
        t.status === "done" && t.completed_at && new Date(t.completed_at) <= cur
      ).length;

      const ideal = Math.max(0, totalTasks - Math.round((d / totalDays) * totalTasks));
      const remaining = totalTasks - done;

      points.push({
        date: cur.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
        remaining,
        ideal,
        label: d === 0 ? "시작" : d >= totalDays ? "마감" : "",
      });
    }

    // 오늘 포인트 추가
    const today = new Date();
    if (today > startD && today < endD) {
      const todayDone = tasks.filter(t => t.status === "done").length;
      const todayIdx = points.findIndex(p => {
        const pd = new Date(startD);
        pd.setDate(pd.getDate() + points.indexOf(p) * step);
        return pd >= today;
      });
      if (todayIdx > 0) {
        points[todayIdx - 1].label = "오늘";
      }
    }

    setData(points);
    setLoading(false);
  }, [projectId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-40 flex items-center justify-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>로딩 중…</p></div>;
  if (data.length === 0) return <div className="h-40 flex items-center justify-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>시작일/마감일이 설정되어야 번다운 차트를 볼 수 있습니다</p></div>;

  const maxVal = Math.max(...data.map(d => Math.max(d.remaining, d.ideal)), 1);
  const W = 560;
  const H = 160;
  const PAD = { top: 10, right: 20, bottom: 30, left: 30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  function x(i: number) { return PAD.left + (i / (data.length - 1)) * chartW; }
  function y(v: number) { return PAD.top + chartH - (v / maxVal) * chartH; }

  const idealPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.ideal)}`).join(" ");
  const actualPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.remaining)}`).join(" ");

  // 오늘 이후는 점선으로
  const todayIdx = data.findIndex(d => d.label === "오늘");

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: "#4A7099" }} />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>이상적 소진</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: "#00C2CC" }} />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>실제 소진</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* 그리드 */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = PAD.top + chartH * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD.left} y1={yv} x2={W - PAD.right} y2={yv}
                stroke="var(--border)" strokeWidth={0.5} />
              <text x={PAD.left - 4} y={yv + 4} fill="var(--text-3)" fontSize={9} textAnchor="end">
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}

        {/* 이상 라인 */}
        <path d={idealPath} fill="none" stroke="#4A7099" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* 실제 라인 */}
        <path d={actualPath} fill="none" stroke="#00C2CC" strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 4px rgba(0,194,204,0.5))" }} />

        {/* 날짜 레이블 */}
        {data.map((d, i) => d.label ? (
          <g key={i}>
            <line x1={x(i)} y1={PAD.top} x2={x(i)} y2={H - PAD.bottom}
              stroke={d.label === "오늘" ? "var(--cyan)" : "var(--border-2)"}
              strokeWidth={d.label === "오늘" ? 1.5 : 0.5}
              strokeDasharray={d.label === "오늘" ? "4 3" : undefined} />
            <text x={x(i)} y={H - 4} fill={d.label === "오늘" ? "var(--cyan)" : "var(--text-3)"}
              fontSize={9} textAnchor="middle" fontWeight={d.label === "오늘" ? 700 : 400}>
              {d.label === "오늘" ? "오늘" : d.date}
            </text>
          </g>
        ) : (
          <text key={i} x={x(i)} y={H - 4} fill="var(--text-3)" fontSize={8} textAnchor="middle">{d.date}</text>
        ))}

        {/* 데이터 포인트 */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.remaining)} r={3}
            fill="#00C2CC" stroke="var(--bg-2)" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}
