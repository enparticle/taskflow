// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import StyleChatWizard from "@/components/onboarding/StyleChatWizard";
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
  { value: "calendar", label: "캘린더 미리보기 (이번주 일정)" },
];
const CONSUMPTION_STYLE_OPTIONS = [
  { value: "monitor", title: "네, 자주 봐요" },
  { value: "summary", title: "아니요, 필요할 때만" },
  { value: "unsure", title: "잘 모르겠어요" },
];
const ADVANCED_FEATURES = [
  { key: "my-work", emoji: "📋", label: "내 업무", desc: "담당 업무만 마감일순으로 빠르게", path: "/my-work" },
  { key: "kanban", emoji: "📊", label: "칸반 보드", desc: "상태별로 시각화, 드래그로 상태 변경", path: "/kanban" },
  { key: "tree", emoji: "🌳", label: "업무 트리 / 간트", desc: "프로젝트→마일스톤→업무 계층 + 간트 타임라인", path: "/tree" },
  { key: "recurring", emoji: "🔄", label: "반복 업무", desc: "매주 반복되는 팀/개인 업무 자동 등록", path: "/recurring" },
  { key: "project-assistant", emoji: "🤖", label: "AI 프로젝트 어시스턴트", desc: "대화로 프로젝트 구성, 방향 변경 반영", path: "/project-assistant" },
  { key: "report-export", emoji: "📄", label: "외부용 보고서", desc: "팀 외부 공유용 진행 보고서 작성", path: "/report-export" },
];

// AI가 감지한 설정-실제행동 불일치 제안 (5번 기능)
function PreferenceSuggestions({ myUserId, supabase, onApplied }: { myUserId: string; supabase: any; onApplied: () => void }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const load = () => {
    if (!myUserId) return;
    supabase.from("preference_suggestions").select("*").eq("user_id", myUserId).eq("status", "pending")
      .then(({ data }: any) => setSuggestions(data ?? []));
  };
  useEffect(() => { load(); }, [myUserId]);

  const FIELD_LABEL: Record<string, string> = { ai_tone: "AI 응답 톤", home_priority: "홈 위젯 순서" };
  const VALUE_LABEL: Record<string, string> = {
    concise: "간결히", detailed: "자세히", detailed_with_summary: "요약+자세히",
    today: "오늘 할 일", recent: "최근 기록", summary: "주간 요약", calendar: "캘린더",
  };

  function displayValue(field: string, value: string) {
    if (field === "home_priority") return value.split(",").map(v => VALUE_LABEL[v] ?? v).join(" → ");
    return VALUE_LABEL[value] ?? value;
  }

  async function respond(s: any, accept: boolean) {
    if (accept) {
      const value = s.field === "home_priority" ? s.suggested_value.split(",") : s.suggested_value;
      await supabase.from("user_preferences").update({ [s.field]: value }).eq("user_id", myUserId);
      onApplied();
    }
    await supabase.from("preference_suggestions").update({ status: accept ? "accepted" : "dismissed" }).eq("id", s.id);
    load();
  }

  if (suggestions.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {suggestions.map(s => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "12px 16px" }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: "#92400E", margin: 0, fontWeight: 600 }}>
              {FIELD_LABEL[s.field] ?? s.field}을(를) "{displayValue(s.field, s.suggested_value)}"로 바꿔볼까요?
            </p>
            <p style={{ fontSize: 11, color: "#B45309", margin: "2px 0 0" }}>{s.reason}</p>
          </div>
          <button onClick={() => respond(s, true)}
            style={{ fontSize: 11, padding: "5px 12px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
            바꾸기
          </button>
          <button onClick={() => respond(s, false)}
            style={{ fontSize: 11, padding: "5px 12px", background: "transparent", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
            괜찮아요
          </button>
        </div>
      ))}
    </div>
  );
}

function StyleTab({ myUserId, supabase }: { myUserId: string; supabase: any }) {
  const [inputStyle, setInputStyle] = useState("log");
  const [homePriority, setHomePriority] = useState("today");
  const [consumptionStyle, setConsumptionStyle] = useState("unsure");
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [mirrorCasualTone, setMirrorCasualTone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const loadPrefs = () => {
    if (!myUserId) return;
    supabase.from("user_preferences").select("*").eq("user_id", myUserId).maybeSingle().then(({ data }: any) => {
      if (data) {
        setInputStyle(data.input_style ?? "log");
        setHomePriority(data.home_priority?.[0] ?? "today");
        setConsumptionStyle(data.consumption_style ?? "unsure");
        setEnabledFeatures(data.enabled_features ?? []);
        setMirrorCasualTone(!!data.mirror_casual_tone);
      }
      setLoaded(true);
    });
  };

  useEffect(() => { loadPrefs(); }, [myUserId]);

  function toggleFeature(key: string) {
    setEnabledFeatures(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  }

  async function save() {
    setSaving(true); setSaved(false);
    const priorityOrder = [homePriority, ...HOME_PRIORITY_OPTIONS.map(h => h.value).filter(v => v !== homePriority)];
    await supabase.from("user_preferences").upsert({
      user_id: myUserId,
      input_style: inputStyle,
      home_priority: priorityOrder,
      consumption_style: consumptionStyle,
      enabled_features: enabledFeatures,
      mirror_casual_tone: mirrorCasualTone,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!loaded) return <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreferenceSuggestions myUserId={myUserId} supabase={supabase} onApplied={loadPrefs} />

      <button onClick={() => setShowChat(true)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left",
          background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(46,134,255,0.12))", border: "1px solid rgba(167,139,250,0.3)",
        }}>
        <span style={{ fontSize: 20 }}>💬</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>AI와 대화로 스타일 설정하기</p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>입력방식·홈화면·알림·화면밀도 등 20가지를 대화하면서 한 번에 설정해요</p>
        </div>
      </button>

      {showChat && (
        <StyleChatWizard onClose={() => setShowChat(false)} onSaved={() => { loadPrefs(); setShowChat(false); window.location.reload(); }} />
      )}

      <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>또는 아래에서 기본 항목만 직접 고를 수도 있어요</p>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>AI가 내 말투를 따라해도 될까요?</h2>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
          말투 학습(communication_profile)은 항상 켜져 있지만, 켜두면 AI가 캐주얼한 표현("ㅋㅋ" 등)까지 따라해요. 기본은 꺼짐 — AI는 항상 정중하게 답해요.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={mirrorCasualTone} onChange={e => setMirrorCasualTone(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--cyan)", cursor: "pointer" }} />
          <span style={{ fontSize: 12, color: "var(--text-1)" }}>AI가 제 캐주얼한 말투도 따라하게 해주세요</span>
        </label>
      </div>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>고급 기능</h2>
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>켜면 하단 "더보기" 메뉴에 나타나요. 필요한 것만 골라서 쓰세요</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ADVANCED_FEATURES.map(f => (
            <label key={f.key} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              background: enabledFeatures.includes(f.key) ? "var(--cyan-bg)" : "var(--bg-3)",
              border: `1px solid ${enabledFeatures.includes(f.key) ? "var(--cyan)" : "var(--border)"}`,
            }}>
              <input type="checkbox" checked={enabledFeatures.includes(f.key)} onChange={() => toggleFeature(f.key)}
                style={{ width: 15, height: 15, accentColor: "var(--cyan)", cursor: "pointer" }} />
              <span style={{ fontSize: 16 }}>{f.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{f.label}</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "1px 0 0" }}>{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <DesignThemeSection myUserId={myUserId} supabase={supabase} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "8px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "저장 중…" : "저장"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#16A34A" }}>✓ 저장됐어요, 홈 화면·메뉴에 바로 반영돼요</span>}
      </div>
    </div>
  );
}

// ── 디자인 커스터마이징 — AI가 CSS 색상 변수만 생성 (4단계) ──────
// 프리셋 테마 — 설명 없이 바로 골라서 크게크게 바꿀 수 있음 (AI 호출 없이 즉시 적용)
const PRESET_THEMES = [
  {
    key: "default", emoji: "🌑", label: "기본 다크",
    vars: {
      "--bg": "#0D1B2E", "--bg-2": "#131F35", "--bg-3": "#1A2A45", "--bg-4": "#223655",
      "--text-1": "#E8F0FF", "--text-2": "#A8BFDD", "--text-3": "#6B84A8",
      "--border": "rgba(255,255,255,0.08)", "--border-2": "rgba(255,255,255,0.14)",
      "--cyan": "#00C2CC", "--cyan-bg": "rgba(0,194,204,0.12)",
      "--red": "#f87171", "--red-bg": "rgba(248,113,113,0.12)",
      "--green": "#34d399", "--green-bg": "rgba(52,211,153,0.12)",
      "--blue": "#60a5fa", "--blue-bg": "rgba(96,165,250,0.12)",
      "--radius": "12px", "--radius-lg": "14px", "--shadow": "none",
      "--font-family": "'Pretendard', -apple-system, sans-serif",
    },
  },
  {
    key: "white", emoji: "☀️", label: "화이트 미니멀",
    vars: {
      "--bg": "#FFFFFF", "--bg-2": "#F7F8FA", "--bg-3": "#EEF0F3", "--bg-4": "#E2E5EA",
      "--text-1": "#16181D", "--text-2": "#4A4F58", "--text-3": "#8A909B",
      "--border": "rgba(0,0,0,0.08)", "--border-2": "rgba(0,0,0,0.14)",
      "--cyan": "#2563EB", "--cyan-bg": "rgba(37,99,235,0.08)",
      "--red": "#DC2626", "--red-bg": "rgba(220,38,38,0.08)",
      "--green": "#16A34A", "--green-bg": "rgba(22,163,74,0.08)",
      "--blue": "#2563EB", "--blue-bg": "rgba(37,99,235,0.08)",
      "--radius": "10px", "--radius-lg": "14px", "--shadow": "0 1px 3px rgba(0,0,0,0.08)",
      "--font-family": "'Pretendard', -apple-system, sans-serif",
    },
  },
  {
    key: "modern", emoji: "⚫", label: "다크 모던",
    vars: {
      "--bg": "#000000", "--bg-2": "#0A0A0C", "--bg-3": "#16161A", "--bg-4": "#222226",
      "--text-1": "#FFFFFF", "--text-2": "#C4C4CC", "--text-3": "#7A7A85",
      "--border": "rgba(255,255,255,0.08)", "--border-2": "rgba(255,255,255,0.16)",
      "--cyan": "#A78BFA", "--cyan-bg": "rgba(167,139,250,0.14)",
      "--red": "#FF5C7A", "--red-bg": "rgba(255,92,122,0.12)",
      "--green": "#2ED9A3", "--green-bg": "rgba(46,217,163,0.12)",
      "--blue": "#5B9EFF", "--blue-bg": "rgba(91,158,255,0.12)",
      "--radius": "20px", "--radius-lg": "26px", "--shadow": "0 12px 32px rgba(0,0,0,0.5)",
      "--font-family": "-apple-system, 'Segoe UI', sans-serif",
    },
  },
  {
    key: "pastel", emoji: "🌸", label: "파스텔",
    vars: {
      "--bg": "#14151F", "--bg-2": "#1C1E2C", "--bg-3": "#262939", "--bg-4": "#313548",
      "--text-1": "#F0EEF9", "--text-2": "#B9B6CC", "--text-3": "#7C7A94",
      "--border": "rgba(255,255,255,0.07)", "--border-2": "rgba(255,255,255,0.12)",
      "--cyan": "#B8A6F5", "--cyan-bg": "rgba(184,166,245,0.14)",
      "--red": "#F5A0B0", "--red-bg": "rgba(245,160,176,0.12)",
      "--green": "#A0E5C8", "--green-bg": "rgba(160,229,200,0.12)",
      "--blue": "#A6C8F5", "--blue-bg": "rgba(166,200,245,0.12)",
      "--radius": "18px", "--radius-lg": "22px", "--shadow": "0 4px 16px rgba(0,0,0,0.2)",
      "--font-family": "'Pretendard', -apple-system, sans-serif",
    },
  },
  {
    key: "sharp", emoji: "▪️", label: "각지고 심플",
    vars: {
      "--bg": "#101317", "--bg-2": "#171B21", "--bg-3": "#1F242C", "--bg-4": "#272D37",
      "--text-1": "#E4E7EB", "--text-2": "#A0A8B4", "--text-3": "#626B79",
      "--border": "rgba(255,255,255,0.09)", "--border-2": "rgba(255,255,255,0.15)",
      "--cyan": "#00D4A0", "--cyan-bg": "rgba(0,212,160,0.1)",
      "--red": "#FF4D6A", "--red-bg": "rgba(255,77,106,0.1)",
      "--green": "#00D4A0", "--green-bg": "rgba(0,212,160,0.1)",
      "--blue": "#4A9EFF", "--blue-bg": "rgba(74,158,255,0.1)",
      "--radius": "4px", "--radius-lg": "6px", "--shadow": "none",
      "--font-family": "'Pretendard', -apple-system, sans-serif",
    },
  },
];

function buildPresetCss(vars: Record<string, string>) {
  return `:root {\n  ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join("\n  ")}\n}`;
}

function DesignThemeSection({ myUserId, supabase }: { myUserId: string; supabase: any }) {
  const [description, setDescription] = useState("");
  const [currentCss, setCurrentCss] = useState("");
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!myUserId) return;
    supabase.from("user_theme").select("css_text, source_prompt").eq("user_id", myUserId).maybeSingle()
      .then(({ data }: any) => {
        if (data?.css_text) { setCurrentCss(data.css_text); setSourcePrompt(data.source_prompt ?? ""); }
      });
  }, [myUserId]);

  async function generate() {
    if (!description.trim()) return;
    setGenerating(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-theme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCurrentCss(data.css);
      setSourcePrompt(description);
    } catch (e: any) {
      setError(e.message ?? "생성에 실패했어요");
    }
    setGenerating(false);
  }

  async function applyPreset(preset: typeof PRESET_THEMES[number]) {
    setGenerating(true); setError("");
    try {
      const css = buildPresetCss(preset.vars);
      await supabase.from("user_theme").upsert({
        user_id: myUserId,
        css_text: css,
        source_prompt: `프리셋: ${preset.label}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setCurrentCss(css);
      setSourcePrompt(`프리셋: ${preset.label}`);
    } catch (e: any) {
      setError(e.message ?? "적용에 실패했어요");
    }
    setGenerating(false);
  }

  async function reset() {
    if (!confirm("디자인을 기본값으로 되돌릴까요?")) return;
    await supabase.from("user_theme").delete().eq("user_id", myUserId);
    setCurrentCss(""); setSourcePrompt(""); setDescription("");
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>🎨 화면 디자인</h2>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
        원하는 분위기를 말로 설명하면 AI가 색상 팔레트를 만들어드려요. 데이터나 기능은 전혀 안 건드리고, 색상만 바뀌어요.
      </p>

      {sourcePrompt && (
        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, background: "var(--bg-3)", padding: "8px 12px", borderRadius: 8 }}>
          현재 적용된 요청: "{sourcePrompt}"
        </p>
      )}

      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>바로 골라서 크게 바꾸기</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 16 }}>
        {PRESET_THEMES.map(preset => (
          <button key={preset.key} onClick={() => applyPreset(preset)} disabled={generating}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px",
              borderRadius: preset.vars["--radius"], border: `1px solid ${sourcePrompt === `프리셋: ${preset.label}` ? "var(--cyan)" : "var(--border)"}`,
              background: preset.vars["--bg-2"], cursor: "pointer", opacity: generating ? 0.5 : 1,
            }}>
            <span style={{ fontSize: 20 }}>{preset.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: preset.vars["--text-1"] }}>{preset.label}</span>
            <div style={{ display: "flex", gap: 3 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: preset.vars["--cyan"] }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: preset.vars["--bg-3"], border: `1px solid ${preset.vars["--border-2"]}` }} />
            </div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>또는 직접 말로 설명하기</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="예: 차분하고 넓은 느낌으로, 초록색 계열이 좋아요"
          style={{ flex: 1, background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-1)", borderRadius: 8, padding: "8px 12px", fontSize: 12, outline: "none" }}
          onKeyDown={e => { if (e.key === "Enter") generate(); }} />
        <button onClick={generate} disabled={generating || !description.trim()}
          style={{ padding: "8px 16px", background: "linear-gradient(135deg, #A78BFA, #2E86FF)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: generating || !description.trim() ? 0.5 : 1, flexShrink: 0 }}>
          {generating ? "생성 중…" : "✦ 생성"}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 10 }}>{error}</p>}

      {currentCss && (
        <>
          <style dangerouslySetInnerHTML={{ __html: currentCss.replace(":root", "#theme-preview") }} />
          <div id="theme-preview" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>미리보기</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <p style={{ fontSize: 12, color: "var(--text-1)", margin: 0, fontWeight: 600 }}>카드 제목</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "3px 0 0" }}>보조 텍스트</p>
              </div>
              <button style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }}>버튼</button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {currentCss && (
          <button onClick={() => window.location.reload()}
            style={{ padding: "7px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            🔄 새로고침해서 전체 적용
          </button>
        )}
        {currentCss && (
          <button onClick={reset}
            style={{ padding: "7px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
            기본값으로 되돌리기
          </button>
        )}
      </div>
      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8 }}>
        ✦ 생성 버튼을 누르면 바로 저장돼요. 위 미리보기로 먼저 확인하고, 마음에 들면 새로고침을 눌러 앱 전체(홈/업무/프로젝트 등)에 적용하세요.
      </p>
    </div>
  );
}


function AccountTab({
  authEmail, isAdmin, myLinkedUser, allMembers, editingMemberId, setEditingMemberId,
  selectedAuthEmail, setSelectedAuthEmail, linkLoading, handleLink, handleUnlink,
  notifyLoading, notifyResult, sendNotifications, form, setForm, loading, handlePasswordChange,
  error, success,
}: any) {
  return (
    <>
      {/* 내 계정 정보 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>계정 연결</h2>
          <p style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#FFFBEB", color: "#D97706", border: "1px solid #FCD34D", margin: 0 }}>
            계정 연결은 관리자만 설정할 수 있습니다
          </p>
        </div>
      )}

      {/* 알림 발송 (Admin) */}
      {isAdmin && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", padding: 18, boxShadow: "var(--shadow, none)" }}>
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
  const [teamSubTab, setTeamSubTab] = useState<"overview" | "profiles" | "ai_learning" | "pending_changes" | "persona_map">("overview");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("ai_suggestions").select("id", { count: "exact", head: true })
      .eq("source", "project_change").eq("status", "pending")
      .then(({ count }: any) => setPendingCount(count ?? 0));
  }, [isAdmin]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isAdmin && (
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
          {[
            { v: "overview", l: "현황" },
            { v: "persona_map", l: "🧭 팀 성향 지도" },
            { v: "profiles", l: "🧠 팀원 프로필 관리" },
            { v: "pending_changes", l: `⏳ 변경 승인${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { v: "ai_learning", l: "🤖 AI 학습 데이터" },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setTeamSubTab(v as any)}
              style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.15s", background: teamSubTab === v ? "var(--bg-4)" : "transparent", color: teamSubTab === v ? "var(--text-1)" : "var(--text-3)" }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {(!isAdmin || teamSubTab === "overview") ? (
        <TeamOverview isAdmin={isAdmin} supabase={supabase} />
      ) : teamSubTab === "persona_map" ? (
        <PersonaMap supabase={supabase} />
      ) : teamSubTab === "profiles" ? (
        <MemberProfiles myUserId={myUserId} supabase={supabase} />
      ) : teamSubTab === "pending_changes" ? (
        <PendingChanges supabase={supabase} myUserId={myUserId} onCountChange={setPendingCount} />
      ) : (
        <AILearningData supabase={supabase} />
      )}
    </div>
  );
}

// ── 팀 성향 지도 (Admin 전용) — 팀 전체의 개인화 설정을 한눈에 ──
function PersonaMap({ supabase }: { supabase: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("user_preferences")
      .select("*, user:users(name, role)")
      .then(({ data }: any) => { setRows(data ?? []); setLoading(false); });
  }, []);

  const INPUT_LABEL: Record<string, string> = { plan: "📋 계획형", log: "📝 기록형", click: "🖱 클릭형" };
  const TONE_LABEL: Record<string, string> = { concise: "간결", detailed: "자세히", detailed_with_summary: "요약+자세히" };
  const CONSUME_LABEL: Record<string, string> = { monitor: "자주 확인", summary: "가끔만", unsure: "모름" };

  if (loading) return <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 11, color: "var(--text-3)" }}>팀원별로 설정한 스타일을 한눈에 볼 수 있어요.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["이름", "기록스타일", "소비성향", "AI톤", "말투학습", "고급기능"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px", fontWeight: 600, color: "var(--text-1)" }}>{r.user?.name}</td>
                <td style={{ padding: "10px", color: "var(--text-2)" }}>{INPUT_LABEL[r.input_style] ?? r.input_style ?? "-"}</td>
                <td style={{ padding: "10px", color: "var(--text-2)" }}>{CONSUME_LABEL[r.consumption_style] ?? "-"}</td>
                <td style={{ padding: "10px", color: "var(--text-2)" }}>{TONE_LABEL[r.ai_tone] ?? "-"}</td>
                <td style={{ padding: "10px", maxWidth: 260 }}>
                  {r.communication_profile
                    ? <span style={{ color: "var(--text-3)", fontSize: 11 }}>{r.communication_profile}</span>
                    : <span style={{ color: "var(--text-3)", fontSize: 11, fontStyle: "italic" }}>미학습</span>}
                </td>
                <td style={{ padding: "10px", color: "var(--text-3)", fontSize: 11 }}>{(r.enabled_features ?? []).length}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 변경 승인 (Admin 전용) — AI 프로젝트 어시스턴트 "방향 변경 반영"에서 온 제안 ──
function PendingChanges({ supabase, myUserId, onCountChange }: { supabase: any; myUserId: string; onCountChange: (n: number) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("ai_suggestions")
      .select("id, task_id, project_id, type, field, suggested_value, reason, source_text, created_at, user:users(name), task:tasks(title, status, due_date, priority)")
      .eq("source", "project_change").eq("status", "pending")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    onCountChange((data ?? []).length);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(row: any) {
    setActing(row.id);
    const update: any = {};
    update[row.field] = row.suggested_value;
    const { error } = await supabase.from("tasks").update(update).eq("id", row.task_id);
    if (!error) {
      // 상태 변경이면 변경 이력도 기록
      if (row.field === "status") {
        await supabase.from("task_events").insert({
          task_id: row.task_id, event_type: "status_change",
          from_status: row.task?.status ?? null, to_status: row.suggested_value,
          changed_by: myUserId, reason: `AI 방향 변경 승인: ${row.reason ?? ""}`,
        });
      }
      await supabase.from("ai_suggestions").update({ status: "approved", reviewed_by: myUserId, reviewed_at: new Date().toISOString() }).eq("id", row.id);
    }
    setActing(null);
    load();
  }

  async function reject(row: any) {
    setActing(row.id);
    await supabase.from("ai_suggestions").update({ status: "rejected", reviewed_by: myUserId, reviewed_at: new Date().toISOString() }).eq("id", row.id);
    setActing(null);
    load();
  }

  const FIELD_LABEL: Record<string, string> = { due_date: "마감일", status: "상태", priority: "우선순위" };

  if (loading) return <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 11, color: "var(--text-3)" }}>
        AI 프로젝트 어시스턴트의 "방향 변경 반영"에서 제출된 수정 제안이에요. 승인해야 실제 업무에 반영돼요.
      </p>
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius, 12px)" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>승인 대기 중인 변경 제안이 없습니다</p>
        </div>
      ) : (
        rows.map(r => (
          <div key={r.id} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{r.task?.title ?? "삭제된 업무"}</span>
              <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 4, background: "#EEF3FF", color: "#2563EB" }}>
                {FIELD_LABEL[r.field] ?? r.field} → {r.suggested_value}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: "auto" }}>{r.user?.name} 요청</span>
            </div>
            {r.reason && <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 4px" }}>{r.reason}</p>}
            {r.source_text && (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 10px", background: "var(--bg-3)", padding: "6px 10px", borderRadius: 6 }}>
                원 요청: "{r.source_text}"
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => approve(r)} disabled={acting === r.id}
                style={{ fontSize: 11, padding: "5px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, color: "#16A34A", fontWeight: 600, cursor: "pointer" }}>
                ✓ 승인
              </button>
              <button onClick={() => reject(r)} disabled={acting === r.id}
                style={{ fontSize: 11, padding: "5px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, color: "#DC2626", cursor: "pointer" }}>
                반려
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── AI 학습 데이터 (Admin 전용) — 오늘 한 일 기록에서 쌓이는 승인/반려 이력 ──
function AILearningData({ supabase }: { supabase: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    supabase.from("ai_suggestions")
      .select("id, source_text, type, suggested_value, status, reason, created_at, user:users(id, name)")
      .eq("source", "daily_log")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }: any) => { setRows(data ?? []); setLoading(false); });
  }, []);

  const users = Array.from(new Map(rows.filter(r => r.user).map((r: any) => [r.user.id, r.user.name])).entries());

  const filtered = rows.filter(r => {
    if (userFilter && r.user?.id !== userFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const approvedCount = rows.filter(r => r.status === "approved").length;
  const rejectedCount = rows.filter(r => r.status === "rejected").length;

  if (loading) return <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
          승인 {approvedCount}
        </span>
        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
          무시/반려 {rejectedCount}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>최근 {rows.length}건 (최대 100건)</span>

        <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
          style={{ marginLeft: "auto", background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
          <option value="">전체 팀원</option>
          {users.map(([id, name]: any) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
          <option value="all">전체 상태</option>
          <option value="approved">승인만</option>
          <option value="rejected">무시/반려만</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius, 12px)" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>아직 쌓인 데이터가 없습니다</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(r => (
            <div key={r.id} style={{
              background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px",
              borderLeft: `3px solid ${r.status === "approved" ? "#16A34A" : "#DC2626"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-1)" }}>{r.user?.name ?? "알 수 없음"}</span>
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: r.type === "status" ? "#EEF3FF" : "#F5F3FF", color: r.type === "status" ? "#2563EB" : "#7C3AED" }}>
                  {r.type === "status" ? "완료 처리 제안" : "신규 등록 제안"}
                </span>
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: r.status === "approved" ? "#F0FDF4" : "#FEF2F2", color: r.status === "approved" ? "#16A34A" : "#DC2626" }}>
                  {r.status === "approved" ? "✓ 승인" : "✕ 무시/반려"}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: "auto" }}>
                  {new Date(r.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {r.source_text && (
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 4px", background: "var(--bg-3)", padding: "6px 10px", borderRadius: 6 }}>
                  "{r.source_text}"
                </p>
              )}
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                → {r.suggested_value}{r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>
          ))}
        </div>
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
        <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius, 12px)" }}>
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
                <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
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

              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius, 12px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
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
                <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius, 12px)" }}>
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
