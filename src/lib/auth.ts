// @ts-nocheck
import { createClient } from "@/lib/supabase";

export interface AuthUser {
  authId: string;
  userId: string;
  name: string;
  role: "admin" | "leader" | "reviewer" | "member" | "viewer";
  email: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("id, name, role, email")
    .eq("auth_id", user.id)
    .single();
  if (!data) return null;
  return {
    authId: user.id,
    userId: data.id,
    name: data.name,
    role: data.role,
    email: data.email,
  };
}

// 프로젝트 내 역할 확인 - maybeSingle()로 404/406 방지
export async function getProjectRole(projectId: string, userId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.role ?? null;
}

export function canEditProject(userRole: string, projectRole: string | null) {
  return userRole === "admin" || projectRole === "leader";
}
export function canDeleteTask(userRole: string, projectRole: string | null) {
  return userRole === "admin" || projectRole === "leader";
}
export function canEditTask(userRole: string, projectRole: string | null, isAssignee: boolean) {
  return userRole === "admin" || projectRole === "leader" || projectRole === "reviewer" || isAssignee;
}
export function canManageMilestone(userRole: string, projectRole: string | null) {
  return userRole === "admin" || projectRole === "leader";
}
export function canManageProjectMembers(userRole: string, projectRole: string | null) {
  return userRole === "admin" || projectRole === "leader";
}
