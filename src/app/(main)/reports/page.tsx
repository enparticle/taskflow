// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

function ProgressBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--bg-4)" }}>
      <div className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}66` }} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: `${color}08`, border: `1px solid ${color}22` }}>
      <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>}
    </div>
  );
}

const TASK_TYPE_LABEL: Record<string, string> = {
  planning: "기획", design: "디자인", development: "개발", qa: "QA",
  operation: "운영", documentation: "문서화", meeting: "회의",
  research: "리서치", customer: "고객대응", other: "기타",
};
const TYPE_COLORS = ["#00C2CC","#2E86FF","#F5A623","#00D4A0","#A78BFA","#FF4D6A","#7BA7C8","#4A7099","#E879F9","#6B7280"];

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

      const { data: projects } = await supabase
        .from("projects").select("id, name, health").eq("status", "active").order("created_at");
      setAllProjects(projects ?? []);

      if (authUser.role !== "admin") {
        const { data: memberships } = await supabase
          .from("project_members").select("project_id, project:projects(id, name)")
          .eq("user_id", authUser.userId).eq("role", "leader");
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
    const { data: events } = await supabase.from("task_events").select("*")
      .eq("to_status", "blocked").order("changed_at");

    const t = tasks ?? [];
    const done = t.filter(x => x.status === "done");
    const withEstimate = t.filter(x => x.estimated_hours && x.actual_hours);
    const overdue = done.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) > new Date(x.due_date));
    const onTime = done.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) <= new Date(x.due_date));

    // 예상 vs 실제 시간
    const timeAccuracy = withEstimate.map(x => ({
      title: x.title,
      estimated: x.estimated_hours,
      actual: x.actual_hours,
      ratio: Math.round((x.actual_hours / x.estimated_hours) * 100),
    })).sort((a, b) => b.ratio - a.ratio);

    // 구성원별 통계
    const memberStats = (users ?? []).map(u => {
      const mine = t.filter(x => x.assignee_id === u.id || (x.assignee_ids ?? []).includes(u.id));
      const myDone = mine.filter(x => x.status === "done");
      const myBlocked = mine.filter(x => x.status === "blocked");
      const myOnTime = myDone.filter(x => x.due_date && x.completed_at && new Date(x.completed_at) <= new Date(x.due_date));
      const avgActual = myDone.filter(x => x.actual_hours).reduce((s, x) => s + x.actual_hours, 0) / Math.max(myDone.filter(x => x.actual_hours).length, 1);
      return {
        ...u,
        total: mine.length,
        done: myDone.length,
        blocked: myBlocked.length,
        onTimeRate: myDone.length > 0 ? Math.round((myOnTime.length / myDone.length) * 100) : 0,
        avgActual: Math.round(avgActual * 10) / 10,
      };
    }).filter(u => u.total > 0).sort((a, b) => b.done - a.done);

    // 업무 유형별 분포
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

    // Blocked 패턴 - 유형별
    const blockedByType: Record<string, number> = {};
    t.filter(x => x.status === "blocked" || (events ?? []).some(e => e.task_id === x.id)).forEach(x => {
      const k = x.task_type ?? "other";
      blockedByType[k] = (blockedByType[k] ?? 0) + 1;
    });

    // 프로젝트별 (admin only)
    let projectStats: any[] = [];
    if (selectedProjectId === "all") {
      const { data: projs } = await supabase.from("projects").select("id, name, health").eq("status", "active");
      projectStats = (projs ?? []).map(p => {
        const pt = t.filter(x => x.project_id === p.id);
        const pd = pt.filter(x => x.status === "done");
        return {
          ...p,
          total: pt.length,
          done: pd.length,
          rate: pt.length > 0 ? Math.round((pd.length / pt.length) * 100) : 0,
          blocked: pt.filter(x => x.status === "blocked").length,
        };
      }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);
    }

    // 병목 분석 - 각 상태별 평균 체류 시간
    const { data: allEvents } = await supabase
      .from("task_events").select("*").order("changed_at", { ascending: true });

    const stayTimes: Record<string, number[]> = {
      backlog: [], todo: [], doing: [], blocked: [], review: []
    };

    if (allEvents) {
      // task별로 이벤트 그룹핑
      const taskEvents: Record<string, any[]> = {};
      allEvents.forEach(e => {
        if (!taskEvents[e.task_id]) taskEvents[e.task_id] = [];
        taskEvents[e.task_id].push(e);
      });

      Object.values(taskEvents).forEach((evs: any[]) => {
        for (let i = 0; i < evs.length; i++) {
          const from = evs[i].from_status;
          const next = evs[i + 1];
          if (from && stayTimes[from] !== undefined && next) {
            const hours = (new Date(next.changed_at).getTime() - new Date(evs[i].changed_at).getTime()) / 3600000;
            if (hours > 0 && hours < 720) stayTimes[from].push(hours); // 최대 30일
          }
        }
      });
    }

    const bottleneck = Object.entries(stayTimes).map(([status, times]) => ({
      status,
      avg: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10 : 0,
      count: times.length,
      max: times.length > 0 ? Math.round(Math.max(...times) * 10) / 10 : 0,
    })).filter(b => b.count > 0).sort((a, b) => b.avg - a.avg);

    setData({
      total: t.length,
      done: done.length,
      onTimeRate: done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 0,
      overdueCount: overdue.length,
      estimateCount: withEstimate.length,
      avgRatio: withEstimate.length > 0
        ? Math.round(withEstimate.reduce((s, x) => s + (x.actual_hours / x.estimated_hours), 0) / withEstimate.length * 100)
        : null,
      timeAccuracy: timeAccuracy.slice(0, 8),
      memberStats,
      typeDist,
      projectStats,
      blockedByType,
      bottleneck,
    });
    setLoading(false);
  }, [selectedProjectId, period]);

  useEffect(() => {
    if (myUser) load();
  }, [load, myUser]);

  const canAccessAll = isAdmin;
  const accessibleProjects = isAdmin ? allProjects : myLeaderProjects;

  if (!myUser) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: "var(--text-3)" }}>로딩 중…</p>
    </div>
  );

  if (!isAdmin && myLeaderProjects.length === 0) return (
    <div className="max-w-lg">
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-2)" }}>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--text-2)" }}>접근 권한이 없습니다</p>
        <p className="text-xs" style={{ color: "var(--text-3)" }}>리포트는 관리자 또는 프로젝트 리더만 조회할 수 있습니다</p>
      </div>
    </div>
  );

  const HEALTH_COLOR: Record<string, string> = { good: "#00D4A0", at_risk: "#F5A623", critical: "#FF4D6A" };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#A78BFA" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>생산성 리포트</h1>
          {!isAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)" }}>리더 뷰</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 기간 필터 */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            {[{ v: "month", l: "1개월" }, { v: "quarter", l: "3개월" }, { v: "all", l: "전체" }].map(o => (
              <button key={o.v} onClick={() => setPeriod(o.v as any)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: period === o.v ? "var(--bg-4)" : "transparent",
                  color: period === o.v ? "var(--text-1)" : "var(--text-3)",
                  border: period === o.v ? "1px solid var(--border-2)" : "1px solid transparent",
                }}>
                {o.l}
              </button>
            ))}
          </div>
          {/* 프로젝트 필터 */}
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs focus:outline-none"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)", colorScheme: "dark" }}>
            {canAccessAll && <option value="all">전체 프로젝트</option>}
            {accessibleProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="inline-block w-5 h-5 rounded-full border-2 animate-spin mb-2"
              style={{ borderColor: "#A78BFA", borderTopColor: "transparent" }} />
            <p className="text-xs" style={{ color: "var(--text-3)" }}>분석 중…</p>
          </div>
        </div>
      ) : data && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="전체 업무" value={data.total} color="#2E86FF" sub={`완료 ${data.done}건`} />
            <StatCard label="정시 완료율" value={`${data.onTimeRate}%`} color="#00D4A0"
              sub={`지연 완료 ${data.overdueCount}건`} />
            <StatCard label="예상 시간 정확도"
              value={data.avgRatio ? `${data.avgRatio}%` : "-"}
              color={data.avgRatio > 120 ? "#FF4D6A" : data.avgRatio > 100 ? "#F5A623" : "#00D4A0"}
              sub={data.avgRatio ? (data.avgRatio > 100 ? "예상보다 오래 걸림" : "예상 시간 내 완료") : "데이터 없음"} />
            <StatCard label="시간 데이터 있는 업무" value={data.estimateCount} color="#A78BFA"
              sub="예상+실제 시간 입력됨" />
          </div>

          {/* 2열 그리드 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 구성원별 통계 */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-2)" }}>구성원별 생산성</p>
              {data.memberStats.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>데이터 없음</p>
              ) : (
                <div className="space-y-4">
                  {data.memberStats.map((m: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--cyan-bg)", color: "var(--cyan)", fontSize: 10 }}>
                            {m.name[0]}
                          </div>
                          <span className="text-xs font-medium" style={{ color: "var(--text-1)" }}>{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs tabular-nums" style={{ color: "#00D4A0" }}>완료 {m.done}</span>
                          {m.blocked > 0 && <span className="text-xs tabular-nums" style={{ color: "#FF4D6A" }}>Blocked {m.blocked}</span>}
                          <span className="text-xs font-semibold tabular-nums" style={{ color: m.onTimeRate >= 80 ? "#00D4A0" : "#F5A623" }}>
                            정시 {m.onTimeRate}%
                          </span>
                        </div>
                      </div>
                      <ProgressBar value={m.done} max={Math.max(...data.memberStats.map((x: any) => x.done), 1)} color="#00D4A0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 업무 유형별 분포 */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-2)" }}>업무 유형별 분포</p>
              {data.typeDist.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-3)" }}>데이터 없음</p>
              ) : (
                <div className="space-y-3">
                  {data.typeDist.map((t: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <span className="text-xs" style={{ color: "var(--text-2)" }}>{t.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{t.count}건</span>
                          {t.hours > 0 && <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{Math.round(t.hours)}h</span>}
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
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-2)" }}>예상 vs 실제 소요 시간 (완료 업무)</p>
              <div className="space-y-2">
                {data.timeAccuracy.map((t: any, i: number) => {
                  const over = t.ratio > 100;
                  const color = t.ratio > 150 ? "#FF4D6A" : t.ratio > 100 ? "#F5A623" : "#00D4A0";
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                      <span className="flex-1 text-xs truncate" style={{ color: "var(--text-1)" }}>{t.title}</span>
                      <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-3)" }}>
                        예상 {t.estimated}h → 실제 {t.actual}h
                      </span>
                      <span className="text-xs font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-md"
                        style={{ background: `${color}18`, color }}>
                        {over ? "+" : ""}{t.ratio - 100}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 프로젝트별 현황 (전체 조회 시) */}
          {selectedProjectId === "all" && data.projectStats.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-2)" }}>프로젝트별 진행 현황</p>
              <div className="space-y-3">
                {data.projectStats.map((p: any, i: number) => {
                  const hc = HEALTH_COLOR[p.health] ?? "#7BA7C8";
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: hc }} />
                          <span className="text-xs font-medium" style={{ color: "var(--text-1)" }}>{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{p.done}/{p.total}</span>
                          {p.blocked > 0 && <span className="text-xs" style={{ color: "#FF4D6A" }}>Blocked {p.blocked}</span>}
                          <span className="text-xs font-bold tabular-nums" style={{ color: hc }}>{p.rate}%</span>
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
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full" style={{ background: "#F5A623" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>병목 분석 — 상태별 평균 체류 시간</p>
              </div>
              <div className="grid grid-cols-5 gap-3 mb-4">
                {data.bottleneck.map((b: any) => {
                  const STATUS_LABEL: Record<string,string> = { backlog:"백로그", todo:"할 일", doing:"진행 중", blocked:"Blocked", review:"리뷰" };
                  const STATUS_COLOR: Record<string,string> = { backlog:"#4A7099", todo:"#7BA7C8", doing:"#2E86FF", blocked:"#FF4D6A", review:"#F5A623" };
                  const color = STATUS_COLOR[b.status] ?? "#7BA7C8";
                  const isBottleneck = b.avg === Math.max(...data.bottleneck.map((x: any) => x.avg));
                  return (
                    <div key={b.status} className="rounded-xl p-3 text-center"
                      style={{ background: `${color}10`, border: `1px solid ${color}${isBottleneck ? "66" : "22"}`,
                        boxShadow: isBottleneck ? `0 0 12px ${color}22` : "none" }}>
                      {isBottleneck && <p className="text-xs mb-1" style={{ color }}>⚠ 병목</p>}
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                        {STATUS_LABEL[b.status]}
                      </p>
                      <p className="text-lg font-bold tabular-nums" style={{ color }}>
                        {b.avg >= 24 ? `${Math.round(b.avg/24)}일` : `${b.avg}h`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>평균</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{b.count}건 기준</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                💡 체류 시간이 긴 상태가 병목입니다. Blocked나 Review에서 오래 머물면 프로세스 개선이 필요합니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
