// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
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
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626", high: "#D97706", medium: "#2563EB", low: "#A8A8A4",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "긴급", high: "높음", medium: "보통", low: "낮음",
};

// 포커스 업무 우선순위 로직
function getFocusPriority(task: any, now: Date): { rank: number; badge: string; color: string; bg: string } {
  const daysLeft = task.due_date
    ? Math.ceil((new Date(task.due_date).getTime() - now.getTime()) / 86400000)
    : null;

  if (task.status === "blocked")
    return { rank: 1, badge: "🚨 Blocked", color: "#DC2626", bg: "#FEF2F2" };
  if (daysLeft !== null && daysLeft <= 3 && daysLeft >= 0)
    return { rank: 2, badge: `⏰ D-${daysLeft === 0 ? "day" : daysLeft}`, color: "#D97706", bg: "#FFFBEB" };
  if (daysLeft !== null && daysLeft < 0)
    return { rank: 2, badge: `🔴 ${Math.abs(daysLeft)}일 초과`, color: "#DC2626", bg: "#FEF2F2" };
  if (task.priority_order != null)
    return { rank: 3, badge: `⭐ 우선순위 ${task.priority_order}`, color: "#2563EB", bg: "#EEF3FF" };
  if (task._isNew)
    return { rank: 4, badge: "🆕 새 업무", color: "#16A34A", bg: "#F0FDF4" };
  if (task.status === "doing")
    return { rank: 5, badge: "▶ 진행 중", color: "#2563EB", bg: "var(--bg-3)" };
  return { rank: 9, badge: "", color: "var(--text-3)", bg: "var(--bg-3)" };
}

function buildFocusTasks(tasks: any[], now: Date): any[] {
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const withMeta = tasks.map(t => ({
    ...t,
    _isNew: t.created_at && new Date(t.created_at) > oneDayAgo,
    _focus: getFocusPriority(t, now),
  }));

  // rank 9(일반)은 제외, rank 순 정렬
  const focused = withMeta
    .filter(t => t._focus.rank < 9)
    .sort((a, b) => a._focus.rank - b._focus.rank);

  // 중복 제거 후 최대 5개
  const seen = new Set<string>();
  const result: any[] = [];
  for (const t of focused) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      result.push(t);
    }
    if (result.length >= 5) break;
  }
  return result;
}

// 포커스 카드 컴포넌트
function FocusCard({ task, myUser, onStatusChange, onOpen }: any) {
  const [changing, setChanging] = useState(false);
  const [localStatus, setLocalStatus] = useState(task.status);
  const supabase = createClient();

  const isAssignee = myUser &&
    (task.assignee_id === myUser.id ||
     (task.assignee_ids ?? []).includes(myUser.id));
  const isAdmin = myUser?.role === "admin";
  const canChange = isAssignee || isAdmin;

  async function handleChange(newStatus: string) {
    if (!canChange) return;
    setChanging(true);
    setLocalStatus(newStatus);
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setChanging(false);
    onStatusChange?.();
  }

  const sc = STATUS_COLOR[localStatus] ?? "#A8A8A4";
  const { badge, color, bg } = task._focus;

  return (
    <div style={{
      background: bg, border: `1.5px solid ${color}30`,
      borderRadius: 12, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* 뱃지 */}
      <span style={{
        fontSize: 10, padding: "3px 8px", borderRadius: 20,
        background: `${color}15`, color, fontWeight: 700,
        border: `1px solid ${color}30`, flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {badge}
      </span>

      {/* 업무 정보 */}
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpen(task.id)}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {task.project?.name && (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>
          )}
          {task.priority && (
            <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority] }}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.priority_note && (
            <span style={{ fontSize: 10, color: "#2563EB", background: "#EEF3FF", padding: "1px 6px", borderRadius: 4 }}>
              💬 {task.priority_note}
            </span>
          )}
        </div>
      </div>

      {/* 상태 변경 */}
      {canChange ? (
        <select
          value={localStatus}
          onChange={e => handleChange(e.target.value)}
          disabled={changing}
          style={{
            padding: "5px 8px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: `${sc}12`, color: sc, border: `1px solid ${sc}33`,
            cursor: "pointer", outline: "none", flexShrink: 0,
            colorScheme: "light", opacity: changing ? 0.5 : 1,
          }}>
          {Object.entries(STATUS_LABEL).filter(([v]) => v !== "done").map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      ) : (
        <span style={{
          padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
          background: `${sc}12`, color: sc, border: `1px solid ${sc}33`, flexShrink: 0,
        }}>
          {STATUS_LABEL[localStatus]}
        </span>
      )}
    </div>
  );
}

// 주간 요약
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

// AI 브리핑 (접힌 상태)
function AIBriefing({ tasks, myUser }: { tasks: any[]; myUser: any }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (briefing) return; // 이미 생성됐으면 스킵
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

export default function DashboardPage() {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [focusTasks, setFocusTasks] = useState<any[]>([]);
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

    // 내 업무 로드 (완료 제외)
    const { data: tasks } = await supabase.from("tasks")
      .select("*, project:projects(name)")
      .or(`assignee_id.eq.${authUser.userId},assignee_ids.cs.{${authUser.userId}}`)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false });

    const allTasks = tasks ?? [];
    setMyTasks(allTasks);
    setFocusTasks(buildFocusTasks(allTasks, now));
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

          {/* 오늘의 포커스 */}
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>오늘의 포커스</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>지금 당장 봐야 할 업무</span>
              </div>
              <a href="/tasks" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>전체 업무 →</a>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {focusTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: 22, margin: "0 0 8px" }}>✅</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>오늘 집중할 긴급 업무가 없습니다</p>
                  <p style={{ fontSize: 12, color: "var(--text-3)" }}>마감이 임박하거나 막힌 업무가 없어요</p>
                </div>
              ) : focusTasks.map(task => (
                <FocusCard
                  key={task.id}
                  task={task}
                  myUser={myUser}
                  onStatusChange={load}
                  onOpen={(id: string) => setOpenDetail(id)}
                />
              ))}
            </div>
          </div>

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
