// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import UserForm from "@/components/team/UserForm";

const ROLE_COLOR: Record<string, string> = {
  admin:    "#7C3AED",
  leader:   "#2563EB",
  member:   "#16A34A",
  reviewer: "#D97706",
  viewer:   "#A8A8A4",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "관리자", leader: "리더", reviewer: "리뷰어", member: "멤버", viewer: "뷰어",
};
const HEALTH_COLOR: Record<string, string> = {
  good: "#16A34A", reviewing: "#2563EB", at_risk: "#D97706", critical: "#DC2626",
};

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    const authUser = await getAuthUser();
    if (authUser) setIsAdmin(authUser.role === "admin" || authUser.role === "leader");
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

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>팀 현황</h1>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid #BFDBFE" }}>
            {displayed.length}명
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowInactive(!showInactive)}
            style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--border)", background: showInactive ? "var(--bg-4)" : "var(--bg-2)", color: showInactive ? "var(--text-1)" : "var(--text-3)" }}>
            {showInactive ? "비활성 포함" : "활성만"}
          </button>
          {isAdmin && (
            <button onClick={() => setOpenForm(true)}
              style={{ padding: "7px 14px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              + 팀원 추가
            </button>
          )}
        </div>
      </div>

      {/* 팀원 카드 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {displayed.map(u => {
          const roleColor = ROLE_COLOR[u.role] ?? "var(--text-3)";
          return (
            <div key={u.id} style={{
              background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18,
              opacity: u.is_active ? 1 : 0.5, transition: "border-color 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>

              {/* 유저 헤더 */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${roleColor}15`, border: `1px solid ${roleColor}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: roleColor, flexShrink: 0 }}>
                    {u.name[0]}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{u.name}</p>
                      {!u.is_active && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-4)", color: "var(--text-3)" }}>비활성</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: roleColor, margin: "2px 0 0" }}>
                      {ROLE_LABEL[u.role] ?? u.role}{u.level ? ` · ${u.level}` : ""}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => setEditUser(u)}
                    style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
                    수정
                  </button>
                )}
              </div>

              {/* 업무 통계 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "진행 중", value: u.doingCount, color: "#2563EB" },
                  { label: "Blocked", value: u.blockedCount, color: u.blockedCount > 0 ? "#DC2626" : "var(--text-3)" },
                  { label: "완료",    value: u.doneCount,   color: "#16A34A" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* 참여 프로젝트 */}
              {u.projects.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>참여 프로젝트</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {u.projects.map((pm: any, i: number) => {
                      const hc = HEALTH_COLOR[pm.project?.health] ?? "#A8A8A4";
                      return (
                        <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${hc}10`, color: hc, border: `1px solid ${hc}30` }}>
                          {pm.project?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 이메일 */}
              <p style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                {u.team && <span>{u.team} · </span>}{u.email}
              </p>
            </div>
          );
        })}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 4 }}>팀원이 없습니다</p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>팀원을 추가해주세요</p>
        </div>
      )}

      {openForm && <UserForm onClose={() => setOpenForm(false)} onSaved={() => { load(); setOpenForm(false); }} />}
      {editUser && <UserForm user={editUser} onClose={() => setEditUser(null)} onSaved={() => { load(); setEditUser(null); }} />}
    </div>
  );
}
