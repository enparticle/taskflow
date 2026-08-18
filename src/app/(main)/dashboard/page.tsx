// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { authFetch } from "@/lib/authFetch";
import { getAuthUser } from "@/lib/auth";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";
import TaskCard from "@/components/tasks/TaskCard";
import TaskList from "@/components/tasks/TaskList";

const STATUS_COLOR: Record<string, string> = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};

// 주간 요약 (기존 유지)
// 이번 주 캘린더 미리보기 위젯 (강승구님 피드백 반영)
function CalendarPreview({ myUserId }: { myUserId: string }) {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 7);

      const { data } = await supabase.from("calendar_events")
        .select("id, title, start_date, type, color")
        .or(`is_public.eq.true,user_id.eq.${myUserId}`)
        .gte("start_date", start.toISOString())
        .lt("start_date", end.toISOString())
        .order("start_date");
      setEvents(data ?? []);
      setLoading(false);
    })();
  }, [myUserId]);

  const TYPE_COLOR: Record<string, string> = { personal: "#a78bfa", vacation: "#34d399", holiday: "#f87171", meeting: "#60a5fa", deadline: "#fbbf24" };

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 14px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>📅 이번 주 일정</span>
        <a href="/calendar" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>전체 보기 →</a>
      </div>
      <div style={{ padding: 14 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "8px 0" }}>불러오는 중…</p>
        ) : events.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "8px 0" }}>이번 주 일정이 없어요</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.slice(0, 5).map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color || TYPE_COLOR[ev.type] || "var(--text-3)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>{ev.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {new Date(ev.start_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklySummary({ tasks }: { tasks: any[] }) {
  const done = tasks.filter(t => t.status === "done").length;
  const doing = tasks.filter(t => t.status === "doing").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;

  const items = [
    { label: "완료", value: done, color: "#16A34A", bg: "#F0FDF4", href: "/tasks?status=done" },
    { label: "진행 중", value: doing, color: "#2563EB", bg: "#EEF3FF", href: "/tasks?status=doing" },
    { label: "Blocked", value: blocked, color: "#DC2626", bg: "#FEF2F2", href: "/tasks?status=blocked" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {items.map(item => (
        <a key={item.label} href={item.href} style={{ textDecoration: "none" }}>
          <div style={{
            background: item.bg, border: `1px solid ${item.color}20`,
            borderRadius: 10, padding: "14px 16px", textAlign: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget as any).style.borderColor = item.color}
            onMouseLeave={e => (e.currentTarget as any).style.borderColor = `${item.color}20`}>
            <p style={{ fontSize: 24, fontWeight: 800, color: item.color, margin: "0 0 4px" }}>{item.value}</p>
            <p style={{ fontSize: 11, color: item.color, margin: 0, fontWeight: 500 }}>{item.label}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

// AI 브리핑 (기존 유지)
// 간단한 서식 렌더러 — **굵게**와 줄바꿈만 지원 (라이브러리 없이 가볍게)
function renderFormattedText(text: string) {
  const lines = (text ?? "").split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={i} style={{ display: "block", marginBottom: line.trim() ? 4 : 8 }}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} style={{ fontWeight: 700, fontSize: "1.05em", color: "var(--text-1)" }}>{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
      </span>
    );
  });
}

function AIBriefing({ tasks, myUser, startExpanded }: { tasks: any[]; myUser: any; startExpanded?: boolean }) {
  const [open, setOpen] = useState(!!startExpanded);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (startExpanded && !briefing) generate();
  }, []);

  async function generate() {
    if (briefing) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/briefing", {
        method: "POST",
        body: JSON.stringify({
          tasks,
          userName: myUser?.name ?? "팀원",
          now: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      setBriefing(data.briefing ?? "브리핑을 생성할 수 없습니다.");
    } catch {
      setBriefing("브리핑 생성 중 오류가 발생했습니다.");
    }
    setLoading(false);
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !briefing) generate();
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={handleToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cyan)" }}>AI 브리핑</span>
          {!open && <span style={{ fontSize: 11, color: "var(--text-3)" }}>오늘의 업무 요약</span>}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
              <div style={{ width: 14, height: 14, border: "2px solid var(--cyan)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>분석 중...</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7, margin: "0 0 10px" }}>{renderFormattedText(briefing)}</div>
              <button onClick={() => { setBriefing(null); generate(); }}
                style={{ fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                🔄 다시 생성
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 신규: 오늘 한 일 기록 입력 + AI 제안 ─────────────────────────
// 계획형 전용 — 실제 할 일 목록 (WeeklySummary 위에 배치)
function TodayTaskList({ tasks, onOpen, onAdd }: { tasks: any[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const list = [...tasks]
    .filter(t => t.status !== "done")
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })
    .slice(0, 6);

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 14px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>오늘 할 일</span>
        </div>
        <button onClick={onAdd}
          style={{ padding: "5px 12px", background: "var(--cyan)", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          + 업무 추가
        </button>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {list.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>등록된 할 일이 없어요. 위 버튼으로 추가해보세요</p>
        ) : (
          list.map(t => <TaskCard key={t.id} task={t} onRefresh={() => {}} />)
        )}
      </div>
    </div>
  );
}

function DailyLog({ myUser, myTasks, onChanged, onOpen, startCollapsed, autoApprove, aiTone }: { myUser: any; myTasks: any[]; onChanged: () => void; onOpen: (id: string) => void; startCollapsed?: boolean; autoApprove?: boolean; aiTone?: string }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [inputOpen, setInputOpen] = useState(!startCollapsed);
  const [asking, setAsking] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]); // { type, taskId?, title, status?, reason }
  const [reply, setReply] = useState("");
  const [appliedTone, setAppliedTone] = useState<string | null>(null);
  const [dismissedIdx, setDismissedIdx] = useState<Set<number>>(new Set());
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState<number | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // 프로젝트명 → project_id 매핑 (신규 업무 생성 시 프로젝트 배정용)
  const projectNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of myTasks) {
      if (t.project?.name && t.project_id) map[t.project.name] = t.project_id;
    }
    return map;
  }, [myTasks]);

  const loadRecent = useCallback(async () => {
    if (!myUser) return;
    setRecentLoading(true);
    const { data } = await supabase.from("task_comments")
      .select("id, content, created_at, task:tasks(id, title, status)")
      .eq("user_id", myUser.id)
      .order("created_at", { ascending: false })
      .limit(6);
    setRecent((data ?? []).filter((r: any) => r.task));
    setRecentLoading(false);
  }, [myUser]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  async function ask() {
    if (!text.trim() || asking) return;
    setAsking(true);
    setSuggestions([]); setReply(""); setDismissedIdx(new Set()); setAppliedIdx(new Set());
    try {
      const res = await authFetch("/api/daily-log", {
        method: "POST",
        body: JSON.stringify({
          text,
          userName: myUser?.name ?? "팀원",
          tasks: myTasks.map(t => ({ id: t.id, title: t.title, status: t.status, project: t.project?.name ?? null })),
          now: new Date().toISOString(),
          aiTone: aiTone ?? "concise",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReply("기록을 분석하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        setSuggestions([]);
      } else {
        setReply(data.reply ?? "");
        setAppliedTone(data.appliedTone ?? null);
        setSuggestions(data.suggestions ?? []);
        // 자동 승인 설정이면 확인 없이 바로 전부 반영
        if (autoApprove && data.suggestions?.length > 0) {
          data.suggestions.forEach((s: any, i: number) => applyOne(s, i));
        }
      }
    } catch {
      setReply("기록을 분석하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    }
    setAsking(false);
  }

  async function applyOne(s: any, idx: number | null) {
    if (idx !== null) setApplying(idx);
    try {
      let targetTaskId: string | null = null;

      if (s.type === "complete" && s.taskId) {
        await supabase.from("tasks").update({ status: "done" }).eq("id", s.taskId);
        targetTaskId = s.taskId;
      } else if (s.type === "create") {
        const projectId = s.project ? projectNameToId[s.project] : undefined;
        const { data: created } = await supabase.from("tasks").insert({
          title: s.title,
          status: s.status === "doing" ? "doing" : "done",
          assignee_id: myUser.id,
          assignee_ids: [myUser.id],
          project_id: projectId ?? null,
        }).select("id").single();
        targetTaskId = created?.id ?? null;
      }

      // 원문 기록을 해당 업무의 댓글로 남김 — 업무 상세/프로젝트 상세에서 그대로 보이게
      if (targetTaskId && text.trim()) {
        await supabase.from("task_comments").insert({
          task_id: targetTaskId,
          user_id: myUser.id,
          content: `📝 홈 기록: ${text.trim()}`,
        });
      }

      // 학습 루프용 기록 — 이 제안이 "맞았다"는 사례로 남김 (3단계)
      await supabase.from("ai_suggestions").insert({
        task_id: targetTaskId,
        type: s.type === "complete" ? "status" : "create_task",
        field: s.type === "complete" ? "status" : "title",
        current_value: s.type === "complete" ? "미완료" : null,
        suggested_value: s.type === "complete" ? "done" : s.title,
        reason: s.reason ?? null,
        status: "approved",
        source: "daily_log",
        source_text: text.trim() || null,
        user_id: myUser.id,
        reviewed_by: myUser.id,
        reviewed_at: new Date().toISOString(),
      });

      if (idx !== null) setAppliedIdx(prev => new Set(prev).add(idx));
      onChanged();
      loadRecent();
    } finally {
      if (idx !== null) setApplying(null);
    }
  }

  async function applySuggestion(idx: number) {
    await applyOne(suggestions[idx], idx);
  }

  async function dismissSuggestion(idx: number) {
    const s = suggestions[idx];
    setDismissedIdx(prev => new Set(prev).add(idx));
    // 학습 루프용 기록 — 이 제안이 "틀렸다"는 사례로 남김
    await supabase.from("ai_suggestions").insert({
      task_id: s.taskId ?? null,
      type: s.type === "complete" ? "status" : "create_task",
      field: s.type === "complete" ? "status" : "title",
      suggested_value: s.type === "complete" ? "done" : s.title,
      reason: s.reason ?? null,
      status: "rejected",
      source: "daily_log",
      source_text: text.trim() || null,
      user_id: myUser?.id ?? null,
      reviewed_by: myUser?.id ?? null,
      reviewed_at: new Date().toISOString(),
    });
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 14px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
      <button onClick={() => setInputOpen(v => !v)}
        style={{ width: "100%", padding: "14px 18px", background: "var(--bg-3)", borderBottom: inputOpen ? "1px solid var(--border)" : "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>오늘 한 일을 적어주세요</span>
          {startCollapsed && (
            <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>{inputOpen ? "▾ 접기" : "▸ 펼치기"}</span>
          )}
        </div>
      </button>

      {inputOpen && (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="예: 로그인 페이지 UI 다 만들었고, API 연동하다가 CORS 이슈로 막혔어"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box", resize: "none",
            background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "10px 12px", fontSize: 13, color: "var(--text-1)", outline: "none",
          }}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(); }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={ask} disabled={asking || !text.trim()}
            style={{
              padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer",
              opacity: asking || !text.trim() ? 0.4 : 1,
            }}>
            {asking ? "분석 중…" : "AI에게 물어보기"}
          </button>
        </div>

        {reply && (
          <div>
            <p style={{ fontSize: 12, color: "var(--text-2)", background: "var(--bg-3)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
              {reply}
            </p>
            {appliedTone && (
              <p style={{ fontSize: 10, color: "var(--text-3)", margin: "4px 0 0 4px" }}>
                ({appliedTone === "detailed" ? "자세히" : appliedTone === "detailed_with_summary" ? "요약+자세히" : "간결하게"} — 내 설정 기준)
              </p>
            )}
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, idx) => {
              if (dismissedIdx.has(idx)) return null;
              const isApplied = appliedIdx.has(idx);
              return (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: isApplied ? "#F0FDF4" : "#EEF3FF",
                  border: `1px solid ${isApplied ? "#BBF7D0" : "#BFDBFE"}`,
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <span style={{ fontSize: 16 }}>{s.type === "complete" ? "✅" : "🆕"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                      {s.type === "complete" ? `'${s.title}' 완료 처리` : `'${s.title}' 새 업무로 등록`}
                      {s.type === "create" && s.project && (
                        <span style={{ fontSize: 10, marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "var(--bg-4)", color: "var(--text-3)", fontWeight: 500 }}>
                          {s.project}
                        </span>
                      )}
                    </p>
                    {s.reason && <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{s.reason}</p>}
                  </div>
                  {isApplied ? (
                    <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600, flexShrink: 0 }}>적용됨</span>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => applySuggestion(idx)} disabled={applying === idx}
                        style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: "var(--cyan)", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: applying === idx ? 0.5 : 1 }}>
                        {s.type === "complete" ? "완료 처리" : "등록"}
                      </button>
                      <button onClick={() => dismissSuggestion(idx)}
                        style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}>
                        무시
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* 최근 기록 */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 8 }}>최근 기록</p>
        {recentLoading ? (
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>불러오는 중…</p>
        ) : recent.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>아직 기록이 없어요</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {recent.map((r: any) => {
              const sc = STATUS_COLOR[r.task.status] ?? "#A8A8A4";
              return (
                <div key={r.id} onClick={() => onOpen(r.task.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 6, padding: "2px 4px" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600, flexShrink: 0 }}>
                    {STATUS_LABEL[r.task.status]}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.task.title}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [catchup, setCatchup] = useState<{ days: number; doneCount: number; notifCount: number; blockedCount: number } | null>(null);
  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    const authUser = await getAuthUser();
    if (!authUser) return;

    const { data: me } = await supabase.from("users").select("*").eq("id", authUser.userId).single();
    setMyUser(me);

    if (authUser.role === "viewer") { setLoading(false); return; }

    const { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", authUser.userId).maybeSingle();
    setPreferences(prefs); // null이면 온보딩 마법사 노출

    // 3. 로그인 캐치업 브리핑 — "가끔만 확인" 성향인 사람이 며칠 만에 왔으면 그동안 요약
    if (prefs?.consumption_style === "summary" && me?.last_seen_at) {
      const gapDays = (Date.now() - new Date(me.last_seen_at).getTime()) / 86400000;
      if (gapDays >= 2) {
        const since = me.last_seen_at;
        const [{ count: doneCount }, { count: notifCount }, { count: blockedCount }] = await Promise.all([
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").gte("updated_at", since),
          supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", authUser.userId).gte("created_at", since),
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "blocked").gte("updated_at", since),
        ]);
        setCatchup({ days: Math.floor(gapDays), doneCount: doneCount ?? 0, notifCount: notifCount ?? 0, blockedCount: blockedCount ?? 0 });
      }
    }
    if (me?.id) {
      await supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id);
    }

    const { data: tasks } = await supabase.from("tasks")
      .select("*, project:projects(name)")
      .or(`assignee_id.eq.${authUser.userId},assignee_ids.cs.{${authUser.userId}}`)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false });

    setMyTasks(tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <p style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중...</p>
    </div>
  );
  if (!myUser) return null;

  const isViewer = myUser.role === "viewer";
  const greet = now.getHours() < 12 ? "좋은 아침이에요" : now.getHours() < 18 ? "안녕하세요" : "수고하셨어요";
  const needsOnboarding = !isViewer && (!preferences || !preferences.onboarding_completed);
  const inputStyle = preferences?.input_style ?? "log";
  const hiddenWidgets: string[] = preferences?.hidden_widgets ?? [];
  const greetingEnabled = preferences?.greeting_enabled !== false; // 기본 true
  const briefingAutoExpand = !!preferences?.briefing_auto_expand;
  const aiAutoApprove = !!preferences?.ai_auto_approve;

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>

      {needsOnboarding && (
        <OnboardingWizard userId={myUser.id} onDone={load} />
      )}

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
            {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          {greetingEnabled ? (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
              {greet}, {myUser.name}님
            </h1>
          ) : (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{myUser.name}</h1>
          )}
        </div>
        {!isViewer && (
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/meeting-note"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", textDecoration: "none" }}>
              📝 회의 기록
            </a>
            <button onClick={() => setOpenForm(true)}
              style={{ padding: "8px 14px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              + 업무 추가
            </button>
          </div>
        )}
      </div>

      {/* 3. 캐치업 브리핑 — 며칠 만에 로그인한 "가끔만 확인" 성향인 사람용 */}
      {catchup && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--cyan-bg)", border: "1px solid var(--cyan)", borderRadius: 12, padding: "12px 16px" }}>
          <span style={{ fontSize: 18 }}>👋</span>
          <p style={{ flex: 1, fontSize: 12, color: "var(--text-1)", margin: 0 }}>
            {catchup.days}일 만에 오셨네요 — 그동안 <b>완료 {catchup.doneCount}건</b>, <b>새 알림 {catchup.notifCount}건</b>
            {catchup.blockedCount > 0 && <>, <b style={{ color: "#DC2626" }}>Blocked {catchup.blockedCount}건</b></>} 있었어요.
          </p>
          <button onClick={() => setCatchup(null)} style={{ fontSize: 16, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {!isViewer && (
        <>
          {/* 클릭형: 굳이 안 적어도 된다는 안내 (위젯은 아니라 순서 밖에서 항상 위에) */}
          {inputStyle === "click" && !hiddenWidgets.includes("recent") && (
            <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px" }}>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
                🖱 글 쓰는 게 귀찮으면 <a href="/tasks" style={{ color: "var(--cyan)" }}>업무 탭</a>에서 상태만 클릭해서 바꾸셔도 똑같이 기록이 남아요.
              </p>
            </div>
          )}

          {/* 로그인 후 기본 화면을 "내 업무"로 설정한 경우 — 홈 화면 안에 내 업무 목록을 띄움 (다른 페이지로 이동 아님) */}
          {preferences?.landing_page === "my-work" && (
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 14px)", overflow: "hidden", boxShadow: "var(--shadow, none)" }}>
              <div style={{ padding: "14px 18px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>📋 내 업무</span>
              </div>
              <div style={{ padding: 16 }}>
                <TaskList tasks={myTasks} onRefresh={load} showBulkActions={false} />
              </div>
            </div>
          )}

          {/* 홈 위젯 3개(today/recent/summary) — 설정한 순서 그대로, 숨긴 건 제외 */}
          {(preferences?.home_priority ?? ["today", "recent", "summary"])
            .filter((key: string) => !hiddenWidgets.includes(key))
            .map((key: string) => {
              if (key === "today") {
                // 계획형에서만 실제 할 일 목록으로 의미가 있음. 다른 스타일은 이 자리를 건너뜀
                return inputStyle === "plan" ? (
                  <TodayTaskList key="today" tasks={myTasks} onOpen={(id: string) => setOpenDetail(id)} onAdd={() => setOpenForm(true)} />
                ) : null;
              }
              if (key === "recent") {
                return (
                  <DailyLog key="recent" myUser={myUser} myTasks={myTasks} onChanged={load} onOpen={(id: string) => setOpenDetail(id)}
                    startCollapsed={inputStyle === "click"} autoApprove={aiAutoApprove} aiTone={preferences?.ai_tone} />
                );
              }
              if (key === "summary") {
                return <WeeklySummary key="summary" tasks={myTasks} />;
              }
              if (key === "calendar") {
                return <CalendarPreview key="calendar" myUserId={myUser.id} />;
              }
              return null;
            })}

          {/* AI 브리핑 */}
          <AIBriefing tasks={myTasks} myUser={myUser} startExpanded={briefingAutoExpand} />
        </>
      )}

      {isViewer && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>전체 현황은 <a href="/viewer" style={{ color: "var(--cyan)" }}>뷰어 페이지</a>에서 확인하세요</p>
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onSaved={() => { load(); setOpenForm(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={load} />}
    </div>
  );
}
