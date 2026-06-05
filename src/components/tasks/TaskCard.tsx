// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import type { Task, User, Project } from "@/types/database";
type TaskStatus = string;
import TaskDetail from "./TaskDetail";

type T = Task & {
  assignee?: Pick<User, "name" | "avatar_url"> | null;
  assignees?: Pick<User, "id" | "name">[];
  project?: Pick<Project, "name"> | null;
  comment_count?: number;
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
  low:    { label: "낮음", color: "#4A7099" },
  medium: { label: "보통", color: "#7BA7C8" },
  high:   { label: "높음", color: "#fbbf24" },
  urgent: { label: "긴급", color: "#f87171" },
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
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

function AssigneeStack({ task }: { task: T }) {
  const list = task.assignees && task.assignees.length > 0
    ? task.assignees : task.assignee ? [task.assignee] : [];
  if (list.length === 0) return null;
  return (
    <div className="flex items-center shrink-0">
      {list.slice(0, 4).map((u, i) => {
        const color = getUserColor((u as any).id ?? u.name ?? String(i));
        return (
          <span key={(u as any).id ?? i}
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
            style={{ background: `${color}22`, color, border: `1.5px solid var(--bg-2)`, marginLeft: i > 0 ? -6 : 0, zIndex: list.length - i }}
            title={u.name}>{u.name[0]}</span>
        );
      })}
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
  const [commentCount, setCommentCount] = useState<number>(task.comment_count ?? 0);
  const [localStatus, setLocalStatus] = useState(task.status);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (task.comment_count !== undefined) { setCommentCount(task.comment_count); return; }
    supabase.from("task_comments").select("id", { count: "exact", head: true })
      .eq("task_id", task.id)
      .then(({ count }) => { if (count != null) setCommentCount(count); });
  }, [task.id]);

  useEffect(() => {
    if (!open && !showBlocked) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false); setShowBlocked(false); setMenuPos(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, showBlocked]);

  const s = STATUS[localStatus] ?? { label: localStatus, color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" };
  const p = PRIORITY[task.priority] ?? { label: task.priority, color: "#7BA7C8" };
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();

  function openMenu() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
    setShowBlocked(false);
  }

  async function changeStatus(newStatus: TaskStatus, blockedReason?: string) {
    setLoading(true);
    setLocalStatus(newStatus);
    setOpen(false); setShowBlocked(false); setReason(""); setMenuPos(null);
    await supabase.from("tasks").update({
      status: newStatus,
      blocked_reason: newStatus === "blocked" ? (blockedReason ?? null) : null,
    }).eq("id", task.id);
    setLoading(false);
    onRefresh();
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all cursor-pointer"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)"; }}
        onClick={() => setShowDetail(true)}>

        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button ref={btnRef} onClick={openMenu} disabled={loading}
            className="rounded-md px-2.5 py-1 text-xs font-semibold"
            style={{ background: s.bg, color: s.color }}>
            {loading ? "…" : s.label} ▾
          </button>
        </div>

        <span className="flex-1 truncate text-sm font-medium flex items-center gap-1.5 min-w-0"
          style={{ color: localStatus === "done" ? "var(--text-3)" : "var(--text-1)", textDecoration: localStatus === "done" ? "line-through" : undefined }}>
          <span className="truncate">{task.title}</span>
          {commentCount > 0 && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "var(--bg-4)", color: "var(--text-3)", fontSize: 10 }}>
              💬 {commentCount}
            </span>
          )}
        </span>

        {task.blocked_reason && (
          <span className="hidden sm:block shrink-0 max-w-[130px] truncate text-xs px-2 py-0.5 rounded-md"
            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
            {task.blocked_reason}
          </span>
        )}
        {task.project && (
          <span className="hidden sm:block shrink-0 text-xs px-2 py-0.5 rounded-md"
            style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
            {task.project.name}
          </span>
        )}
        <AssigneeStack task={task} />
        {task.due_date && (
          <span className="shrink-0 text-xs tabular-nums font-medium"
            style={{ color: overdue ? "#f87171" : "var(--text-3)" }}>
            {overdue ? "⚠ " : ""}{fmt(task.due_date)}
          </span>
        )}
        <span className="shrink-0 text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
      </div>

      {/* 상태 드롭다운 - Portal */}
      {mounted && open && !showBlocked && menuPos && createPortal(
        <div ref={dropdownRef} style={{
          position: "fixed", zIndex: 9999, width: 128,
          top: menuPos.top, left: menuPos.left,
          background: "var(--bg-3)", border: "1px solid var(--border-2)",
          borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
        }}>
          {STATUS_LIST.map(sv => (
            <button key={sv}
              onClick={e => { e.stopPropagation(); sv === "blocked" ? setShowBlocked(true) : changeStatus(sv); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none",
                color: sv === localStatus ? STATUS[sv].color : "var(--text-2)",
                background: sv === localStatus ? STATUS[sv].bg : "transparent",
              }}
              onMouseEnter={e => { if (sv !== localStatus) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
              onMouseLeave={e => { if (sv !== localStatus) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS[sv].color, flexShrink: 0 }} />
              {STATUS[sv].label}
            </button>
          ))}
          <button onClick={e => { e.stopPropagation(); setOpen(false); setMenuPos(null); }}
            style={{ width: "100%", padding: "8px 12px", fontSize: 12, textAlign: "center", cursor: "pointer", border: "none", borderTop: "1px solid var(--border)", color: "var(--text-3)", background: "transparent" }}>
            닫기
          </button>
        </div>,
        document.body
      )}

      {/* Blocked 사유 - Portal */}
      {mounted && showBlocked && menuPos && createPortal(
        <div ref={dropdownRef} style={{
          position: "fixed", zIndex: 9999, width: 256,
          top: menuPos.top, left: menuPos.left,
          background: "var(--bg-3)", border: "1px solid var(--border-2)",
          borderRadius: 12, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>Blocked 사유 *</p>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="왜 막혔는지 입력해주세요" rows={2} autoFocus
            style={{ width: "100%", borderRadius: 8, padding: "6px 10px", fontSize: 12, resize: "none", outline: "none", background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={e => { e.stopPropagation(); changeStatus("blocked", reason); }} disabled={!reason.trim()}
              style={{ flex: 1, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "#f87171", color: "#fff", opacity: reason.trim() ? 1 : 0.3 }}>
              확인
            </button>
            <button onClick={e => { e.stopPropagation(); setShowBlocked(false); setOpen(false); setMenuPos(null); }}
              style={{ flex: 1, borderRadius: 8, padding: "6px 0", fontSize: 12, cursor: "pointer", border: "none", background: "var(--bg-4)", color: "var(--text-2)" }}>
              취소
            </button>
          </div>
        </div>,
        document.body
      )}

      {showDetail && (
        <TaskDetail taskId={task.id} onClose={() => setShowDetail(false)}
          onRefresh={() => { setShowDetail(false); onRefresh(); }} />
      )}
    </>
  );
}
