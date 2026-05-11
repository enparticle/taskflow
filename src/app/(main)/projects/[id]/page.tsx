// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import { loadTasksWithAssignees } from "@/lib/tasks";
import ProjectForm from "@/components/projects/ProjectForm";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";
import { calcAndUpdateHealth } from "@/lib/health";
import BurndownChart from "@/components/dashboard/BurndownChart";
import { getAuthUser, getProjectRole, canEditProject, canManageMilestone, canManageProjectMembers } from "@/lib/auth";
import MilestonePanel from "@/components/milestones/MilestonePanel";
import ProjectMemberPanel from "@/components/team/ProjectMemberPanel";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  backlog: { label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.15)" },
  todo:    { label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  doing:   { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  blocked: { label: "Blocked", color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  review:  { label: "리뷰",    color: "#F5A623", bg: "rgba(245,166,35,0.15)" },
  done:    { label: "완료",    color: "#00D4A0", bg: "rgba(0,212,160,0.15)" },
};
const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good: { label: "정상", color: "#00D4A0" },
  at_risk: { label: "주의", color: "#F5A623" },
  critical: { label: "위험", color: "#FF4D6A" },
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--bg-4)" }}>
      <div className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(value, 100)}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

type Tab = "overview" | "milestones" | "tasks" | "grouped" | "kanban" | "members";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [project, setProject] = useState<any>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [sysRole, setSysRole] = useState<string>("member");
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; status: string } | null>(null);
  const [blockedReason, setBlockedReason] = useState("");
  const dragTask = { current: null as any };

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name)").eq("id", id).single();
    setProject(p);

    // 권한 확인
    const authUser = await getAuthUser();
    if (authUser) {
      setSysRole(authUser.role);
      const projRole = await getProjectRole(id, authUser.userId);
      setMyRole(projRole);
    }
    const { data: ms } = await supabase.from("milestones")
      .select("*").eq("project_id", id).order("sort_order");
    setMilestones(ms ?? []);

    const q = supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .eq("project_id", id).order("created_at", { ascending: true });
    const { data: t } = await loadTasksWithAssignees(q);
    const ORDER: Record<string, number> = { doing: 0, todo: 1, backlog: 2, blocked: 3, review: 4, done: 5 };
    const sorted = (t ?? []).sort((a: any, b: any) => {
      const oa = ORDER[a.status] ?? 9;
      const ob = ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    setTasks(sorted);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!project) return <div className="flex items-center justify-center h-64"><p style={{ color: "var(--text-3)" }}>불러오는 중…</p></div>;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const doing = tasks.filter(t => t.status === "doing").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const health = HEALTH_CONFIG[project.health] ?? HEALTH_CONFIG.good;

  async function moveTask(taskId: string, newStatus: string, reason?: string) {
    await supabase.from("tasks").update({ status: newStatus, blocked_reason: newStatus === "blocked" ? (reason ?? null) : null }).eq("id", taskId);
    await load();
  }

  const canManageMiles = canManageMilestone(sysRole, myRole);
  const canManageMembers = canManageProjectMembers(sysRole, myRole);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "개요" },
    ...(canManageMiles ? [{ id: "milestones" as Tab, label: "계획" }] : []),
    { id: "tasks",      label: `업무 (${total})` },
    { id: "grouped",    label: "계획별 업무" },
    { id: "kanban",     label: "칸반" },
    ...(canManageMembers ? [{ id: "members" as Tab, label: "팀 구성" }] : []),
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 헤더 */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{ background: `${health.color}18`, color: health.color }}>{health.label}</span>
              <span className="text-xs" style={{ color: "var(--text-3)" }}>담당 · {project.owner?.name ?? "미정"}</span>
              {project.end_date && (
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  마감 · {new Date(project.end_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-1)" }}>{project.name}</h1>
            {project.description && <p className="text-sm" style={{ color: "var(--text-2)" }}>{project.description}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            {canEditProject(sysRole, myRole) && (
              <button onClick={() => setOpenEdit(true)} className="rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>수정</button>
            )}
            <button onClick={() => setOpenForm(true)} className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(0,194,204,0.2)" }}>
              + 새 업무
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "var(--text-3)" }}>전체 진행률</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: health.color }}>{completionRate}%</span>
          </div>
          <ProgressBar value={completionRate} color={health.color} />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "전체",    value: total,   color: "#7BA7C8" },
            { label: "진행 중", value: doing,   color: "#2E86FF" },
            { label: "Blocked", value: blocked, color: "#FF4D6A" },
            { label: "완료",    value: done,    color: "#00D4A0" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
              style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}>
              <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
            style={{
              background: tab === t.id ? "var(--bg-4)" : "transparent",
              color: tab === t.id ? "var(--text-1)" : "var(--text-3)",
              border: tab === t.id ? "1px solid var(--border-2)" : "1px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 개요 */}
      {tab === "overview" && (
        <div className="space-y-3">
        <PlanningFeedback mode="project" projectId={id} projectName={project?.name} onTaskClick={(tid) => setOpenDetail(tid)} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>상태별 업무</p>
            <div className="space-y-2.5">
              {STATUS_LIST.map(s => {
                const cnt = tasks.filter(t => t.status === s).length;
                const cfg = STATUS_CONFIG[s];
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-xs" style={{ color: "var(--text-2)" }}>{cfg.label}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: cfg.color }}>{cnt}</span>
                    </div>
                    <ProgressBar value={total > 0 ? (cnt / total) * 100 : 0} color={cfg.color} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>번다운 차트</p>
            <BurndownChart projectId={id} startDate={project?.start_date} endDate={project?.end_date} />
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>최근 업무</p>
            <div className="space-y-1.5">
              {tasks.slice(-6).reverse().map(t => {
                const cfg = STATUS_CONFIG[t.status];
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                    onClick={() => setOpenDetail(t.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                    <span className="flex-1 text-xs truncate" style={{ color: "var(--text-1)" }}>{t.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                );
              })}
              {tasks.length === 0 && <p className="text-xs text-center py-6" style={{ color: "var(--text-3)" }}>업무 없음</p>}
            </div>
          </div>
          </div>
        </div>
        </div>
      )}

      {/* 계획 (마일스톤) */}
      {tab === "milestones" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "var(--cyan)" }} />
            <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>프로젝트 계획</p>
          </div>
          <MilestonePanel projectId={id} />
        </div>
      )}

      {/* 업무 목록 */}
      {tab === "tasks" && <TaskList tasks={tasks} onRefresh={load} />}

      {/* 계획별 업무 */}
      {tab === "grouped" && (
        <div className="space-y-4">
          {/* 미분류 업무 */}
          {(() => {
            const unclassified = tasks.filter(t => !t.milestone_id);
            if (unclassified.length === 0) return null;
            return (
              <div className="rounded-2xl" style={{ border: "1px solid var(--border)", overflow: "visible" }}>
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--text-3)" }} />
                  <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>미분류</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>{unclassified.length}</span>
                </div>
                <div className="p-2" style={{ overflow: "visible" }}>
                  <TaskList tasks={unclassified} onRefresh={load} />
                </div>
              </div>
            );
          })()}

          {/* 마일스톤별 그룹 */}
          {milestones.map(m => {
            const mTasks = tasks.filter(t => t.milestone_id === m.id);
            if (mTasks.length === 0) return null;
            const MS_STATUS: Record<string, { color: string; label: string }> = {
              planned:     { color: "#7BA7C8", label: "계획" },
              in_progress: { color: "#2E86FF", label: "진행 중" },
              completed:   { color: "#00D4A0", label: "완료" },
              cancelled:   { color: "#4A7099", label: "취소" },
            };
            const cfg = MS_STATUS[m.status] ?? MS_STATUS.planned;
            const doneCnt = mTasks.filter(t => t.status === "done").length;
            const pct = Math.round((doneCnt / mTasks.length) * 100);
            return (
              <div key={m.id} className="rounded-2xl" style={{ border: `1px solid ${cfg.color}33`, overflow: "visible" }}>
                <div className="px-4 py-3" style={{ background: `${cfg.color}08`, borderBottom: `1px solid ${cfg.color}22` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{m.title}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-md"
                      style={{ background: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
                    {m.due_date && (
                      <span className="text-xs ml-1" style={{ color: "var(--text-3)" }}>
                        ~ {new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                      style={{ background: `${cfg.color}18`, color: cfg.color }}>
                      {doneCnt}/{mTasks.length} · {pct}%
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-4)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                </div>
                <div className="p-2" style={{ background: "var(--bg-2)", overflow: "visible" }}>
                  <TaskList tasks={mTasks} onRefresh={load} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 칸반 */}
      {tab === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
          {STATUS_LIST.map(status => {
            const cfg = STATUS_CONFIG[status];
            const colTasks = tasks.filter(t => t.status === status);
            const isOver = dragOver === status;
            return (
              <div key={status} className="flex flex-col rounded-2xl shrink-0 transition-all"
                style={{ width: "220px", minHeight: "400px", background: isOver ? cfg.bg : "var(--bg-2)", border: `1px solid ${isOver ? cfg.color + "66" : "var(--border)"}` }}
                onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(null); setDragging(null);
                  const dt = dragTask.current;
                  if (!dt || dt.status === status) return;
                  if (status === "blocked") { setPendingDrop({ taskId: dt.id, status }); setShowBlockedModal(true); return; }
                  moveTask(dt.id, status); dragTask.current = null;
                }}>
                <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full"
                    style={{ background: `${cfg.color}18`, color: cfg.color }}>{colTasks.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} draggable
                      onDragStart={e => { dragTask.current = task; setDragging(task.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => setOpenDetail(task.id)}
                      className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all select-none"
                      style={{ background: "var(--bg-3)", borderTop: `2px solid ${cfg.color}`, border: "1px solid var(--border)", opacity: dragging === task.id ? 0.4 : 1 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
                      <p className="text-xs font-semibold mb-2 leading-snug" style={{ color: "var(--text-1)" }}>{task.title}</p>
                      {task.blocked_reason && (
                        <p className="text-xs mb-1.5 px-2 py-1 rounded-lg truncate" style={{ background: "var(--red-bg)", color: "var(--red)" }}>{task.blocked_reason}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>{task.priority}</span>
                        {task.assignee && (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                            style={{ background: "var(--cyan-bg)", color: "var(--cyan)", fontSize: 10 }}>{task.assignee.name[0]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-xl py-8 text-center" style={{ border: `1px dashed ${cfg.color}33` }}>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>없음</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 팀 구성 */}
      {tab === "members" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full" style={{ background: "var(--blue)" }} />
            <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>프로젝트 팀 구성</p>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>· 한 구성원이 여러 프로젝트에 중복 배정 가능</span>
          </div>
          <ProjectMemberPanel projectId={id} />
        </div>
      )}

      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-80 rounded-2xl p-5 shadow-2xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-1)" }}>Blocked 사유 입력</h3>
            <textarea value={blockedReason} onChange={e => setBlockedReason(e.target.value)}
              placeholder="왜 막혔는지 입력하세요" rows={3} autoFocus
              className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none mb-3"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (pendingDrop && blockedReason.trim()) {
                  await moveTask(pendingDrop.taskId, "blocked", blockedReason);
                  setShowBlockedModal(false); setPendingDrop(null); setBlockedReason(""); dragTask.current = null;
                }
              }} disabled={!blockedReason.trim()} className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-30"
                style={{ background: "#FF4D6A", color: "#fff" }}>확인</button>
              <button onClick={() => { setShowBlockedModal(false); setPendingDrop(null); setBlockedReason(""); dragTask.current = null; }}
                className="flex-1 rounded-xl py-2 text-sm" style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onCreated={() => { load(); setOpenForm(false); }} defaultProjectId={id} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
      {openEdit && <ProjectForm project={project} onClose={() => setOpenEdit(false)} onSaved={() => { load(); setOpenEdit(false); }} />}
    </div>
  );
}
