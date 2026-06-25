// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail from "@/components/tasks/TaskDetail";
import ProjectForm from "@/components/projects/ProjectForm";
import ProjectMemberPanel from "@/components/team/ProjectMemberPanel";
import MilestonePanel from "@/components/milestones/MilestonePanel";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";
import TaskDraftPanel from "@/components/tasks/TaskDraftPanel";
import { getAuthUser, getProjectRole } from "@/lib/auth";

const STATUS_CONFIG = {
  backlog: { label: "백로그",  color: "#A8A8A4", bg: "rgba(168,168,164,0.12)" },
  todo:    { label: "할 일",   color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  doing:   { label: "진행 중", color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  blocked: { label: "Blocked", color: "#DC2626", bg: "rgba(220,38,38,0.10)" },
  review:  { label: "리뷰",    color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  done:    { label: "완료",    color: "#16A34A", bg: "rgba(22,163,74,0.10)" },
};
const HEALTH_CONFIG = {
  good:      { label: "정상",  color: "#16A34A" },
  reviewing: { label: "검토",  color: "#2563EB" },
  at_risk:   { label: "주의",  color: "#D97706" },
  critical:  { label: "위험",  color: "#DC2626" },
  suspended: { label: "중단",  color: "#A8A8A4" },
};
const MS_STATUS = {
  planned:     { label: "계획",    color: "#A8A8A4" },
  in_progress: { label: "진행 중", color: "#2563EB" },
  completed:   { label: "완료",    color: "#16A34A" },
  cancelled:   { label: "취소",    color: "#D97706" },
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value,100)}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
}

function MilestoneStatusBadge({ milestone, canManage, onUpdate }: any) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<any>(null);
  const btnRef = useRef<any>(null);
  const mc = MS_STATUS[milestone.status] ?? MS_STATUS.planned;

  async function changeStatus(status: string) {
    await supabase.from("milestones").update({ status }).eq("id", milestone.id);
    setOpen(false); setMenuPos(null); onUpdate();
  }

  if (!canManage) return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: `${mc.color}12`, color: mc.color, border: `1px solid ${mc.color}33` }}>{mc.label}</span>
  );

  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={() => {
        if (!open && btnRef.current) {
          const rect = btnRef.current.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 4, left: rect.left });
        }
        setOpen(v => !v);
      }}
        style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, cursor: "pointer", background: `${mc.color}12`, color: mc.color, border: `1px solid ${mc.color}33` }}>
        {mc.label} ▾
      </button>
      {open && menuPos && (
        <div style={{ position: "fixed", zIndex: 9999, width: 120, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", top: menuPos.top, left: menuPos.left }}>
          {Object.entries(MS_STATUS).map(([k, v]: any) => (
            <button key={k} onClick={() => changeStatus(k)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", fontSize: 12, border: "none", cursor: "pointer", background: milestone.status === k ? `${v.color}12` : "transparent", color: milestone.status === k ? v.color : "var(--text-2)" }}
              onMouseEnter={e => { if (milestone.status !== k) (e.currentTarget as any).style.background = "var(--bg-3)"; }}
              onMouseLeave={e => { if (milestone.status !== k) (e.currentTarget as any).style.background = "transparent"; }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
              {v.label}
            </button>
          ))}
          <button onClick={() => { setOpen(false); setMenuPos(null); }}
            style={{ width: "100%", padding: "6px 12px", fontSize: 11, textAlign: "center", border: "none", borderTop: "1px solid var(--border)", color: "var(--text-3)", background: "transparent", cursor: "pointer" }}>
            닫기
          </button>
        </div>
      )}
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
  const [openMilestone, setOpenMilestone] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);

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
    const { data: allProj } = await supabase.from("projects").select("id, name").eq("status", "active");
    setAllProjects(allProj ?? []);
    const { data: ms } = await supabase.from("milestones")
      .select("*").eq("project_id", id).neq("status", "cancelled").order("sort_order");
    setMilestones(ms ?? []);
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <p style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</p>
    </div>
  );

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const doing = tasks.filter(t => t.status === "doing").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const health = HEALTH_CONFIG[project.health] ?? HEALTH_CONFIG.good;
  const canManage = sysRole === "admin" || myRole === "leader";
  const now = new Date();
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / 86400000) : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "tasks",    label: `업무 (${total})` },
    ...(canManage ? [{ id: "members" as Tab, label: "팀" }] : []),
  ];

  const tasksByMs = milestones.map(m => ({
    milestone: m,
    tasks: tasks.filter(t => t.milestone_id === m.id),
  }));
  const unclassified = tasks.filter(t => !t.milestone_id);

  function toggleMs(msId: string) {
    setExpandedMs(prev => ({ ...prev, [msId]: !prev[msId] }));
  }

  return (
    <div style={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 프로젝트 헤더 */}
      <div style={{ background: "var(--bg-2)", border: `1px solid ${health.color}33`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600, background: `${health.color}12`, color: health.color, border: `1px solid ${health.color}33` }}>{health.label}</span>
              {project.owner?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>담당 · {project.owner.name}</span>}
              {project.end_date && (
                <span style={{ fontSize: 11, color: daysLeft !== null && daysLeft < 0 ? "#DC2626" : "var(--text-3)" }}>
                  마감 · {new Date(project.end_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  {daysLeft !== null && (
                    <span style={{ marginLeft: 4, fontWeight: 600, color: daysLeft < 0 ? "#DC2626" : daysLeft <= 7 ? "#D97706" : "var(--text-3)" }}>
                      ({daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : `D-${daysLeft}`})
                    </span>
                  )}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", margin: "0 0 6px" }}>{project.name}</h1>
            {project.description && <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{project.description}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {canManage && (
              <button onClick={() => setOpenEdit(true)}
                style={{ padding: "7px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                수정
              </button>
            )}
            {canManage && (
              <button onClick={() => setOpenForm(true)}
                style={{ padding: "7px 14px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                + 업무 추가
              </button>
            )}
          </div>
        </div>

        {/* 업무 통계 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}>
          {[
            { label: "전체",    value: total,   color: "#A8A8A4" },
            { label: "진행 중", value: doing,   color: "#2563EB" },
            { label: "Blocked", value: blocked, color: "#DC2626" },
            { label: "완료",    value: done,    color: "#16A34A" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "12px 8px", background: `${s.color}08`, border: `1px solid ${s.color}22`, borderRadius: 10 }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* 전체 진행률 */}
        {total > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>전체 완료율</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: completionRate === 100 ? "#16A34A" : "var(--text-2)" }}>{completionRate}%</span>
            </div>
            <ProgressBar value={completionRate} color={completionRate === 100 ? "#16A34A" : health.color} />
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: tab === t.id ? "var(--bg-4)" : "transparent",
              color: tab === t.id ? "var(--text-1)" : "var(--text-3)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 개요 탭 */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {canManage && <TaskDraftPanel projectId={id} onApproved={load} />}
          <PlanningFeedback mode="project" projectId={id} projectName={project?.name} onTaskClick={(tid) => setOpenDetail(tid)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* 상태별 업무 */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 14 }}>상태별 업무</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {STATUS_LIST.map(s => {
                  const cnt = tasks.filter(t => t.status === s).length;
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <div key={s}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                          <span style={{ fontSize: 12, color: "var(--text-2)" }}>{cfg.label}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cnt}</span>
                      </div>
                      <ProgressBar value={total > 0 ? (cnt / total) * 100 : 0} color={cfg.color} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 단계 */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>단계</p>
                {canManage && (
                  <button onClick={() => setOpenMilestone(true)}
                    style={{ fontSize: 11, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer" }}>
                    관리 →
                  </button>
                )}
              </div>
              {milestones.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>
                  단계가 없습니다
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {milestones.map((m: any) => {
                    const mTasks = tasks.filter(t => t.milestone_id === m.id);
                    const mDone = mTasks.filter(t => t.status === "done").length;
                    const mRate = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
                    const mc = MS_STATUS[m.status] ?? MS_STATUS.planned;
                    return (
                      <div key={m.id} style={{ padding: "10px 12px", background: "var(--bg-3)", border: `1px solid ${mc.color}22`, borderRadius: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: mc.color, flexShrink: 0 }} />
                          <p style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-1)", margin: 0 }}>{m.title}</p>
                          <MilestoneStatusBadge milestone={m} canManage={canManage} onUpdate={load} />
                          <span style={{ fontSize: 11, color: mc.color, fontWeight: 600 }}>{mRate}%</span>
                        </div>
                        <ProgressBar value={mRate} color={mc.color} />
                        {m.due_date && (
                          <p style={{ fontSize: 11, color: "var(--text-3)", margin: "5px 0 0" }}>
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

      {/* 업무 탭 */}
      {tab === "tasks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canManage && <TaskDraftPanel projectId={id} onApproved={load} />}
          {canManage && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>단계별로 업무를 관리하세요</p>
              <button onClick={() => setOpenMilestone(true)}
                style={{ fontSize: 12, padding: "5px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--cyan)", cursor: "pointer" }}>
                + 단계 관리
              </button>
            </div>
          )}

          {/* 단계별 그룹 */}
          {tasksByMs.map(({ milestone: m, tasks: mTasks }) => {
            const mc = MS_STATUS[m.status] ?? MS_STATUS.planned;
            const mDone = mTasks.filter(t => t.status === "done").length;
            const mRate = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
            const isExpanded = expandedMs[m.id] !== false;
            return (
              <div key={m.id} style={{ border: `1px solid ${mc.color}33`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer",
                  background: `${mc.color}06`,
                  borderBottom: isExpanded ? `1px solid ${mc.color}22` : "none",
                }}
                  onClick={() => toggleMs(m.id)}>
                  <span style={{ fontSize: 12, color: mc.color }}>{isExpanded ? "▾" : "▸"}</span>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: mc.color, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-1)", margin: 0 }}>{m.title}</p>
                  {m.due_date && <span style={{ fontSize: 11, color: "var(--text-3)" }}>~ {new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>}
                  <MilestoneStatusBadge milestone={m} canManage={canManage} onUpdate={load} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: mc.color }}>{mDone}/{mTasks.length} · {mRate}%</span>
                </div>
                {isExpanded && (
                  <div style={{ padding: 12, background: "var(--bg-2)" }}>
                    {mTasks.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>이 단계에 업무가 없습니다</p>
                    ) : (
                      <TaskList tasks={mTasks} onRefresh={load} onTaskClick={msId => setOpenDetail(msId)} milestones={milestones} projects={allProjects} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 미분류 */}
          {(unclassified.length > 0 || milestones.length === 0) && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer",
                background: "var(--bg-3)", borderBottom: expandedMs["__unclassified__"] ? "1px solid var(--border)" : "none",
              }}
                onClick={() => toggleMs("__unclassified__")}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{expandedMs["__unclassified__"] ? "▾" : "▸"}</span>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-3)", flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-2)", margin: 0 }}>
                  {milestones.length === 0 ? "전체 업무" : "미분류"}
                </p>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{unclassified.length}건</span>
              </div>
              {expandedMs["__unclassified__"] && (
                <div style={{ padding: 12, background: "var(--bg-2)" }}>
                  {unclassified.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>미분류 업무 없음</p>
                  ) : (
                    <TaskList tasks={unclassified} onRefresh={load} onTaskClick={msId => setOpenDetail(msId)} milestones={milestones} projects={allProjects} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 팀 탭 */}
      {tab === "members" && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 16 }}>프로젝트 팀 구성</p>
          <ProjectMemberPanel projectId={id} />
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onCreated={() => { load(); setOpenForm(false); }} defaultProjectId={id} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
      {openEdit && <ProjectForm project={project} onClose={() => setOpenEdit(false)} onSaved={() => { load(); setOpenEdit(false); }} />}

      {openMilestone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}
          onClick={() => { setOpenMilestone(false); load(); }}>
          <div style={{ width: "100%", maxWidth: 640, maxHeight: "80vh", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>단계 관리</h2>
              <button onClick={() => { setOpenMilestone(false); load(); }}
                style={{ fontSize: 18, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <MilestonePanel projectId={id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
