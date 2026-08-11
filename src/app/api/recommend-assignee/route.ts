// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const client = new (await import("@anthropic-ai/sdk")).default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);

    const { title, task_type, priority, projectId } = await req.json();

    const { data: users } = await supabase
      .from("users").select("id, name, role, level").eq("is_active", true).neq("role", "viewer");

    const { data: tasks } = await supabase
      .from("tasks").select("assignee_id, assignee_ids, status, task_type")
      .not("status", "eq", "done");

    // 실제 완료 이력 — 이 유형을 얼마나 많이 완료해봤는지(진짜 경험치 신호)
    const { data: doneTasks } = await supabase
      .from("tasks").select("assignee_id, assignee_ids, task_type")
      .eq("status", "done");

    const memberStats = (users ?? []).map(u => {
      const mine = (tasks ?? []).filter(t =>
        t.assignee_id === u.id || (t.assignee_ids ?? []).includes(u.id)
      );
      const doneMine = (doneTasks ?? []).filter(t =>
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
        completedSameType: doneMine.filter(t => t.task_type === task_type).length, // 실제 완료 경험
        totalCompleted: doneMine.length,
      };
    });

    let eligible = memberStats;
    if (projectId) {
      const { data: members } = await supabase
        .from("project_members").select("user_id").eq("project_id", projectId);
      const ids = (members ?? []).map(m => m.user_id);
      if (ids.length > 0) eligible = memberStats.filter(u => ids.includes(u.id));
    }

    // 요청한 사람의 톤/소통 스타일 반영 (계정별 학습 데이터)
    let toneBlock = "";
    let reasonLenHint = "20자이내";
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
        if (me) {
          const { data: prefs } = await supabase.from("user_preferences")
            .select("ai_tone, communication_profile").eq("user_id", me.id).maybeSingle();
          if (prefs?.ai_tone === "detailed" || prefs?.ai_tone === "detailed_with_summary") {
            toneBlock += "\n이 사용자는 '자세히' 스타일을 선호합니다. reason에 근거를 조금 더 구체적으로 담으세요.";
            reasonLenHint = "40자이내";
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

    const prompt = `팀 업무 배정 전문가로서 아래 업무에 가장 적합한 담당자를 추천해주세요.

새 업무: ${title} (유형: ${task_type}, 우선순위: ${priority})

팀원 현황:
${JSON.stringify(eligible)}

추천 기준: 진행 중 업무 적은 사람, **실제로 이 유형(completedSameType)을 완료해본 경험이 많은 사람 우선**, Blocked 없는 사람. 단순히 지금 같은 유형 업무를 들고 있는 것(sameType)보다 실제 완료 경험(completedSameType)을 더 신뢰할 만한 신호로 보세요.
${toneBlock}
JSON으로만 응답:
{"recommendations":[{"user_id":"uuid","name":"이름","score":1-100,"reason":"이유${reasonLenHint}"}]}
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
