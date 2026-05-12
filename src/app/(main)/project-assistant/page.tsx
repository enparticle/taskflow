// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };
type Mode = "chat" | "import" | "bulk";

const MODE_CONFIG = {
  chat:   { icon: "💬", title: "대화형 프로젝트 등록",    desc: "AI와 대화하면서 프로젝트를 만들어요" },
  import: { icon: "📋", title: "기존 프로젝트 임포트",     desc: "현황을 붙여넣으면 AI가 구조화해요" },
  bulk:   { icon: "⚡", title: "업무 일괄 등록",           desc: "업무 목록을 말하면 한번에 등록해요" },
};

export default function ProjectAssistantPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [myUser, setMyUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [importText, setImportText] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAuthUser().then(u => setMyUser(u));
    supabase.from("projects").select("id, name").eq("status", "active").then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 모드 선택 시 초기 메시지
  async function startMode(m: Mode) {
    setMode(m);
    setMessages([]);
    setChatId(null);
    setResult(null);
    setCreated(null);

    if (m === "chat") {
      const initMsg: Message = {
        role: "assistant",
        content: "안녕하세요! 어떤 프로젝트를 진행하고 계신가요? 편하게 설명해주세요. 진행 중인 업무, 목표, 대략적인 일정 등 생각나는 대로 말씀해주시면 됩니다 😊",
      };
      setMessages([initMsg]);
    } else if (m === "import") {
      const initMsg: Message = {
        role: "assistant",
        content: "기존 프로젝트 현황을 자유롭게 붙여넣어 주세요. 회의록, 문서, 메모 등 어떤 형식이든 괜찮습니다. 아래 입력창에 텍스트를 붙여넣고 분석 버튼을 눌러주세요.",
      };
      setMessages([initMsg]);
    } else if (m === "bulk") {
      const initMsg: Message = {
        role: "assistant",
        content: "등록할 업무를 자유롭게 나열해주세요. 예:\n• 고객 인터뷰 가이드 작성\n• 프로토타입 제작\n• 팀 미팅 (매주 월요일)\n\n어떤 형식이든 괜찮습니다. 아래 입력창에 작성 후 분석 버튼을 눌러주세요.",
      };
      setMessages([initMsg]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const cleanMsg = data.message.replace(/RESULT_JSON[\s\S]*?END_JSON/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanMsg }]);
      if (data.chatId) setChatId(data.chatId);
      if (data.result) setResult(data.result);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
    }
    setLoading(false);
  }

  async function analyzeImport() {
    if (!importText.trim() || loading) return;
    setLoading(true);
    const userMsg: Message = { role: "user", content: `다음 내용을 분석해서 프로젝트 구조로 만들어주세요:\n\n${importText}` };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId }),
      });
      const data = await res.json();
      const cleanMsg = data.message.replace(/RESULT_JSON[\s\S]*?END_JSON/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanMsg }]);
      if (data.chatId) setChatId(data.chatId);
      if (data.result) setResult(data.result);
    } catch {}
    setLoading(false);
  }

  async function analyzeBulk() {
    if (!bulkText.trim() || loading) return;
    setLoading(true);
    const projectName = selectedProject
      ? projects.find(p => p.id === selectedProject)?.name
      : "새 프로젝트";

    const userMsg: Message = {
      role: "user",
      content: `다음 업무들을 분석해서 등록해주세요. 프로젝트: ${projectName}\n\n${bulkText}\n\n각 업무의 유형, 우선순위를 판단해서 구조화해주세요. 확인 없이 바로 RESULT_JSON으로 응답해주세요.`,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId }),
      });
      const data = await res.json();
      const cleanMsg = data.message.replace(/RESULT_JSON[\s\S]*?END_JSON/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanMsg }]);
      if (data.chatId) setChatId(data.chatId);
      if (data.result) setResult(data.result);
    } catch {}
    setLoading(false);
  }

  async function createProject() {
    if (!result) return;
    setCreating(true);

    // bulk 모드이고 기존 프로젝트 선택한 경우 - 업무만 추가
    if (mode === "bulk" && selectedProject) {
      const supabaseClient = createClient();
      for (const task of result.tasks ?? []) {
        await supabaseClient.from("tasks").insert({
          ...task,
          project_id: selectedProject,
          assignee_id: myUser?.userId ?? null,
          assignee_ids: myUser?.userId ? [myUser.userId] : [],
        });
      }
      setCreated({ projectId: selectedProject, tasksOnly: true, count: (result.tasks ?? []).length });
      setCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/project-create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, userId: myUser?.userId, assigneeId: myUser?.userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCreated(data);
    } catch (e: any) {
      alert("생성 중 오류: " + e.message);
    }
    setCreating(false);
  }

  const fieldStyle = {
    background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF",
    borderRadius: 8, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none",
    colorScheme: "dark" as const,
  };

  // 완료 화면
  if (created) return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
      <div className="text-5xl">✅</div>
      <div>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-1)" }}>
          {created.tasksOnly ? `업무 ${created.count}건이 등록됐습니다!` : "프로젝트가 생성됐습니다!"}
        </p>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          {created.tasksOnly ? "선택한 프로젝트에 업무가 추가됐습니다" : `${result?.project?.name} 프로젝트와 함께 마일스톤, 업무가 모두 등록됐습니다`}
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => router.push(created.projectId ? `/projects/${created.projectId}` : "/projects")}
          className="rounded-xl px-6 py-3 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
          프로젝트 보러가기 →
        </button>
        <button onClick={() => { setMode(null); setCreated(null); setResult(null); }}
          className="rounded-xl px-6 py-3 text-sm"
          style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
          다시 사용하기
        </button>
      </div>
    </div>
  );

  // 모드 선택 화면
  if (!mode) return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#A78BFA" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>AI 프로젝트 어시스턴트</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          프로젝트 등록이 막막하신가요? AI가 도와드립니다.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(MODE_CONFIG) as [Mode, any][]).map(([key, cfg]) => (
          <button key={key} onClick={() => startMode(key)}
            className="rounded-2xl p-6 text-left transition-all group"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#A78BFA55"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-2)"; }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>{cfg.icon}</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-1)" }}>{cfg.title}</p>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>{cfg.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMode(null)} className="text-xs" style={{ color: "var(--text-3)" }}>← 뒤로</button>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ fontSize: 16 }}>{MODE_CONFIG[mode].icon}</span>
        <h1 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{MODE_CONFIG[mode].title}</h1>
      </div>

      {/* 대화창 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", height: 400 }}>
        <div className="h-full overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] rounded-2xl px-4 py-3"
                style={{
                  background: m.role === "user" ? "rgba(46,134,255,0.15)" : "var(--bg-3)",
                  border: `1px solid ${m.role === "user" ? "rgba(46,134,255,0.3)" : "var(--border)"}`,
                }}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#A78BFA" }} />
                    <span className="text-xs font-semibold" style={{ color: "#A78BFA" }}>AI 어시스턴트</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-1)", lineHeight: 1.6 }}>{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3" style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#A78BFA" }} />
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>분석 중…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 결과 미리보기 */}
      {result && !created && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(0,212,160,0.05)", border: "1px solid rgba(0,212,160,0.2)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "#00D4A0" }}>✓ 생성 준비 완료</p>
            <button onClick={createProject} disabled={creating}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
              {creating ? "생성 중…" : mode === "bulk" && selectedProject ? `업무 ${(result.tasks ?? []).length}건 추가` : "프로젝트 생성하기"}
            </button>
          </div>
          {result.project && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>프로젝트</p>
              <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{result.project.name}</p>
              {result.project.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>{result.project.description}</p>}
            </div>
          )}
          {(result.milestones ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-3)" }}>마일스톤 {result.milestones.length}개</p>
              <div className="space-y-1">
                {result.milestones.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#7BA7C8" }} />
                    <span className="text-xs" style={{ color: "var(--text-2)" }}>{m.title}</span>
                    {m.due_date && <span className="text-xs" style={{ color: "var(--text-3)" }}>~ {m.due_date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(result.tasks ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-3)" }}>업무 {result.tasks.length}건</p>
              <div className="space-y-1">
                {result.tasks.slice(0, 5).map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#2E86FF" }} />
                    <span className="text-xs" style={{ color: "var(--text-2)" }}>{t.title}</span>
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>{t.priority}</span>
                  </div>
                ))}
                {result.tasks.length > 5 && <p className="text-xs" style={{ color: "var(--text-3)" }}>외 {result.tasks.length - 5}건</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 입력 영역 */}
      {mode === "chat" && !result && (
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="메시지 입력 (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={2} className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff", minWidth: 64 }}>
            전송
          </button>
        </div>
      )}

      {mode === "chat" && result && !created && (
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="수정이 필요하면 말씀해주세요"
            rows={2} className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)", minWidth: 64 }}>
            수정
          </button>
        </div>
      )}

      {mode === "import" && !result && (
        <div className="space-y-2">
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="회의록, 기획서, 메모 등을 자유롭게 붙여넣어 주세요..."
            rows={6} className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
          <button onClick={analyzeImport} disabled={loading || !importText.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff" }}>
            {loading ? "분석 중…" : "✦ AI 분석 시작"}
          </button>
        </div>
      )}

      {mode === "bulk" && !result && (
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>어떤 프로젝트에 추가할까요?</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={fieldStyle}>
              <option value="">새 프로젝트로 만들기</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
            placeholder={"업무 목록을 나열해주세요\n예:\n- 고객 인터뷰 가이드 작성\n- 프로토타입 제작\n- 주간 미팅 (매주 월요일)\n- 데이터 분석 보고서"}
            rows={8} className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
          <button onClick={analyzeBulk} disabled={loading || !bulkText.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #A78BFA, #2E86FF)", color: "#fff" }}>
            {loading ? "분석 중…" : "✦ AI 분류 및 등록 준비"}
          </button>
        </div>
      )}
    </div>
  );
}
