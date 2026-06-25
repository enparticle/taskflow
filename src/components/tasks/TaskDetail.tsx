// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { getAuthUser, getProjectRole, canDeleteTask } from "@/lib/auth";
import { createPortal } from "react-dom";
import TaskComments from "@/components/tasks/TaskComments";
import TaskReviews from "@/components/tasks/TaskReviews";
import TaskDependencies from "@/components/tasks/TaskDependencies";
import MeetingPoll from "@/components/tasks/MeetingPoll";
import { createClient } from "@/lib/supabase";
import type { Task, User, Project } from "@/types/database";
type TaskStatus = string;

type T = Task & {
  assignee?: User | null;
  project?: Project | null;
  reviewer?: User | null;
};

const STATUS: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  backlog: { label: "백로그",  color: "#6B7280", bg: "rgba(107,114,128,0.10)" },
  todo:    { label: "할 일",   color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  doing:   { label: "진행 중", color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  blocked: { label: "Blocked", color: "#DC2626", bg: "rgba(220,38,38,0.10)" },
  review:  { label: "리뷰",    color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  done:    { label: "완료",    color: "#16A34A", bg: "rgba(22,163,74,0.10)" },
};
const PRIORITY: Record<string, { label: string; color: string }> = {
  low:    { label: "낮음", color: "#6B7280" },
  medium: { label: "보통", color: "#2563EB" },
  high:   { label: "높음", color: "#D97706" },
  urgent: { label: "긴급", color: "#DC2626" },
};
const DIFFICULTY: Record<string, string> = {
  low: "낮음", medium: "보통", high: "높음", very_high: "매우 높음",
};
const TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "미팅",
  research: "리서치", customer: "고객 대응", other: "기타",
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"] as TaskStatus[];

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "7px 10px",
  fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
};

function getUserColor(userId: string): string {
  const COLORS = ["#2563EB","#16A34A","#D97706","#DC2626","#7C3AED","#0891B2","#D946EF","#EA580C","#65A30D","#6B7280"];
  if (!userId) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) { hash = ((hash << 5) - hash) + userId.charCodeAt(i); hash |= 0; }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function fmtDT(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props { taskId: string; onClose: () => void; onRefresh: () => void; }

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", marginBottom: open ? 8 : 0, borderBottom: "1px solid var(--border)", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </div>
  );
}

export default function TaskDetail({ taskId, onClose, onRefresh }: Props) {
  const supabase = createClient();
  const [task, setTask] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [descVal, setDescVal] = useState("");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showBlockedInput, setShowBlockedInput] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canChangeStatus, setCanChangeStatus] = useState(false);
  const [myUser, setMyUser] = useState<any>(null);
  const [meetingNote, setMeetingNote] = useState<any>(null);
  const [meetingNotes, setMeetingNotes] = useState<any[]>([]);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [showOnCalendar, setShowOnCalendar] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  async function loadMeetingNotes() {
    const { data } = await supabase.from("meeting_drafts")
      .select("id, result, input_text, audio_path, updated_at, project_id")
      .order("updated_at", { ascending: false }).limit(20);
    setMeetingNotes(data ?? []);
  }

  useEffect(() => {
    if (!task) return;
    const noteId = (task as any).meeting_note_id;
    if (noteId) {
      supabase.from("meeting_drafts").select("*").eq("id", noteId).single()
        .then(({ data }) => setMeetingNote(data));
    } else { setMeetingNote(null); }
  }, [task]);

  async function linkMeetingNote(noteId: string | null) {
    await supabase.from("tasks").update({ meeting_note_id: noteId }).eq("id", (task as any).id);
    if (noteId) { const note = meetingNotes.find(n => n.id === noteId); setMeetingNote(note ?? null); }
    else { setMeetingNote(null); }
    setShowNotePicker(false); loadTask();
  }

  const isMeeting = (task as any)?.task_type === "meeting";

  useEffect(() => {
    loadTask();
    loadMeetingNotes();
    supabase.from("users").select("*").eq("is_active", true).neq("role", "viewer").then(({ data }) => { if (data) setAllUsers(data as User[]); });
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => { if (data) setProjects(data as Project[]); });
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    const { data } = await supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(*), project:projects(*), reviewer:users!tasks_reviewer_id_fkey(*), last_updated_user:users!tasks_last_updated_by_fkey(name)")
      .eq("id", taskId).single();

    if ((data as any)?.project_id) {
      const { data: ms } = await supabase.from("milestones").select("*")
        .eq("project_id", (data as any).project_id).neq("status", "cancelled").order("sort_order");
      setMilestones(ms ?? []);
    }

    const { data: evs } = await supabase.from("task_events")
      .select("*, changed_by_user:users!task_events_changed_by_fkey(name)")
      .eq("task_id", taskId).order("changed_at", { ascending: false }).limit(10);
    setEvents(evs ?? []);

    setTask(data);
    setAssigneeIds((data as any)?.assignee_ids ?? ((data as any)?.assignee_id ? [(data as any).assignee_id] : []));
    setShowOnCalendar((data as any)?.show_on_calendar ?? false);

    const authUser = await getAuthUser();
    if (authUser) {
      setMyUser(authUser);
      const projRole = (data as any)?.project_id
        ? await getProjectRole((data as any).project_id, authUser.userId) : null;
      const ids = (data as any)?.assignee_ids ?? [];
      const isAssignee = ids.includes(authUser.userId) || (data as any)?.assignee_id === authUser.userId;
      setCanDelete(canDeleteTask(authUser.role, projRole));
      setCanEdit(authUser.role === "admin" || projRole === "leader");
      setCanChangeStatus(authUser.role === "admin" || projRole === "leader" || isAssignee);
    }
    setLoading(false);
  }

  async function update(field: string, value: any) {
    const prev = (task as any)?.[field];
    await supabase.from("tasks").update({ [field]: value, last_updated_by: myUser?.userId ?? null }).eq("id", taskId);
    if (field === "due_date" && prev !== value && assigneeIds.length > 0) {
      const newDate = value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정";
      for (const uid of assigneeIds) {
        if (uid === myUser?.userId) continue;
        await supabase.from("notifications").insert({
          user_id: uid, type: "deadline",
          title: `마감일이 ${newDate}으로 변경됐습니다`,
          body: (task as any)?.title ?? "업무", task_id: taskId,
        });
      }
    }
    await loadTask(); setEditing(null);
  }

  async function toggleCalendar() {
    const newVal = !showOnCalendar;
    setShowOnCalendar(newVal);
    await supabase.from("tasks").update({ show_on_calendar: newVal }).eq("id", taskId);
  }

  async function updateAssignees(ids: string[]) {
    await supabase.from("tasks").update({ assignee_ids: ids, assignee_id: ids[0] || null, last_updated_by: myUser?.userId ?? null }).eq("id", taskId);
    setAssigneeIds(ids);
  }

  function toggleAssignee(userId: string) {
    const next = assigneeIds.includes(userId)
      ? assigneeIds.filter(id => id !== userId)
      : [...assigneeIds, userId];
    updateAssignees(next);
  }

  async function changeStatus(newStatus: TaskStatus, reason?: string) {
    await supabase.from("tasks").update({
      status: newStatus,
      blocked_reason: newStatus === "blocked" ? (reason ?? null) : null,
      last_updated_by: myUser?.userId ?? null,
    }).eq("id", taskId);
    await supabase.from("task_events").insert({
      task_id: taskId, event_type: "status_change",
      from_status: task?.status, to_status: newStatus,
      changed_by: myUser?.userId ?? null,
      reason: newStatus === "blocked" ? reason : null,
    });
    await loadTask();
    setShowStatusMenu(false); setShowBlockedInput(false); setBlockedReason("");
  }

  if (loading || !task) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ height: "100%", width: "100%", maxWidth: 560, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-2)", borderLeft: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</p>
        </div>
      </div>
    );
  }

  const s = STATUS[task.status] ?? { label: task.status, color: "#6B7280", bg: "rgba(107,114,128,0.10)" };
  const p = PRIORITY[task.priority] ?? { label: task.priority, color: "#6B7280" };
  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
  const selectedUsers = allUsers.filter(u => assigneeIds.includes(u.id));

  const EVENT_LABEL: Record<string, (ev: any) => string> = {
    status_change: ev => `상태: ${STATUS[ev.from_status]?.label ?? ev.from_status} → ${STATUS[ev.to_status]?.label ?? ev.to_status}`,
    type_change: ev => `유형 변경`,
    assignee_change: ev => "담당자 변경",
  };

  const panel = (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.25)" }}
      onClick={onClose}>
      <div ref={panelRef}
        style={{ height: "100%", width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-2)", borderLeft: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
              {TYPE_LABEL[(task as any).task_type] ?? (task as any).task_type}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {canDelete && (
              <button onClick={async () => {
                if (!confirm("이 업무를 삭제할까요?")) return;
                await supabase.from("tasks").delete().eq("id", taskId);
                onRefresh();
              }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 7, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", cursor: "pointer" }}>
                삭제
              </button>
            )}
            <button onClick={onClose} style={{ fontSize: 18, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 제목 */}
          <div>
            {editing === "title" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") update("title", editVal); if (e.key === "Escape") setEditing(null); }}
                  style={{ ...FS, flex: 1, fontSize: 16, fontWeight: 700 }} />
                <button onClick={() => update("title", editVal)} style={{ padding: "6px 14px", background: "var(--cyan)", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>저장</button>
                <button onClick={() => setEditing(null)} style={{ padding: "6px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>취소</button>
              </div>
            ) : (
              <h2 onClick={() => { if (canEdit) { setEditing("title"); setEditVal(task.title); } }}
                style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0, cursor: canEdit ? "pointer" : "default", textDecoration: task.status === "done" ? "line-through" : undefined }}>
                {task.title}
                {canEdit && <span style={{ fontSize: 12, marginLeft: 6, color: "var(--text-3)" }}>✎</span>}
              </h2>
            )}
            {(task as any).last_updated_user?.name && (
              <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                최종 수정: <span style={{ color: "var(--text-2)" }}>{(task as any).last_updated_user.name}</span>
              </p>
            )}
          </div>

          {/* 설명 */}
          <Section title="설명">
            {editing === "description" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea autoFocus value={descVal} onChange={e => setDescVal(e.target.value)} rows={4}
                  style={{ ...FS, resize: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => update("description", descVal)} style={{ padding: "6px 14px", background: "var(--cyan)", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>저장</button>
                  <button onClick={() => setEditing(null)} style={{ padding: "6px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>취소</button>
                </div>
              </div>
            ) : (
              <p onClick={() => { if (canEdit) { setEditing("description"); setDescVal((task as any).description ?? ""); } }}
                style={{ fontSize: 13, color: (task as any).description ? "var(--text-2)" : "var(--text-3)", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", cursor: canEdit ? "pointer" : "default", margin: 0 }}>
                {(task as any).description || (canEdit ? "설명 없음 — 클릭해서 입력" : "설명 없음")}
              </p>
            )}
          </Section>

          {/* 미팅 완료 버튼 */}
          {isMeeting && task.status !== "done" && canChangeStatus && (
            <button onClick={() => changeStatus("done" as any)}
              style={{ width: "100%", padding: "10px 0", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#16A34A", cursor: "pointer" }}>
              ✓ 미팅 완료 처리
            </button>
          )}

          {/* 상태 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>상태</p>
            {canChangeStatus ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                  style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
                  {s.label} ▾
                </button>
                {showStatusMenu && !showBlockedInput && (
                  <div style={{ position: "absolute", left: 0, top: 40, zIndex: 10, width: 140, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    {STATUS_LIST.map(sv => (
                      <button key={sv} onClick={() => sv === "blocked" ? setShowBlockedInput(true) : changeStatus(sv)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: sv === task.status ? STATUS[sv]?.bg : "transparent", color: sv === task.status ? STATUS[sv]?.color : "var(--text-2)" }}
                        onMouseEnter={e => { if (sv !== task.status) (e.currentTarget as any).style.background = "var(--bg-3)"; }}
                        onMouseLeave={e => { if (sv !== task.status) (e.currentTarget as any).style.background = "transparent"; }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS[sv]?.color, flexShrink: 0 }} />
                        {STATUS[sv]?.label}
                      </button>
                    ))}
                  </div>
                )}
                {showBlockedInput && (
                  <div style={{ position: "absolute", left: 0, top: 40, zIndex: 10, width: 280, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>Blocked 사유 *</p>
                    <textarea value={blockedReason} onChange={e => setBlockedReason(e.target.value)}
                      placeholder="왜 막혔는지 입력해주세요" rows={2} autoFocus
                      style={{ ...FS, resize: "none", fontSize: 12, borderColor: "#FCA5A5" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => changeStatus("blocked", blockedReason)} disabled={!blockedReason.trim()}
                        style={{ flex: 1, padding: "6px 0", background: "#DC2626", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: blockedReason.trim() ? 1 : 0.3 }}>확인</button>
                      <button onClick={() => { setShowBlockedInput(false); setShowStatusMenu(false); }}
                        style={{ flex: 1, padding: "6px 0", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
            )}
            {(task as any).blocked_reason && (
              <p style={{ marginTop: 8, fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                사유: {(task as any).blocked_reason}
              </p>
            )}
          </div>

          {/* 담당자 */}
          <div ref={assigneeRef}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>담당자</p>
            <button type="button"
              onClick={e => { e.stopPropagation(); if (canEdit) setShowAssigneeMenu(v => !v); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, minHeight: 40, cursor: canEdit ? "pointer" : "default", textAlign: "left" }}>
              {selectedUsers.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>담당자 없음</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                  {selectedUsers.map(u => {
                    const color = getUserColor(u.id);
                    return (
                      <span key={u.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${color}12`, color, border: `1px solid ${color}30` }}>
                        {u.name}
                        {canEdit && (
                          <span onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                            style={{ cursor: "pointer", opacity: 0.6, fontSize: 10 }}>✕</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              <span style={{ color: "var(--text-3)", marginLeft: "auto", fontSize: 10 }}>▾</span>
            </button>
            {showAssigneeMenu && (
              <div style={{ marginTop: 4, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                {allUsers.map(u => {
                  const selected = assigneeIds.includes(u.id);
                  const color = getUserColor(u.id);
                  return (
                    <button key={u.id} type="button"
                      onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", fontSize: 12, border: "none", cursor: "pointer", background: selected ? `${color}10` : "transparent", color: selected ? color : "var(--text-2)" }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as any).style.background = "var(--bg-3)"; }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as any).style.background = "transparent"; }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: selected ? color : "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: selected ? "#fff" : "var(--text-2)", flexShrink: 0 }}>
                        {u.name[0]}
                      </div>
                      <p style={{ flex: 1, margin: 0, fontWeight: 500 }}>{u.name}</p>
                      {selected && <span style={{ color, fontSize: 12 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 세부 정보 */}
          <Section title="세부 정보">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>프로젝트</p>
                <select value={(task as any).project_id ?? ""} onChange={e => canEdit && update("project_id", e.target.value || null)}
                  disabled={!canEdit}
                  style={{ background: "transparent", color: "var(--text-1)", border: "none", outline: "none", fontSize: 12, width: "100%", colorScheme: "light" }}>
                  <option value="">없음</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>우선순위</p>
                <select value={task.priority} onChange={e => canEdit && update("priority", e.target.value)}
                  disabled={!canEdit}
                  style={{ background: "transparent", color: p.color, border: "none", outline: "none", fontSize: 12, fontWeight: 600, width: "100%", colorScheme: "light" }}>
                  {["low","medium","high","urgent"].map(v => <option key={v} value={v}>{PRIORITY[v].label}</option>)}
                </select>
              </div>
              {milestones.length > 0 && (
                <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, gridColumn: "1 / -1" }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>단계</p>
                  <select value={(task as any).milestone_id ?? ""} onChange={e => canEdit && update("milestone_id", e.target.value || null)}
                    disabled={!canEdit}
                    style={{ background: "transparent", color: "var(--text-1)", border: "none", outline: "none", fontSize: 12, width: "100%", colorScheme: "light" }}>
                    <option value="">미분류</option>
                    {milestones.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.status === "completed" ? "✅" : m.status === "in_progress" ? "🔵" : "⭕"}{m.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>마감일</p>
                <input type="date" value={(task as any).due_date ? (task as any).due_date.split("T")[0] : ""}
                  onChange={e => canEdit && update("due_date", e.target.value || null)}
                  disabled={!canEdit}
                  style={{ background: "transparent", color: isOverdue ? "#DC2626" : "var(--text-1)", border: "none", outline: "none", fontSize: 12, width: "100%", colorScheme: "light" }} />
              </div>
              <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>난이도</p>
                <select value={(task as any).difficulty ?? ""} onChange={e => canEdit && update("difficulty", e.target.value || null)}
                  disabled={!canEdit}
                  style={{ background: "transparent", color: "var(--text-1)", border: "none", outline: "none", fontSize: 12, width: "100%", colorScheme: "light" }}>
                  <option value="">미정</option>
                  {["low","medium","high","very_high"].map(v => <option key={v} value={v}>{DIFFICULTY[v]}</option>)}
                </select>
              </div>
              {/* 캘린더 표시 토글 */}
              <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>📅 캘린더에 표시</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>
                      {showOnCalendar ? "캘린더에 표시됩니다" : "표시 안 됨 (기본값)"}
                    </p>
                  </div>
                  <button onClick={toggleCalendar}
                    style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: showOnCalendar ? "var(--cyan)" : "var(--border-2)", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", left: showOnCalendar ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* 변경 이력 */}
          {events.length > 0 && (
            <Section title="변경 이력" defaultOpen={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {events.map((ev, i) => (
                  <div key={ev.id ?? i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: ev.to_status ? STATUS[ev.to_status]?.color : "var(--text-3)" }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "var(--text-2)", margin: 0 }}>
                        {EVENT_LABEL[ev.event_type]?.(ev) ?? ev.event_type}
                        {ev.reason && <span style={{ color: "var(--text-3)" }}> — {ev.reason}</span>}
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        {ev.changed_by_user?.name && <span style={{ color: "var(--cyan)", fontWeight: 500 }}>{ev.changed_by_user.name}</span>}
                        <span style={{ color: "var(--text-3)" }}>{fmtDT(ev.changed_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 업무 의존성 */}
          <Section title="업무 의존성" defaultOpen={false}>
            <TaskDependencies taskId={taskId} projectId={(task as any).project_id} />
          </Section>

          {/* 댓글 */}
          <Section title="댓글">
            <TaskComments taskId={taskId} />
          </Section>
        </div>
      </div>
    </div>
  );
  return typeof window !== "undefined" ? createPortal(panel, document.body) : null;
}
