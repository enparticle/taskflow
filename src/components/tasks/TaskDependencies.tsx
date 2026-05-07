// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const STATUS_COLOR: Record<string, string> = {
  backlog: "#4A7099", todo: "#7BA7C8", doing: "#2E86FF",
  blocked: "#FF4D6A", review: "#F5A623", done: "#00D4A0",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰", done: "완료",
};

export default function TaskDependencies({ taskId, projectId }: { taskId: string; projectId?: string }) {
  const supabase = createClient();
  const [deps, setDeps] = useState<any[]>([]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    // 이 업무가 의존하는 업무들
    const { data: d } = await supabase
      .from("task_dependencies")
      .select("*, depends_on:tasks!task_dependencies_depends_on_id_fkey(id,title,status)")
      .eq("task_id", taskId);
    setDeps(d ?? []);

    // 이 업무에 의존하는 업무들
    const { data: dt } = await supabase
      .from("task_dependencies")
      .select("*, task:tasks!task_dependencies_task_id_fkey(id,title,status)")
      .eq("depends_on_id", taskId);
    setDependents(dt ?? []);

    // 추가 가능한 업무 목록
    let q = supabase.from("tasks").select("id, title, status").not("id", "eq", taskId).not("status", "eq", "done");
    if (projectId) q = q.eq("project_id", projectId);
    const { data: tasks } = await q.limit(50);
    setAllTasks(tasks ?? []);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function addDep() {
    if (!selectedId) return;
    await supabase.from("task_dependencies").upsert({ task_id: taskId, depends_on_id: selectedId }, { onConflict: "task_id,depends_on_id" });
    setShowAdd(false); setSelectedId("");
    load();
  }

  async function removeDep(id: string) {
    await supabase.from("task_dependencies").delete().eq("id", id);
    load();
  }

  const addableIds = [...deps.map(d => d.depends_on_id), ...dependents.map(d => d.task_id), taskId];
  const addable = allTasks.filter(t => !addableIds.includes(t.id));
  const isBlocked = deps.some(d => d.depends_on?.status !== "done");

  return (
    <div className="space-y-3">
      {/* 선행 업무 (이 업무가 의존하는) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
            선행 업무 {deps.length > 0 && isBlocked && <span style={{ color: "#FF4D6A" }}>· 완료되지 않은 선행 업무 있음</span>}
          </p>
          <button onClick={() => setShowAdd(!showAdd)}
            className="text-xs px-2 py-0.5 rounded-lg transition-all"
            style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
            + 추가
          </button>
        </div>

        {showAdd && (
          <div className="flex gap-2 mb-2">
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
              style={{ background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF", colorScheme: "dark" }}>
              <option value="">선행 업무 선택</option>
              {addable.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button onClick={addDep} disabled={!selectedId}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
              추가
            </button>
            <button onClick={() => { setShowAdd(false); setSelectedId(""); }}
              className="rounded-lg px-2 py-1.5 text-xs"
              style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>취소</button>
          </div>
        )}

        {deps.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-3)" }}>선행 업무 없음</p>
        ) : (
          <div className="space-y-1.5">
            {deps.map(d => {
              const isDone = d.depends_on?.status === "done";
              const color = STATUS_COLOR[d.depends_on?.status] ?? "#7BA7C8";
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg px-3 py-2 group"
                  style={{ background: "var(--bg-3)", border: `1px solid ${isDone ? "rgba(0,212,160,0.2)" : "rgba(255,77,106,0.2)"}` }}>
                  <span style={{ color, fontSize: 12 }}>{isDone ? "✓" : "○"}</span>
                  <span className="flex-1 text-xs truncate" style={{ color: "var(--text-1)", textDecoration: isDone ? "line-through" : undefined }}>
                    {d.depends_on?.title}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${color}18`, color }}>
                    {STATUS_LABEL[d.depends_on?.status]}
                  </span>
                  <button onClick={() => removeDep(d.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs"
                    style={{ color: "var(--red)" }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 후행 업무 (이 업무에 의존하는) */}
      {dependents.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-3)" }}>후행 업무 (이 업무 완료 후 시작 가능)</p>
          <div className="space-y-1.5">
            {dependents.map(d => {
              const color = STATUS_COLOR[d.task?.status] ?? "#7BA7C8";
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                  <span style={{ color: "#4A7099", fontSize: 12 }}>→</span>
                  <span className="flex-1 text-xs truncate" style={{ color: "var(--text-2)" }}>{d.task?.title}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${color}18`, color }}>
                    {STATUS_LABEL[d.task?.status]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
