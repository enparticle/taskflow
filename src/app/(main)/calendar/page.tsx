// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import TaskDetail from "@/components/tasks/TaskDetail";

type ViewMode = "week" | "month";

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  personal:  { label: "개인",  color: "#a78bfa" },
  vacation:  { label: "연차",  color: "#34d399" },
  holiday:   { label: "휴일",  color: "#f87171" },
  meeting:   { label: "미팅",  color: "#60a5fa" },
  deadline:  { label: "마감",  color: "#fbbf24" },
};

const DAYS = ["일","월","화","수","목","금","토"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateInRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

export default function CalendarPage() {
  const supabase = createClient();
  const [view, setView] = useState<ViewMode>("week");
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [myUser, setMyUser] = useState<any>(null);
  const [isViewer, setIsViewer] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", type: "personal", start_date: "", end_date: "",
    all_day: true, start_time: "", end_time: "",
    description: "", is_public: false, color: "",
  });
  const today = new Date();

  const load = useCallback(async () => {
    const u = await getAuthUser();
    setMyUser(u);
    const viewer = u?.role === "viewer";
    setIsViewer(viewer);

    // 캘린더 이벤트
    if (viewer) {
      // 뷰어: 전체 공개 일정만
      const { data } = await supabase.from("calendar_events")
        .select("*, user:users(name)").eq("is_public", true).order("start_date");
      setEvents(data ?? []);
    } else {
      // 일반 사용자: 내 일정 + 공개 일정
      const { data } = await supabase.from("calendar_events")
        .select("*, user:users(name)")
        .or(`user_id.eq.${u?.userId},is_public.eq.true`)
        .order("start_date");
      setEvents(data ?? []);
    }

    // 업무 마감일
    if (viewer) {
      // 뷰어: 전체 업무
      const { data } = await supabase.from("tasks")
        .select("id, title, status, due_date, task_type, project:projects(name)")
        .not("due_date", "is", null).neq("status", "done");
      setTasks(data ?? []);
    } else {
      // 일반: 내 담당 업무만
      const { data } = await supabase.from("tasks")
        .select("id, title, status, due_date, task_type, project:projects(name), assignee_ids, assignee_id")
        .not("due_date", "is", null).neq("status", "done");
      const myTasks = (data ?? []).filter(t =>
        t.assignee_id === u?.userId || (t.assignee_ids ?? []).includes(u?.userId)
      );
      setTasks(myTasks);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getEventsForDay(date: Date) {
    const result: any[] = [];
    events.forEach(ev => {
      if (!ev.start_date) return;
      const start = new Date(ev.start_date);
      const end = ev.end_date ? new Date(ev.end_date) : new Date(ev.start_date);
      end.setHours(23, 59, 59, 999); // 종료일 당일 포함
      start.setHours(0, 0, 0, 0);
      if (isSameDay(date, start) || dateInRange(date, start, end)) {
        result.push({ ...ev, _type: "event" });
      }
    });
    tasks.forEach(t => {
      if (!t.due_date) return;
      if (isSameDay(date, new Date(t.due_date))) {
        result.push({ ...t, _type: "task", type: t.task_type === "meeting" ? "meeting" : "deadline" });
      }
    });
    return result;
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.start_date) return;
    const payload = {
      user_id: myUser?.userId,
      title: form.title, type: form.type,
      start_date: form.start_date, end_date: form.end_date || form.start_date,
      all_day: form.all_day,
      start_time: form.all_day ? null : form.start_time || null,
      end_time: form.all_day ? null : form.end_time || null,
      description: form.description || null,
      is_public: form.is_public,
      color: form.color || null,
    };
    if (editEvent) {
      await supabase.from("calendar_events").update(payload).eq("id", editEvent.id);
    } else {
      await supabase.from("calendar_events").insert(payload);
    }
    closeForm();
    await load();
  }

  async function deleteEvent(id: string) {
    if (!confirm("일정을 삭제할까요?")) return;
    await supabase.from("calendar_events").delete().eq("id", id);
    await load();
  }

  function openNewForm(date?: string) {
    setEditEvent(null);
    setForm({ title: "", type: "personal", start_date: date ?? today.toISOString().slice(0,10), end_date: "", all_day: true, start_time: "", end_time: "", description: "", is_public: false, color: "" });
    setShowForm(true);
  }

  function openEditForm(ev: any) {
    setEditEvent(ev);
    setForm({ title: ev.title, type: ev.type, start_date: ev.start_date, end_date: ev.end_date ?? "", all_day: ev.all_day ?? true, start_time: ev.start_time ?? "", end_time: ev.end_time ?? "", description: ev.description ?? "", is_public: ev.is_public ?? false, color: ev.color ?? "" });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false); setEditEvent(null);
    setForm({ title: "", type: "personal", start_date: "", end_date: "", all_day: true, start_time: "", end_time: "", description: "", is_public: false, color: "" });
  }

  function navigate(dir: number) {
    const d = new Date(current);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrent(d);
  }

  function getTitle() {
    if (view === "week") {
      const s = new Date(current); s.setDate(current.getDate() - current.getDay());
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return `${s.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} — ${e.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`;
    }
    return current.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }

  const FS = { background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)", borderRadius: 8, padding: "6px 10px", fontSize: 13, width: "100%", outline: "none", colorScheme: "dark" as const };

  function EventChip({ ev, small = false }: { ev: any; small?: boolean }) {
    const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.personal;
    const color = ev.color || cfg.color;
    const isOwn = ev._type === "event" && ev.user_id === myUser?.userId;
    return (
      <div className="rounded truncate cursor-pointer"
        style={{ background: `${color}22`, color, border: `1px solid ${color}44`, padding: small ? "1px 4px" : "2px 6px", fontSize: small ? 9 : 10 }}
        onClick={e => { e.stopPropagation(); ev._type === "task" ? setOpenDetail(ev.id) : openEditForm(ev); }}
        title={ev.title + (ev.user?.name && !isOwn ? ` (${ev.user.name})` : "")}>
        {ev._type === "task" ? "📌 " : ""}{ev.title}
        {ev.user?.name && !isOwn && <span style={{ opacity: 0.7 }}> · {ev.user.name}</span>}
      </div>
    );
  }

  // ── 주별 뷰 ──
  function WeekView() {
    const s = new Date(current); s.setDate(current.getDate() - current.getDay());
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-7" style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          {days.map((d, i) => (
            <div key={i} className="px-2 py-3 text-center">
              <p className="text-xs" style={{ color: i===0?"#f87171":i===6?"#60a5fa":"var(--text-3)" }}>{DAYS[i]}</p>
              <p className="text-sm font-bold mt-0.5 w-7 h-7 mx-auto rounded-full flex items-center justify-center"
                style={{ background: isSameDay(d,today)?"var(--cyan)":"transparent", color: isSameDay(d,today)?"#0D1B2E":i===0?"#f87171":i===6?"#60a5fa":"var(--text-1)" }}>
                {d.getDate()}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const dayEvs = getEventsForDay(d);
            return (
              <div key={i} className="p-1.5 space-y-1 min-h-32 cursor-pointer"
                style={{ borderRight: i<6?"1px solid var(--border)":"none", background: isSameDay(d,today)?"rgba(34,211,238,0.03)":"var(--bg-2)" }}
                onClick={() => !isViewer && openNewForm(d.toISOString().slice(0,10))}>
                {dayEvs.slice(0,4).map((ev,j) => <EventChip key={j} ev={ev} />)}
                {dayEvs.length>4 && <p className="text-xs px-1" style={{color:"var(--text-3)"}}>+{dayEvs.length-4}개</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 월별 뷰 ──
  function MonthView() {
    const year = current.getFullYear(), month = current.getMonth();
    const firstDay = new Date(year,month,1).getDay();
    const daysInMonth = new Date(year,month+1,0).getDate();
    const cells: (Date|null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({length:daysInMonth},(_,i)=>new Date(year,month,i+1)),
    ];
    while (cells.length%7!==0) cells.push(null);
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-7" style={{ background:"var(--bg-3)", borderBottom:"1px solid var(--border)" }}>
          {DAYS.map((d,i)=>(
            <div key={i} className="px-2 py-2 text-center text-xs font-medium"
              style={{color:i===0?"#f87171":i===6?"#60a5fa":"var(--text-3)"}}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d,i)=>{
            if (!d) return <div key={i} style={{background:"var(--bg-3)",borderRight:"1px solid var(--border)",borderBottom:"1px solid var(--border)",minHeight:80}} />;
            const dayEvs = getEventsForDay(d);
            const col = i%7;
            const isToday = isSameDay(d,today);
            return (
              <div key={i} className="p-1 min-h-20 cursor-pointer"
                style={{background:isToday?"rgba(34,211,238,0.04)":"var(--bg-2)",borderRight:col<6?"1px solid var(--border)":"none",borderBottom:"1px solid var(--border)"}}
                onClick={()=>!isViewer&&openNewForm(d.toISOString().slice(0,10))}>
                <p className="text-xs w-5 h-5 rounded-full flex items-center justify-center mb-0.5 font-medium"
                  style={{background:isToday?"var(--cyan)":"transparent",color:isToday?"#0D1B2E":col===0?"#f87171":col===6?"#60a5fa":"var(--text-2)"}}>
                  {d.getDate()}
                </p>
                {dayEvs.slice(0,3).map((ev,j)=><EventChip key={j} ev={ev} small />)}
                {dayEvs.length>3&&<p style={{fontSize:9,color:"var(--text-3)"}}>+{dayEvs.length-3}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{background:"var(--cyan)"}} />
          <h1 className="text-xl font-bold" style={{color:"var(--text-1)"}}>캘린더</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{background:"var(--bg-3)",color:"var(--text-3)"}}>
            {isViewer ? "전체 공개 일정" : "내 일정 + 팀 공개"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{background:"var(--bg-2)",border:"1px solid var(--border)"}}>
            {(["week","month"] as ViewMode[]).map(v=>(
              <button key={v} onClick={()=>setView(v)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{background:view===v?"var(--bg-4)":"transparent",color:view===v?"var(--text-1)":"var(--text-3)",border:view===v?"1px solid var(--border-2)":"1px solid transparent"}}>
                {v==="week"?"주별":"월별"}
              </button>
            ))}
          </div>
          <button onClick={()=>navigate(-1)} className="rounded-lg px-3 py-1.5 text-sm" style={{background:"var(--bg-2)",color:"var(--text-2)",border:"1px solid var(--border)"}}>‹</button>
          <button onClick={()=>setCurrent(new Date())} className="rounded-lg px-3 py-1.5 text-xs" style={{background:"var(--bg-2)",color:"var(--text-2)",border:"1px solid var(--border)"}}>오늘</button>
          <button onClick={()=>navigate(1)} className="rounded-lg px-3 py-1.5 text-sm" style={{background:"var(--bg-2)",color:"var(--text-2)",border:"1px solid var(--border)"}}>›</button>
          <p className="text-sm font-semibold" style={{color:"var(--text-1)"}}>{getTitle()}</p>
          {!isViewer && (
            <button onClick={()=>openNewForm(today.toISOString().slice(0,10))}
              className="rounded-xl px-4 py-2 text-sm font-semibold ml-1"
              style={{background:"linear-gradient(135deg, var(--cyan), #2E86FF)",color:"#fff"}}>
              + 일정 추가
            </button>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(EVENT_TYPE_CONFIG).map(([k,v])=>(
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{background:v.color}} />
            <span className="text-xs" style={{color:"var(--text-3)"}}>{v.label}</span>
          </div>
        ))}
      </div>

      {view==="week" ? <WeekView /> : <MonthView />}

      {/* 일정 입력 모달 (뷰어 제외) */}
      {showForm && !isViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(0,0,0,0.6)"}} onClick={closeForm}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{background:"var(--bg-2)",border:"1px solid var(--border-2)"}}
            onClick={e=>e.stopPropagation()}>
            <h2 className="text-sm font-bold" style={{color:"var(--text-1)"}}>{editEvent?"일정 수정":"새 일정"}</h2>

            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="일정 제목" style={FS} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>유형</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={FS}>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([k,v])=>(
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>색상</label>
                <input type="color" value={form.color||EVENT_TYPE_CONFIG[form.type]?.color||"#60a5fa"}
                  onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                  className="w-full h-9 rounded-lg cursor-pointer"
                  style={{background:"var(--bg-3)",border:"1px solid var(--border-2)",padding:2}} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>시작일</label>
                <input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={FS} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>종료일</label>
                <input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} style={FS} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{color:"var(--text-2)"}}>
                <input type="checkbox" checked={form.all_day} onChange={e=>setForm(f=>({...f,all_day:e.target.checked}))} />
                하루 종일
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs" style={{color:"var(--text-2)"}}>
                <input type="checkbox" checked={form.is_public} onChange={e=>setForm(f=>({...f,is_public:e.target.checked}))} />
                팀 공개
              </label>
            </div>

            {!form.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>시작 시간</label>
                  <input type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={FS} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{color:"var(--text-3)"}}>종료 시간</label>
                  <input type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={FS} />
                </div>
              </div>
            )}

            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="메모 (선택)" rows={2} style={{...FS,resize:"none"}} />

            <div className="flex gap-2">
              <button onClick={saveEvent} disabled={!form.title.trim()||!form.start_date}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                style={{background:"linear-gradient(135deg, var(--cyan), #2E86FF)",color:"#fff"}}>
                {editEvent?"수정":"저장"}
              </button>
              {editEvent && editEvent.user_id === myUser?.userId && (
                <button onClick={()=>deleteEvent(editEvent.id)}
                  className="rounded-xl px-4 py-2.5 text-sm"
                  style={{background:"rgba(248,113,113,0.1)",color:"#f87171"}}>삭제</button>
              )}
              <button onClick={closeForm} className="rounded-xl px-4 py-2.5 text-sm"
                style={{background:"var(--bg-3)",color:"var(--text-2)"}}>취소</button>
            </div>
          </div>
        </div>
      )}

      {openDetail && <TaskDetail taskId={openDetail} onClose={()=>setOpenDetail(null)} onRefresh={()=>{setOpenDetail(null);load();}} />}
    </div>
  );
}
