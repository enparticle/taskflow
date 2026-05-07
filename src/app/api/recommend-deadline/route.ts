// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { title, task_type, priority, estimated_hours } = await req.json();

    // 같은 유형의 완료된 업무 이력 조회
    const { data: history } = await supabase
      .from("tasks")
      .select("title, task_type, priority, estimated_hours, actual_hours, created_at, completed_at")
      .eq("task_type", task_type)
      .eq("status", "done")
      .not("completed_at", "is", null)
      .not("created_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10);

    // 소요일 계산
    const historySummary = (history ?? []).map(t => {
      const days = t.completed_at && t.created_at
        ? Math.ceil((new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 86400000)
        : null;
      return { title: t.title, priority: t.priority, estimated: t.estimated_hours, actual: t.actual_hours, days };
    }).filter(t => t.days && t.days > 0 && t.days < 90);

    const avgDays = historySummary.length > 0
      ? Math.round(historySummary.reduce((s, t) => s + (t.days ?? 0), 0) / historySummary.length)
      : null;

    const prompt = `업무 마감일 추천 전문가입니다. 아래 정보를 바탕으로 현실적인 마감일을 추천해주세요.

새 업무:
- 제목: ${title}
- 유형: ${task_type}
- 우선순위: ${priority}
- 예상 시간: ${estimated_hours ? estimated_hours + "시간" : "미입력"}

과거 같은 유형 업무 평균 소요일: ${avgDays ? avgDays + "일" : "데이터 없음"}
과거 이력: ${JSON.stringify(historySummary.slice(0, 5))}

오늘 날짜: ${new Date().toLocaleDateString("ko-KR")}

JSON으로만 응답:
{
  "recommended_days": 숫자(오늘부터 며칠 후),
  "recommended_date": "YYYY-MM-DD",
  "confidence": "high|medium|low",
  "reason": "추천 이유 30자 이내",
  "range": {"min": 최소일수, "max": 최대일수}
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("추천 실패");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
