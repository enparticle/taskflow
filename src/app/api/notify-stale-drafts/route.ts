// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { staleDays = 3 } = await req.json().catch(() => ({}));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);

    const { data: staleDrafts } = await supabase
      .from("task_drafts")
      .select("id, project_id, project:projects(name)")
      .eq("status", "pending")
      .lte("created_at", cutoff.toISOString());

    if (!staleDrafts || staleDrafts.length === 0) {
      return NextResponse.json({ message: "방치된 대기 업무 없음", notified: 0 });
    }

    // 프로젝트별로 묶기
    const byProject: Record<string, { name: string; count: number }> = {};
    staleDrafts.forEach((d: any) => {
      if (!d.project_id) return;
      if (!byProject[d.project_id]) byProject[d.project_id] = { name: d.project?.name ?? "", count: 0 };
      byProject[d.project_id].count++;
    });

    let notifiedCount = 0;
    for (const [projectId, info] of Object.entries(byProject)) {
      const { data: leaders } = await supabase
        .from("project_members").select("user_id").eq("project_id", projectId).eq("role", "leader");

      for (const leader of leaders ?? []) {
        // 알림 설정 확인 (off/타입 필터)
        const { data: prefs } = await supabase.from("user_preferences")
          .select("notification_style, notification_types").eq("user_id", leader.user_id).maybeSingle();
        if (prefs?.notification_style === "off") continue;
        if (prefs?.notification_types?.length > 0 && !prefs.notification_types.includes("approval")) continue;

        await supabase.from("notifications").insert({
          user_id: leader.user_id, type: "approval",
          title: `[${info.name}] 승인 대기 업무 ${info.count}건이 ${staleDays}일째 방치되고 있어요`,
          body: "회의록에서 추출된 업무예요. 확인해서 승인하거나 반려해주세요.",
          link_url: `/projects/${projectId}`,
        });
        notifiedCount++;
      }
    }

    return NextResponse.json({ message: `${notifiedCount}명에게 리마인더 발송`, notified: notifiedCount, staleDraftCount: staleDrafts.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
