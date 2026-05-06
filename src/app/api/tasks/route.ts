import { createServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "업무명을 입력해주세요" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title:           body.title.trim(),
        description:     body.description || null,
        task_type:       body.task_type   || "other",
        priority:        body.priority    || "medium",
        difficulty:      body.difficulty  || null,
        assignee_id:     body.assignee_id || null,
        project_id:      body.project_id  || null,
        due_date:        body.due_date    || null,
        estimated_hours: body.estimated_hours ? Number(body.estimated_hours) : null,
        status:          "todo",
      })
      .select()
      .single();

    if (error) {
      console.error("tasks insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
