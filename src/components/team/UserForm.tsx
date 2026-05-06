"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const fieldStyle = {
  background: "var(--bg-3)", border: "1px solid var(--border-2)",
  color: "var(--text-1)", borderRadius: "8px", padding: "8px 12px",
  fontSize: "13px", width: "100%", outline: "none",
};

interface Props {
  user?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserForm({ user, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name:     user?.name     ?? "",
    email:    user?.email    ?? "",
    team:     user?.team     ?? "",
    role:     user?.role     ?? "member",
    level:    user?.level    ?? "",
    is_active: user?.is_active ?? true,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("이름을 입력해주세요"); return; }
    if (!form.email.trim()) { setError("이메일을 입력해주세요"); return; }
    setLoading(true); setError("");

    const payload = {
      name:      form.name.trim(),
      email:     form.email.trim(),
      team:      form.team || null,
      role:      form.role,
      level:     form.level || null,
      is_active: form.is_active,
    };

    const { error: err } = user
      ? await supabase.from("users").update(payload).eq("id", user.id)
      : await supabase.from("users").insert(payload);

    setLoading(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(7,13,24,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)",
          boxShadow: "0 0 40px rgba(0,194,204,0.08), 0 20px 60px rgba(0,0,0,0.6)" }}>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>
              {user ? "구성원 수정" : "구성원 추가"}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: "18px" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>이름 *</label>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="홍길동" style={fieldStyle} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>이메일 *</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                placeholder="example@company.com" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>레벨</label>
            <input type="text" value={form.level} onChange={e => set("level", e.target.value)}
              placeholder="예: senior, junior, lead" style={fieldStyle} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>역할</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "member",  label: "멤버",   color: "#2E86FF" },
                { value: "leader",  label: "리더",   color: "#00C2CC" },
                { value: "admin",   label: "관리자", color: "#A78BFA" },
              ].map(r => (
                <button key={r.value} type="button" onClick={() => set("role", r.value)}
                  className="rounded-lg py-2 text-xs font-semibold transition-all"
                  style={{
                    background: form.role === r.value ? `${r.color}22` : "var(--bg-3)",
                    border: `1px solid ${form.role === r.value ? r.color : "var(--border-2)"}`,
                    color: form.role === r.value ? r.color : "var(--text-3)",
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {user && (
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--text-1)" }}>활성 상태</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  비활성화하면 업무 배정에서 제외됩니다
                </p>
              </div>
              <button type="button" onClick={() => set("is_active", !form.is_active)}
                className="rounded-full transition-all"
                style={{
                  width: 44, height: 24, padding: 2,
                  background: form.is_active ? "var(--cyan)" : "var(--bg-4)",
                  border: "1px solid var(--border-2)",
                  position: "relative", display: "flex", alignItems: "center",
                }}>
                <div className="rounded-full transition-all"
                  style={{
                    width: 18, height: 18, background: "#fff",
                    transform: form.is_active ? "translateX(20px)" : "translateX(0px)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
              </button>
            </div>
          )}

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
              {loading ? "저장 중…" : user ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
