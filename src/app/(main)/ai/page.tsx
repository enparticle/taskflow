// @ts-nocheck
"use client";
import { useState } from "react";
import PlanningFeedback from "@/components/tasks/PlanningFeedback";

export default function AIPage() {
  const [tab, setTab] = useState<"feedback" | "meeting">("feedback");
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>AI 어시스턴트</h1>
      </div>
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", display: "inline-flex" }}>
        {([["feedback","AI 피드백"],["meeting","회의 기록"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="rounded-lg px-4 py-1.5 text-xs font-medium transition-all"
            style={{
              background: tab === key ? "var(--cyan)" : "transparent",
              color: tab === key ? "#fff" : "var(--text-3)",
              border: "none", cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "feedback" && <PlanningFeedback mode="full" />}
      {tab === "meeting" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            회의 기록 페이지로 이동합니다.
          </p>
          <a href="/meeting-note" className="inline-block mt-3 text-sm font-medium" style={{ color: "var(--cyan)" }}>
            📝 회의 기록 열기 →
          </a>
        </div>
      )}
    </div>
  );
}
