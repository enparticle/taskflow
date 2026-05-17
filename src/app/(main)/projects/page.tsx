// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import ProjectForm from "@/components/projects/ProjectForm";
import { getAuthUser } from "@/lib/auth";

const HEALTH = {
  good:      { label: "정상",     color: "#34d399", bg: "rgba(52,211,153,0.10)" },
  reviewing: { label: "검토 필요", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
  at_risk:   { label: "주의",     color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
  critical:  { label: "위험",     color: "#f87171", bg: "rgba(248,113,113,0.10)" },
  suspended: { label: "중단",     color: "#71717a", bg: "rgba(113,113,122,0.10)" },
};

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [openForm, setOpenForm] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string>("");
  const [myProjectRoles, setMyProjectRoles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const authUser = await getAuthUser();
    if (authUser) {
      setIsAdmin(authUser.role === "admin");
      setMyUserId(authUser.userId);
    }
    const { data } = await supabase
      .from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name)")
      .eq("status", "active")
      .order("created_at");
    setProjects(data ?? []);

    // 각 프로젝트에서 내 역할 확인
    if (data && myUserId) {
      const { data: myMemberships } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", myUserId);
      const roleMap: Record<string, string> = {};
      (myMemberships ?? []).forEach((m: any) => { roleMap[m.project_id] = m.role; });
      setMyProjectRoles(roleMap);
    }

    if (data) {
      const counts: Record<string, { total: number; done: number }> = {};
      await Promise.all(data.map(async (p: any) => {
        const [{ count: total }, { count: done }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("project_id", p.id),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("project_id", p.id).eq("status", "done"),
        ]);
        counts[p.id] = { total: total ?? 0, done: done ?? 0 };
      }));
      setTaskCounts(counts);
    }
  }, [myUserId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>프로젝트</h1>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>{projects.length}</span>
        </div>
        {isAdmin && (
          <button onClick={() => setOpenForm(true)}
            className="rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff",
              boxShadow: "0 0 16px rgba(0,194,204,0.25)" }}>
            + 새 프로젝트
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p: any) => {
          const h = HEALTH[p.health as keyof typeof HEALTH] ?? HEALTH.good;
          const counts = taskCounts[p.id] ?? { total: 0, done: 0 };
          const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
          return (
            <div key={p.id} className="rounded-xl p-5 transition-all"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>

              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/projects/${p.id}`}
                  className="font-semibold text-sm hover:underline"
                  style={{ color: "var(--text-1)" }}>
                  {p.name}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{ background: h.bg, color: h.color }}>{h.label}</span>
                  {(isAdmin || myProjectRoles[p.id] === "leader") && (
                    <button onClick={() => setEditProject(p)}
                      className="text-xs px-2 py-0.5 rounded-md transition-all"
                      style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
                      수정
                    </button>
                  )}
                </div>
              </div>

              {p.description && (
                <p className="text-xs mb-3" style={{ color: "var(--text-2)" }}>{p.description}</p>
              )}

              {/* 진행률 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>진행률</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: h.color }}>{pct}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-4)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: h.color, boxShadow: `0 0 4px ${h.color}88` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    {counts.done}/{counts.total} 완료
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    담당 · {p.owner?.name ?? "미정"}
                  </span>
                </div>
                {p.end_date && (
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    ~{new Date(p.end_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>

              <Link href={`/projects/${p.id}`}
                className="mt-3 flex items-center justify-center w-full py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)"; }}>
                상세 보기 →
              </Link>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="rounded-xl py-16 text-center"
          style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-2)" }}>프로젝트가 없습니다</p>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>새 프로젝트를 추가해보세요</p>
        </div>
      )}

      {openForm && (
        <ProjectForm
          onClose={() => setOpenForm(false)}
          onSaved={() => { load(); setOpenForm(false); }}
        />
      )}
      {editProject && (
        <ProjectForm
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={() => { load(); setEditProject(null); }}
        />
      )}
    </div>
  );
}
