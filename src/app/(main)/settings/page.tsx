// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import UserForm from "@/components/team/UserForm";

const ROLE_COLOR: Record<string, string> = {
  admin: "#7C3AED", leader: "#2563EB", member: "#16A34A", reviewer: "#D97706", viewer: "#A8A8A4",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "관리자", leader: "리더", member: "멤버", reviewer: "리뷰어", viewer: "뷰어",
};
const HEALTH_COLOR: Record<string, string> = {
  good: "#16A34A", reviewing: "#2563EB", at_risk: "#D97706", critical: "#DC2626",
};
const STATUS_COLOR: Record<string, string> = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB", blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰", done: "완료",
};
const WORK_TYPES = [
  { value: "planning",      label: "기획" },
  { value: "development",   label: "개발" },
  { value: "design",        label: "디자인" },
  { value: "operation",     label: "운영" },
  { value: "documentation", label: "문서화" },
  { value: "meeting",       label: "미팅" },
  { value: "research",      label: "리서치" },
  { value: "qa",            label: "QA" },
  { value: "customer",      label: "고객 대응" },
];

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, outline: "none", colorScheme: "light" as const,
};

export default function SettingsPage() {
  const supabase = createClient();

  // ── 공통 / 계정 탭 ──────────────────────────────
  const [settingsTab, setSettingsTab] = useState<"account" | "style" | "team">("account");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false); // 진짜 Admin (role === 'admin')
  const [isLeaderOrAbove, setIsLeaderOrAbove] = useState(false); // Admin 또는 Leader
  const [myUserId, setMyUserId] = useState<string>("");
  const [myLinkedUser, setMyLinkedUser] = useState<any>(null);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedAuthEmail, setSelectedAuthEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setAuthEmail(user.email);
      if (!user) return;
      const { data: linked } = await supabase.from("users").select("*").eq("auth_id", user.id).single();
      let role = "";
      if (linked) {
        setMyLinkedUser(linked);
        setIsAdmin(linked.role === "admin");
        setMyUserId(linked.id);
        role = linked.role;
      } else {
        const { data: byEmail } = await supabase.from("users").select("*").eq("email", user.email).single();
        if (byEmail) {
          setIsAdmin(byEmail.role === "admin");
          setMyUserId(byEmail.id);
          role = byEmail.role;
        }
      }
      setIsLeaderOrAbove(role === "admin" || role === "leader");
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
    <div style={{ maxWidth: settingsTab === "team" ? 1000 : 600, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* 헤더 + 탭 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>설정</h1>
        </div>
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
          {[
            { v: "account", l: "계정" },
            { v: "style", l: "나의 스타일" },
            ...(isLeaderOrAbove ? [{ v: "team", l: "팀 현황" }] : []),
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setSettingsTab(v as any)}
              style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.15s", background: settingsTab === v ? "var(--bg-4)" : "transparent", color: settingsTab === v ? "var(--text-1)" : "var(--text-3)" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {settingsTab === "account" ? (
        <AccountTab
          authEmail={authEmail} isAdmin={isAdmin} myLinkedUser={myLinkedUser}
          allMembers={allMembers} editingMemberId={editingMemberId} setEditingMemberId={setEditingMemberId}
          selectedAuthEmail={selectedAuthEmail} setSelectedAuthEmail={setSelectedAuthEmail}
          linkLoading={linkLoading} handleLink={handleLink} handleUnlink={handleUnlink}
          notifyLoading={notifyLoading} notifyResult={notifyResult} sendNotifications={sendNotifications}
          form={form} setForm={setForm} loading={loading} handlePasswordChange={handlePasswordChange}
          error={error} success={success}
        />
      ) : settingsTab === "style" ? (
        <StyleTab myUserId={myUserId} supabase={supabase} />
      ) : (
        <TeamTab isAdmin={isAdmin} myUserId={myUserId} supabase={supabase} />
      )}
    </div>
  );
}

// ── 나의 스타일 탭 (2-3: 온보딩에서 고른 설정 재변경) ──────────────
const INPUT_STYLE_OPTIONS = [
  { value: "plan", emoji: "📋", title: "미리 계획 세우는 게 편해요", desc: "할 일을 먼저 등록하고 시작해요" },
  { value: "log", emoji: "📝", title: "끝난 뒤 편하게 적는 게 편해요", desc: "일단 하고, 나중에 뭐 했는지 적어요" },
  { value: "click", emoji: "🖱", title: "그냥 클릭 몇 번으로 끝내고 싶어요", desc: "상태만 딸깍딸깍 바꾸는 게 좋아요" },
];
const HOME_PRIORITY_OPTIONS = [
  { value: "today", label: "오늘 해야 할 일" },
  { value: "recent", label: "최근에 내가 남긴 기록" },
  { value: "summary", label: "주간 요약 (완료/진행중/Blocked)" },
];
const CONSUMPTION_STYLE_OPTIONS = [
  { value: "monitor", title: "네, 자주 봐요" },
  { value: "summary", title: "아니요, 필요할 때만" },
  { value: "unsure", title: "잘 모르겠어요" },
];

function StyleTab({ myUserId, supabase }: { myUserId: string; supabase: any }) {
  const [inputStyle, setInputStyle] = useState("log");
  const [homePriority, setHomePriority] = useState("today");
  const [consumptionStyle, setConsumptionStyle] = useState("unsure");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!myUserId) return;
    supabase.from("user_preferences").select("*").eq("user_id", myUserId).maybeSingle().then(({ data }: any) => {
      if (data) {
        setInputStyle(data.input_style ?? "log");
        setHomePriority(data.home_priority?.[0] ?? "today");
        setConsumptionStyle(data.consumption_style ?? "unsure");
      }
      setLoaded(true);
    });
  }, [myUserId]);

  async function save() {
    setSaving(true); setSaved(false);
    const priorityOrder = [homePriority, ...HOME_PRIORITY_OPTIONS.map(h => h.value).filter(v => v !== homePriority)];
    await supabase.from("user_preferences").upsert({
      user_id: myUserId,
      input_style: inputStyle,
      home_priority: priorityOrder,
      consumption_style: consumptionStyle,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!loaded) return <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>업무를 기록하는 스타일</h2>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>홈 화면 구성과 AI 제안 방식에 반영돼요</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INPUT_STYLE_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setInputStyle(s.value)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: inputStyle === s.value ? "var(--cyan-bg)" : "var(--bg-3)",
                border: `1px solid ${inputStyle === s.value ? "var(--cyan)" : "var(--border)"}`,
              }}>
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "1px 0 0" }}>{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>홈 화면에서 먼저 보고 싶은 것</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {HOME_PRIORITY_OPTIONS.map(h => (
            <button key={h.value} onClick={() => setHomePriority(h.value)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: homePriority === h.value ? "var(--cyan-bg)" : "var(--bg-3)",
                border: `1px solid ${homePriority === h.value ? "var(--cyan)" : "var(--border)"}`,
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%", border: `2px solid ${homePriority === h.value ? "var(--cyan)" : "var(--border-2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {homePriority === h.value && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan)" }} />}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-1)" }}>{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>팀 전체 현황을 자주 보는 편인가요?</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {CONSUMPTION_STYLE_OPTIONS.map(c => (
            <button key={c.value} onClick={() => setConsumptionStyle(c.value)}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center", cursor: "pointer",
                background: consumptionStyle === c.value ? "var(--cyan-bg)" : "var(--bg-3)",
                border: `1px solid ${consumptionStyle === c.value ? "var(--cyan)" : "var(--border)"}`,
                color: consumptionStyle === c.value ? "var(--cyan)" : "var(--text-2)",
                fontSize: 12, fontWeight: 500,
              }}>
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "8px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "저장 중…" : "저장"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#16A34A" }}>✓ 저장됐어요, 홈 화면에 바로 반영돼요</span>}
      </div>
    </div>
  );
}

// ── 계정 탭 (기존 설정 페이지 내용) ──────────────────────────────
function AccountTab({
  authEmail, isAdmin, myLinkedUser, allMembers, editingMemberId, setEditingMemberId,
  selectedAuthEmail, setSelectedAuthEmail, linkLoading, handleLink, handleUnlink,
  notifyLoading, notifyResult, sendNotifications, form, setForm, loading, handlePasswordChange,
  error, success,
}: any) {
  return (
    <>
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
            {allMembers.map((m: any) => (
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
            <input type="password" value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))}
              placeholder="6자 이상" style={{ ...FS, minWidth: 240 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>비밀번호 확인</label>
            <input type="password" value={form.confirm} onChange={e => setForm((f: any) => ({ ...f, confirm: e.target.value }))}
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
    </>
  );
}

// ── 팀 현황 탭 (구 TeamPage + 서브탭으로 구 AdminMembersPage) ──────
function TeamTab({ isAdmin, myUserId, supabase }: { isAdmin: boolean; myUserId: string; supabase: any }) {
  const [teamSubTab, setTeamSubTab] = useState<"overview" | "profiles">("overview");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isAdmin && (
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
          {[{ v: "overview", l: "현황" }, { v: "profiles", l: "🧠 팀원 프로필 관리" }].map(({ v, l }) => (
            <button key={v} onClick={() => setTeamSubTab(v as any)}
              style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.15s", background: teamSubTab === v ? "var(--bg-4)" : "transparent", color: teamSubTab === v ? "var(--text-1)" : "var(--text-3)" }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {teamSubTab === "overview" || !isAdmin ? (
        <TeamOverview isAdmin={isAdmin} supabase={supabase} />
      ) : (
        <MemberProfiles myUserId={myUserId} supabase={supabase} />
      )}
    </div>
  );
}

// 구 TeamPage 내용 (팀원 카드 그리드)
function TeamOverview({ isAdmin, supabase }: { isAdmin: boolean; supabase: any }) {
  const [members, setMembers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    const { data: users } = await supabase.from("users").select("*").order("created_at");
    if (!users) return;
    const withStats = await Promise.all(users.map(async (u: any) => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

// 구 AdminMembersPage 내용 (팀원 프로필 관리) — Admin 전용
function MemberProfiles({ myUserId, supabase }: { myUserId: string; supabase: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, any[]>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({ strengths: "", work_style: "", preferred_types: [] as string[], cautions: "", admin_notes: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileTab, setProfileTab] = useState<"profile" | "priority" | "notes">("profile");
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNoteTaskId, setAddingNoteTaskId] = useState<string | null>(null);
  const [prioritySaving, setPrioritySaving] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.from("users").select("id, name, role").eq("is_active", true).neq("role", "viewer").order("name");
    setUsers(u ?? []);
    const { data: p } = await supabase.from("member_profiles").select("*");
    const pm: Record<string, any> = {};
    (p ?? []).forEach((x: any) => { pm[x.user_id] = x; });
    setProfiles(pm);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectUser(user: any) {
    setSelectedUser(user);
    const p = profiles[user.id];
    setProfileForm({
      strengths: p?.strengths ?? "",
      work_style: p?.work_style ?? "",
      preferred_types: p?.preferred_types ?? [],
      cautions: p?.cautions ?? "",
      admin_notes: p?.admin_notes ?? "",
    });
    setProfileTab("profile");
    loadUserTasks(user.id);
  }

  async function loadUserTasks(userId: string) {
    const { data: tasks } = await supabase.from("tasks")
      .select("id, title, status, due_date, priority_order, priority_note, project:projects(name)")
      .or(`assignee_id.eq.${userId},assignee_ids.cs.{${userId}}`)
      .neq("status", "done")
      .order("priority_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setUserTasks(tasks ?? []);

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t: any) => t.id);
      const { data: notes } = await supabase.from("task_admin_notes")
        .select("*").in("task_id", taskIds).order("created_at", { ascending: false });
      const nm: Record<string, any[]> = {};
      (notes ?? []).forEach((n: any) => {
        if (!nm[n.task_id]) nm[n.task_id] = [];
        nm[n.task_id].push(n);
      });
      setTaskNotes(nm);
    }
  }

  async function saveProfile() {
    if (!selectedUser) return;
    setProfileSaving(true);
    const existing = profiles[selectedUser.id];
    const payload = { user_id: selectedUser.id, ...profileForm, updated_at: new Date().toISOString() };
    if (existing) {
      await supabase.from("member_profiles").update(payload).eq("user_id", selectedUser.id);
    } else {
      await supabase.from("member_profiles").insert(payload);
    }
    setProfileSaving(false);
    await load();
    setProfiles(prev => ({ ...prev, [selectedUser.id]: { ...prev[selectedUser.id], ...payload } }));
  }

  async function setPriorityOrder(taskId: string, order: number | null) {
    await supabase.from("tasks").update({
      priority_order: order,
      priority_set_by: myUserId,
      priority_set_at: new Date().toISOString(),
    }).eq("id", taskId);
    await loadUserTasks(selectedUser.id);
  }

  async function setPriorityNote(taskId: string, note: string) {
    await supabase.from("tasks").update({ priority_note: note || null }).eq("id", taskId);
    setUserTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority_note: note } : t));
  }

  async function clearAllPriorities() {
    if (!confirm("이 팀원의 모든 우선순위를 초기화할까요?")) return;
    setPrioritySaving(true);
    const taskIds = userTasks.filter(t => t.priority_order !== null).map(t => t.id);
    for (const id of taskIds) {
      await supabase.from("tasks").update({ priority_order: null, priority_note: null }).eq("id", id);
    }
    await loadUserTasks(selectedUser.id);
    setPrioritySaving(false);
  }

  async function addTaskNote(taskId: string) {
    if (!newNote.trim()) return;
    await supabase.from("task_admin_notes").insert({ task_id: taskId, note: newNote.trim(), created_by: myUserId });
    setNewNote(""); setAddingNoteTaskId(null);
    await loadUserTasks(selectedUser.id);
  }

  async function deleteNote(noteId: string) {
    if (!confirm("노트를 삭제할까요?")) return;
    await supabase.from("task_admin_notes").delete().eq("id", noteId);
    await loadUserTasks(selectedUser.id);
  }

  function toggleType(type: string) {
    setProfileForm(f => ({
      ...f,
      preferred_types: f.preferred_types.includes(type)
        ? f.preferred_types.filter(t => t !== type)
        : [...f.preferred_types, type],
    }));
  }

  const prioritized = userTasks.filter(t => t.priority_order !== null).sort((a, b) => a.priority_order - b.priority_order);
  const unset = userTasks.filter(t => t.priority_order === null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>

      {/* 팀원 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4 }}>팀원 선택</p>
        {users.map(u => {
          const hasProfile = !!profiles[u.id];
          const roleColor = ROLE_COLOR[u.role] ?? "var(--text-3)";
          return (
            <button key={u.id} onClick={() => selectUser(u)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: selectedUser?.id === u.id ? "var(--bg-4)" : "var(--bg-2)",
                border: `1px solid ${selectedUser?.id === u.id ? "var(--border-2)" : "var(--border)"}`,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{u.name}</p>
                <div style={{ display: "flex", gap: 4 }}>
                  {hasProfile && <span style={{ fontSize: 9, color: "var(--cyan)" }}>●</span>}
                </div>
              </div>
              <span style={{ fontSize: 11, color: roleColor }}>{u.role}</span>
            </button>
          );
        })}
      </div>

      {/* 오른쪽 편집 영역 */}
      {selectedUser ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                {selectedUser.name[0]}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{selectedUser.name}</p>
                <p style={{ fontSize: 11, color: ROLE_COLOR[selectedUser.role] ?? "var(--text-3)", margin: 0 }}>{selectedUser.role}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
              {([
                { id: "profile", label: "프로필" },
                { id: "priority", label: `🎯 우선순위 ${prioritized.length > 0 ? `(${prioritized.length})` : ""}` },
                { id: "notes", label: `📝 업무 노트 (${userTasks.length})` },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setProfileTab(t.id)}
                  style={{
                    padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                    background: profileTab === t.id ? "var(--bg-4)" : "transparent",
                    color: profileTab === t.id ? "var(--text-1)" : "var(--text-3)",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 프로필 탭 */}
          {profileTab === "profile" && (
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>💪 강점</label>
                  <textarea value={profileForm.strengths} onChange={e => setProfileForm(f => ({ ...f, strengths: e.target.value }))}
                    placeholder="예: 꼼꼼한 실행력, 기술 문서화 능숙, 마감 준수율 높음"
                    rows={3} style={{ ...FS, width: "100%", resize: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>🎯 업무 스타일</label>
                  <textarea value={profileForm.work_style} onChange={e => setProfileForm(f => ({ ...f, work_style: e.target.value }))}
                    placeholder="예: 빠른 실행 선호, 병렬 업무 처리 능숙"
                    rows={3} style={{ ...FS, width: "100%", resize: "none" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>✅ 선호 업무 유형</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {WORK_TYPES.map(wt => (
                    <button key={wt.value} onClick={() => toggleType(wt.value)}
                      style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        background: profileForm.preferred_types.includes(wt.value) ? "var(--cyan-bg)" : "var(--bg-3)",
                        color: profileForm.preferred_types.includes(wt.value) ? "var(--cyan)" : "var(--text-3)",
                        border: `1px solid ${profileForm.preferred_types.includes(wt.value) ? "#BFDBFE" : "var(--border)"}`,
                      }}>
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>⚠ 주의사항</label>
                <textarea value={profileForm.cautions} onChange={e => setProfileForm(f => ({ ...f, cautions: e.target.value }))}
                  placeholder="예: 복잡한 기획 업무에서 진행 속도 저하"
                  rows={2} style={{ ...FS, width: "100%", resize: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>🔒 비공개 메모 (Admin만 열람)</label>
                <textarea value={profileForm.admin_notes} onChange={e => setProfileForm(f => ({ ...f, admin_notes: e.target.value }))}
                  placeholder="관찰 내용, 피드백 히스토리 등"
                  rows={4} style={{ ...FS, width: "100%", resize: "none", borderColor: "rgba(220,38,38,0.3)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={saveProfile} disabled={profileSaving}
                  style={{ padding: "8px 24px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: profileSaving ? 0.4 : 1 }}>
                  {profileSaving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 우선순위 탭 */}
          {profileTab === "priority" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#EEF3FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px" }}>
                <p style={{ fontSize: 12, color: "#2563EB", margin: 0, lineHeight: 1.6 }}>
                  <b>사용 방법</b> — 업무에 순서 번호를 입력하면 해당 팀원 홈 화면에 "🎯 이번 주 집중 업무"로 표시됩니다.<br/>
                  메모를 입력하면 팀원에게 이유나 지시사항을 전달할 수 있습니다.
                </p>
              </div>

              {prioritized.length > 0 && (
                <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#EEF3FF", borderBottom: "1px solid #BFDBFE" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", margin: 0 }}>🎯 우선순위 지정됨 ({prioritized.length}건)</p>
                    <button onClick={clearAllPriorities} disabled={prioritySaving}
                      style={{ fontSize: 11, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer" }}>
                      전체 초기화
                    </button>
                  </div>
                  {prioritized.map((task, idx) => {
                    const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                    return (
                      <div key={task.id} style={{ padding: "12px 16px", borderBottom: idx < prioritized.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cyan)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                            {task.priority_order}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                                {STATUS_LABEL[task.status]}
                              </span>
                              {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: "0 0 6px" }}>{task.title}</p>
                            <input
                              value={task.priority_note ?? ""}
                              onChange={e => setPriorityNote(task.id, e.target.value)}
                              placeholder="팀원에게 전달할 메모 (선택)"
                              style={{ ...FS, fontSize: 11, padding: "4px 8px", width: "100%", background: "var(--bg-3)", borderColor: "#BFDBFE" }}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                            <input type="number" min="1" max="99"
                              value={task.priority_order ?? ""}
                              onChange={e => setPriorityOrder(task.id, e.target.value ? parseInt(e.target.value) : null)}
                              style={{ ...FS, width: 52, padding: "4px 6px", textAlign: "center", fontSize: 13 }}
                            />
                            <button onClick={() => setPriorityOrder(task.id, null)}
                              style={{ fontSize: 10, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}>
                              제거
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>
                    미지정 업무 ({unset.length}건) — 순서 번호를 입력해 우선순위 지정
                  </p>
                </div>
                {unset.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>모든 업무에 우선순위가 지정됐습니다</p>
                ) : unset.map((task, idx) => {
                  const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                  return (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: idx < unset.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                            {STATUS_LABEL[task.status]}
                          </span>
                          {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                          {task.due_date && <span style={{ fontSize: 11, color: "var(--text-3)" }}>D-{Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000)}</span>}
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                      </div>
                      <input type="number" min="1" max="99"
                        placeholder="순서"
                        onBlur={e => { if (e.target.value) setPriorityOrder(task.id, parseInt(e.target.value)); }}
                        onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) setPriorityOrder(task.id, parseInt((e.target as HTMLInputElement).value)); }}
                        style={{ ...FS, width: 64, padding: "5px 8px", textAlign: "center", fontSize: 13, flexShrink: 0 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 업무 노트 탭 */}
          {profileTab === "notes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {userTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                  <p style={{ fontSize: 13, color: "var(--text-3)" }}>담당 업무가 없습니다</p>
                </div>
              ) : userTasks.map(task => {
                const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                const notes = taskNotes[task.id] ?? [];
                const isAdding = addingNoteTaskId === task.id;
                return (
                  <div key={task.id} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${sc}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                            {STATUS_LABEL[task.status]}
                          </span>
                          {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                      </div>
                      <button onClick={() => { setAddingNoteTaskId(isAdding ? null : task.id); setNewNote(""); }}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: isAdding ? "var(--bg-4)" : "var(--bg-3)", color: "var(--cyan)", border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0 }}>
                        {isAdding ? "취소" : "+ 노트"}
                      </button>
                    </div>
                    {isAdding && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                          placeholder="이 업무에 대한 관찰 내용 (Admin만 볼 수 있습니다)" rows={2} autoFocus
                          style={{ ...FS, width: "100%", resize: "none", fontSize: 12, borderColor: "rgba(220,38,38,0.3)" }} />
                        <button onClick={() => addTaskNote(task.id)} disabled={!newNote.trim()}
                          style={{ padding: "5px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, fontSize: 11, fontWeight: 600, color: "#DC2626", cursor: "pointer", width: "fit-content", opacity: !newNote.trim() ? 0.4 : 1 }}>
                          🔒 저장
                        </button>
                      </div>
                    )}
                    {notes.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                        {notes.map((n: any) => (
                          <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, padding: "7px 10px" }}>
                              <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{n.note}</p>
                              <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0" }}>
                                🔒 {new Date(n.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <button onClick={() => deleteNote(n.id)} style={{ fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer", marginTop: 2 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12, minHeight: 300 }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>좌측에서 팀원을 선택하세요</p>
        </div>
      )}
    </div>
  );
}
