// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const client = new (await import("@anthropic-ai/sdk")).default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);

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
            toneBlock += "\n이 사용자는 '자세히' 스타일을 선호합니다. reason에 근거를 조금 더 구체적으로 담으세요.";
            reasonLenHint = "50자 이내";
          } else if (prefs?.ai_tone === "concise") {
            toneBlock += "\n이 사용자는 '간결히' 스타일을 선호합니다. reason을 짧고 명확하게.";
          }
          if (prefs?.communication_profile) {
            toneBlock += `\n이 사용자의 소통 스타일(참고용): ${prefs.communication_profile}`;
          }
        }
      }
    } catch {
      // 톤 조회 실패해도 기본 동작은 계속
    }

    const prompt = `업무 마감일 추천 전문가입니다. 아래 정보를 바탕으로 현실적인 마감일을 추천해주세요.

새 업무:
- 제목: ${title}
- 유형: ${task_type}
- 우선순위: ${priority}
- 예상 시간: ${estimated_hours ? estimated_hours + "시간" : "미입력"}

과거 같은 유형 업무 평균 소요일: ${avgDays ? avgDays + "일" : "데이터 없음"}
과거 이력: ${JSON.stringify(historySummary.slice(0, 5))}

오늘 날짜: ${new Date().toLocaleDateString("ko-KR")}
${toneBlock}
JSON으로만 응답:
{
  "recommended_days": 숫자(오늘부터 며칠 후),
  "recommended_date": "YYYY-MM-DD",
  "confidence": "high|medium|low",
  "reason": "추천 이유 ${reasonLenHint}",
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
