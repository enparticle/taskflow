// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const FREQ = { daily: "매일", weekly: "매주", monthly: "매월" };
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PRIORITY_COLOR: Record<string, string> = { urgent: "#FF4D6A", high: "#F5A623", medium: "#2E86FF", low: "#4A7099" };
const PRIORITY_LABEL: Record<string, string> = { urgent: "긴급", high: "높음", medium: "보통", low: "낮음" };
const TYPE_LABEL: Record<string, string> = { planning:"기획", design:"디자인", development:"개발", qa:"QA", operation:"운영", documentation:"문서화", meeting:"회의", research:"리서치", customer:"고객대응", other:"기타" };

const fieldStyle = { background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", width: "100%", outline: "none", colorScheme: "dark" as const };

export default function RecurringPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", task_type: "meeting", priority: "medium", assignee_id: "", project_id: "", estimated_hours: "", frequency: "weekly", day_of_week: 1, day_of_month: 1 });

  const load = useCallback(async () => {
    const { data } = await supabase.from("recurring_tasks")
      .select("*, assignee:users!recurring_tasks_assignee_id_fkey(name), project:projects(name)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
    supabase.from("users").select("id,name").eq("is_active", true).then(({ data }) => setUsers(data ?? []));
    supabase.from("projects").select("id,name").eq("status", "active").then(({ data }) => setProjects(data ?? []));
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.title.trim()) return;
    const now = new Date();
    let next = new Date(now);

    if (form.frequency === "daily") {
      next.setDate(next.getDate() + 1);
    } else if (form.frequency === "weekly") {
      const diff = (form.day_of_week - now.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + diff);
    } else {
      next.setMonth(next.getMonth() + 1);
      next.setDate(form.day_of_month);
    }

    await supabase.from("recurring_tasks").insert({
      title: form.title.trim(),
      task_type: form.task_type,
      priority: form.priority,
      assignee_id: form.assignee_id || null,
      project_id: form.project_id || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      frequency: form.frequency,
      day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
      day_of_month: form.frequency === "monthly" ? form.day_of_month : null,
      next_run_at: next.toISOString().split("T")[0],
    });

    setShowForm(false);
    setForm({ title: "", task_type: "meeting", priority: "medium", assignee_id: "", project_id: "", estimated_hours: "", frequency: "weekly", day_of_week: 1, day_of_month: 1 });
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("recurring_tasks").update({ is_active: !current }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("반복 업무를 삭제할까요?")) return;
    await supabase.from("recurring_tasks").delete().eq("id", id);
    load();
  }

  async function runNow(item: any) {
    // 즉시 업무 생성
    await supabase.from("tasks").insert({
      title: item.title, task_type: item.task_type, priority: item.priority,
      assignee_id: item.assignee_id, assignee_ids: item.assignee_id ? [item.assignee_id] : [],
      project_id: item.project_id, estimated_hours: item.estimated_hours, status: "todo",
    });
    alert("업무가 생성됐습니다");
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#F5A623" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>반복 업무</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}>{items.length}</span>
        </div>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
          + 반복 업무 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl p-4"
            style={{ background: "var(--bg-2)", border: `1px solid ${item.is_active ? "var(--border)" : "var(--border)"}`, opacity: item.is_active ? 1 : 0.5 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{item.title}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_COLOR[item.priority]}18`, color: PRIORITY_COLOR[item.priority] }}>
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
                    {TYPE_LABEL[item.task_type]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-3)" }}>
                  <span>🔄 {FREQ[item.frequency as keyof typeof FREQ]}
                    {item.frequency === "weekly" && ` ${DAYS[item.day_of_week]}요일`}
                    {item.frequency === "monthly" && ` ${item.day_of_month}일`}
                  </span>
                  {item.assignee && <span>담당: {item.assignee.name}</span>}
                  {item.project && <span>프로젝트: {item.project.name}</span>}
                  <span>다음 실행: {item.next_run_at}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => runNow(item)}
                  className="text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                  지금 실행
                </button>
                <button onClick={() => toggleActive(item.id, item.is_active)}
                  className="text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ background: item.is_active ? "rgba(0,212,160,0.1)" : "var(--bg-3)", color: item.is_active ? "#00D4A0" : "var(--text-3)", border: `1px solid ${item.is_active ? "rgba(0,212,160,0.3)" : "var(--border)"}` }}>
                  {item.is_active ? "활성" : "비활성"}
                </button>
                <button onClick={() => remove(item.id)}
                  className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: "var(--red-bg)", color: "var(--red)" }}>삭제</button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-2)" }}>반복 업무가 없습니다</p>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>매주 회의 준비, 매월 보고서 작성 등을 등록해보세요</p>
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>반복 업무 추가</h2>
              <button onClick={() => setShowForm(false)} style={{ color: "var(--text-3)", fontSize: 18 }}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>업무명 *</label>
                <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="예: 주간 팀 미팅 준비" style={fieldStyle} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>반복 주기</label>
                  <select value={form.frequency} onChange={e => set("frequency", e.target.value)} style={fieldStyle}>
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </div>
                {form.frequency === "weekly" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>요일</label>
                    <select value={form.day_of_week} onChange={e => set("day_of_week", Number(e.target.value))} style={fieldStyle}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                    </select>
                  </div>
                )}
                {form.frequency === "monthly" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>날짜</label>
                    <select value={form.day_of_month} onChange={e => set("day_of_month", Number(e.target.value))} style={fieldStyle}>
                      {Array.from({length: 28}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>유형</label>
                  <select value={form.task_type} onChange={e => set("task_type", e.target.value)} style={fieldStyle}>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>우선순위</label>
                  <select value={form.priority} onChange={e => set("priority", e.target.value)} style={fieldStyle}>
                    <option value="low">낮음</option><option value="medium">보통</option>
                    <option value="high">높음</option><option value="urgent">긴급</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>담당자</label>
                  <select value={form.assignee_id} onChange={e => set("assignee_id", e.target.value)} style={fieldStyle}>
                    <option value="">미정</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-3)" }}>프로젝트</label>
                  <select value={form.project_id} onChange={e => set("project_id", e.target.value)} style={fieldStyle}>
                    <option value="">없음</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-xs" style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>취소</button>
                <button onClick={save} disabled={!form.title.trim()} className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
