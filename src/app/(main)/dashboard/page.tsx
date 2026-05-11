// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import GanttChart from "@/components/dashboard/GanttChart";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";

function DonutChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--bg-4)", margin: "0 auto" }} />;
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.18;
  let offset = -90;
  const slices = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * 360;
    const start = offset; offset += angle;
    return { ...d, start, angle };
  });
  function arc(start: number, angle: number) {
    const s = (start * Math.PI) / 180, e = ((start + angle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  }
  return (
    <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      {slices.map((s, i) => <path key={i} d={arc(s.start, s.angle)} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="butt" />)}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text-1)" fontSize={size * 0.18} fontWeight="bold" fontFamily="Pretendard, sans-serif">{total}</text>
    </svg>
  );
}

function BarChart({ data, height = 80 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "Pretendard" }}>{d.value}</span>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * (height - 20)}px`, background: d.color, minHeight: d.value > 0 ? 4 : 0, boxShadow: d.value > 0 ? `0 0 8px ${d.color}66` : "none" }} />
          <span style={{ fontSize: 9, color: "var(--text-3)", fontFamily: "Pretendard", textAlign: "center", lineHeight: 1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, color, bg }: { value: number; color: string; bg?: string }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 6, background: bg ?? "var(--bg-4)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [stats, setStats] = useState({ today: 0, blocked: 0, review: 0, overdue: 0, total: 0, done: 0, completionRate: 0 });
  const [statusDist, setStatusDist] = useState<any[]>([]);
  const [priorityDist, setPriorityDist] = useState<any[]>([]);
  const [memberStats, setMemberStats] = useState<any[]>([]);
  const [projectStats, setProjectStats] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  const load = useCallback(async () => {
    const now = new Date();
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    // 이번 달 시작/끝
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const sel = "*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name), project:projects(name)";

    // 전체 진행 중 업무 (완료되지 않은 것)
    const { data: activeTasks } = await supabase.from("tasks").select(sel).not("status", "eq", "done");
    // 이번 달 완료 업무
    const { data: doneTasks } = await supabase.from("tasks").select(sel)
      .eq("status", "done").gte("completed_at", monthStart).lte("completed_at", monthEnd);
    // 전체 업무 (차트용)
    const { data: allTasks } = await supabase.from("tasks").select(sel);

    const tasks: any[] = allTasks ?? [];
    const active: any[] = activeTasks ?? [];
    const doneThisMonth: any[] = doneTasks ?? [];

    const today = active.filter(t => t.due_date && new Date(t.due_date) <= todayEnd).length;
    const blocked = active.filter(t => t.status === "blocked").length;
    const review = active.filter(t => t.status === "review").length;
    const overdue = active.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

    // 완료율 = 이번 달 완료 / (이번 달 완료 + 현재 진행 중)
    const total = doneThisMonth.length + active.length;
    const completionRate = total > 0 ? Math.round((doneThisMonth.length / total) * 100) : 0;

    setStats({
      today, blocked, review, overdue,
      total: active.length,
      done: doneThisMonth.length,
      completionRate,
    });
    const statusMap: Record<string, { label: string; color: string }> = {
      backlog: { label: "백로그", color: "#4A7099" }, todo: { label: "할 일", color: "#7BA7C8" },
      doing: { label: "진행", color: "#2E86FF" }, blocked: { label: "Blocked", color: "#FF4D6A" },
      review: { label: "리뷰", color: "#F5A623" }, done: { label: "완료", color: "#00D4A0" },
    };
    setStatusDist(Object.entries(statusMap).map(([k, v]) => ({ ...v, value: tasks.filter(t => t.status === k).length })));
    const prioMap: Record<string, { label: string; color: string }> = {
      urgent: { label: "긴급", color: "#FF4D6A" }, high: { label: "높음", color: "#F5A623" },
      medium: { label: "보통", color: "#2E86FF" }, low: { label: "낮음", color: "#4A7099" },
    };
    setPriorityDist(Object.entries(prioMap).map(([k, v]) => ({ ...v, value: tasks.filter(t => t.priority === k && t.status !== "done").length })));
    const { data: usersRaw } = await supabase.from("users").select("*").eq("is_active", true);
    const users: any[] = usersRaw ?? [];
    const colors = ["#00C2CC","#2E86FF","#F5A623","#00D4A0","#A78BFA","#FF4D6A"];
    setMemberStats(users.map((u: any, i: number) => ({
      name: u.name,
      doing: tasks.filter(t => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status === "doing").length,
      total: tasks.filter(t => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status !== "done").length,
      color: colors[i % colors.length],
    })));
    const { data: projectsRaw } = await supabase.from("projects").select("*").eq("status", "active");
    const projects: any[] = projectsRaw ?? [];
    setProjectStats(projects.map((p: any) => ({
      name: p.name,
      done: tasks.filter(t => t.project_id === p.id && t.status === "done").length,
      total: tasks.filter(t => t.project_id === p.id).length,
      health: p.health,
    })));
    // 최근 30일 업무
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recent } = await supabase.from("tasks").select(sel)
      .gte("updated_at", thirtyDaysAgo.toISOString())
      .order("updated_at", { ascending: false }).limit(6);
    setRecentTasks(recent ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const completionRate = stats.completionRate ?? 0;
  const STATUS_COLOR: Record<string, string> = { backlog: "#4A7099", todo: "#7BA7C8", doing: "#2E86FF", blocked: "#FF4D6A", review: "#F5A623", done: "#00D4A0" };
  const STATUS_LABEL: Record<string, string> = { backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰", done: "완료" };
  const HEALTH_COLOR: Record<string, string> = { good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A" };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>대시보드</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
              {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" })} 기준
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              최근 업무 피드 · 최근 30일
            </span>
          </div>
        </div>
        <button onClick={() => setOpenForm(true)} className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
          + 새 업무
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "진행 중 업무", value: stats.total,  color: "#2E86FF", bg: "rgba(46,134,255,0.08)",  icon: "≡", sub: `이번 달 완료 ${stats.done}건` },
          { label: "오늘 마감",  value: stats.today,   color: "#F5A623", bg: "rgba(245,166,35,0.08)",  icon: "◷", sub: `지연 ${stats.overdue}건` },
          { label: "Blocked",    value: stats.blocked, color: "#FF4D6A", bg: "rgba(255,77,106,0.08)",  icon: "⊘", sub: "즉시 확인 필요" },
          { label: "완료율",     value: `${completionRate}%`, color: "#00D4A0", bg: "rgba(0,212,160,0.08)", icon: "✓", sub: `${stats.done} / ${stats.total}건` },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl p-4"
            style={{ background: c.bg, border: `1px solid ${c.color}22`, boxShadow: `0 0 20px ${c.color}11` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{c.label}</span>
              <span style={{ color: c.color, fontSize: 16 }}>{c.icon}</span>
            </div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 차트 행 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>업무 상태 분포</p>
          <DonutChart data={statusDist} size={100} />
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {statusDist.filter(d => d.value > 0).map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{d.label}</span>
                <span className="text-xs font-semibold ml-auto" style={{ color: d.color }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>우선순위별 진행 업무</p>
          <BarChart data={priorityDist} height={100} />
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>팀원별 업무량</p>
          <div className="space-y-3">
            {memberStats.map((m, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: `${m.color}22`, color: m.color, fontSize: 10 }}>{m.name[0]}</div>
                    <span className="text-xs" style={{ color: "var(--text-2)" }}>{m.name}</span>
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: m.color }}>{m.total}건</span>
                </div>
                <ProgressBar value={m.total > 0 ? (m.doing / Math.max(m.total, 1)) * 100 : 0} color={m.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 간트 차트 */}
      <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full" style={{ background: "var(--cyan)" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>프로젝트 타임라인</p>
          <div className="flex items-center gap-3 ml-auto">
            {[
              { color: "#00D4A0", label: "완료" }, { color: "#2E86FF", label: "진행 중" },
              { color: "#F5A623", label: "계획" }, { color: "#FF4D6A", label: "지연" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <GanttChart />
      </div>

      {/* 하단 행 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>프로젝트 진행 현황</p>
          <div className="space-y-3">
            {projectStats.map((p, i) => {
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              const hc = HEALTH_COLOR[p.health] ?? "#7BA7C8";
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: hc }} />
                      <span className="text-xs font-medium truncate max-w-[140px]" style={{ color: "var(--text-1)" }}>{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{p.done}/{p.total}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: hc }}>{pct}%</span>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={hc} />
                </div>
              );
            })}
            {projectStats.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>진행 중인 프로젝트 없음</p>}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>최근 업무</p>
          <div className="space-y-1.5">
            {recentTasks.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                onClick={() => setOpenDetail(t.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[t.status] }} />
                <span className="flex-1 text-xs truncate" style={{ color: "var(--text-1)" }}>{t.title}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ background: `${STATUS_COLOR[t.status]}18`, color: STATUS_COLOR[t.status] }}>
                  {STATUS_LABEL[t.status]}
                </span>
                {t.assignee && (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--cyan-bg)", color: "var(--cyan)", fontSize: 9, fontWeight: 700 }}>
                    {t.assignee.name[0]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI 피드백 */}
      <PlanningFeedback mode="dashboard" />

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onCreated={() => { load(); setOpenForm(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
    </div>
  );
}
