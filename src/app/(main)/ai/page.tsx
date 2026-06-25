// @ts-nocheck
"use client";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";

export default function AIPage() {
  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 18, background: "#7C3AED", borderRadius: 2 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>AI 피드백</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
        내 업무, 팀 전체, 또는 특정 프로젝트를 AI가 분석해서 위험 요소와 개선 제안을 알려줍니다.
      </p>
      <PlanningFeedback mode="full" />
    </div>
  );
}
