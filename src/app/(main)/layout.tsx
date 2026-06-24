// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import TaskDetail from "@/components/tasks/TaskDetail";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "홈" },
  { href: "/tasks",     icon: "☑", label: "업무" },
  { href: "/projects",  icon: "📁", label: "프로젝트" },
  { href: "/ai",        icon: "✦", label: "AI", accent: true },
  { href: "/calendar",  icon: "📅", label: "캘린더" },
  { href: "/more",      icon: "···", label: "더보기" },
];

function BottomNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const MORE_ITEMS = [
    { href: "/meeting-note", label: "📝 회의 기록" },
    { href: "/team",         label: "◈ 팀 현황", leaderOnly: true },
    { href: "/reports",      label: "📊 리포트", leaderOnly: true },
    { href: "/tree",         label: "🌳 업무 트리", leaderOnly: true },
    { href: "/admin",        label: "🧠 팀원 프로필", adminOnly: true },
    { href: "/report-export",label: "📋 외부 보고서", adminOnly: true },
    { href: "/guide",        label: "📖 사용 가이드" },
    { href: "/settings",     label: "⚙ 설정" },
  ].filter(item => {
    if (item.adminOnly) return userRole === "admin";
    if (item.leaderOnly) return userRole === "admin" || userRole === "leader";
    return true;
  });

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* 더보기 드롭업 */}
      {showMore && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowMore(false)} />
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            zIndex: 50, background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "8px 6px", minWidth: 200,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          }}>
            {MORE_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                onClick={() => setShowMore(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px", borderRadius: 8, fontSize: 13,
                  color: pathname.startsWith(item.href) ? "var(--cyan)" : "var(--text-1)",
                  background: pathname.startsWith(item.href) ? "var(--cyan-bg)" : "transparent",
                  textDecoration: "none",
                }}
                onMouseEnter={e => { if (!pathname.startsWith(item.href)) (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { if (!pathname.startsWith(item.href)) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}>
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* 하단 네비게이션 바 */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 30, display: "flex", alignItems: "center", gap: 2,
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: 18, padding: "6px 8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        {NAV_ITEMS.map(item => {
          const active = item.href === "/more" ? showMore : isActive(item.href);
          if (item.href === "/more") {
            return (
              <button key="more" onClick={() => setShowMore(v => !v)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, padding: "7px 16px", borderRadius: 12, border: "none",
                  cursor: "pointer", minWidth: 56, transition: "all 0.15s",
                  background: showMore ? "var(--bg-4)" : "transparent",
                }}>
                <span style={{ fontSize: 18, color: showMore ? "var(--text-1)" : "var(--text-3)", lineHeight: 1 }}>···</span>
                <span style={{ fontSize: 10, color: showMore ? "var(--text-1)" : "var(--text-3)", fontWeight: showMore ? 600 : 400 }}>더보기</span>
              </button>
            );
          }
          return (
            <Link key={item.href} href={item.href}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 2, padding: "7px 16px", borderRadius: 12, textDecoration: "none",
                minWidth: 56, transition: "all 0.15s",
                background: active ? (item.accent ? "var(--cyan-bg)" : "var(--cyan)") : item.accent && !active ? "var(--bg-3)" : "transparent",
              }}>
              <span style={{
                fontSize: 18, lineHeight: 1,
                color: active ? (item.accent ? "var(--cyan)" : "#fff") : item.accent ? "var(--cyan)" : "var(--text-3)",
              }}>{item.icon}</span>
              <span style={{
                fontSize: 10,
                color: active ? (item.accent ? "var(--cyan)" : "#fff") : item.accent ? "var(--cyan)" : "var(--text-3)",
                fontWeight: active || item.accent ? 600 : 400,
              }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [userRole, setUserRole] = useState("member");
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }

      const user = session.user;
      const { data: linked } = await supabase
        .from("users").select("id, role").eq("auth_id", user.id).single();
      let myUserId = linked?.id;

      if (!linked) {
        const { data: byEmail } = await supabase
          .from("users").select("id, role").eq("email", user.email ?? "").single();
        if (byEmail) {
          await supabase.from("users").update({ auth_id: user.id }).eq("id", byEmail.id);
          myUserId = byEmail.id;
          setUserRole(byEmail.role ?? "member");
        }
      } else {
        setUserRole(linked.role ?? "member");
      }

      if (myUserId) {
        const today = new Date().toDateString();
        const lastCheck = localStorage.getItem("lastDeadlineCheck");
        if (lastCheck !== today) {
          localStorage.setItem("lastDeadlineCheck", today);
          const soon = new Date();
          soon.setDate(soon.getDate() + 2);
          const { data: deadlineTasks } = await supabase
            .from("tasks").select("id, title, due_date")
            .or(`assignee_id.eq.${myUserId},assignee_ids.cs.{${myUserId}}`)
            .not("status", "eq", "done").not("due_date", "is", null)
            .lte("due_date", soon.toISOString());
          if (deadlineTasks && deadlineTasks.length > 0) {
            const now = new Date();
            for (const t of deadlineTasks) {
              const diff = Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000);
              const label = diff < 0 ? `${Math.abs(diff)}일 초과` : diff === 0 ? "오늘 마감" : `${diff}일 후 마감`;
              const { data: existing } = await supabase.from("notifications")
                .select("id").eq("task_id", t.id).eq("type", "deadline")
                .gte("created_at", new Date().toISOString().split("T")[0]).single();
              if (!existing) {
                await supabase.from("notifications").insert({
                  user_id: myUserId, type: "deadline",
                  title: `마감 임박: ${label}`, body: t.title, task_id: t.id,
                });
              }
            }
          }
        }
      }
    }
    checkAuth();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 상단 헤더 */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
        height: 52, background: "var(--bg-2)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
      }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 24, height: 24, background: "var(--cyan)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>T</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "var(--text-1)" }}>
            Task<span style={{ color: "var(--cyan)" }}>Flow</span>
          </span>
        </Link>
        <div style={{ flex: 1 }} />
        <NotificationButton onTaskClick={setOpenDetail} />
        <UserAvatar supabase={supabase} />
      </div>

      {/* 메인 콘텐츠 */}
      <main style={{ paddingTop: 68, paddingBottom: 96, paddingLeft: 24, paddingRight: 24, maxWidth: 1200, margin: "0 auto" }}>
        {children}
      </main>

      <BottomNav userRole={userRole} />

      {openDetail && (
        <TaskDetail taskId={openDetail} onClose={() => setOpenDetail(null)} onRefresh={() => setOpenDetail(null)} />
      )}
    </div>
  );
}

function NotificationButton({ onTaskClick }: { onTaskClick: (id: string) => void }) {
  const supabase = createClient();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: u } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
      if (!u) return;
      const { data } = await supabase.from("notifications")
        .select("*").eq("user_id", u.id).eq("is_read", false)
        .order("created_at", { ascending: false }).limit(10);
      setNotifs(data ?? []);
      setCount((data ?? []).length);
    }
    load();
  }, []);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    setCount(c => Math.max(0, c - 1));
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, position: "relative" }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        {count > 0 && (
          <div style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, background: "var(--red)", borderRadius: "50%", border: "1.5px solid var(--bg-2)" }} />
        )}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", right: 0, top: 40, zIndex: 50,
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 8, minWidth: 280, maxHeight: 360, overflowY: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}>
            {notifs.length === 0 ? (
              <p style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>새 알림 없음</p>
            ) : notifs.map(n => (
              <div key={n.id} style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, cursor: n.task_id ? "pointer" : "default" }}
                    onClick={() => { if (n.task_id) { onTaskClick(n.task_id); setOpen(false); } }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{n.title}</p>
                    {n.body && <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{n.body}</p>}
                  </div>
                  <button onClick={() => markRead(n.id)}
                    style={{ fontSize: 10, color: "var(--text-3)", border: "none", background: "transparent", cursor: "pointer", padding: "2px 6px" }}>
                    읽음
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserAvatar({ supabase }: { supabase: any }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: any) => {
      if (!data.user) return;
      const { data: u } = await supabase.from("users").select("name").eq("auth_id", data.user.id).single();
      if (u) setName(u.name);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--cyan-bg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cyan)" }}>{name?.[0] ?? "?"}</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", right: 0, top: 38, zIndex: 50,
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 8, minWidth: 160,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}>
            <p style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{name}</p>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "4px 0" }} />
            <Link href="/settings" onClick={() => setOpen(false)}
              style={{ display: "block", padding: "7px 12px", fontSize: 12, color: "var(--text-2)", textDecoration: "none", borderRadius: 6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}>
              ⚙ 설정
            </Link>
            <Link href="/guide" onClick={() => setOpen(false)}
              style={{ display: "block", padding: "7px 12px", fontSize: 12, color: "var(--text-2)", textDecoration: "none", borderRadius: 6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}>
              📖 사용 가이드
            </Link>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "4px 0" }} />
            <button onClick={logout}
              style={{ display: "block", width: "100%", padding: "7px 12px", fontSize: 12, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--red-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
