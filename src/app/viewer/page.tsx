// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SLIDE_DURATION = 30;

const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good:      { label: "?뺤긽",     color: "#34d399" },
  reviewing: { label: "寃???꾩슂", color: "#60a5fa" },
  at_risk:   { label: "二쇱쓽",     color: "#fbbf24" },
  critical:  { label: "?꾪뿕",     color: "#f87171" },
  suspended: { label: "以묐떒",     color: "#71717a" },
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  backlog: { label: "諛깅줈洹?,  color: "#8899aa" },
  todo:    { label: "????,   color: "#aabbcc" },
  doing:   { label: "吏꾪뻾 以?, color: "#60a5fa" },
  blocked: { label: "Blocked", color: "#f87171" },
  review:  { label: "由щ럭",    color: "#fbbf24" },
  done:    { label: "?꾨즺",    color: "#34d399" },
};
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  personal: { label: "媛쒖씤",  color: "#a78bfa" },
  vacation: { label: "?곗감",  color: "#34d399" },
  holiday:  { label: "?댁씪",  color: "#f87171" },
  meeting:  { label: "誘명똿",  color: "#60a5fa" },
  deadline: { label: "留덇컧",  color: "#fbbf24" },
};
const DAYS = ["??,"??,"??,"??,"紐?,"湲?,"??];
const BG  = "#1a2233";
const BG2 = "#202c3f";
const BG3 = "#263347";
const TEXT1 = "#e8f0fe";
const TEXT2 = "#a8bbd0";
const TEXT3 = "#6a8099";
const BORDER = "rgba(255,255,255,0.08)";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}

// ?? ??쒕낫???щ씪?대뱶 ??
function DashboardSlide({ projects, tasks, users }: any) {
  const now = new Date();
  const doingT   = tasks.filter((t:any)=>t.status==="doing").length;
  const doneT    = tasks.filter((t:any)=>t.status==="done").length;
  const blockedT = tasks.filter((t:any)=>t.status==="blocked").length;
  const overdueT = tasks.filter((t:any)=>t.due_date&&new Date(t.due_date)<now&&t.status!=="done").length;
  const TEAM_COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9"];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", padding:"40px 48px", gap:28, background:BG }}>
      {/* ?ㅻ뜑 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ fontSize:18, color:TEXT3, marginBottom:6 }}>
            {now.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}
          </p>
          <h1 style={{ fontSize:30, fontWeight:700, color:TEXT1, margin:0 }}>? ?꾩껜 ?꾪솴</h1>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          {[
            { label:"吏꾪뻾 以?, value:doingT,   color:"#60a5fa" },
            { label:"?꾨즺",    value:doneT,    color:"#34d399" },
            { label:"Blocked", value:blockedT, color:"#f87171" },
            { label:"留덇컧珥덇낵", value:overdueT, color:"#fbbf24" },
          ].map(s=>(
            <div key={s.label} style={{ background:BG2, border:`1px solid ${s.color}33`, borderRadius:16, padding:"14px 28px", textAlign:"center", minWidth:110 }}>
              <p style={{ fontSize:48, fontWeight:700, color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
              <p style={{ fontSize:17, color:TEXT3, margin:"6px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ?꾨줈?앺듃 移대뱶??*/}
      <div style={{ flex:1, display:"grid", gap:16, gridTemplateColumns:"repeat(3,1fr)", gridTemplateRows:"1fr 1fr", alignItems:"stretch" }}>
        {projects.slice(0,6).map((p:any)=>{
          const hc = HEALTH_CONFIG[p.health]??HEALTH_CONFIG.good;
          const total = p.tasks?.length??0;
          const done  = (p.tasks??[]).filter((t:any)=>t.status==="done").length;
          const doing = (p.tasks??[]).filter((t:any)=>t.status==="doing").length;
          const blkd  = (p.tasks??[]).filter((t:any)=>t.status==="blocked").length;
          return (
            <div key={p.id} style={{ background:BG2, border:`1.5px solid ${hc.color}44`, borderRadius:20, padding:"24px 28px", display:"flex", flexDirection:"column", gap:16, overflow:"hidden", minHeight:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:16, background:`${hc.color}20`, color:hc.color, borderRadius:20, padding:"4px 14px", fontWeight:600 }}>{hc.label}</span>
                  <h3 style={{ fontSize:32, fontWeight:700, color:TEXT1, margin:"8px 0 0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{p.name}</h3>
                </div>
                {p.end_date && (
                  <div style={{ textAlign:"right", marginLeft:12, flexShrink:0 }}>
                    <p style={{ fontSize:14, color:TEXT3, margin:0 }}>留덇컧</p>
                    <p style={{ fontSize:20, fontWeight:600, color:TEXT2, margin:0 }}>
                      {new Date(p.end_date).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})}
                    </p>
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                {[{l:"吏꾪뻾",v:doing,c:"#60a5fa"},{l:"?꾨즺",v:done,c:"#34d399"},{l:"?꾩껜",v:total,c:TEXT3},...(blkd>0?[{l:"Blocked",v:blkd,c:"#f87171"}]:[])].map((s,i)=>(
                  <span key={i} style={{ fontSize:20, color:s.c }}>{s.l} <b style={{ fontSize:30 }}>{s.v}</b></span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ???*/}
      {users.length>0 && (
        <div style={{ display:"flex", gap:12 }}>
          {users.slice(0,8).map((u:any,i:number)=>{
            const color = TEAM_COLORS[i%TEAM_COLORS.length];
            const doing = tasks.filter((t:any)=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))&&t.status==="doing").length;
            const total = tasks.filter((t:any)=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))&&t.status!=="done").length;
            return (
              <div key={u.id} style={{ flex:1, background:BG2, border:`1px solid ${color}33`, borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:`${color}22`, color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, flexShrink:0 }}>
                  {u.name?.[0]}
                </div>
                <div>
                  <p style={{ fontSize:18, fontWeight:600, color:TEXT1, margin:0 }}>{u.name}</p>
                  <p style={{ fontSize:15, color, margin:0 }}>吏꾪뻾 {doing} / ?꾩껜 {total}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ?? ?꾨줈?앺듃 ?щ씪?대뱶 ??
function ProjectSlide({ project, tasks }: any) {
  const now = new Date();
  const hc = HEALTH_CONFIG[project.health]??HEALTH_CONFIG.good;
  const total   = tasks.length;
  const done    = tasks.filter((t:any)=>t.status==="done").length;
  const doing   = tasks.filter((t:any)=>t.status==="doing").length;
  const blocked = tasks.filter((t:any)=>t.status==="blocked").length;
  const review  = tasks.filter((t:any)=>t.status==="review").length;
  const daysLeft = project.end_date ? Math.ceil((new Date(project.end_date).getTime()-now.getTime())/86400000) : null;
  const activeTasks = tasks.filter((t:any)=>t.status!=="done"&&t.status!=="backlog").slice(0,10);
  const dDayColor = daysLeft===null?"#34d399":daysLeft<0?"#f87171":daysLeft<=14?"#fbbf24":"#34d399";

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", padding:"40px 48px", gap:28, background:BG }}>
      {/* ?ㅻ뜑 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div style={{ width:14, height:14, borderRadius:"50%", background:hc.color, flexShrink:0 }} />
            <span style={{ fontSize:20, background:`${hc.color}20`, color:hc.color, borderRadius:20, padding:"4px 16px", fontWeight:600 }}>{hc.label}</span>
            {project.owner?.name && <span style={{ fontSize:20, color:TEXT3 }}>?대떦 쨌 {project.owner.name}</span>}
          </div>
          <h1 style={{ fontSize:38, fontWeight:700, color:TEXT1, margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{project.name}</h1>
          {project.description && <p style={{ fontSize:20, color:TEXT2, margin:"6px 0 0" }}>{project.description}</p>}
        </div>
        {daysLeft!==null && (
          <div style={{ background:BG2, border:`2px solid ${dDayColor}44`, borderRadius:16, padding:"16px 24px", textAlign:"center", flexShrink:0, marginLeft:20 }}>
            <p style={{ fontSize:16, color:TEXT3, margin:0 }}>留덇컧??/p>
            <p style={{ fontSize:22, fontWeight:600, color:TEXT2, margin:"4px 0 0" }}>
              {new Date(project.end_date).toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}
            </p>
            <p style={{ fontSize:38, fontWeight:700, color:dDayColor, margin:"4px 0 0" }}>
              {daysLeft<0?`+${Math.abs(daysLeft)}??:`D-${daysLeft}`}
            </p>
          </div>
        )}
      </div>

      {/* ?듦퀎 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:16 }}>
        {[{l:"?꾩껜",v:total,c:"#aabbcc"},{l:"吏꾪뻾 以?,v:doing,c:"#60a5fa"},{l:"由щ럭",v:review,c:"#fbbf24"},{l:"Blocked",v:blocked,c:"#f87171"},{l:"?꾨즺",v:done,c:"#34d399"}].map(s=>(
          <div key={s.l} style={{ background:BG2, border:`1px solid ${s.c}33`, borderRadius:18, padding:"20px 16px", textAlign:"center" }}>
            <p style={{ fontSize:72, fontWeight:700, color:s.c, margin:0, lineHeight:1 }}>{s.v}</p>
            <p style={{ fontSize:22, color:TEXT3, margin:"10px 0 0" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ?낅Т 紐⑸줉 */}
      <div style={{ flex:1, overflow:"hidden" }}>
        <p style={{ fontSize:22, color:TEXT3, marginBottom:12 }}>吏꾪뻾 以??낅Т</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {activeTasks.map((t:any)=>{
            const sc = STATUS_CONFIG[t.status]??STATUS_CONFIG.todo;
            const overdue = t.due_date&&new Date(t.due_date)<now&&t.status!=="done";
            return (
              <div key={t.id} style={{ background:BG2, borderLeft:`4px solid ${sc.color}`, borderRadius:"0 12px 12px 0", padding:"12px 18px", display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:17, background:`${sc.color}20`, color:sc.color, borderRadius:8, padding:"6px 14px", fontWeight:600, flexShrink:0 }}>{sc.label}</span>
                <span style={{ flex:1, fontSize:24, color:TEXT1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</span>
                {t.assignee?.name && <span style={{ fontSize:20, color:TEXT3, flexShrink:0 }}>{t.assignee.name}</span>}
                {t.due_date && (
                  <span style={{ fontSize:20, color:overdue?"#f87171":TEXT3, flexShrink:0, fontWeight:overdue?600:400 }}>
                    {overdue?"??":""}{new Date(t.due_date).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}
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

// ?? 罹섎┛???щ씪?대뱶 ??
function CalendarSlide({ events, tasks }: any) {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate()-now.getDay()-7);
  rangeStart.setHours(0,0,0,0);
  const cells: Date[] = Array.from({length:28},(_,i)=>{ const d=new Date(rangeStart); d.setDate(rangeStart.getDate()+i); return d; });
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate()-now.getDay()); thisWeekStart.setHours(0,0,0,0);

  function getEventsForDay(date: Date) {
    const result: any[] = [];
    events.forEach((ev:any)=>{
      if (!ev.start_date) return;
      const s=new Date(ev.start_date); s.setHours(0,0,0,0);
      const e=ev.end_date?new Date(ev.end_date):new Date(s); e.setHours(23,59,59,999);
      if (date>=s&&date<=e) result.push({...ev,_type:"event"});
    });
    tasks.forEach((t:any)=>{
      if (!t.due_date) return;
      if (isSameDay(date,new Date(t.due_date))) result.push({...t,_type:"task",type:"deadline"});
    });
    return result;
  }

  const WEEK_LABELS = ["吏??二?,"?대쾲 二?,"?ㅼ쓬 二?,"2二???];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", padding:"40px 48px", gap:24, background:BG }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1 style={{ fontSize:32, fontWeight:700, color:TEXT1, margin:0 }}>?쇱젙</h1>
        <div style={{ display:"flex", gap:20 }}>
          {Object.entries(EVENT_TYPE_CONFIG).map(([k,v])=>(
            <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:14, height:14, borderRadius:4, background:v.color }} />
              <span style={{ fontSize:18, color:TEXT3 }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex:1, borderRadius:20, overflow:"hidden", border:`1px solid ${BORDER}` }}>
        {/* ?붿씪 ?ㅻ뜑 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", background:BG3, borderBottom:`1px solid ${BORDER}` }}>
          {DAYS.map((d,i)=>(
            <div key={i} style={{ padding:"18px 0", textAlign:"center", fontSize:28, fontWeight:700, color:i===0?"#f87171":i===6?"#60a5fa":TEXT2 }}>{d}</div>
          ))}
        </div>

        {/* 4二?*/}
        <div style={{ display:"grid", gridTemplateRows:"repeat(4,1fr)", height:"calc(100% - 57px)" }}>
          {[0,1,2,3].map(wk=>{
            const weekDays = cells.slice(wk*7,wk*7+7);
            const isThisWeek = wk===1;
            return (
              <div key={wk} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", position:"relative", borderBottom:wk<3?`1px solid ${BORDER}`:"none" }}>
                <div style={{ position:"absolute", left:8, top:6, zIndex:2 }}>
                  <span style={{ fontSize:14, background:isThisWeek?"rgba(34,211,238,0.2)":BG3, color:isThisWeek?"var(--cyan)":TEXT3, borderRadius:12, padding:"3px 12px", fontWeight:600 }}>
                    {WEEK_LABELS[wk]}
                  </span>
                </div>
                {weekDays.map((d,i)=>{
                  const dayEvs = getEventsForDay(d);
                  const col = i%7;
                  const isToday = isSameDay(d,now);
                  const isPast = d<thisWeekStart;
                  return (
                    <div key={i} style={{ background:isToday?"rgba(34,211,238,0.07)":isPast?"rgba(0,0,0,0.15)":BG2, borderRight:col<6?`1px solid ${BORDER}`:"none", padding:"8px 10px", paddingTop:34, opacity:isPast?0.6:1 }}>
                      <div style={{ width:40, height:40, borderRadius:"50%", background:isToday?"#00C2CC":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:700, color:isToday?"#0D1B2E":col===0?"#f87171":col===6?"#60a5fa":TEXT1, marginBottom:4 }}>
                        {d.getDate()}
                      </div>
                      {dayEvs.slice(0,3).map((ev,j)=>{
                        const cfg = EVENT_TYPE_CONFIG[ev.type]??EVENT_TYPE_CONFIG.personal;
                        const color = ev.color||cfg.color;
                        return (
                          <div key={j} style={{ background:`${color}22`, color, fontSize:18, fontWeight:500, borderRadius:6, padding:"4px 10px", marginBottom:4, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", border:`1px solid ${color}44` }}>
                            {ev._type==="task"?"?뱦 ":""}{ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length>3 && <p style={{fontSize:16,color:TEXT3,margin:0}}>+{dayEvs.length-3}媛?/p>}
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

// ?? 硫붿씤 ??
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
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const timerRef = useRef<any>(null);
  const progressRef = useRef<any>(null);
  const refreshRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data:p },{ data:t },{ data:u },{ data:ev }] = await Promise.all([
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id,title,status,due_date,assignee_id,assignee_ids,assignee:users!tasks_assignee_id_fkey(name))").eq("status","active").order("created_at"),
      supabase.from("tasks").select("id,title,status,due_date,assignee_id,assignee_ids,project_id").neq("status","done").eq("show_on_calendar",true),
      supabase.from("users").select("id,name").eq("is_active",true).neq("role","viewer"),
      supabase.from("calendar_events").select("*").order("start_date"),
    ]);
    setProjects(p??[]); setAllTasks(t??[]); setUsers(u??[]); setEvents(ev??[]);
    setSlides([{type:"dashboard"},...(p??[]).map((proj:any)=>({type:"project",id:proj.id})),{type:"calendar"}]);
    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    refreshRef.current = setInterval(()=>{ load(); }, refreshInterval*1000);
    return ()=>clearInterval(refreshRef.current);
  },[refreshInterval,load]);
  useEffect(()=>{
    if (loading||slides.length===0||paused) return;
    setProgress(0);
    progressRef.current = setInterval(()=>setProgress(p=>p>=100?0:p+(100/(duration*10))),100);
    timerRef.current = setTimeout(()=>setCurrent(c=>(c+1)%slides.length),duration*1000);
    return ()=>{ clearTimeout(timerRef.current); clearInterval(progressRef.current); };
  },[current,paused,loading,slides.length,duration]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setFullscreen(true); }
    else { document.exitFullscreen(); setFullscreen(false); }
  }
  useEffect(()=>{
    const h=()=>setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",h);
    return ()=>document.removeEventListener("fullscreenchange",h);
  },[]);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:BG }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", border:"4px solid #00C2CC", borderTopColor:"transparent", animation:"spin 1s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ fontSize:24, color:TEXT3 }}>?곗씠??濡쒕뵫 以묅?/p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const slide = slides[current];
  const now = new Date();

  return (
    <div ref={containerRef} style={{ display:"flex", flexDirection:"column", height:"100vh", background:BG }}
      onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>

      {/* 而⑦듃濡?諛?*/}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 24px", background:BG3, borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:22, fontWeight:700, letterSpacing:3, color:TEXT1 }}>
            Task<span style={{ color:"#00C2CC" }}>Flow</span>
          </span>
          <span style={{ fontSize:16, background:"rgba(0,194,204,0.15)", color:"#00C2CC", borderRadius:20, padding:"4px 14px" }}>?꾩껜 ?꾪솴</span>
          <span style={{ fontSize:15, color:TEXT3 }}>
            {lastRefreshed.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})} 媛깆떊
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* ?몃뵒耳?댄꽣 */}
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {slides.map((_,i)=>(
              <button key={i} onClick={()=>{ setCurrent(i); setProgress(0); }}
                style={{ width:i===current?20:7, height:7, borderRadius:4, background:i===current?"#00C2CC":"rgba(255,255,255,0.2)", border:"none", cursor:"pointer", transition:"all 0.3s" }} />
            ))}
          </div>
          <span style={{ fontSize:17, color:TEXT3 }}>{current+1}/{slides.length}</span>

          {/* ?꾪솚 ?띾룄 */}
          {[15,30,60].map(d=>(
            <button key={d} onClick={()=>setDuration(d)}
              style={{ background:duration===d?"rgba(0,194,204,0.2)":"rgba(255,255,255,0.05)", color:duration===d?"#00C2CC":TEXT3, border:`1px solid ${duration===d?"#00C2CC33":BORDER}`, borderRadius:10, padding:"6px 14px", fontSize:16, cursor:"pointer" }}>
              {d}s
            </button>
          ))}

          {/* ?댁쟾/?뺤?/?ㅼ쓬 */}
          <button onClick={()=>{ setCurrent(c=>(c-1+slides.length)%slides.length); setProgress(0); }}
            style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"6px 16px", fontSize:22, color:TEXT2, cursor:"pointer" }}>??/button>
          <button onClick={()=>setPaused(v=>!v)}
            style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"6px 16px", fontSize:17, color:TEXT2, cursor:"pointer" }}>
            {paused?"??:"??}
          </button>
          <button onClick={()=>{ setCurrent(c=>(c+1)%slides.length); setProgress(0); }}
            style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"6px 16px", fontSize:22, color:TEXT2, cursor:"pointer" }}>??/button>

          {/* ?덈줈怨좎묠 */}
          {[60,300].map(s=>(
            <button key={s} onClick={()=>setRefreshInterval(s)}
              style={{ background:refreshInterval===s?"rgba(0,194,204,0.2)":"rgba(255,255,255,0.05)", color:refreshInterval===s?"#00C2CC":TEXT3, border:`1px solid ${refreshInterval===s?"#00C2CC33":BORDER}`, borderRadius:10, padding:"6px 12px", fontSize:15, cursor:"pointer" }}>
              {s<60?`${s}s`:`${s/60}遺?}
            </button>
          ))}
          <button onClick={load}
            style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"6px 14px", fontSize:18, color:TEXT2, cursor:"pointer" }}>?봽</button>

          {/* ?꾩껜?붾㈃ */}
          <button onClick={toggleFullscreen}
            style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"6px 14px", fontSize:16, color:TEXT2, cursor:"pointer" }}>
            {fullscreen?"???섍?湲?:"???꾩껜?붾㈃"}
          </button>
        </div>
      </div>

      {/* ?щ씪?대뱶 */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {slide?.type==="dashboard" && <DashboardSlide projects={projects} tasks={allTasks} users={users} />}
        {slide?.type==="project" && (()=>{ const proj=projects.find(p=>p.id===slide.id); return proj?<ProjectSlide project={proj} tasks={proj.tasks??[]} />:null; })()}
        {slide?.type==="calendar" && <CalendarSlide events={events} tasks={allTasks.filter((t:any)=>t.due_date)} />}
      </div>

      {/* 吏꾪뻾 諛?*/}
      <div style={{ height:4, background:"rgba(255,255,255,0.08)" }}>
        <div style={{ height:"100%", width:`${progress}%`, background:"#00C2CC", transition:paused?"none":"width 0.1s linear" }} />
      </div>
    </div>
  );
}


