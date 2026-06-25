// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

function ProgressBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

const TASK_TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "미팅",
  research: "리서치", customer: "고객 대응", other: "기타",
};
const TYPE_COLORS = ["#2563EB","#16A34A","#D97706","#7C3AED","#DC2626","#0891B2","#D946EF","#EA580C","#65A30D","#6B7280"];
const HEALTH_COLOR: Record<string, string> = { good: "#16A34A", reviewing: "#2563EB", at_risk: "#D97706", critical: "#DC2626" };
const STATUS_LABEL: Record<string, string> = { backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰" };
const STATUS_COLOR: Record<string, string> = { backlog: "#A8A8A4", todo: "#2563EB", doing: "#2563EB", blocked: "#DC2626", review: "#D97706" };

export default function ReportsPage() {
  const supabase = createClient();
  const [myUser, setMyUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myLeaderProjects, setMyLeaderProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState<"month" | "quarter" | "all">("month");

  useEffect(() => {
    async function init() {
      const authUser = await getAuthUser();
      if (!authUser) return;
      setMyUser(authUser);
      setIsAdmin(authUser.role === "admin");
      const { data: projects } = await supabase.from("projects").select("id, name, health").eq("status", "active").order("created_at");
      setAllProjects(projects ?? []);
      if (authUser.role !== "admin") {
        const { data: memberships } = await supabase.from("project_members")
          .select("project_id, project:projects(id, name)").eq("user_id", authUser.userId).eq("role", "leader");
        const leaderProjects = (memberships ?? []).map(m => m.project).filter(Boolean);
        setMyLeaderProjects(leaderProjects);
        if (leaderProjects.length > 0) setSelectedProjectId(leaderProjects[0].id);
      }
    }
    init();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let since: Date | null = null;
    if (period === "month") { since = new Date(now); since.setMonth(since.getMonth() - 1); }
    if (period === "quarter") { since = new Date(now); since.setMonth(since.getMonth() - 3); }

    let q = supabase.from("tasks").select("*");
    if (selectedProjectId !== "all") q = q.eq("project_id", selectedProjectId);
    if (since) q = q.gte("created_at", since.toISOString());
    const { data: tasks } = await q;
    const { data: users } = await supabase.from("users").select("id, name, role").eq("is_active", true).neq("role", "viewer");
    const { data: events } = await supabase.from("task_events").select("*").eq("to_status", "blocked").order("changed_at");

    const t = tasks ?? [];
    const done = t.filter(x => x.status === "done");
    const withEstimate = t.filter(x => x.estimated_hours && x.actual_hours);
    const overdue = done.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) > new Date(x.due_date));
    const onTime = done.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) <= new Date(x.due_date));

    const timeAccuracy = withEstimate.map(x => ({
      title: x.title, estimated: x.estimated_hours, actual: x.actual_hours,
      ratio: Math.round((x.actual_hours / x.estimated_hours) * 100),
    })).sort((a, b) => b.ratio - a.ratio);

    const memberStats = (users ?? []).map(u => {
      const mine = t.filter(x => x.assignee_id === u.id || (x.assignee_ids ?? []).includes(u.id));
      const myDone = mine.filter(x => x.status === "done");
      const myBlocked = mine.filter(x => x.status === "blocked");
      const myOnTime = myDone.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) <= new Date(x.due_date));
      return {
        ...u, total: mine.length, done: myDone.length, blocked: myBlocked.length,
        onTimeRate: myDone.length > 0 ? Math.round((myOnTime.length / myDone.length) * 100) : 0,
      };
    }).filter(u => u.total > 0).sort((a, b) => b.done - a.done);

    const typeMap: Record<string, { count: number; hours: number }> = {};
    t.forEach(x => {
      const k = x.task_type ?? "other";
      if (!typeMap[k]) typeMap[k] = { count: 0, hours: 0 };
      typeMap[k].count++;
      typeMap[k].hours += x.actual_hours ?? 0;
    });
    const typeDist = Object.entries(typeMap)
      .map(([k, v]) => ({ type: k, label: TASK_TYPE_LABEL[k] ?? k, ...v }))
      .sort((a, b) => b.count - a.count);

    let projectStats: any[] = [];
    if (selectedProjectId === "all") {
      const { data: projs } = await supabase.from("projects").select("id, name, health").eq("status", "active");
      projectStats = (projs ?? []).map(p => {
        const pt = t.filter(x => x.project_id === p.id);
        const pd = pt.filter(x => x.status === "done");
        return { ...p, total: pt.length, done: pd.length, rate: pt.length > 0 ? Math.round((pd.length / pt.length) * 100) : 0, blocked: pt.filter(x => x.status === "blocked").length };
      }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);
    }

    const { data: allEvents } = await supabase.from("task_events").select("*").order("changed_at", { ascending: true });
    const stayTimes: Record<string, number[]> = { backlog: [], todo: [], doing: [], blocked: [], review: [] };
    if (allEvents) {
      const taskEvents: Record<string, any[]> = {};
      allEvents.forEach(e => { if (!taskEvents[e.task_id]) taskEvents[e.task_id] = []; taskEvents[e.task_id].push(e); });
      Object.values(taskEvents).forEach((evs: any[]) => {
        for (let i = 0; i < evs.length; i++) {
          const from = evs[i].from_status;
          const next = evs[i + 1];
          if (from && stayTimes[from] !== undefined && next) {
            const hours = (new Date(next.changed_at).getTime() - new Date(evs[i].changed_at).getTime()) / 3600000;
            if (hours > 0 && hours < 720) stayTimes[from].push(hours);
          }
        }
      });
    }
    const bottleneck = Object.entries(stayTimes).map(([status, times]) => ({
      status, avg: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10 : 0,
      count: times.length, max: times.length > 0 ? Math.round(Math.max(...times) * 10) / 10 : 0,
    })).filter(b => b.count > 0).sort((a, b) => b.avg - a.avg);

    setData({
      total: t.length, done: done.length,
      onTimeRate: done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 0,
      overdueCount: overdue.length, estimateCount: withEstimate.length,
      avgRatio: withEstimate.length > 0 ? Math.round(withEstimate.reduce((s, x) => s + (x.actual_hours / x.estimated_hours), 0) / withEstimate.length * 100) : null,
      timeAccuracy: timeAccuracy.slice(0, 8), memberStats, typeDist, projectStats, bottleneck,
    });
    setLoading(false);
  }, [selectedProjectId, period]);

  useEffect(() => { if (myUser) load(); }, [load, myUser]);

  const canAccessAll = isAdmin;
  const accessibleProjects = isAdmin ? allProjects : myLeaderProjects;

  if (!myUser) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>
    </div>
  );

  if (!isAdmin && myLeaderProjects.length === 0) return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>접근 권한이 없습니다</p>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>리포트는 관리자 또는 프로젝트 리더만 열람할 수 있습니다</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "#7C3AED", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>업무 리포트</h1>
          {!isAdmin && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid #BFDBFE" }}>리더 뷰</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* 기간 필터 */}
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
            {[{ v: "month", l: "1개월" }, { v: "quarter", l: "3개월" }, { v: "all", l: "전체" }].map(o => (
              <button key={o.v} onClick={() => setPeriod(o.v as any)}
                style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500, border: "none", cursor: "pointer", background: period === o.v ? "var(--bg-4)" : "transparent", color: period === o.v ? "var(--text-1)" : "var(--text-3)" }}>
                {o.l}
              </button>
            ))}
          </div>
          {/* 프로젝트 필터 */}
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-1)", outline: "none", colorScheme: "light" }}>
            {canAccessAll && <option value="all">전체 프로젝트</option>}
            {accessibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 24, height: 24, border: "3px solid #7C3AED", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>분석 중…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>
      ) : data && (
        <>
          {/* 요약 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <StatCard label="전체 업무" value={data.total} color="#2563EB" sub={`완료 ${data.done}건`} />
            <StatCard label="기한 내 완료율" value={`${data.onTimeRate}%`} color="#16A34A" sub={`지연 완료 ${data.overdueCount}건`} />
            <StatCard label="예상 시간 정확도"
              value={data.avgRatio ? `${data.avgRatio}%` : "-"}
              color={data.avgRatio > 120 ? "#DC2626" : data.avgRatio > 100 ? "#D97706" : "#16A34A"}
              sub={data.avgRatio ? (data.avgRatio > 100 ? "예상보다 오래 걸림" : "예상 시간 내 완료") : "데이터 없음"} />
            <StatCard label="시간 데이터 있는 업무" value={data.estimateCount} color="#7C3AED" sub="예상+실제 시간 입력" />
          </div>

          {/* 2열 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* 팀원별 성과 */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 16 }}>팀원별 성과</p>
              {data.memberStats.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>데이터 없음</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {data.memberStats.map((m: any, i: number) => (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--cyan)" }}>
                            {m.name[0]}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>{m.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "#16A34A" }}>완료 {m.done}</span>
                          {m.blocked > 0 && <span style={{ fontSize: 11, color: "#DC2626" }}>Blocked {m.blocked}</span>}
                          <span style={{ fontSize: 11, fontWeight: 600, color: m.onTimeRate >= 80 ? "#16A34A" : "#D97706" }}>기한 {m.onTimeRate}%</span>
                        </div>
                      </div>
                      <ProgressBar value={m.done} max={Math.max(...data.memberStats.map((x: any) => x.done), 1)} color="#16A34A" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 업무 유형 분포 */}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 16 }}>업무 유형 분포</p>
              {data.typeDist.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>데이터 없음</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.typeDist.map((t: any, i: number) => (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <span style={{ fontSize: 12, color: "var(--text-2)" }}>{t.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t.count}건</span>
                          {t.hours > 0 && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{Math.round(t.hours)}h</span>}
                        </div>
                      </div>
                      <ProgressBar value={t.count} max={data.typeDist[0]?.count ?? 1} color={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 예상 vs 실제 시간 */}
          {data.timeAccuracy.length > 0 && (
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 14 }}>예상 vs 실제 소요 시간 (완료 업무)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.timeAccuracy.map((t: any, i: number) => {
                  const over = t.ratio > 100;
                  const color = t.ratio > 150 ? "#DC2626" : t.ratio > 100 ? "#D97706" : "#16A34A";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>예상 {t.estimated}h → 실제 {t.actual}h</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${color}10`, color, flexShrink: 0 }}>
                        {over ? "+" : ""}{t.ratio - 100}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 프로젝트별 현황 */}
          {selectedProjectId === "all" && data.projectStats.length > 0 && (
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 14 }}>프로젝트별 진행 현황</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.projectStats.map((p: any, i: number) => {
                  const hc = HEALTH_COLOR[p.health] ?? "#A8A8A4";
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: hc }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>{p.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.done}/{p.total}</span>
                          {p.blocked > 0 && <span style={{ fontSize: 11, color: "#DC2626" }}>Blocked {p.blocked}</span>}
                          <span style={{ fontSize: 11, fontWeight: 700, color: hc }}>{p.rate}%</span>
                        </div>
                      </div>
                      <ProgressBar value={p.rate} color={hc} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 병목 분석 */}
          {data.bottleneck && data.bottleneck.length > 0 && (
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 3, height: 16, background: "#D97706", borderRadius: 2 }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>병목 분석 — 상태별 평균 체류 시간</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 14 }}>
                {data.bottleneck.map((b: any) => {
                  const color = STATUS_COLOR[b.status] ?? "#A8A8A4";
                  const isBottleneck = b.avg === Math.max(...data.bottleneck.map((x: any) => x.avg));
                  return (
                    <div key={b.status} style={{ textAlign: "center", padding: "12px 8px", background: `${color}08`, border: `1px solid ${color}${isBottleneck ? "66" : "22"}`, borderRadius: 10 }}>
                      {isBottleneck && <p style={{ fontSize: 10, color, marginBottom: 4 }}>⚠ 병목</p>}
                      <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)", margin: "0 0 6px" }}>{STATUS_LABEL[b.status]}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>
                        {b.avg >= 24 ? `${Math.round(b.avg/24)}일` : `${b.avg}h`}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0" }}>평균</p>
                      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>{b.count}건 기준</p>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                평균 체류 시간이 긴 상태가 병목입니다. Blocked나 Review에서 오래 머무른다면 프로세스 개선이 필요합니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
