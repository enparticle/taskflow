// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

// 오늘 한 일을 자유 텍스트로 받아서, 기존 업무 완료 처리 / 신규 업무 등록을 제안합니다.
// 기록(사후 로그) 우선 전략에 맞춘 엔드포인트입니다 — 실시간 상태 강제 입력이 아니라
// "무슨 일이 있었는지"를 사후에 가볍게 남기고, AI가 업무 매칭을 대신 해줍니다.
// 3단계: 이 사용자의 과거 승인/반려 이력을 few-shot으로 참고해서 매칭 정확도를 점점 개선합니다.
export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);
    const { text, userName, tasks, now, aiTone } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ reply: "내용을 입력해주세요.", suggestions: [] });
    }

    const openTasks = (tasks ?? []).filter((t: any) => t.status !== "done");
    const taskList = openTasks
      .map((t: any) => `- [${t.id}] ${t.title}${t.project ? ` (프로젝트: ${t.project})` : ""} (현재 상태: ${t.status})`)
      .join("\n");

    // 이 사용자의 과거 사례 + 소통 스타일 프로필 조회 (few-shot 학습 루프, 3단계 + 스타일 학습)
    let historyBlock = "";
    let profileBlock = "";
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
        if (me) {
          const { data: prefs } = await supabase.from("user_preferences")
            .select("communication_profile, mirror_casual_tone").eq("user_id", me.id).maybeSingle();
          if (prefs?.communication_profile) {
            profileBlock = `\n이 사용자의 소통 스타일(참고용, 톤을 맞추는 데만 쓰고 내용 판단에는 영향 주지 마세요): ${prefs.communication_profile}\n` +
              (prefs.mirror_casual_tone
                ? "이 사용자는 AI가 자기 캐주얼한 말투(반말, 이모지 등)까지 따라해도 괜찮다고 했습니다.\n"
                : "단, 사용자가 아무리 캐주얼하게 말해도 AI는 항상 정중한 존댓말을 유지하세요 — 편한 정도(문장 길이 등)만 참고하고 반말/은어는 따라하지 마세요.\n");
          }

          const { data: history } = await supabase.from("ai_suggestions")
            .select("source_text, type, suggested_value, status, reason")
            .eq("user_id", me.id).eq("source", "daily_log")
            .order("created_at", { ascending: false }).limit(5);
          if (history && history.length > 0) {
            historyBlock = `\n이 사용자의 과거 기록 예시 (참고용 — 비슷한 표현 패턴이면 참고하세요):\n` +
              history.map((h: any) =>
                `- "${h.source_text ?? ""}" → ${h.type === "status" ? "완료 처리" : "신규 등록"} "${h.suggested_value}" (${h.status === "approved" ? "사용자가 승인함" : "사용자가 무시함, 이런 식으로는 판단하지 마세요"})`
              ).join("\n") + "\n";
          }
        }
      }
    } catch {
      // 이력 조회 실패해도 기본 동작은 계속 (학습은 보조 기능)
    }

    const prompt = `당신은 ${userName}님의 업무 기록 보조 AI입니다.
오늘 날짜: ${new Date(now).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}

사용자가 오늘 한 일을 자유롭게 적었습니다. 이 내용을 분석해서:
1. 기존 업무 중 완료된 것으로 보이는 게 있으면 "complete" 제안
2. 기존 업무 목록에 없는 새로운 작업 내용이 언급됐으면 "create" 제안 (완료된 것 같으면 status "done", 아직 진행 중인 것 같으면 status "doing")
3. 애매하거나 업무와 무관한 내용(잡담 등)은 제안하지 않습니다.
4. 사용자가 프로젝트명을 언급하면, 업무 목록의 (프로젝트: ...) 표시와 대조해서 더 정확하게 매칭하세요. 같은 제목의 업무가 여러 프로젝트에 있을 수 있으니 프로젝트명이 매칭 판단에 중요한 단서입니다.
5. "create" 제안 시, 텍스트에서 프로젝트가 유추되면 업무 목록에 나온 프로젝트명 중 정확히 일치하는 것을 "project" 필드에 넣으세요. 확신 없으면 project 필드를 생략하세요(추측해서 엉뚱한 프로젝트에 넣지 마세요).
${historyBlock}${profileBlock}
현재 사용자의 미완료 업무 목록:
${taskList || "(없음)"}

사용자가 오늘 적은 내용:
"""
${text}
"""

${aiTone === "detailed" ? "\n응답 톤: 사용자가 '자세히' 스타일을 선호합니다. reply와 각 제안의 reason에 판단 근거를 조금 더 구체적으로 설명해주세요(3~4문장 정도 괜찮음).\n" : aiTone === "detailed_with_summary" ? "\n응답 톤: 사용자가 '자세히 + 요약' 스타일을 선호합니다. reply를 쓸 때 맨 앞에 한 줄 요약을 먼저 쓰고, 그다음 줄에 자세한 설명을 이어가세요(예: \"완료 처리 1건, 신규 등록 1건 제안드려요. [줄바꿈] 로그인 페이지 작업은...\"). reason도 근거를 구체적으로.\n" : "\n응답 톤: 사용자가 '간결히' 스타일을 선호합니다. reply와 reason을 짧고 명확하게, 군더더기 없이 작성하세요.\n"}
반드시 아래 JSON 형식으로만 답하세요. 다른 설명, 마크다운, 코드블록 없이 순수 JSON만 출력하세요.
{
  "reply": "사용자에게 보여줄 한두 문장의 짧은 확인 멘트",
  "suggestions": [
    { "type": "complete", "taskId": "기존 업무 id", "title": "업무 제목", "reason": "왜 이렇게 판단했는지 한 문장" },
    { "type": "create", "title": "새 업무 제목", "status": "done 또는 doing", "project": "정확히 일치하는 프로젝트명 (확신 없으면 생략)", "reason": "왜 새 업무로 판단했는지 한 문장" }
  ]
}
제안할 게 없으면 suggestions는 빈 배열로 두세요.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { reply: "기록은 남겼지만, 제안을 만드는 데 실패했어요.", suggestions: [] };
    }

    // 2. 소통 프로필 자동 갱신 + 5. 설정-실제행동 불일치 감지 (비용 절약을 위해 5건마다 한 번만)
    try {
      const { data: { user: authUser2 } } = await supabase.auth.getUser();
      if (authUser2) {
        const { data: me2 } = await supabase.from("users").select("id").eq("auth_id", authUser2.id).single();
        if (me2) {
          const { data: recentTexts } = await supabase.from("ai_suggestions")
            .select("source_text").eq("user_id", me2.id).eq("source", "daily_log")
            .order("created_at", { ascending: false }).limit(10);
          const texts = (recentTexts ?? []).map((r: any) => r.source_text).filter(Boolean);

          if (texts.length > 0 && texts.length % 5 === 0) {
            const { data: myPrefs } = await supabase.from("user_preferences")
              .select("ai_tone, communication_profile, input_style, home_priority, consumption_style").eq("user_id", me2.id).maybeSingle();

            // 프로필 갱신 — 요약 문장 + 3개 축(격식도/말길이/결정속도)을 구조화된 JSON으로 같이 받음
            const profileMsg = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 200,
              messages: [{
                role: "user",
                content: `아래는 한 사용자가 최근에 남긴 업무 기록 문장들입니다:\n${texts.map((t: string) => `- "${t}"`).join("\n")}\n\n이 사람의 소통 스타일을 분석해서 아래 JSON으로만 응답하세요(다른 텍스트 없이):\n{\n  "summary": "1~2문장 요약(문장 길이, 격식/캐주얼, 이모지 사용, 결정 속도 포함)",\n  "formality_level": "formal 또는 casual (존댓말/격식 있게 쓰는지, 반말/편하게 쓰는지)",\n  "message_length_pref": "short, medium, long 중 하나 (평소 문장 길이)",\n  "decision_speed": "fast 또는 deliberate (빠르게 결정하는 편인지, 신중하게 고민하는 편인지)"\n}`,
              }],
            });
            const rawProfile = profileMsg.content[0].type === "text" ? profileMsg.content[0].text.trim() : "";
            try {
              const cleanProfile = rawProfile.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
              const parsedProfile = JSON.parse(cleanProfile);
              if (parsedProfile.summary) {
                const isNewMember = !myPrefs; // 6. 온보딩 자체를 안 거친 신규 팀원 — 관찰만으로 초기 설정
                if (isNewMember) {
                  const avgLenForTone = texts.reduce((s: number, t: string) => s + t.length, 0) / texts.length;
                  await supabase.from("user_preferences").upsert({
                    user_id: me2.id,
                    input_style: "log", // 대화로 직접 안 물어봤으니 무난한 기본값
                    home_priority: ["today", "recent", "summary"],
                    consumption_style: "unsure",
                    ai_tone: avgLenForTone > 80 ? "detailed" : "concise",
                    communication_profile: parsedProfile.summary,
                    formality_level: parsedProfile.formality_level ?? undefined,
                    message_length_pref: parsedProfile.message_length_pref ?? undefined,
                    decision_speed: parsedProfile.decision_speed ?? undefined,
                    onboarding_completed: true,
                    updated_at: new Date().toISOString(),
                  }, { onConflict: "user_id" });
                  await supabase.from("notifications").insert({
                    user_id: me2.id, type: "mention",
                    title: "나의 스타일이 자동으로 설정됐어요",
                    body: "최근 사용 패턴을 보고 초기 설정을 잡아봤어요. 설정 화면에서 확인하고 다르면 언제든 바꿔주세요.",
                    link_url: "/settings",
                  });
                } else {
                  await supabase.from("user_preferences").update({
                    communication_profile: parsedProfile.summary,
                    formality_level: parsedProfile.formality_level ?? undefined,
                    message_length_pref: parsedProfile.message_length_pref ?? undefined,
                    decision_speed: parsedProfile.decision_speed ?? undefined,
                  }).eq("user_id", me2.id);
                }
                // 4. 변화 히스토리 기록 (덮어쓰기 대신 누적)
                await supabase.from("communication_profile_history").insert({
                  user_id: me2.id, profile_text: parsedProfile.summary,
                  formality_level: parsedProfile.formality_level ?? null,
                  message_length_pref: parsedProfile.message_length_pref ?? null,
                  decision_speed: parsedProfile.decision_speed ?? null,
                });
              }
            } catch {
              // 구조화 파싱 실패하면 요약 문장만이라도 저장 시도
              if (rawProfile) {
                await supabase.from("user_preferences").update({ communication_profile: rawProfile }).eq("user_id", me2.id);
              }
            }

            // 불일치 감지: concise인데 평균 문장이 너무 길거나, detailed인데 너무 짧으면 제안 생성
            const avgLen = texts.reduce((s: number, t: string) => s + t.length, 0) / texts.length;
            const declaredTone = myPrefs?.ai_tone ?? "concise";
            let suggestedTone: string | null = null;
            if (declaredTone === "concise" && avgLen > 80) suggestedTone = "detailed";
            else if ((declaredTone === "detailed" || declaredTone === "detailed_with_summary") && avgLen < 20) suggestedTone = "concise";

            if (suggestedTone) {
              const { data: existingSug } = await supabase.from("preference_suggestions")
                .select("id").eq("user_id", me2.id).eq("field", "ai_tone").eq("status", "pending").maybeSingle();
              if (!existingSug) {
                await supabase.from("preference_suggestions").insert({
                  user_id: me2.id, field: "ai_tone",
                  current_value: declaredTone, suggested_value: suggestedTone,
                  reason: `최근 기록 문장 길이 평균 ${Math.round(avgLen)}자 — 설정한 톤이랑 실제 패턴이 달라 보여요`,
                });
              }
            }

            // 4. 홈 위젯 순서 불일치 감지 — 계획형인데 할일목록이 1순위가 아니거나, 자주확인형인데 요약이 1순위가 아니면 제안
            const currentPriority = myPrefs?.home_priority ?? ["today", "recent", "summary"];
            let suggestedFirst: string | null = null;
            let widgetReason = "";
            if (myPrefs?.input_style === "plan" && currentPriority[0] !== "today") {
              suggestedFirst = "today";
              widgetReason = "계획형으로 설정하셨는데, 홈 화면 첫 위젯이 '오늘 할 일'이 아니에요";
            } else if (myPrefs?.consumption_style === "monitor" && currentPriority[0] !== "summary") {
              suggestedFirst = "summary";
              widgetReason = "팀 현황을 자주 보신다고 하셨는데, 홈 화면 첫 위젯이 '요약'이 아니에요";
            }
            if (suggestedFirst) {
              const { data: existingWidgetSug } = await supabase.from("preference_suggestions")
                .select("id").eq("user_id", me2.id).eq("field", "home_priority").eq("status", "pending").maybeSingle();
              if (!existingWidgetSug) {
                const newOrder = [suggestedFirst, ...currentPriority.filter((v: string) => v !== suggestedFirst)];
                await supabase.from("preference_suggestions").insert({
                  user_id: me2.id, field: "home_priority",
                  current_value: currentPriority.join(","), suggested_value: newOrder.join(","),
                  reason: widgetReason,
                });
              }
            }

            // 3. 행동 기반 코칭 — 최근 완료 업무 중 마감일 놓친 비율이 높으면 조언
            const { data: recentDone } = await supabase.from("tasks")
              .select("due_date, updated_at").eq("assignee_id", me2.id).eq("status", "done")
              .not("due_date", "is", null).order("updated_at", { ascending: false }).limit(10);
            if (recentDone && recentDone.length >= 5) {
              const missedCount = recentDone.filter((t: any) => new Date(t.updated_at) > new Date(t.due_date)).length;
              const missRate = missedCount / recentDone.length;
              if (missRate >= 0.5) {
                const { data: existingCoach } = await supabase.from("preference_suggestions")
                  .select("id").eq("user_id", me2.id).eq("field", "deadline_coaching").eq("status", "pending").maybeSingle();
                if (!existingCoach) {
                  await supabase.from("preference_suggestions").insert({
                    user_id: me2.id, field: "deadline_coaching",
                    current_value: "as_is", suggested_value: "buffer",
                    reason: `최근 완료한 업무 ${recentDone.length}건 중 ${missedCount}건이 마감일을 넘겨서 끝났어요 — 다음부턴 마감일을 조금 여유있게 잡아보는 게 어떨까요?`,
                  });
                }
              }
            }

            // 4. 기록 명확성 코칭 — 최근 기록이 너무 짧으면(AI가 잘 못 잡아낼 가능성) 안내
            const shortTexts = texts.filter((t: string) => t.length < 10).length;
            if (texts.length >= 5 && shortTexts / texts.length >= 0.6) {
              const { data: existingClarity } = await supabase.from("preference_suggestions")
                .select("id").eq("user_id", me2.id).eq("field", "record_clarity").eq("status", "pending").maybeSingle();
              if (!existingClarity) {
                await supabase.from("preference_suggestions").insert({
                  user_id: me2.id, field: "record_clarity",
                  current_value: "as_is", suggested_value: "more_detail",
                  reason: "최근 기록이 짧아서 AI가 업무를 정확히 못 잡아낼 수 있어요 — \"업무명 + 상태\"만이라도 적어주시면 훨씬 정확해져요 (예: \"밸브 발주 완료\")",
                });
              }
            }
          }
        }
      }
    } catch {
      // 부가 기능 실패해도 메인 응답에는 영향 없음
    }

    return NextResponse.json({
      reply: parsed.reply ?? "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      appliedTone: aiTone ?? "concise", // 1. "왜 이렇게 답했는지" 표시용
    });
  } catch (err: any) {
    console.error("Daily log error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
