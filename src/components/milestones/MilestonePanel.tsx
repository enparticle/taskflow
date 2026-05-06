// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned:     { label: "계획",   color: "#7BA7C8", bg: "rgba(123,167,200,0.12)" },
  in_progress: { label: "진행 중", color: "#2E86FF", bg: "rgba(46,134,255,0.15)" },
  completed:   { label: "완료",   color: "#00D4A0", bg: "rgba(0,212,160,0.15)" },
  cancelled:   { label: "취소",   color: "#4A7099", bg: "rgba(74,112,153,0.10)" },
};

const fieldStyle = {
  background: "var(--bg-3)", border: "1px solid var(--border-2)",
  color: "var(--text-1)", borderRadius: "8px", padding: "6px 10px",
  fontSize: "12px", width: "100%", outline: "none",
};

interface Props { projectId: string; }

export default function MilestonePanel({ projectId }: Props) {
  const supabase = createClient();
  const [milestones, setMilestones] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", start_date: "", due_date: "", status: "planned" });

  const load = useCallback(async () => {
    const { data } = await supabase.from("milestones").select("*")
      .eq("project_id", projectId).order("sort_order").order("due_date");
    setMilestones(data ?? []);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({ title: "", description: "", start_date: "", due_date: "", status: "planned" });
    setAdding(false); setEditing(null);
  };

  async function save() {
    if (!form.title.trim()) return;
    if (editing) {
      await supabase.from("milestones").update({
        title: form.title.trim(), description: form.description || null,
        start_date: form.start_date || null, due_date: form.due_date || null,
        status: form.status,
      }).eq("id", editing);
    } else {
      await supabase.from("milestones").insert({
        project_id: projectId, title: form.title.trim(),
        description: form.description || null,
        start_date: form.start_date || null, due_date: form.due_date || null,
        status: form.status, sort_order: milestones.length,
      });
    }
    reset(); load();
  }

  async function remove(id: string) {
    if (!confirm("마일스톤을 삭제할까요?")) return;
    await supabase.from("milestones").delete().eq("id", id);
    load();
  }

  function startEdit(m: any) {
    setEditing(m.id);
    setForm({
      title: m.title, description: m.description ?? "",
      start_date: m.start_date ?? "", due_date: m.due_date ?? "",
      status: m.status,
    });
    setAdding(true);
  }

  return (
    <div className="space-y-2">
      {milestones.map(m => {
        const cfg = STATUS_CONFIG[m.status];
        const isOverdue = m.due_date && m.status !== "completed" && new Date(m.due_date) < new Date();
        return editing === m.id && adding ? (
          <MilestoneEditForm key={m.id} form={form} set={set} onSave={save} onCancel={reset} />
        ) : (
          <div key={m.id} className="flex items-center gap-3 rounded-xl px-4 py-3 group"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            {/* 상태 토글 */}
            <button onClick={async () => {
              const next: Record<string, string> = { planned: "in_progress", in_progress: "completed", completed: "planned", cancelled: "planned" };
              await supabase.from("milestones").update({ status: next[m.status] }).eq("id", m.id);
              load();
            }}
              className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{ borderColor: cfg.color, background: m.status === "completed" ? cfg.color : "transparent" }}>
              {m.status === "completed" && <span style={{ color: "#0D1B2E", fontSize: 10, fontWeight: 700 }}>✓</span>}
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate"
                style={{ color: m.status === "completed" ? "var(--text-3)" : "var(--text-1)",
                  textDecoration: m.status === "completed" ? "line-through" : undefined }}>
                {m.title}
              </p>
              {m.description && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{m.description}</p>
              )}
            </div>

            <span className="shrink-0 text-xs px-2 py-0.5 rounded-md"
              style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>

            <div className="shrink-0 flex items-center gap-2">
              {m.start_date && (
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  {new Date(m.start_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              )}
              {m.start_date && m.due_date && <span style={{ color: "var(--text-3)", fontSize: 10 }}>→</span>}
              {m.due_date && (
                <span className="text-xs font-medium"
                  style={{ color: isOverdue ? "var(--red)" : "var(--text-3)" }}>
                  {isOverdue ? "⚠ " : ""}{new Date(m.due_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(m)}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>수정</button>
              <button onClick={() => remove(m.id)}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--red-bg)", color: "var(--red)" }}>삭제</button>
            </div>
          </div>
        );
      })}

      {adding && !editing && (
        <MilestoneEditForm form={form} set={set} onSave={save} onCancel={reset} />
      )}

      {!adding && (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-xl py-2.5 text-xs font-medium transition-all"
          style={{ background: "transparent", border: "1px dashed var(--border-2)", color: "var(--text-3)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}>
          + 마일스톤 추가
        </button>
      )}
    </div>
  );
}

function MilestoneEditForm({ form, set, onSave, onCancel }: {
  form: any; set: (k: string, v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  const fs = { background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)", borderRadius: "6px", padding: "5px 8px", fontSize: "12px", outline: "none" };
  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
      <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
        placeholder="마일스톤 이름 *" style={{ ...fs, width: "100%" }} autoFocus />
      <input type="text" value={form.description} onChange={e => set("description", e.target.value)}
        placeholder="설명 (선택)" style={{ ...fs, width: "100%" }} />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)}
          style={fs} />
        <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)}
          style={fs} />
        <select value={form.status} onChange={e => set("status", e.target.value)} style={fs}>
          <option value="planned">계획</option>
          <option value="in_progress">진행 중</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs"
          style={{ background: "var(--bg-4)", color: "var(--text-2)" }}>취소</button>
        <button onClick={onSave} disabled={!form.title.trim()}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-30"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>저장</button>
      </div>
    </div>
  );
}
