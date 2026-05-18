// @ts-nocheck

export async function calcAndUpdateHealth(supabase: any, projectId: string): Promise<string> {
  const now = new Date();

  const { data: project } = await supabase
    .from("projects").select("start_date, end_date, health").eq("id", projectId).single();

  // 중단 상태는 자동 변경 안 함
  if (project?.health === "suspended") return "suspended";

  const { data: allTasks } = await supabase
    .from("tasks").select("id, status, due_date").eq("project_id", projectId);

  const tasks = allTasks ?? [];
  const total = tasks.length;

  if (total === 0) {
    await supabase.from("projects").update({ health: "good" }).eq("id", projectId);
    return "good";
  }

  const done = tasks.filter((t: any) => t.status === "done").length;
  const blocked = tasks.filter((t: any) => t.status === "blocked").length;
  const overdue = tasks.filter((t: any) =>
    t.due_date && new Date(t.due_date) < now && t.status !== "done"
  ).length;

  const hasDateRange = project?.start_date && project?.end_date;
  const isDeadlineOver = hasDateRange && new Date(project.end_date) < now;

  let health = "good";

  if (hasDateRange) {
    // 시작일/마감일 있는 경우 → 번다운 괴리율 기반
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const totalDays = Math.max((endDate.getTime() - startDate.getTime()) / 86400000, 1);
    const elapsedDays = Math.max(0, (now.getTime() - startDate.getTime()) / 86400000);
    const progress = Math.min(elapsedDays / totalDays, 1);

    const idealRemaining = total * (1 - progress);
    const actualRemaining = total - done;
    const divergence = ((actualRemaining - idealRemaining) / total) * 100;

    if (isDeadlineOver || divergence > 35 || blocked >= 5) {
      health = "critical";
    } else if (divergence > 20 || blocked >= 3) {
      health = "at_risk";
    } else if (divergence > 10 || blocked >= 2) {
      health = "reviewing";
    }
  } else {
    // 시작일/마감일 없는 경우 → 보수적 기준 (건수 높게)
    if (isDeadlineOver || blocked >= 7) {
      health = "critical";
    } else if (overdue >= 10 || blocked >= 5) {
      health = "at_risk";
    } else if (overdue >= 7 || blocked >= 3) {
      health = "reviewing";
    }
  }

  await supabase.from("projects").update({ health }).eq("id", projectId);
  return health;
}

export async function calcAllProjectsHealth(supabase: any) {
  const { data: projects } = await supabase
    .from("projects").select("id, health").eq("status", "active");
  for (const p of projects ?? []) {
    if (p.health === "suspended") continue;
    await calcAndUpdateHealth(supabase, p.id);
  }
}
