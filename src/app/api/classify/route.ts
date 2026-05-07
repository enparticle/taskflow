// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { title, description } = await req.json();

    const prompt = `업무 정보를 분석해서 분류해주세요.

업무명: ${title}
${description ? `설명: ${description}` : ""}

아래 JSON 형식으로만 응답하세요:
{
  "task_type": "planning|design|development|qa|operation|documentation|meeting|research|customer|other",
  "priority": "low|medium|high|urgent",
  "estimated_hours": 숫자(예상 소요 시간, 0.5~40 사이),
  "reason": "분류 이유 한 줄 (30자 이내)"
}

분류 기준:
- task_type: 업무 성격에 맞는 유형 선택
- priority: urgent(당일/긴급), high(중요), medium(일반), low(여유)
- estimated_hours: 비슷한 업무의 평균 소요 시간 예측`;

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
