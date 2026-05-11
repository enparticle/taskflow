// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  good:    { label: "정상", color: "#00D4A0" },
  at_risk: { label: "주의", color: "#F5A623" },
  critical:{ label: "위험", color: "#FF4D6A" },
};

export default function ReportExportPage() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<"list" | "edit" | "preview">("list");
  const [reports, setReports] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthUser().then(u => setIsAdmin(u?.role === "admin"));
    loadReports();
    loadProjects();
  }, []);

  async function loadReports() {
    const { data } = await supabase.from("external_reports")
      .select("*").order("created_at", { ascending: false });
    setReports(data ?? []);
    setLoading(false);
  }

  async function loadProjects() {
    const { data: projs } = await supabase.from("projects")
      .select("id, name, health, end_date, description").eq("status", "active").order("created_at");

    const result = [];
    for (const p of projs ?? []) {
      const { data: tasks } = await supabase.from("tasks").select("id, status, due_date")
        .eq("project_id", p.id);
      const { data: milestones } = await supabase.from("milestones").select("id, title, status, due_date")
        .eq("project_id", p.id).order("sort_order");
      const { data: members } = await supabase.from("project_members")
        .select("role, user:users(name)").eq("project_id", p.id);

      const t = tasks ?? [];
      const total = t.length;
      const done = t.filter(x => x.status === "done").length;
      const blocked = t.filter(x => x.status === "blocked").length;
      const overdue = t.filter(x => x.due_date && new Date(x.due_date) < new Date() && x.status !== "done").length;

      result.push({
        ...p,
        total, done, blocked, overdue,
        actualRate: total > 0 ? Math.round((done / total) * 100) : 0,
        milestones: milestones ?? [],
        members: members ?? [],
      });
    }
    setProjects(result);
  }

  function newReport() {
    const draft = {
      id: null,
      title: `프로젝트 현황 보고서`,
      report_date: new Date().toISOString().split("T")[0],
      published: false,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        included: true,
        health: p.health,
        end_date: p.end_date,
        summary: "",
        displayRate: p.actualRate,
        selectedMilestones: p.milestones.filter((m: any) => m.status !== "cancelled").map((m: any) => m.id),
        nextPlan: "",
        showMembers: true,
        showRisk: false,
      })),
    };
    setEditingReport(draft);
    setMode("edit");
  }

  async function saveReport(publish: boolean) {
    const data = { ...editingReport, published: publish, updated_at: new Date().toISOString() };
    if (editingReport.id) {
      await supabase.from("external_reports").update(data).eq("id", editingReport.id);
    } else {
      const { data: created } = await supabase.from("external_reports").insert({
        title: data.title, report_date: data.report_date,
        published: publish, projects: data.projects,
      }).select().single();
      if (created) setEditingReport({ ...data, id: created.id });
    }
    await loadReports();
    if (publish) setMode("preview");
  }

  async function deleteReport(id: string) {
    if (!confirm("보고서를 삭제할까요?")) return;
    await supabase.from("external_reports").delete().eq("id", id);
    loadReports();
  }

  // 편집 중인 프로젝트 업데이트
  function updateProject(pid: string, key: string, value: any) {
    setEditingReport((r: any) => ({
      ...r,
      projects: r.projects.map((p: any) => p.id === pid ? { ...p, [key]: value } : p),
    }));
  }

  function toggleMilestone(pid: string, mid: string) {
    setEditingReport((r: any) => ({
      ...r,
      projects: r.projects.map((p: any) => {
        if (p.id !== pid) return p;
        const sel = p.selectedMilestones ?? [];
        return { ...p, selectedMilestones: sel.includes(mid) ? sel.filter((x: string) => x !== mid) : [...sel, mid] };
      }),
    }));
  }

  if (loading) return <div className="flex items-center justify-center h-48"><p style={{ color: "var(--text-3)" }}>로딩 중…</p></div>;

  // ─── 목록 ───────────────────────────────────────────
  if (mode === "list") return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#A78BFA" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>외부용 보고서</h1>
        </div>
        {isAdmin && (
          <button onClick={newReport}
            className="rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff" }}>
            + 새 보고서 작성
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl py-12 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-2)" }}>작성된 보고서가 없습니다</p>
          {isAdmin && <p className="text-xs" style={{ color: "var(--text-3)" }}>새 보고서 작성 버튼을 눌러 시작하세요</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{r.title}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: r.published ? "rgba(0,212,160,0.12)" : "rgba(74,112,153,0.12)", color: r.published ? "#00D4A0" : "#4A7099" }}>
                    {r.published ? "발행됨" : "임시저장"}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  {new Date(r.report_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 기준
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingReport(r); setMode("preview"); }}
                  className="rounded-lg px-3 py-1.5 text-xs"
                  style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                  미리보기
                </button>
                {isAdmin && (
                  <>
                    <button onClick={() => { setEditingReport(r); setMode("edit"); }}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                      수정
                    </button>
                    <button onClick={() => deleteReport(r.id)}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: "var(--red-bg)", color: "var(--red)" }}>
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── 편집 ───────────────────────────────────────────
  if (mode === "edit" && editingReport) {
    const fieldStyle = { background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF", borderRadius: 8, padding: "8px 12px", fontSize: 12, width: "100%", outline: "none" };

    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("list")} className="text-xs" style={{ color: "var(--text-3)" }}>← 목록</button>
            <span style={{ color: "var(--border)" }}>|</span>
            <h1 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>보고서 편집</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveReport(false)}
              className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}>
              임시저장
            </button>
            <button onClick={() => saveReport(true)}
              className="rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff" }}>
              발행 및 미리보기
            </button>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>보고서 제목</label>
              <input value={editingReport.title} onChange={e => setEditingReport((r: any) => ({ ...r, title: e.target.value }))} style={fieldStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>기준일</label>
              <input type="date" value={editingReport.report_date} onChange={e => setEditingReport((r: any) => ({ ...r, report_date: e.target.value }))} style={fieldStyle} />
            </div>
          </div>
        </div>

        {/* 프로젝트별 편집 */}
        {editingReport.projects.map((rp: any) => {
          const proj = projects.find(p => p.id === rp.id);
          if (!proj) return null;
          const hc = HEALTH_LABEL[proj.health] ?? HEALTH_LABEL.good;

          return (
            <div key={rp.id} className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${rp.included ? "var(--border)" : "var(--border)"}`, opacity: rp.included ? 1 : 0.5 }}>
              {/* 프로젝트 헤더 */}
              <div className="flex items-center justify-between px-5 py-3"
                style={{ background: "var(--bg-3)", borderBottom: rp.included ? "1px solid var(--border)" : "none" }}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={rp.included} onChange={e => updateProject(rp.id, "included", e.target.checked)}
                    className="rounded" />
                  <div className="w-2 h-2 rounded-full" style={{ background: hc.color }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{proj.name}</p>
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>실제 진행률 {proj.actualRate}% · 완료 {proj.done}/{proj.total}</span>
                  {proj.overdue > 0 && <span className="text-xs" style={{ color: "#FF4D6A" }}>지연 {proj.overdue}건</span>}
                </div>
              </div>

              {rp.included && (
                <div className="p-5 space-y-4">
                  {/* 현황 요약 */}
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>현황 요약 (외부 공개용)</label>
                    <textarea value={rp.summary} onChange={e => updateProject(rp.id, "summary", e.target.value)}
                      placeholder="외부에 공개할 프로젝트 현황을 간략히 작성해주세요"
                      rows={2} style={{ ...fieldStyle, resize: "none" }} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* 표시 진행률 */}
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>
                        표시 진행률 <span style={{ color: "var(--text-3)" }}>(실제: {proj.actualRate}%)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} value={rp.displayRate}
                          onChange={e => updateProject(rp.id, "displayRate", Number(e.target.value))}
                          style={{ flex: 1 }} />
                        <span className="text-sm font-bold w-10 text-right" style={{ color: "#A78BFA" }}>{rp.displayRate}%</span>
                      </div>
                    </div>

                    {/* 다음 계획 */}
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>다음 주요 일정</label>
                      <input value={rp.nextPlan} onChange={e => updateProject(rp.id, "nextPlan", e.target.value)}
                        placeholder="예: 5월 15일 1차 결과 보고" style={fieldStyle} />
                    </div>
                  </div>

                  {/* 마일스톤 선택 */}
                  {proj.milestones.length > 0 && (
                    <div>
                      <label className="text-xs mb-2 block" style={{ color: "var(--text-3)" }}>공개할 마일스톤 선택</label>
                      <div className="space-y-1.5">
                        {proj.milestones.map((m: any) => (
                          <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              checked={(rp.selectedMilestones ?? []).includes(m.id)}
                              onChange={() => toggleMilestone(rp.id, m.id)} />
                            <span className="text-xs" style={{ color: "var(--text-2)" }}>{m.title}</span>
                            <span className="text-xs" style={{ color: "var(--text-3)" }}>
                              {m.status === "completed" ? "✓ 완료" : m.status === "in_progress" ? "진행 중" : "계획"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 표시 옵션 */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-2)" }}>
                      <input type="checkbox" checked={rp.showMembers} onChange={e => updateProject(rp.id, "showMembers", e.target.checked)} />
                      팀 구성 표시
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-2)" }}>
                      <input type="checkbox" checked={rp.showRisk} onChange={e => updateProject(rp.id, "showRisk", e.target.checked)} />
                      리스크 표시
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── 미리보기 / 인쇄 ──────────────────────────────
  if (mode === "preview" && editingReport) {
    const includedProjects = (editingReport.projects ?? []).filter((p: any) => p.included);
    const reportDateStr = new Date(editingReport.report_date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    return (
      <div>
        {/* 화면 전용 버튼 */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("list")} className="text-xs" style={{ color: "var(--text-3)" }}>← 목록</button>
            <span style={{ color: "var(--border)" }}>|</span>
            {isAdmin && (
              <button onClick={() => setMode("edit")} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                수정
              </button>
            )}
          </div>
          <button onClick={() => window.print()}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff", boxShadow: "0 0 16px rgba(167,139,250,0.3)" }}>
            🖨 PDF / 인쇄
          </button>
        </div>

        {/* 보고서 본문 */}
        <div id="print-area" style={{ fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif", maxWidth: 800, margin: "0 auto" }}>
          {/* 헤더 */}
          <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: "2px solid #1E3050" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 10, color: "#4A7099", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>PROJECT STATUS REPORT</p>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E8F4FF", margin: 0 }}>{editingReport.title}</h1>
                <p style={{ fontSize: 12, color: "#4A7099", marginTop: 6 }}>기준일: {reportDateStr}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#00C2CC", letterSpacing: 2 }}>TASKFLOW</p>
                <p style={{ fontSize: 10, color: "#4A7099", marginTop: 2 }}>업무 관리 시스템</p>
              </div>
            </div>
          </div>

          {/* 프로젝트별 */}
          {includedProjects.map((rp: any, pi: number) => {
            const proj = projects.find(p => p.id === rp.id);
            if (!proj) return null;
            const hc = HEALTH_LABEL[rp.health ?? proj.health] ?? HEALTH_LABEL.good;
            const selMilestones = proj.milestones.filter((m: any) => (rp.selectedMilestones ?? []).includes(m.id));

            return (
              <div key={rp.id} style={{ marginBottom: 24, background: "#111D30", border: "1px solid #1E3050", borderRadius: 16, overflow: "hidden", pageBreakInside: "avoid" }}>
                {/* 프로젝트 헤더 */}
                <div style={{ padding: "14px 20px", background: "#0D1B2E", borderBottom: "1px solid #1E3050" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: hc.color, boxShadow: `0 0 8px ${hc.color}` }} />
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E8F4FF", margin: 0 }}>{rp.name}</h2>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${hc.color}22`, color: hc.color, fontWeight: 600 }}>{hc.label}</span>
                      {rp.end_date && <span style={{ fontSize: 11, color: "#4A7099" }}>마감: {new Date(rp.end_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: hc.color }}>{rp.displayRate}%</span>
                  </div>
                  {/* 진행률 바 */}
                  <div style={{ height: 6, background: "#1E3050", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${rp.displayRate}%`, background: hc.color, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ padding: "16px 20px" }}>
                  {/* 현황 요약 */}
                  {rp.summary && (
                    <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(167,139,250,0.08)", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)" }}>
                      <p style={{ fontSize: 12, color: "#E8F4FF", lineHeight: 1.6, margin: 0 }}>{rp.summary}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: selMilestones.length > 0 ? "1fr 1fr" : "1fr", gap: 16 }}>
                    {/* 마일스톤 */}
                    {selMilestones.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, color: "#4A7099", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>마일스톤</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selMilestones.map((m: any, i: number) => {
                            const isDone = m.status === "completed";
                            const isProgress = m.status === "in_progress";
                            const color = isDone ? "#00D4A0" : isProgress ? "#2E86FF" : "#7BA7C8";
                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: isDone ? "#4A7099" : "#E8F4FF", flex: 1, textDecoration: isDone ? "line-through" : "none" }}>{m.title}</span>
                                <span style={{ fontSize: 10, color, flexShrink: 0 }}>{isDone ? "완료" : isProgress ? "진행 중" : "계획"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* 다음 계획 */}
                      {rp.nextPlan && (
                        <div>
                          <p style={{ fontSize: 10, color: "#4A7099", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>다음 주요 일정</p>
                          <p style={{ fontSize: 12, color: "#E8F4FF", margin: 0 }}>📅 {rp.nextPlan}</p>
                        </div>
                      )}

                      {/* 팀 구성 */}
                      {rp.showMembers && proj.members.length > 0 && (
                        <div>
                          <p style={{ fontSize: 10, color: "#4A7099", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>팀 구성</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {proj.members.slice(0, 6).map((m: any, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "#1E3050", borderRadius: 20 }}>
                                <span style={{ fontSize: 10, color: "#E8F4FF" }}>{m.user?.name}</span>
                                <span style={{ fontSize: 9, color: "#4A7099" }}>{m.role === "leader" ? "리더" : m.role === "reviewer" ? "리뷰어" : "멤버"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 리스크 */}
                      {rp.showRisk && proj.blocked > 0 && (
                        <div>
                          <p style={{ fontSize: 10, color: "#FF4D6A", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>⚠ 리스크</p>
                          <p style={{ fontSize: 11, color: "#FF4D6A", margin: 0 }}>Blocked 업무 {proj.blocked}건</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 푸터 */}
          <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid #1E3050", display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 10, color: "#2A4060", margin: 0 }}>본 보고서는 TaskFlow 업무 관리 시스템에서 작성되었습니다</p>
            <p style={{ fontSize: 10, color: "#2A4060", margin: 0 }}>{reportDateStr} 기준</p>
          </div>
        </div>

        <style>{`
          @media print {
            @page { margin: 12mm; size: A4; }
            body { background: #0D1B2E !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            aside, nav { display: none !important; }
            main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
            .print\\:hidden { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
