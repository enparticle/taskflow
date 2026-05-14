// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  leader:   { label: "리더",   color: "#00C2CC", icon: "◆", desc: "프로젝트 수정, 업무 전체 관리" },
  reviewer: { label: "리뷰어", color: "#F5A623", icon: "◈", desc: "업무 검토 및 완료 처리" },
  member:   { label: "멤버",   color: "#2E86FF", icon: "◎", desc: "담당 업무 처리" },
};

interface Props { projectId: string; }

export default function ProjectMemberPanel({ projectId }: Props) {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const load = useCallback(async () => {
    const { data } = await supabase.from("project_members")
      .select("*, user:users(id, name, role, level)")
      .eq("project_id", projectId);
    setMembers(data ?? []);

    const { data: users } = await supabase.from("users").select("*").eq("is_active", true);
    setAllUsers(users ?? []);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const memberIds = members.map(m => m.user_id);
  const availableUsers = allUsers.filter(u => !memberIds.includes(u.id));

  async function addMember() {
    if (!selectedUser) return;
    await supabase.from("project_members").insert({
      project_id: projectId, user_id: selectedUser, role: selectedRole,
    });
    setAdding(false); setSelectedUser(""); setSelectedRole("member");
    load();
  }

  async function updateRole(memberId: string, role: string) {
    await supabase.from("project_members").update({ role }).eq("id", memberId);
    load();
  }

  async function removeMember(memberId: string) {
    if (!confirm("멤버를 제거할까요?")) return;
    await supabase.from("project_members").delete().eq("id", memberId);
    load();
  }

  return (
    <div className="space-y-2">
      {members.map(m => {
        const cfg = ROLE_CONFIG[m.role];
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-xl px-4 py-3 group"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
              {m.user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{m.user?.name}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>{m.user?.level ?? m.user?.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-3)", fontSize: 10 }}>{cfg.desc}</p>
              </div>
              <select value={m.role} onChange={e => updateRole(m.id, e.target.value)}
                className="text-xs rounded-lg px-2 py-1 focus:outline-none transition-all"
                style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33`, colorScheme: "dark" }}>
                <option value="leader">리더</option>
                <option value="reviewer">리뷰어</option>
                <option value="member">멤버</option>
              </select>
            </div>
            <button onClick={() => removeMember(m.id)}
              className="opacity-0 group-hover:opacity-100 text-xs px-2 py-0.5 rounded transition-all"
              style={{ background: "var(--red-bg)", color: "var(--red)" }}>제거</button>
          </div>
        );
      })}

      {adding && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }}>
            <option value="">구성원 선택</option>
            {availableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.level ?? u.role})</option>
            ))}
          </select>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
            className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }}>
            <option value="leader">리더</option>
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
            <option value="reviewer">리뷰어</option>
          </select>
          <button onClick={addMember} disabled={!selectedUser}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>추가</button>
          <button onClick={() => { setAdding(false); setSelectedUser(""); }}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>취소</button>
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-xl py-2.5 text-xs font-medium transition-all"
          style={{ background: "transparent", border: "1px dashed var(--border-2)", color: "var(--text-3)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}>
          + 구성원 추가
        </button>
      )}

      {members.length === 0 && !adding && (
        <p className="text-xs text-center py-2" style={{ color: "var(--text-3)" }}>
          배정된 구성원이 없습니다
        </p>
      )}
    </div>
  );
}
