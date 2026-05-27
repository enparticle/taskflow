// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const fieldStyle = {
  background: "var(--bg-3)", border: "1px solid var(--border-2)",
  color: "var(--text-1)", borderRadius: "8px", padding: "8px 12px",
  fontSize: "13px", width: "100%", outline: "none", colorScheme: "dark" as const,
};

interface Props {
  project?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProjectForm({ project, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name:        project?.name        ?? "",
    description: project?.description ?? "",
    owner_id:    project?.owner_id    ?? "",
    priority:    project?.priority    ?? "medium",
    health:      project?.health      ?? "good",
    start_date:  project?.start_date  ? project.start_date.split("T")[0] : "",
    end_date:    project?.end_date    ? project.end_date.split("T")[0]   : "",
  });

  useEffect(() => {
    supabase.from("users").select("*").eq("is_active", true)
      .then(({ data }) => { if (data) setUsers(data); });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const [drafting, setDrafting] = useState(false);

  async function aiDraft() {
    if (!form.name.trim()) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/project-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      const data = await res.json();
      if (data.description) set("description", data.description);
      if (data.end_date) set("end_date", data.end_date);
    } catch {}
    setDrafting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("프로젝트명을 입력해주세요"); return; }
    setLoading(true); setError("");
    const payload = {
      name: form.name.trim(), description: form.description || null,
      owner_id: form.owner_id || null, priority: form.priority, health: form.health,
      start_date: form.start_date || null, end_date: form.end_date || null,
      status: "active",
    };
    const { error: err } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload);
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  async function handleComplete() {
    if (!project) return;
    if (!confirm(`"${project.name}" 프로젝트를 완료 처리할까요?\n\n완료된 프로젝트는 대시보드와 뷰어에서 숨겨지고, 프로젝트 목록의 완료 탭에서 확인할 수 있습니다.`)) return;
    setCompleting(true);
    await supabase.from("projects").update({
      status: "completed",
      health: "good",
      end_date: new Date().toISOString().slice(0, 10),
    }).eq("id", project.id);
    setCompleting(false);
    onSaved();
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`"${project.name}" 프로젝트를 삭제할까요?\n관련된 모든 업무와 데이터가 삭제됩니다.`)) return;
    await supabase.from("projects").delete().eq("id", project.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(7,13,24,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", boxShadow: "0 0 40px rgba(0,194,204,0.08), 0 20px 60px rgba(0,0,0,0.6)" }}>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>
              {project ? "프로젝트 수정" : "새 프로젝트 추가"}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: "18px" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>프로젝트명 *</label>
            <div className="flex gap-2">
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="예: enCELL-Pharm 개발, TaskFlow 구축" style={{ ...fieldStyle, flex: 1 }} autoFocus />
              <button type="button" onClick={aiDraft} disabled={drafting || !form.name.trim()}
                className="rounded-lg px-3 text-xs font-semibold disabled:opacity-40 shrink-0"
                style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.3)", whiteSpace: "nowrap" }}>
                {drafting ? "생성 중…" : "✦ AI 초안"}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>설명</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="프로젝트 목표와 범위를 간략히 작성해주세요" rows={3} style={{ ...fieldStyle, resize: "none" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>담당자</label>
              <select value={form.owner_id} onChange={e => set("owner_id", e.target.value)} style={fieldStyle}>
                <option value="">미정</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>우선순위</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={fieldStyle}>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="urgent">긴급</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>시작일</label>
              <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>마감일</label>
              <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} style={fieldStyle} />
            </div>
          </div>

          {project && (
            <div>
              <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-3)" }}>프로젝트 상태</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: "good",      label: "✅ 정상",     color: "#34d399" },
                  { value: "reviewing", label: "🔵 검토 필요", color: "#60a5fa" },
                  { value: "at_risk",   label: "⚠ 주의",     color: "#fbbf24" },
                  { value: "critical",  label: "🔴 위험",     color: "#f87171" },
                  { value: "suspended", label: "⏸ 중단",     color: "#71717a" },
                ].map(h => (
                  <button key={h.value} type="button" onClick={() => set("health", h.value)}
                    className="rounded-lg py-2 text-xs font-semibold transition-all"
                    style={{
                      background: form.health === h.value ? `${h.color}22` : "var(--bg-3)",
                      border: `1px solid ${form.health === h.value ? h.color : "var(--border-2)"}`,
                      color: form.health === h.value ? h.color : "var(--text-3)",
                    }}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

          <div className="flex justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {project && (
                <>
                  {/* 완료 처리 버튼 */}
                  <button type="button" onClick={handleComplete} disabled={completing}
                    className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 transition-all"
                    style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    {completing ? "처리 중…" : "✓ 프로젝트 완료"}
                  </button>
                  {/* 삭제 버튼 */}
                  <button type="button" onClick={handleDelete}
                    className="rounded-lg px-3 py-2 text-xs font-medium transition-all"
                    style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                    삭제
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>
                취소
              </button>
              <button type="submit" disabled={loading}
                className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff", boxShadow: loading ? "none" : "0 0 16px rgba(0,194,204,0.3)" }}>
                {loading ? "저장 중…" : project ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
