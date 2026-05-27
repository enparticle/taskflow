// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SLIDE_DURATION = 30;

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
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// ── 대시보드 슬라이드 ──
function DashboardSlide({ projects, tasks, users }: any) {
  const now = new Date();
  const doingT = tasks.filter((t:any) => t.status==="doing").length;
  const doneT  = tasks.filter((t:any) => t.status==="done").length;
  const blockedT = tasks.filter((t:any) => t.status==="blocked").length;
  const overdueT = tasks.filter((t:any) => t.due_date && new Date(t.due_date)<now && t.status!=="done").length;

  return (
    <div className="h-full flex flex-col p-12 gap-8">
      {/* 헤더 */}
      <div>
        <p className="text-2xl" style={{ color: "var(--text-3)" }}>
          {now.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" })}
        </p>
        <h1 className="text-6xl font-bold mt-2" style={{ color: "var(--text-1)" }}>팀 전체 현황</h1>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "진행 중",   value: doingT,   color: "#2E86FF" },
          { label: "완료",      value: doneT,    color: "#34d399" },
          { label: "Blocked",   value: blockedT, color: "#f87171" },
          { label: "마감 초과", value: overdueT, color: "#fbbf24" },
        ].map(s => (
          <div key={s.label} className="rounded-3xl p-8 text-center"
            style={{ background: `${s.color}15`, border: `2px solid ${s.color}44` }}>
            <p className="text-8xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-2xl mt-3" style={{ color: "var(--text-3)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 프로젝트 현황 */}
      <div className="flex-1 grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.min(projects.length, 3)}, 1fr)` }}>
        {projects.slice(0, 6).map((p: any) => {
          const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.good;
          const total = p.tasks?.length ?? 0;
          const done = (p.tasks??[]).filter((t:any)=>t.status==="done").length;
          const doing = (p.tasks??[]).filter((t:any)=>t.status==="doing").length;
          const blocked = (p.tasks??[]).filter((t:any)=>t.status==="blocked").length;
          const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime()-now.getTime())/86400000) : null;
          return (
            <div key={p.id} className="rounded-3xl p-7 flex flex-col gap-4"
              style={{ background: "var(--bg-2)", border: `2px solid ${hc.color}44` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: hc.color }} />
                    <span className="text-xl px-3 py-1 rounded-full font-bold"
                      style={{ background: `${hc.color}18`, color: hc.color }}>{hc.label}</span>
                  </div>
                  <h3 className="text-3xl font-bold truncate" style={{ color: "var(--text-1)" }}>{p.name}</h3>
                </div>
                {daysLeft !== null && (
                  <div className="text-right shrink-0">
                    <p className="text-lg" style={{ color: "var(--text-3)" }}>마감</p>
                    <p className="text-2xl font-bold" style={{ color: daysLeft<0?"#f87171":daysLeft<=7?"#fbbf24":"var(--text-2)" }}>
                      {p.end_date ? new Date(p.end_date).toLocaleDateString("ko-KR",{month:"short",day:"numeric"}) : ""}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-5 flex-wrap">
                {[
                  { label:"진행", value:doing, color:"#2E86FF" },
                  { label:"완료", value:done, color:"#34d399" },
                  { label:"전체", value:total, color:"var(--text-3)" },
                  ...(blocked>0?[{label:"Blocked",value:blocked,color:"#f87171"}]:[]),
                ].map((s,i) => (
                  <span key={i} className="text-xl" style={{ color: s.color }}>
                    {s.label} <span className="font-bold text-2xl">{s.value}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 팀원 */}
      {users.length > 0 && (
        <div className="flex gap-4">
          {users.slice(0,8).map((u:any, i:number) => {
            const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9"];
            const color = COLORS[i%COLORS.length];
            const doing = tasks.filter((t:any)=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))&&t.status==="doing").length;
            const total = tasks.filter((t:any)=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))&&t.status!=="done").length;
            return (
              <div key={u.id} className="rounded-2xl px-5 py-4 flex items-center gap-3 flex-1"
                style={{ background: `${color}12`, border: `1.5px solid ${color}33` }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                  style={{ background: `${color}22`, color }}>
                  {u.name?.[0]}
                </div>
                <div>
                  <p className="text-lg font-semibold" style={{ color: "var(--text-1)" }}>{u.name}</p>
                  <p className="text-base" style={{ color }}>진행 {doing} / 전체 {total}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 프로젝트 슬라이드 ──
function ProjectSlide({ project, tasks }: any) {
  const now = new Date();
  const hc = HEALTH_CONFIG[project.health] ?? HEALTH_CONFIG.good;
  const total = tasks.length;
  const done  = tasks.filter((t:any)=>t.status==="done").length;
  const doing = tasks.filter((t:any)=>t.status==="doing").length;
  const blocked = tasks.filter((t:any)=>t.status==="blocked").length;
  const review = tasks.filter((t:any)=>t.status==="review").length;
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime()-now.getTime())/86400000) : null;
  const activeTasks = tasks.filter((t:any)=>t.status!=="done" && t.status!=="backlog").slice(0,10);

  return (
    <div className="h-full flex flex-col p-12 gap-7">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-4 h-4 rounded-full" style={{ background: hc.color }} />
            <span className="text-2xl px-4 py-1.5 rounded-full font-bold"
              style={{ background: `${hc.color}18`, color: hc.color }}>{hc.label}</span>
            {project.owner?.name && (
              <span className="text-2xl" style={{ color: "var(--text-3)" }}>담당 · {project.owner.name}</span>
            )}
          </div>
          <h1 className="text-6xl font-bold" style={{ color: "var(--text-1)" }}>{project.name}</h1>
          {project.description && (
            <p className="text-2xl mt-2" style={{ color: "var(--text-2)" }}>{project.description}</p>
          )}
        </div>
        {daysLeft !== null && (
          <div className="rounded-3xl px-8 py-6 text-center shrink-0"
            style={{ background: `${daysLeft<0?"#f87171":daysLeft<=14?"#fbbf24":"#34d399"}12`, border: `2px solid ${daysLeft<0?"#f87171":daysLeft<=14?"#fbbf24":"#34d399"}44` }}>
            <p className="text-xl" style={{ color: "var(--text-3)" }}>마감일</p>
            <p className="text-4xl font-bold mt-1" style={{ color: daysLeft<0?"#f87171":daysLeft<=14?"#fbbf24":"#34d399" }}>
              {new Date(project.end_date).toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: daysLeft<0?"#f87171":daysLeft<=14?"#fbbf24":"#34d399" }}>
              {daysLeft<0?`${Math.abs(daysLeft)}일 초과`:`D-${daysLeft}`}
            </p>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-5">
        {[
          { label:"전체",    value:total,   color:"#7BA7C8" },
          { label:"진행 중", value:doing,   color:"#2E86FF" },
          { label:"리뷰",    value:review,  color:"#fbbf24" },
          { label:"Blocked", value:blocked, color:"#f87171" },
          { label:"완료",    value:done,    color:"#34d399" },
        ].map(s => (
          <div key={s.label} className="rounded-3xl p-7 text-center"
            style={{ background: `${s.color}12`, border: `2px solid ${s.color}33` }}>
            <p className="text-7xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-2xl mt-2" style={{ color: "var(--text-3)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 진행 중 업무 */}
      <div className="flex-1">
        <p className="text-2xl font-semibold mb-4" style={{ color: "var(--text-3)" }}>진행 중 업무</p>
        <div className="grid grid-cols-2 gap-3">
          {activeTasks.map((t:any) => {
            const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.todo;
            const overdue = t.due_date && new Date(t.due_date)<now && t.status!=="done";
            return (
              <div key={t.id} className="rounded-2xl px-6 py-4 flex items-center gap-4"
                style={{ background:"var(--bg-2)", borderLeft:`4px solid ${sc.color}`, border:`1px solid ${sc.color}22` }}>
                <span className="text-base px-3 py-1.5 rounded-lg font-bold shrink-0"
                  style={{ background:`${sc.color}18`, color:sc.color }}>{sc.label}</span>
                <span className="flex-1 text-xl truncate" style={{ color:"var(--text-1)" }}>{t.title}</span>
                {t.assignee?.name && (
                  <span className="text-lg shrink-0" style={{ color:"var(--text-3)" }}>{t.assignee.name}</span>
                )}
                {t.due_date && (
                  <span className="text-lg shrink-0 font-medium" style={{ color:overdue?"#f87171":"var(--text-3)" }}>
                    {overdue?"⚠ ":""}{new Date(t.due_date).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}
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
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate() - now.getDay() - 7);
  rangeStart.setHours(0,0,0,0);
  const cells: Date[] = Array.from({length:28},(_,i)=>{ const d=new Date(rangeStart); d.setDate(rangeStart.getDate()+i); return d; });

  function getEventsForDay(date: Date) {
    const result: any[] = [];
    events.forEach((ev:any)=>{
      if (!ev.start_date) return;
      const s = new Date(ev.start_date); s.setHours(0,0,0,0);
      const e = ev.end_date ? new Date(ev.end_date) : new Date(s); e.setHours(23,59,59,999);
      if (date>=s && date<=e) result.push({...ev,_type:"event"});
    });
    tasks.forEach((t:any)=>{
      if (!t.due_date) return;
      if (isSameDay(date,new Date(t.due_date))) result.push({...t,_type:"task",type:"deadline"});
    });
    return result;
  }

  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate()-now.getDay()); thisWeekStart.setHours(0,0,0,0);
  function getWeekLabel(i:number) { return ["지난 주","이번 주","다음 주","2주 후"][i]; }

  return (
    <div className="h-full flex flex-col p-12 gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-6xl font-bold" style={{ color:"var(--text-1)" }}>일정</h1>
        <div className="flex gap-5">
          {Object.entries(EVENT_TYPE_CONFIG).map(([k,v])=>(
            <div key={k} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{background:v.color}} />
              <span className="text-xl" style={{color:"var(--text-3)"}}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-3xl overflow-hidden" style={{ border:"1px solid var(--border)" }}>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7" style={{ background:"var(--bg-3)", borderBottom:"1px solid var(--border)" }}>
          {DAYS.map((d,i)=>(
            <div key={i} className="py-5 text-center text-3xl font-bold"
              style={{color:i===0?"#f87171":i===6?"#60a5fa":"var(--text-2)"}}>{d}</div>
          ))}
        </div>

        {/* 4주 */}
        <div style={{ display:"grid", gridTemplateRows:"repeat(4,1fr)", height:"calc(100% - 72px)" }}>
          {[0,1,2,3].map(wk=>{
            const weekDays = cells.slice(wk*7, wk*7+7);
            const isThisWeek = wk===1;
            return (
              <div key={wk} className="grid grid-cols-7 relative"
                style={{ borderBottom:wk<3?"1px solid var(--border)":"none" }}>
                <div className="absolute left-2 top-2 z-10">
                  <span className="text-base px-3 py-1 rounded-full font-bold"
                    style={{ background:isThisWeek?"var(--cyan-bg)":"var(--bg-3)", color:isThisWeek?"var(--cyan)":"var(--text-3)" }}>
                    {getWeekLabel(wk)}
                  </span>
                </div>
                {weekDays.map((d,i)=>{
                  const dayEvs = getEventsForDay(d);
                  const col = i%7;
                  const isToday = isSameDay(d,now);
                  const isPast = d < thisWeekStart;
                  return (
                    <div key={i} className="p-2 pt-10"
                      style={{ background:isToday?"rgba(34,211,238,0.06)":isPast?"rgba(0,0,0,0.12)":"var(--bg-2)", borderRight:col<6?"1px solid var(--border)":"none", opacity:isPast?0.65:1 }}>
                      <p className="text-2xl font-bold w-10 h-10 rounded-full flex items-center justify-center mb-1"
                        style={{ background:isToday?"var(--cyan)":"transparent", color:isToday?"#0D1B2E":col===0?"#f87171":col===6?"#60a5fa":"var(--text-1)" }}>
                        {d.getDate()}
                      </p>
                      {dayEvs.slice(0,3).map((ev,j)=>{
                        const cfg = EVENT_TYPE_CONFIG[ev.type]??EVENT_TYPE_CONFIG.personal;
                        const color = ev.color||cfg.color;
                        return (
                          <div key={j} className="rounded-lg px-2 py-1 truncate mb-1"
                            style={{ background:`${color}22`, color, fontSize:18, fontWeight:500, border:`1px solid ${color}33` }}>
                            {ev._type==="task"?"📌 ":""}{ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length>3 && <p style={{fontSize:16,color:"var(--text-3)"}}>+{dayEvs.length-3}개</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 메인 ──
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const timerRef = useRef<any>(null);
  const progressRef = useRef<any>(null);
  const refreshRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }, { data: u }, { data: ev }] = await Promise.all([
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id,title,status,due_date,assignee_id,assignee_ids,assignee:users!tasks_assignee_id_fkey(name))").eq("status","active").order("created_at"),
      supabase.from("tasks").select("id,title,status,due_date,assignee_id,assignee_ids,project_id").neq("status","done"),
      supabase.from("users").select("id,name").eq("is_active",true).neq("role","viewer"),
      supabase.from("calendar_events").select("*").order("start_date"),
    ]);
    setProjects(p??[]);
    setAllTasks(t??[]);
    setUsers(u??[]);
    setEvents(ev??[]);
    const slideList = [
      { type:"dashboard" },
      ...(p??[]).map((proj:any)=>({ type:"project", id:proj.id })),
      { type:"calendar" },
    ];
    setSlides(slideList);
    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) { clearInterval(refreshRef.current); return; }
    refreshRef.current = setInterval(() => { load(); }, refreshInterval*1000);
    return () => clearInterval(refreshRef.current);
  }, [autoRefresh, refreshInterval, load]);

  useEffect(() => {
    if (loading || slides.length===0 || paused) return;
    setProgress(0);
    progressRef.current = setInterval(()=>{ setProgress(p=>p>=100?0:p+(100/(duration*10))); }, 100);
    timerRef.current = setTimeout(()=>{ setCurrent(c=>(c+1)%slides.length); }, duration*1000);
    return () => { clearTimeout(timerRef.current); clearInterval(progressRef.current); };
  }, [current, paused, loading, slides.length, duration]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setFullscreen(true); }
    else { document.exitFullscreen(); setFullscreen(false); }
  }
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background:"var(--bg-1)" }}>
      <div className="text-center">
        <div className="inline-block w-12 h-12 rounded-full border-4 animate-spin mb-4"
          style={{ borderColor:"var(--cyan)", borderTopColor:"transparent" }} />
        <p className="text-2xl" style={{ color:"var(--text-3)" }}>데이터 로딩 중…</p>
      </div>
    </div>
  );

  const slide = slides[current];

  return (
    <div ref={containerRef} className="flex flex-col h-screen" style={{ background:"var(--bg-1)" }}
      onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>

      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between px-8 py-4 shrink-0"
        style={{ background:"var(--bg-2)", borderBottom:"1px solid var(--border)" }}>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-widest uppercase" style={{ color:"var(--text-1)" }}>
            Task<span style={{ color:"var(--cyan)" }}>Flow</span>
          </span>
          <span className="text-lg px-3 py-1 rounded-full" style={{ background:"var(--cyan-bg)", color:"var(--cyan)" }}>
            전체 현황
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 슬라이드 인디케이터 */}
          <div className="flex gap-2">
            {slides.map((_,i)=>(
              <button key={i} onClick={()=>{ setCurrent(i); setProgress(0); }}
                className="rounded-full transition-all"
                style={{ width:i===current?24:8, height:8, background:i===current?"var(--cyan)":"var(--bg-4)" }} />
            ))}
          </div>
          <span className="text-lg" style={{ color:"var(--text-3)" }}>{current+1} / {slides.length}</span>

          {/* 속도 */}
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color:"var(--text-3)" }}>전환</span>
            {[15,30,60].map(d=>(
              <button key={d} onClick={()=>setDuration(d)}
                className="rounded-lg px-3 py-1.5 text-lg"
                style={{ background:duration===d?"var(--cyan-bg)":"var(--bg-3)", color:duration===d?"var(--cyan)":"var(--text-3)" }}>
                {d}s
              </button>
            ))}
          </div>

          {/* 이전/다음/정지 */}
          <button onClick={()=>{ setCurrent(c=>(c-1+slides.length)%slides.length); setProgress(0); }}
            className="rounded-xl px-4 py-2 text-2xl" style={{ background:"var(--bg-3)", color:"var(--text-2)" }}>‹</button>
          <button onClick={()=>setPaused(v=>!v)}
            className="rounded-xl px-4 py-2 text-lg" style={{ background:"var(--bg-3)", color:"var(--text-2)" }}>
            {paused?"▶ 재생":"⏸ 정지"}
          </button>
          <button onClick={()=>{ setCurrent(c=>(c+1)%slides.length); setProgress(0); }}
            className="rounded-xl px-4 py-2 text-2xl" style={{ background:"var(--bg-3)", color:"var(--text-2)" }}>›</button>

          {/* 새로고침 */}
          <div className="flex items-center gap-2 pl-3" style={{ borderLeft:"1px solid var(--border)" }}>
            {[60,300,600].map(s=>(
              <button key={s} onClick={()=>setRefreshInterval(s)}
                className="rounded-lg px-3 py-1.5 text-lg"
                style={{ background:refreshInterval===s?"var(--cyan-bg)":"var(--bg-3)", color:refreshInterval===s?"var(--cyan)":"var(--text-3)" }}>
                {s<60?`${s}s`:`${s/60}분`}
              </button>
            ))}
            <button onClick={()=>{ load(); }}
              className="rounded-xl px-4 py-2 text-xl" style={{ background:"var(--bg-3)", color:"var(--text-2)" }}>🔄</button>
          </div>

          {/* 전체화면 */}
          <button onClick={toggleFullscreen}
            className="rounded-xl px-4 py-2 text-lg" style={{ background:"var(--bg-3)", color:"var(--text-2)" }}>
            {fullscreen?"⊡ 나가기":"⊞ 전체화면"}
          </button>
        </div>
      </div>

      {/* 슬라이드 */}
      <div className="flex-1 overflow-hidden" style={{ background:"var(--bg-1)" }}>
        {slide?.type==="dashboard" && <DashboardSlide projects={projects} tasks={allTasks} users={users} />}
        {slide?.type==="project" && (() => {
          const proj = projects.find(p=>p.id===slide.id);
          return proj ? <ProjectSlide project={proj} tasks={proj.tasks??[]} /> : null;
        })()}
        {slide?.type==="calendar" && <CalendarSlide events={events} tasks={allTasks.filter((t:any)=>t.due_date)} />}
      </div>

      {/* 하단 진행 바 */}
      <div style={{ height:5, background:"var(--bg-4)" }}>
        <div style={{ height:"100%", width:`${progress}%`, background:"var(--cyan)", transition:paused?"none":"width 0.1s linear" }} />
      </div>
    </div>
  );
}
