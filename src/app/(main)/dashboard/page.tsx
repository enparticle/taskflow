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


const STATUS_LABEL_MAP: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};
const STATUS_COLOR_MAP: Record<string, string> = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};

function FocusTasks({ tasks, onRefresh }: { tasks: any[]; onRefresh: () => void }) {
  const supabase = createClient();
  const [changing, setChanging] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  async function changeStatus(taskId: string, newStatus: string) {
    setChanging(taskId);
    setLocalStatuses(prev => ({ ...prev, [taskId]: newStatus }));
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    setChanging(null);
    onRefresh();
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1.5px solid #BFDBFE", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "#EEF3FF", borderBottom: "1px solid #BFDBFE" }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#2563EB" }}>이번 주 집중 업무</span>
        <span style={{ fontSize: 11, color: "#2563EB", opacity: 0.7 }}>리더가 지정한 우선순위</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {tasks.map((task, idx) => {
          const currentStatus = localStatuses[task.id] ?? task.status;
          const sc = STATUS_COLOR_MAP[currentStatus] ?? "#A8A8A4";
          const isLast = idx === tasks.length - 1;
          const isBlocked = currentStatus === "blocked";
          return (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
              borderBottom: isLast ? "none" : "1px solid var(--border)",
              background: isBlocked ? "#FEF2F2" : "transparent",
            }}>
              {/* 순서 번호 */}
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#EEF3FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                {task.priority_order}
              </div>
              {/* 업무 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                  {task.priority_note && (
                    <span style={{ fontSize: 11, color: "#2563EB", background: "#EEF3FF", padding: "1px 6px", borderRadius: 4 }}>
                      💬 {task.priority_note}
                    </span>
                  )}
                </div>
              </div>
              {/* 상태 변경 드롭다운 */}
              <select
                value={currentStatus}
                onChange={e => changeStatus(task.id, e.target.value)}
                disabled={changing === task.id}
                style={{
                  padding: "4px 8px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                  background: `${sc}12`, color: sc, border: `1px solid ${sc}33`,
                  cursor: "pointer", outline: "none", flexShrink: 0,
                  colorScheme: "light",
                }}>
                {Object.entries(STATUS_LABEL_MAP).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AIBriefing({ tasks, myUser }: { tasks: any[]; myUser: any }) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (!autoTriggered && myUser) {
      setAutoTriggered(true);
      generate();
    }
  }, [myUser]);

  async function generate() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ width: 16, height: 16, border: "2px solid var(--cyan)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>업무 현황 분석 중...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
  const [priorityTasks, setPriorityTasks] = useState<any[]>([]);
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
    // 우선순위 지정 업무 로드
    if (!isViewer && authUser) {
      const { data: pt } = await supabase.from("tasks")
        .select("*, project:projects(name)")
        .or(`assignee_id.eq.${authUser.userId},assignee_ids.cs.{${authUser.userId}}`)
        .neq("status", "done")
        .not("priority_order", "is", null)
        .order("priority_order", { ascending: true });
      setPriorityTasks(pt ?? []);
    }

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

      {/* 🎯 집중 업무 카드 - 리더가 우선순위 지정한 경우만 표시 */}
      {!isViewer && priorityTasks.length > 0 && (
        <FocusTasks tasks={priorityTasks} onRefresh={load} />
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
