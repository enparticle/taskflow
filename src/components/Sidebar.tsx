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

        {/* 濡쒓퀬 */}
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
            aria-label="寃??>
            ?뵇
          </button>
          <NotificationBell onTaskClick={id => setOpenDetail(id)} />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">

          {/* ?낅Т 洹몃９ */}
          <GroupLabel label="?낅Т" />
          <NavLink href="/dashboard" label="??쒕낫?? icon="?? />
          <NavLink href="/tasks" label="?낅Т" icon="?? />
          <NavLink href="/tree" label="?낅Т ?몃━" icon="?뙰" />
          {/* 移몃컲 蹂대뱶 - 鍮꾪솢?깊솕 (?쒖꽦?뷀븯?ㅻ㈃ ?꾨옒 二쇱꽍 ?댁젣)
          <NavLink href="/kanban" label="移몃컲 蹂대뱶" icon="?? />
          */}

          {/* ?꾨줈?앺듃 洹몃９ */}
          <GroupLabel label="?꾨줈?앺듃" />
          <div className="flex items-center justify-between px-3 mb-1">
            <span style={{ fontSize: 10, color: "var(--text-3)" }} />
            <Link href="/projects" className="text-xs transition-colors"
              style={{ color: "var(--text-3)", fontSize: 10 }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)"; }}>
              ?꾩껜 ??            </Link>
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
            <p className="px-3 py-1 text-xs" style={{ color: "var(--text-3)" }}>?꾨줈?앺듃 ?놁쓬</p>
          )}

          {/* AI 洹몃９ */}
          <GroupLabel label="AI" />
          <NavLink href="/project-assistant" label="?꾨줈?앺듃 ?깅줉" icon="?? />
          <NavLink href="/meeting-note" label="?뚯쓽濡?遺꾩꽍" icon="?뱷" />

          {/* 遺꾩꽍 洹몃９ */}
          <GroupLabel label="遺꾩꽍" />
          <NavLink href="/reports" label="由ы룷?? icon="?뱤" />
          <NavLink href="/team" label="? ?꾪솴" icon="?? />
          {userRole === "admin" && (
            <NavLink href="/report-export" label="?몃???蹂닿퀬?? icon="?뱥" />
          )}

          {/* ?붾낫湲?(?ㅼ젙, 媛?대뱶, 諛섎났?낅Т) */}
          <div className="mt-2">
            <button onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all"
              style={{ color: "var(--text-2)", background: showMore ? "var(--bg-3)" : "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = showMore ? "var(--bg-3)" : "transparent"; }}>
              <span>?붾낫湲?/span>
              <span style={{ fontSize: 10 }}>{showMore ? "?? : "??}</span>
            </button>
            {showMore && (
              <div className="mt-0.5">
                <NavLink href="/settings" label="?ㅼ젙" icon="?? />
                <NavLink href="/guide" label="?ъ슜 媛?대뱶" icon="?뱰" />
                <NavLink href="/recurring" label="諛섎났 ?낅Т" icon="?봽" />
              </div>
            )}
          </div>

        </nav>

        {/* ?섎떒 ?좎? ?뺣낫 */}
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
              濡쒓렇?꾩썐
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

