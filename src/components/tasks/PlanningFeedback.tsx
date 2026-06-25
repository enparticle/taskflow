// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

const LEVEL_CONFIG = {
  danger:  { color: "#DC2626", bg: "rgba(220,38,38,0.06)",  border: "rgba(220,38,38,0.2)",  icon: "🚨" },
  warning: { color: "#D97706", bg: "rgba(217,119,6,0.06)",  border: "rgba(217,119,6,0.2)",  icon: "⚠️" },
  info:    { color: "#2563EB", bg: "rgba(37,99,235,0.06)",  border: "rgba(37,99,235,0.2)",  icon: "💡" },
};
const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",  color: "#16A34A" },
  reviewing: { label: "검토",  color: "#2563EB" },
  at_risk:   { label: "주의",  color: "#D97706" },
  critical:  { label: "위험",  color: "#DC2626" },
  suspended: { label: "중단",  color: "#A8A8A4" },
};

const MODES = [
  { id: "personal", label: "👤 내 업무", desc: "나에게 배정된 업무 분석" },
  { id: "team",     label: "🏢 팀 전체", desc: "전체 팀 업무 현황 분석" },
  { id: "project",  label: "📁 프로젝트", desc: "특정 프로젝트 심층 분석" },
];

interface Props {
  mode?: "dashboard" | "project" | "tasks" | "full";
  projectId?: string;
  projectName?: string;
  onTaskClick?: (id: string) => void;
}

export default function PlanningFeedback({ mode = "tasks", projectId, projectName, onTaskClick }: Props) {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<"personal" | "team" | "project">(
    projectId ? "project" : mode === "dashboard" ? "personal" : "personal"
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId ?? "");
  const [projects, setProjects] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [tab, setTab] = useState<"result" | "history">("result");
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isFullMode = mode === "full";
  const isProjectMode = !!projectId && !isFullMode;

  useEffect(() => {
    getAuthUser().then(u => { if (u) setMyUser(u); });
    if (isFullMode) {
      supabase.from("projects").select("id,name").eq("status", "active").then(({ data }) => setProjects(data ?? []));
    }
  }, []);

  async function loadHistory() {
    if (!myUser) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("ai_feedback_history")
      .select("*, project:projects(name)")
      .eq("user_id", myUser.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data ?? []);
    setHistoryLoading(false);
  }

  useEffect(() => {
    if (tab === "history" && myUser) loadHistory();
  }, [tab, myUser]);

  // 마운트 시 기록 탭 미리 로드
  useEffect(() => {
    if (myUser) loadHistory();
  }, [myUser]);

  async function runFeedback() {
    setLoading(true); setRan(true); setTab("result");
    try {
      const now = new Date();
      const effectiveProjectId = isProjectMode ? projectId : (selectedMode === "project" ? selectedProjectId : undefined);

      // 데이터 수집
      let tasksQuery = supabase.from("tasks")
        .select("id, title, status, priority, due_date, estimated_hours, actual_hours, assignee_id, assignee_ids, milestone_id, task_type, project_id, blocked_reason");

      if (effectiveProjectId) {
        tasksQuery = tasksQuery.eq("project_id", effectiveProjectId);
      } else if (selectedMode === "personal" && myUser) {
        tasksQuery = tasksQuery.or(`assignee_id.eq.${myUser.userId},assignee_ids.cs.{${myUser.userId}}`);
      }

      const [{ data: tasks }, { data: users }, { data: milestones }] = await Promise.all([
        tasksQuery,
        supabase.from("users").select("id, name, role").eq("is_active", true).neq("role", "viewer"),
        effectiveProjectId
          ? supabase.from("milestones").select("*").eq("project_id", effectiveProjectId).order("sort_order")
          : Promise.resolve({ data: [] }),
      ]);

      let projectData = null;
      if (effectiveProjectId) {
        const { data: p } = await supabase.from("projects")
          .select("id, name, health, start_date, end_date, description").eq("id", effectiveProjectId).single();
        projectData = p;
      }

      // 번다운 차트 계산
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

      const modeLabel = selectedMode === "personal"
        ? `개인 업무 (${myUser?.name ?? ""})`
        : selectedMode === "project"
        ? `프로젝트: ${projectName ?? projectData?.name}`
        : "팀 전체 업무";

      const snapshot = {
        context: isProjectMode ? `프로젝트: ${projectName ?? projectData?.name}` : modeLabel,
        date: now.toLocaleDateString("ko-KR"),
        mode: isProjectMode ? "project" : selectedMode,
        project: projectData ? {
          name: projectData.name, health: projectData.health,
          start: projectData.start_date, end: projectData.end_date,
          description: projectData.description,
        } : undefined,
        project_id: effectiveProjectId,
        burndown_divergence_pct: burndownDivergence,
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
        milestones: (milestones ?? []).map((m: any) => ({
          id: m.id, title: m.title, status: m.status, due_date: m.due_date,
          overdue: m.due_date && m.status !== "completed" && new Date(m.due_date) < now,
        })),
        tasks: (tasks ?? []).slice(0, 40).map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          due_date: t.due_date, estimated_hours: t.estimated_hours,
          blocked_reason: t.blocked_reason,
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
      if (effectiveProjectId && data.project_health) {
        await supabase.from("projects").update({ health: data.project_health }).eq("id", effectiveProjectId);
      }

      // 기록 저장
      if (myUser) {
        await supabase.from("ai_feedback_history").insert({
          user_id: myUser.userId,
          mode: isProjectMode ? "project" : selectedMode,
          project_id: effectiveProjectId || null,
          result: data,
        });
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

  function loadHistoryItem(item: any) {
    setResult(item.result);
    setRan(true);
    setTab("result");
  }

  // ─── 프로젝트 내장 모드 (기존 동작 유지) ───
  if (isProjectMode) {
    if (!ran) return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={runFeedback}
          style={{ padding: "7px 16px", background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ✦ AI 피드백 분석
        </button>
      </div>
    );
    if (loading) return (
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid #7C3AED", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>AI가 분석 중입니다…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
    return <FeedbackResult result={result} collapsed={collapsed} setCollapsed={setCollapsed}
      onRerun={() => { setRan(false); setResult(null); }} onApprove={approveSuggestion}
      onReject={rejectSuggestion} applying={applying} onTaskClick={onTaskClick} />;
  }

  // ─── 풀 모드 (AI 탭 페이지) ───
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 모드 선택 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setSelectedMode(m.id as any)}
            style={{
              padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
              background: selectedMode === m.id ? "var(--cyan-bg)" : "var(--bg-2)",
              border: `1px solid ${selectedMode === m.id ? "var(--cyan)" : "var(--border)"}`,
              transition: "all 0.15s",
            }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: selectedMode === m.id ? "var(--cyan)" : "var(--text-1)", margin: "0 0 3px" }}>{m.label}</p>
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{m.desc}</p>
          </button>
        ))}
      </div>

      {/* 프로젝트 선택 (프로젝트 모드일 때) */}
      {selectedMode === "project" && (
        <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-1)", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", colorScheme: "light" }}>
          <option value="">프로젝트를 선택하세요</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {/* 분석 버튼 */}
      <button onClick={runFeedback}
        disabled={loading || (selectedMode === "project" && !selectedProjectId)}
        style={{
          padding: "11px 0", background: loading ? "var(--bg-3)" : "#7C3AED",
          border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
          color: loading ? "var(--text-3)" : "#fff", cursor: "pointer",
          opacity: (selectedMode === "project" && !selectedProjectId) ? 0.4 : 1,
        }}>
        {loading ? "분석 중…" : "✦ AI 피드백 분석 시작"}
      </button>

      {/* 결과 / 기록 탭 */}
      <div>
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 14, width: "fit-content" }}>
            {[{ id: "result", label: "분석 결과" }, { id: "history", label: "📋 이전 기록" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: tab === t.id ? "var(--bg-4)" : "transparent", color: tab === t.id ? "var(--text-1)" : "var(--text-3)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 분석 결과 */}
          {tab === "result" && ran && !loading && result && (
            <FeedbackResult result={result} collapsed={collapsed} setCollapsed={setCollapsed}
              onRerun={runFeedback} onApprove={approveSuggestion}
              onReject={rejectSuggestion} applying={applying} onTaskClick={onTaskClick} />
          )}

          {/* 이전 기록 */}
          {tab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {historyLoading ? (
                <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>불러오는 중…</p>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                  <p style={{ fontSize: 13, color: "var(--text-3)" }}>이전 분석 기록이 없습니다</p>
                </div>
              ) : history.map(h => {
                const modeLabel = h.mode === "personal" ? "👤 내 업무" : h.mode === "team" ? "🏢 팀 전체" : `📁 ${h.project?.name ?? "프로젝트"}`;
                const risk = h.result?.overall_risk;
                const riskColor = risk === "high" ? "#DC2626" : risk === "medium" ? "#D97706" : "#16A34A";
                return (
                  <div key={h.id} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{modeLabel}</span>
                        {risk && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: `${riskColor}12`, color: riskColor, border: `1px solid ${riskColor}30`, fontWeight: 600 }}>
                            {risk === "high" ? "고위험" : risk === "medium" ? "주의" : "양호"}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                          {new Date(h.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {h.result?.summary && (
                        <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.result.summary}</p>
                      )}
                    </div>
                    <button onClick={() => loadHistoryItem(h)}
                      style={{ padding: "5px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 11, color: "var(--text-2)", cursor: "pointer", flexShrink: 0 }}>
                      불러오기
                    </button>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

// ─── 결과 표시 컴포넌트 ───
function FeedbackResult({ result, collapsed, setCollapsed, onRerun, onApprove, onReject, applying, onTaskClick }: any) {
  if (result?.error) return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>분석 실패: {result.error}</p>
      <button onClick={onRerun} style={{ fontSize: 11, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer" }}>다시 시도</button>
    </div>
  );
  if (!result) return null;

  const hConfig = result.project_health ? HEALTH_LABEL[result.project_health] : null;
  const riskColor = result.overall_risk === "high" ? "#DC2626" : result.overall_risk === "medium" ? "#D97706" : "#16A34A";

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {/* 헤더 */}
      <button onClick={() => setCollapsed(!collapsed)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", borderBottom: collapsed ? "none" : "1px solid var(--border)", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED" }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>✦ AI 피드백</p>
          {result.overall_risk && (
            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, background: `${riskColor}12`, color: riskColor, border: `1px solid ${riskColor}30`, fontWeight: 600 }}>
              {result.overall_risk === "high" ? "고위험" : result.overall_risk === "medium" ? "주의" : "양호"}
            </span>
          )}
          {hConfig && (
            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, background: `${hConfig.color}12`, color: hConfig.color, border: `1px solid ${hConfig.color}30`, fontWeight: 600 }}>
              {hConfig.label}
            </span>
          )}
          {result.summary && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{result.summary}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onRerun(); }}
            style={{ fontSize: 11, padding: "3px 10px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-3)", cursor: "pointer" }}>
            재분석
          </button>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* AI 제안 */}
          {result.suggestions?.length > 0 && (
            <div style={{ background: "#EEF3FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#2563EB", marginBottom: 10 }}>
                💡 AI 제안 ({result.suggestions.length}건) — 승인하면 자동 적용
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.suggestions.map((s: any, i: number) => (
                  <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", margin: "0 0 3px" }}>{s.task_title}</p>
                      <p style={{ fontSize: 11, color: "var(--text-2)", margin: "0 0 3px" }}>
                        {s.type === "assignee" ? "담당자" : s.type === "deadline" ? "마감일" : s.type === "priority" ? "우선순위" : "상태"}{": "}
                        <span style={{ color: "var(--text-3)", textDecoration: "line-through" }}>{s.current_value ?? "없음"}</span>
                        {" → "}
                        <span style={{ color: "#2563EB", fontWeight: 600 }}>{s.suggested_value}</span>
                      </p>
                      {s.reason && <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{s.reason}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => onApprove(s, i)} disabled={applying === i}
                        style={{ fontSize: 11, padding: "4px 10px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, color: "#16A34A", fontWeight: 600, cursor: "pointer", opacity: applying === i ? 0.4 : 1 }}>
                        {applying === i ? "…" : "✓ 승인"}
                      </button>
                      <button onClick={() => onReject(s, i)}
                        style={{ fontSize: 11, padding: "4px 10px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, color: "#DC2626", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 피드백 아이템 */}
          {(result.items ?? []).map((item: any, i: number) => {
            const cfg = LEVEL_CONFIG[item.level] ?? LEVEL_CONFIG.info;
            return (
              <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: "0 0 4px" }}>{item.title}</p>
                    <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 4px" }}>{item.detail}</p>
                    {item.action && (
                      <p style={{ fontSize: 11, color: "var(--text-3)", background: "rgba(0,0,0,0.04)", padding: "5px 10px", borderRadius: 6, margin: 0 }}>
                        → {item.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hConfig && (
            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right", margin: 0 }}>
              AI가 프로젝트 상태를 <span style={{ color: hConfig.color, fontWeight: 600 }}>{hConfig.label}</span>으로 업데이트했습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
