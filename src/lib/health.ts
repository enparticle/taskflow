// @ts-nocheck

export async function calcAndUpdateHealth(supabase: any, projectId: string): Promise<string> {
  const now = new Date();

  const [{ data: tasks }, { data: project }, { data: allTasks }] = await Promise.all([
    supabase.from("tasks").select("id, status, due_date")
      .eq("project_id", projectId).not("status", "eq", "done"),
    supabase.from("projects").select("end_date").eq("id", projectId).single(),
    supabase.from("tasks").select("status").eq("project_id", projectId),
  ]);

  const t = tasks ?? [];
  const overdue = t.filter((x: any) => x.due_date && new Date(x.due_date) < now).length;
  const blocked = t.filter((x: any) => x.status === "blocked").length;

  const daysLeft = project?.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / 86400000)
    : 999;

  const total = (allTasks ?? []).length;
  const done = (allTasks ?? []).filter((x: any) => x.status === "done").length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  // 판단 기준
  // critical: 지연 3건↑ OR 마감 7일 이내 & 진행률 50% 미만 OR Blocked 3건↑
  // at_risk:  지연 1건↑ OR Blocked 1건↑ OR 마감 14일 이내 & 진행률 30% 미만
  // good:     그 외
  let health = "good";
  if (overdue >= 3 || (daysLeft <= 7 && rate < 50 && total > 0) || blocked >= 3) {
    health = "critical";
  } else if (overdue >= 1 || blocked >= 1 || (daysLeft <= 14 && rate < 30 && total > 0)) {
    health = "at_risk";
  }

  await supabase.from("projects").update({ health }).eq("id", projectId);
  return health;
}

export async function calcAllProjectsHealth(supabase: any) {
  const { data: projects } = await supabase
    .from("projects").select("id").eq("status", "active");
  for (const p of projects ?? []) {
    await calcAndUpdateHealth(supabase, p.id);
  }
}
