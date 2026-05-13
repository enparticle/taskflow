// @ts-nocheck
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import SearchModal from "@/components/SearchModal";
import TaskDetail from "@/components/tasks/TaskDetail";
import { createClient } from "@/lib/supabase";

const TOP_NAV = [
  { href: "/dashboard", label: "대시보드",  icon: "▦" },
  { href: "/tasks",     label: "전체 업무",  icon: "≡" },
  { href: "/kanban",    label: "칸반 보드",  icon: "⊞" },
  { href: "/my-work",           label: "내 업무",          icon: "◎" },
  { href: "/project-assistant", label: "AI 프로젝트 등록", icon: "✦" },
];

const BOTTOM_NAV = [
  { href: "/meeting-note",  label: "회의록 분석",  icon: "📝" },
  { href: "/guide",         label: "사용 가이드",  icon: "📖" },
  { href: "/reports",       label: "리포트",       icon: "📊" },
  { href: "/report-export", label: "외부용 보고서", icon: "📋" },
  { href: "/recurring",     label: "반복 업무",    icon: "🔄" },
  { href: "/team",          label: "팀 현황",      icon: "◈" },
  { href: "/settings",      label: "설정",         icon: "⚙" },
];

const HEALTH_COLOR: Record<string, string> = {
  good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A",
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
    const active = pathname === href;
    return (
      <Link href={href}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all"
        style={{
          background: active ? "var(--blue-bg)" : "transparent",
          color: active ? "var(--cyan)" : "var(--text-2)",
          borderLeft: active ? "2px solid var(--cyan)" : "2px solid transparent",
        }}>
        <span className="text-sm w-4 text-center">{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <>
    <aside className="flex w-56 shrink-0 flex-col"
      style={{ background: "var(--bg-2)", borderRight: "1px solid var(--border)" }}>

      {/* 로고 */}
      <div className="flex h-14 items-center gap-2 px-4"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
        <span className="text-sm font-bold tracking-widest uppercase flex-1" style={{ color: "var(--text-1)" }}>
          Task<span style={{ color: "var(--cyan)" }}>Flow</span>
        </span>
        <button onClick={() => setShowSearch(true)}
          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
          style={{ color: "var(--text-3)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}>
          🔍
        </button>
        <NotificationBell onTaskClick={id => setOpenDetail(id)} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {TOP_NAV.map(n => <NavLink key={n.href} {...n} />)}

        {/* 프로젝트 섹션 */}
        <div className="pt-3 pb-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              프로젝트
            </span>
            <Link href="/projects" className="text-xs transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)"; }}>
              전체
            </Link>
          </div>
          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`;
            const hColor = HEALTH_COLOR[p.health] ?? "#7BA7C8";
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all"
                style={{
                  background: active ? "var(--blue-bg)" : "transparent",
                  color: active ? "var(--text-1)" : "var(--text-2)",
                  borderLeft: active ? "2px solid var(--cyan)" : "2px solid transparent",
                  fontWeight: active ? 600 : 400,
                }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: hColor, boxShadow: active ? `0 0 6px ${hColor}` : "none" }} />
                <span className="truncate text-xs">{p.name}</span>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <p className="px-3 py-1 text-xs" style={{ color: "var(--text-3)" }}>프로젝트 없음</p>
          )}
        </div>

        <div className="pt-1">
          {BOTTOM_NAV.map(n => {
            if (n.href === "/report-export" && userRole !== null && userRole !== "admin") return null;
            return <NavLink key={n.href} {...n} />;
          })}
        </div>
      </nav>

      {/* 하단 - 유저 정보 + 로그아웃 */}
      <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        {linkedName && (
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-2)" }}>{linkedName}</p>
        )}
        {userEmail && (
          <p className="text-xs truncate" style={{ color: "var(--text-3)" }}>{userEmail}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--green)", boxShadow: "0 0 6px var(--green)" }} />
            <p className="text-xs" style={{ color: "var(--text-3)" }}>v0.1</p>
          </div>
          <button onClick={handleLogout}
            className="text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)33"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}>
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
