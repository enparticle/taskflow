// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);

    const { title, description } = await req.json();

    // 요청한 사람의 톤/소통 스타일 반영 (계정별 학습 데이터)
    let toneBlock = "";
    let reasonLenHint = "30자 이내";
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
        if (me) {
          const { data: prefs } = await supabase.from("user_preferences")
            .select("ai_tone, communication_profile").eq("user_id", me.id).maybeSingle();
          if (prefs?.ai_tone === "detailed" || prefs?.ai_tone === "detailed_with_summary") {
            toneBlock = "\n이 사용자는 '자세히' 스타일을 선호합니다. reason에 판단 근거를 조금 더 구체적으로 담으세요.";
            reasonLenHint = "50자 이내";
          } else if (prefs?.ai_tone === "concise") {
            toneBlock = "\n이 사용자는 '간결히' 스타일을 선호합니다. reason을 짧고 명확하게.";
          }
          if (prefs?.communication_profile) {
            toneBlock += `\n이 사용자의 소통 스타일(참고용): ${prefs.communication_profile}`;
          }
        }
      }
    } catch {
      // 톤 조회 실패해도 기본 동작은 계속
    }

    const prompt = `업무 정보를 분석해서 분류해주세요.

업무명: ${title}
${description ? `설명: ${description}` : ""}

아래 JSON 형식으로만 응답하세요:
{
  "task_type": "planning|design|development|qa|operation|documentation|meeting|research|customer|other",
  "priority": "low|medium|high|urgent",
  "estimated_hours": 숫자(예상 소요 시간, 0.5~40 사이),
  "reason": "분류 이유 ${reasonLenHint}"
}

분류 기준:
- task_type: 업무 성격에 맞는 유형 선택
- priority: urgent(당일/긴급), high(중요), medium(일반), low(여유)
- estimated_hours: 비슷한 업무의 평균 소요 시간 예측
${toneBlock}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("분류 실패");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
