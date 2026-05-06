"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Task, User, Project } from "@/types/database";
type TaskStatus = string;
import TaskDetail from "./TaskDetail";

type T = Task & {
  assignee?: Pick<User, "name" | "avatar_url"> | null;
  assignees?: Pick<User, "id" | "name">[];
  project?: Pick<Project, "name"> | null;
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
  low:    { label: "낮음", color: "#4A7099" },
  medium: { label: "보통", color: "#7BA7C8" },
  high:   { label: "높음", color: "#F5A623" },
  urgent: { label: "긴급", color: "#FF4D6A" },
};
const STATUS_LIST = ["backlog","todo","doing","blocked","review","done"] as TaskStatus[];

function fmt(d: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

// 담당자 아바타 스택
function AssigneeStack({ task }: { task: T }) {
  // assignees 배열이 있으면 우선 사용, 없으면 assignee 단일 사용
  const list = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assignee ? [task.assignee] : [];

  if (list.length === 0) return null;

  const COLORS = ["#00C2CC","#2E86FF","#F5A623","#00D4A0","#A78BFA","#FF4D6A"];

  return (
    <div className="flex items-center shrink-0" style={{ gap: "-4px" }}>
      {list.slice(0, 4).map((u, i) => (
        <span key={(u as any).id ?? i}
          className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
          style={{
            background: `${COLORS[i % COLORS.length]}22`,
            color: COLORS[i % COLORS.length],
            border: `1.5px solid var(--bg-2)`,
            marginLeft: i > 0 ? -6 : 0,
            zIndex: list.length - i,
          }}>
          {u.name[0]}
        </span>
      ))}
      {list.length > 4 && (
        <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
          style={{ background: "var(--bg-4)", color: "var(--text-3)", border: "1.5px solid var(--bg-2)", marginLeft: -6 }}>
          +{list.length - 4}
        </span>
      )}
    </div>
  );
}

export default function TaskCard({ task, onRefresh }: { task: T; onRefresh: () => void }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const s = STATUS[task.status];
  const p = PRIORITY[task.priority];
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();

  async function changeStatus(newStatus: TaskStatus, blockedReason?: string) {
    setLoading(true);
    await supabase.from("tasks").update({
      status: newStatus,
      blocked_reason: newStatus === "blocked" ? (blockedReason ?? null) : null,
    }).eq("id", task.id);
    setLoading(false);
    setOpen(false); setShowBlocked(false); setReason("");
    onRefresh();
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)"; }}
        onClick={() => setShowDetail(true)}>

        {/* 상태 배지 */}
        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setOpen(!open); setShowBlocked(false); }} disabled={loading}
            className="rounded-md px-2.5 py-1 text-xs font-semibold"
            style={{ background: s.bg, color: s.color }}>
            {loading ? "…" : s.label} ▾
          </button>

          {open && !showBlocked && (
            <div className="absolute left-0 top-8 z-30 w-32 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
              {STATUS_LIST.map(sv => (
                <button key={sv}
                  onClick={() => sv === "blocked" ? setShowBlocked(true) : changeStatus(sv)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium"
                  style={{ color: sv === task.status ? STATUS[sv].color : "var(--text-2)", background: sv === task.status ? STATUS[sv].bg : "transparent" }}
                  onMouseEnter={e => { if (sv !== task.status) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
                  onMouseLeave={e => { if (sv !== task.status) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS[sv].color }} />
                  {STATUS[sv].label}
                </button>
              ))}
              <button onClick={() => setOpen(false)} className="w-full px-3 py-2 text-xs text-center"
                style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)" }}>닫기</button>
            </div>
          )}

          {showBlocked && (
            <div className="absolute left-0 top-8 z-30 w-64 rounded-xl p-3 shadow-2xl"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-1)" }}>Blocked 사유 *</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="왜 막혔는지 입력하세요" rows={2} autoFocus
                className="w-full rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
              <div className="mt-2 flex gap-2">
                <button onClick={() => changeStatus("blocked", reason)} disabled={!reason.trim()}
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-30"
                  style={{ background: "#FF4D6A", color: "#fff" }}>확인</button>
                <button onClick={() => { setShowBlocked(false); setOpen(false); }}
                  className="flex-1 rounded-lg py-1.5 text-xs"
                  style={{ background: "var(--bg-4)", color: "var(--text-2)" }}>취소</button>
              </div>
            </div>
          )}
        </div>

        {/* 업무명 */}
        <span className="flex-1 truncate text-sm font-medium"
          style={{ color: task.status === "done" ? "var(--text-3)" : "var(--text-1)",
            textDecoration: task.status === "done" ? "line-through" : undefined }}>
          {task.title}
        </span>

        {task.blocked_reason && (
          <span className="hidden sm:block shrink-0 max-w-[130px] truncate text-xs px-2 py-0.5 rounded-md"
            style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            {task.blocked_reason}
          </span>
        )}
        {task.project && (
          <span className="hidden sm:block shrink-0 text-xs px-2 py-0.5 rounded-md"
            style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
            {task.project.name}
          </span>
        )}

        {/* 담당자 스택 */}
        <AssigneeStack task={task} />

        {task.due_date && (
          <span className="shrink-0 text-xs tabular-nums font-medium"
            style={{ color: overdue ? "var(--red)" : "var(--text-3)" }}>
            {overdue ? "⚠ " : ""}{fmt(task.due_date)}
          </span>
        )}
        <span className="shrink-0 text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
      </div>

      {showDetail && (
        <TaskDetail taskId={task.id} onClose={() => setShowDetail(false)}
          onRefresh={() => { setShowDetail(false); onRefresh(); }} />
      )}
    </>
  );
}
