// @ts-nocheck
"use client";
import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
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

export default function TaskList({
  tasks, onRefresh, onTaskClick,
  milestones, projects, showBulkActions = true,
}: {
  tasks: any[];
  onRefresh: () => void;
  onTaskClick?: (id: string) => void;
  milestones?: any[];
  projects?: any[];
  showBulkActions?: boolean;
}) {
  const supabase = createClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("status");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"milestone" | "project" | "status" | "priority" | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [applying, setApplying] = useState(false);

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (search.trim()) result = result.filter(t => t.title?.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    else if (!showDone) result = result.filter(t => t.status !== "done");
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    result.sort((a, b) => {
      switch (sortBy) {
        case "status": return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        case "priority": return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        case "due_date":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1; if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case "created_at": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "title": return (a.title ?? "").localeCompare(b.title ?? "", "ko");
        default: return 0;
      }
    });
    return result;
  }, [tasks, statusFilter, priorityFilter, sortBy, search, showDone]);

  const doneCount = tasks.filter(t => t.status === "done").length;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  }

  async function applyBulk() {
    if (!bulkValue && bulkAction !== "milestone") return;
    setApplying(true);
    const ids = Array.from(selected);
    let updatePayload: any = {};
    if (bulkAction === "milestone") updatePayload = { milestone_id: bulkValue || null };
    else if (bulkAction === "project") updatePayload = { project_id: bulkValue || null };
    else if (bulkAction === "status") updatePayload = { status: bulkValue };
    else if (bulkAction === "priority") updatePayload = { priority: bulkValue };

    for (const id of ids) {
      await supabase.from("tasks").update(updatePayload).eq("id", id);
    }
    setSelected(new Set());
    setBulkAction(null);
    setBulkValue("");
    setApplying(false);
    onRefresh();
  }

  const SS = {
    background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-2)",
    borderRadius: 8, padding: "5px 8px", fontSize: 12, outline: "none", colorScheme: "dark" as const,
  };

  return (
    <div className="space-y-3">
      {/* 필터/정렬 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="업무 검색…"
          className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-1)", width: 140 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={SS}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={SS}>
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={SS}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {statusFilter === "all" && doneCount > 0 && (
          <button onClick={() => setShowDone(v => !v)} className="rounded-lg px-2.5 py-1.5 text-xs transition-all"
            style={{ background: showDone ? "rgba(52,211,153,0.12)" : "var(--bg-3)", color: showDone ? "#34d399" : "var(--text-3)", border: `1px solid ${showDone ? "rgba(52,211,153,0.3)" : "var(--border)"}` }}>
            완료 {showDone ? "숨기기" : `보기 (${doneCount})`}
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>{filtered.length}건</span>
      </div>

      {/* 일괄 작업 툴바 */}
      {showBulkActions && filtered.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
          {/* 전체 선택 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              checked={selected.size > 0 && selected.size === filtered.length}
              ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
              onChange={toggleSelectAll}
              className="rounded" />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {selected.size > 0 ? `${selected.size}개 선택됨` : "전체 선택"}
            </span>
          </label>

          {selected.size > 0 && (
            <>
              <div className="w-px h-4" style={{ background: "var(--border-2)" }} />

              {/* 일괄 작업 선택 */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  ...(milestones ? [{ value: "milestone", label: "단계 변경" }] : []),
                  ...(projects ? [{ value: "project", label: "프로젝트 변경" }] : []),
                  { value: "status", label: "상태 변경" },
                  { value: "priority", label: "우선순위 변경" },
                ].map(action => (
                  <button key={action.value}
                    onClick={() => { setBulkAction(action.value as any); setBulkValue(""); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: bulkAction === action.value ? "var(--cyan-bg)" : "var(--bg-2)",
                      color: bulkAction === action.value ? "var(--cyan)" : "var(--text-2)",
                      border: `1px solid ${bulkAction === action.value ? "var(--cyan)33" : "var(--border)"}`,
                    }}>
                    {action.label}
                  </button>
                ))}
              </div>

              {/* 값 선택 */}
              {bulkAction && (
                <div className="flex items-center gap-2 ml-auto">
                  {bulkAction === "milestone" && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={SS}>
                      <option value="">미분류</option>
                      {(milestones ?? []).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                  )}
                  {bulkAction === "project" && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={SS}>
                      <option value="">없음</option>
                      {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  {bulkAction === "status" && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={SS}>
                      <option value="">선택</option>
                      {STATUS_OPTIONS.filter(o => o.value !== "all").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {bulkAction === "priority" && (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={SS}>
                      <option value="">선택</option>
                      {PRIORITY_OPTIONS.filter(o => o.value !== "all").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  <button onClick={applyBulk}
                    disabled={applying || (bulkAction !== "milestone" && !bulkValue)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ background: "var(--cyan)", color: "#0D1B2E" }}>
                    {applying ? "적용 중…" : `${selected.size}건 적용`}
                  </button>
                  <button onClick={() => { setBulkAction(null); setBulkValue(""); }}
                    className="text-xs" style={{ color: "var(--text-3)" }}>취소</button>
                </div>
              )}

              {/* 선택 해제 */}
              <button onClick={() => setSelected(new Set())}
                className="text-xs ml-1" style={{ color: "var(--text-3)" }}>✕ 선택 해제</button>
            </>
          )}
        </div>
      )}

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
            <div key={task.id} className="flex items-center gap-2">
              {showBulkActions && (
                <input type="checkbox"
                  checked={selected.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                  className="rounded shrink-0 cursor-pointer"
                  onClick={e => e.stopPropagation()} />
              )}
              <div className="flex-1 min-w-0">
                <TaskCard task={task} onRefresh={onRefresh} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
