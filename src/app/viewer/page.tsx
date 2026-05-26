// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SLIDE_DURATION = 30; // 초

const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",     color: "#fbbf24" },
  critical:  { label: "위험",     color: "#f87171" },
  suspended: { label: "중단",     color: "#71717a" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  backlog: { label: "백로그",  color: "#4A7099" },
  todo:    { label: "할 일",   color: "#7BA7C8" },
  doing:   { label: "진행 중", color: "#2E86FF" },
  blocked: { label: "Blocked", color: "#f87171" },
  review:  { label: "리뷰",    color: "#fbbf24" },
  done:    { label: "완료",    color: "#34d399" },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  personal: { label: "개인",  color: "#a78bfa" },
  vacation: { label: "연차",  color: "#34d399" },
  holiday:  { label: "휴일",  color: "#f87171" },
  meeting:  { label: "미팅",  color: "#60a5fa" },
  deadline: { label: "마감",  color: "#fbbf24" },
};

const DAYS = ["일","월","화","수","목","금","토"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── 대시보드 슬라이드 ──
function DashboardSlide({ projects, tasks, users }: any) {
  const now = new Date();
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => t.status === "done").length;
  const doingTasks = tasks.filter((t: any) => t.status === "doing").length;
  const blockedTasks = tasks.filter((t: any) => t.status === "blocked").length;
  const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;

  return (
    <div className="h-full flex flex-col gap-6 p-10">
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 rounded-full" style={{ background: "var(--cyan)" }} />
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-1)" }}>팀 전체 현황</h1>
        <span className="text-lg ml-2" style={{ color: "var(--text-3)" }}>
          {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </span>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "전체 업무", value: totalTasks, color: "#7BA7C8" },
          { label: "진행 중",   value: doingTasks,  color: "#2E86FF" },
          { label: "완료",      value: doneTasks,   color: "#34d399" },
          { label: "Blocked",   value: blockedTasks, color: "#f87171" },
          { label: "마감 초과", value: overdueTasks, color: "#fbbf24" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 text-center"
            style={{ background: `${s.color}12`, border: `1px solid ${s.color}33` }}>
            <p className="text-4xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 프로젝트 현황 */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {projects.slice(0, 4).map((p: any) => {
          const total = p.tasks?.length ?? 0;
          const done = (p.tasks ?? []).filter((t: any) => t.status === "done").length;
          const rate = total > 0 ? Math.round((done / total) * 100) : 0;
          const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.good;
          const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / 86400000) : null;

          return (
            <div key={p.id} className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: "var(--bg-2)", border: `1px solid ${hc.color}33` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: hc.color }} />
                  <h3 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>{p.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${hc.color}18`, color: hc.color }}>{hc.label}</span>
                </div>
                {daysLeft !== null && (
                  <span className="text-sm font-bold" style={{ color: daysLeft < 0 ? "#f87171" : daysLeft <= 7 ? "#fbbf24" : "var(--text-3)" }}>
                    {daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : `D-${daysLeft}`}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>진행률</span>
                  <span className="text-sm font-bold" style={{ color: hc.color }}>{rate}%</span>
                </div>
                <div style={{ height: 8, background: "var(--bg-4)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${rate}%`, background: hc.color, borderRadius: 4 }} />
                </div>
              </div>
              <div className="flex gap-3">
                {["doing","blocked","done"].map(s => {
                  const cnt = (p.tasks ?? []).filter((t: any) => t.status === s).length;
                  const sc = STATUS_CONFIG[s];
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>{sc.label} {cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 팀원 업무량 */}
      {users.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(users.length, 6)}, 1fr)` }}>
          {users.slice(0, 6).map((u: any, i: number) => {
            const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c"];
            const color = COLORS[i % COLORS.length];
            const doingCount = tasks.filter((t: any) => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status === "doing").length;
            const totalCount = tasks.filter((t: any) => (t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)) && t.status !== "done").length;
            return (
              <div key={u.id} className="rounded-xl p-3 text-center"
                style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-1"
                  style={{ background: `${color}22`, color }}>
                  {u.name?.[0]}
                </div>
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-2)" }}>{u.name}</p>
                <p className="text-xs mt-0.5" style={{ color }}>진행 {doingCount} / 전체 {totalCount}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 프로젝트 상세 슬라이드 ──
function ProjectSlide({ project, tasks }: any) {
  const now = new Date();
  const hc = HEALTH_CONFIG[project.health] ?? HEALTH_CONFIG.good;
  const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === "done").length;
  const doing = tasks.filter((t: any) => t.status === "doing").length;
  const blocked = tasks.filter((t: any) => t.status === "blocked").length;
  const review = tasks.filter((t: any) => t.status === "review").length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / 86400000) : null;
  const activeTasks = tasks.filter((t: any) => t.status !== "done").slice(0, 8);

  return (
    <div className="h-full flex flex-col gap-5 p-10">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ background: hc.color }} />
            <span className="text-sm px-3 py-1 rounded-full font-semibold"
              style={{ background: `${hc.color}18`, color: hc.color }}>{hc.label}</span>
            {project.owner?.name && (
              <span className="text-sm" style={{ color: "var(--text-3)" }}>담당 · {project.owner.name}</span>
            )}
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-1)" }}>{project.name}</h1>
          {project.description && (
            <p className="text-base mt-1" style={{ color: "var(--text-2)" }}>{project.description}</p>
          )}
        </div>
        <div className="text-right">
          {daysLeft !== null && (
            <div className="rounded-2xl px-5 py-3" style={{ background: `${daysLeft < 0 ? "#f87171" : daysLeft <= 14 ? "#fbbf24" : "#34d399"}12`, border: `1px solid ${daysLeft < 0 ? "#f87171" : daysLeft <= 14 ? "#fbbf24" : "#34d399"}33` }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>마감까지</p>
              <p className="text-3xl font-bold tabular-nums" style={{ color: daysLeft < 0 ? "#f87171" : daysLeft <= 14 ? "#fbbf24" : "#34d399" }}>
                {daysLeft < 0 ? `+${Math.abs(daysLeft)}` : `D-${daysLeft}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 진행률 */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-base" style={{ color: "var(--text-3)" }}>전체 진행률</span>
          <span className="text-2xl font-bold" style={{ color: hc.color }}>{rate}%</span>
        </div>
        <div style={{ height: 12, background: "var(--bg-4)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${rate}%`, background: hc.color, borderRadius: 6, transition: "width 1s" }} />
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "전체", value: total, color: "#7BA7C8" },
          { label: "진행 중", value: doing, color: "#2E86FF" },
          { label: "리뷰", value: review, color: "#fbbf24" },
          { label: "Blocked", value: blocked, color: "#f87171" },
          { label: "완료", value: done, color: "#34d399" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}>
            <p className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 진행 중 업무 목록 */}
      <div className="flex-1">
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-3)" }}>진행 중 업무</p>
        <div className="grid grid-cols-2 gap-2">
          {activeTasks.map((t: any) => {
            const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.todo;
            const overdue = t.due_date && new Date(t.due_date) < now && t.status !== "done";
            return (
              <div key={t.id} className="rounded-xl px-4 py-2.5 flex items-center gap-3"
                style={{ background: "var(--bg-2)", border: `1px solid ${sc.color}22`, borderLeft: `3px solid ${sc.color}` }}>
                <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                  style={{ background: `${sc.color}18`, color: sc.color }}>{sc.label}</span>
                <span className="flex-1 text-sm truncate" style={{ color: "var(--text-1)" }}>{t.title}</span>
                {t.assignee?.name && (
                  <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>{t.assignee.name}</span>
                )}
                {t.due_date && (
                  <span className="text-xs shrink-0" style={{ color: overdue ? "#f87171" : "var(--text-3)" }}>
                    {overdue ? "⚠ " : ""}{new Date(t.due_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 캘린더 슬라이드 ──
function CalendarSlide({ events, tasks }: any) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function getEventsForDay(date: Date) {
    const result: any[] = [];
    events.forEach((ev: any) => {
      if (!ev.start_date) return;
      const start = new Date(ev.start_date);
      const end = ev.end_date ? new Date(ev.end_date) : start;
      if (date >= start && date <= end) result.push({ ...ev, _type: "event" });
    });
    tasks.forEach((t: any) => {
      if (!t.due_date) return;
      if (isSameDay(date, new Date(t.due_date))) {
        result.push({ ...t, _type: "task", type: "deadline" });
      }
    });
    return result;
  }

  return (
    <div className="h-full flex flex-col gap-5 p-10">
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 rounded-full" style={{ background: "#a78bfa" }} />
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-1)" }}>
          {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })} 일정
        </h1>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-7" style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          {DAYS.map((d, i) => (
            <div key={i} className="py-3 text-center text-base font-semibold"
              style={{ color: i===0?"#f87171":i===6?"#60a5fa":"var(--text-2)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 h-full">
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ background: "var(--bg-3)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} />;
            const dayEvs = getEventsForDay(d);
            const col = i % 7;
            const isToday = isSameDay(d, now);
            return (
              <div key={i} className="p-2"
                style={{ background: isToday ? "rgba(34,211,238,0.06)" : "var(--bg-2)", borderRight: col < 6 ? "1px solid var(--border)" : "none", borderBottom: "1px solid var(--border)" }}>
                <p className="text-sm w-7 h-7 rounded-full flex items-center justify-center mb-1 font-semibold"
                  style={{ background: isToday ? "var(--cyan)" : "transparent", color: isToday ? "#0D1B2E" : col===0 ? "#f87171" : col===6 ? "#60a5fa" : "var(--text-1)" }}>
                  {d.getDate()}
                </p>
                {dayEvs.slice(0, 3).map((ev, j) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.personal;
                  const color = ev.color || cfg.color;
                  return (
                    <div key={j} className="rounded px-1.5 py-0.5 text-xs truncate mb-0.5"
                      style={{ background: `${color}22`, color, fontSize: 11 }}>
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvs.length > 3 && <p style={{ fontSize: 10, color: "var(--text-3)" }}>+{dayEvs.length - 3}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 이번 달 주요 일정 */}
      <div className="flex gap-2 flex-wrap">
        {[...events, ...tasks.map((t: any) => ({ ...t, _type: "task", type: "deadline", title: `📌 ${t.title}`, start_date: t.due_date }))]
          .filter((ev: any) => {
            if (!ev.start_date) return false;
            const d = new Date(ev.start_date);
            return d.getFullYear() === year && d.getMonth() === month;
          })
          .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
          .slice(0, 6)
          .map((ev: any, i: number) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.personal;
            const color = ev.color || cfg.color;
            return (
              <div key={i} className="rounded-xl px-3 py-2 flex items-center gap-2"
                style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs" style={{ color }}>
                  {new Date(ev.start_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </span>
                <span className="text-sm" style={{ color: "var(--text-1)" }}>{ev.title}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── 메인 페이지 ──
export default function ViewerPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [slides, setSlides] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(SLIDE_DURATION);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<any>(null);
  const progressRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }, { data: u }, { data: ev }] = await Promise.all([
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id, title, status, due_date, assignee_id, assignee_ids, assignee:users!tasks_assignee_id_fkey(name))").eq("status", "active").order("created_at"),
      supabase.from("tasks").select("id, title, status, due_date, assignee_id, assignee_ids, project_id").neq("status", "done"),
      supabase.from("users").select("id, name").eq("is_active", true).neq("role", "viewer"),
      supabase.from("calendar_events").select("*").order("start_date"),
    ]);

    setProjects(p ?? []);
    setAllTasks(t ?? []);
    setUsers(u ?? []);
    setEvents(ev ?? []);

    // 슬라이드 구성: 대시보드 → 프로젝트별 → 캘린더
    const slideList = [
      { type: "dashboard" },
      ...(p ?? []).map(proj => ({ type: "project", id: proj.id })),
      { type: "calendar" },
    ];
    setSlides(slideList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 자동 슬라이드
  useEffect(() => {
    if (loading || slides.length === 0 || paused) return;
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) return 0;
        return p + (100 / (duration * 10));
      });
    }, 100);

    timerRef.current = setTimeout(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, duration * 1000);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [current, paused, loading, slides.length, duration]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-1)" }}>
      <div className="text-center">
        <div className="inline-block w-8 h-8 rounded-full border-2 animate-spin mb-3"
          style={{ borderColor: "var(--cyan)", borderTopColor: "transparent" }} />
        <p style={{ color: "var(--text-3)" }}>데이터 로딩 중…</p>
      </div>
    </div>
  );

  const slide = slides[current];

  return (
    <div ref={containerRef} className="flex flex-col h-screen"
      style={{ background: "var(--bg-1)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}>

      {/* 상단 컨트롤 바 */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: "var(--text-1)" }}>
            Task<span style={{ color: "var(--cyan)" }}>Flow</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>
            전체 현황
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 슬라이드 인디케이터 */}
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button key={i} onClick={() => { setCurrent(i); setProgress(0); }}
                className="rounded-full transition-all"
                style={{
                  width: i === current ? 20 : 6, height: 6,
                  background: i === current ? "var(--cyan)" : "var(--bg-4)",
                }} />
            ))}
          </div>

          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {current + 1} / {slides.length}
          </span>

          {/* 속도 조절 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-3)" }}>전환</span>
            {[15, 30, 60].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                className="rounded px-2 py-0.5 text-xs"
                style={{ background: duration === d ? "var(--cyan-bg)" : "var(--bg-3)", color: duration === d ? "var(--cyan)" : "var(--text-3)" }}>
                {d}s
              </button>
            ))}
          </div>

          {/* 이전/다음 */}
          <button onClick={() => { setCurrent(c => (c - 1 + slides.length) % slides.length); setProgress(0); }}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>‹</button>
          <button onClick={() => setPaused(v => !v)}
            className="rounded-lg px-3 py-1.5 text-xs"
            style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>
            {paused ? "▶ 재생" : "⏸ 일시정지"}
          </button>
          <button onClick={() => { setCurrent(c => (c + 1) % slides.length); setProgress(0); }}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>›</button>

          {/* 풀스크린 */}
          <button onClick={toggleFullscreen}
            className="rounded-lg px-3 py-1.5 text-xs"
            style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>
            {fullscreen ? "⊡ 나가기" : "⊞ 전체화면"}
          </button>
        </div>
      </div>

      {/* 슬라이드 컨텐츠 */}
      <div className="flex-1 overflow-hidden" style={{ background: "var(--bg-1)" }}>
        {slide?.type === "dashboard" && (
          <DashboardSlide projects={projects} tasks={allTasks} users={users} />
        )}
        {slide?.type === "project" && (() => {
          const proj = projects.find(p => p.id === slide.id);
          if (!proj) return null;
          return <ProjectSlide project={proj} tasks={proj.tasks ?? []} />;
        })()}
        {slide?.type === "calendar" && (
          <CalendarSlide events={events} tasks={allTasks.filter((t: any) => t.due_date)} />
        )}
      </div>

      {/* 하단 진행 바 */}
      <div style={{ height: 3, background: "var(--bg-4)" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: "var(--cyan)",
          transition: paused ? "none" : "width 0.1s linear",
        }} />
      </div>
    </div>
  );
}
