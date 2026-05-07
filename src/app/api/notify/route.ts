// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  "https://tvgygdyucadaoqmnsgmp.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getDeadlineLabel(dueDate: string): { label: string; urgent: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}일 초과`, urgent: true };
  if (diffDays === 0) return { label: "오늘 마감", urgent: true };
  if (diffDays === 1) return { label: "내일 마감", urgent: true };
  return { label: `${diffDays}일 남음`, urgent: false };
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "긴급", high: "높음", medium: "보통", low: "낮음"
};

export async function POST(req: NextRequest) {
  try {
    const { daysAhead = 3 } = await req.json().catch(() => ({}));

    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + daysAhead);
    deadline.setHours(23, 59, 59, 999);

    // 마감 임박 + 초과 업무 조회
    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, status, project:projects(name), assignee:users!tasks_assignee_id_fkey(id, name, email)")
      .not("status", "eq", "done")
      .not("due_date", "is", null)
      .lte("due_date", deadline.toISOString());

    console.log("Tasks found:", tasks?.length, "Error:", taskError?.message);
    console.log("Deadline:", deadline.toISOString());

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ message: "발송할 업무 없음", sent: 0 });
    }

    // 담당자별로 그룹핑
    const byUser: Record<string, { user: any; tasks: any[] }> = {};
    tasks.forEach(t => {
      if (!t.assignee?.email) return;
      const uid = t.assignee.id;
      if (!byUser[uid]) byUser[uid] = { user: t.assignee, tasks: [] };
      byUser[uid].tasks.push(t);
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const { user, tasks: userTasks } of Object.values(byUser)) {
      const overdueList = userTasks.filter(t => new Date(t.due_date) < now);
      const todayList = userTasks.filter(t => {
        const d = new Date(t.due_date);
        return d >= now && d <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      });
      const soonList = userTasks.filter(t => new Date(t.due_date) > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));

      const taskRows = (list: any[], label: string, color: string) => list.length === 0 ? "" : `
        <tr><td colspan="3" style="padding:12px 0 6px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>
        ${list.map(t => `
          <tr style="border-bottom:1px solid #2a2a3a">
            <td style="padding:8px 0;font-size:13px;color:#e8f4ff">${t.title}</td>
            <td style="padding:8px 12px;font-size:12px;color:#7ba7c8">${t.project?.name ?? "-"}</td>
            <td style="padding:8px 0;font-size:12px;color:${color};text-align:right">${getDeadlineLabel(t.due_date).label} · ${PRIORITY_LABEL[t.priority]}</td>
          </tr>
        `).join("")}
      `;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d1b2e;font-family:-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#0d1b2e">
    <!-- 헤더 -->
    <div style="background:#111d30;border:1px solid #1e3050;border-radius:16px 16px 0 0;padding:24px 28px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <div style="width:8px;height:8px;border-radius:50%;background:#00c2cc;box-shadow:0 0 8px #00c2cc"></div>
        <span style="font-size:16px;font-weight:700;color:#e8f4ff;letter-spacing:2px">TASK<span style="color:#00c2cc">FLOW</span></span>
      </div>
      <p style="margin:0;font-size:12px;color:#4a7099">업무 마감 알림</p>
    </div>

    <!-- 본문 -->
    <div style="background:#111d30;border:1px solid #1e3050;border-top:none;border-radius:0 0 16px 16px;padding:24px 28px">
      <p style="font-size:15px;color:#e8f4ff;margin:0 0 4px">안녕하세요, <strong>${user.name}</strong>님</p>
      <p style="font-size:13px;color:#7ba7c8;margin:0 0 20px">
        ${now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 기준
        마감 예정 업무 <strong style="color:#00c2cc">${userTasks.length}건</strong>이 있습니다.
      </p>

      <table style="width:100%;border-collapse:collapse">
        ${taskRows(overdueList, "⊘ 마감 초과", "#FF4D6A")}
        ${taskRows(todayList, "⚠ 오늘 마감", "#F5A623")}
        ${taskRows(soonList, "◷ 마감 임박", "#7BA7C8")}
      </table>

      <div style="margin-top:24px;text-align:center">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://taskflow-ecru-rho.vercel.app"}/tasks"
          style="display:inline-block;background:linear-gradient(135deg,#00c2cc,#2e86ff);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600">
          TaskFlow에서 확인하기 →
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:11px;color:#2a4060;text-align:center">
        이 메일은 TaskFlow 자동 알림 시스템에서 발송되었습니다
      </p>
    </div>
  </div>
</body>
</html>`;

      try {
        await resend.emails.send({
          from: "TaskFlow <onboarding@resend.dev>",
          to: user.email,
          subject: `[TaskFlow] ${user.name}님, 마감 업무 ${userTasks.length}건이 있습니다`,
          html,
        });
        sentCount++;
      } catch (e: any) {
        errors.push(`${user.name}(${user.email}): ${e.message}`);
      }
    }

    return NextResponse.json({
      message: `${sentCount}명에게 발송 완료`,
      sent: sentCount,
      total_tasks: tasks.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
