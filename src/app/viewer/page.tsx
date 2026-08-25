// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const SLIDE_DURATION = 30;

// 앱과 동일한 시맨틱 컬러 (다크 배경에 최적화)
const HEALTH_CONFIG = {
  good:      { label: "정상",  color: "#16A34A" },
  reviewing: { label: "검토",  color: "#2563EB" },
  at_risk:   { label: "주의",  color: "#D97706" },
  critical:  { label: "위험",  color: "#DC2626" },
  suspended: { label: "중단",  color: "#71717a" },
};
const STATUS_CONFIG = {
  backlog: { label: "백로그",  color: "#6B7280" },
  todo:    { label: "할 일",   color: "#9CA3AF" },
  doing:   { label: "진행 중", color: "#2563EB" },
  blocked: { label: "Blocked", color: "#DC2626" },
  review:  { label: "리뷰",    color: "#D97706" },
  done:    { label: "완료",    color: "#16A34A" },
};
const EVENT_TYPE_CONFIG = {
  personal: { label: "개인",  color: "#7C3AED" },
  birthday: { label: "생일",  color: "#EC4899" },
  vacation: { label: "연차",  color: "#16A34A" },
  holiday:  { label: "휴일",  color: "#DC2626" },
  meeting:  { label: "미팅",  color: "#2563EB" },
  deadline: { label: "마감",  color: "#D97706" },
};
const DAYS = ["일","월","화","수","목","금","토"];

// 뷰어 전용 다크 팔레트
const V = {
  bg:      "#0F1623",
  bg2:     "#162032",
  bg3:     "#1C2A40",
  border:  "rgba(255,255,255,0.07)",
  text1:   "#F0F4FF",
  text2:   "#A8B8D0",
  text3:   "#5A7090",
  accent:  "#2563EB",
};

function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}

// ────────────────────────────────────────────────────────────
// 슬라이드 1: 팀 전체 대시보드
// ────────────────────────────────────────────────────────────
function DashboardSlide({ projects, tasks, users, vacationers, recentActivity }) {
  const now = new Date();
  const doing   = tasks.filter(t=>t.status==="doing").length;
  const done    = tasks.filter(t=>t.status==="done").length;
  const blocked = tasks.filter(t=>t.status==="blocked").length;
  const overdue = tasks.filter(t=>t.due_date&&new Date(t.due_date)<now&&t.status!=="done").length;
  const COLORS  = ["#2563EB","#16A34A","#D97706","#DC2626","#7C3AED","#0891B2","#D946EF","#EA580C"];

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",padding:"36px 48px",gap:24,background:V.bg}}>

      {/* 날짜 + 제목 */}
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div>
          <p style={{fontSize:15,color:V.text3,marginBottom:4}}>
            {now.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}
          </p>
          <h1 style={{fontSize:28,fontWeight:700,color:V.text1,margin:0,letterSpacing:-0.5}}>팀 전체 현황</h1>
        </div>
        {/* 요약 수치 */}
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"진행 중", value:doing,   color:"#2563EB"},
            {label:"완료",    value:done,    color:"#16A34A"},
            {label:"Blocked", value:blocked, color:"#DC2626"},
            {label:"마감초과", value:overdue, color:"#D97706"},
          ].map(s=>(
            <div key={s.label} style={{background:V.bg2,border:`1px solid ${s.color}30`,borderRadius:12,padding:"12px 22px",textAlign:"center",minWidth:100}}>
              <p style={{fontSize:40,fontWeight:700,color:s.color,margin:0,lineHeight:1}}>{s.value}</p>
              <p style={{fontSize:14,color:V.text3,margin:"5px 0 0"}}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 오늘 휴가/부재중 배너 */}
      {vacationers && vacationers.length > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.25)",borderRadius:10,padding:"8px 18px"}}>
          <span style={{fontSize:16}}>🌴</span>
          <span style={{fontSize:14,color:"#16A34A",fontWeight:600}}>오늘 휴가:</span>
          <span style={{fontSize:14,color:V.text2}}>{vacationers.map(v=>v.user?.name).filter(Boolean).join(", ")}</span>
        </div>
      )}

      {/* 프로젝트 카드 그리드 */}
      <div style={{flex:1,display:"grid",gap:12,gridTemplateColumns:"repeat(3,1fr)",gridTemplateRows:"1fr 1fr",alignItems:"stretch"}}>
        {projects.slice(0,6).map(p=>{
          const hc = HEALTH_CONFIG[p.health]||HEALTH_CONFIG.good;
          const total = p.tasks?.length||0;
          const pdone  = (p.tasks||[]).filter(t=>t.status==="done").length;
          const pdoing = (p.tasks||[]).filter(t=>t.status==="doing").length;
          const pblkd  = (p.tasks||[]).filter(t=>t.status==="blocked").length;
          const pct = total>0?Math.round((pdone/total)*100):0;
          return (
            <div key={p.id} style={{background:V.bg2,border:`1px solid ${hc.color}30`,borderRadius:14,padding:"18px 22px",display:"flex",flexDirection:"column",gap:12,overflow:"hidden"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:hc.color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:hc.color,fontWeight:600}}>{hc.label}</span>
                  </div>
                  <h3 style={{fontSize:17,fontWeight:700,color:V.text1,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</h3>
                </div>
                {p.end_date&&(
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <p style={{fontSize:11,color:V.text3,margin:0}}>마감</p>
                    <p style={{fontSize:15,fontWeight:600,color:V.text2,margin:0}}>{new Date(p.end_date).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})}</p>
                  </div>
                )}
              </div>
              {/* 진행률 바 */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <div style={{display:"flex",gap:14}}>
                    {[{l:"진행",v:pdoing,c:"#2563EB"},{l:"완료",v:pdone,c:"#16A34A"},{l:"전체",v:total,c:V.text3},...(pblkd>0?[{l:"Blocked",v:pblkd,c:"#DC2626"}]:[])].map((s,i)=>(
                      <span key={i} style={{fontSize:13,color:s.c}}>{s.l} <b style={{fontSize:18}}>{s.v}</b></span>
                    ))}
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:pct===100?"#16A34A":hc.color}}>{pct}%</span>
                </div>
                <div style={{height:3,background:V.border,borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:hc.color,borderRadius:2,transition:"width 0.5s"}}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 팀원 현황 바 */}
      {users.length>0&&(
        <div style={{display:"flex",gap:8}}>
          {users.slice(0,8).map((u,i)=>{
            const color = COLORS[i%COLORS.length];
            const udoing = tasks.filter(t=>(t.assignee_id===u.id||(t.assignee_ids||[]).includes(u.id))&&t.status==="doing").length;
            const utotal = tasks.filter(t=>(t.assignee_id===u.id||(t.assignee_ids||[]).includes(u.id))&&t.status!=="done").length;
            return (
              <div key={u.id} style={{flex:1,background:V.bg2,border:`1px solid ${color}25`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${color}18`,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,flexShrink:0}}>
                  {u.name?.[0]}
                </div>
                <div>
                  <p style={{fontSize:14,fontWeight:600,color:V.text1,margin:0}}>{u.name}</p>
                  <p style={{fontSize:12,color,margin:0}}>진행 {udoing} / 전체 {utotal}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 최근 활동 티커 */}
      {recentActivity && recentActivity.length > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:12,background:V.bg2,border:`1px solid ${V.border}`,borderRadius:10,padding:"8px 18px",overflow:"hidden"}}>
          <span style={{fontSize:12,color:V.text3,fontWeight:600,flexShrink:0,paddingRight:12,borderRight:`1px solid ${V.border}`}}>🔔 최근 활동</span>
          <div style={{display:"flex",gap:28,overflow:"hidden",whiteSpace:"nowrap",animation:"ticker 30s linear infinite"}}>
            {[...recentActivity, ...recentActivity].map((e,i)=>{
              const sc = STATUS_CONFIG[e.to_status]||STATUS_CONFIG.todo;
              const mins = Math.round((Date.now()-new Date(e.changed_at).getTime())/60000);
              const timeLabel = mins<1?"방금":mins<60?`${mins}분 전`:mins<1440?`${Math.round(mins/60)}시간 전`:`${Math.round(mins/1440)}일 전`;
              return (
                <span key={i} style={{fontSize:13,color:V.text2,flexShrink:0}}>
                  <span style={{color:V.text3}}>{timeLabel}</span>{" "}
                  <b style={{color:V.text1}}>{e.changer?.name??"누군가"}</b>님이{" "}
                  <span style={{color:sc.color}}>{e.task?.title??"업무"}</span>를{" "}
                  <span style={{color:sc.color,fontWeight:600}}>{sc.label}</span>(으)로 변경
                </span>
              );
            })}
          </div>
          <style>{`@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 슬라이드 2: 프로젝트 상세
// ────────────────────────────────────────────────────────────
function ProjectSlide({ project, tasks }) {
  const now = new Date();
  const hc      = HEALTH_CONFIG[project.health]||HEALTH_CONFIG.good;
  const total   = tasks.length;
  const done    = tasks.filter(t=>t.status==="done").length;
  const doing   = tasks.filter(t=>t.status==="doing").length;
  const blocked = tasks.filter(t=>t.status==="blocked").length;
  const review  = tasks.filter(t=>t.status==="review").length;
  const pct     = total>0?Math.round((done/total)*100):0;
  const daysLeft= project.end_date?Math.ceil((new Date(project.end_date).getTime()-now.getTime())/86400000):null;
  const active  = tasks.filter(t=>t.status!=="done"&&t.status!=="backlog").slice(0,10);
  const dColor  = daysLeft===null?"#16A34A":daysLeft<0?"#DC2626":daysLeft<=7?"#D97706":"#16A34A";

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",padding:"36px 48px",gap:20,background:V.bg}}>
      {/* 헤더 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:hc.color}}/>
            <span style={{fontSize:13,color:hc.color,fontWeight:600,background:`${hc.color}15`,padding:"3px 12px",borderRadius:20}}>{hc.label}</span>
            {project.owner?.name&&<span style={{fontSize:14,color:V.text3}}>담당 · {project.owner.name}</span>}
          </div>
          <h1 style={{fontSize:32,fontWeight:700,color:V.text1,margin:0,letterSpacing:-0.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name}</h1>
          {project.description&&<p style={{fontSize:15,color:V.text2,margin:"6px 0 0"}}>{project.description}</p>}
        </div>
        {daysLeft!==null&&(
          <div style={{background:V.bg2,border:`1.5px solid ${dColor}40`,borderRadius:14,padding:"14px 22px",textAlign:"center",flexShrink:0,marginLeft:20}}>
            <p style={{fontSize:13,color:V.text3,margin:0}}>마감일</p>
            <p style={{fontSize:17,fontWeight:600,color:V.text2,margin:"3px 0 0"}}>{new Date(project.end_date).toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}</p>
            <p style={{fontSize:32,fontWeight:700,color:dColor,margin:"3px 0 0"}}>{daysLeft<0?`+${Math.abs(daysLeft)}일`:`D-${daysLeft}`}</p>
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:14,color:V.text3}}>전체 완료율</span>
          <span style={{fontSize:16,fontWeight:700,color:pct===100?"#16A34A":hc.color}}>{pct}%</span>
        </div>
        <div style={{height:5,background:V.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:hc.color,borderRadius:3,transition:"width 0.5s"}}/>
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[
          {l:"전체",v:total,c:"#9CA3AF"},
          {l:"진행 중",v:doing,c:"#2563EB"},
          {l:"리뷰",v:review,c:"#D97706"},
          {l:"Blocked",v:blocked,c:"#DC2626"},
          {l:"완료",v:done,c:"#16A34A"},
        ].map(s=>(
          <div key={s.l} style={{background:V.bg2,border:`1px solid ${s.c}25`,borderRadius:12,padding:"16px 12px",textAlign:"center"}}>
            <p style={{fontSize:52,fontWeight:700,color:s.c,margin:0,lineHeight:1}}>{s.v}</p>
            <p style={{fontSize:14,color:V.text3,margin:"8px 0 0"}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* 진행 중 업무 */}
      <div style={{flex:1,overflow:"hidden"}}>
        <p style={{fontSize:14,color:V.text3,marginBottom:10}}>진행 중 업무</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {active.map(t=>{
            const sc = STATUS_CONFIG[t.status]||STATUS_CONFIG.todo;
            const overdue = t.due_date&&new Date(t.due_date)<now&&t.status!=="done";
            return (
              <div key={t.id} style={{background:V.bg2,borderLeft:`3px solid ${sc.color}`,borderRadius:"0 10px 10px 0",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,background:`${sc.color}18`,color:sc.color,borderRadius:6,padding:"4px 10px",fontWeight:600,flexShrink:0}}>{sc.label}</span>
                <span style={{flex:1,fontSize:17,color:V.text1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                {t.assignee?.name&&<span style={{fontSize:14,color:V.text3,flexShrink:0}}>{t.assignee.name}</span>}
                {t.due_date&&<span style={{fontSize:14,color:overdue?"#DC2626":V.text3,flexShrink:0,fontWeight:overdue?700:400}}>{overdue?"⚠ ":""}{new Date(t.due_date).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 슬라이드 3: 캘린더
// ────────────────────────────────────────────────────────────
function CalendarSlide({ events, tasks }) {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate()-now.getDay()-7);
  rangeStart.setHours(0,0,0,0);
  const cells = Array.from({length:28},(_,i)=>{const d=new Date(rangeStart);d.setDate(rangeStart.getDate()+i);return d;});
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate()-now.getDay()); thisWeekStart.setHours(0,0,0,0);
  const WEEK_LABELS = ["지난 주","이번 주","다음 주","2주 후"];

  function getEventsForDay(date) {
    const result=[];
    events.forEach(ev=>{
      if(!ev.start_date)return;
      const s=new Date(ev.start_date);s.setHours(0,0,0,0);
      const e=ev.end_date?new Date(ev.end_date):new Date(s);e.setHours(23,59,59,999);
      if(date>=s&&date<=e)result.push({...ev,_type:"event"});
    });
    tasks.forEach(t=>{
      if(!t.due_date)return;
      if(isSameDay(date,new Date(t.due_date)))result.push({...t,_type:"task",type:"deadline"});
    });
    return result;
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",padding:"36px 48px",gap:18,background:V.bg}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h1 style={{fontSize:28,fontWeight:700,color:V.text1,margin:0,letterSpacing:-0.5}}>일정</h1>
        <div style={{display:"flex",gap:16}}>
          {Object.entries(EVENT_TYPE_CONFIG).map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:10,height:10,borderRadius:3,background:v.color}}/>
              <span style={{fontSize:13,color:V.text3}}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{flex:1,borderRadius:14,overflow:"hidden",border:`1px solid ${V.border}`}}>
        {/* 요일 헤더 */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:V.bg3,borderBottom:`1px solid ${V.border}`}}>
          {DAYS.map((d,i)=>(
            <div key={i} style={{padding:"14px 0",textAlign:"center",fontSize:22,fontWeight:700,color:i===0?"#DC2626":i===6?"#2563EB":V.text2}}>{d}</div>
          ))}
        </div>
        {/* 날짜 셀 */}
        <div style={{display:"grid",gridTemplateRows:"repeat(4,1fr)",height:"calc(100% - 54px)"}}>
          {[0,1,2,3].map(wk=>{
            const weekDays=cells.slice(wk*7,wk*7+7);
            const isThisWeek=wk===1;
            return (
              <div key={wk} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",position:"relative",borderBottom:wk<3?`1px solid ${V.border}`:"none"}}>
                <div style={{position:"absolute",left:8,top:5,zIndex:2}}>
                  <span style={{fontSize:12,background:isThisWeek?`${V.accent}25`:V.bg3,color:isThisWeek?"#60A5FA":V.text3,borderRadius:10,padding:"2px 10px",fontWeight:600}}>
                    {WEEK_LABELS[wk]}
                  </span>
                </div>
                {weekDays.map((d,i)=>{
                  const dayEvs=getEventsForDay(d);
                  const col=i%7;
                  const isToday=isSameDay(d,now);
                  const isPast=d<thisWeekStart;
                  return (
                    <div key={i} style={{background:isToday?`${V.accent}12`:isPast?"rgba(0,0,0,0.15)":V.bg2,borderRight:col<6?`1px solid ${V.border}`:"none",padding:"6px 8px",paddingTop:30,opacity:isPast?0.5:1}}>
                      <div style={{width:34,height:34,borderRadius:"50%",background:isToday?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:isToday?"#fff":col===0?"#DC2626":col===6?"#2563EB":V.text1,marginBottom:3}}>
                        {d.getDate()}
                      </div>
                      {dayEvs.slice(0,3).map((ev,j)=>{
                        const cfg=EVENT_TYPE_CONFIG[ev.type]||EVENT_TYPE_CONFIG.personal;
                        const color=ev.color||cfg.color;
                        return (
                          <div key={j} style={{background:`${color}18`,color,fontSize:13,fontWeight:500,borderRadius:5,padding:"3px 8px",marginBottom:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",border:`1px solid ${color}30`}}>
                            {ev._type==="task"?"📌 ":""}{ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length>3&&<p style={{fontSize:12,color:V.text3,margin:0}}>+{dayEvs.length-3}개</p>}
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

// ────────────────────────────────────────────────────────────
// 슬라이드: 생일 축하 🎉
// ────────────────────────────────────────────────────────────
function BirthdaySlide({ people }) {
  const names = (people||[]).map(p=>p.user?.name).filter(Boolean);
  const CONFETTI_COLORS = ["#EC4899","#F59E0B","#2563EB","#16A34A","#7C3AED","#DC2626"];
  const confetti = Array.from({length:36},(_,i)=>({
    left: Math.random()*100,
    delay: Math.random()*4,
    duration: 3+Math.random()*3,
    color: CONFETTI_COLORS[i%CONFETTI_COLORS.length],
    size: 8+Math.random()*8,
  }));

  return (
    <div style={{height:"100%",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`radial-gradient(circle at 50% 40%, #2A1A3A 0%, ${V.bg} 70%)`,overflow:"hidden"}}>
      {confetti.map((c,i)=>(
        <div key={i} style={{
          position:"absolute", top:-20, left:`${c.left}%`, width:c.size, height:c.size,
          background:c.color, borderRadius: i%2===0?"50%":"2px",
          animation:`fall ${c.duration}s linear ${c.delay}s infinite`, opacity:0.85,
        }}/>
      ))}
      <style>{`@keyframes fall{from{transform:translateY(-20px) rotate(0deg)}to{transform:translateY(110vh) rotate(360deg)}}`}</style>

      <div style={{fontSize:88,marginBottom:12}}>🎂</div>
      <h1 style={{fontSize:44,fontWeight:800,color:"#fff",margin:0,letterSpacing:-1,textAlign:"center"}}>
        {names.join(", ")}{names.length>0?"님":""}
      </h1>
      <p style={{fontSize:26,color:"#F0A8D0",margin:"10px 0 0",fontWeight:600}}>생일 축하해요! 🎉</p>
      <p style={{fontSize:15,color:V.text3,marginTop:20}}>오늘 하루 즐겁게 보내세요</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 뷰어 페이지
// ────────────────────────────────────────────────────────────
export default function ViewerPage() {
  const supabase = createClient();
  const [projects, setProjects]           = useState([]);
  const [allTasks, setAllTasks]           = useState([]);
  const [users, setUsers]                 = useState([]);
  const [events, setEvents]               = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);
  const [vacationers, setVacationers]     = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [birthdays, setBirthdays]         = useState([]);
  const [slides, setSlides]               = useState([]);
  const [current, setCurrent]             = useState(0);
  const [progress, setProgress]           = useState(0);
  const [paused, setPaused]               = useState(false);
  const [duration, setDuration]           = useState(SLIDE_DURATION);
  const [fullscreen, setFullscreen]       = useState(false);
  const [loading, setLoading]             = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(300);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const timerRef    = useRef(null);
  const progressRef = useRef(null);
  const containerRef= useRef(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data:p },{ data:t },{ data:u },{ data:ev },{ data:ct },{ data:vac },{ data:recentEvents },{ data:bday }] = await Promise.all([
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id,title,status,due_date,assignee_id,assignee_ids,assignee:users!tasks_assignee_id_fkey(name))").eq("status","active").order("created_at"),
      supabase.from("tasks").select("id,title,status,due_date,assignee_id,assignee_ids,project_id").neq("status","done"),
      supabase.from("users").select("id,name").eq("is_active",true).neq("role","viewer"),
      supabase.from("calendar_events").select("*").order("start_date"),
      supabase.from("tasks").select("id,title,status,due_date").neq("status","done").eq("show_on_calendar",true),
      supabase.from("calendar_events").select("*, user:users(name)").eq("type","vacation").eq("is_public",true).lte("start_date",today).gte("end_date",today),
      supabase.from("task_events").select("*, task:tasks(title), changer:users!task_events_changed_by_fkey(name)").order("changed_at",{ascending:false}).limit(8),
      supabase.from("calendar_events").select("*, user:users(name)").eq("type","birthday").eq("is_public",true).eq("start_date",today),
    ]);
    setProjects(p||[]); setAllTasks(t||[]); setUsers(u||[]); setEvents(ev||[]); setCalendarTasks(ct||[]);
    setVacationers(vac||[]); setRecentActivity(recentEvents||[]);
    const birthdayFolks = bday||[];
    setBirthdays(birthdayFolks);
    setSlides([
      {type:"dashboard"},
      ...(birthdayFolks.length>0 ? [{type:"birthday"}] : []),
      ...(p||[]).map(proj=>({type:"project",id:proj.id})),
      {type:"calendar"},
    ]);
    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    const ref = setInterval(()=>load(), refreshInterval*1000);
    return ()=>clearInterval(ref);
  },[refreshInterval,load]);
  useEffect(()=>{
    if(loading||slides.length===0||paused)return;
    setProgress(0);
    progressRef.current=setInterval(()=>setProgress(p=>p>=100?0:p+(100/(duration*10))),100);
    timerRef.current=setTimeout(()=>setCurrent(c=>(c+1)%slides.length),duration*1000);
    return ()=>{ clearTimeout(timerRef.current); clearInterval(progressRef.current); };
  },[current,paused,loading,slides.length,duration]);

  function toggleFullscreen() {
    if(!document.fullscreenElement){ containerRef.current?.requestFullscreen(); setFullscreen(true); }
    else{ document.exitFullscreen(); setFullscreen(false); }
  }
  useEffect(()=>{
    const h=()=>setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",h);
    return ()=>document.removeEventListener("fullscreenchange",h);
  },[]);

  if(loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:V.bg,flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,border:`3px solid ${V.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <p style={{fontSize:16,color:V.text3}}>데이터 로딩 중…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const slide = slides[current];

  return (
    <div ref={containerRef} style={{display:"flex",flexDirection:"column",height:"100vh",background:V.bg,fontFamily:"'Pretendard',-apple-system,sans-serif"}}
      onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>

      {/* 상단 컨트롤 바 */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 24px",background:V.bg2,borderBottom:`1px solid ${V.border}`,flexShrink:0}}>
        {/* 로고 + 상태 */}
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:22,height:22,background:V.accent,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontSize:11,fontWeight:700}}>T</span>
            </div>
            <span style={{fontSize:16,fontWeight:700,letterSpacing:2,color:V.text1}}>Task<span style={{color:"#60A5FA"}}>Flow</span></span>
          </div>
          <span style={{fontSize:12,background:`${V.accent}20`,color:"#60A5FA",borderRadius:20,padding:"3px 12px",border:`1px solid ${V.accent}30`}}>전체 현황</span>
          <span style={{fontSize:12,color:V.text3}}>{lastRefreshed.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})} 갱신</span>
        </div>

        {/* 컨트롤 */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* 슬라이드 도트 */}
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {slides.map((_,i)=>(
              <button key={i} onClick={()=>{setCurrent(i);setProgress(0);}}
                style={{width:i===current?18:6,height:6,borderRadius:3,background:i===current?V.accent:"rgba(255,255,255,0.15)",border:"none",cursor:"pointer",transition:"all 0.3s"}}/>
            ))}
          </div>
          <span style={{fontSize:13,color:V.text3}}>{current+1}/{slides.length}</span>

          {/* 속도 */}
          {[15,30,60].map(d=>(
            <button key={d} onClick={()=>setDuration(d)}
              style={{background:duration===d?`${V.accent}25`:"rgba(255,255,255,0.05)",color:duration===d?"#60A5FA":V.text3,border:`1px solid ${duration===d?V.accent+"40":V.border}`,borderRadius:8,padding:"5px 12px",fontSize:13,cursor:"pointer"}}>
              {d}s
            </button>
          ))}

          <button onClick={()=>{setCurrent(c=>(c-1+slides.length)%slides.length);setProgress(0);}} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${V.border}`,borderRadius:8,padding:"5px 14px",fontSize:18,color:V.text2,cursor:"pointer"}}>‹</button>
          <button onClick={()=>setPaused(v=>!v)} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${V.border}`,borderRadius:8,padding:"5px 14px",fontSize:14,color:V.text2,cursor:"pointer"}}>{paused?"▶":"⏸"}</button>
          <button onClick={()=>{setCurrent(c=>(c+1)%slides.length);setProgress(0);}} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${V.border}`,borderRadius:8,padding:"5px 14px",fontSize:18,color:V.text2,cursor:"pointer"}}>›</button>

          {/* 새로고침 주기 */}
          <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:10,borderLeft:`1px solid ${V.border}`}}>
            {[60,300].map(s=>(
              <button key={s} onClick={()=>setRefreshInterval(s)}
                style={{background:refreshInterval===s?`${V.accent}25`:"rgba(255,255,255,0.05)",color:refreshInterval===s?"#60A5FA":V.text3,border:`1px solid ${refreshInterval===s?V.accent+"40":V.border}`,borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer"}}>
                {s<60?`${s}s`:`${s/60}분`}
              </button>
            ))}
            <button onClick={load} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${V.border}`,borderRadius:8,padding:"5px 12px",fontSize:15,color:V.text2,cursor:"pointer"}}>🔄</button>
          </div>

          <button onClick={toggleFullscreen} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${V.border}`,borderRadius:8,padding:"5px 12px",fontSize:13,color:V.text2,cursor:"pointer"}}>
            {fullscreen?"⊡ 나가기":"⊞ 전체화면"}
          </button>
        </div>
      </div>

      {/* 슬라이드 영역 */}
      <div style={{flex:1,overflow:"hidden"}}>
        {slide?.type==="dashboard"&&<DashboardSlide projects={projects} tasks={allTasks} users={users} vacationers={vacationers} recentActivity={recentActivity}/>}
        {slide?.type==="birthday"&&<BirthdaySlide people={birthdays}/>}
        {slide?.type==="project"&&(()=>{const proj=projects.find(p=>p.id===slide.id);return proj?<ProjectSlide project={proj} tasks={proj.tasks||[]}/>:null;})()}
        {slide?.type==="calendar"&&<CalendarSlide events={events} tasks={calendarTasks}/>}
      </div>

      {/* 하단 진행 바 */}
      <div style={{height:3,background:"rgba(255,255,255,0.06)"}}>
        <div style={{height:"100%",width:`${progress}%`,background:V.accent,transition:paused?"none":"width 0.1s linear"}}/>
      </div>
    </div>
  );
}
