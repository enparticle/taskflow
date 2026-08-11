// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAuthedClient } from "@/lib/supabaseServer";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 TaskFlow 개인화 설정을 도와주는 AI입니다.
사용자와 자연스럽게 대화하면서, 아래 20가지 항목을 편하게 물어보고 답을 모으세요.
한 번에 다 묻지 말고 카테고리별로 3~4개씩 묶어서 자연스럽게 물어보세요(입력/홈 → 업무목록 → 소비/이동 → 알림 → 화면 → AI 순서 권장). 사용자가 "잘 모르겠다"거나 "기본값으로"라고 하면 무난한 기본값으로 넘어가고 다음 질문으로 진행하세요. 지치지 않게, 답변이 짧아도 바로바로 다음으로 넘어가세요.

수집할 20개 항목:

[입력/홈]
1. input_style: 업무 기록 스타일 — "plan"(미리 계획) | "log"(끝난 뒤 기록) | "click"(클릭으로 끝)
2. home_priority: 홈 화면 위젯 순서 — "today","recent","summary" 중 보고싶은 순서로 배열
3. hidden_widgets: 위 중 아예 안 보고 싶은 것 (배열, 없으면 [])
4. greeting_enabled: 홈에 "좋은 아침이에요" 같은 인사말 표시할지 (true/false)
5. briefing_auto_expand: AI 브리핑을 기본으로 펼쳐서 보여줄지, 접어둘지 (true/false)
6. ai_auto_approve: 오늘 한 일 기록에서 AI 제안을 매번 확인 안 하고 자동 승인할지 (true/false, 기본 false 권장 — 신중한 사람이 많음을 안내)

[업무 목록]
7. default_sort: 업무 목록 기본 정렬 — status|priority|due_date|created_at|title
8. default_hide_done: 완료된 업무를 기본으로 숨길지 (true/false)
9. default_status_filter: 기본으로 보고 싶은 상태 — 반드시 문자열 하나만: "all" 또는 todo/doing/review/blocked/backlog 중 하나. 여러 개를 원해도 배열 말고 가장 우선인 상태 하나만 고르게 하세요
10. default_priority_filter: 기본으로 보고 싶은 우선순위 — 반드시 문자열 하나만: "all" 또는 urgent/high/medium/low 중 하나

[소비/이동]
11. consumption_style: 팀 전체 현황을 얼마나 자주 보는지 — "monitor"(자주) | "summary"(가끔) | "unsure"
12. landing_page: 홈 화면에서 가장 강조해서 보고 싶은 내용 — "dashboard"(오늘 기록/요약 중심의 기본 홈 화면) | "my-work"(홈 화면 맨 위에 내 업무 전체 목록을 띄움). ⚠️ 다른 페이지로 이동시키는 게 아니라, 홈 화면 안에 무엇을 보여줄지 정하는 것입니다 — 사용자에게 설명할 때도 "로그인하면 홈 화면에 이게 먼저 보이게 할게요" 식으로, 페이지 이동처럼 들리지 않게 표현하세요.

[알림]
13. notification_style: 알림 받는 방식 — "immediate"(즉시) | "daily_digest"(하루 한번 모아서) | "off"
14. notification_types: 받고 싶은 알림 종류(배열, 복수선택) — "mention"(댓글멘션), "deadline"(마감임박), "blocked"(Blocked발생), "approval"(승인/반려결과), "ai_suggestion"(AI제안)
15. deadline_reminder_days: 마감 며칠 전부터 알림받고 싶은지 (숫자, 기본 2)

[화면]
16. density: 화면 밀도 — "comfortable"(여유) | "compact"(밀집)
17. font_size: 글자 크기 — "small" | "medium" | "large"
18. calendar_default_view: 캘린더 기본 화면 — "week" | "month"

[AI]
19. ai_tone: AI 응답 스타일 — "concise"(간결) | "detailed"(자세히, 근거 포함) | "detailed_with_summary"(자세히 설명하되 맨 앞에 한 줄 요약도 같이)

[고급 기능]
20. enabled_features: 하단 "더보기" 메뉴에 추가로 켤 기능(배열) — "my-work","kanban","tree","recurring","project-assistant","report-export" 중 필요한 것만. 각각 뭔지 짧게 설명해주고 고르게 하세요

대화 규칙:
- 친근하고 짧게, 이모지 하나 정도는 괜찮음
- 이미 답한 내용은 다시 안 물어봄
- 20개 다 모이면 카테고리별로 요약 정리해서 보여주고 확인 요청("이렇게 설정할까요?") 후, 확인되면 아래 JSON으로 응답
- 확인 응답을 만들 때, 대화 내내 사용자가 어떻게 말했는지(문장 길이, 격식/캐주얼, 결정을 빨리 내리는지 망설이는지, 이모지 사용 여부, 말투 특징)를 관찰해서 "communication_profile"에 1~2문장으로 요약하세요. 이건 나중에 다른 AI 기능이 이 사람에게 응답할 때 톤을 맞추는 데 참고자료로만 쓰입니다 — 오타나 축약어까지 따라 하라는 뜻이 아니라, 간결함/격식 정도/결정 속도 같은 성향만 반영하면 됩니다.
- 같은 관찰을 바탕으로 "formality_level"(formal|casual), "message_length_pref"(short|medium|long), "decision_speed"(fast|deliberate)도 함께 판단해서 채우세요.

확인 완료 시 응답 형식 (반드시 이 마커 사용, 21개 필드 모두 포함):
RESULT_JSON
{
  "input_style": "plan|log|click",
  "home_priority": ["today","recent","summary"],
  "hidden_widgets": [],
  "greeting_enabled": true,
  "briefing_auto_expand": false,
  "ai_auto_approve": false,
  "default_sort": "status",
  "default_hide_done": true,
  "default_status_filter": "all",
  "default_priority_filter": "all",
  "consumption_style": "unsure",
  "landing_page": "dashboard",
  "notification_style": "immediate",
  "notification_types": ["mention","deadline","blocked","approval","ai_suggestion"],
  "deadline_reminder_days": 2,
  "density": "comfortable",
  "font_size": "medium",
  "calendar_default_view": "week",
  "ai_tone": "concise",
  "enabled_features": [],
  "communication_profile": "짧고 캐주얼하게 말함. 애매하게 답하지 않고 바로 결정함. 이모지는 거의 안 씀.",
  "formality_level": "formal|casual",
  "message_length_pref": "short|medium|long",
  "decision_speed": "fast|deliberate"
}
END_JSON`;

export async function POST(req: NextRequest) {
  try {
    const supabase = createAuthedClient(req);
    const { messages, chatId } = await req.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const assistantMsg = response.content[0].type === "text" ? response.content[0].text : "";

    let result = null;
    if (assistantMsg.includes("RESULT_JSON")) {
      const match = assistantMsg.match(/RESULT_JSON\s*(\{[\s\S]*?\})\s*END_JSON/);
      if (match) {
        try { result = JSON.parse(match[1]); } catch {}
      }
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    let me: any = null;
    if (authUser) {
      const { data } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
      me = data;
    }

    if (result && me) {
      await supabase.from("user_preferences").upsert({
        user_id: me.id,
        input_style: result.input_style,
        home_priority: result.home_priority,
        hidden_widgets: result.hidden_widgets ?? [],
        greeting_enabled: result.greeting_enabled,
        briefing_auto_expand: result.briefing_auto_expand,
        ai_auto_approve: result.ai_auto_approve,
        default_sort: result.default_sort,
        default_hide_done: result.default_hide_done,
        default_status_filter: result.default_status_filter,
        default_priority_filter: result.default_priority_filter,
        consumption_style: result.consumption_style,
        landing_page: result.landing_page,
        notification_style: result.notification_style,
        notification_types: result.notification_types,
        deadline_reminder_days: result.deadline_reminder_days,
        density: result.density,
        font_size: result.font_size,
        calendar_default_view: result.calendar_default_view,
        ai_tone: result.ai_tone,
        enabled_features: result.enabled_features ?? [],
        communication_profile: result.communication_profile ?? null,
        formality_level: result.formality_level ?? undefined,
        message_length_pref: result.message_length_pref ?? undefined,
        decision_speed: result.decision_speed ?? undefined,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    // 대화 기록 저장 — chatId 있으면 이어쓰기, 없으면 새로 생성
    const updatedMessages = [...messages, { role: "assistant", content: assistantMsg }];
    let newChatId = chatId;
    if (me) {
      if (chatId) {
        await supabase.from("style_chats").update({
          messages: updatedMessages,
          result,
          status: result ? "completed" : "ongoing",
          updated_at: new Date().toISOString(),
        }).eq("id", chatId);
      } else {
        const { data: created } = await supabase.from("style_chats").insert({
          user_id: me.id,
          messages: updatedMessages,
          result,
          status: result ? "completed" : "ongoing",
        }).select("id").single();
        newChatId = created?.id ?? null;
      }
    }

    const displayMsg = assistantMsg.split("RESULT_JSON")[0].trim();
    return NextResponse.json({ message: displayMsg || "설정이 저장됐어요! ✓", result, chatId: newChatId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
