// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import UserForm from "@/components/team/UserForm";

const ROLE_COLOR: Record<string, string> = {
  admin:  "#A78BFA",
  leader: "#00C2CC",
  member: "#2E86FF",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자", leader: "리더", reviewer: "리뷰어", member: "멤버", viewer: "뷰어",
};

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    // 현재 로그인 유저가 관리자인지 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
      setIsAdmin(me?.role === "admin");
    }

    const { data: users } = await supabase.from("users").select("*").order("created_at");
    if (!users) return;

    const withStats = await Promise.all(users.map(async u => {
      const [{ count: doing }, { count: blocked }, { count: done }, { data: projects }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "doing"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "blocked"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "done"),
        supabase.from("project_members").select("project:projects(name, health)").eq("user_id", u.id),
      ]);
      return { ...u, doingCount: doing ?? 0, blockedCount: blocked ?? 0, doneCount: done ?? 0, projects: projects ?? [] };
    }));
    setMembers(withStats);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = showInactive ? members : members.filter(m => m.is_active);

  const HEALTH_COLOR: Record<string, string> = {
    good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A",
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--blue)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>팀 현황</h1>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>
            {displayed.length}명
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInactive(!showInactive)}
            className="rounded-lg px-3 py-2 text-xs font-medium transition-all"
            style={{
              background: showInactive ? "var(--bg-4)" : "var(--bg-2)",
              color: showInactive ? "var(--text-1)" : "var(--text-3)",
              border: "1px solid var(--border-2)",
            }}>
            {showInactive ? "비활성 포함" : "활성만"}
          </button>
          {isAdmin && (
            <button onClick={() => setOpenForm(true)}
              className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff",
                boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
              + 구성원 추가
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map(u => (
          <div key={u.id} className="rounded-2xl p-5 transition-all"
            style={{
              background: "var(--bg-2)",
              border: `1px solid ${u.is_active ? "var(--border)" : "var(--border)"}`,
              opacity: u.is_active ? 1 : 0.5,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>

            {/* 상단 */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0"
                  style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
                  {u.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{u.name}</p>
                    {!u.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>비활성</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: ROLE_COLOR[u.role] ?? "var(--text-3)" }}>
                    {ROLE_LABEL[u.role] ?? u.role}{u.level ? ` · ${u.level}` : ""}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => setEditUser(u)}
                  className="shrink-0 text-xs px-2 py-1 rounded-lg transition-all"
                  style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
                  수정
                </button>
              )}
            </div>

            {/* 업무 통계 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "진행",    value: u.doingCount,   color: "#2E86FF" },
                { label: "Blocked", value: u.blockedCount, color: u.blockedCount > 0 ? "#FF4D6A" : "var(--text-3)" },
                { label: "완료",    value: u.doneCount,    color: "#00D4A0" },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-2.5 text-center"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* 배정된 프로젝트 */}
            {u.projects.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>배정 프로젝트</p>
                <div className="flex flex-wrap gap-1.5">
                  {u.projects.map((pm: any, i: number) => {
                    const hc = HEALTH_COLOR[pm.project?.health] ?? "#7BA7C8";
                    return (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md"
                        style={{ background: `${hc}15`, color: hc, border: `1px solid ${hc}33` }}>
                        {pm.project?.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 이메일 */}
            <p className="text-xs mt-3 truncate" style={{ color: "var(--text-3)" }}>
              {u.team && <span>{u.team} · </span>}{u.email}
            </p>
          </div>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="rounded-xl py-16 text-center"
          style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-2)" }}>구성원이 없습니다</p>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>구성원을 추가해보세요</p>
        </div>
      )}

      {openForm && (
        <UserForm onClose={() => setOpenForm(false)} onSaved={() => { load(); setOpenForm(false); }} />
      )}
      {editUser && (
        <UserForm user={editUser} onClose={() => setEditUser(null)} onSaved={() => { load(); setEditUser(null); }} />
      )}
    </div>
  );
}
