// @ts-nocheck
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const LEVEL_CONFIG = {
  danger:  { color: "#FF4D6A", bg: "rgba(255,77,106,0.08)",  border: "rgba(255,77,106,0.2)",  icon: "⊘" },
  warning: { color: "#F5A623", bg: "rgba(245,166,35,0.08)",  border: "rgba(245,166,35,0.2)",  icon: "⚠" },
  info:    { color: "#7BA7C8", bg: "rgba(123,167,200,0.08)", border: "rgba(123,167,200,0.2)", icon: "ℹ" },
};

const RISK_CONFIG = {
  high:   { label: "높음", color: "#FF4D6A" },
  medium: { label: "보통", color: "#F5A623" },
  low:    { label: "낮음", color: "#00D4A0" },
};

interface Props {
  mode: "dashboard" | "tasks" | "project";
  projectId?: string;
  projectName?: string;
  filterStatus?: string;
  onTaskClick?: (id: string) => void;
}

export default function PlanningFeedback({ mode, projectId, projectName, filterStatus, onTaskClick }: Props) {
  const supabase = createClient();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true); setError("");
    const now = new Date();
    let snapshot: any = {};

    try {
      if (mode === "dashboard") {
        // 전체 팀 현황
        const [{ data: tasks }, { data: users }, { data: projects }, { data: blockedEvents }] = await Promise.all([
          supabase.from("tasks").select("id,title,status,priority,due_date,estimated_hours,assignee_id,assignee_ids,blocked_reason,project_id").not("status","eq","done"),
          supabase.from("users").select("id,name,role").eq("is_active",true),
          supabase.from("projects").select("id,name,health,end_date,status").eq("status","active"),
          supabase.from("task_events").select("task_id,changed_at").eq("to_status","blocked").order("changed_at",{ascending:false}),
        ]);

        const blockedSince: Record<string,number> = {};
        (blockedEvents??[]).forEach(e => {
          if (!blockedSince[e.task_id]) blockedSince[e.task_id] = Math.floor((now.getTime()-new Date(e.changed_at).getTime())/86400000);
        });

        snapshot = {
          context: "전체 팀 대시보드",
          date: now.toLocaleDateString("ko-KR"),
          total_active_tasks: (tasks??[]).length,
          overdue: (tasks??[]).filter(t=>t.due_date&&new Date(t.due_date)<now).map(t=>({title:t.title,priority:t.priority,days:Math.floor((now.getTime()-new Date(t.due_date).getTime())/86400000)})),
          due_soon: (tasks??[]).filter(t=>{if(!t.due_date)return false;const d=(new Date(t.due_date).getTime()-now.getTime())/86400000;return d>=0&&d<=3;}).map(t=>({title:t.title,due:t.due_date,priority:t.priority})),
          blocked: (tasks??[]).filter(t=>t.status==="blocked").map(t=>({title:t.title,days:blockedSince[t.id]??0,reason:t.blocked_reason})),
          no_estimate: (tasks??[]).filter(t=>!t.estimated_hours&&t.status!=="backlog").length,
          member_workload: (users??[]).map(u=>({
            name: u.name, role: u.role,
            doing: (tasks??[]).filter(t=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))&&t.status==="doing").length,
            total: (tasks??[]).filter(t=>(t.assignee_id===u.id||(t.assignee_ids??[]).includes(u.id))).length,
          })).filter(u=>u.total>0),
          projects: (projects??[]).map(p=>({
            name:p.name, health:p.health, end_date:p.end_date,
            tasks:(tasks??[]).filter(t=>t.project_id===p.id).length,
            done:(tasks??[]).filter(t=>t.project_id===p.id&&t.status==="done").length,
          })),
        };

      } else if (mode === "tasks") {
        // 전체 업무 페이지 - 필터 적용
        let q = supabase.from("tasks").select("id,title,status,priority,due_date,estimated_hours,assignee_id,assignee_ids,blocked_reason,project_id,assignee:users!tasks_assignee_id_fkey(name)").not("status","eq","done");
        if (filterStatus && filterStatus !== "all") q = q.eq("status", filterStatus);
        const { data: tasks } = await q;
        const { data: blockedEvents } = await supabase.from("task_events").select("task_id,changed_at").eq("to_status","blocked").order("changed_at",{ascending:false});

        const blockedSince: Record<string,number> = {};
        (blockedEvents??[]).forEach(e => {
          if (!blockedSince[e.task_id]) blockedSince[e.task_id] = Math.floor((now.getTime()-new Date(e.changed_at).getTime())/86400000);
        });

        snapshot = {
          context: filterStatus && filterStatus !== "all" ? `전체 업무 (${filterStatus} 필터)` : "전체 업무 목록",
          date: now.toLocaleDateString("ko-KR"),
          total: (tasks??[]).length,
          status_breakdown: ["backlog","todo","doing","blocked","review"].map(s=>({status:s, count:(tasks??[]).filter(t=>t.status===s).length})),
          overdue: (tasks??[]).filter(t=>t.due_date&&new Date(t.due_date)<now).map(t=>({title:t.title,priority:t.priority,assignee:t.assignee?.name})),
          due_soon: (tasks??[]).filter(t=>{if(!t.due_date)return false;const d=(new Date(t.due_date).getTime()-now.getTime())/86400000;return d>=0&&d<=3;}).map(t=>({title:t.title,assignee:t.assignee?.name})),
          blocked: (tasks??[]).filter(t=>t.status==="blocked").map(t=>({title:t.title,days:blockedSince[t.id]??0,reason:t.blocked_reason,assignee:t.assignee?.name})),
          no_estimate: (tasks??[]).filter(t=>!t.estimated_hours&&t.status!=="backlog").map(t=>({title:t.title,status:t.status})),
          urgent_high: (tasks??[]).filter(t=>["urgent","high"].includes(t.priority)&&t.status!=="done").map(t=>({title:t.title,priority:t.priority,status:t.status})),
        };

      } else if (mode === "project" && projectId) {
        // 프로젝트 상세 - 해당 프로젝트만
        const [{ data: tasks }, { data: milestones }, { data: members }, { data: blockedEvents }] = await Promise.all([
          supabase.from("tasks").select("id,title,status,priority,due_date,estimated_hours,assignee_id,assignee_ids,blocked_reason,assignee:users!tasks_assignee_id_fkey(name)").eq("project_id",projectId).not("status","eq","done"),
          supabase.from("milestones").select("*").eq("project_id",projectId),
          supabase.from("project_members").select("role,user:users(name)").eq("project_id",projectId),
          supabase.from("task_events").select("task_id,changed_at").eq("to_status","blocked").order("changed_at",{ascending:false}),
        ]);
        const { data: project } = await supabase.from("projects").select("*").eq("id",projectId).single();

        const blockedSince: Record<string,number> = {};
        (blockedEvents??[]).forEach(e => {
          if (!blockedSince[e.task_id]) blockedSince[e.task_id] = Math.floor((now.getTime()-new Date(e.changed_at).getTime())/86400000);
        });

        snapshot = {
          context: `프로젝트: ${projectName ?? project?.name}`,
          date: now.toLocaleDateString("ko-KR"),
          project: { name:project?.name, health:project?.health, start:project?.start_date, end:project?.end_date, description:project?.description },
          total_tasks: (tasks??[]).length,
          status_breakdown: ["backlog","todo","doing","blocked","review"].map(s=>({status:s,count:(tasks??[]).filter(t=>t.status===s).length})),
          completion_rate: `${Math.round(((tasks??[]).filter(t=>t.status==="done").length/Math.max((tasks??[]).length,1))*100)}%`,
          overdue: (tasks??[]).filter(t=>t.due_date&&new Date(t.due_date)<now).map(t=>({title:t.title,assignee:t.assignee?.name})),
          due_soon: (tasks??[]).filter(t=>{if(!t.due_date)return false;const d=(new Date(t.due_date).getTime()-now.getTime())/86400000;return d>=0&&d<=3;}).map(t=>({title:t.title,assignee:t.assignee?.name})),
          blocked: (tasks??[]).filter(t=>t.status==="blocked").map(t=>({title:t.title,days:blockedSince[t.id]??0,reason:t.blocked_reason,assignee:t.assignee?.name})),
          milestones: (milestones??[]).map(m=>({title:m.title,status:m.status,due:m.due_date,overdue:m.due_date&&new Date(m.due_date)<now&&m.status!=="completed"})),
          team: (members??[]).map(m=>({name:m.user?.name,role:m.role,doing:(tasks??[]).filter(t=>(t.assignee_id===m.user?.id||(t.assignee_ids??[]).includes(m.user?.id))&&t.status==="doing").length})),
        };
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError("분석 중 오류가 발생했습니다: " + e.message);
    }
    setLoading(false);
  }

  const title = mode === "dashboard" ? "팀 전체 AI 피드백" : mode === "project" ? `${projectName ?? "프로젝트"} AI 피드백` : "업무 AI 피드백";
  const risk = result?.overall_risk ? RISK_CONFIG[result.overall_risk] : null;

  return (
    <div className="rounded-2xl overflow-hidden sticky top-0"
      style={{ border: "1px solid var(--border-2)", background: "var(--bg-2)" }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: collapsed ? "none" : "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#A78BFA", boxShadow: "0 0 6px #A78BFA" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{title}</p>
          {risk && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${risk.color}18`, color: risk.color }}>
              리스크 {risk.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button onClick={analyze} disabled={loading}
              className="text-xs px-2 py-1 rounded-lg disabled:opacity-40"
              style={{ background: "var(--bg-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
              {loading ? "분석 중…" : "다시 분석"}
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-xs" style={{ color: "var(--text-3)" }}>
            {collapsed ? "▾" : "▴"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {!result && !loading && !error && (
            <div className="py-8 text-center space-y-3">
              <p className="text-xs" style={{ color: "var(--text-3)" }}>버튼을 눌러 AI 피드백을 받아보세요</p>
              <button onClick={analyze}
                className="rounded-lg px-5 py-2.5 text-xs font-semibold"
                style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(167,139,250,0.3)" }}>
                ✦ AI 분석 시작
              </button>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center">
              <div className="inline-block w-4 h-4 rounded-full border-2 animate-spin mb-2"
                style={{ borderColor: "#A78BFA", borderTopColor: "transparent" }} />
              <p className="text-xs" style={{ color: "var(--text-3)" }}>Claude가 분석 중입니다…</p>
            </div>
          )}

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--red-bg)", color: "var(--red)" }}>{error}</p>
          )}

          {result && !loading && (
            <>
              {result.summary && (
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <p className="text-xs font-medium" style={{ color: "#A78BFA" }}>{result.summary}</p>
                </div>
              )}
              {(result.items ?? []).map((item: any, i: number) => {
                const cfg = LEVEL_CONFIG[item.level] ?? LEVEL_CONFIG.info;
                return (
                  <div key={i} className="rounded-xl px-3 py-2.5"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-sm mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: cfg.color }}>{item.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>{item.detail}</p>
                        {item.action && (
                          <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-3)" }}>→ {item.action}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {lastUpdated && (
                <p className="text-xs text-center pt-1" style={{ color: "var(--text-3)" }}>
                  {lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
