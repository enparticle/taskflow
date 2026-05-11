// @ts-nocheck
"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar"), { ssr: false });

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const user = session.user;
      const { data: linked } = await supabase
        .from("users").select("id").eq("auth_id", user.id).single();

      let myUserId = linked?.id;
      if (!linked) {
        const { data: byEmail } = await supabase
          .from("users").select("id").eq("email", user.email ?? "").single();
        if (byEmail) {
          await supabase.from("users").update({ auth_id: user.id }).eq("id", byEmail.id);
          myUserId = byEmail.id;
        }
      }

      // 마감 임박 알림 자동 생성 (하루 1번)
      if (myUserId) {
        const today = new Date().toDateString();
        const lastCheck = localStorage.getItem("lastDeadlineCheck");
        if (lastCheck !== today) {
          localStorage.setItem("lastDeadlineCheck", today);
          const soon = new Date();
          soon.setDate(soon.getDate() + 2);
          const { data: deadlineTasks } = await supabase
            .from("tasks")
            .select("id, title, due_date")
            .or(`assignee_id.eq.${myUserId},assignee_ids.cs.{${myUserId}}`)
            .not("status", "eq", "done")
            .not("due_date", "is", null)
            .lte("due_date", soon.toISOString());

          if (deadlineTasks && deadlineTasks.length > 0) {
            const now = new Date();
            for (const t of deadlineTasks) {
              const diff = Math.ceil((new Date(t.due_date).getTime() - now.getTime()) / 86400000);
              const label = diff < 0 ? `${Math.abs(diff)}일 초과` : diff === 0 ? "오늘 마감" : `${diff}일 후 마감`;
              // 오늘 이미 알림 있는지 확인
              const { data: existing } = await supabase
                .from("notifications")
                .select("id").eq("task_id", t.id).eq("type", "deadline")
                .gte("created_at", new Date().toISOString().split("T")[0])
                .single();
              if (!existing) {
                await supabase.from("notifications").insert({
                  user_id: myUserId,
                  type: "deadline",
                  title: `마감 알림: ${label}`,
                  body: t.title,
                  task_id: t.id,
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
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
