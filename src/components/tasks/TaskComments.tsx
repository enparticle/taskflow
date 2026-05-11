// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

export default function TaskComments({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [myUser, setMyUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionList, setMentionList] = useState<any[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMention, setShowMention] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    supabase.from("users").select("id, name").eq("is_active", true).then(({ data }) => {
      setAllUsers(data ?? []);
    });
  }, [taskId]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setContent(val);

    // @ 감지
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setMentionQuery(q);
      const filtered = allUsers.filter(u => u.name.toLowerCase().includes(q));
      setMentionList(filtered);
      setShowMention(filtered.length > 0);
      setMentionIndex(0);
    } else {
      setShowMention(false);
    }
  }

  function selectMention(user: any) {
    const cursor = inputRef.current?.selectionStart ?? content.length;
    const textBefore = content.slice(0, cursor);
    const textAfter = content.slice(cursor);
    const replaced = textBefore.replace(/@\w*$/, `@${user.name} `);
    setContent(replaced + textAfter);
    setShowMention(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showMention) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionList.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectMention(mentionList[mentionIndex]); return; }
      if (e.key === "Escape") { setShowMention(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !showMention) { e.preventDefault(); submit(); }
    // Shift+Enter는 줄바꿈 (기본 동작 허용)
  }

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);

    await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: myUser?.id ?? null,
      content: content.trim(),
    });

    // 멘션된 구성원에게 알림 발송
    const mentions = content.match(/@([^\s]+)/g) ?? [];
    for (const m of mentions) {
      const name = m.slice(1);
      const mentioned = allUsers.find(u => u.name === name);
      if (mentioned && mentioned.id !== myUser?.id) {
        await supabase.from("notifications").insert({
          user_id: mentioned.id,
          type: "mention",
          title: `${myUser?.name ?? "누군가"}님이 댓글에서 멘션했습니다`,
          body: content.trim().slice(0, 60),
          task_id: taskId,
        });
      }
    }

    setContent("");
    setShowMention(false);
    await load();
    setLoading(false);
  }

  async function deleteComment(id: string) {
    if (!confirm("댓글을 삭제할까요?")) return;
    await supabase.from("task_comments").delete().eq("id", id);
    await load();
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // 댓글 텍스트에서 멘션 하이라이트
  function renderContent(text: string) {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="font-semibold" style={{ color: "var(--cyan)" }}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
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
            <div className="flex-1 rounded-xl px-3 py-2 group"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{c.user?.name ?? "알 수 없음"}</span>
                <span className="text-xs" style={{ color: "var(--text-3)" }}>{fmtTime(c.created_at)}</span>
                {(myUser?.id === c.user_id || myUser?.role === "admin") && (
                  <button onClick={() => deleteComment(c.id)}
                    className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--red)" }}>삭제</button>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--text-2)" }}>{renderContent(c.content)}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--text-3)" }}>댓글이 없습니다</p>
        )}
      </div>

      {/* 입력창 */}
      <div className="relative">
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef as any} value={content}
            onChange={handleInput as any}
            onKeyDown={handleKeyDown}
            placeholder="댓글 입력 (@이름으로 멘션, Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={1}
            className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)", minHeight: 34, maxHeight: 100 }} />
          <button onClick={submit} disabled={loading || !content.trim()}
            className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
            전송
          </button>
        </div>

        {/* 멘션 자동완성 */}
        {showMention && (
          <div className="absolute bottom-10 left-0 w-48 rounded-xl overflow-hidden shadow-2xl z-10"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)" }}>
            {mentionList.slice(0, 6).map((u, i) => (
              <button key={u.id} type="button"
                onClick={() => selectMention(u)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors"
                style={{
                  background: i === mentionIndex ? "var(--cyan-bg)" : "transparent",
                  color: i === mentionIndex ? "var(--cyan)" : "var(--text-2)",
                }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: i === mentionIndex ? "var(--cyan)" : "var(--bg-4)", color: i === mentionIndex ? "#0D1B2E" : "var(--text-3)", fontSize: 9 }}>
                  {u.name[0]}
                </div>
                {u.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
