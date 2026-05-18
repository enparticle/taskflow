// @ts-nocheck
"use client";
import { useState } from "react";

const SECTIONS = [
  { id: "whats-new",  label: "🆕 v1.2 업데이트" },
  { id: "intro",      label: "시작하기 전에" },
  { id: "task-size",  label: "업무 크기 기준" },
  { id: "task-write", label: "업무 등록 방법" },
  { id: "status",     label: "상태 관리" },
  { id: "milestone",  label: "계획 세우기" },
  { id: "features",   label: "주요 기능 안내" },
  { id: "example1",   label: "예시 — TaskFlow" },
  { id: "example2",   label: "예시 — ChipFlow" },
  { id: "faq",        label: "자주 묻는 질문" },
];

function Section({ id, title, children }: any) {
  return (
    <div id={id} className="scroll-mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full" style={{ background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Card({ title, color = "#2E86FF", children }: any) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-2)", border: `1px solid ${color}22` }}>
      {title && <p className="text-xs font-semibold mb-3" style={{ color }}>{title}</p>}
      {children}
    </div>
  );
}

function GoodBad({ good, bad, goodNote, badNote }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl p-3" style={{ background: "rgba(255,77,106,0.06)", border: "1px solid rgba(255,77,106,0.2)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "#FF4D6A" }}>✕ 지양</p>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>{bad}</p>
        {badNote && <p className="text-xs mt-1" style={{ color: "#FF4D6A" }}>{badNote}</p>}
      </div>
      <div className="rounded-xl p-3" style={{ background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.2)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "#00D4A0" }}>✓ 권장</p>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>{good}</p>
        {goodNote && <p className="text-xs mt-1" style={{ color: "#00D4A0" }}>{goodNote}</p>}
      </div>
    </div>
  );
}

function TaskExample({ title, type, priority, due, status }: any) {
  const SC: Record<string, string> = { "백로그": "#4A7099", "할 일": "#7BA7C8", "진행 중": "#2E86FF", "완료": "#00D4A0", "Blocked": "#FF4D6A", "리뷰": "#F5A623" };
  const PC: Record<string, string> = { "긴급": "#FF4D6A", "높음": "#F5A623", "보통": "#2E86FF", "낮음": "#4A7099" };
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SC[status] ?? "#4A7099" }} />
      <p className="flex-1 text-sm" style={{ color: "var(--text-1)" }}>{title}</p>
      {type && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-4)", color: "var(--text-3)" }}>{type}</span>}
      {priority && <span className="text-xs font-semibold" style={{ color: PC[priority] ?? "#4A7099" }}>{priority}</span>}
      {due && <span className="text-xs" style={{ color: "var(--text-3)" }}>{due}</span>}
      {status && <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: `${SC[status]}18`, color: SC[status] }}>{status}</span>}
    </div>
  );
}

function FeatureCard({ icon, title, desc, tip, isNew }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-2)", border: `1px solid ${isNew ? "rgba(167,139,250,0.3)" : "var(--border)"}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{title}</p>
        {isNew && <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>NEW</span>}
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--text-2)" }}>{desc}</p>
      {tip && <p className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>💡 {tip}</p>}
    </div>
  );
}

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState("whats-new");

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex gap-8 max-w-6xl">
      {/* 목차 */}
      <div className="w-44 shrink-0">
        <div className="sticky top-0 space-y-1">
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-3)" }}>목차</p>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className="w-full text-left rounded-lg px-3 py-2 text-xs transition-all"
              style={{
                background: activeSection === s.id ? "var(--cyan-bg)" : "transparent",
                color: activeSection === s.id ? "var(--cyan)" : "var(--text-3)",
                fontWeight: activeSection === s.id ? 600 : 400,
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 space-y-12 min-w-0">

        {/* v1.2 업데이트 */}
        <Section id="whats-new" title="v1.2 업데이트 안내">
          <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(46,134,255,0.08))", border: "1px solid rgba(167,139,250,0.3)" }}>
            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontSize: 24 }}>🚀</span>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>TaskFlow v1.2</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>2026년 5월 업데이트</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--text-2)", lineHeight: 1.7 }}>
              이번 버전에서는 <span style={{ color: "#A78BFA", fontWeight: 600 }}>AI 기능이 대폭 강화</span>되었고, 회의 관련 기능이 새롭게 추가되었습니다. 프로젝트 등록의 진입 장벽을 낮추고 회의록을 업무로 자동 전환하는 기능이 핵심입니다.
            </p>
          </div>

          {/* 새 기능 */}
          <div className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>✨ 새로 추가된 기능</p>

            {[
              {
                icon: "✦",
                title: "AI 프로젝트 어시스턴트",
                desc: "사이드바 '✦ AI 프로젝트 등록' 메뉴에서 3가지 방식으로 프로젝트를 등록할 수 있습니다.",
                detail: [
                  "💬 대화형: AI와 자연스럽게 대화하면서 프로젝트·마일스톤·업무 자동 생성",
                  "📋 기존 임포트: 회의록·문서를 붙여넣으면 AI가 구조화",
                  "⚡ 업무 일괄: 업무 목록을 나열하면 한번에 분류 등록",
                ],
              },
              {
                icon: "📝",
                title: "회의록 분석",
                desc: "사이드바 '📝 회의록 분석' 메뉴에서 회의 내용을 업무로 자동 변환합니다.",
                detail: [
                  "✍️ 텍스트 직접 입력 / 📁 음성 파일 업로드 / 🎙️ 브라우저 녹음",
                  "OpenAI Whisper로 음성을 텍스트로 자동 변환",
                  "액션아이템·결정사항·이슈 자동 추출 → 업무 선택 등록",
                  "30초마다 DB 자동 저장, 페이지 이탈 후 복원 가능",
                  "녹음 파일 Supabase Storage 저장 및 다운로드",
                ],
              },
              {
                icon: "🗳️",
                title: "미팅 일정 투표",
                desc: "미팅 업무 상세에서 일정 투표를 만들 수 있습니다.",
                detail: [
                  "날짜/시간 옵션 설정 후 팀원이 클릭으로 투표",
                  "득표수와 비율 실시간 표시, 1위 옵션 🏆 표시",
                  "다시 클릭하면 투표 취소",
                ],
              },
              {
                icon: "📋",
                title: "외부용 보고서",
                desc: "관리자가 직접 편집하는 외부 공개용 보고서입니다. (Admin만 메뉴 표시)",
                detail: [
                  "프로젝트별 현황 요약·마일스톤·다음 일정 직접 작성",
                  "표시 진행률 슬라이더로 조정 가능",
                  "임시저장 → 발행 → PDF 인쇄 흐름",
                  "내부 데이터와 완전히 분리된 별도 편집 공간",
                ],
              },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{item.title}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>NEW</span>
                </div>
                <p className="text-xs mb-2" style={{ color: "var(--text-2)" }}>{item.desc}</p>
                <div className="space-y-1">
                  {item.detail.map((d, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span style={{ color: "#A78BFA", fontSize: 10, marginTop: 3 }}>•</span>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>{d}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 개선된 기능 */}
          <div className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>⚡ 개선된 기능</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🤖", title: "AI 피드백 고도화", desc: "단순 수치 나열 → 패턴·원인·리스크·조치 순서로 시니어 컨설턴트 수준 분석. 대시보드/업무/프로젝트별 다른 전문가 역할 적용" },
                { icon: "🟢", title: "프로젝트 상태 자동 계산", desc: "AI 피드백 실행 시 데이터 기반으로 정상/주의/위험 자동 판단 및 업데이트. 페이지 접속 시에도 자동 재계산" },
                { icon: "🔔", title: "알림 클릭 → 업무 이동", desc: "알림을 클릭하면 해당 업무 상세 패널이 바로 열립니다" },
                { icon: "💬", title: "댓글 줄바꿈 표시", desc: "Shift+Enter로 입력한 줄바꿈이 화면에서도 그대로 표시됩니다" },
                { icon: "👆", title: "멘션 클릭 이동", desc: "@이름을 클릭하면 해당 인물의 가장 가까운 댓글로 스크롤 이동합니다" },
                { icon: "🔢", title: "업무 정렬 개선", desc: "진행 중 → 할 일 → 리뷰 → Blocked → 백로그 → 완료 순으로 정렬됩니다" },
                { icon: "📅", title: "미팅 타임라인 개선", desc: "미팅 업무 타임라인에 미팅 일시가 표시되고 직접 수정할 수 있습니다" },
                { icon: "🔗", title: "미팅 회의록 연결", desc: "미팅 업무에서 회의록 분석 결과를 직접 연결할 수 있습니다. 녹음 듣기·텍스트 보기 지원" },
                { icon: "📊", title: "팀원별 업무량 막대", desc: "가장 많은 사람 기준으로 비례 표시. 숫자와 막대 길이가 일치합니다" },
                { icon: "✦", title: "프로젝트 AI 초안", desc: "프로젝트 이름만 입력하고 'AI 초안' 버튼을 누르면 설명과 마감일을 자동으로 채워줍니다" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{item.title}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 시작하기 전에 */}
        <Section id="intro" title="시작하기 전에">
          <Card color="#A78BFA">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              TaskFlow는 팀의 업무를 투명하게 관리하기 위한 시스템입니다. 잘 쓰면 "누가 뭘 하고 있는지", "언제 끝나는지", "어디서 막혔는지"를 실시간으로 파악할 수 있습니다.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-2)" }}>
              처음에는 입력이 번거롭게 느껴질 수 있지만, <span style={{ color: "#A78BFA", fontWeight: 600 }}>입력한 만큼 팀 전체의 시간이 절약됩니다.</span> "지금 어떻게 되고 있어요?" 같은 질문이 줄어들고, 회의 시간도 짧아집니다.
            </p>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "📋", title: "업무 등록", desc: "할 일을 시스템에 올리면 팀 전체가 볼 수 있습니다" },
              { icon: "🔄", title: "상태 업데이트", desc: "진행 상황이 바뀔 때마다 상태를 바꿔주세요" },
              { icon: "💬", title: "댓글 소통", desc: "업무 관련 대화는 댓글로 남기면 맥락이 유지됩니다" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4 text-center" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</p>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-1)" }}>{item.title}</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 업무 크기 기준 */}
        <Section id="task-size" title="업무를 어떻게 쪼갤까">
          <Card color="#F5A623" title="기본 원칙 — 하나의 업무 = 1~3일 안에 완료 가능한 단위">
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              업무가 너무 크면 진행 상황을 파악하기 어렵고, 너무 작으면 관리 자체가 부담이 됩니다. <span style={{ color: "#F5A623", fontWeight: 600 }}>1~3일 안에 완료할 수 있는 단위</span>가 가장 적합합니다.
            </p>
          </Card>
          <div className="space-y-3">
            <GoodBad bad="AI 기능 구현" badNote="→ 언제 끝날지 모름. 진행률 파악 불가" good="AI 담당자 추천 API 구현" goodNote="→ 하루 이틀이면 끝남. 완료 여부 명확" />
            <GoodBad bad="시스템 전체 테스트" badNote="→ 범위가 너무 넓음" good="로그인/로그아웃 기능 테스트" goodNote="→ 구체적이고 측정 가능" />
            <GoodBad bad="변수명 수정" badNote="→ 업무가 아닌 작업 수준" good="인증 모듈 리팩토링" goodNote="→ 의미 있는 완료 시점이 있는 단위" />
          </div>
          <Card color="#2E86FF" title="이런 경우는 쪼개세요">
            <div className="space-y-2">
              {[
                "예상 시간이 8시간을 넘는다면 → 더 작은 단위로 분리",
                "완료 기준이 애매하다면 → '무엇을 했을 때 완료인가'를 명확히",
                "한 업무에 담당자가 3명 이상이라면 → 역할별로 분리",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color: "#2E86FF", fontSize: 12, marginTop: 2 }}>→</span>
                  <p className="text-sm" style={{ color: "var(--text-2)" }}>{t}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* 업무 등록 방법 */}
        <Section id="task-write" title="업무 등록 방법">
          <div className="grid grid-cols-2 gap-4">
            <Card color="#00D4A0" title="✓ 필수 입력">
              <div className="space-y-3">
                {[
                  { field: "업무명", tip: "동사로 끝내기. '~작성', '~구현', '~확인'" },
                  { field: "담당자", tip: "반드시 한 명 이상 지정. 다중 선택 가능" },
                  { field: "마감일 또는 예상 시간", tip: "둘 중 하나는 반드시 입력" },
                  { field: "계획(마일스톤)", tip: "프로젝트 선택 후 해당 마일스톤에 연결" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{ color: "#00D4A0", fontSize: 12, marginTop: 2 }}>✓</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{item.field}</p>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card color="#A78BFA" title="✦ AI 기능 활용">
              <div className="space-y-3">
                {[
                  { feature: "AI 분류", desc: "업무명 입력 후 클릭하면 유형·우선순위·예상 시간 자동 추천" },
                  { feature: "AI 담당자 추천", desc: "현재 팀원 업무량을 분석해서 최적 담당자 추천" },
                  { feature: "AI 마감일 추천", desc: "비슷한 업무 이력을 보고 현실적인 마감일 제안" },
                  { feature: "AI 프로젝트 등록 (NEW)", desc: "대화형/임포트/일괄 3가지 방식으로 프로젝트 자동 생성" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{ color: "#A78BFA", fontSize: 12, marginTop: 2 }}>✦</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{item.feature}</p>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card color="#7BA7C8" title="회의 업무 특별 안내">
            <p className="text-sm mb-2" style={{ color: "var(--text-2)" }}>
              업무 유형을 <strong>회의</strong>로 선택하면 간소화된 입력 양식이 표시됩니다.
            </p>
            <div className="space-y-1">
              {[
                "예상 시간 입력 불필요 → 자동으로 숨겨짐",
                "마감일 → '미팅 일시'로 표시, 날짜+시간 함께 표시",
                "상세 패널에서 '미팅 완료 처리' 버튼 한 번으로 완료",
                "일정 투표 기능으로 팀원 일정 조율 가능 (NEW)",
                "회의록 분석 결과를 업무에 직접 연결 가능 (NEW)",
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span style={{ color: "#7BA7C8" }}>•</span>
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>{t}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card color="#F5A623" title="업무명 작성 팁">
            <div className="space-y-3">
              <GoodBad bad="회의" good="주간 팀 미팅 (5/15 오전 10시)" badNote="→ 무슨 회의인지 모름" goodNote="→ 언제, 무슨 회의인지 명확" />
              <GoodBad bad="문서 작성" good="v8 최종 성능 보고서 작성" badNote="→ 어떤 문서인지 모름" goodNote="→ 구체적이고 완료 기준이 명확" />
            </div>
          </Card>
        </Section>

        {/* 상태 관리 */}
        <Section id="status" title="상태 관리">
          <div className="space-y-2">
            {[
              { status: "진행 중", color: "#2E86FF", desc: "지금 작업하고 있는 업무. 목록 최상단에 표시됩니다. 한 사람이 동시에 진행하는 업무는 3개 이하가 적당합니다." },
              { status: "할 일", color: "#7BA7C8", desc: "곧 시작할 예정인 업무. 담당자와 마감일이 정해진 상태." },
              { status: "리뷰", color: "#F5A623", desc: "작업은 끝났지만 검토가 필요한 상태. 리뷰어가 승인/반려/의견을 남길 수 있습니다." },
              { status: "Blocked", color: "#FF4D6A", desc: "다른 업무나 외부 요인 때문에 진행이 막힌 상태. 반드시 사유를 입력해야 합니다." },
              { status: "백로그", color: "#4A7099", desc: "언젠가 해야 하지만 아직 시작하지 않은 업무. 우선순위가 낮거나 일정이 미정인 업무." },
              { status: "완료", color: "#00D4A0", desc: "실제로 끝난 업무. 목록 최하단에 표시됩니다. 완료 기준을 충족했을 때만 변경하세요." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl px-4 py-3"
                style={{ background: "var(--bg-2)", border: `1px solid ${item.color}22` }}>
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs font-semibold" style={{ color: item.color }}>{item.status}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-2)" }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <Card color="#FF4D6A" title="Blocked 처리 방법">
            <div className="space-y-2">
              {[
                "1. 상태를 Blocked로 변경하고 사유를 입력합니다",
                "2. 댓글에 구체적인 상황을 남깁니다 (누가 뭘 해줘야 하는지)",
                "3. 관련된 담당자를 @멘션으로 알립니다 → 알림이 자동 발송됩니다",
                "4. AI 피드백에서 Blocked 업무를 자동으로 감지합니다",
              ].map((t, i) => (
                <p key={i} className="text-sm" style={{ color: "var(--text-2)" }}>{t}</p>
              ))}
            </div>
          </Card>

          <Card color="#F5A623" title="프로젝트 상태는 자동으로 계산됩니다">
            <div className="space-y-2">
              {[
                { status: "🟢 정상",     desc: "번다운 괴리율 10% 이내, 지연·Blocked 거의 없음" },
                { status: "🔵 검토 필요", desc: "번다운 괴리율 10~20% OR 지연 3건 이하" },
                { status: "🟡 주의",     desc: "번다운 괴리율 20~35% OR 지연 5건↑ OR Blocked 3건↑" },
                { status: "🔴 위험",     desc: "번다운 괴리율 35% 초과 OR 마감 초과 OR Blocked 5건↑" },
                { status: "⚫ 중단",     desc: "외부 요인으로 일시 중단. 프로젝트 수정에서 수동으로만 설정 가능" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-semibold shrink-0 mt-0.5">{item.status}</span>
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
              번다운 괴리율 = (실제 잔여 업무 - 이상적 잔여 업무) / 전체 업무 × 100<br/>
              시작일·마감일이 설정된 프로젝트만 괴리율 계산. 미설정 시 지연·Blocked 건수만으로 판단합니다.
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>대시보드·프로젝트 페이지 접속 시 자동 재계산. AI 피드백 실행 시에도 업데이트됩니다.</p>
          </Card>
        </Section>

        {/* 계획 세우기 */}
        <Section id="milestone" title="계획(마일스톤) 세우기">
          <Card color="#A78BFA" title="마일스톤이란?">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              마일스톤은 <span style={{ color: "#A78BFA", fontWeight: 600 }}>의미 있는 완료 시점</span>입니다. 업무를 마일스톤에 연결하면 프로젝트 상세 → <strong>계획별 업무</strong> 탭에서 단계별로 묶어서 볼 수 있습니다.
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card color="#00D4A0" title="좋은 마일스톤 기준">
              <div className="space-y-2">
                {["3~4주 단위로 설정", "완료 기준이 명확함 (배포 완료, 검증 통과 등)", "팀 전체가 이해할 수 있는 이름", "5~10개 업무가 연결되는 규모"].map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ color: "#00D4A0" }}>✓</span>
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>{t}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card color="#FF4D6A" title="피해야 할 마일스톤">
              <div className="space-y-2">
                {["기간이 2개월 이상으로 너무 김", "'기타', '잡무' 같은 모호한 이름", "업무가 1~2개만 연결됨", "완료 기준이 없음"].map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ color: "#FF4D6A" }}>✕</span>
                    <p className="text-sm" style={{ color: "var(--text-2)" }}>{t}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        {/* 주요 기능 안내 */}
        <Section id="features" title="주요 기능 안내">
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard icon="✦" title="AI 프로젝트 어시스턴트" isNew
              desc="대화형·임포트·일괄 3가지 방식으로 프로젝트를 쉽게 등록합니다. 이전 대화 기록도 저장됩니다."
              tip="사이드바 '✦ AI 프로젝트 등록' 메뉴" />
            <FeatureCard icon="📝" title="회의록 분석" isNew
              desc="텍스트·파일·녹음으로 회의 내용을 입력하면 업무를 자동 추출합니다. 30초마다 자동 저장됩니다."
              tip="사이드바 '📝 회의록 분석' 메뉴" />
            <FeatureCard icon="🗳️" title="미팅 일정 투표" isNew
              desc="회의 업무 상세에서 날짜/시간 옵션을 만들고 팀원이 투표할 수 있습니다."
              tip="회의 유형 업무 상세 → 일정 투표 섹션" />
            <FeatureCard icon="📋" title="외부용 보고서" isNew
              desc="관리자가 직접 편집하는 외부 공개용 보고서. PDF 인쇄 가능. Admin 계정만 메뉴가 표시됩니다."
              tip="사이드바 '📋 외부용 보고서' 메뉴 (Admin만)" />
            <FeatureCard icon="🔔" title="알림 센터"
              desc="Blocked 전환·리뷰 요청·마감 임박 시 자동 알림. 알림 클릭 시 해당 업무로 바로 이동합니다."
              tip="사이드바 상단 벨 아이콘" />
            <FeatureCard icon="💬" title="댓글 & 멘션"
              desc="Enter로 전송, Shift+Enter로 줄바꿈. @이름 클릭 시 해당 댓글로 스크롤 이동합니다."
              tip="업무 상세 패널 하단 댓글 영역" />
            <FeatureCard icon="✎" title="리뷰 시스템"
              desc="업무를 '리뷰' 상태로 변경하면 담당 리뷰어들의 검토 현황이 표시됩니다."
              tip="여러 명의 리뷰어가 있을 때 누가 검토했는지 한눈에 확인" />
            <FeatureCard icon="🔗" title="업무 의존성"
              desc="선행 업무를 설정하면 완료되지 않은 선행 업무가 있을 때 경고가 표시됩니다."
              tip="업무 상세 패널 하단 '업무 의존성' 섹션" />
            <FeatureCard icon="🤖" title="AI 피드백"
              desc="패턴→원인→리스크→조치 순서로 시니어 컨설턴트 수준 분석. 프로젝트 상태도 자동 업데이트됩니다."
              tip="버튼 클릭 시에만 분석 (자동 분석 없음)" />
            <FeatureCard icon="📊" title="생산성 리포트"
              desc="구성원별 완료 건수·정시 완료율·예상 vs 실제 시간·병목 분석."
              tip="Admin: 전체 조회, 리더: 담당 프로젝트만" />
          </div>
        </Section>

        {/* 예시 1 — TaskFlow */}
        <Section id="example1" title="실제 예시 — TaskFlow 프로젝트">
          <Card color="#00C2CC">
            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>이 시스템 자체를 개발하면서 실제로 사용한 방식입니다.</p>
            <p className="text-xs font-semibold mb-2" style={{ color: "#00C2CC" }}>마일스톤 구성</p>
            <div className="space-y-2">
              {[
                { name: "시스템 구축 및 배포", period: "5/4 ~ 5/8", status: "완료" },
                { name: "AI 피드백 시스템 구축", period: "5/7 ~ 5/8", status: "완료" },
                { name: "핵심 기능 구현", period: "5/7 ~ 5/7", status: "완료" },
                { name: "팀 피드백 수집", period: "5/7 ~ 5/15", status: "진행 중" },
                { name: "피드백 기반 버그 수정 및 개선", period: "미정", status: "계획" },
                { name: "보안 강화 및 이메일 알림 연동", period: "미정", status: "계획" },
                { name: "v1.2 배포", period: "~ 5/29", status: "완료" },
              ].map((m, i) => {
                const color = m.status === "완료" ? "#00D4A0" : m.status === "진행 중" ? "#2E86FF" : "#7BA7C8";
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--bg-3)" }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <p className="flex-1 text-xs" style={{ color: "var(--text-1)" }}>{m.name}</p>
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>{m.period}</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}18`, color }}>{m.status}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card color="#2E86FF" title="업무 등록 예시">
            <div className="space-y-2">
              <TaskExample title="DB 스키마 설계 및 Supabase 연결" type="개발" priority="긴급" due="5/4" status="완료" />
              <TaskExample title="AI 담당자 추천 API 구현" type="개발" priority="높음" due="5/8" status="완료" />
              <TaskExample title="회의록 분석 기능 구현" type="개발" priority="높음" due="5/14" status="완료" />
              <TaskExample title="구성원 피드백 수집" type="기획" priority="보통" due="5/15" status="진행 중" />
              <TaskExample title="이메일 알림 연동" type="개발" priority="보통" due="" status="백로그" />
            </div>
          </Card>
        </Section>

        {/* 예시 2 — ChipFlow */}
        <Section id="example2" title="실제 예시 — ChipFlow 프로젝트">
          <Card color="#A78BFA">
            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>연구 개발 프로젝트의 업무 구성 방식입니다.</p>
            <p className="text-xs font-semibold mb-2" style={{ color: "#A78BFA" }}>마일스톤 구성</p>
            <div className="space-y-2">
              {[
                { name: "데이터 파이프라인 안정화", period: "4/3 ~ 5/4", status: "완료" },
                { name: "Physics V2 기반 예측기 구축", period: "4/18 ~ 5/2", status: "완료" },
                { name: "총량 예측기 고도화 — v5", period: "5/2 ~ 5/4", status: "완료" },
                { name: "튜브별 예측기 고도화 — v8", period: "5/5 ~ 5/7", status: "완료" },
                { name: "서비스 연결 및 API 검증", period: "5/7 ~ 5/8", status: "완료" },
                { name: "v8 공식 챔피언 승격", period: "5/8 ~ 5/11", status: "완료" },
                { name: "EW 160/180/20 단일 fail 해결", period: "5/11 ~ 5/15", status: "진행 중" },
                { name: "운영 UI 개선", period: "5/13 ~ 5/20", status: "계획" },
                { name: "역류 한계 모델링", period: "5/16 ~ 5/27", status: "계획" },
                { name: "범용 플랫폼 확장 설계", period: "5/22 ~ 5/29", status: "계획" },
              ].map((m, i) => {
                const color = m.status === "완료" ? "#00D4A0" : m.status === "진행 중" ? "#2E86FF" : "#7BA7C8";
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--bg-3)" }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <p className="flex-1 text-xs" style={{ color: "var(--text-1)" }}>{m.name}</p>
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>{m.period}</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}18`, color }}>{m.status}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card color="#F5A623" title="연구 업무 등록 시 주의점">
            <div className="space-y-3">
              <GoodBad bad="데이터 분석" badNote="→ 무엇을 분석? 결과는?" good="EW 160/180/20 T2 오차 원인 규명" goodNote="→ 구체적인 분석 대상과 목적이 명확" />
              <GoodBad bad="모델 개선" badNote="→ 어떤 모델? 어느 수준까지?" good="v8 기준 held-out 11/11 pass 검증" goodNote="→ 완료 기준(11/11)이 수치로 명확" />
            </div>
          </Card>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="자주 묻는 질문">
          <div className="space-y-3">
            {[
              { q: "업무를 매일 업데이트해야 하나요?", a: "상태가 바뀔 때마다 업데이트하면 됩니다. 완료됐는데 '진행 중'으로 남아있으면 팀 전체 현황이 왜곡됩니다." },
              { q: "회의는 어떻게 등록하나요?", a: "업무 유형을 '회의'로 선택하면 일시만 입력하면 됩니다. 상세 패널에서 '미팅 완료 처리' 버튼으로 완료 처리, 일정 투표로 시간 조율, 회의록 분석 결과 연결도 가능합니다." },
              { q: "회의록을 어떻게 업무로 만드나요?", a: "사이드바 '📝 회의록 분석' 메뉴에서 회의록 텍스트를 붙여넣거나 녹음 파일을 업로드하면 AI가 액션아이템을 추출합니다. 원하는 업무를 선택해서 한번에 등록할 수 있습니다." },
              { q: "프로젝트 등록이 막막해요.", a: "사이드바 '✦ AI 프로젝트 등록' 메뉴를 이용해보세요. AI와 대화하면서 자연스럽게 프로젝트를 만들 수 있습니다. '진행 중인 프로젝트 내용을 설명해주세요'라고 시작하면 됩니다." },
              { q: "담당자가 여러 명인 업무는 어떻게 하나요?", a: "다중 담당자를 지원합니다. 단, 담당자가 3명 이상이라면 역할을 나눠서 업무를 분리하는 게 더 명확합니다." },
              { q: "Blocked 사유를 공개하기 부담스러운 경우는?", a: "Blocked 사유는 팀 내부에서만 공유됩니다. 외부용 보고서에는 관리자가 선별해서 공개하므로 솔직하게 입력해도 됩니다." },
              { q: "프로젝트 상태(정상/주의/위험)는 누가 바꾸나요?", a: "시스템이 자동으로 계산합니다. AI 피드백을 실행하면 Claude가 데이터를 종합해서 판단하고 자동으로 업데이트합니다." },
              { q: "댓글에서 줄바꿈은 어떻게 하나요?", a: "Shift+Enter를 누르면 줄바꿈이 됩니다. Enter만 누르면 댓글이 전송됩니다." },
              { q: "어떤 포맷의 회의록이 가장 잘 인식되나요?", a: "액션아이템 섹션에 '업무명 / 담당자 / 마감일' 형식으로 작성하면 가장 정확합니다. 예: '보고서 작성 / 김성훈 / 5/15'" },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-1)" }}>Q. {item.q}</p>
                <p className="text-sm" style={{ color: "var(--text-2)", lineHeight: 1.6 }}>A. {item.a}</p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
