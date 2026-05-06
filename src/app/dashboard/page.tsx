// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import DashboardStats from "@/components/dashboard/DashboardStats";
import TaskList from "@/components/tasks/TaskList";
import TaskForm from "@/components/tasks/TaskForm";

export default function DashboardPage() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [blockedTasks, setBlockedTasks] = useState<any[]>([]);
  const [todayTasks,   setTodayTasks]   = useState<any[]>([]);
  const [reviewTasks,  setReviewTasks]  = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);

  const load = useCallback(async () => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const sel = "*, assignee:users!tasks_assignee_id_fkey(name,avatar_url), project:projects(name)";
    const [{ data: b }, { data: t }, { data: r }, { data: o }] = await Promise.all([
      supabase.from("tasks").select(sel).eq("status","blocked"),
      supabase.from("tasks").select(sel).lte("due_date", todayEnd.toISOString()).not("status","eq","done").order("due_date"),
      supabase.from("tasks").select(sel).eq("status","review"),
      supabase.from("tasks").select(sel).lt("due_date", new Date().toISOString()).not("status","eq","done"),
    ]);
    setBlockedTasks(b ?? []);
    setTodayTasks(t ?? []);
    setReviewTasks(r ?? []);
    setOverdueTasks(o ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = {
    todayCount: todayTasks.length, blockedCount: blockedTasks.length,
    reviewCount: reviewTasks.length, overdueCount: overdueTasks.length,
  };

  const Section = ({ title, color, tasks }: { title: string; color: string; tasks: any[] }) => (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full" style={{ background: color }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>{title}</h2>
        <span className="text-xs px-1.5 py-0.5 rounded-full tabular-nums"
          style={{ background: `${color}18`, color }}>{tasks.length}</span>
      </div>
      <TaskList tasks={tasks} onRefresh={load} />
    </section>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>대시보드</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="rounded-lg px-4 py-2 text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #00C2CC, #2E86FF)",
            color: "#fff",
            boxShadow: "0 0 16px rgba(0,194,204,0.25)",
          }}>
          + 새 업무
        </button>
      </div>

      <DashboardStats stats={stats} />

      {blockedTasks.length > 0 && <Section title="Blocked 업무" color="var(--red)" tasks={blockedTasks} />}
      {todayTasks.length > 0 && <Section title="오늘 마감" color="var(--amber)" tasks={todayTasks} />}
      {reviewTasks.length > 0 && <Section title="Review 대기" color="var(--cyan)" tasks={reviewTasks} />}

      {blockedTasks.length === 0 && todayTasks.length === 0 && reviewTasks.length === 0 && (
        <div className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
          <p className="text-2xl mb-2">✦</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-2)" }}>오늘은 긴급 업무가 없습니다</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>전체 업무에서 진행 상황을 확인하세요</p>
        </div>
      )}

      {open && <TaskForm onClose={() => setOpen(false)} onCreated={() => { load(); setOpen(false); }} />}
    </div>
  );
}
