"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 이미 로그인된 경우 대시보드로
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("이메일과 비밀번호를 입력해주세요"); return; }
    setLoading(true); setError("");

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err || !data.session) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full"
              style={{ background: "var(--cyan)", boxShadow: "0 0 12px var(--cyan)" }} />
            <span className="text-2xl font-bold tracking-widest uppercase"
              style={{ color: "var(--text-1)" }}>
              Task<span style={{ color: "var(--cyan)" }}>Flow</span>
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>AI 업무 배정 최적화 시스템</p>
        </div>

        <div className="rounded-2xl p-6"
          style={{
            background: "var(--bg-2)", border: "1px solid var(--border-2)",
            boxShadow: "0 0 40px rgba(0,194,204,0.06), 0 20px 60px rgba(0,0,0,0.4)",
          }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "var(--text-1)" }}>로그인</h2>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="example@company.com" autoFocus
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF" }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF" }} />
            </div>
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg"
                style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</p>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-40 mt-2"
              style={{
                background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff",
                boxShadow: loading ? "none" : "0 0 20px rgba(0,194,204,0.3)",
              }}>
              {loading ? "로그인 중…" : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
