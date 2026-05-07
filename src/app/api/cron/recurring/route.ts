// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: recurringTasks } = await supabase
    .from("recurring_tasks").select("*")
    .eq("is_active", true).lte("next_run_at", todayStr);

  const results = [];

  for (const rt of recurringTasks ?? []) {
    const { data: task } = await supabase.from("tasks").insert({
      title: rt.title,
      task_type: rt.task_type,
      priority: rt.priority,
      assignee_id: rt.assignee_id,
      assignee_ids: rt.assignee_id ? [rt.assignee_id] : [],
      project_id: rt.project_id,
      estimated_hours: rt.estimated_hours,
      status: "todo",
    }).select().single();

    const next = new Date(today);
    if (rt.frequency === "daily") next.setDate(next.getDate() + 1);
    else if (rt.frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (rt.frequency === "monthly") {
      next.setMonth(next.getMonth() + 1);
      if (rt.day_of_month) next.setDate(rt.day_of_month);
    }

    await supabase.from("recurring_tasks")
      .update({ next_run_at: next.toISOString().split("T")[0] })
      .eq("id", rt.id);

    if (rt.assignee_id && task) {
      await supabase.from("notifications").insert({
        user_id: rt.assignee_id,
        type: "assigned",
        title: "반복 업무가 생성됐습니다",
        body: rt.title,
        task_id: task.id,
      });
    }

    results.push({ title: rt.title, next: next.toISOString().split("T")[0] });
  }

  return NextResponse.json({ date: todayStr, processed: results.length, results });
}
