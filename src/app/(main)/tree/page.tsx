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
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    const [{ data: p }, { data: m }, { data: t }, { data: u }] = await Promise.all([
      supabase.from("projects").select("*").eq("status", "active").order("created_at"),
      supabase.from("milestones").select("*").order("sort_order"),
      supabase.from("tasks").select("*, assignees:users!inner(id,name)").neq("status", "done").order("created_at"),
      supabase.from("users").select("id, name").eq("is_active", true),
    ]);
    // tasks without inner join for all
    const { data: allTasks } = await supabase.from("tasks")
      .select("*, assignee:users!tasks_assignee_id_fkey(name), project:projects(name)")
      .order("created_at");

    setProjects(p ?? []);
    setMilestones(m ?? []);
    setTasks(allTasks ?? []);
    setUsers(u ?? []);

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
      {projects.map(proj => {
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
