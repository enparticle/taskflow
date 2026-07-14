// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 공용 모니터(/viewer)용 데이터 스냅샷 — 프로젝트 기준.
// 로그인 없이도 접근 가능해야 하므로, 클라이언트가 직접 Supabase를 쿼리하지 않고
// 이 서버 라우트가 service role key로 필요한 것만 정제해서 내려줌.
// 이메일 등 민감정보는 절대 포함하지 않음 — RLS 우회가 아니라 "안전한 창구"로만 사용.

const STATUS_LABEL: Record<string, string> = {
  backlog: "백로그", todo: "할 일", doing: "진행 중", blocked: "Blocked", review: "리뷰", done: "완료",
};

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const [{ data: users }, { data: tasks }, { data: projects }] = await Promise.all([
      supabaseAdmin.from("users").select("id, name").eq("is_active", true).neq("role", "viewer"),
      supabaseAdmin.from("tasks")
        .select("id, title, status, assignee_id, assignee_ids, due_date, project_id")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabaseAdmin.from("projects").select("id, name, health, status").eq("status", "active").order("created_at"),
    ]);

    const userNameById: Record<string, string> = {};
    (users ?? []).forEach(u => { userNameById[u.id] = u.name; });

    function assigneeNames(t: any): string[] {
      const ids = [t.assignee_id, ...(t.assignee_ids ?? [])].filter(Boolean);
      const unique = Array.from(new Set(ids));
      return unique.map(id => userNameById[id]).filter(Boolean);
    }

    const safeTasks = (tasks ?? []).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      statusLabel: STATUS_LABEL[t.status] ?? t.status,
      dueDate: t.due_date,
      overdue: !!(t.due_date && new Date(t.due_date) < new Date()),
      projectId: t.project_id,
      assignees: assigneeNames(t),
    }));

    const projectSlides = (projects ?? []).map(p => {
      const mine = safeTasks.filter(t => t.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        health: p.health,
        tasks: mine.slice(0, 10), // 화면 한 장에 너무 많이 안 뜨게 제한
        counts: {
          todo: mine.filter(t => t.status === "todo").length,
          doing: mine.filter(t => t.status === "doing").length,
          blocked: mine.filter(t => t.status === "blocked").length,
          review: mine.filter(t => t.status === "review").length,
        },
        total: mine.length,
      };
    }).filter(p => p.total > 0); // 업무 없는 프로젝트는 슬라이드에서 제외

    const unassignedCount = safeTasks.filter(t => !t.projectId).length;

    const overall = {
      todo: safeTasks.filter(t => t.status === "todo").length,
      doing: safeTasks.filter(t => t.status === "doing").length,
      blocked: safeTasks.filter(t => t.status === "blocked").length,
      review: safeTasks.filter(t => t.status === "review").length,
      overdue: safeTasks.filter(t => t.overdue).length,
      unassigned: unassignedCount,
    };

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      projects: projectSlides,
      overall,
    });
  } catch (err: any) {
    console.error("viewer-snapshot error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
