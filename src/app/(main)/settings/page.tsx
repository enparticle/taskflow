"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [myLinkedUser, setMyLinkedUser] = useState<any>(null);

  // 관리자용
  const [allMembers, setAllMembers] = useState<any[]>([]); // 전체 구성원
  const [authUsers, setAuthUsers] = useState<any[]>([]); // auth 유저 목록 (이메일만)
  const [linkMap, setLinkMap] = useState<Record<string, string>>({}); // userId → authEmail
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedAuthEmail, setSelectedAuthEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setAuthEmail(user.email);
      if (!user) return;

      // 내 연결 확인
      const { data: linked } = await supabase
        .from("users").select("*").eq("auth_id", user.id).single();
      if (linked) {
        setMyLinkedUser(linked);
        setIsAdmin(linked.role === "admin");
      } else {
        const { data: byEmail } = await supabase
          .from("users").select("*").eq("email", user.email).single();
        if (byEmail?.role === "admin") setIsAdmin(true);
      }

      // 전체 구성원
      const { data: members } = await supabase
        .from("users").select("*").eq("is_active", true).order("name");
      setAllMembers(members ?? []);

      // auth_id → email 맵 구성
      const map: Record<string, string> = {};
      if (members) {
        for (const m of members) {
          if (m.auth_id) {
            // auth_id로 이메일 조회는 admin API 필요하므로 email 컬럼 활용
            map[m.id] = m.email ?? "";
          }
        }
      }
      setLinkMap(map);
    }
    load();
  }, []);

  async function handleLink(memberId: string, newEmail: string) {
    if (!newEmail.trim()) return;
    setLinkLoading(true); setError(""); setSuccess("");

    // 이메일 업데이트 + auth_id 초기화 (다음 로그인 시 자동 연결)
    const { error: err } = await supabase
      .from("users")
      .update({ email: newEmail.trim(), auth_id: null })
      .eq("id", memberId);

    if (err) { setError(err.message); setLinkLoading(false); return; }

    const { data: members } = await supabase.from("users").select("*").eq("is_active", true).order("name");
    setAllMembers(members ?? []);
    setEditingMemberId(null);
    setSelectedAuthEmail("");
    setSuccess(`이메일이 설정됐습니다. 해당 계정으로 다음 로그인 시 자동 연결됩니다.`);
    setLinkLoading(false);
  }

  async function handleUnlink(memberId: string) {
    setLinkLoading(true);
    await supabase.from("users").update({ auth_id: null }).eq("id", memberId);
    const { data: members } = await supabase.from("users").select("*").eq("is_active", true).order("name");
    setAllMembers(members ?? []);
    setLinkLoading(false);
    setSuccess("연결이 해제됐습니다");
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
    setSuccess("비밀번호가 변경됐습니다");
    setForm({ password: "", confirm: "" });
  }

  const fieldStyle = {
    background: "#1E2435", border: "1px solid var(--border-2)",
    color: "#E8F4FF", borderRadius: "8px", padding: "8px 12px",
    fontSize: "13px", width: "100%", outline: "none", colorScheme: "dark" as const,
  };

  const ROLE_COLOR: Record<string, string> = {
    admin: "#A78BFA", leader: "#00C2CC", member: "#2E86FF",
  };
  const ROLE_LABEL: Record<string, string> = {
    admin: "관리자", leader: "리더", member: "멤버",
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>설정</h1>
      </div>

      {/* 내 계정 정보 */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-1)" }}>내 계정</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
            {myLinkedUser?.name?.[0] ?? authEmail[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            {myLinkedUser ? (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{myLinkedUser.name}</p>
                <p className="text-xs" style={{ color: ROLE_COLOR[myLinkedUser.role] }}>
                  {ROLE_LABEL[myLinkedUser.role]} · {myLinkedUser.level ?? "-"}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-3)" }}>연결된 구성원 없음</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{authEmail}</p>
          </div>
        </div>
      </div>

      {/* 구성원 계정 연결 - 관리자만 */}
      {isAdmin ? (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>구성원 계정 연결</h2>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--purple-bg)", color: "var(--purple)" }}>관리자</span>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
            각 구성원에게 로그인 계정(이메일)을 연결합니다. 연결된 계정으로 로그인하면 해당 구성원으로 인식됩니다.
          </p>

          <div className="space-y-2">
            {allMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                {/* 아바타 */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
                  {m.name[0]}
                </div>

                {/* 이름 + 역할 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{m.name}</p>
                  <p className="text-xs" style={{ color: ROLE_COLOR[m.role] ?? "var(--text-3)" }}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </p>
                </div>

                {/* 연결 상태 */}
                {editingMemberId === m.id ? (
                  <div className="flex items-center gap-2">
                    <input type="email" value={selectedAuthEmail}
                      onChange={e => setSelectedAuthEmail(e.target.value)}
                      placeholder="로그인 이메일 입력"
                      className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      style={{ background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF", width: 200 }}
                      autoFocus />
                    <button onClick={() => handleLink(m.id, selectedAuthEmail)}
                      disabled={linkLoading || !selectedAuthEmail.trim()}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-30"
                      style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
                      저장
                    </button>
                    <button onClick={() => { setEditingMemberId(null); setSelectedAuthEmail(""); }}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    {m.auth_id ? (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-md"
                          style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green)22" }}>
                          {m.email ?? "연결됨"}
                        </span>
                        <button onClick={() => handleUnlink(m.id)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: "var(--red-bg)", color: "var(--red)" }}>
                          해제
                        </button>
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>미연결</span>
                    )}
                    <button onClick={() => {
                      setEditingMemberId(m.id);
                      setSelectedAuthEmail(m.email ?? "");
                    }}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "var(--bg-4)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                      {m.auth_id ? "수정" : "연결"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-1)" }}>구성원 계정 연결</h2>
          <p className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
            계정 연결은 관리자만 할 수 있습니다
          </p>
        </div>
      )}

      {/* 비밀번호 변경 */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-1)" }}>비밀번호 변경</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>새 비밀번호</label>
            <input type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="6자 이상" style={{ ...fieldStyle, width: "auto", minWidth: 240 }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>비밀번호 확인</label>
            <input type="password" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="비밀번호 다시 입력" style={{ ...fieldStyle, width: "auto", minWidth: 240 }} />
          </div>
          <button type="submit" disabled={loading}
            className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
            {loading ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</p>
      )}
      {success && (
        <p className="text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--green-bg)", color: "var(--green)" }}>{success}</p>
      )}
    </div>
  );
}
