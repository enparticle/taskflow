"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { User, Project } from "@/types/database";

const TYPES = [
  { value: "planning", label: "기획" }, { value: "design", label: "디자인" },
  { value: "development", label: "개발" }, { value: "qa", label: "QA" },
  { value: "operation", label: "운영" }, { value: "documentation", label: "문서화" },
  { value: "meeting", label: "회의" }, { value: "research", label: "리서치" },
  { value: "customer", label: "고객 대응" }, { value: "other", label: "기타" },
];
const PRIORITIES = [
  { value: "low", label: "낮음" }, { value: "medium", label: "보통" },
  { value: "high", label: "높음" }, { value: "urgent", label: "긴급" },
];

const fieldStyle = {
  background: "#1E2435", border: "1px solid #2A5080",
  color: "#E8F4FF", borderRadius: "8px", padding: "8px 12px",
  fontSize: "13px", width: "100%", outline: "none",
  colorScheme: "dark" as const,
};

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultProjectId?: string;
}

export default function TaskForm({ onClose, onCreated, defaultProjectId }: Props) {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    title: "", description: "", task_type: "planning", priority: "medium",
    assignee_ids: [] as string[], project_id: defaultProjectId ?? "",
    due_date: "", estimated_hours: "",
  });

  useEffect(() => {
    supabase.from("users").select("*").eq("is_active", true).then(({ data }) => { if (data) setUsers(data); });
    supabase.from("projects").select("*").eq("status", "active").then(({ data }) => { if (data) setProjects(data); });
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setShowAssigneeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function toggleAssignee(userId: string) {
    setForm(f => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(userId)
        ? f.assignee_ids.filter(id => id !== userId)
        : [...f.assignee_ids, userId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("업무명을 입력해주세요"); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.from("tasks").insert({
      title: form.title.trim(), description: form.description || null,
      task_type: form.task_type as any, priority: form.priority as any,
      assignee_id: form.assignee_ids[0] || null,
      assignee_ids: form.assignee_ids,
      project_id: form.project_id || null,
      due_date: form.due_date || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      status: "todo",
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onCreated();
  }

  const selectedUsers = users.filter(u => form.assignee_ids.includes(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(7,13,24,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)",
          boxShadow: "0 0 40px rgba(0,194,204,0.08), 0 20px 60px rgba(0,0,0,0.6)" }}>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>새 업무 등록</h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: "18px" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>업무명 *</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="업무명을 입력하세요" style={fieldStyle} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>설명</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="업무 설명 (선택)" rows={2} style={{ ...fieldStyle, resize: "none" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>업무 유형</label>
              <select value={form.task_type} onChange={e => set("task_type", e.target.value)} style={fieldStyle}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>우선순위</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={fieldStyle}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* 담당자 다중 선택 */}
          <div ref={assigneeRef}>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>담당자 (복수 선택 가능)</label>
            <div className="relative">
              <button type="button" onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)", minHeight: 38 }}>
                {selectedUsers.length === 0 ? (
                  <span style={{ color: "var(--text-3)" }}>담당자 선택</span>
                ) : (
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedUsers.map(u => (
                      <span key={u.id} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
                        {u.name}
                        <span onClick={e => { e.stopPropagation(); toggleAssignee(u.id); }}
                          className="cursor-pointer hover:opacity-60" style={{ fontSize: 10 }}>✕</span>
                      </span>
                    ))}
                  </div>
                )}
                <span style={{ color: "var(--text-3)", marginLeft: "auto", fontSize: 10 }}>▾</span>
              </button>

              {showAssigneeMenu && (
                <div className="absolute left-0 top-10 z-30 w-full rounded-xl overflow-hidden shadow-2xl"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
                  {users.map(u => {
                    const selected = form.assignee_ids.includes(u.id);
                    return (
                      <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-xs transition-colors"
                        style={{ background: selected ? "var(--cyan-bg)" : "transparent", color: selected ? "var(--cyan)" : "var(--text-2)" }}
                        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
                        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: selected ? "var(--cyan)" : "var(--bg-4)", color: selected ? "#0D1B2E" : "var(--text-2)" }}>
                          {u.name[0]}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{u.name}</p>
                          {u.level && <p style={{ color: "var(--text-3)", fontSize: 10 }}>{u.level}</p>}
                        </div>
                        {selected && <span style={{ color: "var(--cyan)", fontSize: 12 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>프로젝트</label>
            <select value={form.project_id} onChange={e => set("project_id", e.target.value)} style={fieldStyle}>
              <option value="">없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>마감일</label>
              <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>예상 시간</label>
              <input type="number" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)}
                placeholder="시간 (예: 4)" min="0.5" step="0.5" style={fieldStyle} />
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium"
              style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>
              취소
            </button>
            <button type="submit" disabled={loading}
              className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff",
                boxShadow: loading ? "none" : "0 0 16px rgba(0,194,204,0.3)" }}>
              {loading ? "등록 중…" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
