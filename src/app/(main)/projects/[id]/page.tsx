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
import ProjectMemberPanel from "@/components/team/ProjectMemberPanel";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  backlog: { label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.15)" },
  todo:    { label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  doing:   { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(255,77,106,0.15)" },
  review:  { label: "리뷰",    color: "#fbbf24", bg: "rgba(245,166,35,0.15)" },
  done:    { label: "완료",    color: "#34d399", bg: "rgba(0,212,160,0.15)" },
};
const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",      color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",      color: "#fbbf24" },
  critical:  { label: "위험",      color: "#f87171" },
  suspended: { label: "중단",      color: "#71717a" },
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

type Tab = "overview" | "tasks" | "members";

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

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name)").eq("id", id).single();
    setProject(p);

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
      const oa = ORDER[a.status] ?? 9, ob = ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    setTasks(sorted);

    calcAndUpdateHealth(supabase, id).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!project) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: "var(--text-3)" }}>불러오는 중…</p>
    </div>
  );

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const doing = tasks.filter(t => t.status === "doing").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const health = HEALTH_CONFIG[project.health] ?? HEALTH_CONFIG.good;

  const canManageMembers = canManageProjectMembers(sysRole, myRole);
  const canEdit = canEditProject(sysRole, myRole);
  // Admin만 전체 수정 가능, Leader/Member는 자신의 프로젝트 멤버일 때만 업무 추가
  const canAddTask = sysRole === "admin" || myRole === "leader" || myRole === "member";

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "tasks",    label: `업무 (${total})` },
    ...(canManageMembers ? [{ id: "members" as Tab, label: "팀" }] : []),
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
            {canEdit && (
              <button onClick={() => setOpenEdit(true)}
                className="rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>
                수정
              </button>
            )}
            {canAddTask && (
              <button onClick={() => setOpenForm(true)}
                className="rounded-lg px-4 py-2 text-xs font-semibold"
                style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
                + 새 업무
              </button>
            )}
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
            { label: "Blocked", value: blocked, color: "#f87171" },
            { label: "완료",    value: done,    color: "#34d399" },
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

      {/* 개요 탭 */}
      {tab === "overview" && (
        <div className="space-y-4">
          <PlanningFeedback mode="project" projectId={id} projectName={project?.name} onTaskClick={(tid) => setOpenDetail(tid)} />

          {/* 마일스톤 현황 */}
          {milestones.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>마일스톤</p>
              <div className="space-y-2">
                {milestones.map((m: any) => {
                  const MS_COLOR: Record<string, string> = { planned: "#71717a", in_progress: "#60a5fa", completed: "#34d399", cancelled: "#4A7099" };
                  const MS_LABEL: Record<string, string> = { planned: "계획", in_progress: "진행 중", completed: "완료", cancelled: "취소" };
                  const mc = MS_COLOR[m.status] ?? "#71717a";
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{ background: "var(--bg-3)", border: `1px solid ${mc}22` }}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: mc }} />
                      <p className="flex-1 text-sm" style={{ color: m.status === "completed" ? "var(--text-3)" : "var(--text-1)", textDecoration: m.status === "completed" ? "line-through" : "none" }}>
                        {m.title}
                      </p>
                      {m.due_date && (
                        <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
                          {new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ background: `${mc}18`, color: mc }}>{MS_LABEL[m.status] ?? m.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 상태별 업무 */}
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
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cnt}</span>
                      </div>
                      <ProgressBar value={total > 0 ? (cnt / total) * 100 : 0} color={cfg.color} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 번다운 차트 */}
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>번다운 차트</p>
                <BurndownChart projectId={id} startDate={project?.start_date} endDate={project?.end_date} />
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>최근 업무</p>
                <div className="space-y-1.5">
                  {tasks.slice(-5).reverse().map(t => {
                    const cfg = STATUS_CONFIG[t.status];
                    return (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer"
                        style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                        onClick={() => setOpenDetail(t.id)}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                        <span className="flex-1 text-xs truncate" style={{ color: "var(--text-1)" }}>{t.title}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>업무 없음</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 업무 탭 */}
      {tab === "tasks" && <TaskList tasks={tasks} onRefresh={load} />}

      {/* 팀 탭 */}
      {tab === "members" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-2)" }}>프로젝트 팀 구성</p>
          <ProjectMemberPanel projectId={id} />
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onCreated={() => { load(); setOpenForm(false); }} defaultProjectId={id} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
      {openEdit && <ProjectForm project={project} onClose={() => setOpenEdit(false)} onSaved={() => { load(); setOpenEdit(false); }} />}
    </div>
  );
}
