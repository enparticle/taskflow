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
  backlog: { label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.15)" },
  todo:    { label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  doing:   { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  review:  { label: "리뷰",    color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  done:    { label: "완료",    color: "#34d399", bg: "rgba(52,211,153,0.15)" },
};
const PRIORITY: Record<string, { label: string; color: string }> = {
  low: { label: "낮음", color: "#4A7099" }, medium: { label: "보통", color: "#7BA7C8" },
  high: { label: "높음", color: "#fbbf24" }, urgent: { label: "긴급", color: "#f87171" },
};
const DIFFICULTY: Record<string, string> = { low: "낮음", medium: "보통", high: "높음", very_high: "매우 높음" };
const TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "미팅",
  research: "리서치", customer: "고객 대응", other: "기타",
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"] as TaskStatus[];

function getUserColor(userId: string): string {
  const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9","#4ade80","#f43f5e","#818cf8","#2dd4bf"];
  if (!userId) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) { hash = ((hash << 5) - hash) + userId.charCodeAt(i); hash |= 0; }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
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
        className="w-full flex items-center justify-between mb-2 py-1"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>{title}</p>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>{open ? "▾" : "▸"}</span>
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
      .eq("task_id", taskId)
      .order("changed_at", { ascending: false }).limit(10);
    setEvents(evs ?? []);

    setTask(data);
    setAssigneeIds((data as any)?.assignee_ids ?? ((data as any)?.assignee_id ? [(data as any).assignee_id] : []));
    setShowOnCalendar((data as any)?.show_on_calendar ?? false);

    const authUser = await getAuthUser();
    if (authUser) {
      setMyUser(authUser);
      const projRole = (data as any)?.project_id
        ? await getProjectRole((data as any).project_id, authUser.userId)
        : null;
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

    if (field === "task_type" && prev !== value) {
      await supabase.from("task_events").insert({
        task_id: taskId, event_type: "type_change",
        changed_by: myUser?.userId ?? null,
        metadata: { from: prev, to: value },
      });
    }
    if (field === "assignee_id" && prev !== value) {
      await supabase.from("task_events").insert({
        task_id: taskId, event_type: "assignee_change",
        changed_by: myUser?.userId ?? null,
        metadata: { from: prev, to: value },
      });
    }

    if (field === "due_date" && prev !== value && assigneeIds.length > 0) {
      const newDate = value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정";
      for (const uid of assigneeIds) {
        if (uid === myUser?.userId) continue;
        await supabase.from("notifications").insert({
          user_id: uid, type: "deadline",
          title: `마감일이 ${newDate}으로 변경됐습니다`,
          body: (task as any)?.title ?? "업무",
          task_id: taskId,
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
      <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="h-full w-full max-w-xl flex items-center justify-center"
          style={{ background: "var(--bg-2)", borderLeft: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-3)" }}>불러오는 중…</p>
        </div>
      </div>
    );
  }

  const s = STATUS[task.status] ?? { label: task.status, color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" };
  const p = PRIORITY[task.priority] ?? { label: task.priority, color: "#7BA7C8" };
  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
  const selectedUsers = allUsers.filter(u => assigneeIds.includes(u.id));

  const EVENT_LABEL: Record<string, (ev: any) => string> = {
    status_change: ev => `상태: ${STATUS[ev.from_status]?.label ?? ev.from_status} → ${STATUS[ev.to_status]?.label ?? ev.to_status}`,
    type_change: ev => `유형: ${TYPE_LABEL[ev.metadata?.from] ?? ev.metadata?.from} → ${TYPE_LABEL[ev.metadata?.to] ?? ev.metadata?.to}`,
    assignee_change: ev => "담당자 변경",
  };

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
              {TYPE_LABEL[task.task_type] ?? task.task_type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={async () => {
                if (!confirm("이 업무를 삭제할까요?")) return;
                await supabase.from("tasks").delete().eq("id", taskId);
                onRefresh();
              }} className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
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
            {(task as any).last_updated_user?.name && (
              <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                최종 수정: <span style={{ color: "var(--text-2)" }}>{(task as any).last_updated_user.name}</span>
              </p>
            )}
          </div>

          {/* 설명 */}
          <Section title="설명">
            <div>
            {editing === "description" ? (
              <div className="space-y-2">
                <textarea autoFocus value={descVal} onChange={e => setDescVal(e.target.value)} rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                <div className="flex gap-2">
                  <button onClick={() => update("description", descVal)} className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>저장</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>취소</button>
                </div>
              </div>
            ) : (
              <p className={`text-sm rounded-lg px-3 py-2 ${canEdit ? "cursor-pointer hover:opacity-80" : ""}`}
                style={{ color: task.description ? "var(--text-2)" : "var(--text-3)", background: "var(--bg-3)", border: "1px solid var(--border)" }}
                onClick={() => { if (canEdit) { setEditing("description"); setDescVal((task as any).description ?? ""); } }}>
                {(task as any).description || (canEdit ? "설명 없음 — 클릭해서 입력" : "설명 없음")}
              </p>
            )}
            </div>
          </Section>

          {/* 미팅 완료 버튼 */}
          {isMeeting && task.status !== "done" && canChangeStatus && (
            <button onClick={() => changeStatus("done" as any)}
              className="w-full rounded-xl py-2.5 text-xs font-semibold transition-all"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
              ✓ 미팅 완료 처리
            </button>
          )}

          {/* 미팅 일정 선택 */}
          {isMeeting && (
            <div className="rounded-xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-3)" }}>미팅 일정 선택</p>
              <MeetingPoll taskId={taskId} />
            </div>
          )}

          {/* 회의록 연결 */}
          {isMeeting && (
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>📝 회의록 연결</p>
                <button onClick={() => setShowNotePicker(!showNotePicker)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "var(--bg-4)", color: "var(--cyan)", border: "1px solid var(--border-2)" }}>
                  {meetingNote ? "변경" : "+ 연결"}
                </button>
              </div>
              {meetingNote ? (
                <div className="rounded-lg p-2.5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--text-1)" }}>
                    {meetingNote.result?.summary ?? "회의록"}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      {new Date(meetingNote.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                    {meetingNote.audio_path && (
                      <button onClick={async () => {
                        const { data } = await supabase.storage.from("meeting-recordings").download(meetingNote.audio_path);
                        if (data) { const url = URL.createObjectURL(data); window.open(url); }
                      }} className="text-xs" style={{ color: "#7BA7C8" }}>🎙 녹음 파일 듣기</button>
                    )}
                    {meetingNote.input_text && (
                      <button onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) { w.document.write(`<pre style="font-family:sans-serif;padding:20px;white-space:pre-wrap">${meetingNote.input_text}</pre>`); }
                      }} className="text-xs" style={{ color: "var(--text-3)" }}>원문 텍스트 보기</button>
                    )}
                    <button onClick={() => linkMeetingNote(null)} className="text-xs" style={{ color: "#f87171" }}>연결 해제</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>연결된 회의록이 없습니다</p>
              )}
              {showNotePicker && (
                <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-2)", maxHeight: 200, overflowY: "auto" }}>
                  {meetingNotes.length === 0 ? (
                    <p className="text-xs p-3" style={{ color: "var(--text-3)" }}>저장된 회의록이 없습니다</p>
                  ) : meetingNotes.map(n => (
                    <button key={n.id} onClick={() => linkMeetingNote(n.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                      style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => { (e.currentTarget as any).style.background = "var(--bg-3)"; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.background = "var(--bg-2)"; }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate" style={{ color: "var(--text-1)" }}>
                          {n.result?.summary ?? n.input_text?.slice(0, 40) ?? "회의록"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                          {new Date(n.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {n.audio_path && " · 녹음 있음"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 상태 */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>상태</p>
            {canChangeStatus ? (
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
                      placeholder="왜 막혔는지 입력해주세요" rows={2} autoFocus
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                      style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => changeStatus("blocked", blockedReason)} disabled={!blockedReason.trim()}
                        className="flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-30"
                        style={{ background: "#f87171", color: "#fff" }}>확인</button>
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
                style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                사유: {(task as any).blocked_reason}
              </p>
            )}
          </div>

          {/* 담당자 선택 */}
          <div ref={assigneeRef}>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>담당자</p>
            <button type="button"
              onClick={e => { e.stopPropagation(); if (canEdit) setShowAssigneeMenu(v => !v); }}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left ${canEdit ? "" : "cursor-default"}`}
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)", minHeight: 40 }}>
              {selectedUsers.length === 0 ? (
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>담당자 없음</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {selectedUsers.map(u => {
                    const color = getUserColor(u.id);
                    return (
                      <span key={u.id} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}33` }}>
                        {u.name}
                        {canEdit && (
                          <span onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                            className="cursor-pointer hover:opacity-60 ml-0.5" style={{ fontSize: 10 }}>✕</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              <span style={{ color: "var(--text-3)", marginLeft: "auto", fontSize: 10 }}>▾</span>
            </button>

            {showAssigneeMenu && (
              <div className="mt-1 rounded-xl overflow-hidden shadow-2xl"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                {allUsers.map(u => {
                  const selected = assigneeIds.includes(u.id);
                  const color = getUserColor(u.id);
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

          {/* 세부 정보 */}
          <Section title="세부 정보" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>프로젝트</p>
              <select value={(task as any).project_id ?? ""} onChange={e => canEdit && update("project_id", e.target.value || null)}
                disabled={!canEdit}
                className="w-full text-xs focus:outline-none" style={{ background: "transparent", color: canEdit ? "#E8F4FF" : "var(--text-3)", border: "none", colorScheme: "dark" }}>
                <option value="">없음</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>우선순위</p>
              <select value={task.priority} onChange={e => canEdit && update("priority", e.target.value)}
                disabled={!canEdit}
                className="w-full text-xs font-semibold focus:outline-none" style={{ background: "transparent", color: p.color, border: "none", colorScheme: "dark" }}>
                {["low","medium","high","urgent"].map(v => <option key={v} value={v}>{PRIORITY[v].label}</option>)}
              </select>
            </div>
            {milestones.length > 0 && (
              <div className="rounded-xl p-3 col-span-2" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>단계</p>
                <select value={(task as any).milestone_id ?? ""} onChange={e => canEdit && update("milestone_id", e.target.value || null)}
                  disabled={!canEdit}
                  className="w-full text-xs focus:outline-none" style={{ background: "transparent", color: canEdit ? "#E8F4FF" : "var(--text-3)", border: "none", colorScheme: "dark" }}>
                  <option value="">미분류</option>
                  {milestones.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.status === "completed" ? "✅" : m.status === "in_progress" ? "🔵" : "⭕"}{m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>난이도</p>
              <select value={(task as any).difficulty ?? ""} onChange={e => canEdit && update("difficulty", e.target.value || null)}
                disabled={!canEdit}
                className="w-full text-xs focus:outline-none" style={{ background: "transparent", color: canEdit ? "#E8F4FF" : "var(--text-3)", border: "none", colorScheme: "dark" }}>
                <option value="">미정</option>
                {["low","medium","high","very_high"].map(v => <option key={v} value={v}>{DIFFICULTY[v]}</option>)}
              </select>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>마감일</p>
              <input type="date" value={(task as any).due_date ? (task as any).due_date.split("T")[0] : ""}
                onChange={e => canEdit && update("due_date", e.target.value || null)}
                disabled={!canEdit}
                className="w-full text-xs focus:outline-none"
                style={{ background: "transparent", color: isOverdue ? "#f87171" : canEdit ? "var(--text-1)" : "var(--text-3)", border: "none", colorScheme: "dark" }} />
            </div>

            {/* 캘린더 표시 토글 */}
            <div className="rounded-xl p-3 col-span-2" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>📅 캘린더에 표시</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                    {showOnCalendar ? "이 업무가 캘린더에 표시됩니다" : "캘린더에 표시되지 않습니다 (기본값)"}
                  </p>
                </div>
                <button onClick={toggleCalendar}
                  className="relative rounded-full transition-all shrink-0"
                  style={{
                    width: 44, height: 24,
                    background: showOnCalendar ? "var(--cyan)" : "var(--bg-4)",
                    border: `1px solid ${showOnCalendar ? "var(--cyan)" : "var(--border-2)"}`,
                  }}>
                  <div style={{
                    position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    left: showOnCalendar ? 22 : 2,
                  }} />
                </button>
              </div>
            </div>
          </div>
          </Section>

          {/* 타임라인 */}
          <Section title="타임라인" defaultOpen={false}>
          <div className="rounded-xl p-4" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            <div className={`grid gap-3 text-center ${isMeeting ? "grid-cols-2" : "grid-cols-3"}`}>
              {isMeeting ? (
                <>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>생성</p>
                    <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{fmtDT((task as any).created_at)}</p>
                  </div>
                  <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>
                    <p className="text-xs mb-1" style={{ color: "var(--cyan)" }}>📅 미팅 일시</p>
                    {(task as any).due_date ? (
                      <>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                          {new Date((task as any).due_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                        </p>
                        {canEdit ? (
                          <input type="datetime-local" defaultValue={(task as any).due_date?.slice(0, 16)}
                            onChange={e => update("due_date", e.target.value)}
                            className="text-xs mt-1 rounded px-1 py-0.5 w-full focus:outline-none"
                            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-2)", colorScheme: "dark" }} />
                        ) : (
                          <p className="text-xs" style={{ color: "var(--text-3)" }}>
                            {new Date((task as any).due_date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </>
                    ) : (
                      canEdit ? (
                        <input type="datetime-local" onChange={e => update("due_date", e.target.value)}
                          className="text-xs mt-1 rounded px-1 py-0.5 w-full focus:outline-none"
                          style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-2)", colorScheme: "dark" }} />
                      ) : (
                        <p className="text-xs" style={{ color: "var(--text-3)" }}>미정</p>
                      )
                    )}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          </Section>

          {/* 변경 이력 */}
          {events.length > 0 && (
          <Section title="변경 이력" defaultOpen={false}>
            <div className="rounded-xl p-4" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div className="space-y-2">
                {events.map((ev, i) => (
                  <div key={ev.id ?? i} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                      style={{ background: ev.to_status ? STATUS[ev.to_status]?.color : "var(--text-3)" }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "var(--text-2)" }}>
                        {EVENT_LABEL[ev.event_type]?.(ev) ?? ev.event_type}
                        {ev.reason && <span style={{ color: "var(--text-3)" }}> — {ev.reason}</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ev.changed_by_user?.name && (
                          <span className="font-medium" style={{ color: "var(--cyan)" }}>{ev.changed_by_user.name}</span>
                        )}
                        <span style={{ color: "var(--text-3)" }}>{fmtDT(ev.changed_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          )}

          {/* 리뷰 */}
          {task.status === "review" && assigneeIds.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-3)" }}>리뷰어 현황</p>
              <TaskReviews taskId={taskId} assigneeIds={assigneeIds} />
            </div>
          )}

          {/* 업무 의존성 */}
          <Section title="업무 의존성" defaultOpen={false}>
            <TaskDependencies taskId={taskId} projectId={(task as any).project_id} />
          </Section>

          {/* 댓글 */}
          <Section title="댓글" defaultOpen={true}>
            <TaskComments taskId={taskId} />
          </Section>
        </div>
      </div>
    </div>
  );
  return typeof window !== 'undefined' ? createPortal(panel, document.body) : null;
}
