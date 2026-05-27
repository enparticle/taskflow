// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { calcAllProjectsHealth } from "@/lib/health";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";
import GanttChart from "@/components/dashboard/GanttChart";

const HEALTH: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",     color: "#fbbf24" },
  critical:  { label: "위험",     color: "#f87171" },
  suspended: { label: "중단",     color: "#71717a" },
};

function MiniProgress({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: "var(--bg-4)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
    </div>
  );
}


export default function DashboardPage() {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [memberStats, setMemberStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const now = new Date();

  const greet = () => {
    const h = now.getHours();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "안녕하세요";
    return "수고하셨어요";
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: me } = await supabase.from("users").select("*").eq("auth_id", user.id).single();
    setMyUser(me);

    // 프로젝트 health 자동 계산
    calcAllProjectsHealth(supabase).catch(() => {});

    const isAdmin = me?.role === "admin";
    const isAdminOrLeader = me?.role === "admin" || me?.role === "leader";
    const isViewer = me?.role === "viewer";

    // 프로젝트 로드 - Admin만 전체, 나머지는 내가 속한 프로젝트만
    let projQuery = supabase.from("projects").select("*, milestones(id, title, status, due_date), tasks(id, status)").eq("status", "active").order("created_at");

    if (!isAdmin && !isViewer) {
      // leader/member/reviewer는 내가 속한 프로젝트만
      const { data: myProjs } = await supabase.from("project_members").select("project_id").eq("user_id", me?.id);
      const ids = (myProjs ?? []).map((p: any) => p.project_id);
      if (ids.length > 0) projQuery = projQuery.in("id", ids);
      else { setProjects([]); setLoading(false); return; }
    }

    const { data: projData } = await projQuery;
    setProjects(projData ?? []);

    // 내 업무 (viewer 제외)
    if (!isViewer && me) {
      const { data: tasks } = await supabase.from("tasks")
        .select("*, project:projects(name)")
        .or(`assignee_id.eq.${me.id},assignee_ids.cs.{${me.id}}`)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10);
      setMyTasks(tasks ?? []);
    }

    // 팀원 업무량 (admin/leader만)
    if (isAdminOrLeader) {
      const { data: usersRaw } = await supabase.from("users").select("*").eq("is_active", true).neq("role", "viewer");
      const { data: allTasks } = await supabase.from("tasks").select("id, status, assignee_id, assignee_ids").neq("status", "done");
      const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9"];
      const stats = (usersRaw ?? []).map((u: any, i: number) => ({
        id: u.id, name: u.name, color: COLORS[i % COLORS.length],
        doing: (allTasks ?? []).filter((t: any) => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status === "doing").length,
        total: (allTasks ?? []).filter((t: any) => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id))).length,
      })).filter(u => u.total > 0).sort((a, b) => b.total - a.total);
      setMemberStats(stats);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p style={{ color: "var(--text-3)" }}>로딩 중…</p>
    </div>
  );

  const isAdmin = myUser?.role === "admin";
  const isAdminOrLeader = myUser?.role === "admin" || myUser?.role === "leader";
  const isViewer = myUser?.role === "viewer";

  // 긴급 업무 (마감 3일 이내 or blocked)
  const urgentTasks = myTasks.filter(t =>
    (t.due_date && (new Date(t.due_date).getTime() - now.getTime()) / 86400000 <= 3) || t.status === "blocked"
  );

  return (
    <div className="space-y-6 max-w-6xl">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--text-1)" }}>
            {greet()}{myUser?.name ? `, ${myUser.name}님` : ""}
          </h1>
        </div>
        {!isViewer && (
          <button onClick={() => setOpenForm(true)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, var(--cyan), #2E86FF)", color: "#fff" }}>
            + 새 업무
          </button>
        )}
      </div>

      {/* 긴급 업무 알림 (viewer 제외) */}
      {!isViewer && urgentTasks.length > 0 && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <p className="text-sm font-medium" style={{ color: "#f87171" }}>
            긴급 업무 {urgentTasks.length}건 —
          </p>
          <div className="flex gap-2 flex-wrap">
            {urgentTasks.slice(0, 3).map(t => (
              <button key={t.id} onClick={() => setOpenDetail(t.id)}
                className="text-xs px-2.5 py-1 rounded-lg transition-all"
                style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                {t.title}
                {t.due_date && ` (D${Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000)})`}
              </button>
            ))}
            {urgentTasks.length > 3 && <span className="text-xs" style={{ color: "var(--text-3)" }}>외 {urgentTasks.length - 3}건</span>}
          </div>
        </div>
      )}

      {/* 프로젝트 현황 - 메인 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>프로젝트 현황</h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>{projects.length}개</span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>진행 중인 프로젝트가 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {projects.map((p: any) => {
              const tasks = p.tasks ?? [];
              const total = tasks.length;
              const done = tasks.filter((t: any) => t.status === "done").length;
              const doing = tasks.filter((t: any) => t.status === "doing").length;
              const blocked = tasks.filter((t: any) => t.status === "blocked").length;
              const rate = total > 0 ? Math.round((done / total) * 100) : 0;
              const hc = HEALTH[p.health ?? "good"];
              const currentMilestone = (p.milestones ?? []).find((m: any) => m.status === "in_progress");
              const nextMilestone = (p.milestones ?? []).find((m: any) => m.status === "planned");
              const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / 86400000) : null;

              return (
                <a key={p.id} href={`/projects/${p.id}`}
                  className="block rounded-2xl overflow-hidden transition-all"
                  style={{ background: "var(--bg-2)", border: `1px solid ${hc.color}33` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = `${hc.color}66`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = `${hc.color}33`; }}>

                  {/* 프로젝트 헤더 */}
                  <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-1)" }}>{p.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                            style={{ background: `${hc.color}15`, color: hc.color }}>
                            {hc.label}
                          </span>
                        </div>
                        {/* 업무 현황 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {[
                            { label: "진행", value: doing, color: "#2E86FF" },
                            { label: "완료", value: done, color: "#34d399" },
                            { label: "전체", value: total, color: "var(--text-3)" },
                            ...(blocked > 0 ? [{ label: "Blocked", value: blocked, color: "#f87171" }] : []),
                          ].map((s, i) => (
                            <span key={i} className="text-xs" style={{ color: s.color }}>
                              {s.label} <span className="font-bold">{s.value}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* D-day */}
                      {daysLeft !== null && (
                        <div className="text-right shrink-0">
                          <p className="text-xs" style={{ color: "var(--text-3)" }}>마감</p>
                          <p className="text-sm font-bold" style={{ color: daysLeft < 0 ? "#f87171" : daysLeft <= 7 ? "#fbbf24" : "var(--text-2)" }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 업무 통계 */}
                    <div className="flex items-center gap-3">
                      {[
                        { label: "전체", value: total, color: "var(--text-3)" },
                        { label: "진행 중", value: doing, color: "#60a5fa" },
                        { label: "완료", value: done, color: "#34d399" },
                        ...(blocked > 0 ? [{ label: "Blocked", value: blocked, color: "#f87171" }] : []),
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                          <span className="text-xs font-semibold" style={{ color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 마일스톤 + 번다운 */}
                  <div className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {currentMilestone && (
                        <div className="mb-2">
                          <p className="text-xs mb-0.5" style={{ color: "var(--text-3)" }}>진행 중 마일스톤</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#60a5fa" }} />
                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-1)" }}>{currentMilestone.title}</p>
                            {currentMilestone.due_date && (
                              <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
                                ~{new Date(currentMilestone.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {nextMilestone && (
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: "var(--text-3)" }}>다음 마일스톤</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--border-2)" }} />
                            <p className="text-xs truncate" style={{ color: "var(--text-2)" }}>{nextMilestone.title}</p>
                          </div>
                        </div>
                      )}
                      {!currentMilestone && !nextMilestone && (
                        <p className="text-xs" style={{ color: "var(--text-3)" }}>마일스톤 없음</p>
                      )}
                    </div>


                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* 전체 일정 - 간트 차트 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full" style={{ background: "#fbbf24" }} />
          <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>전체 일정</h2>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>프로젝트 진행 위치 — ▸ 클릭 시 마일스톤 펼침</span>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <GanttChart />
        </div>
      </div>

      {/* 내 업무 요약 (viewer 제외) */}
      {!isViewer && myTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full" style={{ background: "#a78bfa" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>내 업무</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>{myTasks.length}건</span>
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 6).map(t => {
              const STATUS_COLOR: Record<string, string> = { doing: "#60a5fa", todo: "#a1a1aa", review: "#fbbf24", blocked: "#f87171", backlog: "#52525b" };
              const STATUS_LABEL: Record<string, string> = { doing: "진행 중", todo: "할 일", review: "리뷰", blocked: "Blocked", backlog: "백로그" };
              const sc = STATUS_COLOR[t.status] ?? "#a1a1aa";
              const daysLeft = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000) : null;

              return (
                <button key={t.id} onClick={() => setOpenDetail(t.id)}
                  className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sc }} />
                  <p className="flex-1 text-sm truncate" style={{ color: "var(--text-1)" }}>{t.title}</p>
                  {t.project?.name && <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>{t.project.name}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ background: `${sc}15`, color: sc }}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  {daysLeft !== null && (
                    <span className="text-xs shrink-0" style={{ color: daysLeft < 0 ? "#f87171" : daysLeft <= 3 ? "#fbbf24" : "var(--text-3)" }}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 팀원 업무량 + AI 피드백 (admin/leader만) */}
      {isAdminOrLeader && (
        <div className="grid grid-cols-2 gap-6">
          {/* 팀원 업무량 */}
          {memberStats.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full" style={{ background: "#fbbf24" }} />
                <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>팀원별 업무량</h2>
              </div>
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                {memberStats.map((m: any) => {
                  const maxTotal = Math.max(...memberStats.map(x => x.total), 1);
                  return (
                    <div key={m.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: `${m.color}22`, color: m.color }}>
                            {m.name?.[0]}
                          </div>
                          <span className="text-xs" style={{ color: "var(--text-2)" }}>{m.name}</span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>{m.total}건</span>
                      </div>
                      <div style={{ height: 5, background: "var(--bg-4)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(m.total / maxTotal) * 100}%`, background: m.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI 피드백 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: "#a78bfa" }} />
              <h2 className="text-base font-bold" style={{ color: "var(--text-1)" }}>AI 피드백</h2>
            </div>
            <PlanningFeedback mode="dashboard" />
          </div>
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onSaved={() => { load(); setOpenForm(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={load} />}
    </div>
  );
}
