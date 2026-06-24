// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import TaskDetail from "@/components/tasks/TaskDetail";
import TaskForm from "@/components/tasks/TaskForm";

const STATUS_COLOR = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};
const STATUS_LABEL = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};
const HEALTH_COLOR = {
  good: "#16A34A", reviewing: "#2563EB",
  at_risk: "#D97706", critical: "#DC2626", suspended: "#A8A8A4",
};
const HEALTH_LABEL = {
  good: "정상", reviewing: "검토", at_risk: "주의", critical: "위험", suspended: "중단",
};

function AIBriefing({ tasks, myUser }: { tasks: any[]; myUser: any }) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    const now = new Date();
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "done");
    const today = tasks.filter(t => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.toDateString() === now.toDateString() && t.status !== "done";
    });
    const blocked = tasks.filter(t => t.status === "blocked");
    const doing = tasks.filter(t => t.status === "doing");
    const soon = tasks.filter(t => {
      if (!t.due_date || t.status === "done") return false;
      const diff = Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000);
      return diff > 0 && diff <= 3;
    });

    const prompt = `당신은 ${myUser?.name ?? "팀원"}님의 개인 업무 비서입니다.
오늘 날짜: ${now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}

현재 업무 현황:
- 진행 중: ${doing.map(t => t.title).join(", ") || "없음"}
- 오늘 마감: ${today.map(t => t.title).join(", ") || "없음"}
- 마감 초과: ${overdue.map(t => t.title).join(", ") || "없음"}
- Blocked: ${blocked.map(t => `${t.title}${t.blocked_reason ? `(${t.blocked_reason})` : ""}`).join(", ") || "없음"}
- D-3 이내 마감: ${soon.map(t => t.title).join(", ") || "없음"}

위 현황을 바탕으로 오늘 집중해야 할 것과 주의사항을 2-3문장으로 간결하게 브리핑해주세요. 친근하고 명확한 한국어로 작성하고, 구체적인 업무명을 언급해주세요.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setBriefing(data.content?.[0]?.text ?? "브리핑을 생성할 수 없습니다.");
      setGenerated(true);
    } catch {
      setBriefing("브리핑 생성 중 오류가 발생했습니다.");
      setGenerated(true);
    }
    setLoading(false);
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)" }}>오늘의 AI 브리핑</span>
        <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
          {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
        </span>
      </div>
      {!generated ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
            오늘의 업무 현황을 AI가 분석해드립니다
          </p>
          <button onClick={generate} disabled={loading}
            style={{
              background: loading ? "var(--bg-3)" : "var(--cyan)", color: loading ? "var(--text-3)" : "#fff",
              border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading ? "분석 중..." : "✦ 브리핑 시작"}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7 }}>{briefing}</p>
          <button onClick={() => { setBriefing(null); setGenerated(false); generate(); }}
            style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
            🔄 다시 생성
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
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

    const isAdmin = authUser.role === "admin";
    const isViewer = authUser.role === "viewer";

    // 내 업무
    if (!isViewer) {
      const { data: tasks } = await supabase.from("tasks")
        .select("*, project:projects(name)")
        .or(`assignee_id.eq.${authUser.userId},assignee_ids.cs.{${authUser.userId}}`)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);
      setMyTasks(tasks ?? []);
    }

    // 프로젝트
    let q = supabase.from("projects")
      .select("*, tasks(id, status)")
      .eq("status", "active").order("created_at");
    if (!isAdmin && !isViewer) {
      const { data: mp } = await supabase.from("project_members")
        .select("project_id").eq("user_id", authUser.userId);
      const ids = (mp ?? []).map((p: any) => p.project_id);
      if (ids.length > 0) q = q.in("id", ids);
      else { setProjects([]); setLoading(false); return; }
    }
    const { data: projData } = await q;
    setProjects(projData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <p style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</p>
    </div>
  );

  if (!myUser) return null;

  const isViewer = myUser.role === "viewer";
  const overdue = myTasks.filter(t => t.due_date && new Date(t.due_date) < now);
  const todayTasks = myTasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === now.toDateString());
  const blocked = myTasks.filter(t => t.status === "blocked");
  const greet = now.getHours() < 12 ? "좋은 아침이에요" : now.getHours() < 18 ? "안녕하세요" : "수고하셨습니다";

  return (
    <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 인사 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              + 업무 추가
            </button>
          </div>
        )}
      </div>

      {/* 긴급 알림 배너 */}
      {(overdue.length > 0 || blocked.length > 0) && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14 }}>🚨</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>
            {overdue.length > 0 && `마감 초과 ${overdue.length}건`}
            {overdue.length > 0 && blocked.length > 0 && " · "}
            {blocked.length > 0 && `Blocked ${blocked.length}건`}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[...overdue, ...blocked].slice(0, 3).map(t => (
              <button key={t.id} onClick={() => setOpenDetail(t.id)}
                style={{ padding: "3px 10px", background: "#fff", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer" }}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI 브리핑 */}
      {!isViewer && <AIBriefing tasks={myTasks} myUser={myUser} />}

      {/* 내 업무 + 프로젝트 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* 내 업무 */}
        {!isViewer && (
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 16, background: "var(--cyan)", borderRadius: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>내 업무</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{myTasks.length}건</span>
                <a href="/tasks" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>전체 →</a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {myTasks.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>진행 중인 업무가 없습니다</p>
              ) : myTasks.slice(0, 7).map(t => {
                const sc = STATUS_COLOR[t.status] ?? "#A8A8A4";
                const daysLeft = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000) : null;
                const isOver = daysLeft !== null && daysLeft < 0;
                const isToday = daysLeft === 0;
                return (
                  <button key={t.id} onClick={() => setOpenDetail(t.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                      background: t.status === "blocked" ? "#FEF2F2" : isOver ? "#FEF2F2" : "transparent",
                      border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (t.status !== "blocked" && !isOver) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-3)"; }}
                    onMouseLeave={e => { if (t.status !== "blocked" && !isOver) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                    <div style={{ width: 6, height: 6, background: sc, borderRadius: "50%", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    {t.status === "blocked" && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 600, flexShrink: 0 }}>Blocked</span>}
                    {daysLeft !== null && t.status !== "blocked" && (
                      <span style={{ fontSize: 10, color: isOver ? "#DC2626" : isToday ? "#D97706" : "var(--text-3)", fontWeight: isOver || isToday ? 600 : 400, flexShrink: 0 }}>
                        {isOver ? `${Math.abs(daysLeft)}일 초과` : isToday ? "오늘" : `D-${daysLeft}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 프로젝트 현황 */}
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, ...(isViewer ? { gridColumn: "1 / -1" } : {}) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 16, background: "#D97706", borderRadius: 2 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>프로젝트</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{projects.length}개</span>
              <a href="/projects" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>전체 →</a>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>진행 중인 프로젝트가 없습니다</p>
            ) : projects.slice(0, 6).map(p => {
              const tasks = p.tasks ?? [];
              const total = tasks.length;
              const done = tasks.filter((t: any) => t.status === "done").length;
              const blocked = tasks.filter((t: any) => t.status === "blocked").length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const hc = HEALTH_COLOR[p.health ?? "good"];
              return (
                <a key={p.id} href={`/projects/${p.id}`}
                  style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, background: hc, borderRadius: "50%" }} />
                      <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {blocked > 0 && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>Blocked {blocked}</span>}
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{done}/{total}</span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: hc, borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* 빠른 실행 */}
      {!isViewer && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>빠른 실행</span>
          <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setOpenForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-1)", cursor: "pointer" }}>
              + 업무 추가
            </button>
            <a href="/meeting-note"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-1)", textDecoration: "none" }}>
              📝 회의 기록
            </a>
            <a href="/ai"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "var(--cyan-bg)", border: "1px solid #BFDBFE", borderRadius: 7, fontSize: 12, color: "var(--cyan)", fontWeight: 600, textDecoration: "none" }}>
              ✦ AI에게 물어보기
            </a>
          </div>
        </div>
      )}

      {openForm && <TaskForm onClose={() => setOpenForm(false)} onSaved={() => { load(); setOpenForm(false); }} />}
      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={load} />}
    </div>
  );
}
