// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";

const STATUS_COLOR: Record<string, string> = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};

// 주간 요약 (기존 유지)
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
function AIBriefing({ tasks, myUser }: { tasks: any[]; myUser: any }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (briefing) return;
    setLoading(true);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
              <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7, margin: "0 0 10px" }}>{briefing}</p>
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
function DailyLog({ myUser, myTasks, onChanged, onOpen }: { myUser: any; myTasks: any[]; onChanged: () => void; onOpen: (id: string) => void }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]); // { type, taskId?, title, status?, reason }
  const [reply, setReply] = useState("");
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
      const res = await fetch("/api/daily-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          userName: myUser?.name ?? "팀원",
          tasks: myTasks.map(t => ({ id: t.id, title: t.title, status: t.status, project: t.project?.name ?? null })),
          now: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReply("기록을 분석하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        setSuggestions([]);
      } else {
        setReply(data.reply ?? "");
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      setReply("기록을 분석하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    }
    setAsking(false);
  }

  async function applySuggestion(idx: number) {
    const s = suggestions[idx];
    setApplying(idx);
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

      setAppliedIdx(prev => new Set(prev).add(idx));
      onChanged();
      loadRecent();
    } finally {
      setApplying(null);
    }
  }

  function dismissSuggestion(idx: number) {
    setDismissedIdx(prev => new Set(prev).add(idx));
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>오늘 한 일을 적어주세요</span>
        </div>
      </div>

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
          <p style={{ fontSize: 12, color: "var(--text-2)", background: "var(--bg-3)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
            {reply}
          </p>
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
  const [loading, setLoading] = useState(true);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    const authUser = await getAuthUser();
    if (!authUser) return;

    const { data: me } = await supabase.from("users").select("*").eq("id", authUser.userId).single();
    setMyUser(me);

    if (authUser.role === "viewer") { setLoading(false); return; }

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

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
            {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
            {greet}, {myUser.name}님
          </h1>
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

      {!isViewer && (
        <>
          {/* 주간 요약 */}
          <WeeklySummary tasks={myTasks} />

          {/* 오늘 한 일 기록 (구 "오늘의 포커스" 대체) */}
          <DailyLog myUser={myUser} myTasks={myTasks} onChanged={load} onOpen={(id: string) => setOpenDetail(id)} />

          {/* AI 브리핑 (접힌 상태) */}
          <AIBriefing tasks={myTasks} myUser={myUser} />
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
