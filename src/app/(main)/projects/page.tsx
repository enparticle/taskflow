// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import ProjectForm from "@/components/projects/ProjectForm";

const HEALTH_CONFIG = {
  good:      { label: "정상",     color: "#16A34A" },
  reviewing: { label: "검토",     color: "#2563EB" },
  at_risk:   { label: "주의",     color: "#D97706" },
  critical:  { label: "위험",     color: "#DC2626" },
  suspended: { label: "중단",     color: "#A8A8A4" },
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
    const [{ data: active }, { data: completed }, { data: { user } }] = await Promise.all([
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id,status)").eq("status", "active").order("created_at"),
      supabase.from("projects").select("*, owner:users!projects_owner_id_fkey(name), tasks(id,status)").eq("status", "completed").order("end_date", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setActiveProjects(active ?? []);
    setCompletedProjects(completed ?? []);
    if (user) {
      const { data: u } = await supabase.from("users").select("role").eq("auth_id", user.id).single();
      setSysRole(u?.role ?? "");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = sysRole === "admin" || sysRole === "leader";

  async function reactivate(p: any) {
    if (!confirm(`"${p.name}"을 다시 활성화할까요?`)) return;
    await supabase.from("projects").update({ status: "active" }).eq("id", p.id);
    load();
  }

  function ProjectCard({ p, completed = false }: { p: any; completed?: boolean }) {
    const tasks = p.tasks ?? [];
    const total = tasks.length;
    const done = tasks.filter((t: any) => t.status === "done").length;
    const doing = tasks.filter((t: any) => t.status === "doing").length;
    const blocked = tasks.filter((t: any) => t.status === "blocked").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.good;
    const now = new Date();
    const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / 86400000) : null;

    return (
      <div style={{
        background: "var(--bg-2)", border: `1px solid ${completed ? "var(--border)" : `${hc.color}33`}`,
        borderRadius: 12, padding: 20, opacity: completed ? 0.85 : 1, transition: "border-color 0.15s",
      }}
        onMouseEnter={e => { if (!completed) (e.currentTarget as HTMLDivElement).style.borderColor = `${hc.color}66`; }}
        onMouseLeave={e => { if (!completed) (e.currentTarget as HTMLDivElement).style.borderColor = `${hc.color}33`; }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 배지 행 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              {completed ? (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>완료</span>
              ) : (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: `${hc.color}12`, color: hc.color, border: `1px solid ${hc.color}33` }}>{hc.label}</span>
              )}
              {p.owner?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.owner.name}</span>}
              {p.end_date && (
                <span style={{ fontSize: 11, color: daysLeft !== null && daysLeft < 0 ? "#DC2626" : "var(--text-3)" }}>
                  {completed ? "완료일" : "마감"} · {new Date(p.end_date).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                  {!completed && daysLeft !== null && (
                    <span style={{ marginLeft: 4, fontWeight: 600, color: daysLeft < 0 ? "#DC2626" : daysLeft <= 7 ? "#D97706" : "var(--text-3)" }}>
                      ({daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : `D-${daysLeft}`})
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* 프로젝트명 */}
            <a href={`/projects/${p.id}`}
              style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-1)"; }}>
              {p.name}
            </a>
            {p.description && <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.description}</p>}
          </div>

          {/* 버튼 */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {completed && canManage && (
              <button onClick={() => reactivate(p)}
                style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "var(--bg-3)", color: "var(--cyan)", border: "1px solid var(--border)", cursor: "pointer" }}>
                재활성화
              </button>
            )}
            {!completed && canManage && (
              <button onClick={() => { setEditProject(p); setShowForm(true); }}
                style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)", cursor: "pointer" }}>
                수정
              </button>
            )}
          </div>
        </div>

        {/* 진행률 바 */}
        {total > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "전체", value: total, color: "var(--text-3)" },
                  { label: "진행", value: doing, color: "#2563EB" },
                  { label: "완료", value: done, color: "#16A34A" },
                  ...(blocked > 0 ? [{ label: "Blocked", value: blocked, color: "#DC2626" }] : []),
                ].map((s, i) => (
                  <span key={i} style={{ fontSize: 11, color: s.color }}>
                    {s.label} <b>{s.value}</b>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? "#16A34A" : "var(--text-2)" }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#16A34A" : hc.color, borderRadius: 2, transition: "width 0.5s" }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>프로젝트</h1>
        </div>
        {canManage && (
          <button onClick={() => { setEditProject(null); setShowForm(true); }}
            style={{ padding: "8px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            + 새 프로젝트
          </button>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, width: "fit-content" }}>
        {[{ v: "active", l: "진행 중", count: activeProjects.length }, { v: "completed", l: "완료", count: completedProjects.length }].map(({ v, l, count }) => (
          <button key={v} onClick={() => setTab(v as any)}
            style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: tab === v ? "var(--bg-4)" : "transparent",
              color: tab === v ? "var(--text-1)" : "var(--text-3)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {l}
            <span style={{ fontSize: 10, fontWeight: 600, background: tab === v ? "var(--border)" : "transparent", padding: "1px 6px", borderRadius: 8, color: tab === v ? "var(--text-2)" : "var(--text-3)" }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tab === "active" && (
          activeProjects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: "var(--text-3)" }}>진행 중인 프로젝트가 없습니다</p>
              {canManage && (
                <button onClick={() => { setEditProject(null); setShowForm(true); }}
                  style={{ marginTop: 12, padding: "7px 16px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                  + 새 프로젝트
                </button>
              )}
            </div>
          ) : activeProjects.map(p => <ProjectCard key={p.id} p={p} />)
        )}
        {tab === "completed" && (
          completedProjects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: "var(--text-3)" }}>완료된 프로젝트가 없습니다</p>
            </div>
          ) : completedProjects.map(p => <ProjectCard key={p.id} p={p} completed />)
        )}
      </div>

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
