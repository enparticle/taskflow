// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

const STATUS_COLOR: Record<string, string> = {
  backlog: "#4A7099", todo: "#7BA7C8", doing: "#2E86FF",
  blocked: "#FF4D6A", review: "#F5A623", done: "#00D4A0",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};

interface Props {
  onClose: () => void;
  onTaskClick: (id: string) => void;
}

export default function SearchModal({ onClose, onTaskClick }: Props) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ tasks: any[]; projects: any[]; users: any[] }>({ tasks: [], projects: [], users: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults({ tasks: [], projects: [], users: [] }); return; }
    const timer = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    setLoading(true);
    const [{ data: tasks }, { data: projects }, { data: users }] = await Promise.all([
      supabase.from("tasks").select("id, title, status, priority, project:projects(name)").ilike("title", `%${q}%`).limit(6),
      supabase.from("projects").select("id, name, health, status").ilike("name", `%${q}%`).limit(4),
      supabase.from("users").select("id, name, role, email").ilike("name", `%${q}%`).eq("is_active", true).limit(4),
    ]);
    setResults({ tasks: tasks ?? [], projects: projects ?? [], users: users ?? [] });
    setLoading(false);
  }

  const total = results.tasks.length + results.projects.length + results.users.length;
  const HEALTH_COLOR: Record<string, string> = { good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A" };
  const ROLE_LABEL: Record<string, string> = { admin: "관리자", leader: "리더", member: "멤버" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}
        onClick={e => e.stopPropagation()}>

        {/* 검색 입력 */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-3)", fontSize: 16 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="업무, 프로젝트, 구성원 검색..."
            className="flex-1 text-sm focus:outline-none"
            style={{ background: "transparent", color: "var(--text-1)", border: "none" }} />
          {loading && <span className="text-xs" style={{ color: "var(--text-3)" }}>검색 중…</span>}
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-3)" }}>ESC</button>
        </div>

        {/* 결과 */}
        <div className="max-h-96 overflow-y-auto">
          {query && total === 0 && !loading && (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-3)" }}>"{query}" 검색 결과 없음</p>
            </div>
          )}

          {!query && (
            <div className="py-8 text-center">
              <p className="text-xs" style={{ color: "var(--text-3)" }}>검색어를 입력하세요</p>
            </div>
          )}

          {results.tasks.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--text-3)", background: "var(--bg-3)" }}>업무</p>
              {results.tasks.map(t => (
                <div key={t.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onClick={() => { onTaskClick(t.id); onClose(); }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[t.status] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--text-1)" }}>{t.title}</p>
                    {t.project && <p className="text-xs" style={{ color: "var(--text-3)" }}>{t.project.name}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: `${STATUS_COLOR[t.status]}18`, color: STATUS_COLOR[t.status] }}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--text-3)", background: "var(--bg-3)" }}>프로젝트</p>
              {results.projects.map(p => (
                <a key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-all"
                  style={{ borderBottom: "1px solid var(--border)", textDecoration: "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                  onClick={onClose}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: HEALTH_COLOR[p.health] ?? "#7BA7C8" }} />
                  <p className="flex-1 text-sm" style={{ color: "var(--text-1)" }}>{p.name}</p>
                </a>
              ))}
            </div>
          )}

          {results.users.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-semibold" style={{ color: "var(--text-3)", background: "var(--bg-3)" }}>구성원</p>
              {results.users.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: "var(--text-1)" }}>{u.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-3)" }}>{ROLE_LABEL[u.role]} · {u.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
