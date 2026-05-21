// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import ProjectForm from "@/components/projects/ProjectForm";
import MilestonePanel from "@/components/milestones/MilestonePanel";
import ProjectMemberPanel from "@/components/team/ProjectMemberPanel";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  backlog: { label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.15)" },
  todo:    { label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  doing:   { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  review:  { label: "리뷰",    color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  done:    { label: "완료",    color: "#34d399", bg: "rgba(52,211,153,0.15)" },
};
const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",     color: "#fbbf24" },
  critical:  { label: "위험",     color: "#f87171" },
  suspended: { label: "중단",     color: "#71717a" },
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

type Tab = "overview" | "milestones" | "tasks" | "members";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [sysRole, setSysRole] = useState<string>("member");
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; status: string } | null>(null);
  const [blockedReason, setBlockedReason] = useState("");

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name)").eq("id", id).single();
    setProject(p);

    // 권한 확인
    const { getAuthUser, getProjectRole } = await import("@/lib/auth");
    const authUser = await getAuthUser();
    if (authUser) {
      setSysRole(authUser.role);
      const projRole = await getProjectRole(id, authUser.userId);
      setMyRole(projRole);
    }

    const { data: t } = await supabase.from("tasks")
      .select("*, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .eq("project_id", id).order("created_at", { ascending: true });
    setTasks(t ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!project) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: "var(--text-3)" }}>불러오는 중…</p>
    </div>
  );

  const canManage = sysRole === "admin" || myRole === "leader";
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "개요" },
    ...(canManage ? [{ id: "milestones" as Tab, label: "계획" }] : []),
    { id: "tasks",      label: `업무 (${total})` },
    { id: "members",    label: "팀 구성" },
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
            {canManage && (
              <button onClick={() => setOpenEdit(true)} className="rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>수정</button>
            )}
            {canManage && (
              <button onClick={() => setOpenForm(true)} className="rounded-lg px-4 py-2 text-xs font-semibold"
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

      {/* 개요 */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* AI 피드백 */}
          <PlanningFeedback
            mode="project"
            projectId={id}
            projectName={project?.name}
            onTaskClick={(tid) => setOpenDetail(tid)}
          />

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
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-2)" }}>최근 업무</p>
              <div className="space-y-1.5">
                {tasks.slice(-6).reverse().map(t => {
                  const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.todo;
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
                  setShowBlockedModal(false); setPendingDrop(null); setBlockedReason("");
                }
              }} disabled={!blockedReason.trim()} className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-30"
                style={{ background: "#f87171", color: "#fff" }}>확인</button>
              <button onClick={() => { setShowBlockedModal(false); setPendingDrop(null); setBlockedReason(""); }}
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
