// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#f87171", high: "#fbbf24", medium: "#60a5fa", low: "#4A7099"
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "긴급", high: "높음", medium: "보통", low: "낮음"
};

export default function TaskDraftPanel({ projectId, onApproved }: { projectId: string; onApproved?: () => void }) {
  const supabase = createClient();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("task_drafts")
      .select("*, submitted_user:users!task_drafts_submitted_by_fkey(name), assignee:users!task_drafts_assignee_id_fkey(name)")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDrafts(data ?? []);

    const { data: u } = await supabase.from("users").select("id, name").eq("is_active", true).neq("role", "viewer");
    setUsers(u ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function approve(draft: any) {
    setProcessing(draft.id);
    const form = editingId === draft.id ? editForm : draft;
    await supabase.from("tasks").insert({
      title: form.title,
      task_type: form.task_type ?? "other",
      priority: form.priority ?? "medium",
      status: form.is_blocked ? "blocked" : "todo",
      blocked_reason: form.is_blocked ? form.blocked_reason : null,
      due_date: form.due_date ?? null,
      assignee_id: form.assignee_id ?? null,
      assignee_ids: form.assignee_ids ?? [],
      project_id: projectId,
    });
    await supabase.from("task_drafts").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", draft.id);
    setEditingId(null);
    setProcessing(null);
    await load();
    onApproved?.();
  }

  async function reject(id: string) {
    if (!confirm("이 업무를 반려하시겠습니까?")) return;
    setProcessing(id);
    await supabase.from("task_drafts").update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    setProcessing(null);
    await load();
  }

  function startEdit(draft: any) {
    setEditingId(draft.id);
    setEditForm({
      title: draft.title,
      priority: draft.priority,
      task_type: draft.task_type,
      due_date: draft.due_date ?? "",
      assignee_id: draft.assignee_id ?? "",
      assignee_ids: draft.assignee_ids ?? [],
      is_blocked: draft.is_blocked ?? false,
      blocked_reason: draft.blocked_reason ?? "",
    });
  }

  if (loading) return null;
  if (drafts.length === 0) return null;

  const FS = {
    background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)",
    borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", colorScheme: "dark" as const,
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(96,165,250,0.3)" }}>
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ background: "rgba(96,165,250,0.08)", borderBottom: "1px solid rgba(96,165,250,0.2)" }}>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
        <p className="text-sm font-semibold" style={{ color: "#60a5fa" }}>
          📋 회의록 업무 검토 대기 {drafts.length}건
        </p>
        <p className="text-xs" style={{ color: "var(--text-3)" }}>승인하면 프로젝트 업무에 추가됩니다</p>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {drafts.map(draft => (
          <div key={draft.id} className="p-4" style={{ background: "var(--bg-2)" }}>
            {editingId === draft.id ? (
              // 수정 모드
              <div className="space-y-3">
                <input value={editForm.title} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none font-medium"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>우선순위</label>
                    <select value={editForm.priority} onChange={e => setEditForm((f: any) => ({ ...f, priority: e.target.value }))} style={{ ...FS, width: "100%" }}>
                      {["urgent","high","medium","low"].map(v => <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>담당자</label>
                    <select value={editForm.assignee_id ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, assignee_id: e.target.value || null }))} style={{ ...FS, width: "100%" }}>
                      <option value="">없음</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>마감일</label>
                    <input type="date" value={editForm.due_date ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, due_date: e.target.value || null }))} style={{ ...FS, width: "100%" }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(draft)} disabled={!editForm.title?.trim() || processing === draft.id}
                    className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    ✓ 수정 후 승인
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>취소</button>
                </div>
              </div>
            ) : (
              // 일반 모드
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{draft.title}</p>
                    <span className="text-xs font-semibold" style={{ color: PRIORITY_COLORS[draft.priority] ?? "#60a5fa" }}>
                      {PRIORITY_LABELS[draft.priority] ?? draft.priority}
                    </span>
                    {draft.is_blocked && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>Blocked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {draft.assignee?.name && (
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>담당: {draft.assignee.name}</span>
                    )}
                    {draft.due_date && (
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>
                        마감: {new Date(draft.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {draft.submitted_user?.name && (
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>제출: {draft.submitted_user.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(draft)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                    수정
                  </button>
                  <button onClick={() => approve(draft)} disabled={processing === draft.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    {processing === draft.id ? "…" : "✓ 승인"}
                  </button>
                  <button onClick={() => reject(draft.id)} disabled={processing === draft.id}
                    className="rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>
                    반려
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
