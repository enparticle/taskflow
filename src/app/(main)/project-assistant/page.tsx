// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };
type Mode = "chat" | "import" | "bulk" | "change";

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
};

const MODE_CONFIG = {
  chat:   { icon: "💬", title: "AI와 대화로 프로젝트 구성",  desc: "AI와 대화하면서 프로젝트를 만들어요", color: "#7C3AED" },
  import: { icon: "📋", title: "기존 계획 분석",              desc: "현황을 붙여넣으면 AI가 분석해줘요", color: "#2563EB" },
  bulk:   { icon: "⚡", title: "업무 일괄 등록",              desc: "업무 목록을 붙여넣고 바로 등록", color: "#16A34A" },
  change: { icon: "🔄", title: "방향 변경 반영",              desc: "변경사항을 입력하면 영향 업무를 찾아 수정 제안", color: "#D97706" },
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
  const [changeText, setChangeText] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projectContext, setProjectContext] = useState<any>(null);
  const [affectedTasks, setAffectedTasks] = useState<any[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAuthUser().then(u => setMyUser(u));
    supabase.from("projects").select("id, name, context, goals, health, end_date").eq("status", "active")
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 프로젝트 선택 시 컨텍스트 로드
  useEffect(() => {
    if (!selectedProject) { setProjectContext(null); return; }
    const p = projects.find(p => p.id === selectedProject);
    setProjectContext(p ?? null);
  }, [selectedProject, projects]);

  function buildContextPrompt(p: any) {
    if (!p) return "";
    let ctx = `\n[프로젝트 컨텍스트]\n프로젝트명: ${p.name}`;
    if (p.goals) ctx += `\n목표: ${p.goals}`;
    if (p.context) ctx += `\n배경/설명: ${p.context}`;
    if (p.end_date) ctx += `\n마감: ${p.end_date}`;
    return ctx;
  }

  async function startMode(m: Mode) {
    setMode(m);
    setMessages([]);
    setChatId(null);
    setResult(null);
    setCreated(null);
    setAffectedTasks([]);
    setSelectedTasks(new Set());

    const greetings: Record<Mode, string> = {
      chat: "안녕하세요! 어떤 프로젝트를 진행하고 계신지 알려주세요. 목표, 현재 상황, 주요 제약 조건을 말씀해주시면 업무 계획을 함께 만들어드립니다.",
      import: "기존 프로젝트 현황을 자유롭게 붙여넣어 주세요. 회의록, 문서, 아무 형태나 괜찮습니다. 분석해서 정리해드립니다.",
      bulk: "등록할 업무 목록을 입력해주세요. 줄바꿈으로 구분하면 됩니다. 프로젝트를 먼저 선택해주세요.",
      change: "어떤 변경사항이 생겼나요? 예: '가압기구 마감이 7월말로 연장됨', 'A 기능 방향이 바뀜' 등 자유롭게 입력하면 영향받는 업무를 찾아드립니다.",
    };
    setMessages([{ role: "assistant", content: greetings[m] }]);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const contextNote = projectContext ? buildContextPrompt(projectContext) : "";
    const messagesWithCtx = messages.map((m, i) =>
      i === 0 ? { ...m, content: m.content + contextNote } : m
    );
    const newMessages = [...messagesWithCtx, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: new TextEncoder().encode(JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId })),
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
    const contextNote = projectContext ? buildContextPrompt(projectContext) : "";
    const userMsg: Message = { role: "user", content: `아래 내용을 분석해서 프로젝트 계획으로 만들어주세요:${contextNote}\n\n${importText}` };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: new TextEncoder().encode(JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId })),
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
    const projectName = selectedProject ? projects.find(p => p.id === selectedProject)?.name : "미정";
    const contextNote = projectContext ? buildContextPrompt(projectContext) : "";
    const userMsg: Message = {
      role: "user",
      content: `아래 업무들을 분석해서 등록해주세요. 프로젝트: ${projectName}${contextNote}\n\n${bulkText}\n\n각 업무의 유형, 우선순위를 판단해서 RESULT_JSON으로 응답해주세요.`,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: new TextEncoder().encode(JSON.stringify({ messages: newMessages, chatId, userId: myUser?.userId })),
      });
      const data = await res.json();
      const cleanMsg = data.message.replace(/RESULT_JSON[\s\S]*?END_JSON/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanMsg }]);
      if (data.chatId) setChatId(data.chatId);
      if (data.result) setResult(data.result);
    } catch {}
    setLoading(false);
  }

  // 방향 변경 분석
  async function analyzeChange() {
    if (!changeText.trim() || !selectedProject || loading) return;
    setLoading(true);

    // 현재 프로젝트 업무 로드
    const { data: tasks } = await supabase.from("tasks")
      .select("id, title, status, due_date, assignee_id, priority, description")
      .eq("project_id", selectedProject)
      .neq("status", "done")
      .limit(50);

    const contextNote = projectContext ? buildContextPrompt(projectContext) : "";
    const taskList = (tasks ?? []).map((t: any) =>
      `[${t.id}] ${t.title} (상태: ${t.status}, 마감: ${t.due_date ?? "미정"})`
    ).join("\n");

    const prompt = `프로젝트에 변경사항이 생겼습니다.${contextNote}

변경사항: ${changeText}

현재 진행 중인 업무 목록:
${taskList}

위 변경사항이 각 업무에 어떤 영향을 미치는지 분석해주세요.
영향받는 업무에 대해 구체적인 수정 제안을 JSON 형식으로 응답해주세요.

응답 형식:
{
  "summary": "변경사항 요약",
  "affected": [
    {
      "task_id": "업무ID",
      "task_title": "업무명",
      "impact": "영향 설명",
      "suggestion": "수정 제안",
      "new_due_date": "YYYY-MM-DD 또는 null",
      "new_status": "상태 또는 null",
      "new_priority": "우선순위 또는 null"
    }
  ]
}`;

    const userMsg: Message = { role: "user", content: `변경사항을 분석해주세요: ${changeText}` };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/analyze-change", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: new TextEncoder().encode(JSON.stringify({ prompt, changeText, projectContext })),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAffectedTasks(data.affected ?? []);
      setSelectedTasks(new Set((data.affected ?? []).map((t: any) => t.task_id)));
      const msg = `**${data.summary}**\n\n영향받는 업무 ${(data.affected ?? []).length}건을 찾았습니다. 아래에서 적용할 항목을 선택하세요.`;
      setMessages(prev => [...prev, { role: "assistant", content: msg }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "분석 실패: " + e.message }]);
    }
    setLoading(false);
  }

  // 영향 업무 일괄 적용
  async function applyChanges() {
    if (selectedTasks.size === 0) return;
    setApplying(true);
    const toApply = affectedTasks.filter(t => selectedTasks.has(t.task_id));
    for (const t of toApply) {
      const update: any = {};
      if (t.new_due_date) update.due_date = t.new_due_date;
      if (t.new_status) update.status = t.new_status;
      if (t.new_priority) update.priority = t.new_priority;
      if (Object.keys(update).length > 0) {
        await supabase.from("tasks").update(update).eq("id", t.task_id);
      }
    }
    setAffectedTasks([]);
    setSelectedTasks(new Set());
    setMessages(prev => [...prev, { role: "assistant", content: `✓ ${toApply.length}건의 업무를 업데이트했습니다.` }]);
    setApplying(false);
    setChangeText("");
  }

  async function createProject() {
    if (!result) return;
    setCreating(true);
    if (mode === "bulk" && selectedProject) {
      for (const task of result.tasks ?? []) {
        await supabase.from("tasks").insert({
          ...task, project_id: selectedProject,
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
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: new TextEncoder().encode(JSON.stringify({ result, userId: myUser?.userId, assigneeId: myUser?.userId })),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCreated(data);
    } catch (e: any) {
      alert("생성 실패: " + e.message);
    }
    setCreating(false);
  }

  // 완료 화면
  if (created) return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
          {created.tasksOnly ? `업무 ${created.count}건이 등록됐습니다!` : "프로젝트가 생성됐습니다!"}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          {created.tasksOnly ? "선택한 프로젝트에 업무가 추가됐습니다" : `${result?.project?.name} 프로젝트와 업무가 모두 등록됐습니다`}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => router.push(created.projectId ? `/projects/${created.projectId}` : "/projects")}
          style={{ padding: "10px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          프로젝트 보기 →
        </button>
        <button onClick={() => { setMode(null); setCreated(null); setResult(null); }}
          style={{ padding: "10px 20px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          다시 사용하기
        </button>
      </div>
    </div>
  );

  // 모드 선택 화면
  if (!mode) return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 3, height: 18, background: "#7C3AED", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>AI 프로젝트 어시스턴트</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          프로젝트 계획 수립부터 방향 변경 반영까지 AI가 도와드립니다.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(Object.entries(MODE_CONFIG) as [Mode, any][]).map(([key, cfg]) => (
          <button key={key} onClick={() => startMode(key)}
            style={{
              background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12,
              padding: 20, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as any).style.borderColor = cfg.color; (e.currentTarget as any).style.background = `${cfg.color}06`; }}
            onMouseLeave={e => { (e.currentTarget as any).style.borderColor = "var(--border)"; (e.currentTarget as any).style.background = "var(--bg-2)"; }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>{cfg.icon}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{cfg.title}</p>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>{cfg.desc}</p>
          </button>
        ))}
      </div>

      {/* 프로젝트 컨텍스트 관리 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 12 }}>📌 프로젝트 컨텍스트 설정</p>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
          프로젝트 목표와 배경을 등록하면 AI가 더 정확하게 도와줍니다.
        </p>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ ...FS, marginBottom: 10 }}>
          <option value="">프로젝트 선택...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedProject && projectContext && (
          <ProjectContextEditor project={projectContext} onSave={async (goals, context) => {
            await supabase.from("projects").update({ goals, context }).eq("id", selectedProject);
            setProjects(prev => prev.map(p => p.id === selectedProject ? { ...p, goals, context } : p));
            setProjectContext(prev => ({ ...prev, goals, context }));
          }} />
        )}
      </div>
    </div>
  );

  const cfg = MODE_CONFIG[mode];

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setMode(null)}
          style={{ fontSize: 12, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>
          ← 돌아가기
        </button>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ fontSize: 18 }}>{cfg.icon}</span>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{cfg.title}</h1>
      </div>

      {/* 프로젝트 선택 (change/bulk 모드) */}
      {(mode === "change" || mode === "bulk" || mode === "import") && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
            style={{ ...FS, flex: 1 }}>
            <option value="">프로젝트 선택 (선택사항)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {projectContext?.goals && (
            <div style={{ fontSize: 11, color: "var(--cyan)", background: "var(--cyan-bg)", padding: "4px 10px", borderRadius: 6, border: "1px solid #BFDBFE", flexShrink: 0 }}>
              ✓ 컨텍스트 있음
            </div>
          )}
        </div>
      )}

      {/* 채팅창 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, height: 360, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", borderRadius: 12, padding: "10px 14px",
              background: m.role === "user" ? "var(--cyan-bg)" : "var(--bg-3)",
              border: `1px solid ${m.role === "user" ? "#BFDBFE" : "var(--border)"}`,
            }}>
              {m.role === "assistant" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>AI 어시스턴트</span>
                </div>
              )}
              <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, animation: "pulse 1s infinite" }} />
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>분석 중…</span>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 영향 업무 목록 (change 모드) */}
      {mode === "change" && affectedTasks.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#D97706", margin: 0 }}>
              🔄 영향받는 업무 ({selectedTasks.size}/{affectedTasks.length}건 선택)
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSelectedTasks(new Set(affectedTasks.map(t => t.task_id)))}
                style={{ fontSize: 11, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer" }}>
                전체 선택
              </button>
              <button onClick={() => setSelectedTasks(new Set())}
                style={{ fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>
                전체 해제
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {affectedTasks.map(t => (
              <div key={t.task_id} style={{
                background: "var(--bg-2)", border: `1px solid ${selectedTasks.has(t.task_id) ? "#FCD34D" : "var(--border)"}`,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer",
              }}
                onClick={() => setSelectedTasks(prev => {
                  const next = new Set(prev);
                  if (next.has(t.task_id)) next.delete(t.task_id);
                  else next.add(t.task_id);
                  return next;
                })}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: selectedTasks.has(t.task_id) ? "#D97706" : "var(--bg-3)", border: `1px solid ${selectedTasks.has(t.task_id) ? "#D97706" : "var(--border)"}` }}>
                    {selectedTasks.has(t.task_id) && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: "0 0 4px" }}>{t.task_title}</p>
                    <p style={{ fontSize: 11, color: "#D97706", margin: "0 0 4px" }}>{t.impact}</p>
                    <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0 }}>→ {t.suggestion}</p>
                    {(t.new_due_date || t.new_status || t.new_priority) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                        {t.new_due_date && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#FEF3C7", color: "#D97706" }}>마감: {t.new_due_date}</span>}
                        {t.new_status && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#EEF3FF", color: "#2563EB" }}>{t.new_status}</span>}
                        {t.new_priority && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#F5F3FF", color: "#7C3AED" }}>{t.new_priority}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={applyChanges} disabled={applying || selectedTasks.size === 0}
            style={{ width: "100%", padding: "10px 0", background: "#D97706", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: selectedTasks.size === 0 ? 0.4 : 1 }}>
            {applying ? "적용 중…" : `선택한 ${selectedTasks.size}건 업무 일괄 업데이트`}
          </button>
        </div>
      )}

      {/* 분석 결과 미리보기 */}
      {result && !created && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", margin: 0 }}>✓ 생성 준비 완료</p>
            <button onClick={createProject} disabled={creating}
              style={{ padding: "8px 18px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: creating ? 0.4 : 1 }}>
              {creating ? "생성 중…" : mode === "bulk" && selectedProject ? `업무 ${(result.tasks ?? []).length}건 등록` : "프로젝트 생성"}
            </button>
          </div>
          {result.project && (
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>{result.project.name}</p>
          )}
          {(result.milestones ?? []).length > 0 && (
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>단계 {result.milestones.length}개</p>
          )}
          {(result.tasks ?? []).length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>업무 {result.tasks.length}건</p>
              {result.tasks.slice(0, 4).map((t: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cyan)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{t.title}</span>
                </div>
              ))}
              {result.tasks.length > 4 && <p style={{ fontSize: 11, color: "var(--text-3)" }}>+{result.tasks.length - 4}건</p>}
            </div>
          )}
        </div>
      )}

      {/* 입력 영역 */}
      {mode === "chat" && (
        <div style={{ display: "flex", gap: 8 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="메시지 입력 (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={2} style={{ flex: 1, ...FS, resize: "none" }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            style={{ padding: "0 18px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: loading || !input.trim() ? 0.4 : 1 }}>
            전송
          </button>
        </div>
      )}

      {mode === "import" && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="회의록, 기획서, 메모 등 자유롭게 붙여넣기..."
            rows={6} style={{ ...FS, resize: "vertical" }} />
          <button onClick={analyzeImport} disabled={loading || !importText.trim()}
            style={{ padding: "10px 0", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: loading || !importText.trim() ? 0.4 : 1 }}>
            {loading ? "분석 중…" : "✦ AI 분석 시작"}
          </button>
        </div>
      )}

      {mode === "bulk" && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
            placeholder={"업무 목록을 입력해주세요\n예:\n- 고객 인터뷰 설계\n- 프로토타입 제작\n- 주간 회의 (매주 화요일)"}
            rows={8} style={{ ...FS, resize: "vertical" }} />
          <button onClick={analyzeBulk} disabled={loading || !bulkText.trim()}
            style={{ padding: "10px 0", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: loading || !bulkText.trim() ? 0.4 : 1 }}>
            {loading ? "분석 중…" : "✦ AI 분석 후 등록 준비"}
          </button>
        </div>
      )}

      {mode === "change" && (
        <div style={{ display: "flex", gap: 8 }}>
          <textarea value={changeText} onChange={e => setChangeText(e.target.value)}
            placeholder="예: '가압기구 마감이 7월말로 연장됨', 'A 기능 방향이 바뀌어 B, C 업무에 영향 있음'"
            rows={2} style={{ flex: 1, ...FS, resize: "none" }} />
          <button onClick={analyzeChange} disabled={loading || !changeText.trim() || !selectedProject}
            style={{ padding: "0 18px", background: "#D97706", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: loading || !changeText.trim() || !selectedProject ? 0.4 : 1, flexShrink: 0 }}>
            분석
          </button>
        </div>
      )}
      {mode === "change" && !selectedProject && (
        <p style={{ fontSize: 11, color: "#D97706", margin: 0 }}>⚠ 방향 변경 분석은 프로젝트를 먼저 선택해야 합니다</p>
      )}
    </div>
  );
}

// 프로젝트 컨텍스트 에디터
function ProjectContextEditor({ project, onSave }: { project: any; onSave: (goals: string, context: string) => Promise<void> }) {
  const [goals, setGoals] = useState(project.goals ?? "");
  const [context, setContext] = useState(project.context ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const FS2 = {
    background: "var(--bg-3)", border: "1px solid var(--border)",
    color: "var(--text-1)", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
  };

  async function handleSave() {
    setSaving(true);
    await onSave(goals, context);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>
          🎯 목표 — 이 프로젝트로 무엇을 달성하려 하나요?
        </label>
        <textarea value={goals} onChange={e => setGoals(e.target.value)}
          placeholder="예: 큐보좀 연속 제조 장비 개발 및 7월 17일 1차 시연 성공"
          rows={2} style={{ ...FS2, resize: "none" }} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>
          📋 배경/설명 — 주요 이해관계자, 제약 조건, 특이사항
        </label>
        <textarea value={context} onChange={e => setContext(e.target.value)}
          placeholder="예: 고디자인(외주), 하이퍼엔지니어링(외주) 협력. 가압기구 마감 7월말. 임베디드/프론트 병행 개발 중."
          rows={3} style={{ ...FS2, resize: "none" }} />
      </div>
      <button onClick={handleSave} disabled={saving}
        style={{ padding: "8px 16px", background: saved ? "#16A34A" : "var(--cyan)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", width: "fit-content" }}>
        {saving ? "저장 중…" : saved ? "✓ 저장됨" : "저장"}
      </button>
    </div>
  );
}
