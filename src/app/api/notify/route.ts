// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { daysAhead = 3 } = await req.json().catch(() => ({}));
    const now = new Date();
    // 가장 넓은 범위로 넉넉히 조회한 뒤, 사람별로 자기 설정한 기준일로 다시 걸러냄
    const widestDeadline = new Date(now);
    widestDeadline.setDate(widestDeadline.getDate() + Math.max(daysAhead, 14));
    widestDeadline.setHours(23, 59, 59, 999);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, project:projects(name), assignee:users!tasks_assignee_id_fkey(id, name, email)")
      .not("status", "eq", "done")
      .not("due_date", "is", null)
      .lte("due_date", widestDeadline.toISOString());

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: "발송할 업무 없음", sent: 0 });
    }

    const PRIORITY_LABEL: Record<string, string> = { urgent: "긴급", high: "높음", medium: "보통", low: "낮음" };

    const byUser: Record<string, { user: any; tasks: any[] }> = {};
    tasks.forEach((t: any) => {
      if (!t.assignee?.email) return;
      const uid = t.assignee.id;
      if (!byUser[uid]) byUser[uid] = { user: t.assignee, tasks: [] };
      byUser[uid].tasks.push(t);
    });

    // 사람별 알림 설정 일괄 조회 — 꺼놨거나 마감알림을 원치 않으면 건너뜀, 기준일도 사람마다 다르게 적용
    const userIds = Object.keys(byUser);
    const { data: allPrefs } = await supabase
      .from("user_preferences")
      .select("user_id, notification_style, notification_types, deadline_reminder_days")
      .in("user_id", userIds);
    const prefsByUser: Record<string, any> = {};
    (allPrefs ?? []).forEach((p: any) => { prefsByUser[p.user_id] = p; });

    let sentCount = 0;
    let skippedCount = 0;

    for (const [uid, { user, tasks: userTasks }] of Object.entries(byUser)) {
      const prefs = prefsByUser[uid];
      if (prefs) {
        if (prefs.notification_style === "off") { skippedCount++; continue; }
        if (prefs.notification_types && prefs.notification_types.length > 0 && !prefs.notification_types.includes("deadline")) {
          skippedCount++; continue;
        }
      }
      const reminderDays = prefs?.deadline_reminder_days ?? daysAhead;
      const personalCutoff = new Date(now);
      personalCutoff.setDate(personalCutoff.getDate() + reminderDays);
      personalCutoff.setHours(23, 59, 59, 999);

      const relevantTasks = userTasks.filter((t: any) => new Date(t.due_date) <= personalCutoff);
      if (relevantTasks.length === 0) continue;

      const overdue = relevantTasks.filter(t => new Date(t.due_date) < now);
      const today = relevantTasks.filter(t => {
        const d = new Date(t.due_date);
        return d >= now && d <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      });
      const soon = relevantTasks.filter(t => new Date(t.due_date) > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));

      const rows = (list: any[], label: string, color: string) => list.length === 0 ? "" : `
        <tr><td colspan="2" style="padding:10px 0 4px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>
        ${list.map(t => `<tr style="border-bottom:1px solid #1e3050"><td style="padding:8px 0;font-size:13px;color:#e8f4ff">${t.title}</td><td style="padding:8px 0;font-size:12px;color:${color};text-align:right">${PRIORITY_LABEL[t.priority]}</td></tr>`).join("")}
      `;

      const html = `<!DOCTYPE html><html><body style="background:#0d1b2e;font-family:sans-serif;padding:40px 20px">
        <div style="max-width:520px;margin:0 auto;background:#111d30;border-radius:16px;padding:28px;border:1px solid #1e3050">
          <p style="font-size:11px;color:#4a7099;margin:0 0 16px">TASKFLOW 업무 마감 알림</p>
          <p style="font-size:15px;color:#e8f4ff;margin:0 0 4px">안녕하세요, <strong>${user.name}</strong>님</p>
          <p style="font-size:13px;color:#7ba7c8;margin:0 0 20px">마감 예정 업무 <strong style="color:#00c2cc">${relevantTasks.length}건</strong>이 있습니다.</p>
          <table style="width:100%;border-collapse:collapse">
            ${rows(overdue, "⊘ 마감 초과", "#FF4D6A")}
            ${rows(today, "⚠ 오늘 마감", "#F5A623")}
            ${rows(soon, "◷ 마감 임박", "#7BA7C8")}
          </table>
          <div style="margin-top:24px;text-align:center">
            <a href="https://taskflow-ecru-rho.vercel.app/tasks" style="background:linear-gradient(135deg,#00c2cc,#2e86ff);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;display:inline-block">TaskFlow에서 확인하기 →</a>
          </div>
        </div>
      </body></html>`;

      await resend.emails.send({
        from: "TaskFlow <onboarding@resend.dev>",
        to: user.email,
        subject: `[TaskFlow] ${user.name}님, 마감 업무 ${relevantTasks.length}건`,
        html,
      });
      sentCount++;
    }

    return NextResponse.json({ message: `${sentCount}명에게 발송 완료 (${skippedCount}명은 알림 설정으로 제외)`, sent: sentCount, skipped: skippedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
