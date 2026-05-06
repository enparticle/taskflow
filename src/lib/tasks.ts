import { createClient } from "@/lib/supabase";

export async function loadTasksWithAssignees(query: any) {
  const { data: tasks, error } = await query;
  if (!tasks || error) return { data: tasks ?? [], error };

  const supabase = createClient();
  const { data: users } = await supabase.from("users").select("id, name, avatar_url");
  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));

  const enriched = tasks.map((t: any) => {
    const ids: string[] = t.assignee_ids && t.assignee_ids.length > 0
      ? t.assignee_ids
      : t.assignee_id ? [t.assignee_id] : [];
    const assignees = ids.map((id: string) => userMap[id]).filter(Boolean);
    // 디버그
    console.log("[tasks.ts] task:", t.title, "ids:", ids, "assignees:", assignees);
    return { ...t, assignees };
  });

  return { data: enriched, error: null };
}
