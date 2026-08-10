// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const INPUT_STYLES = [
  { value: "plan", emoji: "📋", title: "미리 계획 세우는 게 편해요", desc: "할 일을 먼저 등록하고 시작해요" },
  { value: "log", emoji: "📝", title: "끝난 뒤 편하게 적는 게 편해요", desc: "일단 하고, 나중에 뭐 했는지 적어요" },
  { value: "click", emoji: "🖱", title: "그냥 클릭 몇 번으로 끝내고 싶어요", desc: "상태만 딸깍딸깍 바꾸는 게 좋아요" },
];

const HOME_PRIORITIES = [
  { value: "today", label: "오늘 해야 할 일" },
  { value: "recent", label: "최근에 내가 남긴 기록" },
  { value: "summary", label: "주간 요약 (완료/진행중/Blocked)" },
];

const CONSUMPTION_STYLES = [
  { value: "monitor", title: "네, 자주 봐요", desc: "팀 전체 현황을 자주 들여다보는 편이에요" },
  { value: "summary", title: "아니요, 필요할 때만", desc: "심플한 화면이 좋아요" },
  { value: "unsure", title: "잘 모르겠어요", desc: "쓰시는 걸 보고 저희가 알아서 맞춰갈게요" },
];

export default function OnboardingWizard({ userId, onDone }: { userId: string; onDone: () => void }) {
  const supabase = createClient();
  const [step, setStep] = useState(0); // 0: welcome, 1: input_style, 2: home_priority, 3: consumption, 4: summary
  const [inputStyle, setInputStyle] = useState("log");
  const [homePriority, setHomePriority] = useState("today");
  const [consumptionStyle, setConsumptionStyle] = useState("unsure");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from("user_preferences").select("input_style, home_priority, consumption_style")
      .eq("user_id", userId).maybeSingle().then(({ data }) => {
        if (data) {
          if (data.input_style) setInputStyle(data.input_style);
          if (data.home_priority?.[0]) setHomePriority(data.home_priority[0]);
          if (data.consumption_style) setConsumptionStyle(data.consumption_style);
        }
        setLoaded(true);
      });
  }, [userId]);

  async function save(completed: boolean) {
    setSaving(true);
    const priorityOrder = [homePriority, ...HOME_PRIORITIES.map(h => h.value).filter(v => v !== homePriority)];
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      input_style: inputStyle,
      home_priority: priorityOrder,
      consumption_style: consumptionStyle,
      onboarding_completed: completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    onDone();
  }

  function skip() {
    save(true); // 기존 값 그대로(또는 기본값) 완료 처리, 다시 안 뜨게
  }

  const totalSteps = 5;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(7,13,24,0.9)", backdropFilter: "blur(6px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 480, background: "var(--bg-2)", border: "1px solid var(--border-2)",
        borderRadius: 20, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* 진행 표시 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? "var(--cyan)" : "var(--bg-4)",
            }} />
          ))}
        </div>

        {/* Step 0: 환영 */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👋</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>
              TaskFlow를 어떻게 쓰고 싶으신가요?
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 8 }}>
              몇 가지만 여쭤볼게요. 1분이면 끝나요.
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 28, background: "var(--bg-3)", padding: "10px 14px", borderRadius: 10 }}>
              ℹ 답변은 홈 화면 구성을 맞추고, AI에게 요청을 보낼 때 참고자료로 쓰여요.
              모델을 다시 훈련시키는 게 아니라, 매 요청마다 함께 전달되는 방식이에요. 다른 팀원에게는 공개되지 않아요.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={skip} disabled={saving}
                style={{ flex: 1, padding: "10px 0", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}>
                건너뛰기
              </button>
              <button onClick={() => setStep(1)}
                style={{ flex: 2, padding: "10px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                시작하기
              </button>
            </div>
          </div>
        )}

        {/* Step 1: 입력 스타일 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 18 }}>
              업무를 기록하는 스타일은?
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {INPUT_STYLES.map(s => (
                <button key={s.value} onClick={() => setInputStyle(s.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                    background: inputStyle === s.value ? "var(--cyan-bg)" : "var(--bg-3)",
                    border: `1px solid ${inputStyle === s.value ? "var(--cyan)" : "var(--border)"}`,
                  }}>
                  <span style={{ fontSize: 22 }}>{s.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0" }}>{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} onSkip={skip} saving={saving} />
          </div>
        )}

        {/* Step 2: 홈 화면 우선순위 */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 18 }}>
              홈 화면에서 뭐가 먼저 보이면 좋겠어요?
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {HOME_PRIORITIES.map(h => (
                <button key={h.value} onClick={() => setHomePriority(h.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                    background: homePriority === h.value ? "var(--cyan-bg)" : "var(--bg-3)",
                    border: `1px solid ${homePriority === h.value ? "var(--cyan)" : "var(--border)"}`,
                  }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", border: `2px solid ${homePriority === h.value ? "var(--cyan)" : "var(--border-2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {homePriority === h.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)" }} />}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-1)" }}>{h.label}</span>
                </button>
              ))}
            </div>
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={skip} saving={saving} />
          </div>
        )}

        {/* Step 3: 소비 성향 */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 18 }}>
              팀 전체 현황을 자주 들여다보는 편인가요?
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {CONSUMPTION_STYLES.map(c => (
                <button key={c.value} onClick={() => setConsumptionStyle(c.value)}
                  style={{
                    display: "flex", flexDirection: "column", gap: 2, padding: "12px 16px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                    background: consumptionStyle === c.value ? "var(--cyan-bg)" : "var(--bg-3)",
                    border: `1px solid ${consumptionStyle === c.value ? "var(--cyan)" : "var(--border)"}`,
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.desc}</span>
                </button>
              ))}
            </div>
            <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} onSkip={skip} saving={saving} />
          </div>
        )}

        {/* Step 4: 완료 요약 */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>이렇게 설정할게요</h2>
            </div>
            <div style={{ background: "var(--bg-3)", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
                {INPUT_STYLES.find(s => s.value === inputStyle)?.emoji} {INPUT_STYLES.find(s => s.value === inputStyle)?.title}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
                🏠 홈에서 먼저 보기: {HOME_PRIORITIES.find(h => h.value === homePriority)?.label}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
                👀 {CONSUMPTION_STYLES.find(c => c.value === consumptionStyle)?.title}
              </p>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginBottom: 20 }}>
              설정은 언제든 설정 → 나의 TaskFlow 스타일에서 바꾸실 수 있어요.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} disabled={saving}
                style={{ flex: 1, padding: "10px 0", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}>
                이전
              </button>
              <button onClick={() => save(true)} disabled={saving}
                style={{ flex: 2, padding: "10px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중…" : "이대로 시작하기"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext, onSkip, saving }: { onBack: () => void; onNext: () => void; onSkip: () => void; saving: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onBack} disabled={saving}
        style={{ padding: "10px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}>
        이전
      </button>
      <button onClick={onSkip} disabled={saving}
        style={{ padding: "10px 16px", background: "transparent", border: "none", fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
        건너뛰기
      </button>
      <button onClick={onNext} disabled={saving}
        style={{ flex: 1, padding: "10px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
        다음
      </button>
    </div>
  );
}
