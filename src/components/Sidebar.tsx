// @ts-nocheck
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import SearchModal from "@/components/SearchModal";
import TaskDetail from "@/components/tasks/TaskDetail";
import { createClient } from "@/lib/supabase";

const HEALTH_COLOR: Record<string, string> = {
  good: "#34d399", at_risk: "#fbbf24", critical: "#f87171",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState<string>("");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("id, name, health").eq("status", "active")
      .order("created_at").then(({ data }) => setProjects(data ?? []));
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
      if (data.user) {
        const { data: linked } = await supabase
          .from("users").select("name, role").eq("auth_id", data.user.id).single();
        if (linked) { setLinkedName(linked.name); setUserRole(linked.role ?? ""); }
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all"
        style={{
          background: active ? "var(--bg-4)" : "transparent",
          color: active ? "var(--text-1)" : "var(--text-2)",
          borderLeft: active ? "2px solid var(--cyan)" : "2px solid transparent",
        }}>
        <span className="w-4 text-center shrink-0" style={{ fontSize: 13 }}>{icon}</span>
        {label}
      </Link>
    );
  }

  function GroupLabel({ label }: { label: string }) {
    return (
      <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-2)", fontSize: 11, letterSpacing: "0.06em" }}>
        {label}
      </p>
    );
  }

  return (
    <>
      <aside className="flex w-60 shrink-0 flex-col"
        style={{ background: "var(--bg-2)", borderRight: "0.5px solid var(--border)" }}>

        {/* 로고 */}
        <div className="flex h-13 items-center gap-2 px-4 py-3"
          style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: "var(--cyan)" }} />
          <span className="text-sm font-semibold tracking-widest uppercase flex-1" style={{ color: "var(--text-1)" }}>
            Task<span style={{ color: "var(--cyan)" }}>Flow</span>
          </span>
          <button onClick={() => setShowSearch(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            aria-label="검색">
            🔍
          </button>
          <NotificationBell onTaskClick={id => setOpenDetail(id)} />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">

          {/* 업무 그룹 */}
          <GroupLabel label="업무" />
          <NavLink href="/dashboard" label="대시보드" icon="▦" />
          <NavLink href="/tasks" label="업무" icon="◎" />
          <NavLink href="/tree" label="업무 트리" icon="🌳" />
          {/* 칸반 보드 - 비활성화 (활성화하려면 아래 주석 해제)
          <NavLink href="/kanban" label="칸반 보드" icon="⊞" />
          */}

          {/* 프로젝트 그룹 */}
          <GroupLabel label="프로젝트" />
          <div className="flex items-center justify-between px-3 mb-1">
            <span style={{ fontSize: 10, color: "var(--text-3)" }} />
            <Link href="/projects" className="text-xs transition-colors"
              style={{ color: "var(--text-3)", fontSize: 10 }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)"; }}>
              전체 →
            </Link>
          </div>
          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`;
            const hColor = HEALTH_COLOR[p.health] ?? "#52525b";
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{
                  background: active ? "var(--bg-4)" : "transparent",
                  color: active ? "var(--text-1)" : "var(--text-2)",
                  borderLeft: active ? "2px solid var(--cyan)" : "2px solid transparent",
                }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hColor }} />
                <span className="truncate">{p.name}</span>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <p className="px-3 py-1 text-xs" style={{ color: "var(--text-3)" }}>프로젝트 없음</p>
          )}

          {/* AI 그룹 */}
          <GroupLabel label="AI" />
          <NavLink href="/project-assistant" label="프로젝트 등록" icon="✦" />
          <NavLink href="/meeting-note" label="회의록 분석" icon="📝" />

          {/* 분석 그룹 */}
          <GroupLabel label="분석" />
          <NavLink href="/reports" label="리포트" icon="📊" />
          <NavLink href="/team" label="팀 현황" icon="◈" />
          {userRole === "admin" && (
            <NavLink href="/report-export" label="외부용 보고서" icon="📋" />
          )}

          {/* 더보기 (설정, 가이드, 반복업무) */}
          <div className="mt-2">
            <button onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all"
              style={{ color: "var(--text-2)", background: showMore ? "var(--bg-3)" : "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = showMore ? "var(--bg-3)" : "transparent"; }}>
              <span>더보기</span>
              <span style={{ fontSize: 10 }}>{showMore ? "▲" : "▼"}</span>
            </button>
            {showMore && (
              <div className="mt-0.5">
                <NavLink href="/settings" label="설정" icon="⚙" />
                <NavLink href="/guide" label="사용 가이드" icon="📖" />
                <NavLink href="/recurring" label="반복 업무" icon="🔄" />
              </div>
            )}
          </div>

        </nav>

        {/* 하단 유저 정보 */}
        <div className="px-3 py-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {linkedName && (
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-2)" }}>{linkedName}</p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
                <p className="text-xs" style={{ color: "var(--text-3)" }}>v1.2</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="text-xs px-2 py-1 rounded-md transition-all ml-2 shrink-0"
              style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "0.5px solid var(--border-2)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onTaskClick={id => { setShowSearch(false); setOpenDetail(id); }}
        />
      )}
      {openDetail && (
        <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => setOpenDetail(null)} />
      )}
    </>
  );
}
