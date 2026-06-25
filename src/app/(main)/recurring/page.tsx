// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

const FREQ = { daily: "매일", weekly: "매주", monthly: "매월" };
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626", high: "#D97706", medium: "#2563EB", low: "#A8A8A4",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "긴급", high: "높음", medium: "보통", low: "낮음",
};
const TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "미팅",
  research: "리서치", customer: "고객 대응", other: "기타",
};

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "7px 10px",
  fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
};

export default function RecurringPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [scopeTab, setScopeTab] = useState<"team" | "personal">("team");
  const [myUser, setMyUser] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    title: "", task_type: "meeting", priority: "medium",
    assignee_id: "", project_id: "", estimated_hours: "",
    frequency: "weekly", day_of_week: 1, day_of_month: 1,
    scope: "team" as "team" | "personal",
  });

  const load = useCallback(async () => {
    const { data } = await supabase.from("recurring_tasks")
      .select("*, assignee:users!recurring_tasks_assignee_id_fkey(name), project:projects(name)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    load();
    getAuthUser().then(u => { if (u) setMyUser(u); });
    supabase.from("users").select("id,name").eq("is_active", true).then(({ data }) => setUsers(data ?? []));
    supabase.from("projects").select("id,name").eq("status", "active").then(({ data }) => setProjects(data ?? []));
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

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

    const payload: any = {
      title: form.title.trim(),
      task_type: form.task_type,
      priority: form.priority,
      assignee_id: form.scope === "personal" ? (myUser?.userId ?? null) : (form.assignee_id || null),
      project_id: form.project_id || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      frequency: form.frequency,
      day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
      day_of_month: form.frequency === "monthly" ? form.day_of_month : null,
      next_run_at: next.toISOString().split("T")[0],
    };

    // scope 컬럼이 있으면 저장
    try { payload.scope = form.scope; } catch {}

    await supabase.from("recurring_tasks").insert(payload);
    setShowForm(false);
    setForm({ title: "", task_type: "meeting", priority: "medium", assignee_id: "", project_id: "", estimated_hours: "", frequency: "weekly", day_of_week: 1, day_of_month: 1, scope: "team" });
    load();
    showToast("반복 업무가 추가됐습니다");
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("recurring_tasks").update({ is_active: !current }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("반복 업무를 삭제할까요?")) return;
    await supabase.from("recurring_tasks").delete().eq("id", id);
    load();
    showToast("삭제됐습니다");
  }

  async function runNow(item: any) {
    await supabase.from("tasks").insert({
      title: item.title, task_type: item.task_type, priority: item.priority,
      assignee_id: item.assignee_id,
      assignee_ids: item.assignee_id ? [item.assignee_id] : [],
      project_id: item.project_id, estimated_hours: item.estimated_hours, status: "todo",
    });
    showToast("업무가 생성됐습니다");
  }

  // 팀/개인 분류 — scope 컬럼 없으면 assignee로 판단
  const teamItems = items.filter(i => {
    if (i.scope) return i.scope === "team";
    return !i.assignee_id || i.assignee_id !== myUser?.userId;
  });
  const personalItems = items.filter(i => {
    if (i.scope) return i.scope === "personal";
    return i.assignee_id && i.assignee_id === myUser?.userId;
  });
  const displayed = scopeTab === "team" ? teamItems : personalItems;

  function RecurringCard({ item }: { item: any }) {
    const pc = PRIORITY_COLOR[item.priority] ?? "#A8A8A4";
    const isPersonal = item.scope === "personal" || (item.assignee_id && item.assignee_id === myUser?.userId);
    return (
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12,
        padding: "14px 16px", opacity: item.is_active ? 1 : 0.5,
        borderLeft: `3px solid ${isPersonal ? "#7C3AED" : "var(--cyan)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{item.title}</p>
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, fontWeight: 600, background: `${pc}12`, color: pc, border: `1px solid ${pc}30` }}>
                {PRIORITY_LABEL[item.priority]}
              </span>
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
                {TYPE_LABEL[item.task_type]}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                🔁 {FREQ[item.frequency as keyof typeof FREQ]}
                {item.frequency === "weekly" && ` ${DAYS[item.day_of_week]}요일`}
                {item.frequency === "monthly" && ` ${item.day_of_month}일`}
              </span>
              {item.assignee?.name && (
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>담당: {item.assignee.name}</span>
              )}
              {item.project?.name && (
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>프로젝트: {item.project.name}</span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                다음 실행: <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{item.next_run_at}</span>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => runNow(item)}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}>
              즉시 실행
            </button>
            <button onClick={() => toggleActive(item.id, item.is_active)}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, cursor: "pointer", border: `1px solid ${item.is_active ? "#BBF7D0" : "var(--border)"}`, background: item.is_active ? "#F0FDF4" : "var(--bg-3)", color: item.is_active ? "#16A34A" : "var(--text-3)" }}>
              {item.is_active ? "활성" : "비활성"}
            </button>
            <button onClick={() => remove(item.id)}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", cursor: "pointer" }}>
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 99, background: "var(--text-1)", color: "var(--bg-2)", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "#D97706", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>반복 업무</h1>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FFFBEB", color: "#D97706", border: "1px solid #FCD34D" }}>
            {items.length}개
          </span>
        </div>
        <button onClick={() => { setForm(f => ({ ...f, scope: scopeTab })); setShowForm(true); }}
          style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          + 반복 업무 추가
        </button>
      </div>

      {/* 팀 / 개인 탭 */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {[
          { id: "team",     label: "🏢 팀 반복 업무",   count: teamItems.length,     color: "var(--cyan)" },
          { id: "personal", label: "👤 개인 반복 업무",  count: personalItems.length, color: "#7C3AED" },
        ].map(t => (
          <button key={t.id} onClick={() => setScopeTab(t.id as any)}
            style={{
              padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: scopeTab === t.id ? "var(--bg-4)" : "transparent",
              color: scopeTab === t.id ? "var(--text-1)" : "var(--text-3)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {t.label}
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: scopeTab === t.id ? t.color : "transparent", color: scopeTab === t.id ? "#fff" : "var(--text-3)" }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* 안내 */}
      {scopeTab === "personal" && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "10px 16px" }}>
          <p style={{ fontSize: 12, color: "#7C3AED", margin: 0 }}>
            👤 개인 반복 업무는 나만 볼 수 있습니다. 매주 보고서 작성, 정기 점검 등 개인 루틴을 등록하세요.
          </p>
        </div>
      )}

      {/* 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
            <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 6 }}>
              {scopeTab === "team" ? "팀 반복 업무가 없습니다" : "개인 반복 업무가 없습니다"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
              {scopeTab === "team"
                ? "주간 회의, 월간 보고서 등 팀 공통 업무를 등록하세요"
                : "개인 루틴 업무를 등록하면 자동으로 업무가 생성됩니다"}
            </p>
            <button onClick={() => { setForm(f => ({ ...f, scope: scopeTab })); setShowForm(true); }}
              style={{ padding: "7px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              + 반복 업무 추가
            </button>
          </div>
        ) : displayed.map(item => <RecurringCard key={item.id} item={item} />)}
      </div>

      {/* 추가 폼 모달 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}
          onClick={() => setShowForm(false)}>
          <div style={{ width: "100%", maxWidth: 460, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>반복 업무 추가</h2>
              <button onClick={() => setShowForm(false)} style={{ fontSize: 18, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 팀/개인 선택 */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 6 }}>유형</label>
                <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  {[{ v: "team", l: "🏢 팀" }, { v: "personal", l: "👤 개인" }].map(({ v, l }) => (
                    <button key={v} onClick={() => set("scope", v)}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: form.scope === v ? "var(--bg-2)" : "transparent", color: form.scope === v ? "var(--text-1)" : "var(--text-3)" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>업무명 *</label>
                <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
                  placeholder="예: 주간 회의 준비, 월간 보고서 작성"
                  style={FS} autoFocus />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>반복 주기</label>
                  <select value={form.frequency} onChange={e => set("frequency", e.target.value)} style={FS}>
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </div>
                {form.frequency === "weekly" && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>요일</label>
                    <select value={form.day_of_week} onChange={e => set("day_of_week", Number(e.target.value))} style={FS}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                    </select>
                  </div>
                )}
                {form.frequency === "monthly" && (
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>날짜</label>
                    <select value={form.day_of_month} onChange={e => set("day_of_month", Number(e.target.value))} style={FS}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>유형</label>
                  <select value={form.task_type} onChange={e => set("task_type", e.target.value)} style={FS}>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>우선순위</label>
                  <select value={form.priority} onChange={e => set("priority", e.target.value)} style={FS}>
                    <option value="low">낮음</option>
                    <option value="medium">보통</option>
                    <option value="high">높음</option>
                    <option value="urgent">긴급</option>
                  </select>
                </div>
              </div>

              {/* 팀 업무일 때만 담당자 선택 */}
              {form.scope === "team" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>담당자</label>
                    <select value={form.assignee_id} onChange={e => set("assignee_id", e.target.value)} style={FS}>
                      <option value="">미정</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>프로젝트</label>
                    <select value={form.project_id} onChange={e => set("project_id", e.target.value)} style={FS}>
                      <option value="">없음</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 개인 업무일 때 프로젝트만 선택 */}
              {form.scope === "personal" && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>프로젝트 (선택)</label>
                  <select value={form.project_id} onChange={e => set("project_id", e.target.value)} style={FS}>
                    <option value="">없음</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: "8px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={save} disabled={!form.title.trim()}
                  style={{ padding: "8px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !form.title.trim() ? 0.4 : 1 }}>
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
