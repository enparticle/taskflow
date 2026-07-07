// @ts-nocheck
"use client";
import { useState } from "react";

const PHASES = [
  {
    id: 1,
    title: "1단계 — 단순화",
    period: "2026년 7월 ~ 8월",
    goal: "팀원이 부담 없이 열 수 있는 앱",
    color: "#2563EB",
    bg: "#EEF3FF",
    border: "#BFDBFE",
    items: [
      {
        title: "역할별 네비게이션 분리",
        desc: "Member/Leader/Admin이 보는 메뉴를 다르게 구성합니다.",
        detail: "Member는 홈·내 업무·프로젝트만, Leader는 여기에 회의기록 추가, Admin은 전체 메뉴.",
        priority: "highest",
        why: "손감송, 홍성무 피드백 — 인터페이스가 복잡하고 기능이 너무 많다",
      },
      {
        title: "홈 화면 개편",
        desc: "앱을 열었을 때 3초 안에 오늘 내가 할 일이 보입니다.",
        detail: "리더 우선순위 지정 없이도 본인 업무가 중요도 순으로 표시됩니다. AI 브리핑은 접어두고 내 업무를 전면에 배치.",
        priority: "highest",
        why: "홍성무 피드백 — 내 업무나 내가 봐야 할 정보를 획득하는 데 불편함이 있다",
      },
      {
        title: "카드에서 바로 상태 변경",
        desc: "업무 상세 패널을 열지 않고 카드에서 바로 상태를 바꿉니다.",
        detail: "현재는 상세 패널을 열어야만 상태 변경이 가능합니다. 카드 우클릭 또는 상태 버튼 클릭으로 드롭다운 표시.",
        priority: "high",
        why: "진태우 피드백 — 상세 패널을 열어서 상태를 변경합니다 (클릭이 많음)",
      },
    ],
  },
  {
    id: 2,
    title: "2단계 — 자동 입력",
    period: "2026년 8월 ~ 10월",
    goal: "팀원이 입력 안 해도 데이터가 쌓이는 구조",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    items: [
      {
        title: "오늘 일지 기능",
        desc: "오늘 한 일을 자유롭게 적으면 AI가 TaskFlow를 자동으로 업데이트합니다.",
        detail: "기존 업무와 매칭되면 완료 처리 제안, 새 업무면 등록 제안, 진행 중이면 진행률 업데이트 제안. 승인하면 자동 반영.",
        priority: "highest",
        why: "진태우 피드백 — 오늘 무슨 일을 했다고 적으면 AI가 완료 또는 추가할지 물어보는 기능이 있으면 좋겠다",
      },
      {
        title: "주간회의 → 자동 업무 등록",
        desc: "회의록을 올리면 AI가 업무를 추출하고 김성훈님이 한 번에 승인합니다.",
        detail: "현재 검토 대기 프로세스를 없애고, Admin/Leader가 올린 회의록 업무는 바로 등록. 담당자에게 자동 알림.",
        priority: "high",
        why: "회의록 검토 대기 62건 적체 문제, 구두 업무를 TaskFlow로 연결하는 핵심 흐름",
      },
      {
        title: "업무 진행률 표시",
        desc: "doing 상태에 % 진행률을 추가합니다.",
        detail: "0~100% 슬라이더로 진행률 입력. 홈과 프로젝트 페이지에서 시각적으로 표시. doing이 오래 멈춰있는 문제 해소.",
        priority: "medium",
        why: "진태우 피드백 — 진행중·완료 밖에 없는데 진행률 60% 같은 퍼센트도 좋을 것 같다",
      },
    ],
  },
  {
    id: 3,
    title: "3단계 — 모니터링",
    period: "2026년 10월 이후",
    goal: "TV 화면이 실제 팀 현황을 반영",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    items: [
      {
        title: "뷰어 페이지 고도화",
        desc: "데이터가 쌓인 상태에서 TV 화면이 실제 현황을 반영합니다.",
        detail: "팀원별 오늘 업무 현황, 이번 주 완료/진행/지연 한눈에 표시. 주간회의 전 현황 파악용.",
        priority: "medium",
        why: "1~2단계에서 데이터가 쌓인 후 의미 있어지는 기능",
      },
      {
        title: "AI 브리핑 고도화",
        desc: "실제 데이터를 기반으로 정확한 브리핑이 생성됩니다.",
        detail: "지금은 일부 데이터만 반영되어 정확도가 낮습니다. 2단계에서 데이터 밀도가 높아지면 AI 브리핑이 실용적으로 됩니다.",
        priority: "medium",
        why: "데이터 없이 AI 기능을 강화하는 건 의미 없음 — 기록이 먼저, 모니터링은 그 다음",
      },
    ],
  },
];

const PRINCIPLES = [
  {
    icon: "①",
    title: "입력 최소화",
    desc: "팀원이 TaskFlow를 위해 별도로 시간을 쓰지 않아도 데이터가 쌓여야 합니다.",
    color: "#2563EB",
  },
  {
    icon: "②",
    title: "역할별 단순화",
    desc: "Admin은 전체를 보고, Member는 오늘 내 업무만 보면 됩니다. 같은 화면을 보여줄 필요가 없습니다.",
    color: "#16A34A",
  },
  {
    icon: "③",
    title: "기록이 먼저",
    desc: "데이터가 쌓이면 모니터링은 자연스럽게 됩니다. 지금은 기록을 쌓는 단계입니다.",
    color: "#7C3AED",
  },
];

const INSIGHTS = [
  { name: "진태우", quote: "오늘 한 일을 적으면 AI가 완료 처리나 업무 추가를 제안해줬으면 한다", tag: "자동 입력" },
  { name: "홍성무", quote: "내 업무나 내가 봐야 할 정보를 획득하는 데 불편함이 있다", tag: "단순화" },
  { name: "손감송", quote: "인터페이스가 너무 복잡하고 기능이 불필요하게 많다", tag: "단순화" },
];

const PRIORITY_CONFIG = {
  highest: { label: "최우선", color: "#DC2626", bg: "#FEF2F2" },
  high:    { label: "높음",   color: "#D97706", bg: "#FFFBEB" },
  medium:  { label: "보통",   color: "#2563EB", bg: "#EEF3FF" },
};

export default function BetaOverviewPage() {
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 24 }}>

      {/* 헤더 */}
      <div style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)", borderRadius: 16, padding: "28px 32px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.2)", fontWeight: 600 }}>BETA</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>개발 사양서 v1.0 · 2026년 7월</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", letterSpacing: -0.5 }}>TaskFlow 2.0</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "0 0 20px", lineHeight: 1.6 }}>
          팀의 일하는 방식에 맞게 — 입력 최소화, 역할별 단순화, 기록 중심 설계
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: "개발 기간", value: "2026.07 ~ 2026.12" },
            { label: "대상 팀원", value: "전체 6명" },
            { label: "핵심 방향", value: "단순화 → 자동화 → 모니터링" },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: "0 0 3px" }}>{item.label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 왜 만드는가 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>📊 왜 만드는가 — 현황 분석</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "실제 업무 반영률", value: "30~40%", desc: "전체 팀 업무 중 TaskFlow에 있는 비율", color: "#DC2626" },
            { label: "검토 대기 적체", value: "62건", desc: "회의록에서 추출됐지만 처리 안 된 업무", color: "#D97706" },
            { label: "실질 활용자", value: "3~4명", desc: "6명 중 실제로 업데이트하는 팀원 수", color: "#D97706" },
          ].map(item => (
            <div key={item.label} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: item.color, margin: "0 0 4px" }}>{item.value}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: "0 0 4px" }}>{item.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 팀원 피드백 */}
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>팀원 피드백 요약</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INSIGHTS.map(i => (
            <div key={i.name} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>{i.name}</span>
              <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, flex: 1, lineHeight: 1.5 }}>"{i.quote}"</p>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#EEF3FF", color: "#2563EB", fontWeight: 600, flexShrink: 0 }}>{i.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3대 원칙 */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>🎯 설계 원칙</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {PRINCIPLES.map(p => (
            <div key={p.title} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${p.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: p.color, marginBottom: 10 }}>
                {p.icon}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{p.title}</p>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3단계 로드맵 */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>🗺 3단계 로드맵</h2>

        {/* 타임라인 */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, overflowX: "auto" }}>
          {PHASES.map((phase, i) => (
            <div key={phase.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div onClick={() => setActivePhase(activePhase === phase.id ? null : phase.id)}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  background: activePhase === phase.id ? phase.bg : "var(--bg-2)",
                  border: `1px solid ${activePhase === phase.id ? phase.border : "var(--border)"}`,
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: phase.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{phase.id}</span>
                  <p style={{ fontSize: 12, fontWeight: 700, color: activePhase === phase.id ? phase.color : "var(--text-1)", margin: 0 }}>{phase.title.split(" — ")[1]}</p>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{phase.period}</p>
              </div>
              {i < PHASES.length - 1 && (
                <div style={{ width: 24, height: 2, background: "var(--border)", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* 단계별 상세 */}
        {PHASES.map(phase => (
          <div key={phase.id} style={{ marginBottom: 16, background: "var(--bg-2)", border: `1px solid ${activePhase === phase.id ? phase.border : "var(--border)"}`, borderRadius: 14, overflow: "hidden", transition: "all 0.15s" }}>
            {/* 단계 헤더 */}
            <div onClick={() => setActivePhase(activePhase === phase.id ? null : phase.id)}
              style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: activePhase === phase.id ? phase.bg : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: phase.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{phase.id}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: "0 0 2px" }}>{phase.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{phase.period} · {phase.goal}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: phase.bg, color: phase.color, fontWeight: 600, border: `1px solid ${phase.border}` }}>
                  {phase.items.length}개 기능
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{activePhase === phase.id ? "▾" : "▸"}</span>
              </div>
            </div>

            {/* 기능 목록 */}
            {activePhase === phase.id && (
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {phase.items.map((item, idx) => {
                  const key = `${phase.id}-${idx}`;
                  const pc = PRIORITY_CONFIG[item.priority];
                  return (
                    <div key={key} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                      <div onClick={() => setExpandedItem(expandedItem === key ? null : key)}
                        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{pc.label}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: "0 0 3px" }}>{item.title}</p>
                          <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{item.desc}</p>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{expandedItem === key ? "▾" : "▸"}</span>
                      </div>
                      {expandedItem === key && (
                        <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border)" }}>
                          <p style={{ fontSize: 12, color: "var(--text-2)", margin: "12px 0 8px", lineHeight: 1.6 }}>{item.detail}</p>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8 }}>
                            <span style={{ fontSize: 12, flexShrink: 0 }}>💬</span>
                            <p style={{ fontSize: 11, color: "#D97706", margin: 0, lineHeight: 1.5 }}><strong>도입 근거:</strong> {item.why}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 하지 않을 것 */}
      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", marginBottom: 14 }}>🚫 베타에서 하지 않을 것</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            "새로운 AI 분석 기능 추가",
            "새로운 페이지 추가",
            "기존 페이지에 기능 더 얹기",
            "복잡한 권한 설정",
          ].map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#DC2626", fontSize: 14, flexShrink: 0 }}>✕</span>
              <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{item}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#DC2626", marginTop: 12, marginBottom: 0, opacity: 0.7 }}>
          기능 추가보다 기존 기능을 단순화하고 자동화하는 데 집중합니다.
        </p>
      </div>

      {/* 성공 기준 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>✅ 성공 기준</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { phase: "1단계 완료", criterion: "손감송, 홍성무님이 '아, 단순해졌네'를 느낌", color: "#2563EB" },
            { phase: "2단계 완료", criterion: "팀원이 직접 업무를 등록하지 않아도 주간 데이터가 쌓임", color: "#16A34A" },
            { phase: "3단계 완료", criterion: "주간회의 전 TaskFlow만 보고 팀 현황 파악이 됨", color: "#7C3AED" },
          ].map(item => (
            <div key={item.phase} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${item.color}12`, color: item.color, fontWeight: 600, flexShrink: 0 }}>{item.phase}</span>
              <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{item.criterion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 개발 원칙 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>📌 베타 브랜치 안내</h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>현재 운영 버전과 별도로 개발됩니다. 피드백을 반영한 후 main에 통합합니다.</p>
        <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
          <code style={{ fontSize: 12, color: "var(--cyan)", display: "block", marginBottom: 6 }}>git checkout -b beta/taskflow-2.0</code>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>main 브랜치는 현재 운영 버전을 유지합니다. 베타 사용 중 불편한 점은 언제든 피드백해주세요.</p>
        </div>
      </div>

    </div>
  );
}
