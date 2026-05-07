// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  blocked:  { icon: "⊘", color: "#FF4D6A" },
  deadline: { icon: "◷", color: "#F5A623" },
  assigned: { icon: "◎", color: "#2E86FF" },
  review:   { icon: "✎", color: "#F5A623" },
  rejected: { icon: "✕", color: "#FF4D6A" },
  approved: { icon: "✓", color: "#00D4A0" },
  mention:  { icon: "@", color: "#A78BFA" },
};

export default function NotificationBell() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [myUser, setMyUser] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: me } = await supabase.from("users").select("*").eq("auth_id", data.user.id).single();
      setMyUser(me);
    });

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!myUser) return;
    loadNotifications();

    // 실시간 구독
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${myUser.id}`,
      }, () => loadNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myUser]);

  async function loadNotifications() {
    if (!myUser) return;
    const { data } = await supabase
      .from("notifications")
      .select("*, task:tasks(title)")
      .eq("user_id", myUser.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    loadNotifications();
  }

  async function markAllRead() {
    if (!myUser) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", myUser.id).eq("is_read", false);
    loadNotifications();
  }

  const unread = notifications.filter(n => !n.is_read).length;

  function fmtTime(d: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "방금";
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    return `${Math.floor(diff/86400)}일 전`;
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all"
        style={{ background: open ? "var(--bg-4)" : "transparent", color: "var(--text-2)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-4)"; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
            style={{ background: "#FF4D6A", color: "#fff", fontSize: 9 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
              알림 {unread > 0 && <span style={{ color: "#FF4D6A" }}>({unread})</span>}
            </p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs" style={{ color: "var(--text-3)" }}>
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs" style={{ color: "var(--text-3)" }}>알림이 없습니다</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: "●", color: "var(--text-3)" };
                return (
                  <div key={n.id}
                    className="flex gap-3 px-4 py-3 cursor-pointer transition-all"
                    style={{
                      background: n.is_read ? "transparent" : "rgba(46,134,255,0.05)",
                      borderBottom: "1px solid var(--border)",
                    }}
                    onClick={() => markRead(n.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? "transparent" : "rgba(46,134,255,0.05)"; }}>
                    <span className="shrink-0 text-sm mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: n.is_read ? "var(--text-2)" : "var(--text-1)" }}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{n.body}</p>}
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{fmtTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: "#2E86FF" }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
