// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { snapshot } = await req.json();

    const prompt = `당신은 팀 업무 관리 전문가입니다. 아래 팀 현황 데이터를 분석해서 실용적인 피드백을 한국어로 제공해주세요.

## 현재 팀 업무 현황
${JSON.stringify(snapshot, null, 2)}

## 분석 요청
다음 항목들을 분석해주세요:
1. 업무량 과부하가 있는 구성원
2. 마감 위험 업무
3. 장기 Blocked 업무
4. 전체적인 프로젝트 진행 리스크

## 응답 형식
반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.
{
  "summary": "전체 현황 한 줄 요약 (50자 이내)",
  "items": [
    {
      "level": "danger | warning | info",
      "title": "제목 (20자 이내)",
      "detail": "상세 내용 (80자 이내)",
      "action": "권장 조치 (50자 이내)"
    }
  ],
  "overall_risk": "high | medium | low"
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    
    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 응답을 파싱할 수 없습니다");
    
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Claude feedback error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
