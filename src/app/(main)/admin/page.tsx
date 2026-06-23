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
  background: "var(--bg-3)", border: "1px solid var(--border-2)",
  color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none", colorScheme: "dark" as const,
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
  const [tab, setTab] = useState<"profile" | "tasks">("profile");
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNoteTaskId, setAddingNoteTaskId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");

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
      .select("id, title, status, due_date, created_at, project:projects(name)")
      .or(`assignee_id.eq.${userId},assignee_ids.cs.{${userId}}`)
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

  async function addTaskNote(taskId: string) {
    if (!newNote.trim()) return;
    await supabase.from("task_admin_notes").insert({
      task_id: taskId, note: newNote.trim(), created_by: myUserId,
    });
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

  const ROLE_COLOR: Record<string, string> = {
    admin: "#f87171", leader: "#fbbf24", member: "#60a5fa", reviewer: "#a78bfa",
  };
  const STATUS_COLOR: Record<string, string> = {
    backlog: "#4A7099", todo: "#7BA7C8", doing: "#2E86FF", blocked: "#f87171", review: "#fbbf24", done: "#34d399",
  };
  const STATUS_LABEL: Record<string, string> = {
    backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰", done: "완료",
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "#f87171" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>팀원 프로필 관리</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>Admin 전용</span>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* 팀원 목록 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold px-1" style={{ color: "var(--text-3)" }}>팀원 선택</p>
          {users.map(u => {
            const hasProfile = !!profiles[u.id];
            const roleColor = ROLE_COLOR[u.role] ?? "var(--text-3)";
            return (
              <button key={u.id} onClick={() => selectUser(u)}
                className="w-full rounded-xl px-4 py-3 text-left transition-all"
                style={{
                  background: selectedUser?.id === u.id ? "var(--bg-4)" : "var(--bg-2)",
                  border: `1px solid ${selectedUser?.id === u.id ? "var(--border-2)" : "var(--border)"}`,
                }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{u.name}</p>
                  {hasProfile && <span style={{ fontSize: 10, color: "var(--cyan)" }}>●</span>}
                </div>
                <span className="text-xs" style={{ color: roleColor }}>{u.role}</span>
              </button>
            );
          })}
        </div>

        {/* 프로필 편집 */}
        {selectedUser ? (
          <div className="col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: "var(--bg-4)", color: "var(--text-1)" }}>
                  {selectedUser.name[0]}
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: "var(--text-1)" }}>{selectedUser.name}</p>
                  <p className="text-xs" style={{ color: ROLE_COLOR[selectedUser.role] ?? "var(--text-3)" }}>{selectedUser.role}</p>
                </div>
              </div>
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                {(["profile", "tasks"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="rounded-lg px-4 py-1.5 text-xs font-medium transition-all"
                    style={{ background: tab === t ? "var(--bg-4)" : "transparent", color: tab === t ? "var(--text-1)" : "var(--text-3)", border: tab === t ? "1px solid var(--border-2)" : "1px solid transparent" }}>
                    {t === "profile" ? "프로필" : `업무 노트 (${userTasks.length})`}
                  </button>
                ))}
              </div>
            </div>

            {tab === "profile" && (
              <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-3)" }}>💪 강점</label>
                    <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                      placeholder="예: 꼼꼼한 실행력, 기술 문서화 능숙, 마감 준수율 높음"
                      rows={3} style={{ ...FS, resize: "none" }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-3)" }}>🎯 업무 스타일</label>
                    <textarea value={form.work_style} onChange={e => setForm(f => ({ ...f, work_style: e.target.value }))}
                      placeholder="예: 빠른 실행 선호, 병렬 업무 처리 능숙, 단독 작업보다 협업에 강함"
                      rows={3} style={{ ...FS, resize: "none" }} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-3)" }}>✅ 선호 업무 유형</label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_TYPES.map(wt => (
                      <button key={wt.value} onClick={() => toggleType(wt.value)}
                        className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                        style={{
                          background: form.preferred_types.includes(wt.value) ? "rgba(34,211,238,0.15)" : "var(--bg-3)",
                          color: form.preferred_types.includes(wt.value) ? "var(--cyan)" : "var(--text-3)",
                          border: `1px solid ${form.preferred_types.includes(wt.value) ? "var(--cyan)44" : "var(--border)"}`,
                        }}>
                        {wt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-3)" }}>⚠ 주의사항</label>
                  <textarea value={form.cautions} onChange={e => setForm(f => ({ ...f, cautions: e.target.value }))}
                    placeholder="예: 복잡한 기획 업무에서 진행 속도 저하, 멀티태스킹 시 집중도 분산"
                    rows={2} style={{ ...FS, resize: "none" }} />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-3)" }}>🔒 비공개 메모 (Admin만 열람)</label>
                  <textarea value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                    placeholder="자유롭게 관찰한 내용, 피드백 히스토리, 개인적 특이사항 등"
                    rows={4} style={{ ...FS, resize: "none", borderColor: "rgba(248,113,113,0.3)" }} />
                </div>

                <div className="flex justify-end">
                  <button onClick={saveProfile} disabled={saving}
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, var(--cyan), #2E86FF)", color: "#fff" }}>
                    {saving ? "저장 중…" : "저장"}
                  </button>
                </div>
              </div>
            )}

            {tab === "tasks" && (
              <div className="space-y-3">
                {userTasks.length === 0 ? (
                  <div className="rounded-2xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border)" }}>
                    <p className="text-sm" style={{ color: "var(--text-3)" }}>담당 업무가 없습니다</p>
                  </div>
                ) : userTasks.map(task => {
                  const sc = STATUS_COLOR[task.status] ?? "#7BA7C8";
                  const notes = taskNotes[task.id] ?? [];
                  const isAdding = addingNoteTaskId === task.id;
                  return (
                    <div key={task.id} className="rounded-2xl p-4 space-y-3"
                      style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderLeft: `3px solid ${sc}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded font-medium"
                              style={{ background: `${sc}18`, color: sc }}>
                              {STATUS_LABEL[task.status] ?? task.status}
                            </span>
                            {task.project?.name && (
                              <span className="text-xs" style={{ color: "var(--text-3)" }}>{task.project.name}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{task.title}</p>
                        </div>
                        <button onClick={() => { setAddingNoteTaskId(isAdding ? null : task.id); setNewNote(""); }}
                          className="rounded-lg px-3 py-1.5 text-xs shrink-0"
                          style={{ background: isAdding ? "var(--bg-4)" : "var(--bg-3)", color: "var(--cyan)", border: "1px solid var(--border)" }}>
                          {isAdding ? "취소" : "+ 노트"}
                        </button>
                      </div>

                      {/* 노트 입력 */}
                      {isAdding && (
                        <div className="space-y-2">
                          <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                            placeholder="이 업무에 대한 관찰 내용, 퍼포먼스 메모 등 (Admin만 볼 수 있습니다)"
                            rows={2} autoFocus
                            style={{ ...FS, resize: "none", fontSize: 12, borderColor: "rgba(248,113,113,0.3)" }} />
                          <button onClick={() => addTaskNote(task.id)} disabled={!newNote.trim()}
                            className="rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-40"
                            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                            🔒 저장
                          </button>
                        </div>
                      )}

                      {/* 기존 노트 */}
                      {notes.length > 0 && (
                        <div className="space-y-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                          {notes.map((n: any) => (
                            <div key={n.id} className="flex items-start gap-2">
                              <div className="flex-1 rounded-lg px-3 py-2"
                                style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                                <p className="text-xs" style={{ color: "var(--text-2)" }}>{n.note}</p>
                                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                                  🔒 {new Date(n.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <button onClick={() => deleteNote(n.id)}
                                className="text-xs shrink-0 mt-1" style={{ color: "#f87171" }}>✕</button>
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
          <div className="col-span-3 flex items-center justify-center rounded-2xl"
            style={{ background: "var(--bg-2)", border: "1px dashed var(--border)", minHeight: 300 }}>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>좌측에서 팀원을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
