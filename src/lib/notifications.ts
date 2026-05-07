// @ts-nocheck
import { createClient } from "@/lib/supabase";

export async function createNotification({
  userId, type, title, body, taskId
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  taskId?: string;
}) {
  const supabase = createClient();
  await supabase.from("notifications").insert({ user_id: userId, type, title, body, task_id: taskId });
}
