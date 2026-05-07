// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { snapshot } = await req.json();

    const prompt = `당신은 팀 업무 관리 전문가입니다. 아래 팀 현황 데이터를 분석해서 한국어로 피드백을 제공해주세요.

현황 데이터:
${JSON.stringify(snapshot)}

아래 JSON 형식으로만 응답하세요. 마크다운이나 코드블록 없이 순수 JSON만:
{"summary":"한줄요약(40자이내)","items":[{"level":"danger","title":"제목","detail":"내용","action":"조치"}],"overall_risk":"high"}

level은 danger/warning/info 중 하나, overall_risk는 high/medium/low 중 하나.
items는 최대 5개. 각 필드는 짧고 간결하게.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    
    // JSON 추출 - 여러 방법 시도
    let result = null;
    
    // 방법 1: 전체가 JSON인 경우
    try { result = JSON.parse(text); } catch {}
    
    // 방법 2: 코드블록 제거
    if (!result) {
      const clean = text.replace(/```json|```/g, "").trim();
      try { result = JSON.parse(clean); } catch {}
    }
    
    // 방법 3: { } 사이 추출
    if (!result) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    // 방법 4: 파싱 실패 시 기본 응답
    if (!result) {
      result = {
        summary: "데이터 분석 완료",
        items: [{ level: "info", title: "분석 결과", detail: text.slice(0, 100), action: "TaskFlow에서 상세 확인" }],
        overall_risk: "medium"
      };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
