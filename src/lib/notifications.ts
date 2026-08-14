// @ts-nocheck
import { createClient } from "@/lib/supabase";

// 알림 만들기 전에 수신자의 설정(나의 스타일)을 확인해서, 꺼놨거나 원치 않는 종류면 아예 안 만듭니다.
//
// ⚠️ 주의: type 값이 아래 5종("mention"/"deadline"/"blocked"/"approval"/"ai_suggestion")과
// 정확히 일치해야 필터링이 제대로 동작합니다. 호출부에서 다른 문자열을 쓰고 있다면
// notification_types 매칭이 항상 실패(=항상 걸러짐)하거나 항상 통과할 수 있으니,
// 실제 호출부의 type 값들을 한 번 확인해서 필요하면 아래 매핑을 조정해주세요.
export async function createNotification({
  userId, type, title, body, taskId, linkUrl
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  taskId?: string;
  linkUrl?: string;
}) {
  const supabase = createClient();

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("notification_style, notification_types")
    .eq("user_id", userId)
    .maybeSingle();

  // 설정이 아예 없으면(온보딩 전 등) 기본값대로 알림을 만듦
  let scheduledFor: string | null = null;
  if (prefs) {
    if (prefs.notification_style === "off") return;
    if (prefs.notification_types && prefs.notification_types.length > 0 && !prefs.notification_types.includes(type)) {
      return; // 이 종류의 알림은 원치 않음
    }
    if (prefs.notification_style === "daily_digest") {
      // 즉시 안 보이고, 다음 날 오전 9시에 한 번에 노출되도록 예약
      const next9am = new Date();
      next9am.setDate(next9am.getDate() + 1);
      next9am.setHours(9, 0, 0, 0);
      scheduledFor = next9am.toISOString();
    }
  }

  // 5. 부재/휴가 모드 — 오늘이 이 사람의 휴가 기간이면, 복귀일 다음날 아침으로 알림 예약
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: vacation } = await supabase.from("calendar_events")
      .select("end_date").eq("user_id", userId).eq("type", "vacation")
      .lte("start_date", today).gte("end_date", today).maybeSingle();
    if (vacation?.end_date) {
      const returnDay = new Date(vacation.end_date);
      returnDay.setDate(returnDay.getDate() + 1);
      returnDay.setHours(9, 0, 0, 0);
      // 다이제스트 예약보다 더 늦게 잡히는 경우에만 덮어씀(휴가가 더 길면 휴가 기준 우선)
      if (!scheduledFor || new Date(returnDay) > new Date(scheduledFor)) {
        scheduledFor = returnDay.toISOString();
      }
    }
  } catch {
    // 휴가 확인 실패해도 알림 생성 자체는 계속 진행 (일반 알림 규칙만 적용)
  }

  await supabase.from("notifications").insert({
    user_id: userId, type, title, body, task_id: taskId, link_url: linkUrl ?? null,
    scheduled_for: scheduledFor,
  });
}
