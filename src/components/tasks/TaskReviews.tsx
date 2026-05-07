// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const STATUS_CONFIG = {
  pending:   { label: "검토 대기", color: "#7BA7C8", bg: "rgba(123,167,200,0.12)", icon: "◷" },
  approved:  { label: "승인",      color: "#00D4A0", bg: "rgba(0,212,160,0.12)",   icon: "✓" },
  rejected:  { label: "반려",      color: "#FF4D6A", bg: "rgba(255,77,106,0.12)",  icon: "✕" },
  commented: { label: "의견 제시", color: "#F5A623", bg: "rgba(245,166,35,0.12)",  icon: "✎" },
};

export default function TaskReviews({ taskId, assigneeIds }: { taskId: string; assigneeIds: string[] }) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [myUser, setMyUser] = useState<any>(null);
  const [myReview, setMyReview] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    // assigneeIds에 있는 리뷰어들의 리뷰 상태 조회
    const { data: existingReviews } = await supabase
      .from("task_reviews")
      .select("*, reviewer:users(id, name)")
      .eq("task_id", taskId);

    // assigneeIds 기준으로 전체 리뷰어 목록 구성
    const { data: reviewers } = await supabase
      .from("users").select("id, name")
      .in("id", assigneeIds.length > 0 ? assigneeIds : ["none"]);

    const reviewMap = Object.fromEntries((existingReviews ?? []).map(r => [r.reviewer_id, r]));
    const fullList = (reviewers ?? []).map(u => reviewMap[u.id] ?? {
      task_id: taskId, reviewer_id: u.id, status: "pending", reviewer: u
    });
    setReviews(fullList);

    // 내 리뷰 찾기
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from("users").select("*").eq("auth_id", user.id).single();
      setMyUser(me);
      if (me) {
        const mine = fullList.find(r => r.reviewer_id === me.id);
        setMyReview(mine ?? null);
        if (mine) setComment(mine.comment ?? "");
      }
    }
  }, [taskId, assigneeIds.join(",")]);

  useEffect(() => { if (assigneeIds.length > 0) load(); }, [load]);

  async function submitReview(status: string) {
    if (!myUser) return;
    setLoading(true);
    await supabase.from("task_reviews").upsert({
      task_id: taskId,
      reviewer_id: myUser.id,
      status,
      comment: comment || null,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: "task_id,reviewer_id" });
    await load();
    setShowForm(false);
    setLoading(false);
  }

  const isMyReviewer = myUser && assigneeIds.includes(myUser.id);
  const approved = reviews.filter(r => r.status === "approved").length;
  const rejected = reviews.filter(r => r.status === "rejected").length;
  const total = reviews.length;

  if (assigneeIds.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* 진행 상황 요약 */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>리뷰 현황</p>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,212,160,0.12)", color: "#00D4A0" }}>
          승인 {approved}/{total}
        </span>
        {rejected > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,77,106,0.12)", color: "#FF4D6A" }}>
            반려 {rejected}
          </span>
        )}
      </div>

      {/* 리뷰어별 상태 */}
      <div className="space-y-1.5">
        {reviews.map((r, i) => {
          const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: `${cfg.color}22`, color: cfg.color, fontSize: 10 }}>
                {r.reviewer?.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{r.reviewer?.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                    style={{ background: `${cfg.color}18`, color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  {r.reviewed_at && (
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>
                      {new Date(r.reviewed_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                {r.comment && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-2)" }}>{r.comment}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 내 리뷰 입력 (리뷰어인 경우만) */}
      {isMyReviewer && (
        <div>
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="w-full rounded-xl py-2 text-xs font-medium transition-all"
              style={{ background: "var(--bg-3)", border: "1px dashed var(--border-2)", color: "var(--text-3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}>
              {myReview?.status === "pending" ? "검토 의견 남기기" : "검토 의견 수정"}
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-2)" }}>검토 의견 (선택)</p>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="의견이 있으면 입력해주세요"
                rows={2} className="w-full rounded-lg px-3 py-2 text-xs resize-none focus:outline-none"
                style={{ background: "var(--bg-4)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
              <div className="flex gap-2">
                <button onClick={() => submitReview("approved")} disabled={loading}
                  className="flex-1 rounded-lg py-2 text-xs font-semibold disabled:opacity-40"
                  style={{ background: "rgba(0,212,160,0.15)", color: "#00D4A0", border: "1px solid rgba(0,212,160,0.3)" }}>
                  ✓ 승인
                </button>
                <button onClick={() => submitReview("commented")} disabled={loading}
                  className="flex-1 rounded-lg py-2 text-xs font-semibold disabled:opacity-40"
                  style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}>
                  ✎ 의견 제시
                </button>
                <button onClick={() => submitReview("rejected")} disabled={loading}
                  className="flex-1 rounded-lg py-2 text-xs font-semibold disabled:opacity-40"
                  style={{ background: "rgba(255,77,106,0.15)", color: "#FF4D6A", border: "1px solid rgba(255,77,106,0.3)" }}>
                  ✕ 반려
                </button>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-full text-xs py-1" style={{ color: "var(--text-3)" }}>취소</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
