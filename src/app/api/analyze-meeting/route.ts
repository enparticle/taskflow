// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text, audioText, projectId, meetingMeta } = await req.json();

    const hasBoth = text?.trim() && audioText?.trim();
    const hasAudio = audioText?.trim();
    const hasText = text?.trim();

    const prompt = `당신은 회의록 분석 전문가입니다. 아래 회의 정보를 분석해서 업무와 결정사항을 추출해주세요.

${meetingMeta ? `회의 정보:
- 회의명: ${meetingMeta.title || "미정"}
- 일시: ${meetingMeta.date || "미정"}
- 참석자: ${meetingMeta.attendees?.join(", ") || "미정"}` : ""}

${hasText ? `\n회의록 내용:\n${text}` : ""}
${hasBoth ? `\n---\n음성 녹음 변환 내용 (위 회의록과 교차 분석해주세요):\n${audioText}` : ""}
${hasAudio && !hasText ? `\n음성 녹음 변환 내용:\n${audioText}` : ""}

분석 지시사항:
${hasBoth ? "- 회의록과 음성 녹음 두 가지를 교차 분석해서 서로 보완하여 완전한 정보를 추출하세요. 회의록에 담당자가 있고 음성에 마감일이 있으면 합쳐서 하나의 업무로 만드세요." : ""}
- 구체적인 업무 항목을 추출하고 담당자, 마감일, 우선순위를 파악하세요
- 결정사항과 이슈를 명확히 구분하세요
- 참석자 이름이 언급되면 담당자로 연결하세요

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이 순수 JSON):
{
  "summary": "회의 전체 요약 2-3문장",
  "participants": ["참석자1", "참석자2"],
  "decisions": ["결정사항1", "결정사항2"],
  "tasks": [
    {
      "title": "업무명",
      "task_type": "planning|development|design|qa|operation|documentation|meeting|research|customer|other",
      "priority": "urgent|high|medium|low",
      "due_date": "YYYY-MM-DD 또는 null",
      "assignee_name": "담당자 이름 또는 null",
      "is_blocked": false,
      "blocked_reason": null
    }
  ],
  "issues": ["이슈1", "이슈2"]
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
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
      result = { summary: "분석 완료", items: [], tasks: [], decisions: [], issues: [] };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("analyze-meeting error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
