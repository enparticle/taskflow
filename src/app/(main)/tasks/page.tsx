// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { loadTasksWithAssignees } from "@/lib/tasks";
import TaskList from "@/components/tasks/TaskList";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";

const STATUS_FILTERS = [
  { value: "all",     label: "?„ì²´" },
  { value: "todo",    label: "???? },
  { value: "doing",   label: "ì§„í–‰ ì¤? },
  { value: "blocked", label: "Blocked" },
  { value: "review",  label: "ë¦¬ë·°" },
  { value: "done",    label: "?„ë£Œ" },
];

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

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>?…ë¬´</h1>
          </div>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <button onClick={() => setMyOnly(false)}
              className="rounded-lg px-3 py-1 text-xs font-medium transition-all"
              style={{ background: !myOnly ? "var(--bg-4)" : "transparent", color: !myOnly ? "var(--text-1)" : "var(--text-3)", border: !myOnly ? "1px solid var(--border-2)" : "1px solid transparent" }}>
              ?„ì²´
            </button>
            <button onClick={() => setMyOnly(true)}
              className="rounded-lg px-3 py-1 text-xs font-medium transition-all"
              style={{ background: myOnly ? "var(--bg-4)" : "transparent", color: myOnly ? "var(--text-1)" : "var(--text-3)", border: myOnly ? "1px solid var(--border-2)" : "1px solid transparent" }}>
              ???…ë¬´
            </button>
          </div>
        </div>
        <button onClick={() => setOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, var(--cyan), #2E86FF)", color: "#fff" }}>
          + ???…ë¬´
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filter === f.value ? "var(--cyan-bg)" : "var(--bg-2)",
              color: filter === f.value ? "var(--cyan)" : "var(--text-3)",
              border: `1px solid ${filter === f.value ? "var(--cyan)" : "var(--border)"}`,
            }}>
            {f.label}
            {filter === f.value && tasks.length > 0 && <span className="ml-1.5 opacity-70">{tasks.length}</span>}
          </button>
        ))}
      </div>

      <TaskList tasks={tasks} onRefresh={load} onTaskClick={(id: string) => setOpenDetail(id)} />

      {open && <TaskForm onClose={() => setOpen(false)} onSaved={() => { load(); setOpen(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={load} />}
    </div>
  );
}

