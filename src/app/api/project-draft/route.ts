// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { name } = await req.json();

    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setMonth(defaultEnd.getMonth() + 3);

    const prompt = `프로젝트 이름이 "${name}"입니다.
이 프로젝트의 간단한 설명과 예상 마감일을 JSON으로 작성해주세요.

오늘 날짜: ${today.toISOString().split("T")[0]}

JSON으로만 응답:
{
  "description": "프로젝트 목적과 핵심 목표를 2~3문장으로 (100자 이내)",
  "end_date": "YYYY-MM-DD 형식의 예상 마감일 (규모에 따라 1~6개월 후)"
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "JSON만 반환하세요. 마크다운 금지.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("파싱 실패");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
