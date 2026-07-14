// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// 오늘 한 일을 자유 텍스트로 받아서, 기존 업무 완료 처리 / 신규 업무 등록을 제안합니다.
// 기록(사후 로그) 우선 전략에 맞춘 엔드포인트입니다 — 실시간 상태 강제 입력이 아니라
// "무슨 일이 있었는지"를 사후에 가볍게 남기고, AI가 업무 매칭을 대신 해줍니다.
export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text, userName, tasks, now } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ reply: "내용을 입력해주세요.", suggestions: [] });
    }

    const openTasks = (tasks ?? []).filter((t: any) => t.status !== "done");
    const taskList = openTasks
      .map((t: any) => `- [${t.id}] ${t.title}${t.project ? ` (프로젝트: ${t.project})` : ""} (현재 상태: ${t.status})`)
      .join("\n");

    const prompt = `당신은 ${userName}님의 업무 기록 보조 AI입니다.
오늘 날짜: ${new Date(now).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}

사용자가 오늘 한 일을 자유롭게 적었습니다. 이 내용을 분석해서:
1. 기존 업무 중 완료된 것으로 보이는 게 있으면 "complete" 제안
2. 기존 업무 목록에 없는 새로운 작업 내용이 언급됐으면 "create" 제안 (완료된 것 같으면 status "done", 아직 진행 중인 것 같으면 status "doing")
3. 애매하거나 업무와 무관한 내용(잡담 등)은 제안하지 않습니다.
4. 사용자가 프로젝트명을 언급하면, 업무 목록의 (프로젝트: ...) 표시와 대조해서 더 정확하게 매칭하세요. 같은 제목의 업무가 여러 프로젝트에 있을 수 있으니 프로젝트명이 매칭 판단에 중요한 단서입니다.

현재 사용자의 미완료 업무 목록:
${taskList || "(없음)"}

사용자가 오늘 적은 내용:
"""
${text}
"""

반드시 아래 JSON 형식으로만 답하세요. 다른 설명, 마크다운, 코드블록 없이 순수 JSON만 출력하세요.
{
  "reply": "사용자에게 보여줄 한두 문장의 짧은 확인 멘트",
  "suggestions": [
    { "type": "complete", "taskId": "기존 업무 id", "title": "업무 제목", "reason": "왜 이렇게 판단했는지 한 문장" },
    { "type": "create", "title": "새 업무 제목", "status": "done 또는 doing", "reason": "왜 새 업무로 판단했는지 한 문장" }
  ]
}
제안할 게 없으면 suggestions는 빈 배열로 두세요.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { reply: "기록은 남겼지만, 제안을 만드는 데 실패했어요.", suggestions: [] };
    }

    return NextResponse.json({
      reply: parsed.reply ?? "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    });
  } catch (err: any) {
    console.error("Daily log error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
