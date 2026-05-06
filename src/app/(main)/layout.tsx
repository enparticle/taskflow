// @ts-nocheck
"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      // 로그인된 이메일과 일치하는 구성원이 있으면 auth_id 자동 연결
      const user = session.user;
      const { data: linked } = await supabase
        .from("users").select("id").eq("auth_id", user.id).single();

      if (!linked) {
        // auth_id 없고 이메일 일치하는 구성원 찾아서 자동 연결
        const { data: byEmail } = await supabase
          .from("users").select("id").eq("email", user.email ?? "").single();
        if (byEmail) {
          await supabase.from("users").update({ auth_id: user.id }).eq("id", byEmail.id);
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
