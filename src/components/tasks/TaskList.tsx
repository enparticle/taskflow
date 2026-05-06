// @ts-nocheck
"use client";
import TaskCard from "./TaskCard";

export default function TaskList({ tasks, onRefresh }: { tasks: any[]; onRefresh: () => void }) {
  // 디버그: 첫 번째 업무의 assignees 확인
  if (tasks.length > 0) {
    console.log("[TaskList] first task assignees:", tasks[0].assignees, "assignee_ids:", tasks[0].assignee_ids);
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl px-4 py-8 text-center"
        style={{ background: "var(--bg-2)", border: "1px dashed var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>업무 없음</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {tasks.map(task => <TaskCard key={task.id} task={task} onRefresh={onRefresh} />)}
    </div>
  );
}
