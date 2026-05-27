// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import ProjectForm from "@/components/projects/ProjectForm";

const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#34d399" },
  reviewing: { label: "검토 필요", color: "#60a5fa" },
  at_risk:   { label: "주의",     color: "#fbbf24" },
  critical:  { label: "위험",     color: "#f87171" },
  suspended: { label: "중단",     color: "#71717a" },
};

export default function ProjectsPage() {
  const supabase = createClient();
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [completedProjects, setCompletedProjects] = useState<any[]>([]);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [sysRole, setSysRole] = useState<string>("");

  const load = useCallback(async () => {
    const { data: active } = await supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name), tasks(id,status)")
      .eq("status", "active").order("created_at");
    setActiveProjects(active ?? []);

    const { data: completed } = await supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name), tasks(id,status)")
      .eq("status", "completed").order("end_date", { ascending: false });
    setCompletedProjects(completed ?? []);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: u } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
      setSysRole(u?.role ?? "");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = sysRole === "admin" || sysRole === "leader";

  async function reactivate(project: any) {
    if (!confirm(`"${project.name}"을 다시 활성화할까요?`)) return;
    await supabase.from("projects").update({ status: "active" }).eq("id", project.id);
    load();
  }

  function ProjectCard({ p, completed = false }: { p: any; completed?: boolean }) {
    const total = p.tasks?.length ?? 0;
    const done = (p.tasks ?? []).filter((t: any) => t.status === "done").length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.good;

    const doing = (p.tasks ?? []).filter((t: any) => t.status === "doing").length;
    const blocked = (p.tasks ?? []).filter((t: any) => t.status === "blocked").length;
    return (
      <div className="rounded-2xl p-5 transition-all"
        style={{ background: "var(--bg-2)", border: `1px solid ${completed ? "var(--border)" : `${hc.color}33`}`, opacity: completed ? 0.85 : 1 }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {!completed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${hc.color}18`, color: hc.color }}>{hc.label}</span>
              )}
              {completed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>✓ 완료</span>
              )}
              {p.owner?.name && (
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{p.owner.name}</span>
              )}
              {p.end_date && (
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  {completed ? "완료일" : "마감"} · {new Date(p.end_date).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <a href={`/projects/${p.id}`} className="text-base font-bold hover:underline"
              style={{ color: "var(--text-1)" }}>{p.name}</a>
            {p.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-2)" }}>{p.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {completed && canManage && (
              <button onClick={() => reactivate(p)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-3)", color: "var(--cyan)", border: "1px solid var(--border)" }}>
                재활성화
              </button>
            )}
            {!completed && canManage && (
              <button onClick={() => { setEditProject(p); setShowForm(true); }}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                수정
              </button>
            )}
          </div>
        </div>
        {/* 업무 현황 카운트 */}
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: "전체",    value: total,   color: "var(--text-3)" },
            { label: "진행 중", value: doing,   color: "#2E86FF" },
            { label: "완료",    value: done,    color: "#34d399" },
            ...(blocked > 0 ? [{ label: "Blocked", value: blocked, color: "#f87171" }] : []),
          ].map((s, i) => (
            <span key={i} className="text-xs" style={{ color: s.color }}>
              {s.label} <span className="font-bold tabular-nums">{s.value}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>프로젝트</h1>
        </div>
        {canManage && (
          <button onClick={() => { setEditProject(null); setShowForm(true); }}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, var(--cyan), #2E86FF)", color: "#fff" }}>
            + 새 프로젝트
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <button onClick={() => setTab("active")}
          className="rounded-lg px-4 py-1.5 text-xs font-medium transition-all"
          style={{ background: tab === "active" ? "var(--bg-4)" : "transparent", color: tab === "active" ? "var(--text-1)" : "var(--text-3)", border: tab === "active" ? "1px solid var(--border-2)" : "1px solid transparent" }}>
          진행 중 {activeProjects.length}
        </button>
        <button onClick={() => setTab("completed")}
          className="rounded-lg px-4 py-1.5 text-xs font-medium transition-all"
          style={{ background: tab === "completed" ? "var(--bg-4)" : "transparent", color: tab === "completed" ? "var(--text-1)" : "var(--text-3)", border: tab === "completed" ? "1px solid var(--border-2)" : "1px solid transparent" }}>
          완료 {completedProjects.length}
        </button>
      </div>

      {/* 진행 중 프로젝트 */}
      {tab === "active" && (
        <div className="space-y-3">
          {activeProjects.length === 0 ? (
            <div className="rounded-2xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>진행 중인 프로젝트가 없습니다</p>
            </div>
          ) : activeProjects.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>
      )}

      {/* 완료 프로젝트 */}
      {tab === "completed" && (
        <div className="space-y-3">
          {completedProjects.length === 0 ? (
            <div className="rounded-2xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>완료된 프로젝트가 없습니다</p>
            </div>
          ) : completedProjects.map(p => <ProjectCard key={p.id} p={p} completed />)}
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editProject}
          onClose={() => { setShowForm(false); setEditProject(null); }}
          onSaved={() => { setShowForm(false); setEditProject(null); load(); }}
        />
      )}
    </div>
  );
}
