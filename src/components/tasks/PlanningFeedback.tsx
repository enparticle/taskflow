// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface FeedbackItem {
  type: "overload" | "deadline" | "blocked" | "no_estimate";
  level: "danger" | "warning" | "info";
  title: string;
  detail: string;
  taskId?: string;
  userId?: string;
}

const LEVEL_CONFIG = {
  danger:  { color: "#FF4D6A", bg: "rgba(255,77,106,0.08)",  border: "rgba(255,77,106,0.2)",  icon: "⊘" },
  warning: { color: "#F5A623", bg: "rgba(245,166,35,0.08)",  border: "rgba(245,166,35,0.2)",  icon: "⚠" },
  info:    { color: "#7BA7C8", bg: "rgba(123,167,200,0.08)", border: "rgba(123,167,200,0.2)", icon: "ℹ" },
};

export default function PlanningFeedback({ onTaskClick }: { onTaskClick?: (id: string) => void }) {
  const supabase = createClient();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function analyze() {
      setLoading(true);
      const now = new Date();
      const feedback: FeedbackItem[] = [];

      // 전체 진행 중 업무
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*, assignee:users!tasks_assignee_id_fkey(name)")
        .not("status", "eq", "done")
        .not("status", "eq", "cancelled");

      if (!tasks) { setLoading(false); return; }

      // 1. 마감 임박 (3일 이내)
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 3);
      const deadline = tasks.filter(t =>
        t.due_date && new Date(t.due_date) <= soon && new Date(t.due_date) >= now
      );
      const overdue = tasks.filter(t =>
        t.due_date && new Date(t.due_date) < now
      );

      if (overdue.length > 0) {
        feedback.push({
          type: "deadline", level: "danger",
          title: `마감 초과 ${overdue.length}건`,
          detail: overdue.slice(0, 3).map(t => t.title).join(", ") + (overdue.length > 3 ? ` 외 ${overdue.length - 3}건` : ""),
          taskId: overdue[0]?.id,
        });
      }
      if (deadline.length > 0) {
        feedback.push({
          type: "deadline", level: "warning",
          title: `3일 내 마감 ${deadline.length}건`,
          detail: deadline.slice(0, 3).map(t => t.title).join(", ") + (deadline.length > 3 ? ` 외 ${deadline.length - 3}건` : ""),
          taskId: deadline[0]?.id,
        });
      }

      // 2. Blocked 장기 지속 (2일 이상)
      const { data: blockedEvents } = await supabase
        .from("task_events")
        .select("task_id, changed_at")
        .eq("to_status", "blocked")
        .order("changed_at", { ascending: false });

      if (blockedEvents) {
        const blockedMap: Record<string, Date> = {};
        blockedEvents.forEach(e => {
          if (!blockedMap[e.task_id]) blockedMap[e.task_id] = new Date(e.changed_at);
        });

        const longBlocked = tasks
          .filter(t => t.status === "blocked" && blockedMap[t.id])
          .filter(t => {
            const days = (now.getTime() - blockedMap[t.id].getTime()) / (1000 * 60 * 60 * 24);
            return days >= 2;
          });

        if (longBlocked.length > 0) {
          feedback.push({
            type: "blocked", level: "danger",
            title: `Blocked 2일+ ${longBlocked.length}건`,
            detail: longBlocked.slice(0, 3).map(t => {
              const days = Math.floor((now.getTime() - blockedMap[t.id].getTime()) / (1000 * 60 * 60 * 24));
              return `${t.title} (${days}일)`;
            }).join(", "),
            taskId: longBlocked[0]?.id,
          });
        }
      }

      // 3. 예상 시간 미입력
      const noEstimate = tasks.filter(t =>
        !t.estimated_hours && t.status !== "backlog"
      );
      if (noEstimate.length > 0) {
        feedback.push({
          type: "no_estimate", level: "info",
          title: `예상 시간 미입력 ${noEstimate.length}건`,
          detail: "업무 계획 정확도를 높이려면 예상 시간을 입력해주세요",
        });
      }

      // 4. 업무량 과부하 (담당자별 진행 중 5건 이상)
      const { data: users } = await supabase
        .from("users").select("id, name").eq("is_active", true);

      if (users) {
        const overloaded = users
          .map(u => ({
            ...u,
            count: tasks.filter(t =>
              (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) &&
              t.status === "doing"
            ).length,
          }))
          .filter(u => u.count >= 5)
          .sort((a, b) => b.count - a.count);

        if (overloaded.length > 0) {
          feedback.push({
            type: "overload", level: "warning",
            title: `업무 과부하 ${overloaded.length}명`,
            detail: overloaded.map(u => `${u.name} (진행 중 ${u.count}건)`).join(", "),
            userId: overloaded[0]?.id,
          });
        }
      }

      setItems(feedback);
      setLoading(false);
    }
    analyze();
  }, []);

  if (loading) return null;
  if (items.length === 0) return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-2"
      style={{ background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.15)" }}>
      <span style={{ color: "#00D4A0" }}>✓</span>
      <p className="text-xs font-medium" style={{ color: "#00D4A0" }}>
        현재 주의가 필요한 항목이 없습니다
      </p>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border-2)", background: "var(--bg-2)" }}>
      {/* 헤더 */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ borderBottom: collapsed ? "none" : "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#F5A623", boxShadow: "0 0 6px #F5A623" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
            Planning Feedback
          </p>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: items.some(i => i.level === "danger") ? "rgba(255,77,106,0.15)" : "rgba(245,166,35,0.15)",
              color: items.some(i => i.level === "danger") ? "#FF4D6A" : "#F5A623",
            }}>
            {items.length}개 항목
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>
          {collapsed ? "▾" : "▴"}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {items.map((item, i) => {
            const cfg = LEVEL_CONFIG[item.level];
            return (
              <div key={i}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: item.taskId ? "pointer" : "default" }}
                onClick={() => item.taskId && onTaskClick?.(item.taskId)}
                onMouseEnter={e => { if (item.taskId) (e.currentTarget as HTMLDivElement).style.opacity = "0.8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}>
                <span className="shrink-0 text-sm mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: cfg.color }}>{item.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{item.detail}</p>
                </div>
                {item.taskId && (
                  <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>→</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
