// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const ROLE_COLOR: Record<string, string> = { admin: "#7C3AED", leader: "#2563EB", member: "#16A34A" };
const ROLE_LABEL: Record<string, string> = { admin: "관리자", leader: "리더", member: "멤버", reviewer: "리뷰어", viewer: "뷰어" };

export default function SettingsPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [myLinkedUser, setMyLinkedUser] = useState<any>(null);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedAuthEmail, setSelectedAuthEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState("");

  const FS = {
    background: "var(--bg-3)", border: "1px solid var(--border)",
    color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, outline: "none", colorScheme: "light" as const,
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setAuthEmail(user.email);
      if (!user) return;
      const { data: linked } = await supabase.from("users").select("*").eq("auth_id", user.id).single();
      if (linked) { setMyLinkedUser(linked); setIsAdmin(linked.role === "admin"); }
      else {
        const { data: byEmail } = await supabase.from("users").select("*").eq("email", user.email).single();
        if (byEmail?.role === "admin") setIsAdmin(true);
      }
      const { data: members } = await supabase.from("users").select("*").eq("is_active", true).order("name");
      setAllMembers(members ?? []);
    }
    load();
  }, []);

  async function handleLink(memberId: string, newEmail: string) {
    if (!newEmail.trim()) return;
    setLinkLoading(true); setError(""); setSuccess("");
    const { error: err } = await supabase.from("users").update({ email: newEmail.trim(), auth_id: null }).eq("id", memberId);
    if (err) { setError(err.message); setLinkLoading(false); return; }
    const { data: members } = await supabase.from("users").select("*").eq("is_active", true).order("name");
    setAllMembers(members ?? []);
    setEditingMemberId(null); setSelectedAuthEmail("");
    setSuccess("이메일이 설정됐습니다. 해당 계정으로 다음 로그인 시 자동 연결됩니다.");
    setLinkLoading(false);
  }

  async function handleUnlink(memberId: string) {
    setLinkLoading(true);
    await supabase.from("users").update({ auth_id: null }).eq("id", memberId);
    const { data: members } = await supabase.from("users").select("*").eq("is_active", true).order("name");
    setAllMembers(members ?? []);
    setLinkLoading(false); setSuccess("연결이 해제됐습니다");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!form.password) { setError("새 비밀번호를 입력해주세요"); return; }
    if (form.password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다"); return; }
    if (form.password !== form.confirm) { setError("비밀번호가 일치하지 않습니다"); return; }
    setLoading(true); setError(""); setSuccess("");
    const { error: err } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess("비밀번호가 변경됐습니다"); setForm({ password: "", confirm: "" });
  }

  async function sendNotifications() {
    setNotifyLoading(true); setNotifyResult("");
    try {
      const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daysAhead: 3 }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNotifyResult(data.message);
    } catch (e: any) { setNotifyResult("오류: " + e.message); }
    setNotifyLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>설정</h1>
      </div>

      {/* 내 계정 정보 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>내 계정</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--cyan-bg)", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--cyan)", flexShrink: 0 }}>
            {myLinkedUser?.name?.[0] ?? authEmail[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            {myLinkedUser ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{myLinkedUser.name}</p>
                <p style={{ fontSize: 11, color: ROLE_COLOR[myLinkedUser.role] ?? "var(--text-3)", margin: "2px 0 0" }}>
                  {ROLE_LABEL[myLinkedUser.role] ?? myLinkedUser.role}{myLinkedUser.level ? ` · ${myLinkedUser.level}` : ""}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>연결된 계정 없음</p>
            )}
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{authEmail}</p>
          </div>
        </div>
      </div>

      {/* 팀원 계정 연결 (Admin) */}
      {isAdmin ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>팀원 계정 연결</h2>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>Admin</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            각 팀원에게 로그인 계정(이메일)을 연결합니다. 연결된 이메일로 로그인하면 해당 팀원으로 자동 인식됩니다.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allMembers.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--cyan-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--cyan)", flexShrink: 0 }}>
                  {m.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{m.name}</p>
                  <p style={{ fontSize: 10, color: ROLE_COLOR[m.role] ?? "var(--text-3)", margin: "1px 0 0" }}>{ROLE_LABEL[m.role] ?? m.role}</p>
                </div>
                {editingMemberId === m.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="email" value={selectedAuthEmail} onChange={e => setSelectedAuthEmail(e.target.value)}
                      placeholder="로그인 이메일 입력" autoFocus
                      style={{ ...FS, width: 200 }} />
                    <button onClick={() => handleLink(m.id, selectedAuthEmail)} disabled={linkLoading || !selectedAuthEmail.trim()}
                      style={{ padding: "6px 12px", background: "var(--cyan)", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !selectedAuthEmail.trim() ? 0.4 : 1 }}>
                      저장
                    </button>
                    <button onClick={() => { setEditingMemberId(null); setSelectedAuthEmail(""); }}
                      style={{ padding: "6px 10px", background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
                      취소
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {m.auth_id ? (
                      <>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>{m.email ?? "연결됨"}</span>
                        <button onClick={() => handleUnlink(m.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", cursor: "pointer" }}>해제</button>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>미연결</span>
                    )}
                    <button onClick={() => { setEditingMemberId(m.id); setSelectedAuthEmail(m.email ?? ""); }}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--bg-4)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }}>
                      {m.auth_id ? "수정" : "연결"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>계정 연결</h2>
          <p style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#FFFBEB", color: "#D97706", border: "1px solid #FCD34D", margin: 0 }}>
            계정 연결은 관리자만 설정할 수 있습니다
          </p>
        </div>
      )}

      {/* 알림 발송 (Admin) */}
      {isAdmin && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>마감 알림 발송</h2>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>Admin</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            3일 이내 마감 업무가 있는 담당자에게 이메일을 발송합니다.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={sendNotifications} disabled={notifyLoading}
              style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: notifyLoading ? 0.4 : 1 }}>
              {notifyLoading ? "발송 중…" : "즉시 발송"}
            </button>
            {notifyResult && (
              <p style={{ fontSize: 12, color: notifyResult.startsWith("오류") ? "#DC2626" : "#16A34A", margin: 0 }}>
                {notifyResult}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 비밀번호 변경 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 16 }}>비밀번호 변경</h2>
        <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>새 비밀번호</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="6자 이상" style={{ ...FS, minWidth: 240 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>비밀번호 확인</label>
            <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="비밀번호 다시 입력" style={{ ...FS, minWidth: 240 }} />
          </div>
          <button type="submit" disabled={loading}
            style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", width: "fit-content", opacity: loading ? 0.4 : 1 }}>
            {loading ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
      </div>

      {error && <p style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>{error}</p>}
      {success && <p style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>{success}</p>}
    </div>
  );
}
