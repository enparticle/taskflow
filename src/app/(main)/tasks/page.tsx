// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { loadTasksWithAssignees } from "@/lib/tasks";
import TaskList from "@/components/tasks/TaskList";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";

const STATUS_FILTERS = [
  { value: "all",     label: "전체" },
  { value: "todo",    label: "할 일" },
  { value: "doing",   label: "진행 중" },
  { value: "blocked", label: "Blocked" },
  { value: "review",  label: "리뷰" },
  { value: "done",    label: "완료" },
];

const STATUS_COLOR: Record<string, string> = {
  all: "var(--cyan)", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [myOnly, setMyOnly] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/auth").then(({ getAuthUser }) => {
      getAuthUser().then(u => { if (u) setMyUserId(u.userId); });
    });
  }, []);

  const load = useCallback(async () => {
    let q = supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await loadTasksWithAssignees(q);
    const ORDER: Record<string, number> = { doing: 0, todo: 1, review: 2, blocked: 3, backlog: 4, done: 5 };
    const filtered = myOnly && myUserId
      ? (data ?? []).filter((t: any) => t.assignee_id === myUserId || (t.assignee_ids ?? []).includes(myUserId))
      : (data ?? []);
    const sorted = filtered.sort((a: any, b: any) => {
      const oa = ORDER[a.status] ?? 9, ob = ORDER[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    setTasks(sorted);
  }, [filter, myOnly, myUserId]);

  useEffect(() => { load(); }, [load]);

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === "all" ? tasks.length : tasks.filter(t => t.status === f.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>업무</h1>
          </div>
          {/* 전체 / 내 업무 토글 */}
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
            {[{ v: false, l: "전체" }, { v: true, l: "내 업무" }].map(({ v, l }) => (
              <button key={String(v)} onClick={() => setMyOnly(v)}
                style={{
                  padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  background: myOnly === v ? "var(--bg-4)" : "transparent",
                  color: myOnly === v ? "var(--text-1)" : "var(--text-3)",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setOpen(true)}
          style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          + 업무 추가
        </button>
      </div>

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(f => {
          const active = filter === f.value;
          const color = STATUS_COLOR[f.value] ?? "var(--cyan)";
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: `1px solid ${active ? color : "var(--border)"}`,
                background: active ? `${color}12` : "var(--bg-2)",
                color: active ? color : "var(--text-3)",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 5,
              }}>
              {f.label}
              {counts[f.value] > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  background: active ? color : "var(--bg-4)",
                  color: active ? "#fff" : "var(--text-3)",
                  borderRadius: 10, padding: "1px 6px",
                }}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 업무 목록 */}
      {tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>
            {myOnly ? "담당 업무가 없습니다" : "업무가 없습니다"}
          </p>
          <button onClick={() => setOpen(true)}
            style={{ marginTop: 12, padding: "7px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            + 업무 추가
          </button>
        </div>
      ) : (
        <TaskList tasks={tasks} onRefresh={load} onTaskClick={(id: string) => setOpenDetail(id)} />
      )}

      {open && <TaskForm onClose={() => setOpen(false)} onSaved={() => { load(); setOpen(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={load} />}
    </div>
  );
}
