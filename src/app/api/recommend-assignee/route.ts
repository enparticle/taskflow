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

    const { title, task_type, priority, projectId } = await req.json();

    const { data: users } = await supabase
      .from("users").select("id, name, role, level").eq("is_active", true).neq("role", "viewer");

    const { data: tasks } = await supabase
      .from("tasks").select("assignee_id, assignee_ids, status, task_type")
      .not("status", "eq", "done");

    const memberStats = (users ?? []).map(u => {
      const mine = (tasks ?? []).filter(t =>
        t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)
      );
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        level: u.level ?? "-",
        doing: mine.filter(t => t.status === "doing").length,
        total: mine.length,
        blocked: mine.filter(t => t.status === "blocked").length,
        sameType: mine.filter(t => t.task_type === task_type).length,
      };
    });

    let eligible = memberStats;
    if (projectId) {
      const { data: members } = await supabase
        .from("project_members").select("user_id").eq("project_id", projectId);
      const ids = (members ?? []).map(m => m.user_id);
      if (ids.length > 0) eligible = memberStats.filter(u => ids.includes(u.id));
    }

    const prompt = `팀 업무 배정 전문가로서 아래 업무에 가장 적합한 담당자를 추천해주세요.

새 업무: ${title} (유형: ${task_type}, 우선순위: ${priority})

팀원 현황:
${JSON.stringify(eligible)}

추천 기준: 진행 중 업무 적은 사람, 같은 유형 경험 있는 사람, Blocked 없는 사람

JSON으로만 응답:
{"recommendations":[{"user_id":"uuid","name":"이름","score":1-100,"reason":"이유20자이내"}]}
최대 3명, score 내림차순.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
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
