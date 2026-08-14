// @ts-nocheck
"use client";
import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/authFetch";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";

export default function MilestoneChatWizard({
  projectId, projectName, members, onClose, onSaved,
}: {
  projectId: string;
  projectName: string;
  members: { name: string; role: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [memberHints, setMemberHints] = useState<any[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: `안녕하세요! "${projectName}" 프로젝트의 마일스톤과 업무를 정리해볼게요. 카테고리별로 하나씩 담당자·마감일·세부 업무를 여쭤볼게요. 잘 모르는 항목은 "나중에"라고 하시면 건너뛸게요.\n\n첫 번째 카테고리부터 시작할까요?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      const u = await getAuthUser();
      if (!u?.userId) return;
      setMyUserId(u.userId);
      const { data } = await supabase.from("milestone_questions")
        .select("id, milestone_category, question, project:projects(name), asked_by:users!milestone_questions_asked_by_fkey(name)")
        .eq("asked_to", u.userId).eq("status", "pending")
        .order("created_at", { ascending: false });
      setPendingQuestions(data ?? []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!members || members.length === 0) return;
      const names = members.map(m => m.name);
      const { data: userRows } = await supabase.from("users").select("id, name").in("name", names);
      const { data: prefRows } = await supabase.from("user_preferences")
        .select("user_id, ai_tone, decision_speed, formality_level").in("user_id", (userRows ?? []).map((u: any) => u.id));
      const merged = (userRows ?? []).map((u: any) => {
        const p = (prefRows ?? []).find((pr: any) => pr.user_id === u.id);
        return { name: u.name, ai_tone: p?.ai_tone, decision_speed: p?.decision_speed, formality_level: p?.formality_level };
      }).filter((m: any) => m.ai_tone || m.decision_speed);
      setMemberHints(merged);
    })();
  }, [members]);

  async function submitAnswer(q: any) {
    const answer = answerDrafts[q.id]?.trim();
    if (!answer) return;
    setAnswering(q.id);
    await supabase.from("milestone_questions").update({
      answer, status: "answered", answered_at: new Date().toISOString(),
    }).eq("id", q.id);

    // 원래 질문한 사람한테 답변 도착 알림
    const { data: qRow } = await supabase.from("milestone_questions").select("asked_by, project_id").eq("id", q.id).single();
    if (qRow?.asked_by) {
      await supabase.from("notifications").insert({
        user_id: qRow.asked_by, type: "mention",
        title: `[${q.project?.name ?? ""}] 질문 답변 도착`,
        body: answer,
        link_url: qRow.project_id ? `/projects/${qRow.project_id}` : null,
      });
    }

    setPendingQuestions(prev => prev.filter(p => p.id !== q.id));
    setAnswering(null);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await authFetch("/api/milestone-chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages, chatId, projectId, projectName, members }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.chatId) setChatId(data.chatId);
      if (data.result) setDone(true);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요." }]);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(7,13,24,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", height: "min(680px, 85vh)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🗂</span>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>마일스톤 인터뷰 — {projectName}</h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: 18 }}>✕</button>
        </div>

        {memberHints.length > 0 && (
          <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => setShowHints(!showHints)}
              style={{ fontSize: 10, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
              👥 팀원 힌트 {showHints ? "접기" : "펼치기"}
            </button>
            {showHints && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                {memberHints.map(h => (
                  <p key={h.name} style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                    <b style={{ color: "var(--text-2)" }}>{h.name}</b>:{" "}
                    {h.ai_tone === "detailed" ? "자세히 선호" : h.ai_tone === "detailed_with_summary" ? "요약+자세히 선호" : "간결히 선호"}
                    {h.decision_speed && `, 결정 ${h.decision_speed === "fast" ? "빠른" : "신중한"} 편`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {pendingQuestions.length > 0 && (
          <div style={{ padding: "12px 18px", background: "#FFFBEB", borderBottom: "1px solid #FCD34D", maxHeight: 200, overflowY: "auto" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#D97706", marginBottom: 8 }}>
              📨 다른 사람이 나한테 물어본 질문 ({pendingQuestions.length}건) — 답하면 자동으로 전달돼요
            </p>
            {pendingQuestions.map(q => (
              <div key={q.id} style={{ background: "#fff", border: "1px solid #FDE68A", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: "#92400E", margin: "0 0 2px" }}>
                  {q.asked_by?.name}님 · {q.project?.name} · {q.milestone_category}
                </p>
                <p style={{ fontSize: 12, color: "#1F2937", margin: "0 0 6px" }}>{q.question}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={answerDrafts[q.id] ?? ""} onChange={e => setAnswerDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="답변 입력…" style={{ flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid #FDE68A", outline: "none" }} />
                  <button onClick={() => submitAnswer(q)} disabled={answering === q.id || !answerDrafts[q.id]?.trim()}
                    style={{ fontSize: 11, padding: "6px 12px", background: "#D97706", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", opacity: answering === q.id ? 0.5 : 1 }}>
                    답변
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--cyan)" : "var(--bg-3)",
                color: m.role === "user" ? "#fff" : "var(--text-1)",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: 14, background: "var(--bg-3)", fontSize: 13, color: "var(--text-3)" }}>…</div>
            </div>
          )}
          {done && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p style={{ fontSize: 12, color: "#16A34A", marginBottom: 10 }}>✓ 마일스톤과 업무가 등록됐어요!</p>
              <button onClick={onSaved}
                style={{ padding: "8px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                닫고 프로젝트 새로고침
              </button>
            </div>
          )}
        </div>

        {!done && (
          <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.altKey && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="편하게 답해주세요… (Alt+Enter로 줄바꿈)" disabled={loading}
              rows={1}
              style={{ flex: 1, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none", resize: "none", maxHeight: 100, minHeight: 40, fontFamily: "inherit" }} />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{ padding: "10px 18px", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}>
              보내기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
