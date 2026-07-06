// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const bodyText = await req.text();
    const { prompt, changeText, projectContext } = JSON.parse(bodyText);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: "당신은 프로젝트 관리 전문가입니다. 변경사항이 업무들에 미치는 영향을 분석하고 구체적인 수정 제안을 JSON으로 응답합니다. 반드시 순수 JSON만 응답하세요.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const clean = raw.replace(/^```[a-z]*\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    let result = null;
    try { result = JSON.parse(clean); } catch {}
    if (!result) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch {} }
    }
    if (!result) {
      result = { summary: "분석 완료", affected: [] };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
