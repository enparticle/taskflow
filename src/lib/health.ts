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
  const done = tasks.filter((t: any) => t.status === "done").length;
  const blocked = tasks.filter((t: any) => t.status === "blocked").length;
  const overdue = tasks.filter((t: any) =>
    t.due_date && new Date(t.due_date) < now && t.status !== "done"
  ).length;

  // 마감일 초과 체크
  const isDeadlineOver = project?.end_date && new Date(project.end_date) < now;

  // 번다운 기반 괴리율 계산
  let divergence = 0;
  if (project?.start_date && project?.end_date && total > 0) {
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const totalDays = (endDate.getTime() - startDate.getTime()) / 86400000;
    const elapsedDays = Math.max(0, (now.getTime() - startDate.getTime()) / 86400000);
    const progress = Math.min(elapsedDays / totalDays, 1);

    const idealRemaining = total * (1 - progress);  // 이상적 잔여
    const actualRemaining = total - done;             // 실제 잔여
    divergence = ((actualRemaining - idealRemaining) / total) * 100;
  }

  // 상태 판단
  let health = "good";

  if (
    isDeadlineOver ||
    divergence > 35 ||
    blocked >= 5
  ) {
    health = "critical";
  } else if (
    divergence > 20 ||
    overdue >= 5 ||
    blocked >= 3
  ) {
    health = "at_risk";
  } else if (
    divergence > 10 ||
    overdue >= 3
  ) {
    health = "reviewing";
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
