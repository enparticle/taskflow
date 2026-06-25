// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const WORK_TYPES = [
  { value: "planning",      label: "기획" },
  { value: "development",   label: "개발" },
  { value: "design",        label: "디자인" },
  { value: "operation",     label: "운영" },
  { value: "documentation", label: "문서화" },
  { value: "meeting",       label: "미팅" },
  { value: "research",      label: "리서치" },
  { value: "qa",            label: "QA" },
  { value: "customer",      label: "고객 대응" },
];

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
};

const STATUS_COLOR: Record<string, string> = {
  backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB",
  blocked: "#DC2626", review: "#D97706", done: "#16A34A",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중",
  blocked: "Blocked", review: "리뷰", done: "완료",
};
const ROLE_COLOR: Record<string, string> = {
  admin: "#DC2626", leader: "#D97706", member: "#2563EB", reviewer: "#7C3AED",
};

export default function AdminMembersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, any[]>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState({ strengths: "", work_style: "", preferred_types: [] as string[], cautions: "", admin_notes: "" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "priority" | "notes">("profile");
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNoteTaskId, setAddingNoteTaskId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");
  const [prioritySaving, setPrioritySaving] = useState(false);

  const load = useCallback(async () => {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== "admin") { router.push("/dashboard"); return; }
    setMyUserId(authUser.userId);
    const { data: u } = await supabase.from("users").select("id, name, role").eq("is_active", true).neq("role", "viewer").order("name");
    setUsers(u ?? []);
    const { data: p } = await supabase.from("member_profiles").select("*");
    const pm: Record<string, any> = {};
    (p ?? []).forEach((x: any) => { pm[x.user_id] = x; });
    setProfiles(pm);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectUser(user: any) {
    setSelectedUser(user);
    const p = profiles[user.id];
    setForm({
      strengths: p?.strengths ?? "",
      work_style: p?.work_style ?? "",
      preferred_types: p?.preferred_types ?? [],
      cautions: p?.cautions ?? "",
      admin_notes: p?.admin_notes ?? "",
    });
    setTab("profile");
    loadUserTasks(user.id);
  }

  async function loadUserTasks(userId: string) {
    const { data: tasks } = await supabase.from("tasks")
      .select("id, title, status, due_date, priority_order, priority_note, project:projects(name)")
      .or(`assignee_id.eq.${userId},assignee_ids.cs.{${userId}}`)
      .neq("status", "done")
      .order("priority_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setUserTasks(tasks ?? []);

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t: any) => t.id);
      const { data: notes } = await supabase.from("task_admin_notes")
        .select("*").in("task_id", taskIds).order("created_at", { ascending: false });
      const nm: Record<string, any[]> = {};
      (notes ?? []).forEach((n: any) => {
        if (!nm[n.task_id]) nm[n.task_id] = [];
        nm[n.task_id].push(n);
      });
      setTaskNotes(nm);
    }
  }

  async function saveProfile() {
    if (!selectedUser) return;
    setSaving(true);
    const existing = profiles[selectedUser.id];
    const payload = { user_id: selectedUser.id, ...form, updated_at: new Date().toISOString() };
    if (existing) {
      await supabase.from("member_profiles").update(payload).eq("user_id", selectedUser.id);
    } else {
      await supabase.from("member_profiles").insert(payload);
    }
    setSaving(false);
    await load();
    setProfiles(prev => ({ ...prev, [selectedUser.id]: { ...prev[selectedUser.id], ...payload } }));
  }

  async function setPriorityOrder(taskId: string, order: number | null) {
    await supabase.from("tasks").update({
      priority_order: order,
      priority_set_by: myUserId,
      priority_set_at: new Date().toISOString(),
    }).eq("id", taskId);
    await loadUserTasks(selectedUser.id);
  }

  async function setPriorityNote(taskId: string, note: string) {
    await supabase.from("tasks").update({ priority_note: note || null }).eq("id", taskId);
    setUserTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority_note: note } : t));
  }

  async function clearAllPriorities() {
    if (!confirm("이 팀원의 모든 우선순위를 초기화할까요?")) return;
    setPrioritySaving(true);
    const taskIds = userTasks.filter(t => t.priority_order !== null).map(t => t.id);
    for (const id of taskIds) {
      await supabase.from("tasks").update({ priority_order: null, priority_note: null }).eq("id", id);
    }
    await loadUserTasks(selectedUser.id);
    setPrioritySaving(false);
  }

  async function addTaskNote(taskId: string) {
    if (!newNote.trim()) return;
    await supabase.from("task_admin_notes").insert({ task_id: taskId, note: newNote.trim(), created_by: myUserId });
    setNewNote(""); setAddingNoteTaskId(null);
    await loadUserTasks(selectedUser.id);
  }

  async function deleteNote(noteId: string) {
    if (!confirm("노트를 삭제할까요?")) return;
    await supabase.from("task_admin_notes").delete().eq("id", noteId);
    await loadUserTasks(selectedUser.id);
  }

  function toggleType(type: string) {
    setForm(f => ({
      ...f,
      preferred_types: f.preferred_types.includes(type)
        ? f.preferred_types.filter(t => t !== type)
        : [...f.preferred_types, type],
    }));
  }

  // 우선순위 지정된 업무 / 미지정 업무 분리
  const prioritized = userTasks.filter(t => t.priority_order !== null).sort((a, b) => a.priority_order - b.priority_order);
  const unset = userTasks.filter(t => t.priority_order === null);

  return (
    <div style={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 18, background: "#DC2626", borderRadius: 2 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>팀원 프로필 관리</h1>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>Admin 전용</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>

        {/* 팀원 목록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4 }}>팀원 선택</p>
          {users.map(u => {
            const hasProfile = !!profiles[u.id];
            const roleColor = ROLE_COLOR[u.role] ?? "var(--text-3)";
            const hasPriority = userTasks.some(t => t.priority_order !== null) && selectedUser?.id === u.id;
            return (
              <button key={u.id} onClick={() => selectUser(u)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                  background: selectedUser?.id === u.id ? "var(--bg-4)" : "var(--bg-2)",
                  border: `1px solid ${selectedUser?.id === u.id ? "var(--border-2)" : "var(--border)"}`,
                }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{u.name}</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {hasProfile && <span style={{ fontSize: 9, color: "var(--cyan)" }}>●</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: roleColor }}>{u.role}</span>
              </button>
            );
          })}
        </div>

        {/* 오른쪽 편집 영역 */}
        {selectedUser ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 유저 헤더 + 탭 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                  {selectedUser.name[0]}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{selectedUser.name}</p>
                  <p style={{ fontSize: 11, color: ROLE_COLOR[selectedUser.role] ?? "var(--text-3)", margin: 0 }}>{selectedUser.role}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                {([
                  { id: "profile", label: "프로필" },
                  { id: "priority", label: `🎯 우선순위 ${prioritized.length > 0 ? `(${prioritized.length})` : ""}` },
                  { id: "notes", label: `📝 업무 노트 (${userTasks.length})` },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{
                      padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                      border: "none", cursor: "pointer", transition: "all 0.15s",
                      background: tab === t.id ? "var(--bg-4)" : "transparent",
                      color: tab === t.id ? "var(--text-1)" : "var(--text-3)",
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 프로필 탭 */}
            {tab === "profile" && (
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>💪 강점</label>
                    <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                      placeholder="예: 꼼꼼한 실행력, 기술 문서화 능숙, 마감 준수율 높음"
                      rows={3} style={{ ...FS, resize: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>🎯 업무 스타일</label>
                    <textarea value={form.work_style} onChange={e => setForm(f => ({ ...f, work_style: e.target.value }))}
                      placeholder="예: 빠른 실행 선호, 병렬 업무 처리 능숙"
                      rows={3} style={{ ...FS, resize: "none" }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>✅ 선호 업무 유형</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {WORK_TYPES.map(wt => (
                      <button key={wt.value} onClick={() => toggleType(wt.value)}
                        style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                          background: form.preferred_types.includes(wt.value) ? "var(--cyan-bg)" : "var(--bg-3)",
                          color: form.preferred_types.includes(wt.value) ? "var(--cyan)" : "var(--text-3)",
                          border: `1px solid ${form.preferred_types.includes(wt.value) ? "#BFDBFE" : "var(--border)"}`,
                        }}>
                        {wt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>⚠ 주의사항</label>
                  <textarea value={form.cautions} onChange={e => setForm(f => ({ ...f, cautions: e.target.value }))}
                    placeholder="예: 복잡한 기획 업무에서 진행 속도 저하"
                    rows={2} style={{ ...FS, resize: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 6 }}>🔒 비공개 메모 (Admin만 열람)</label>
                  <textarea value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                    placeholder="관찰 내용, 피드백 히스토리 등"
                    rows={4} style={{ ...FS, resize: "none", borderColor: "rgba(220,38,38,0.3)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={saveProfile} disabled={saving}
                    style={{ padding: "8px 24px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.4 : 1 }}>
                    {saving ? "저장 중…" : "저장"}
                  </button>
                </div>
              </div>
            )}

            {/* 우선순위 탭 */}
            {tab === "priority" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "#EEF3FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 12, color: "#2563EB", margin: 0, lineHeight: 1.6 }}>
                    <b>사용 방법</b> — 업무에 순서 번호를 입력하면 해당 팀원 홈 화면에 "🎯 이번 주 집중 업무"로 표시됩니다.<br/>
                    메모를 입력하면 팀원에게 이유나 지시사항을 전달할 수 있습니다.
                  </p>
                </div>

                {/* 우선순위 지정된 업무 */}
                {prioritized.length > 0 && (
                  <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#EEF3FF", borderBottom: "1px solid #BFDBFE" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", margin: 0 }}>🎯 우선순위 지정됨 ({prioritized.length}건)</p>
                      <button onClick={clearAllPriorities} disabled={prioritySaving}
                        style={{ fontSize: 11, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer" }}>
                        전체 초기화
                      </button>
                    </div>
                    {prioritized.map((task, idx) => {
                      const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                      return (
                        <div key={task.id} style={{ padding: "12px 16px", borderBottom: idx < prioritized.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {/* 순서 번호 */}
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cyan)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                              {task.priority_order}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                                  {STATUS_LABEL[task.status]}
                                </span>
                                {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                              </div>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: "0 0 6px" }}>{task.title}</p>
                              <input
                                value={task.priority_note ?? ""}
                                onChange={e => setPriorityNote(task.id, e.target.value)}
                                placeholder="팀원에게 전달할 메모 (선택)"
                                style={{ ...FS, fontSize: 11, padding: "4px 8px", width: "100%", background: "var(--bg-3)", borderColor: "#BFDBFE" }}
                              />
                            </div>
                            {/* 순서 변경 + 제거 */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                              <input type="number" min="1" max="99"
                                value={task.priority_order ?? ""}
                                onChange={e => setPriorityOrder(task.id, e.target.value ? parseInt(e.target.value) : null)}
                                style={{ ...FS, width: 52, padding: "4px 6px", textAlign: "center", fontSize: 13 }}
                              />
                              <button onClick={() => setPriorityOrder(task.id, null)}
                                style={{ fontSize: 10, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}>
                                제거
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 미지정 업무 */}
                <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>
                      미지정 업무 ({unset.length}건) — 순서 번호를 입력해 우선순위 지정
                    </p>
                  </div>
                  {unset.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>모든 업무에 우선순위가 지정됐습니다</p>
                  ) : unset.map((task, idx) => {
                    const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                    return (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: idx < unset.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                              {STATUS_LABEL[task.status]}
                            </span>
                            {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                            {task.due_date && <span style={{ fontSize: 11, color: "var(--text-3)" }}>D-{Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000)}</span>}
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                        </div>
                        <input type="number" min="1" max="99"
                          placeholder="순서"
                          onBlur={e => { if (e.target.value) setPriorityOrder(task.id, parseInt(e.target.value)); }}
                          onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value) setPriorityOrder(task.id, parseInt((e.target as HTMLInputElement).value)); }}
                          style={{ ...FS, width: 64, padding: "5px 8px", textAlign: "center", fontSize: 13, flexShrink: 0 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 업무 노트 탭 */}
            {tab === "notes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {userTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>담당 업무가 없습니다</p>
                  </div>
                ) : userTasks.map(task => {
                  const sc = STATUS_COLOR[task.status] ?? "#A8A8A4";
                  const notes = taskNotes[task.id] ?? [];
                  const isAdding = addingNoteTaskId === task.id;
                  return (
                    <div key={task.id} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${sc}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sc}12`, color: sc, fontWeight: 600 }}>
                              {STATUS_LABEL[task.status]}
                            </span>
                            {task.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{task.project.name}</span>}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                        </div>
                        <button onClick={() => { setAddingNoteTaskId(isAdding ? null : task.id); setNewNote(""); }}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: isAdding ? "var(--bg-4)" : "var(--bg-3)", color: "var(--cyan)", border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0 }}>
                          {isAdding ? "취소" : "+ 노트"}
                        </button>
                      </div>
                      {isAdding && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                          <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                            placeholder="이 업무에 대한 관찰 내용 (Admin만 볼 수 있습니다)" rows={2} autoFocus
                            style={{ ...FS, resize: "none", fontSize: 12, borderColor: "rgba(220,38,38,0.3)" }} />
                          <button onClick={() => addTaskNote(task.id)} disabled={!newNote.trim()}
                            style={{ padding: "5px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, fontSize: 11, fontWeight: 600, color: "#DC2626", cursor: "pointer", width: "fit-content", opacity: !newNote.trim() ? 0.4 : 1 }}>
                            🔒 저장
                          </button>
                        </div>
                      )}
                      {notes.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                          {notes.map((n: any) => (
                            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ flex: 1, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, padding: "7px 10px" }}>
                                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{n.note}</p>
                                <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0" }}>
                                  🔒 {new Date(n.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <button onClick={() => deleteNote(n.id)} style={{ fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer", marginTop: 2 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12, minHeight: 300 }}>
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>좌측에서 팀원을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
