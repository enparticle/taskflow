// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

export default function MeetingPoll({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [poll, setPoll] = useState<any>(null);
  const [myUser, setMyUser] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [newQuestion, setNewQuestion] = useState("미팅 일정 투표");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthUser().then(u => setMyUser(u));
    loadPoll();
  }, [taskId]);

  async function loadPoll() {
    const { data } = await supabase.from("meeting_polls")
      .select("*").eq("task_id", taskId).single();
    setPoll(data ?? null);
    setLoading(false);
  }

  async function createPoll() {
    const validOptions = newOptions.filter(o => o.trim());
    if (validOptions.length < 2) return alert("옵션을 2개 이상 입력해주세요");
    const { data } = await supabase.from("meeting_polls").insert({
      task_id: taskId,
      question: newQuestion,
      options: validOptions,
      votes: {},
      created_by: myUser?.userId,
    }).select().single();
    setPoll(data);
    setCreating(false);
  }

  async function vote(option: string) {
    if (!myUser || !poll) return;
    const votes = { ...(poll.votes ?? {}) };
    // 이미 같은 옵션 투표했으면 취소
    if (votes[myUser.userId] === option) {
      delete votes[myUser.userId];
    } else {
      votes[myUser.userId] = option;
    }
    await supabase.from("meeting_polls").update({ votes }).eq("id", poll.id);
    setPoll({ ...poll, votes });
  }

  async function deletePoll() {
    if (!confirm("투표를 삭제할까요?")) return;
    await supabase.from("meeting_polls").delete().eq("id", poll.id);
    setPoll(null);
  }

  if (loading) return null;

  const fieldStyle = {
    background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF",
    borderRadius: 8, padding: "6px 10px", fontSize: 12, width: "100%", outline: "none",
  };

  if (!poll && !creating) return (
    <div className="text-center py-3">
      <p className="text-xs mb-2" style={{ color: "var(--text-3)" }}>일정 투표가 없습니다</p>
      <button onClick={() => setCreating(true)}
        className="rounded-lg px-3 py-1.5 text-xs font-medium"
        style={{ background: "rgba(167,139,250,0.12)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.3)" }}>
        + 투표 만들기
      </button>
    </div>
  );

  if (creating) return (
    <div className="space-y-3">
      <div>
        <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>질문</label>
        <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} style={fieldStyle} />
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>옵션 (날짜/시간 등)</label>
        <div className="space-y-2">
          {newOptions.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input value={opt} onChange={e => {
                const arr = [...newOptions]; arr[i] = e.target.value; setNewOptions(arr);
              }} placeholder={`옵션 ${i + 1} (예: 5월 20일 오전 10시)`} style={fieldStyle} />
              {newOptions.length > 2 && (
                <button onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))}
                  className="text-xs px-2 rounded" style={{ color: "#FF4D6A", background: "rgba(255,77,106,0.08)" }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setNewOptions([...newOptions, ""])}
            className="text-xs" style={{ color: "var(--cyan)" }}>+ 옵션 추가</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={createPoll}
          className="flex-1 rounded-lg py-2 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff" }}>
          투표 생성
        </button>
        <button onClick={() => setCreating(false)}
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
          취소
        </button>
      </div>
    </div>
  );

  if (!poll) return null;

  const votes = poll.votes ?? {};
  const totalVotes = Object.keys(votes).length;
  const myVote = myUser ? votes[myUser.userId] : null;

  // 옵션별 득표수
  const counts: Record<string, number> = {};
  for (const v of Object.values(votes) as string[]) {
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const maxCount = Math.max(...Object.values(counts), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>{poll.question}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{totalVotes}명 참여</span>
          <button onClick={deletePoll} className="text-xs" style={{ color: "#FF4D6A" }}>삭제</button>
        </div>
      </div>

      <div className="space-y-2">
        {(poll.options ?? []).map((option: string) => {
          const count = counts[option] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyVote = myVote === option;
          const isWinning = count === maxCount && count > 0;

          return (
            <button key={option} onClick={() => vote(option)}
              className="w-full rounded-xl px-3 py-2.5 text-left relative overflow-hidden transition-all"
              style={{
                background: isMyVote ? "rgba(46,134,255,0.1)" : "var(--bg-3)",
                border: `1px solid ${isMyVote ? "rgba(46,134,255,0.4)" : isWinning ? "rgba(0,212,160,0.3)" : "var(--border)"}`,
              }}>
              {/* 득표 바 */}
              {totalVotes > 0 && (
                <div className="absolute inset-0 rounded-xl"
                  style={{ width: `${pct}%`, background: isWinning ? "rgba(0,212,160,0.08)" : "rgba(74,112,153,0.06)", transition: "width 0.3s" }} />
              )}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMyVote && <span style={{ color: "#2E86FF", fontSize: 12 }}>✓</span>}
                  {isWinning && !isMyVote && <span style={{ fontSize: 12 }}>🏆</span>}
                  <span className="text-xs font-medium" style={{ color: isMyVote ? "#E8F4FF" : "var(--text-2)" }}>{option}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: isWinning ? "#00D4A0" : "var(--text-3)" }}>
                  {count}표 {totalVotes > 0 ? `(${pct}%)` : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {myVote && (
        <p className="text-xs text-center" style={{ color: "var(--text-3)" }}>
          ✓ <strong style={{ color: "var(--text-2)" }}>{myVote}</strong>에 투표했습니다 · 다시 클릭하면 취소
        </p>
      )}
    </div>
  );
}
