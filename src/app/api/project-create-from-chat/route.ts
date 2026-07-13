// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const supabase = createAuthedClient(req);

    const { result, userId, assigneeId } = await req.json();
    const { project, milestones, tasks } = result;

    // 프로젝트 생성 — 이제 실제 로그인 사용자 권한으로 실행 (RLS: admin만 가능)
    const { data: proj, error: projErr } = await supabase
      .from("projects").insert({ ...project, owner_id: userId }).select().single();
    if (projErr) throw new Error(projErr.message);

    // 담당자 추가
    if (assigneeId) {
      await supabase.from("project_members").insert({ project_id: proj.id, user_id: assigneeId, role: "leader" });
    }

    // 마일스톤 생성
    const msCreated = [];
    for (let i = 0; i < (milestones ?? []).length; i++) {
      const { data: ms } = await supabase.from("milestones").insert({
        ...milestones[i], project_id: proj.id, sort_order: i,
      }).select().single();
      if (ms) msCreated.push(ms);
    }

    // 업무 생성
    for (const task of tasks ?? []) {
      await supabase.from("tasks").insert({
        ...task,
        project_id: proj.id,
        assignee_id: assigneeId ?? null,
        assignee_ids: assigneeId ? [assigneeId] : [],
      });
    }

    return NextResponse.json({ projectId: proj.id, project: proj });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
