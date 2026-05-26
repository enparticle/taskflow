// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import ProjectForm from "@/components/projects/ProjectForm";
import ProjectMemberPanel from "@/components/team/ProjectMemberPanel";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";
import { getAuthUser, getProjectRole } from "@/lib/auth";

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
const MS_STATUS: Record<string, { label: string; color: string }> = {
  planned:     { label: "계획",    color: "#71717a" },
  in_progress: { label: "진행 중", color: "#60a5fa" },
  completed:   { label: "완료",    color: "#34d399" },
  cancelled:   { label: "취소",    color: "#4A7099" },
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
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [sysRole, setSysRole] = useState<string>("member");
  const [expandedMs, setExpandedMs] = useState<Record<string, boolean>>({});

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
      .select("*").eq("project_id", id).neq("status", "cancelled").order("sort_order");
    setMilestones(ms ?? []);

    // 마일스톤 기본 펼침
    const exp: Record<string, boolean> = {};
    (ms ?? []).forEach((m: any) => { exp[m.id] = true; });
    exp["__unclassified__"] = true;
    setExpandedMs(exp);

    const { data: t } = await supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .eq("project_id", id).order("created_at", { ascending: true });
    setTasks(t ?? []);
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
  const canManage = sysRole === "admin" || myRole === "leader";

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "tasks",    label: `업무 (${total})` },
    ...(canManage ? [{ id: "members" as Tab, label: "팀" }] : []),
  ];

  // 마일스톤별 업무 그룹핑
  const tasksByMs = milestones.map(m => ({
    milestone: m,
    tasks: tasks.filter(t => t.milestone_id === m.id),
  }));
  const unclassified = tasks.filter(t => !t.milestone_id);

  function toggleMs(id: string) {
    setExpandedMs(prev => ({ ...prev, [id]: !prev[id] }));
  }

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

      {/* 개요 탭 */}
      {tab === "overview" && (
        <div className="space-y-4">
          <PlanningFeedback mode="project" projectId={id} projectName={project?.name}
            onTaskClick={(tid) => setOpenDetail(tid)} />

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

            {/* 단계(마일스톤) 현황 */}
            <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>단계</p>
                {canManage && (
                  <button onClick={() => setTab("tasks")}
                    className="text-xs" style={{ color: "var(--cyan)" }}>관리 →</button>
                )}
              </div>
              {milestones.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-3)" }}>
                  단계가 없습니다
                  {canManage && <><br /><span style={{ color: "var(--cyan)" }}>업무 탭에서 추가하세요</span></>}
                </p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((m: any) => {
                    const mTasks = tasks.filter(t => t.milestone_id === m.id);
                    const mDone = mTasks.filter(t => t.status === "done").length;
                    const mRate = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
                    const mc = MS_STATUS[m.status] ?? MS_STATUS.planned;
                    return (
                      <div key={m.id} className="rounded-xl px-3 py-2.5"
                        style={{ background: "var(--bg-3)", border: `1px solid ${mc.color}22` }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mc.color }} />
                          <p className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-1)" }}>{m.title}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{ background: `${mc.color}18`, color: mc.color }}>{mc.label}</span>
                          <span className="text-xs shrink-0" style={{ color: mc.color }}>{mRate}%</span>
                        </div>
                        <ProgressBar value={mRate} color={mc.color} />
                        {m.due_date && (
                          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                            ~ {new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 업무 탭 - 마일스톤별 그룹핑 */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {/* 마일스톤 관리 버튼 (Admin/Leader만) */}
          {canManage && (
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                단계별로 업무를 구성하세요
              </p>
              <button onClick={() => setOpenEdit(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-2)", color: "var(--cyan)", border: "1px solid var(--border)" }}>
                ⚙ 단계 관리
              </button>
            </div>
          )}

          {/* 마일스톤별 그룹 */}
          {tasksByMs.map(({ milestone: m, tasks: mTasks }) => {
            const mc = MS_STATUS[m.status] ?? MS_STATUS.planned;
            const mDone = mTasks.filter(t => t.status === "done").length;
            const mRate = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
            const isExpanded = expandedMs[m.id] !== false;
            return (
              <div key={m.id} className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${mc.color}33` }}>
                {/* 마일스톤 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ background: `${mc.color}08`, borderBottom: isExpanded ? `1px solid ${mc.color}22` : "none" }}
                  onClick={() => toggleMs(m.id)}>
                  <span style={{ color: mc.color, fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: mc.color }} />
                  <p className="text-sm font-semibold flex-1" style={{ color: "var(--text-1)" }}>{m.title}</p>
                  {m.due_date && (
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      ~ {new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${mc.color}18`, color: mc.color }}>{mc.label}</span>
                  <span className="text-xs font-semibold" style={{ color: mc.color }}>
                    {mDone}/{mTasks.length} · {mRate}%
                  </span>
                </div>
                {isExpanded && (
                  <div className="p-3" style={{ background: "var(--bg-2)" }}>
                    {mTasks.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>이 단계에 업무가 없습니다</p>
                    ) : (
                      <TaskList tasks={mTasks} onRefresh={load} onTaskClick={id => setOpenDetail(id)} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 미분류 업무 */}
          {(unclassified.length > 0 || milestones.length === 0) && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{ background: "var(--bg-3)", borderBottom: expandedMs["__unclassified__"] ? "1px solid var(--border)" : "none" }}
                onClick={() => toggleMs("__unclassified__")}>
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>{expandedMs["__unclassified__"] ? "▾" : "▸"}</span>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--text-3)" }} />
                <p className="text-sm font-semibold flex-1" style={{ color: "var(--text-2)" }}>
                  {milestones.length === 0 ? "전체 업무" : "미분류"}
                </p>
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{unclassified.length}건</span>
              </div>
              {expandedMs["__unclassified__"] && (
                <div className="p-3" style={{ background: "var(--bg-2)" }}>
                  {unclassified.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>미분류 업무 없음</p>
                  ) : (
                    <TaskList tasks={unclassified} onRefresh={load} onTaskClick={id => setOpenDetail(id)} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
