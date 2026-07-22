// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);
    const { tasks, userName, now } = await req.json();

    const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date(now) && t.status !== "done");
    const today = tasks.filter((t: any) => {
      if (!t.due_date) return false;
      return new Date(t.due_date).toDateString() === new Date(now).toDateString() && t.status !== "done";
    });
    const blocked = tasks.filter((t: any) => t.status === "blocked");
    const doing = tasks.filter((t: any) => t.status === "doing");
    const soon = tasks.filter((t: any) => {
      if (!t.due_date || t.status === "done") return false;
      const diff = Math.ceil((new Date(t.due_date).getTime() - new Date(now).getTime()) / 86400000);
      return diff > 0 && diff <= 3;
    });

    // 요청한 사람의 톤/소통 스타일 반영 (계정별 학습 데이터)
    let toneBlock = "";
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
        if (me) {
          const { data: prefs } = await supabase.from("user_preferences")
            .select("ai_tone, communication_profile").eq("user_id", me.id).maybeSingle();
          if (prefs?.ai_tone === "detailed") {
            toneBlock = "\n\n응답 톤: 이 사용자는 '자세히' 스타일을 선호합니다. 3-4문장으로 근거를 조금 더 구체적으로 설명하세요.";
          } else if (prefs?.ai_tone === "detailed_with_summary") {
            toneBlock = "\n\n응답 톤: 이 사용자는 '자세히 + 요약' 스타일을 선호합니다. 첫 문장에 오늘 핵심을 한 줄로 요약하고, 이어서 자세한 설명을 덧붙이세요.";
          } else {
            toneBlock = "\n\n응답 톤: 이 사용자는 '간결히' 스타일을 선호합니다. 2문장 이내로 짧고 명확하게.";
          }
          if (prefs?.communication_profile) {
            toneBlock += `\n이 사용자의 소통 스타일(참고용): ${prefs.communication_profile}`;
          }
        }
      }
    } catch {
      // 톤 조회 실패해도 기본 동작은 계속
    }

    const prompt = `당신은 ${userName}님의 개인 업무 비서입니다.
오늘 날짜: ${new Date(now).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}

현재 업무 현황:
- 진행 중 (${doing.length}건): ${doing.map((t: any) => t.title).join(", ") || "없음"}
- 오늘 마감 (${today.length}건): ${today.map((t: any) => t.title).join(", ") || "없음"}
- 마감 초과 (${overdue.length}건): ${overdue.map((t: any) => t.title).join(", ") || "없음"}
- Blocked (${blocked.length}건): ${blocked.map((t: any) => `${t.title}${t.blocked_reason ? `(${t.blocked_reason})` : ""}`).join(", ") || "없음"}
- D-3 이내 마감 (${soon.length}건): ${soon.map((t: any) => t.title).join(", ") || "없음"}

위 현황을 바탕으로 오늘 집중해야 할 것과 주의사항을 간결하게 브리핑해주세요. 친근하고 명확한 한국어로 작성하고, 구체적인 업무명을 언급해주세요. 업무가 없으면 오늘 여유있게 새 업무를 준비해보라고 안내해주세요.

서식 규칙 (가독성을 위해 반드시 지켜주세요):
- 문장이 길어지지 않게 적절히 줄바꿈(\\n)을 넣어 여러 줄로 나누세요. 한 문단에 모든 내용을 몰아넣지 마세요.
- 가장 중요하다고 판단되는 업무명이나 핵심 문구는 **이렇게** 두 개의 별표로 감싸서 강조하세요(마크다운 굵게 표시, 실제로 화면에서 굵게 렌더링됩니다).
- 코드블록이나 다른 마크다운 문법(#, -, \` 등)은 쓰지 마세요. 줄바꿈과 **굵게**만 사용하세요.
${toneBlock}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "브리핑을 생성할 수 없습니다.";
    return NextResponse.json({ briefing: text });
  } catch (err: any) {
    console.error("Briefing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
