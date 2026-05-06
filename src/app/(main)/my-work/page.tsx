"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { loadTasksWithAssignees } from "@/lib/tasks";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";

export default function MyWorkPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);
  const [myUser, setMyUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // auth_id로 연결된 구성원 찾기
    const { data: linked } = await supabase
      .from("users").select("*").eq("auth_id", user.id).single();

    if (!linked) {
      setNotLinked(true);
      return;
    }

    setMyUser(linked);

    const q = supabase.from("tasks")
      .select("*, assignee_ids, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .or(`assignee_id.eq.${linked.id},assignee_ids.cs.{${linked.id}}`)
      .not("status", "eq", "done")
      .order("due_date", { ascending: true, nullsFirst: false });

    const { data } = await loadTasksWithAssignees(q);
    setTasks(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (notLinked) {
    return (
      <div className="max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>내 업무</h1>
        </div>
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>
            구성원 계정이 연결되지 않았습니다
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
            설정에서 로그인 계정과 구성원 프로필을 연결해주세요
          </p>
          <a href="/settings"
            className="inline-block rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
            설정으로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>내 업무</h1>
          {myUser && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
              {myUser.name}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>{tasks.length}</span>
        </div>
        <button onClick={() => setOpen(true)}
          className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff",
            boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
          + 새 업무
        </button>
      </div>
      <TaskList tasks={tasks} onRefresh={load} />
      {open && <TaskForm onClose={() => setOpen(false)} onCreated={() => { load(); setOpen(false); }} />}
    </div>
  );
}
