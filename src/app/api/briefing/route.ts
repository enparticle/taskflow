// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    const prompt = `당신은 ${userName}님의 개인 업무 비서입니다.
오늘 날짜: ${new Date(now).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}

현재 업무 현황:
- 진행 중 (${doing.length}건): ${doing.map((t: any) => t.title).join(", ") || "없음"}
- 오늘 마감 (${today.length}건): ${today.map((t: any) => t.title).join(", ") || "없음"}
- 마감 초과 (${overdue.length}건): ${overdue.map((t: any) => t.title).join(", ") || "없음"}
- Blocked (${blocked.length}건): ${blocked.map((t: any) => `${t.title}${t.blocked_reason ? `(${t.blocked_reason})` : ""}`).join(", ") || "없음"}
- D-3 이내 마감 (${soon.length}건): ${soon.map((t: any) => t.title).join(", ") || "없음"}

위 현황을 바탕으로 오늘 집중해야 할 것과 주의사항을 2-3문장으로 간결하게 브리핑해주세요. 친근하고 명확한 한국어로 작성하고, 구체적인 업무명을 언급해주세요. 업무가 없으면 오늘 여유있게 새 업무를 준비해보라고 안내해주세요.`;

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
