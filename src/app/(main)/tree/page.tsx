// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import TaskDetail from "@/components/tasks/TaskDetail";

const STATUS_COLOR: Record<string, string> = {
  backlog: "#4A7099", todo: "#7BA7C8", doing: "#2E86FF",
  blocked: "#f87171", review: "#fbbf24", done: "#34d399",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};
const HEALTH_COLOR: Record<string, string> = {
  good: "#34d399", reviewing: "#60a5fa", at_risk: "#fbbf24", critical: "#f87171", suspended: "#71717a",
};

function getUserColor(userId: string): string {
  const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9","#4ade80","#f43f5e","#818cf8","#2dd4bf"];
  if (!userId) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) { hash = ((hash << 5) - hash) + userId.charCodeAt(i); hash |= 0; }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function TreePage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [view, setView] = useState<"tree" | "gantt">("tree");

  const load = useCallback(async () => {
    const [{ data: p }, { data: m }, { data: t }, { data: u }, { data: d }] = await Promise.all([
      supabase.from("projects").select("*").eq("status", "active").order("created_at"),
      supabase.from("milestones").select("*").order("sort_order"),
      supabase.from("tasks").select("*, assignees:users!inner(id,name)").neq("status", "done").order("created_at"),
      supabase.from("users").select("id, name").eq("is_active", true),
      supabase.from("task_dependencies").select("task_id, depends_on_id, depends_on:tasks!task_dependencies_depends_on_id_fkey(status)"),
    ]);
    // tasks without inner join for all
    const { data: allTasks } = await supabase.from("tasks")
      .select("*, assignee:users!tasks_assignee_id_fkey(name), project:projects(name)")
      .order("created_at");

    setProjects(p ?? []);
    setMilestones(m ?? []);
    setTasks(allTasks ?? []);
    setUsers(u ?? []);
    setDeps(d ?? []);

    const pe: Record<string, boolean> = {};
    (p ?? []).forEach((proj: any) => { pe[proj.id] = true; });
    setExpandedProjects(pe);

    const me: Record<string, boolean> = {};
    (m ?? []).forEach((ms: any) => { me[ms.id] = true; });
    setExpandedMilestones(me);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredTasks = (projectId: string, milestoneId: string | null) => {
    return tasks.filter(t =>
      t.project_id === projectId &&
      t.milestone_id === (milestoneId ?? null) &&
      (filterStatus === "all" || t.status === filterStatus)
    );
  };

  const unclassifiedTasks = (projectId: string) =>
    tasks.filter(t => t.project_id === projectId && !t.milestone_id && (filterStatus === "all" || t.status === filterStatus));

  return (
    <div className="max-w-5xl space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#a78bfa" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>업무 트리</h1>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>프로젝트 → 마일스톤 → 업무</span>
        </div>
        {/* 보기 전환 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          {([["tree","🌳 트리"],["gantt","📊 간트"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setView(v as any)}
              className="rounded-lg px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: view === v ? "var(--bg-4)" : "transparent",
                color: view === v ? "var(--text-1)" : "var(--text-3)",
              }}>{l}</button>
          ))}
        </div>
        {/* 상태 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          {["all", "doing", "todo", "review", "blocked", "done", "backlog"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background: filterStatus === s ? `${s === "all" ? "#a78bfa" : STATUS_COLOR[s]}22` : "var(--bg-2)",
                color: filterStatus === s ? (s === "all" ? "#a78bfa" : STATUS_COLOR[s]) : "var(--text-3)",
                border: `1px solid ${filterStatus === s ? (s === "all" ? "#a78bfa" : STATUS_COLOR[s]) : "var(--border)"}`,
              }}>
              {s === "all" ? "전체" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 트리 */}
      {view === "tree" && projects.map(proj => {
        const projMs = milestones.filter(m => m.project_id === proj.id);
        const hc = HEALTH_COLOR[proj.health] ?? "#71717a";
        const isExpanded = expandedProjects[proj.id] !== false;
        const projTasks = tasks.filter(t => t.project_id === proj.id && (filterStatus === "all" || t.status === filterStatus));

        return (
          <div key={proj.id} className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${hc}33` }}>
            {/* 프로젝트 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{ background: `${hc}08`, borderBottom: isExpanded ? `1px solid ${hc}22` : "none" }}
              onClick={() => setExpandedProjects(p => ({ ...p, [proj.id]: !p[proj.id] }))}>
              <span style={{ color: hc, fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: hc }} />
              <a href={`/projects/${proj.id}`} onClick={e => e.stopPropagation()}
                className="text-sm font-bold hover:underline" style={{ color: "var(--text-1)" }}>
                {proj.name}
              </a>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${hc}18`, color: hc }}>
                {["good","reviewing","at_risk","critical","suspended"].includes(proj.health)
                  ? { good:"정상", reviewing:"검토 필요", at_risk:"주의", critical:"위험", suspended:"중단" }[proj.health]
                  : proj.health}
              </span>
              <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
                업무 {projTasks.length}건
              </span>
            </div>

            {isExpanded && (
              <div className="px-2 py-2 space-y-1.5" style={{ background: "var(--bg-2)" }}>
                {/* 마일스톤별 */}
                {projMs.map(ms => {
                  const msTasks = filteredTasks(proj.id, ms.id);
                  const msExpanded = expandedMilestones[ms.id] !== false;
                  const MS_COLOR: Record<string, string> = { planned: "#71717a", in_progress: "#60a5fa", completed: "#34d399" };
                  const mc = MS_COLOR[ms.status] ?? "#71717a";
                  const doneCount = tasks.filter(t => t.project_id === proj.id && t.milestone_id === ms.id && t.status === "done").length;
                  const totalCount = tasks.filter(t => t.project_id === proj.id && t.milestone_id === ms.id).length;

                  return (
                    <div key={ms.id} className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${mc}22` }}>
                      <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                        style={{ background: `${mc}08` }}
                        onClick={() => setExpandedMilestones(m => ({ ...m, [ms.id]: !m[ms.id] }))}>
                        <span style={{ color: mc, fontSize: 11 }}>{msExpanded ? "▾" : "▸"}</span>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mc }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{ms.title}</span>
                        {ms.due_date && (
                          <span className="text-xs" style={{ color: "var(--text-3)" }}>
                            ~ {new Date(ms.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <span className="text-xs ml-auto" style={{ color: mc }}>
                          {doneCount}/{totalCount}
                        </span>
                      </div>
                      {msExpanded && (
                        <div className="px-2 py-1.5 space-y-1" style={{ background: "var(--bg-2)" }}>
                          {msTasks.length === 0 ? (
                            <p className="text-xs px-3 py-2" style={{ color: "var(--text-3)" }}>업무 없음</p>
                          ) : msTasks.map(task => (
                            <TaskRow key={task.id} task={task} onClick={() => setOpenDetail(task.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 미분류 업무 */}
                {unclassifiedTasks(proj.id).length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: "var(--bg-3)" }}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--text-3)" }} />
                      <span className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>미분류</span>
                      <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>{unclassifiedTasks(proj.id).length}건</span>
                    </div>
                    <div className="px-2 py-1.5 space-y-1" style={{ background: "var(--bg-2)" }}>
                      {unclassifiedTasks(proj.id).map(task => (
                        <TaskRow key={task.id} task={task} onClick={() => setOpenDetail(task.id)} />
                      ))}
                    </div>
                  </div>
                )}

                {projMs.length === 0 && unclassifiedTasks(proj.id).length === 0 && (
                  <p className="text-xs px-3 py-2" style={{ color: "var(--text-3)" }}>업무 없음</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {view === "gantt" && (
        <GanttView projects={projects} milestones={milestones} tasks={tasks} deps={deps}
          filterStatus={filterStatus} onOpen={(id: string) => setOpenDetail(id)} />
      )}

      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
    </div>
  );
}

function TaskRow({ task, onClick }: { task: any; onClick: () => void }) {
  const sc = STATUS_COLOR[task.status] ?? "#7BA7C8";
  const sl = STATUS_LABEL[task.status] ?? task.status;
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
  const assignees = task.assignees && task.assignees.length > 0 ? task.assignees : task.assignee ? [task.assignee] : [];

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer transition-all"
      style={{ borderLeft: `2px solid ${sc}`, background: "var(--bg-3)" }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-4)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}>
      <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
        style={{ background: `${sc}18`, color: sc }}>{sl}</span>
      <span className="flex-1 text-xs truncate" style={{ color: task.status === "done" ? "var(--text-3)" : "var(--text-1)", textDecoration: task.status === "done" ? "line-through" : "none" }}>
        {task.title}
      </span>
      {assignees.slice(0, 3).map((u: any, i: number) => {
        const color = getUserColor(u.id ?? u.name ?? String(i));
        return (
          <span key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: `${color}22`, color, border: `1px solid var(--bg-2)`, marginLeft: i > 0 ? -4 : 0, fontSize: 9 }}
            title={u.name}>
            {u.name?.[0]}
          </span>
        );
      })}
      {task.due_date && (
        <span className="text-xs shrink-0 tabular-nums"
          style={{ color: overdue ? "#f87171" : "var(--text-3)" }}>
          {overdue ? "⚠ " : ""}{new Date(task.due_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

function GanttView({ projects, milestones, tasks, deps, filterStatus, onOpen }: {
  projects: any[]; milestones: any[]; tasks: any[]; deps: any[]; filterStatus: string; onOpen: (id: string) => void;
}) {
  const DAY_W = 28; // 하루당 픽셀
  const visibleTasks = tasks.filter(t => filterStatus === "all" || t.status === filterStatus);

  if (visibleTasks.length === 0) {
    return (
      <div className="rounded-2xl py-16 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>표시할 업무가 없어요</p>
      </div>
    );
  }

  // 전체 날짜 범위 계산: 생성일(시작 근사치) ~ 마감일. 마감일 없으면 생성일+1일.
  const starts = visibleTasks.map(t => new Date(t.created_at));
  const ends = visibleTasks.map(t => t.due_date ? new Date(t.due_date) : new Date(new Date(t.created_at).getTime() + 86400000));
  let minDate = new Date(Math.min(...starts.map(d => d.getTime())));
  let maxDate = new Date(Math.max(...ends.map(d => d.getTime())));
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 5);
  minDate.setHours(0, 0, 0, 0);
  const totalDays = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000), 7);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOffset = Math.floor((today.getTime() - minDate.getTime()) / 86400000);

  function dayOffset(d: Date) { return Math.floor((d.getTime() - minDate.getTime()) / 86400000); }

  // 선행 업무가 안 끝난 업무 id 집합 (의존성 경고 표시용)
  const blockedByDeps = new Set(
    deps.filter(d => d.depends_on?.status && d.depends_on.status !== "done").map(d => d.task_id)
  );

  // 월/주 단위 눈금 라벨 (일주일마다)
  const weekMarks: { offset: number; label: string }[] = [];
  for (let i = 0; i <= totalDays; i += 7) {
    const d = new Date(minDate); d.setDate(d.getDate() + i);
    weekMarks.push({ offset: i, label: d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) });
  }

  // 프로젝트 → 마일스톤 → 업무로 행 구성
  const rows: { type: "project" | "milestone" | "task"; label?: string; task?: any; color?: string }[] = [];
  projects.forEach(proj => {
    const projTasks = visibleTasks.filter(t => t.project_id === proj.id);
    if (projTasks.length === 0) return;
    rows.push({ type: "project", label: proj.name, color: HEALTH_COLOR[proj.health] ?? "#71717a" });
    const projMs = milestones.filter(m => m.project_id === proj.id);
    projMs.forEach(ms => {
      const msTasks = projTasks.filter(t => t.milestone_id === ms.id);
      if (msTasks.length === 0) return;
      rows.push({ type: "milestone", label: ms.title });
      msTasks.forEach(t => rows.push({ type: "task", task: t }));
    });
    const unclassified = projTasks.filter(t => !t.milestone_id);
    unclassified.forEach(t => rows.push({ type: "task", task: t }));
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: totalDays * DAY_W + 220 }}>
          {/* 날짜 눈금 헤더 */}
          <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 2, background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 220, flexShrink: 0, padding: "8px 12px", fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>업무</div>
            <div style={{ position: "relative", height: 32, flex: 1 }}>
              {weekMarks.map((w, i) => (
                <div key={i} style={{ position: "absolute", left: w.offset * DAY_W, top: 0, bottom: 0, borderLeft: "1px solid var(--border)", paddingLeft: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{w.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 행들 */}
          {rows.map((row, i) => {
            if (row.type === "project") {
              return (
                <div key={`p${i}`} style={{ display: "flex", background: `${row.color}10`, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 220, flexShrink: 0, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: row.color }}>⬡ {row.label}</div>
                  <div style={{ flex: 1 }} />
                </div>
              );
            }
            if (row.type === "milestone") {
              return (
                <div key={`m${i}`} style={{ display: "flex", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 220, flexShrink: 0, padding: "5px 12px 5px 22px", fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>◆ {row.label}</div>
                  <div style={{ flex: 1 }} />
                </div>
              );
            }
            const t = row.task;
            const sc = STATUS_COLOR[t.status] ?? "#7BA7C8";
            const start = dayOffset(new Date(t.created_at));
            const end = t.due_date ? dayOffset(new Date(t.due_date)) : start + 1;
            const barLeft = Math.max(start, 0) * DAY_W;
            const barWidth = Math.max((end - Math.max(start, 0)) * DAY_W, DAY_W * 0.6);
            const isBlocked = blockedByDeps.has(t.id);
            const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date();
            return (
              <div key={t.id} style={{ display: "flex", borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                <div style={{ width: 220, flexShrink: 0, padding: "7px 12px 7px 32px", fontSize: 11, color: t.status === "done" ? "var(--text-3)" : "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                  onClick={() => onOpen(t.id)}>
                  {isBlocked && <span title="선행 업무 미완료" style={{ marginRight: 4 }}>⛓</span>}
                  {t.title}
                </div>
                <div style={{ position: "relative", flex: 1, height: 28 }}>
                  {/* 오늘 라인 */}
                  {todayOffset >= 0 && todayOffset <= totalDays && (
                    <div style={{ position: "absolute", left: todayOffset * DAY_W, top: 0, bottom: 0, width: 1, background: "#a78bfa", opacity: 0.5, zIndex: 1 }} />
                  )}
                  <div onClick={() => onOpen(t.id)}
                    title={`${t.title} · ${STATUS_LABEL[t.status] ?? t.status}${t.due_date ? " · " + new Date(t.due_date).toLocaleDateString("ko-KR") : ""}`}
                    style={{
                      position: "absolute", left: barLeft, top: 5, height: 18, width: barWidth,
                      background: `${sc}30`, border: `1.5px solid ${overdue ? "#f87171" : sc}`, borderRadius: 5,
                      cursor: "pointer", display: "flex", alignItems: "center", overflow: "hidden",
                    }}>
                    <div style={{ height: "100%", width: t.status === "done" ? "100%" : "0%", background: sc, opacity: 0.5 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-3)" }}>
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>막대: 등록일~마감일(근사) · <span style={{ color: "#a78bfa" }}>│</span> 오늘 · ⛓ 선행 업무 미완료</span>
      </div>
    </div>
  );
}
