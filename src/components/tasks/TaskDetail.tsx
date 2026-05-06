"use client";
import { useState, useEffect, useRef } from "react";
import { getAuthUser, getProjectRole, canDeleteTask } from "@/lib/auth";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import type { Task, User, Project, TaskStatus } from "@/types/database";

type T = Task & {
  assignee?: User | null;
  project?: Project | null;
  reviewer?: User | null;
};

const STATUS: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  backlog: { label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.15)" },
  todo:    { label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  doing:   { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  blocked: { label: "Blocked", color: "#FF4D6A", bg: "rgba(255,77,106,0.15)" },
  review:  { label: "리뷰",    color: "#F5A623", bg: "rgba(245,166,35,0.15)" },
  done:    { label: "완료",    color: "#00D4A0", bg: "rgba(0,212,160,0.15)" },
};
const PRIORITY: Record<string, { label: string; color: string }> = {
  low: { label: "낮음", color: "#4A7099" }, medium: { label: "보통", color: "#7BA7C8" },
  high: { label: "높음", color: "#F5A623" }, urgent: { label: "긴급", color: "#FF4D6A" },
};
const DIFFICULTY: Record<string, string> = { low: "낮음", medium: "보통", high: "높음", very_high: "매우 높음" };
const TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "회의",
  research: "리서치", customer: "고객 대응", other: "기타",
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"] as TaskStatus[];
const ASSIGNEE_COLORS = ["#00C2CC","#2E86FF","#F5A623","#00D4A0","#A78BFA","#FF4D6A"];

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDT(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props { taskId: string; onClose: () => void; onRefresh: () => void; }

export default function TaskDetail({ taskId, onClose, onRefresh }: Props) {
  const supabase = createClient();
  const [task, setTask] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showBlockedInput, setShowBlockedInput] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTask();
    supabase.from("users").select("*").eq("is_active", true).then(({ data }) => { if (data) setAllUsers(data as User[]); });
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => { if (data) setProjects(data as Project[]); });
  }, [taskId]);



  async function loadTask() {
    setLoading(true);
    const { data } = await supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(*), project:projects(*), reviewer:users!tasks_reviewer_id_fkey(*)")
      .eq("id", taskId).single();
    setTask(data);
    setAssigneeIds((data as any)?.assignee_ids ?? ((data as any)?.assignee_id ? [(data as any).assignee_id] : []));
    const { data: evs } = await supabase.from("task_events").select("*")
      .eq("task_id", taskId).order("changed_at", { ascending: false }).limit(10);
    setEvents(evs ?? []);

    // 권한 확인
    const authUser = await getAuthUser();
    if (authUser && data) {
      const projRole = (data as any).project_id
        ? await getProjectRole((data as any).project_id, authUser.userId)
        : null;
      const assigneeIds = (data as any).assignee_ids ?? [];
      const isAssignee = assigneeIds.includes(authUser.userId) || (data as any).assignee_id === authUser.userId;
      setCanDelete(canDeleteTask(authUser.role, projRole));
      // edit: admin, project leader/reviewer, 또는 담당자
      setCanEdit(
        authUser.role === "admin" ||
        projRole === "leader" ||
        projRole === "reviewer" ||
        isAssignee
      );
    }

    setLoading(false);
  }

  async function update(field: string, value: any) {
    await supabase.from("tasks").update({ [field]: value }).eq("id", taskId);
    await loadTask(); setEditing(null);
  }

  async function updateAssignees(ids: string[]) {
    await supabase.from("tasks").update({ assignee_ids: ids, assignee_id: ids[0] || null }).eq("id", taskId);
    setAssigneeIds(ids);
    // onRefresh 호출 제거 - 담당자 변경은 패널 내부 state만 업데이트
    // 패널 닫힐 때 부모가 refresh하므로 onClose 시 반영됨
  }

  function toggleAssignee(userId: string) {
    const next = assigneeIds.includes(userId)
      ? assigneeIds.filter(id => id !== userId)
      : [...assigneeIds, userId];
    updateAssignees(next);
  }

  async function changeStatus(newStatus: TaskStatus, reason?: string) {
    await supabase.from("tasks").update({
      status: newStatus as any,
      blocked_reason: newStatus === "blocked" ? (reason ?? null) : null,
    } as any).eq("id", taskId);
    await loadTask();
    setShowStatusMenu(false); setShowBlockedInput(false); setBlockedReason("");
  }

  if (loading || !task) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="h-full w-full max-w-xl flex items-center justify-center"
          style={{ background: "var(--bg-2)", borderLeft: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-3)" }}>불러오는 중…</p>
        </div>
      </div>
    );
  }

  const s = STATUS[task.status];
  const p = PRIORITY[task.priority];
  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
  const selectedUsers = allUsers.filter(u => assigneeIds.includes(u.id));

  const panel = (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <div ref={panelRef}
        className="h-full w-full max-w-xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-2)", borderLeft: "1px solid var(--border-2)" }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${s.color}` }}>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
              {TYPE_LABEL[task.task_type]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={async () => {
                if (!confirm("이 업무를 삭제할까요?")) return;
                await supabase.from("tasks").delete().eq("id", taskId);
                onRefresh();
              }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red)22" }}>
                삭제
              </button>
            )}
            <button onClick={onClose} className="text-lg" style={{ color: "var(--text-3)" }}>✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* 제목 */}
          <div>
            {editing === "title" ? (
              <div className="flex gap-2">
                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") update("title", editVal); if (e.key === "Escape") setEditing(null); }}
                  className="flex-1 rounded-lg px-3 py-2 text-base font-bold focus:outline-none"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                <button onClick={() => update("title", editVal)} className="rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>저장</button>
                <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>취소</button>
              </div>
            ) : (
              <h2 className={`text-lg font-bold ${canEdit ? "cursor-pointer hover:opacity-80" : ""}`}
                style={{ color: "var(--text-1)", textDecoration: task.status === "done" ? "line-through" : undefined }}
                onClick={() => { if (canEdit) { setEditing("title"); setEditVal(task.title); } }}>
                {task.title}
                {canEdit && <span className="text-xs ml-1" style={{ color: "var(--text-3)" }}>✎</span>}
              </h2>
            )}
          </div>

          {/* 설명 */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>설명</p>
            {editing === "description" ? (
              <div className="space-y-2">
                <textarea autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                <div className="flex gap-2">
                  <button onClick={() => update("description", editVal)} className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>저장</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>취소</button>
                </div>
              </div>
            ) : (
              <p className={`text-sm rounded-lg px-3 py-2 ${canEdit ? "cursor-pointer hover:opacity-80" : ""}`}
                style={{ color: task.description ? "var(--text-2)" : "var(--text-3)", background: "var(--bg-3)", border: "1px solid var(--border)" }}
                onClick={() => { if (canEdit) { setEditing("description"); setEditVal((task as any).description ?? ""); } }}>
                {(task as any).description || (canEdit ? "설명 없음 — 클릭해서 추가" : "설명 없음")}
              </p>
            )}
          </div>

          {/* 상태 */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>상태</p>
            {canEdit ? (
              <div className="relative inline-block">
                <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
                  {s.label} ▾
                </button>
                {showStatusMenu && !showBlockedInput && (
                  <div className="absolute left-0 top-10 z-10 w-36 rounded-xl overflow-hidden shadow-2xl"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                    {STATUS_LIST.map(sv => (
                      <button key={sv} onClick={() => sv === "blocked" ? setShowBlockedInput(true) : changeStatus(sv)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium"
                        style={{ background: sv === task.status ? STATUS[sv].bg : "transparent", color: sv === task.status ? STATUS[sv].color : "var(--text-2)" }}
                        onMouseEnter={e => { if (sv !== task.status) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
                        onMouseLeave={e => { if (sv !== task.status) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[sv].color }} />
                        {STATUS[sv].label}
                      </button>
                    ))}
                  </div>
                )}
                {showBlockedInput && (
                  <div className="absolute left-0 top-10 z-10 w-72 rounded-xl p-3 shadow-2xl"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                    <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-1)" }}>Blocked 사유 *</p>
                    <textarea value={blockedReason} onChange={e => setBlockedReason(e.target.value)}
                      placeholder="왜 막혔는지 입력하세요" rows={2} autoFocus
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                      style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => changeStatus("blocked", blockedReason)} disabled={!blockedReason.trim()}
                        className="flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-30"
                        style={{ background: "#FF4D6A", color: "#fff" }}>확인</button>
                      <button onClick={() => { setShowBlockedInput(false); setShowStatusMenu(false); }}
                        className="flex-1 rounded-lg py-1.5 text-xs"
                        style={{ background: "var(--bg-4)", color: "var(--text-2)" }}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold"
                style={{ background: s.bg, color: s.color }}>{s.label}</span>
            )}
            {(task as any).blocked_reason && (
              <p className="mt-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: "var(--red-bg)", color: "var(--red)", border: "1px solid #FF4D6A22" }}>
                사유: {(task as any).blocked_reason}
              </p>
            )}
          </div>

          {/* 담당자 다중 선택 */}
          <div ref={assigneeRef}>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>담당자</p>
            <button type="button"
              onClick={e => { e.stopPropagation(); setShowAssigneeMenu(v => !v); }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)", minHeight: 40 }}>
              {selectedUsers.length === 0 ? (
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>담당자 선택</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {selectedUsers.map((u, i) => (
                    <span key={u.id} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
                      style={{ background: `${ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length]}20`, color: ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length], border: `1px solid ${ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length]}33` }}>
                      {u.name}
                      <span onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                        className="cursor-pointer hover:opacity-60 ml-0.5" style={{ fontSize: 10 }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <span style={{ color: "var(--text-3)", marginLeft: "auto", fontSize: 10 }}>▾</span>
            </button>

            {showAssigneeMenu && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                {allUsers.map((u, i) => {
                  const selected = assigneeIds.includes(u.id);
                  const color = ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length];
                  return (
                    <button key={u.id} type="button"
                      onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-xs transition-colors"
                      style={{ background: selected ? `${color}15` : "transparent", color: selected ? color : "var(--text-2)" }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: selected ? color : "var(--bg-4)", color: selected ? "#0D1B2E" : "var(--text-2)" }}>
                        {u.name[0]}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{u.name}</p>
                        {(u as any).level && <p style={{ color: "var(--text-3)", fontSize: 10 }}>{(u as any).level}</p>}
                      </div>
                      {selected && <span style={{ color, fontSize: 12 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 메타 그리드 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>프로젝트</p>
              <select value={(task as any).project_id ?? ""} onChange={e => update("project_id", e.target.value || null)}
                className="w-full text-xs focus:outline-none" style={{ background: "transparent", color: "#E8F4FF", border: "none", colorScheme: "dark" }}>
                <option value="">없음</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>우선순위</p>
              <select value={task.priority} onChange={e => update("priority", e.target.value)}
                className="w-full text-xs font-semibold focus:outline-none" style={{ background: "transparent", color: p.color, border: "none", colorScheme: "dark" }}>
                {["low","medium","high","urgent"].map(v => <option key={v} value={v}>{PRIORITY[v].label}</option>)}
              </select>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>난이도</p>
              <select value={(task as any).difficulty ?? ""} onChange={e => update("difficulty", e.target.value || null)}
                className="w-full text-xs focus:outline-none" style={{ background: "transparent", color: "#E8F4FF", border: "none", colorScheme: "dark" }}>
                <option value="">미정</option>
                {["low","medium","high","very_high"].map(v => <option key={v} value={v}>{DIFFICULTY[v]}</option>)}
              </select>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>마감일</p>
              <input type="date" value={(task as any).due_date ? (task as any).due_date.split("T")[0] : ""}
                onChange={e => update("due_date", e.target.value || null)}
                className="w-full text-xs focus:outline-none"
                style={{ background: "transparent", color: isOverdue ? "var(--red)" : "var(--text-1)", border: "none" }} />
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>예상 시간</p>
              {editing === "estimated_hours" ? (
                <input autoFocus type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                  onBlur={() => update("estimated_hours", editVal ? Number(editVal) : null)}
                  onKeyDown={e => { if (e.key === "Enter") update("estimated_hours", editVal ? Number(editVal) : null); }}
                  min="0.5" step="0.5" className="w-full text-xs focus:outline-none"
                  style={{ background: "transparent", color: "#E8F4FF", border: "none", colorScheme: "dark" }} />
              ) : (
                <p className="text-xs cursor-pointer"
                  style={{ color: (task as any).estimated_hours ? "var(--text-1)" : "var(--text-3)" }}
                  onClick={() => { setEditing("estimated_hours"); setEditVal(String((task as any).estimated_hours ?? "")); }}>
                  {(task as any).estimated_hours ? `${(task as any).estimated_hours}시간` : "미정 — 클릭해서 입력"}
                </p>
              )}
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>실제 소요 시간</p>
              {editing === "actual_hours" ? (
                <input autoFocus type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                  onBlur={() => update("actual_hours", editVal ? Number(editVal) : null)}
                  onKeyDown={e => { if (e.key === "Enter") update("actual_hours", editVal ? Number(editVal) : null); }}
                  min="0.5" step="0.5" className="w-full text-xs focus:outline-none"
                  style={{ background: "transparent", color: "#E8F4FF", border: "none", colorScheme: "dark" }} />
              ) : (
                <p className="text-xs cursor-pointer"
                  style={{ color: (task as any).actual_hours ? "var(--text-1)" : "var(--text-3)" }}
                  onClick={() => { setEditing("actual_hours"); setEditVal(String((task as any).actual_hours ?? "")); }}>
                  {(task as any).actual_hours ? `${(task as any).actual_hours}시간` : "미정 — 클릭해서 입력"}
                </p>
              )}
            </div>
          </div>

          {/* 타임라인 */}
          <div className="rounded-xl p-4" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-3)" }}>타임라인</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "생성", value: fmtDT((task as any).created_at) },
                { label: "시작", value: fmtDT((task as any).started_at) },
                { label: "완료", value: fmtDT((task as any).completed_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>{label}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 변경 이력 */}
          {events.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-3)" }}>변경 이력</p>
              <div className="space-y-1.5">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: ev.to_status ? STATUS[ev.to_status as TaskStatus]?.color : "var(--text-3)" }} />
                    <p className="flex-1 text-xs" style={{ color: "var(--text-2)" }}>
                      {ev.from_status && ev.to_status
                        ? `${STATUS[ev.from_status as TaskStatus]?.label} → ${STATUS[ev.to_status as TaskStatus]?.label}`
                        : ev.event_type}
                      {ev.reason && <span style={{ color: "var(--text-3)" }}> · {ev.reason}</span>}
                    </p>
                    <p className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>{fmtDT(ev.changed_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return typeof window !== 'undefined' ? createPortal(panel, document.body) : null;
}
