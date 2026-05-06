"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { loadTasksWithAssignees } from "@/lib/tasks";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";

const STATUS_FILTERS = [
  { value: "all",     label: "전체" },
  { value: "todo",    label: "할 일" },
  { value: "doing",   label: "진행 중" },
  { value: "blocked", label: "Blocked" },
  { value: "review",  label: "리뷰" },
  { value: "done",    label: "완료" },
];

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    let q = supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await loadTasksWithAssignees(q);
    setTasks(data);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--blue)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>전체 업무</h1>
          <span className="text-xs px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>{tasks.length}</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
          + 새 업무
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        {STATUS_FILTERS.map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-all"
            style={{
              background: filter === value ? "var(--bg-4)" : "transparent",
              color: filter === value ? "var(--text-1)" : "var(--text-3)",
              border: filter === value ? "1px solid var(--border-2)" : "1px solid transparent",
            }}>
            {label}
          </button>
        ))}
      </div>

      <TaskList tasks={tasks} onRefresh={load} />
      {open && <TaskForm onClose={() => setOpen(false)} onCreated={() => { load(); setOpen(false); }} />}
    </div>
  );
}
