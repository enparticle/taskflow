// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLOR: Record<string, string> = {
  todo: "#7BA7C8", doing: "#2E86FF", blocked: "#FF4D6A", review: "#F5A623",
};
const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  good:      { label: "정상",     color: "#00D4A0" },
  reviewing: { label: "검토 필요", color: "#2E86FF" },
  at_risk:   { label: "주의",     color: "#F5A623" },
  critical:  { label: "위험",     color: "#FF4D6A" },
  suspended: { label: "중단",     color: "#71717A" },
};

const SLIDE_SECONDS = 8;
const REFRESH_SECONDS = 60;

export default function ViewerPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/viewer-snapshot");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError("");
    } catch (e: any) {
      setError(e.message ?? "데이터를 불러오지 못했어요");
    }
  }, []);

  useEffect(() => {
    load();
    const dataTimer = setInterval(load, REFRESH_SECONDS * 1000);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [load]);

  // 슬라이드: [전체 요약, ...프로젝트별]
  const slides = data ? [{ type: "overall" }, ...data.projects.map((p: any) => ({ type: "project", project: p }))] : [];

  useEffect(() => {
    if (slides.length === 0) return;
    setProgress(0);
    const step = 100 / (SLIDE_SECONDS * 10);
    const progressTimer = setInterval(() => {
      setProgress(p => Math.min(p + step, 100));
    }, 100);
    const advanceTimer = setTimeout(() => {
      setSlideIdx(i => (i + 1) % slides.length);
    }, SLIDE_SECONDS * 1000);
    return () => { clearInterval(progressTimer); clearTimeout(advanceTimer); };
  }, [slideIdx, slides.length]);

  useEffect(() => {
    if (slideIdx >= slides.length) setSlideIdx(0);
  }, [slides.length]);

  if (error) return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 24, color: "#FF4D6A" }}>⚠ {error}</p>
        <p style={{ fontSize: 14, color: "#4A7099", marginTop: 12 }}>잠시 후 자동으로 다시 시도해요</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={pageStyle}>
      <p style={{ fontSize: 18, color: "#4A7099" }}>불러오는 중…</p>
    </div>
  );

  const slide = slides[slideIdx];

  return (
    <div style={pageStyle}>
      {/* 상단 바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00C2CC", boxShadow: "0 0 12px #00C2CC" }} />
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#E8F4FF" }}>TASKFLOW</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 28, fontWeight: 700, color: "#E8F4FF", margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p style={{ fontSize: 13, color: "#4A7099", margin: "2px 0 0" }}>
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
      </div>

      {/* 슬라이드 본문 */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 64px" }}>
        {slide?.type === "overall" && <OverallSlide data={data} />}
        {slide?.type === "project" && <ProjectSlide project={slide.project} />}
      </div>

      {/* 하단 진행 표시 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 28 }}>
        {slides.map((_, i) => (
          <div key={i} style={{ width: 40, height: 4, borderRadius: 2, background: "#1E3050", overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "#00C2CC", borderRadius: 2,
              width: i === slideIdx ? `${progress}%` : i < slideIdx ? "100%" : "0%",
              transition: i === slideIdx ? "width 0.1s linear" : "none",
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OverallSlide({ data }: { data: any }) {
  const stats = [
    { label: "할 일", value: data.overall.todo, color: STATUS_COLOR.todo },
    { label: "진행 중", value: data.overall.doing, color: STATUS_COLOR.doing },
    { label: "리뷰", value: data.overall.review, color: STATUS_COLOR.review },
    { label: "Blocked", value: data.overall.blocked, color: STATUS_COLOR.blocked },
  ];
  return (
    <div style={{ width: "100%", maxWidth: 1100 }}>
      <p style={{ fontSize: 15, color: "#4A7099", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>전체 현황</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} style={{ textAlign: "center", padding: "28px 0", background: "#111D30", border: `1px solid ${s.color}33`, borderRadius: 20 }}>
            <p style={{ fontSize: 56, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 15, color: "#7BA7C8", marginTop: 10 }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 32 }}>
        {data.overall.overdue > 0 && (
          <p style={{ fontSize: 16, color: "#FF4D6A", margin: 0 }}>⚠ 마감 초과 {data.overall.overdue}건</p>
        )}
        {data.overall.unassigned > 0 && (
          <p style={{ fontSize: 16, color: "#7BA7C8", margin: 0 }}>📁 프로젝트 미배정 {data.overall.unassigned}건</p>
        )}
      </div>
      {data.projects.length > 0 && (
        <div>
          <p style={{ fontSize: 13, color: "#4A7099", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>프로젝트</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {data.projects.map((p: any) => {
              const h = HEALTH_LABEL[p.health] ?? HEALTH_LABEL.good;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#111D30", border: `1px solid ${h.color}33`, borderRadius: 30 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: h.color }} />
                  <span style={{ fontSize: 15, color: "#E8F4FF" }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: h.color }}>{h.label}</span>
                  <span style={{ fontSize: 12, color: "#4A7099" }}>· {p.total}건</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSlide({ project }: { project: any }) {
  const h = HEALTH_LABEL[project.health] ?? HEALTH_LABEL.good;
  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: h.color, boxShadow: `0 0 14px ${h.color}` }} />
        <div>
          <p style={{ fontSize: 34, fontWeight: 800, color: "#E8F4FF", margin: 0 }}>{project.name}</p>
          <div style={{ display: "flex", gap: 14, marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: h.color, fontWeight: 600 }}>{h.label}</span>
            {project.counts.doing > 0 && <span style={{ fontSize: 14, color: STATUS_COLOR.doing }}>진행 중 {project.counts.doing}</span>}
            {project.counts.blocked > 0 && <span style={{ fontSize: 14, color: STATUS_COLOR.blocked }}>Blocked {project.counts.blocked}</span>}
            {project.counts.todo > 0 && <span style={{ fontSize: 14, color: STATUS_COLOR.todo }}>할 일 {project.counts.todo}</span>}
            {project.counts.review > 0 && <span style={{ fontSize: 14, color: STATUS_COLOR.review }}>리뷰 {project.counts.review}</span>}
          </div>
        </div>
      </div>

      {project.tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#4A7099", fontSize: 16 }}>진행 중인 업무가 없어요</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {project.tasks.map((t: any) => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
              background: "#111D30", border: `1px solid ${STATUS_COLOR[t.status] ?? "#1E3050"}33`, borderRadius: 14,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                background: `${STATUS_COLOR[t.status] ?? "#7BA7C8"}22`, color: STATUS_COLOR[t.status] ?? "#7BA7C8", flexShrink: 0,
              }}>
                {t.statusLabel}
              </span>
              <span style={{ flex: 1, fontSize: 17, color: "#E8F4FF" }}>{t.title}</span>
              {t.assignees.length > 0 && (
                <span style={{ fontSize: 13, color: "#7BA7C8", flexShrink: 0 }}>{t.assignees.join(", ")}</span>
              )}
              {t.dueDate && (
                <span style={{ fontSize: 13, color: t.overdue ? "#FF4D6A" : "#4A7099", flexShrink: 0 }}>
                  {t.overdue ? "⚠ " : ""}{new Date(t.dueDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0D1B2E",
  display: "flex",
  flexDirection: "column",
  fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif",
};
