// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import TaskDetail from "@/components/tasks/TaskDetail";

type ViewMode = "week" | "month";

const EVENT_TYPE_CONFIG = {
  personal: { label: "개인",  color: "#7C3AED" },
  vacation: { label: "연차",  color: "#16A34A" },
  holiday:  { label: "휴일",  color: "#DC2626" },
  meeting:  { label: "미팅",  color: "#2563EB" },
  deadline: { label: "마감",  color: "#D97706" },
};
const DAYS = ["일","월","화","수","목","금","토"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
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
    if (viewer) {
      const { data } = await supabase.from("calendar_events")
        .select("*, user:users(name)").eq("is_public", true).order("start_date");
      setEvents(data ?? []);
    } else {
      const { data } = await supabase.from("calendar_events")
        .select("*, user:users(name)")
        .or(`user_id.eq.${u?.userId},is_public.eq.true`)
        .order("start_date");
      setEvents(data ?? []);
    }
    const { data } = await supabase.from("tasks")
      .select("id, title, status, due_date, task_type, project:projects(name)")
      .not("due_date", "is", null).neq("status", "done").eq("show_on_calendar", true);
    setTasks(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getEventsForDay(date: Date) {
    const result: any[] = [];
    events.forEach(ev => {
      if (!ev.start_date) return;
      const start = new Date(ev.start_date); start.setHours(0,0,0,0);
      const end = ev.end_date ? new Date(ev.end_date) : new Date(ev.start_date); end.setHours(23,59,59,999);
      if (isSameDay(date, start) || dateInRange(date, start, end)) result.push({ ...ev, _type: "event" });
    });
    tasks.forEach(t => {
      if (!t.due_date) return;
      if (isSameDay(date, new Date(t.due_date))) result.push({ ...t, _type: "task", type: "deadline" });
    });
    return result;
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.start_date) return;
    const payload = {
      user_id: myUser?.userId, title: form.title, type: form.type,
      start_date: form.start_date, end_date: form.end_date || form.start_date,
      all_day: form.all_day,
      start_time: form.all_day ? null : form.start_time || null,
      end_time: form.all_day ? null : form.end_time || null,
      description: form.description || null, is_public: form.is_public, color: form.color || null,
    };
    if (editEvent) await supabase.from("calendar_events").update(payload).eq("id", editEvent.id);
    else await supabase.from("calendar_events").insert(payload);
    closeForm(); await load();
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

  const FS = {
    background: "var(--bg-3)", border: "1px solid var(--border)",
    color: "var(--text-1)", borderRadius: 8, padding: "7px 10px",
    fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
  };

  function EventChip({ ev, small = false }: { ev: any; small?: boolean }) {
    const cfg = EVENT_TYPE_CONFIG[ev.type] ?? EVENT_TYPE_CONFIG.personal;
    const color = ev.color || cfg.color;
    const isOwn = ev._type === "event" && ev.user_id === myUser?.userId;
    return (
      <div style={{
        background: `${color}12`, color, border: `1px solid ${color}33`,
        borderRadius: 4, padding: small ? "1px 5px" : "2px 6px",
        fontSize: small ? 10 : 11, overflow: "hidden", whiteSpace: "nowrap",
        textOverflow: "ellipsis", cursor: "pointer",
      }}
        onClick={e => { e.stopPropagation(); ev._type === "task" ? setOpenDetail(ev.id) : openEditForm(ev); }}
        title={ev.title + (ev.user?.name && !isOwn ? ` (${ev.user.name})` : "")}>
        {ev._type === "task" ? "📌 " : ""}{ev.title}
        {ev.user?.name && !isOwn && <span style={{ opacity: 0.6 }}> · {ev.user.name}</span>}
      </div>
    );
  }

  function WeekView() {
    const s = new Date(current); s.setDate(current.getDate() - current.getDay());
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          {days.map((d, i) => (
            <div key={i} style={{ padding: "10px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: i===0?"#DC2626":i===6?"#2563EB":"var(--text-3)", marginBottom: 4 }}>{DAYS[i]}</p>
              <div style={{ width: 28, height: 28, margin: "0 auto", borderRadius: "50%", background: isSameDay(d,today) ? "var(--cyan)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: isSameDay(d,today) ? "#fff" : i===0 ? "#DC2626" : i===6 ? "#2563EB" : "var(--text-1)" }}>{d.getDate()}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((d, i) => {
            const dayEvs = getEventsForDay(d);
            return (
              <div key={i} style={{
                padding: 6, minHeight: 120, cursor: "pointer",
                borderRight: i<6 ? "1px solid var(--border)" : "none",
                background: isSameDay(d,today) ? "rgba(37,99,235,0.03)" : "var(--bg-2)",
                display: "flex", flexDirection: "column", gap: 3,
              }}
                onClick={() => !isViewer && openNewForm(d.toISOString().slice(0,10))}>
                {dayEvs.slice(0,4).map((ev,j) => <EventChip key={j} ev={ev} />)}
                {dayEvs.length>4 && <p style={{ fontSize: 10, color: "var(--text-3)", padding: "0 2px" }}>+{dayEvs.length-4}개</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function MonthView() {
    const year = current.getFullYear(), month = current.getMonth();
    const firstDay = new Date(year,month,1).getDay();
    const daysInMonth = new Date(year,month+1,0).getDate();
    const cells: (Date|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>new Date(year,month,i+1))];
    while (cells.length%7!==0) cells.push(null);
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          {DAYS.map((d,i) => (
            <div key={i} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 500, color: i===0?"#DC2626":i===6?"#2563EB":"var(--text-3)" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {cells.map((d,i) => {
            if (!d) return <div key={i} style={{ background: "var(--bg-3)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", minHeight: 80 }} />;
            const dayEvs = getEventsForDay(d);
            const col = i%7;
            const isToday = isSameDay(d,today);
            return (
              <div key={i} style={{
                padding: 4, minHeight: 80, cursor: "pointer",
                background: isToday ? "rgba(37,99,235,0.03)" : "var(--bg-2)",
                borderRight: col<6 ? "1px solid var(--border)" : "none",
                borderBottom: "1px solid var(--border)",
              }}
                onClick={() => !isViewer && openNewForm(d.toISOString().slice(0,10))}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: isToday ? "var(--cyan)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: isToday ? "#fff" : col===0 ? "#DC2626" : col===6 ? "#2563EB" : "var(--text-2)" }}>{d.getDate()}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayEvs.slice(0,3).map((ev,j) => <EventChip key={j} ev={ev} small />)}
                  {dayEvs.length>3 && <p style={{ fontSize: 9, color: "var(--text-3)" }}>+{dayEvs.length-3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>캘린더</h1>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
            {isViewer ? "전체 공개 일정" : "내 일정 + 팀 공개"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* 주별/월별 토글 */}
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
            {(["week","month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: view===v ? "var(--bg-4)" : "transparent", color: view===v ? "var(--text-1)" : "var(--text-3)" }}>
                {v === "week" ? "주별" : "월별"}
              </button>
            ))}
          </div>
          <button onClick={() => navigate(-1)} style={{ padding: "5px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 16, color: "var(--text-2)", cursor: "pointer" }}>‹</button>
          <button onClick={() => setCurrent(new Date())} style={{ padding: "5px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>오늘</button>
          <button onClick={() => navigate(1)} style={{ padding: "5px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 16, color: "var(--text-2)", cursor: "pointer" }}>›</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{getTitle()}</span>
          {!isViewer && (
            <button onClick={() => openNewForm(today.toISOString().slice(0,10))}
              style={{ padding: "7px 14px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              + 일정 추가
            </button>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {Object.entries(EVENT_TYPE_CONFIG).map(([k,v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.color }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{v.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>· 업무는 상세에서 캘린더 표시 설정 가능</span>
      </div>

      {view === "week" ? <WeekView /> : <MonthView />}

      {/* 일정 추가/수정 모달 */}
      {showForm && !isViewer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}
          onClick={closeForm}>
          <div style={{ width: "100%", maxWidth: 440, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{editEvent ? "일정 수정" : "새 일정"}</h2>
            <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="일정 제목" style={FS} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>유형</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} style={FS}>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>색상</label>
                <input type="color" value={form.color||EVENT_TYPE_CONFIG[form.type]?.color||"#2563EB"}
                  onChange={e => setForm(f=>({...f,color:e.target.value}))}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid var(--border)", padding: 2, cursor: "pointer", background: "var(--bg-3)" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>시작일</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))} style={FS} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>종료일</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f=>({...f,end_date:e.target.value}))} style={FS} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.all_day} onChange={e => setForm(f=>({...f,all_day:e.target.checked}))} />
                하루 종일
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_public} onChange={e => setForm(f=>({...f,is_public:e.target.checked}))} />
                팀 공개
              </label>
            </div>
            {!form.all_day && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>시작 시간</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))} style={FS} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>종료 시간</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))} style={FS} />
                </div>
              </div>
            )}
            <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
              placeholder="메모 (선택)" rows={2} style={{ ...FS, resize: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveEvent} disabled={!form.title.trim()||!form.start_date}
                style={{ flex: 1, padding: "9px 0", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !form.title.trim()||!form.start_date ? 0.4 : 1 }}>
                {editEvent ? "수정" : "저장"}
              </button>
              {editEvent && editEvent.user_id === myUser?.userId && (
                <button onClick={() => deleteEvent(editEvent.id)}
                  style={{ padding: "9px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                  삭제
                </button>
              )}
              <button onClick={closeForm}
                style={{ padding: "9px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {openDetail && <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => { setOpenDetail(null); load(); }} />}
    </div>
  );
}
