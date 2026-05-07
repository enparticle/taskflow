// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

export default function TaskComments({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [myUser, setMyUser] = useState<any>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("task_comments")
      .select("*, user:users(name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
  }, [taskId]);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: u } = await supabase.from("users").select("*").eq("auth_id", data.user.id).single();
        setMyUser(u);
      }
    });
  }, [taskId]);

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);
    await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: myUser?.id ?? null,
      content: content.trim(),
    });
    setContent("");
    await load();
    setLoading(false);
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>댓글 {comments.length}</p>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {comments.map(c => (
          <div key={c.id} className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
              style={{ background: "var(--cyan-bg)", color: "var(--cyan)", fontSize: 10 }}>
              {c.user?.name?.[0] ?? "?"}
            </div>
            <div className="flex-1 rounded-xl px-3 py-2"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{c.user?.name ?? "알 수 없음"}</span>
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{fmtTime(c.created_at)}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>{c.content}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--text-3)" }}>댓글이 없습니다</p>
        )}
      </div>

      <div className="flex gap-2">
        <input value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }}}
          placeholder="댓글 입력 (Enter로 전송)"
          className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
        <button onClick={submit} disabled={loading || !content.trim()}
          className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
          style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
          전송
        </button>
      </div>
    </div>
  );
}
