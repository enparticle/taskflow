// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

async function callWithRetry(client: Anthropic, params: any, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      if (e?.status === 529 && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { text, projectId } = await req.json();

    const { data: users } = await supabase.from("users").select("id, name").eq("is_active", true).neq("role", "viewer");
    const userList = (users ?? []).map((u: any) => `${u.name}(${u.id})`).join(", ");

    const prompt = `다음 회의록을 분석해서 JSON으로 반환하세요.

회의록:
${text}

팀원 목록: ${userList}

추출할 항목:
1. 액션아이템 (업무로 등록할 것들)
2. 결정사항
3. 이슈/Blocked 항목
4. 참석자

아래 JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만:
{
  "summary": "회의 한줄 요약 (60자 이내)",
  "participants": ["참석자1", "참석자2"],
  "decisions": ["결정사항1", "결정사항2"],
  "issues": ["이슈1", "이슈2"],
  "tasks": [
    {
      "title": "업무명",
      "task_type": "planning|development|research|qa|operation|documentation|meeting|design|other",
      "priority": "urgent|high|medium|low",
      "assignee_id": "담당자 UUID (팀원 목록에서, 없으면 null)",
      "assignee_name": "담당자 이름 (없으면 null)",
      "assignee_ids": ["UUID"],
      "due_date": "YYYY-MM-DD (언급된 경우만, 없으면 null)",
      "is_blocked": false,
      "blocked_reason": null
    }
  ]
}`;

    const message = await callWithRetry(client, {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "당신은 JSON만 반환합니다. 절대로 마크다운, 코드블록, 설명 텍스트를 포함하지 마세요.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    let result = null;
    try { result = JSON.parse(raw); } catch {}
    if (!result) {
      const clean = raw.replace(/```json|```/g, "").trim();
      try { result = JSON.parse(clean); } catch {}
    }
    if (!result) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch {} }
    }
    if (!result) return NextResponse.json({ error: "분석 결과를 파싱할 수 없습니다" }, { status: 500 });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("analyze-meeting error:", err);
    return NextResponse.json({ error: err.message ?? "서버 오류" }, { status: 500 });
  }
}