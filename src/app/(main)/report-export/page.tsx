// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  good:     { label: "정상", color: "#00D4A0" },
  at_risk:  { label: "주의", color: "#F5A623" },
  critical: { label: "위험", color: "#FF4D6A" },
};
const MS_STATUS: Record<string, { label: string; color: string }> = {
  planned:     { label: "계획", color: "#7BA7C8" },
  in_progress: { label: "진행 중", color: "#2E86FF" },
  completed:   { label: "완료", color: "#00D4A0" },
  cancelled:   { label: "취소", color: "#4A7099" },
};

export default function ReportExportPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate] = useState(new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }));

  const load = useCallback(async () => {
    setLoading(true);

    const { data: projs } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("created_at");

    const result = [];

    for (const p of projs ?? []) {
      const { data: tasks } = await supabase
        .from("tasks").select("id, title, status, priority, due_date, assignee:users!tasks_assignee_id_fkey(name)")
        .eq("project_id", p.id);

      const { data: milestones } = await supabase
        .from("milestones").select("*")
        .eq("project_id", p.id)
        .order("sort_order");

      const { data: members } = await supabase
        .from("project_members").select("role, user:users(name)")
        .eq("project_id", p.id);

      const t = tasks ?? [];
      const total = t.length;
      const done = t.filter(x => x.status === "done").length;
      const doing = t.filter(x => x.status === "doing").length;
      const blocked = t.filter(x => x.status === "blocked").length;
      const overdue = t.filter(x => x.due_date && new Date(x.due_date) < new Date() && x.status !== "done").length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;

      result.push({ ...p, tasks: t, milestones: milestones ?? [], members: members ?? [], total, done, doing, blocked, overdue, rate });
    }

    setProjects(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: "var(--text-3)" }}>로딩 중…</p>
    </div>
  );

  return (
    <div>
      {/* 화면 전용 버튼 - 인쇄 시 숨김 */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#A78BFA" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>외부용 프로젝트 현황 리포트</h1>
        </div>
        <button onClick={() => window.print()}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(167,139,250,0.3)" }}>
          🖨 PDF / 인쇄
        </button>
      </div>

      {/* 인쇄 영역 */}
      <div id="print-area" style={{ fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif" }}>

        {/* 리포트 헤더 */}
        <div className="mb-8 pb-6" style={{ borderBottom: "2px solid #1E3050" }}>
          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: 11, color: "#4A7099", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                PROJECT STATUS REPORT
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E8F4FF", margin: 0, letterSpacing: -0.5 }}>
                프로젝트 현황 보고서
              </h1>
              <p style={{ fontSize: 12, color: "#4A7099", marginTop: 6 }}>기준일: {reportDate}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#00C2CC", letterSpacing: 2 }}>TASKFLOW</p>
              <p style={{ fontSize: 11, color: "#4A7099", marginTop: 2 }}>업무 관리 시스템</p>
            </div>
          </div>

          {/* 전체 요약 */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[
              { label: "전체 프로젝트", value: projects.length, color: "#2E86FF" },
              { label: "전체 업무", value: projects.reduce((s, p) => s + p.total, 0), color: "#7BA7C8" },
              { label: "완료 업무", value: projects.reduce((s, p) => s + p.done, 0), color: "#00D4A0" },
              { label: "지연 업무", value: projects.reduce((s, p) => s + p.overdue, 0), color: projects.some(p => p.overdue > 0) ? "#FF4D6A" : "#4A7099" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#111D30", border: "1px solid #1E3050", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: "#4A7099", marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 프로젝트별 상세 */}
        {projects.map((p, pi) => {
          const hc = HEALTH_LABEL[p.health] ?? HEALTH_LABEL.good;
          const upcoming = p.tasks
            .filter((t: any) => t.status !== "done" && t.due_date)
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .slice(0, 5);
          const blockedTasks = p.tasks.filter((t: any) => t.status === "blocked").slice(0, 3);

          return (
            <div key={p.id} className="mb-8 print:break-inside-avoid"
              style={{ background: "#111D30", border: "1px solid #1E3050", borderRadius: 16, overflow: "hidden" }}>

              {/* 프로젝트 헤더 */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E3050", background: "#0D1B2E" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: hc.color, boxShadow: `0 0 8px ${hc.color}` }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E8F4FF", margin: 0 }}>{p.name}</h2>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${hc.color}20`, color: hc.color, fontWeight: 600 }}>
                      {hc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {p.end_date && (
                      <span style={{ fontSize: 11, color: "#4A7099" }}>
                        마감: {new Date(p.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 800, color: hc.color }}>{p.rate}%</span>
                  </div>
                </div>

                {/* 진행률 바 */}
                <div style={{ height: 6, background: "#1E3050", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p.rate}%`, background: `linear-gradient(90deg, ${hc.color}, ${hc.color}99)`, borderRadius: 3 }} />
                </div>

                {/* 업무 통계 */}
                <div className="flex gap-4 mt-3">
                  {[
                    { label: "전체", value: p.total, color: "#7BA7C8" },
                    { label: "진행 중", value: p.doing, color: "#2E86FF" },
                    { label: "완료", value: p.done, color: "#00D4A0" },
                    { label: "Blocked", value: p.blocked, color: "#FF4D6A" },
                    { label: "지연", value: p.overdue, color: p.overdue > 0 ? "#FF4D6A" : "#4A7099" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#4A7099" }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-0" style={{ padding: "16px 20px" }}>
                {/* 마일스톤 */}
                <div style={{ paddingRight: 16, borderRight: "1px solid #1E3050" }}>
                  <p style={{ fontSize: 11, color: "#4A7099", fontWeight: 600, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>마일스톤</p>
                  {p.milestones.length === 0 ? (
                    <p style={{ fontSize: 11, color: "#2A4060" }}>마일스톤 없음</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {p.milestones.map((m: any, i: number) => {
                        const mc = MS_STATUS[m.status] ?? MS_STATUS.planned;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: mc.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: m.status === "completed" ? "#4A7099" : "#E8F4FF", flex: 1,
                              textDecoration: m.status === "completed" ? "line-through" : "none",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.title}
                            </span>
                            <span style={{ fontSize: 10, color: mc.color, flexShrink: 0 }}>{mc.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 마감 임박 업무 */}
                <div style={{ padding: "0 16px", borderRight: "1px solid #1E3050" }}>
                  <p style={{ fontSize: 11, color: "#4A7099", fontWeight: 600, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>주요 진행 업무</p>
                  {upcoming.length === 0 ? (
                    <p style={{ fontSize: 11, color: "#2A4060" }}>진행 중인 업무 없음</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {upcoming.map((t: any, i: number) => {
                        const isOverdue = new Date(t.due_date) < new Date();
                        const daysLeft = Math.ceil((new Date(t.due_date).getTime() - new Date().getTime()) / 86400000);
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: isOverdue ? "#FF4D6A" : "#2E86FF", flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: "#E8F4FF", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.title}
                            </span>
                            <span style={{ fontSize: 10, color: isOverdue ? "#FF4D6A" : "#4A7099", flexShrink: 0 }}>
                              {isOverdue ? `${Math.abs(daysLeft)}일 초과` : `D-${daysLeft}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 팀 구성 & 리스크 */}
                <div style={{ paddingLeft: 16 }}>
                  <p style={{ fontSize: 11, color: "#4A7099", fontWeight: 600, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>팀 구성</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                    {p.members.slice(0, 5).map((m: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#1E3050", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 9, color: "#00C2CC", fontWeight: 700 }}>{m.user?.name?.[0]}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "#E8F4FF" }}>{m.user?.name}</span>
                        <span style={{ fontSize: 10, color: "#4A7099" }}>
                          {m.role === "leader" ? "리더" : m.role === "reviewer" ? "리뷰어" : "멤버"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {blockedTasks.length > 0 && (
                    <>
                      <p style={{ fontSize: 11, color: "#FF4D6A", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>⚠ 리스크</p>
                      {blockedTasks.map((t: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#FF4D6A", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "#FF4D6A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.title}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 푸터 */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #1E3050", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 10, color: "#2A4060" }}>본 보고서는 TaskFlow 업무 관리 시스템에서 자동 생성되었습니다</p>
          <p style={{ fontSize: 10, color: "#2A4060" }}>{reportDate} 기준</p>
        </div>
      </div>

      {/* 인쇄용 CSS */}
      <style>{`
        @media print {
          body { background: #0D1B2E !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          #print-area { padding: 0; }
        }
      `}</style>
    </div>
  );
}
