// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const HEALTH = {
  good:     { label: "정상", color: "#00D4A0", bg: "rgba(0,212,160,0.10)" },
  at_risk:  { label: "주의", color: "#F5A623", bg: "rgba(245,166,35,0.10)" },
  critical: { label: "위험", color: "#FF4D6A", bg: "rgba(255,77,106,0.10)" },
};

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("projects")
      .select("*, owner:users!projects_owner_id_fkey(name)")
      .eq("status", "active")
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>프로젝트</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p: any) => {
          const h = HEALTH[p.health as keyof typeof HEALTH];
          return (
            <div key={p.id} className="rounded-xl p-5 transition-all cursor-pointer"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-3)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)";
              }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>{p.name}</h2>
                <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{ background: h.bg, color: h.color }}>{h.label}</span>
              </div>
              {p.description && (
                <p className="text-xs mb-4" style={{ color: "var(--text-2)" }}>{p.description}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: "var(--text-3)" }}>담당 · {p.owner?.name ?? "미정"}</p>
                {p.end_date && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    ~{new Date(p.end_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
