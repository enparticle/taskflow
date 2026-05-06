"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { Task, User, Project, TaskStatus } from "@/types/database";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";

type T = Task & {
  assignee?: Pick<User, "name" | "avatar_url"> | null;
  project?: Pick<Project, "name"> | null;
};

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string }[] = [
  { status: "backlog",  label: "백로그",  color: "#4A7099", bg: "rgba(74,112,153,0.08)" },
  { status: "todo",     label: "할 일",   color: "#7BA7C8", bg: "rgba(123,167,200,0.08)" },
  { status: "doing",    label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.08)" },
  { status: "blocked",  label: "Blocked", color: "#FF4D6A", bg: "rgba(255,77,106,0.08)" },
  { status: "review",   label: "리뷰",    color: "#F5A623", bg: "rgba(245,166,35,0.08)" },
  { status: "done",     label: "완료",    color: "#00D4A0", bg: "rgba(0,212,160,0.08)" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "#4A7099", medium: "#7BA7C8", high: "#F5A623", urgent: "#FF4D6A",
};

function fmt(d: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function KanbanPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<T[]>([]);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ taskId: string; status: TaskStatus } | null>(null);
  const [blockedReason, setBlockedReason] = useState("");
  const dragTask = useRef<T | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .order("created_at", { ascending: true });
    setTasks(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  async function moveTask(taskId: string, newStatus: TaskStatus, reason?: string) {
    await supabase.from("tasks").update({
      status: newStatus as any,
      blocked_reason: newStatus === "blocked" ? (reason ?? null) : null,
    } as any).eq("id", taskId);
    await load();
  }

  function handleDragStart(e: React.DragEvent, task: T) {
    dragTask.current = task;
    setDragging(task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(status);
  }

  async function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOver(null);
    setDragging(null);
    if (!dragTask.current || dragTask.current.status === status) return;

    if (status === "blocked") {
      setPendingDrop({ taskId: dragTask.current.id, status });
      setShowBlockedModal(true);
      return;
    }
    await moveTask(dragTask.current.id, status);
    dragTask.current = null;
  }

  async function confirmBlocked() {
    if (!pendingDrop || !blockedReason.trim()) return;
    await moveTask(pendingDrop.taskId, "blocked", blockedReason);
    setShowBlockedModal(false);
    setPendingDrop(null);
    setBlockedReason("");
    dragTask.current = null;
  }

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "calc(100vh - 64px)" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>칸반 보드</h1>
          <span className="text-xs px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>{tasks.length}</span>
        </div>
        <button onClick={() => setOpenForm(true)}
          className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{
            background: "linear-gradient(135deg, #00C2CC, #2E86FF)",
            color: "#fff",
            boxShadow: "0 0 16px rgba(0,194,204,0.25)",
          }}>
          + 새 업무
        </button>
      </div>

      {/* 칸반 컬럼들 */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1"
        style={{ scrollbarWidth: "thin" }}>
        {COLUMNS.map(col => {
          const colTasks = byStatus(col.status);
          const isOver = dragOver === col.status;
          return (
            <div key={col.status}
              className="flex flex-col rounded-2xl shrink-0 transition-all"
              style={{
                width: "240px",
                background: isOver ? col.bg : "var(--bg-2)",
                border: `1px solid ${isOver ? col.color + "66" : "var(--border)"}`,
                boxShadow: isOver ? `0 0 20px ${col.color}22` : "none",
              }}
              onDragOver={e => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.status)}>

              {/* 컬럼 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ borderBottom: `1px solid var(--border)` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                </div>
                <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{ background: `${col.color}18`, color: col.color }}>
                  {colTasks.length}
                </span>
              </div>

              {/* 카드 목록 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colTasks.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    colColor={col.color}
                    isDragging={dragging === task.id}
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onClick={() => setOpenDetail(task.id)}
                  />
                ))}

                {/* 빈 상태 */}
                {colTasks.length === 0 && (
                  <div className="rounded-xl py-8 text-center"
                    style={{ border: `1px dashed ${col.color}33` }}>
                    <p className="text-xs" style={{ color: "var(--text-3)" }}>없음</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked 사유 모달 */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-80 rounded-2xl p-5 shadow-2xl"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ background: "#FF4D6A", boxShadow: "0 0 6px #FF4D6A" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>Blocked 사유 입력</h3>
            </div>
            <textarea value={blockedReason} onChange={e => setBlockedReason(e.target.value)}
              placeholder="왜 막혔는지 입력하세요" rows={3} autoFocus
              className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none mb-3"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
            <div className="flex gap-2">
              <button onClick={confirmBlocked} disabled={!blockedReason.trim()}
                className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-30"
                style={{ background: "#FF4D6A", color: "#fff" }}>확인</button>
              <button onClick={() => { setShowBlockedModal(false); setPendingDrop(null); setBlockedReason(""); dragTask.current = null; }}
                className="flex-1 rounded-xl py-2 text-sm"
                style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {openDetail && (
        <TaskDetail
          taskId={openDetail}
          onClose={() => setOpenDetail(null)}
          onRefresh={() => { setOpenDetail(null); load(); }}
        />
      )}
      {openForm && (
        <TaskForm
          onClose={() => setOpenForm(false)}
          onCreated={() => { load(); setOpenForm(false); }}
        />
      )}
    </div>
  );
}

function KanbanCard({
  task, colColor, isDragging, onDragStart, onDragEnd, onClick
}: {
  task: T; colColor: string; isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all select-none"
      style={{
        background: "var(--bg-3)",
        border: `1px solid var(--border)`,
        borderTop: `2px solid ${colColor}`,
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "rotate(2deg) scale(0.98)" : undefined,
        boxShadow: isDragging ? "none" : undefined,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>

      {/* 업무명 */}
      <p className="text-xs font-semibold mb-2 leading-snug"
        style={{
          color: task.status === "done" ? "var(--text-3)" : "var(--text-1)",
          textDecoration: task.status === "done" ? "line-through" : undefined,
        }}>
        {task.title}
      </p>

      {/* blocked 사유 */}
      {task.blocked_reason && (
        <p className="text-xs mb-2 px-2 py-1 rounded-lg truncate"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}>
          {task.blocked_reason}
        </p>
      )}

      {/* 프로젝트 */}
      {task.project && (
        <p className="text-xs mb-2 truncate" style={{ color: "var(--text-3)" }}>
          ⬡ {task.project.name}
        </p>
      )}

      {/* 하단 메타 */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {/* 우선순위 점 */}
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ background: PRIORITY_COLOR[task.priority] }} />
          {/* 마감일 */}
          {task.due_date && (
            <span className="text-xs tabular-nums"
              style={{ color: overdue ? "var(--red)" : "var(--text-3)" }}>
              {overdue ? "⚠ " : ""}{fmt(task.due_date)}
            </span>
          )}
        </div>
        {/* 담당자 */}
        {task.assignee && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
            style={{ background: "var(--cyan-bg)", color: "var(--cyan)", fontSize: "10px" }}>
            {task.assignee.name[0]}
          </span>
        )}
      </div>
    </div>
  );
}
