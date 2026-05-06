// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const ROLE_COLORS: Record<string, string> = {
  admin: "var(--purple)", leader: "var(--cyan)", member: "var(--blue)",
};

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: users } = await supabase.from("users").select("*").eq("is_active", true);
      if (!users) return;
      const counts = await Promise.all(users.map(async u => {
        const [{ count: doing }, { count: blocked }, { count: done }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "doing"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "blocked"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).eq("status", "done"),
        ]);
        return { ...u, doingCount: doing ?? 0, blockedCount: blocked ?? 0, doneCount: done ?? 0 };
      }));
      setMembers(counts);
    }
    load();
  }, []);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "var(--blue)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>팀 현황</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(u => (
          <div key={u.id} className="rounded-xl p-5 transition-all"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
                {u.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{u.name}</p>
                <p className="text-xs" style={{ color: ROLE_COLORS[u.role] ?? "var(--text-3)" }}>
                  {u.role} · {u.level ?? "-"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "진행", value: u.doingCount, color: "var(--blue)" },
                { label: "Blocked", value: u.blockedCount, color: u.blockedCount > 0 ? "var(--red)" : "var(--text-3)" },
                { label: "완료", value: u.doneCount, color: "var(--green)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg p-2.5 text-center"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                  <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
