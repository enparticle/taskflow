// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { createClient } = await import("@supabase/supabase-js");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { title, task_type, priority, projectId } = await req.json();

    // 구성원 현황 조회
    const { data: users } = await supabase
      .from("users").select("id, name, role, level").eq("is_active", true);

    const { data: tasks } = await supabase
      .from("tasks").select("assignee_id, assignee_ids, status, task_type, priority")
      .not("status", "eq", "done");

    // 구성원별 현재 업무량 계산
    const memberStats = (users ?? []).map(u => {
      const mine = (tasks ?? []).filter(t =>
        t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)
      );
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        level: u.level,
        doing: mine.filter(t => t.status === "doing").length,
        total: mine.length,
        blocked: mine.filter(t => t.status === "blocked").length,
        sameTypeCount: mine.filter(t => t.task_type === task_type).length,
      };
    });

    // 프로젝트 멤버만 필터 (projectId가 있는 경우)
    let eligible = memberStats;
    if (projectId) {
      const { data: members } = await supabase
        .from("project_members").select("user_id").eq("project_id", projectId);
      const memberIds = (members ?? []).map(m => m.user_id);
      if (memberIds.length > 0) eligible = memberStats.filter(u => memberIds.includes(u.id));
    }

    const prompt = `팀 업무 배정 전문가로서 아래 업무에 가장 적합한 담당자를 추천해주세요.

새 업무:
- 제목: ${title}
- 유형: ${task_type}
- 우선순위: ${priority}

현재 팀원 현황:
${JSON.stringify(eligible, null, 2)}

추천 기준:
1. 현재 진행 중(doing) 업무가 적은 사람
2. 같은 유형 업무 경험이 많은 사람
3. Blocked 업무가 없는 사람
4. 역할/레벨이 업무에 적합한 사람

아래 JSON으로만 응답하세요:
{
  "recommendations": [
    {
      "user_id": "uuid",
      "name": "이름",
      "score": 1-100,
      "reason": "추천 이유 (20자 이내)"
    }
  ]
}
최대 3명만 추천하고 score 내림차순으로 정렬하세요.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
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
