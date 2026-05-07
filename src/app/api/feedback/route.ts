// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { snapshot } = await req.json();

    const prompt = `당신은 팀 업무 관리 전문가입니다. 아래 팀 현황 데이터를 분석해서 실용적인 피드백을 한국어로 제공해주세요.

## 현재 팀 업무 현황
${JSON.stringify(snapshot, null, 2)}

## 분석 요청
1. 업무량 과부하가 있는 구성원
2. 마감 위험 업무
3. 장기 Blocked 업무
4. 전체적인 프로젝트 진행 리스크

## 응답 형식 (JSON만, 다른 텍스트 없이)
{"summary":"전체 현황 한 줄 요약","items":[{"level":"danger|warning|info","title":"제목","detail":"상세내용","action":"권장조치"}],"overall_risk":"high|medium|low"}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
