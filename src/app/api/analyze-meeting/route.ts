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

    const { text, projectId } = await req.json();

    // 팀원 목록 조회 (담당자 매칭용)
    const { data: users } = await supabase.from("users").select("id, name").eq("is_active", true);
    const userNames = (users ?? []).map(u => u.name).join(", ");

    const prompt = `아래는 회의 내용입니다. 분석해서 JSON으로 반환해주세요.

회의 내용:
${text}

팀원 목록: ${userNames}

추출 항목:
1. 액션아이템 (업무로 등록될 것들)
2. 결정사항
3. 이슈/Blocked 항목

JSON으로만 응답:
{
  "summary": "회의 한줄 요약 (50자이내)",
  "date": "회의 날짜 YYYY-MM-DD (언급된 경우, 없으면 null)",
  "participants": ["참석자 이름 배열"],
  "decisions": ["결정사항 문자열 배열"],
  "tasks": [
    {
      "title": "업무명",
      "assignee_name": "담당자 이름 (팀원 목록에서 매칭, 없으면 null)",
      "due_date": "YYYY-MM-DD (언급된 경우, 없으면 null)",
      "priority": "urgent|high|medium|low",
      "task_type": "development|planning|research|qa|operation|documentation|meeting|design|other",
      "is_blocked": false,
      "blocked_reason": "막힌 이유 (is_blocked가 true인 경우)"
    }
  ],
  "issues": ["이슈 문자열 배열"]
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "JSON만 반환하세요. 마크다운 금지.",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("분석 실패");

    const result = JSON.parse(match[0]);

    // 담당자 이름 → ID 매핑
    const userMap = Object.fromEntries((users ?? []).map(u => [u.name, u.id]));
    result.tasks = result.tasks.map((t: any) => ({
      ...t,
      assignee_id: t.assignee_name ? (userMap[t.assignee_name] ?? null) : null,
      assignee_ids: t.assignee_name && userMap[t.assignee_name] ? [userMap[t.assignee_name]] : [],
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
