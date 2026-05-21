// @ts-nocheck
"use client";
import { useState, useMemo } from "react";
import TaskCard from "./TaskCard";

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "todo", label: "할 일" },
  { value: "doing", label: "진행 중" },
  { value: "review", label: "리뷰" },
  { value: "blocked", label: "Blocked" },
  { value: "backlog", label: "백로그" },
  { value: "done", label: "완료" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "전체 우선순위" },
  { value: "urgent", label: "긴급" },
  { value: "high", label: "높음" },
  { value: "medium", label: "보통" },
  { value: "low", label: "낮음" },
];

const SORT_OPTIONS = [
  { value: "status", label: "상태순" },
  { value: "priority", label: "우선순위순" },
  { value: "due_date", label: "마감일순" },
  { value: "created_at", label: "등록일순" },
  { value: "title", label: "이름순" },
];

const STATUS_ORDER: Record<string, number> = { doing: 0, todo: 1, review: 2, blocked: 3, backlog: 4, done: 5 };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function TaskList({ tasks, onRefresh, onTaskClick }: {
  tasks: any[];
  onRefresh: () => void;
  onTaskClick?: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("status");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);

  const filtered = useMemo(() => {
    let result = [...tasks];

    // 검색
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title?.toLowerCase().includes(q));
    }

    // 상태 필터
    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter);
    } else if (!showDone) {
      result = result.filter(t => t.status !== "done");
    }

    // 우선순위 필터
    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // 정렬
    result.sort((a, b) => {
      switch (sortBy) {
        case "status":
          return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        case "priority":
          return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        case "due_date":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case "created_at":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "title":
          return (a.title ?? "").localeCompare(b.title ?? "", "ko");
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, statusFilter, priorityFilter, sortBy, search, showDone]);

  const doneCount = tasks.filter(t => t.status === "done").length;
  const activeCount = tasks.filter(t => t.status !== "done").length;

  const selectStyle = {
    background: "var(--bg-3)",
    border: "1px solid var(--border)",
    color: "var(--text-2)",
    borderRadius: 8,
    padding: "5px 8px",
    fontSize: 12,
    outline: "none",
    colorScheme: "dark" as const,
  };

  return (
    <div className="space-y-3">
      {/* 필터/정렬 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 검색 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="업무 검색…"
          className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-1)", width: 150 }}
        />

        {/* 상태 필터 */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* 우선순위 필터 */}
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={selectStyle}>
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* 정렬 */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* 완료 토글 */}
        {statusFilter === "all" && doneCount > 0 && (
          <button
            onClick={() => setShowDone(v => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs transition-all"
            style={{
              background: showDone ? "rgba(52,211,153,0.12)" : "var(--bg-3)",
              color: showDone ? "#34d399" : "var(--text-3)",
              border: `1px solid ${showDone ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
            }}>
            완료 {showDone ? "숨기기" : `보기 (${doneCount})`}
          </button>
        )}

        <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
          {filtered.length}건
        </span>
      </div>

      {/* 업무 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl px-4 py-8 text-center"
          style={{ background: "var(--bg-2)", border: "1px dashed var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {tasks.length === 0 ? "업무 없음" : "조건에 맞는 업무 없음"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
