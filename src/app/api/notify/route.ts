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
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + daysAhead);
    deadline.setHours(23, 59, 59, 999);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, project:projects(name), assignee:users!tasks_assignee_id_fkey(id, name, email)")
      .not("status", "eq", "done")
      .not("due_date", "is", null)
      .lte("due_date", deadline.toISOString());

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

    let sentCount = 0;

    for (const { user, tasks: userTasks } of Object.values(byUser)) {
      const overdue = userTasks.filter(t => new Date(t.due_date) < now);
      const today = userTasks.filter(t => {
        const d = new Date(t.due_date);
        return d >= now && d <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      });
      const soon = userTasks.filter(t => new Date(t.due_date) > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));

      const rows = (list: any[], label: string, color: string) => list.length === 0 ? "" : `
        <tr><td colspan="2" style="padding:10px 0 4px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>
        ${list.map(t => `<tr style="border-bottom:1px solid #1e3050"><td style="padding:8px 0;font-size:13px;color:#e8f4ff">${t.title}</td><td style="padding:8px 0;font-size:12px;color:${color};text-align:right">${PRIORITY_LABEL[t.priority]}</td></tr>`).join("")}
      `;

      const html = `<!DOCTYPE html><html><body style="background:#0d1b2e;font-family:sans-serif;padding:40px 20px">
        <div style="max-width:520px;margin:0 auto;background:#111d30;border-radius:16px;padding:28px;border:1px solid #1e3050">
          <p style="font-size:11px;color:#4a7099;margin:0 0 16px">TASKFLOW 업무 마감 알림</p>
          <p style="font-size:15px;color:#e8f4ff;margin:0 0 4px">안녕하세요, <strong>${user.name}</strong>님</p>
          <p style="font-size:13px;color:#7ba7c8;margin:0 0 20px">마감 예정 업무 <strong style="color:#00c2cc">${userTasks.length}건</strong>이 있습니다.</p>
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
        subject: `[TaskFlow] ${user.name}님, 마감 업무 ${userTasks.length}건`,
        html,
      });
      sentCount++;
    }

    return NextResponse.json({ message: `${sentCount}명에게 발송 완료`, sent: sentCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
