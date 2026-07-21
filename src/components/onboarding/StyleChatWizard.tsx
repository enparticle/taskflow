// @ts-nocheck
"use client";
import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/authFetch";

export default function StyleChatWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "안녕하세요! TaskFlow를 구석구석 편하게 맞춰볼게요 🙂 입력 방식, 홈 화면, 업무 목록, 알림, 화면 밀도까지 20가지 정도를 차근차근 물어볼 건데, 잘 모르겠으면 언제든 \"기본값으로\"라고 하시면 돼요.\n\n먼저, 업무를 어떤 식으로 기록하는 게 편하세요? 미리 계획을 세우는 편인지, 끝난 뒤에 기록하는 편인지, 아니면 그냥 클릭 몇 번으로 끝내고 싶으신지 편하게 말씀해주세요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await authFetch("/api/style-chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages, chatId }),
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
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", height: "min(640px, 85vh)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>💬</span>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>AI와 대화로 스타일 설정하기</h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: 18 }}>✕</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
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
              <p style={{ fontSize: 12, color: "#16A34A", marginBottom: 10 }}>✓ 설정이 저장됐어요!</p>
              <button onClick={onSaved}
                style={{ padding: "8px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                닫고 화면에 반영하기
              </button>
            </div>
          )}
        </div>

        {!done && (
          <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="편하게 답해주세요…" disabled={loading}
              style={{ flex: 1, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text-1)", outline: "none" }} />
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
