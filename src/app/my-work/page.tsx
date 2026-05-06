// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import TaskList from "@/components/tasks/TaskList";

export default function MyWorkPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: users } = await supabase.from("users").select("id").limit(1);
    const userId = users?.[0]?.id;
    if (!userId) return;
    const { data } = await supabase
      .from("tasks")
      .select("*, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)")
      .eq("assignee_id", userId)
      .not("status", "eq", "done")
      .order("due_date", { ascending: true, nullsFirst: false });
    setTasks(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">내 업무</h1>
      <TaskList tasks={tasks} onRefresh={load} />
    </div>
  );
}
