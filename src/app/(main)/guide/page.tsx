// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const ROLE_CONFIG = {
  admin:    { label: "Admin",    color: "#DC2626", emoji: "⚙" },
  leader:   { label: "Leader",   color: "#D97706", emoji: "★" },
  member:   { label: "Member",   color: "#2563EB", emoji: "◎" },
  reviewer: { label: "Reviewer", color: "#7C3AED", emoji: "✦" },
  viewer:   { label: "Viewer",   color: "#16A34A", emoji: "👁" },
};

const GUIDES = {
  admin: {
    summary: "시스템 전체를 관리하고 팀 운영을 총괄합니다. 모든 기능에 접근할 수 있습니다.",
    daily: {
      title: "매일 이것만 하세요",
      steps: [
        "홈 화면에서 AI 브리핑과 긴급 알림(마감초과/Blocked) 확인",
        "알림 벨(🔔)에서 새 알림 확인 및 처리",
        "팀원 프로필 페이지에서 🎯 우선순위가 필요한 팀원 점검",
        "주 1회 AI 피드백(팀 전체 모드)으로 전체 건강도 점검",
      ],
    },
    features: [
      { title: "홈", desc: "AI 브리핑 자동 생성, 내 업무, 프로젝트 진행률 한눈에 확인", path: "/dashboard" },
      { title: "프로젝트 관리", desc: "프로젝트 생성/수정/완료 처리, 단계(마일스톤) 설정, 팀 구성", path: "/projects" },
      { title: "업무 관리", desc: "업무 추가/수정/삭제, 담당자 배정, 상태 변경, '미배정' 필터로 프로젝트 없는 업무 관리", path: "/tasks" },
      { title: "팀원 우선순위 지정", desc: "팀원별 업무에 1·2·3 순위와 메모를 부여하면 해당 팀원 홈에 🎯 집중 업무로 표시됨", path: "/admin" },
      { title: "회의 기록", desc: "기본정보·안건·결정사항 구조화 입력 + 음성 파일 여러 개 업로드 → AI 교차 분석", path: "/meeting-note" },
      { title: "반복 업무", desc: "팀 반복 업무(주간 회의 등)와 개인 반복 업무를 탭으로 구분 관리", path: "/recurring" },
      { title: "AI 피드백", desc: "내 업무 / 팀 전체 / 프로젝트별 모드로 분석, 계정별 이전 기록 저장", path: "/ai" },
      { title: "전체 현황 뷰어", desc: "TV 대시보드. 팀 전체 현황이 슬라이드로 자동 전환", path: "/viewer" },
      { title: "팀원 프로필 관리", desc: "강점/스타일/비공개 메모 + 우선순위 + 업무별 노트 관리. Admin 전용", path: "/admin" },
    ],
    tips: [
      "프로젝트 완료 시 '✓ 프로젝트 완료' 버튼을 눌러야 목록에서 정리됩니다",
      "팀원이 여러 프로젝트에 속해 우선순위가 상충되면 직접 최종 순서를 조정해주세요",
      "회의록에서 추출된 업무는 자동 등록되지 않고 프로젝트 리더 승인을 거칩니다",
      "Blocked 업무는 매주 점검해서 해소 방안을 찾아주세요",
      "미배정 업무(프로젝트 없는 업무)는 업무 탭의 '미배정' 필터로 모아볼 수 있습니다",
    ],
    donts: [
      "프로젝트를 삭제하면 모든 업무와 기록이 사라집니다. 완료 처리를 사용하세요",
      "팀원 역할 변경 시 해당 팀원에게 미리 안내해주세요",
    ],
  },
  leader: {
    summary: "담당 프로젝트의 업무 흐름을 관리하고 팀원 업무를 조율합니다.",
    daily: {
      title: "매일 이것만 하세요",
      steps: [
        "담당 프로젝트 페이지에서 진행 중 업무 상태 확인",
        "Blocked 업무 있으면 원인 파악 후 해소 조치",
        "회의록에서 추출된 업무 검토 → 승인/수정/반려 처리",
        "팀원이 헷갈려 하면 업무 우선순위 지정으로 방향을 명확히 해주세요",
      ],
    },
    features: [
      { title: "프로젝트 상세", desc: "단계별 업무 현황, 진행률, 팀원 배정 관리", path: "/projects" },
      { title: "단계 관리", desc: "프로젝트 내 마일스톤(단계) 추가/수정/완료 처리. 업무 탭 > + 단계 관리" },
      { title: "AI 피드백 (프로젝트 모드)", desc: "프로젝트 개요 탭에서 AI 피드백 분석 → 위험도, 제안 즉시 승인/거절 가능" },
      { title: "회의 기록", desc: "구조화된 회의록 작성 + 음성 파일 업로드 → AI가 교차 분석해서 업무 추출", path: "/meeting-note" },
      { title: "캘린더", desc: "팀 일정과 업무 마감일을 한눈에 확인", path: "/calendar" },
      { title: "업무 미배정 필터", desc: "프로젝트에 속하지 않은 임시·단발 업무를 모아서 관리", path: "/tasks" },
    ],
    tips: [
      "업무 상세 > 캘린더 표시 토글을 켜면 해당 업무가 팀 캘린더에 보입니다",
      "회의 기록에서 음성과 텍스트를 함께 올리면 AI가 서로 보완해서 더 정확하게 업무를 추출합니다",
      "단계 상태(계획/진행 중/완료)는 마일스톤 헤더의 드롭다운에서 바로 변경 가능합니다",
      "업무 마감일을 변경하면 담당자에게 자동으로 알림이 발송됩니다",
    ],
    donts: [
      "회의록 업무를 무조건 승인하지 말고, 현실적인 마감일과 담당자를 설정한 후 승인하세요",
      "Blocked 업무를 방치하면 하위 업무들이 연쇄적으로 지연됩니다",
    ],
  },
  member: {
    summary: "담당 업무의 상태를 꾸준히 업데이트하는 것이 핵심입니다.",
    daily: {
      title: "매일 이것만 하세요",
      steps: [
        "홈 화면 상단 🎯 집중 업무 카드 확인 (리더가 지정한 우선순위)",
        "AI 브리핑으로 오늘 챙겨야 할 내용 확인",
        "진행 중인 업무 상태 업데이트 (할 일 → 진행 중 → 완료)",
        "막힌 업무가 있으면 즉시 'Blocked'로 변경하고 사유 입력",
      ],
    },
    features: [
      { title: "홈 — 집중 업무", desc: "리더가 지정한 우선순위 업무가 1·2·3 순서로 표시되고, 카드에서 바로 상태 변경 가능", path: "/dashboard" },
      { title: "내 업무 목록", desc: "내가 담당한 업무만 모아서 확인. 업무 페이지 기본 화면", path: "/tasks" },
      { title: "상태 변경", desc: "업무 카드 왼쪽 상태 버튼(▾) 클릭 → 드롭다운에서 선택. 상세 페이지 열지 않아도 됩니다" },
      { title: "업무 상세", desc: "업무 카드 클릭 → 설명, 댓글, 변경 이력 확인. 필요시 댓글로 진행 상황 공유" },
      { title: "캘린더 표시", desc: "업무 상세에서 토글을 켜면 마감일이 팀 캘린더에도 표시됨" },
      { title: "개인 반복 업무", desc: "매주 보고서 작성 등 나만의 루틴 업무를 등록", path: "/recurring" },
    ],
    tips: [
      "여러 업무가 헷갈리면 홈 화면의 🎯 집중 업무를 우선 처리하세요",
      "상태 변경은 업무 카드나 홈 화면에서 바로 됩니다. 상세 페이지를 열 필요가 없어요",
      "막혔을 때 Blocked로 바꾸는 게 리더에게 가장 빠른 신호입니다. 사유도 꼭 입력해주세요",
      "댓글에 @이름을 입력하면 해당 팀원에게 알림이 갑니다",
    ],
    donts: [
      "완료된 업무를 '진행 중'으로 두지 마세요. 팀 전체 현황이 왜곡됩니다",
      "막힌 업무를 '진행 중'으로 두지 마세요. 리더가 모르게 됩니다",
    ],
  },
  reviewer: {
    summary: "업무 결과물을 검토하고 리뷰 의견을 남기는 역할입니다.",
    daily: {
      title: "매일 이것만 하세요",
      steps: [
        "알림에서 리뷰 요청 확인",
        "리뷰 상태인 업무 상세 페이지에서 내용 검토",
        "댓글로 리뷰 의견 작성",
        "이상 없으면 상태를 '완료'로 변경",
      ],
    },
    features: [
      { title: "업무 상세", desc: "업무 내용, 첨부, 댓글, 변경 이력 확인" },
      { title: "댓글", desc: "리뷰 의견 작성. @이름으로 담당자에게 알림 전송 가능" },
      { title: "상태 변경", desc: "리뷰 완료 시 '완료'로 변경 가능" },
      { title: "캘린더", desc: "팀 일정 확인", path: "/calendar" },
    ],
    tips: [
      "리뷰 의견은 댓글로 구체적으로 남겨주세요",
      "문제가 없으면 바로 '완료'로 변경해주세요",
    ],
    donts: [
      "업무 내용(제목, 담당자, 마감일 등)은 수정할 수 없습니다. 의견은 댓글로 남겨주세요",
    ],
  },
  viewer: {
    summary: "전체 현황을 모니터링하는 역할입니다. 뷰어 페이지를 주로 활용합니다.",
    daily: {
      title: "주로 이렇게 활용하세요",
      steps: [
        "벽걸이 TV의 뷰어 페이지(/viewer)로 팀 전체 현황 확인",
        "프로젝트별 업무 현황과 마감일 모니터링",
        "캘린더에서 팀 전체 일정 파악",
      ],
    },
    features: [
      { title: "전체 현황 뷰어", desc: "팀 대시보드, 프로젝트별 현황, 4주 캘린더가 자동 슬라이드로 전환", path: "/viewer" },
      { title: "홈", desc: "팀 전체 업무 현황 요약", path: "/dashboard" },
      { title: "캘린더", desc: "공개된 팀 일정과 전체 업무 마감일 확인", path: "/calendar" },
    ],
    tips: [
      "뷰어 페이지는 전체화면(⊞) 모드로 보면 더 보기 좋습니다",
      "마우스를 올리면 슬라이드가 멈춥니다. 자세히 볼 때 활용하세요",
      "하단 네비게이션의 '더보기'에서도 전체 현황 뷰어로 바로 이동할 수 있습니다",
    ],
    donts: [
      "업무 추가/수정 권한이 없습니다. 변경 필요시 담당 리더에게 요청하세요",
    ],
  },
};

export default function GuidePage() {
  const supabase = createClient();
  const [myRole, setMyRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState("member");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: u } = await supabase.from("users").select("role").eq("auth_id", data.user.id).single();
        if (u?.role) { setMyRole(u.role); setSelectedRole(u.role); }
      }
    });
  }, []);

  const guide = GUIDES[selectedRole] || GUIDES.member;
  const roleConfig = ROLE_CONFIG[selectedRole] || ROLE_CONFIG.member;

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 18 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "var(--cyan)", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>사용 가이드</h1>
          {myRole && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${ROLE_CONFIG[myRole]?.color}12`, color: ROLE_CONFIG[myRole]?.color, border: `1px solid ${ROLE_CONFIG[myRole]?.color}30` }}>
              내 역할: {ROLE_CONFIG[myRole]?.label}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
          {Object.keys(ROLE_CONFIG).map(role => (
            <button key={role} onClick={() => setSelectedRole(role)}
              style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: "none", transition: "all 0.15s",
                background: selectedRole === role ? `${ROLE_CONFIG[role].color}12` : "transparent",
                color: selectedRole === role ? ROLE_CONFIG[role].color : "var(--text-3)",
              }}>
              {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].label}
            </button>
          ))}
        </div>
      </div>

      {/* 역할 요약 */}
      <div style={{ background: `${roleConfig.color}08`, border: `1px solid ${roleConfig.color}30`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>{roleConfig.emoji}</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: roleConfig.color, margin: 0 }}>{roleConfig.label}</h2>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{guide.summary}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 매일 할 일 */}
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: roleConfig.color }}>✓</span> {guide.daily.title}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {guide.daily.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1, background: `${roleConfig.color}12`, color: roleConfig.color }}>
                  {i + 1}
                </span>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 주요 기능 */}
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>📌 주요 기능</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {guide.features.map((f, i) => (
              <div key={i} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{f.title}</p>
                  {f.path && <a href={f.path} style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>바로가기 →</a>}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 팁 / 주의사항 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#16A34A" }}>💡</span> 이렇게 하면 편해요
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {guide.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#16A34A", flexShrink: 0, marginTop: 6 }} />
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#DC2626" }}>⚠</span> 이건 주의하세요
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {guide.donts.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#DC2626", flexShrink: 0, marginTop: 6 }} />
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          궁금한 점이 있으면 Admin이나 담당 Leader에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
