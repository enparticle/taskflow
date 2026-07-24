// @ts-nocheck
"use client";
import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/authFetch";

export default function MilestoneChatWizard({
  projectId, projectName, members, onClose, onSaved,
}: {
  projectId: string;
  projectName: string;
  members: { name: string; role: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
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
