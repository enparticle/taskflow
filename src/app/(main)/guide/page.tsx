// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

type Role = "admin" | "leader" | "member" | "reviewer" | "viewer";

const ROLE_CONFIG: Record<Role, { label: string; color: string; emoji: string }> = {
  admin:    { label: "Admin",    color: "#f87171", emoji: "⚙" },
  leader:   { label: "Leader",   color: "#fbbf24", emoji: "★" },
  member:   { label: "Member",   color: "#60a5fa", emoji: "◎" },
  reviewer: { label: "Reviewer", color: "#a78bfa", emoji: "✦" },
  viewer:   { label: "Viewer",   color: "#34d399", emoji: "👁" },
};

const GUIDES: Record<Role, {
  summary: string;
  daily: { title: string; steps: string[] };
  features: { title: string; desc: string; path?: string }[];
  tips: string[];
  donts: string[];
}> = {
  admin: {
    summary: "시스템 전체를 관리하고 팀 운영을 총괄합니다. 모든 기능에 접근할 수 있습니다.",
    daily: {
      title: "매일 이것만 하세요",
      steps: [
        "대시보드에서 전체 프로젝트 현황 확인 (Blocked 업무 있는지 체크)",
        "알림 벨(🔔)에서 새 알림 확인 및 처리",
        "뷰어 페이지가 TV에 정상 표시되는지 확인",
        "주 1회 (월요일) AI 피드백으로 프로젝트 건강도 점검",
      ],
    },
    features: [
      { title: "대시보드", desc: "전체 프로젝트 현황, 팀원별 업무량, 마감 임박 업무 한눈에 확인", path: "/dashboard" },
      { title: "프로젝트 관리", desc: "프로젝트 생성/수정/완료 처리, 단계(마일스톤) 설정, 팀 구성", path: "/projects" },
      { title: "업무 관리", desc: "업무 추가/수정/삭제, 담당자 배정, 상태 변경, 일괄 처리", path: "/tasks" },
      { title: "회의록 분석", desc: "회의 녹음 또는 텍스트 입력 → AI가 업무 자동 추출 → 리더 승인 후 등록", path: "/meeting-note" },
      { title: "전체 현황 뷰어", desc: "TV 대시보드. 팀 전체 현황이 슬라이드로 자동 전환", path: "/viewer" },
      { title: "팀 현황", desc: "팀원별 업무 현황, 역할 관리", path: "/team" },
      { title: "외부용 보고서", desc: "외부 공유용 프로젝트 요약 보고서 생성", path: "/report-export" },
    ],
    tips: [
      "프로젝트 완료 시 '✓ 프로젝트 완료' 버튼을 눌러야 대시보드에서 숨겨집니다",
      "AI 피드백은 업무 데이터가 충분할수록 정확해집니다. 마감일과 담당자를 빠짐없이 입력하세요",
      "회의록에서 추출된 업무는 자동 등록되지 않고 리더 승인을 거칩니다",
      "Blocked 업무는 매주 점검해서 해소 방안을 찾아주세요",
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
        "마감 임박한 업무 담당자에게 확인",
      ],
    },
    features: [
      { title: "프로젝트 상세", desc: "단계별 업무 현황, 진행률, 팀원 배정 관리", path: "/projects" },
      { title: "단계 관리", desc: "프로젝트 내 마일스톤(단계) 추가/수정/완료 처리. 업무 탭 > ⚙ 단계 관리" },
      { title: "업무 검토 패널", desc: "회의록에서 추출된 업무를 승인 전 검토. 프로젝트 개요/업무 탭 상단에 표시됨" },
      { title: "일괄 업무 분류", desc: "여러 업무를 선택해서 단계/상태/담당자 한번에 변경. 업무 목록 체크박스 활용" },
      { title: "캘린더", desc: "팀 일정과 업무 마감일을 한눈에 확인", path: "/calendar" },
      { title: "회의록 분석", desc: "회의 후 녹음/텍스트 입력 → 업무 자동 추출", path: "/meeting-note" },
    ],
    tips: [
      "업무 탭에서 체크박스로 여러 업무를 선택하면 한 번에 단계를 바꿀 수 있습니다",
      "회의록 분석 결과는 프로젝트 개요 탭 상단 '📋 회의록 업무 검토' 패널에서 확인하세요",
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
        "업무 페이지에서 '내 업무' 탭 확인 (기본값)",
        "진행 중인 업무 상태 업데이트 (할 일 → 진행 중 → 완료)",
        "막힌 업무가 있으면 즉시 'Blocked'로 변경하고 사유 입력",
        "완료한 업무는 당일 '완료'로 변경",
      ],
    },
    features: [
      { title: "내 업무 목록", desc: "내가 담당한 업무만 모아서 확인. 업무 페이지 기본 화면", path: "/tasks" },
      { title: "상태 변경", desc: "업무 카드 왼쪽 상태 버튼(▾) 클릭 → 드롭다운에서 선택. 상세 페이지 열지 않아도 됩니다" },
      { title: "업무 상세", desc: "업무 카드 클릭 → 설명, 댓글, 변경 이력 확인. 필요시 댓글로 진행 상황 공유" },
      { title: "캘린더", desc: "내 업무 마감일과 개인 일정(연차 등) 확인 및 등록", path: "/calendar" },
    ],
    tips: [
      "상태 변경은 업무 카드에서 바로 됩니다. 상세 페이지를 열 필요가 없어요",
      "막혔을 때 Blocked로 바꾸는 게 리더에게 가장 빠른 신호입니다. 사유도 꼭 입력해주세요",
      "연차/휴가는 캘린더에서 '연차' 유형으로 등록하면 팀 전체가 확인할 수 있습니다",
      "댓글에 @이름 을 입력하면 해당 팀원에게 알림이 갑니다",
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
      { title: "상태 변경", desc: "리뷰 완료 시 '완료'로 변경 가능 (리뷰어는 상태 변경 권한 있음)" },
      { title: "캘린더", desc: "팀 일정 확인", path: "/calendar" },
    ],
    tips: [
      "리뷰 의견은 댓글로 구체적으로 남겨주세요. 담당자가 수정 후 다시 리뷰 요청을 합니다",
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
      { title: "대시보드", desc: "팀 전체 업무 현황 요약", path: "/dashboard" },
      { title: "캘린더", desc: "공개된 팀 일정과 전체 업무 마감일 확인", path: "/calendar" },
    ],
    tips: [
      "뷰어 페이지는 전체화면(⊞) 모드로 보면 더 보기 좋습니다",
      "마우스를 올리면 슬라이드가 멈춥니다. 자세히 볼 때 활용하세요",
      "새로고침 주기는 1분/5분 중 선택할 수 있습니다",
    ],
    donts: [
      "업무 추가/수정 권한이 없습니다. 변경 필요시 담당 리더에게 요청하세요",
    ],
  },
};

export default function GuidePage() {
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("member");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: u } = await supabase.from("users").select("role").eq("auth_id", data.user.id).single();
        if (u?.role) {
          const r = u.role as Role;
          setMyRole(r);
          setSelectedRole(r);
        }
      }
    });
  }, []);

  const guide = GUIDES[selectedRole];
  const roleConfig = ROLE_CONFIG[selectedRole];

  return (
    <div className="max-w-4xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "var(--cyan)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>사용 가이드</h1>
          {myRole && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: `${ROLE_CONFIG[myRole].color}18`, color: ROLE_CONFIG[myRole].color }}>
              내 역할: {ROLE_CONFIG[myRole].label}
            </span>
          )}
        </div>

        {/* 역할 탭 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          {(Object.keys(ROLE_CONFIG) as Role[]).map(role => (
            <button key={role} onClick={() => setSelectedRole(role)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: selectedRole === role ? `${ROLE_CONFIG[role].color}18` : "transparent",
                color: selectedRole === role ? ROLE_CONFIG[role].color : "var(--text-3)",
                border: selectedRole === role ? `1px solid ${ROLE_CONFIG[role].color}44` : "1px solid transparent",
              }}>
              {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 */}
      <div className="rounded-2xl p-5" style={{ background: `${roleConfig.color}10`, border: `1px solid ${roleConfig.color}33` }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{roleConfig.emoji}</span>
          <h2 className="text-lg font-bold" style={{ color: roleConfig.color }}>{roleConfig.label}</h2>
        </div>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>{guide.summary}</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* 매일 할 일 */}
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text-1)" }}>
            <span style={{ color: roleConfig.color }}>✓</span> {guide.daily.title}
          </h3>
          <div className="space-y-3">
            {guide.daily.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}>
                  {i + 1}
                </span>
                <p className="text-sm" style={{ color: "var(--text-2)" }}>{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 주요 기능 */}
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-1)" }}>📌 주요 기능</h3>
          <div className="grid grid-cols-2 gap-3">
            {guide.features.map((f, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{f.title}</p>
                  {f.path && (
                    <a href={f.path} className="text-xs" style={{ color: "var(--cyan)" }}>바로가기 →</a>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* 팁 */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text-1)" }}>
              <span style={{ color: "#34d399" }}>💡</span> 이렇게 하면 편해요
            </h3>
            <div className="space-y-2.5">
              {guide.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "#34d399" }} />
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 주의사항 */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text-1)" }}>
              <span style={{ color: "#f87171" }}>⚠</span> 이건 주의하세요
            </h3>
            <div className="space-y-2.5">
              {guide.donts.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "#f87171" }} />
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 문의 */}
      <div className="rounded-2xl p-4 text-center" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-3)" }}>
          궁금한 점이 있으면 Admin이나 담당 Leader에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
