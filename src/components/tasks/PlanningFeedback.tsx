// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const LEVEL_CONFIG = {
  danger:  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", icon: "⊘" },
  warning: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)",  icon: "⚠" },
  info:    { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  icon: "ℹ" },
};

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",     color: "#fbbf24" },
  critical:  { label: "위험",     color: "#f87171" },
  suspended: { label: "중단",     color: "#71717a" },
};

interface Props {
  mode?: "dashboard" | "project" | "tasks";
  projectId?: string;
  projectName?: string;
  onTaskClick?: (id: string) => void;
}

export default function PlanningFeedback({ mode = "tasks", projectId, projectName, onTaskClick }: Props) {
  const supabase = createClient();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);

  async function runFeedback() {
    setLoading(true); setRan(true);
    try {
      const now = new Date();

      // 데이터 수집
      let tasksQuery = supabase.from("tasks")
        .select("id, title, status, priority, due_date, estimated_hours, assignee_id, assignee_ids, milestone_id, task_type, project_id");
      if (projectId) tasksQuery = tasksQuery.eq("project_id", projectId);

      const [{ data: tasks }, { data: users }, { data: milestones }] = await Promise.all([
        tasksQuery,
        supabase.from("users").select("id, name, role").eq("is_active", true).neq("role", "viewer"),
        projectId
          ? supabase.from("milestones").select("*").eq("project_id", projectId).order("sort_order")
          : Promise.resolve({ data: [] }),
      ]);

      let projectData = null;
      if (projectId) {
        const { data: p } = await supabase.from("projects")
          .select("id, name, health, start_date, end_date, description").eq("id", projectId).single();
        projectData = p;
      }

      // 번다운 괴리율 계산
      let burndownDivergence = null;
      if (projectData?.start_date && projectData?.end_date && tasks) {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === "done").length;
        const startD = new Date(projectData.start_date);
        const endD = new Date(projectData.end_date);
        const totalDays = Math.max((endD.getTime() - startD.getTime()) / 86400000, 1);
        const elapsedDays = Math.max(0, (now.getTime() - startD.getTime()) / 86400000);
        const progress = Math.min(elapsedDays / totalDays, 1);
        const idealRemaining = total * (1 - progress);
        const actualRemaining = total - done;
        burndownDivergence = total > 0 ? Math.round(((actualRemaining - idealRemaining) / total) * 100) : 0;
      }

      const snapshot = {
        context: projectId ? `프로젝트: ${projectName ?? projectData?.name}` : mode === "dashboard" ? "전체 팀 대시보드" : "전체 업무 목록",
        date: now.toLocaleDateString("ko-KR"),
        project: projectData ? {
          name: projectData.name, health: projectData.health,
          start: projectData.start_date, end: projectData.end_date,
          description: projectData.description,
        } : undefined,
        project_id: projectId,
        burndown_divergence_pct: burndownDivergence,
        burndown_note: burndownDivergence !== null
          ? `번다운 괴리율 ${burndownDivergence}% (양수=지연, 음수=초과달성)`
          : "시작일/마감일 미설정으로 괴리율 계산 불가",
        total_tasks: (tasks ?? []).length,
        done_tasks: (tasks ?? []).filter(t => t.status === "done").length,
        doing_tasks: (tasks ?? []).filter(t => t.status === "doing").length,
        blocked_tasks: (tasks ?? []).filter(t => t.status === "blocked").length,
        overdue_tasks: (tasks ?? []).filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "done").length,
        no_estimate_tasks: (tasks ?? []).filter(t => !t.estimated_hours && t.status !== "backlog" && t.status !== "done").length,
        team: (users ?? []).map(u => ({
          id: u.id, name: u.name,
          doing: (tasks ?? []).filter(t => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status === "doing").length,
          total: (tasks ?? []).filter(t => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status !== "done").length,
        })),
        milestones: (milestones ?? []).map(m => ({
          id: m.id, title: m.title, status: m.status, due_date: m.due_date,
          overdue: m.due_date && m.status !== "completed" && new Date(m.due_date) < now,
        })),
        tasks: (tasks ?? []).slice(0, 30).map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          due_date: t.due_date, estimated_hours: t.estimated_hours,
          overdue: t.due_date && new Date(t.due_date) < now && t.status !== "done",
        })),
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      // 프로젝트 health 업데이트
      if (projectId && data.project_health) {
        await supabase.from("projects").update({ health: data.project_health }).eq("id", projectId);
      }
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  async function approveSuggestion(s: any, idx: number) {
    setApplying(idx);
    try {
      await supabase.from("tasks").update({ [s.field]: s.suggested_value }).eq("id", s.task_id);
      await supabase.from("ai_suggestions").update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("task_id", s.task_id).eq("field", s.field).eq("status", "pending");
      setResult((r: any) => ({ ...r, suggestions: r.suggestions.filter((_: any, i: number) => i !== idx) }));
    } catch {}
    setApplying(null);
  }

  async function rejectSuggestion(s: any, idx: number) {
    await supabase.from("ai_suggestions").update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("task_id", s.task_id).eq("field", s.field).eq("status", "pending");
    setResult((r: any) => ({ ...r, suggestions: r.suggestions.filter((_: any, i: number) => i !== idx) }));
  }

  if (!ran) return (
    <div className="flex justify-end">
      <button onClick={runFeedback}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
        ✦ AI 피드백 분석
      </button>
    </div>
  );

  if (loading) return (
    <div className="rounded-2xl px-4 py-6 text-center" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
      <div className="inline-block w-5 h-5 rounded-full border-2 animate-spin mb-2"
        style={{ borderColor: "#a78bfa", borderTopColor: "transparent" }} />
      <p className="text-xs" style={{ color: "var(--text-3)" }}>AI가 분석 중입니다…</p>
    </div>
  );

  if (result?.error) return (
    <div className="rounded-xl px-4 py-3 flex items-center justify-between"
      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
      <p className="text-xs" style={{ color: "#f87171" }}>분석 실패: {result.error}</p>
      <button onClick={runFeedback} className="text-xs ml-3" style={{ color: "#f87171" }}>다시 시도</button>
    </div>
  );

  if (!result) return null;

  const riskColor = result.overall_risk === "high" ? "#f87171" : result.overall_risk === "medium" ? "#fbbf24" : "#34d399";
  const hConfig = result.project_health ? HEALTH_LABEL[result.project_health] : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-2)", background: "var(--bg-2)" }}>
      {/* 헤더 */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ borderBottom: collapsed ? "none" : "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#a78bfa" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>✦ AI 피드백</p>
          {result.summary && (
            <span className="text-xs" style={{ color: "var(--text-3)" }}>{result.summary}</span>
          )}
          {hConfig && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${hConfig.color}18`, color: hConfig.color }}>
              {hConfig.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); setRan(false); setResult(null); }}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
            다시 분석
          </button>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {/* AI 추천 사항 */}
          {result.suggestions?.length > 0 && (
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
              <p className="text-xs font-semibold" style={{ color: "#60a5fa" }}>
                ✦ AI 추천 ({result.suggestions.length}건) — 승인하면 자동 적용
              </p>
              {result.suggestions.map((s: any, i: number) => (
                <div key={i} className="rounded-lg p-2.5 flex items-start justify-between gap-3"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-1)" }}>{s.task_title}</p>
                    <p className="text-xs" style={{ color: "var(--text-2)" }}>
                      {s.type === "assignee" ? "담당자" : s.type === "deadline" ? "마감일" : s.type === "priority" ? "우선순위" : "상태"}
                      {": "}
                      <span style={{ color: "var(--text-3)", textDecoration: "line-through" }}>{s.current_value ?? "없음"}</span>
                      {" → "}
                      <span style={{ color: "#60a5fa", fontWeight: 600 }}>{s.suggested_value}</span>
                    </p>
                    {s.reason && <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{s.reason}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => approveSuggestion(s, i)} disabled={applying === i}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                      {applying === i ? "…" : "✓ 승인"}
                    </button>
                    <button onClick={() => rejectSuggestion(s, i)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 분석 아이템 */}
          {(result.items ?? []).map((item: any, i: number) => {
            const cfg = LEVEL_CONFIG[item.level] ?? LEVEL_CONFIG.info;
            return (
              <div key={i} className="rounded-xl px-3 py-2.5"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-sm mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: cfg.color }}>{item.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>{item.detail}</p>
                    {item.action && (
                      <p className="text-xs mt-1 px-2 py-1 rounded-lg"
                        style={{ background: "rgba(0,0,0,0.2)", color: "var(--text-3)" }}>
                        → {item.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hConfig && (
            <p className="text-xs text-right" style={{ color: "var(--text-3)" }}>
              🟡 AI가 프로젝트 상태를 <span style={{ color: hConfig.color, fontWeight: 600 }}>{hConfig.label}</span>으로 업데이트했습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
