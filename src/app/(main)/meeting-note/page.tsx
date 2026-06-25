// @ts-nocheck
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Step = "input" | "analyzing" | "review" | "done";
type View = "main" | "history";

export default function MeetingNotePage() {
  const supabase = createClient();
  const router = useRouter();
  const [view, setView] = useState<View>("main");
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<"text" | "file" | "record">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [applying, setApplying] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [myUser, setMyUser] = useState<any>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [restored, setRestored] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const timerRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const allTextsRef = useRef<string[]>([]);

  useEffect(() => {
    supabase.from("projects").select("id, name").eq("status", "active")
      .then(({ data }) => setProjects(data ?? []));
    getAuthUser().then(async u => {
      setMyUser(u);
      if (!u) return;
      const { data } = await supabase.from("meeting_drafts").select("*")
        .eq("user_id", u.userId).eq("status", "draft")
        .order("updated_at", { ascending: false }).limit(1).single();
      if (data) {
        setDraftId(data.id);
        if (data.input_text) { setText(data.input_text); setRestored(true); }
        if (data.project_id) setSelectedProject(data.project_id);
        if (data.result) { setResult(data.result); setStep("review"); }
        setLastSaved(new Date(data.updated_at));
      }
    });
  }, []);

  async function loadHistory() {
    if (!myUser) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("meeting_drafts").select("*, project:projects(name)")
      .eq("user_id", myUser.userId).order("group_order", { ascending: true }).order("updated_at", { ascending: false }).limit(20);
    setHistory(data ?? []);
    setHistoryLoading(false);
  }

  useEffect(() => { if (view === "history" && myUser) loadHistory(); }, [view, myUser]);

  const autoSave = useCallback(async () => {
    if (!myUser || (!text && !result)) return;
    const payload = { user_id: myUser.userId, input_text: text || null, result: result ?? null, project_id: selectedProject || null, status: "draft", updated_at: new Date().toISOString() };
    if (draftId) { await supabase.from("meeting_drafts").update(payload).eq("id", draftId); }
    else { const { data } = await supabase.from("meeting_drafts").insert(payload).select().single(); if (data) setDraftId(data.id); }
    setLastSaved(new Date());
  }, [myUser, text, result, selectedProject, draftId]);

  useEffect(() => {
    if (!text && !result) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 30000);
    return () => clearTimeout(saveTimerRef.current);
  }, [text, result, selectedProject, draftId, myUser]);

  async function completeDraft() {
    if (draftId) { await supabase.from("meeting_drafts").update({ status: "completed" }).eq("id", draftId); setDraftId(null); }
  }

  function fmtTime(s: number) { return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`; }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      allTextsRef.current = [];
      let segIdx = 0;
      const startSeg = () => {
        const chunks: Blob[] = [];
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        mr.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const f = new File([blob], `seg-${segIdx}.webm`, { type: "audio/webm" });
          segIdx++;
          try {
            const form = new FormData(); form.append("file", f); form.append("model", "whisper-1"); form.append("language", "ko");
            const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` }, body: form });
            if (res.ok) { const d = await res.json(); allTextsRef.current.push(d.text); setText(allTextsRef.current.join(" ")); }
          } catch {}
        };
        mr.start(); setMediaRecorder(mr);
        setTimeout(() => { if (mr.state === "recording") { mr.stop(); startSeg(); } }, 10 * 60 * 1000);
      };
      startSeg(); setRecording(true); setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch { alert("마이크 접근 권한이 필요합니다."); }
  }

  function stopRecording() { mediaRecorder?.stop(); setRecording(false); clearInterval(timerRef.current); }

  async function transcribeFile(f: File): Promise<string> {
    setTranscribing(true);
    try {
      const CHUNK = 24 * 1024 * 1024;
      const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (f.size <= CHUNK) {
        const form = new FormData(); form.append("file", f); form.append("model", "whisper-1"); form.append("language", "ko");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message); }
        return (await res.json()).text;
      }
      const n = Math.ceil(f.size / CHUNK); const texts: string[] = [];
      for (let i = 0; i < n; i++) {
        const chunk = new File([f.slice(i*CHUNK, Math.min((i+1)*CHUNK, f.size))], `chunk-${i}.${f.name.split('.').pop()}`, { type: f.type });
        setText(`변환 중 (${i+1}/${n})`);
        const form = new FormData(); form.append("file", chunk); form.append("model", "whisper-1"); form.append("language", "ko");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message); }
        texts.push((await res.json()).text);
      }
      return texts.join(" ");
    } finally { setTranscribing(false); }
  }

  async function analyze() {
    setStep("analyzing");
    try {
      let finalText = text;
      if (inputMode !== "text" && file) { finalText = await transcribeFile(file); setText(finalText); }
      if (!finalText.trim()) throw new Error("내용이 없습니다");
      const res = await fetch("/api/analyze-meeting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: finalText, projectId: selectedProject }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const r = { ...data, tasks: (data.tasks ?? []).map((t: any) => ({ ...t, selected: true, projectId: selectedProject || "" })) };
      setResult(r);
      if (myUser) {
        const payload = { user_id: myUser.userId, input_text: finalText, result: r, project_id: selectedProject || null, status: "draft" };
        if (draftId) { await supabase.from("meeting_drafts").update(payload).eq("id", draftId); }
        else { const { data: d } = await supabase.from("meeting_drafts").insert(payload).select().single(); if (d) setDraftId(d.id); }
        setLastSaved(new Date());
      }
      setStep("review");
    } catch (e: any) { alert("분석 실패: " + e.message); setStep("input"); }
  }

  async function applyTasks() {
    if (!result) return;
    setApplying(true);
    let count = 0;
    const selectedTasks = (result.tasks ?? []).filter((t: any) => t.selected);
    for (const task of selectedTasks) {
      if (task.projectId) {
        const { error } = await supabase.from("task_drafts").insert({
          meeting_draft_id: draftId, project_id: task.projectId, title: task.title,
          task_type: task.task_type ?? "other", priority: task.priority ?? "medium",
          due_date: task.due_date ?? null, assignee_id: task.assignee_id ?? null,
          assignee_ids: task.assignee_ids ?? [], is_blocked: task.is_blocked ?? false,
          blocked_reason: task.is_blocked ? task.blocked_reason : null,
          status: "pending", submitted_by: myUser?.userId ?? null,
        });
        if (!error) count++;
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: task.title, task_type: task.task_type ?? "other", priority: task.priority ?? "medium",
          status: task.is_blocked ? "blocked" : "todo", blocked_reason: task.is_blocked ? task.blocked_reason : null,
          due_date: task.due_date ?? null, assignee_id: task.assignee_id ?? null,
          assignee_ids: task.assignee_ids ?? [], project_id: null,
        });
        if (!error) count++;
      }
    }
    const draftCount = selectedTasks.filter((t: any) => t.projectId).length;
    const directCount = selectedTasks.filter((t: any) => !t.projectId).length;
    await completeDraft();
    setResult((r: any) => ({ ...r, _count: count, _draftCount: draftCount, _directCount: directCount }));
    setStep("done"); setApplying(false);
  }

  function toggleTask(i: number) {
    setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any, j: number) => j === i ? { ...t, selected: !t.selected } : t) }));
  }
  function setTaskProject(i: number, pid: string) {
    setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any, j: number) => j === i ? { ...t, projectId: pid } : t) }));
  }
  function resetAll() { completeDraft(); setStep("input"); setResult(null); setText(""); setFile(null); setDraftId(null); setRestored(false); setLastSaved(null); }

  function loadFromHistory(item: any) {
    setDraftId(item.id);
    if (item.input_text) setText(item.input_text);
    if (item.project_id) setSelectedProject(item.project_id);
    if (item.result) { setResult({ ...item.result, tasks: (item.result.tasks ?? []).map((t: any) => ({ ...t, selected: true, projectId: t.projectId || item.project_id || "" })) }); setStep("review"); }
    else setStep("input");
    setLastSaved(new Date(item.updated_at)); setView("main");
  }

  async function deleteHistory(id: string) {
    if (!confirm("삭제할까요?")) return;
    const item = history.find(h => h.id === id);
    if (item?.audio_path) await supabase.storage.from("meeting-recordings").remove([item.audio_path]);
    await supabase.from("meeting_drafts").delete().eq("id", id);
    setHistory(h => h.filter(x => x.id !== id));
  }

  const FS = {
    background: "var(--bg-3)", border: "1px solid var(--border)",
    color: "var(--text-1)", borderRadius: 8, padding: "7px 10px",
    fontSize: 13, width: "100%", outline: "none", colorScheme: "light" as const,
  };

  const PC: Record<string, string> = { urgent: "#DC2626", high: "#D97706", medium: "#2563EB", low: "#A8A8A4" };
  const PL: Record<string, string> = { urgent: "긴급", high: "높음", medium: "보통", low: "낮음" };

  if (view === "history") return (
    <HistoryView history={history} historyLoading={historyLoading}
      onBack={() => setView("main")} onLoad={loadFromHistory}
      onDelete={deleteHistory} onRefresh={loadHistory} supabase={supabase} />
  );

  if (step === "done") return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>업무가 등록됐습니다!</p>
        {result?._draftCount > 0 && (
          <div style={{ background: "#EEF3FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 16px", marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>📋 {result._draftCount}건 → 프로젝트 리더 승인 대기</p>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>리더가 승인하면 프로젝트 업무로 등록됩니다</p>
          </div>
        )}
        {result?._directCount > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>{result._directCount}건이 바로 등록됐습니다</p>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => router.push("/tasks")}
          style={{ padding: "10px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          업무 목록 보기 →
        </button>
        <button onClick={resetAll}
          style={{ padding: "10px 20px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          새 회의록 분석
        </button>
      </div>
    </div>
  );

  if (step === "analyzing") return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--cyan)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{transcribing ? "음성을 텍스트로 변환 중…" : "회의 내용을 분석 중…"}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (step === "review" && result) return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setStep("input")} style={{ fontSize: 12, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>← 다시 입력</button>
        <span style={{ color: "var(--border)" }}>|</span>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>분석 결과 확인</h1>
        {lastSaved && <p style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>🕐 {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 저장</p>}
      </div>

      {/* 회의 요약 */}
      <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#7C3AED", marginBottom: 6 }}>회의 요약</p>
        <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.6 }}>{result.summary}</p>
        {result.participants?.length > 0 && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>참석자: {result.participants.join(", ")}</p>}
      </div>

      {/* 결정사항 */}
      {result.decisions?.length > 0 && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>결정사항</p>
          {result.decisions.map((d: string, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#16A34A", fontSize: 13, marginTop: 1 }}>✓</span>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      )}

      {/* 업무 목록 */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>
            등록할 업무 ({result.tasks?.filter((t:any)=>t.selected).length ?? 0}/{result.tasks?.length ?? 0})
          </p>
          <button onClick={() => setResult((r:any) => ({ ...r, tasks: r.tasks.map((t:any) => ({ ...t, selected: true })) }))}
            style={{ fontSize: 11, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer" }}>
            전체 선택
          </button>
        </div>
        {(result.tasks ?? []).map((task: any, i: number) => (
          <div key={i} style={{ padding: "12px 16px", background: task.selected ? "#EEF3FF" : "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ marginTop: 2, width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: task.selected ? "var(--cyan)" : "var(--bg-3)", border: `1px solid ${task.selected ? "var(--cyan)" : "var(--border)"}` }}
                onClick={() => toggleTask(i)}>
                {task.selected && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: PC[task.priority] ?? "#A8A8A4" }}>{PL[task.priority] ?? task.priority}</span>
                </div>
                <select value={task.projectId ?? ""} onChange={e => setTaskProject(i, e.target.value)}
                  style={{ ...FS, fontSize: 12, marginBottom: 6 }}>
                  <option value="">프로젝트 없음</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {task.assignee_name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>담당: {task.assignee_name}</span>}
                  {task.due_date && <span style={{ fontSize: 11, color: "var(--text-3)" }}>마감: {task.due_date}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 이슈 */}
      {result.issues?.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#D97706", marginBottom: 8 }}>주요 이슈</p>
          {result.issues.map((issue: string, i: number) => (
            <p key={i} style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 4px" }}>· {issue}</p>
          ))}
        </div>
      )}

      <button onClick={applyTasks} disabled={applying || !result.tasks?.some((t:any)=>t.selected)}
        style={{ padding: "12px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: applying || !result.tasks?.some((t:any)=>t.selected) ? 0.4 : 1 }}>
        {applying ? "등록 중…" : `선택한 업무 ${result.tasks?.filter((t:any)=>t.selected).length ?? 0}건 등록하기`}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "#D97706", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>회의 기록</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastSaved && <p style={{ fontSize: 11, color: "var(--text-3)" }}>🕐 {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 자동 저장</p>}
          <button onClick={() => setView("history")}
            style={{ padding: "6px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
            📋 이전 기록
          </button>
        </div>
      </div>

      {restored && text && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "#D97706", margin: 0 }}>🕐 이전에 작성하던 내용을 불러왔습니다</p>
          <button onClick={resetAll} style={{ fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>지우기</button>
        </div>
      )}

      {/* 입력 모드 탭 */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
        {[{ id: "text", label: "📝 텍스트 입력" }, { id: "file", label: "🎵 파일 업로드" }, { id: "record", label: "🎙 녹음" }].map(m => (
          <button key={m.id} onClick={() => setInputMode(m.id as any)}
            style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: inputMode === m.id ? "var(--bg-4)" : "transparent", color: inputMode === m.id ? "var(--text-1)" : "var(--text-3)" }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 기본 프로젝트 */}
      <div>
        <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 5 }}>기본 프로젝트 (분석 후 업무별로 변경 가능)</label>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={FS}>
          <option value="">프로젝트 없음</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* 텍스트 입력 */}
      {inputMode === "text" && (
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={"회의록을 붙여넣거나 직접 입력해주세요\n\n예시:\n일시: 2026-05-13\n참석자: 홍길동, 김철수\n\n주요내용\n- 보고서 작성 / 홍길동 / 5/15"}
          rows={10} style={{ ...FS, resize: "vertical" }} />
      )}

      {/* 파일 업로드 */}
      {inputMode === "file" && (
        <div>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.mp4,.wav,.m4a,.webm" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          <div style={{ background: "var(--bg-2)", border: "2px dashed var(--border)", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer" }}
            onClick={() => fileRef.current?.click()}>
            {file ? (
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>✓ {file.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>{(file.size/1024/1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 32, marginBottom: 10 }}>🎵</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)", marginBottom: 4 }}>클릭해서 파일 선택</p>
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>mp3, mp4, wav, m4a, webm 지원</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 녹음 */}
      {inputMode === "record" && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          {!recording && (
            <div>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🎙</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)", marginBottom: 4 }}>10분마다 자동으로 분할 저장됩니다</p>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>시간 제한 없이 녹음 가능</p>
              <button onClick={startRecording}
                style={{ padding: "10px 24px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>
                🔴 녹음 시작
              </button>
            </div>
          )}
          {recording && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", animation: "pulse 1s infinite" }} />
                <p style={{ fontSize: 24, fontWeight: 700, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{fmtTime(recordTime)}</p>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>녹음 중 · 10분마다 자동 분할</p>
              {text && <p style={{ fontSize: 11, color: "var(--text-2)", background: "var(--bg-3)", borderRadius: 8, padding: "8px 12px", textAlign: "left", maxHeight: 60, overflow: "hidden", marginBottom: 16 }}>{text.slice(-200)}</p>}
              <button onClick={stopRecording}
                style={{ padding: "10px 24px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
                ⏹ 녹음 중지
              </button>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            </div>
          )}
        </div>
      )}

      <button onClick={analyze} disabled={inputMode === "text" ? !text.trim() : !file}
        style={{ padding: "12px 0", background: inputMode === "text" && !text.trim() ? "var(--bg-3)" : "var(--cyan)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: inputMode === "text" && !text.trim() ? "var(--text-3)" : "#fff", cursor: "pointer", opacity: (inputMode === "text" ? !text.trim() : !file) ? 0.4 : 1 }}>
        ✦ AI 분석 시작
      </button>
    </div>
  );
}

function HistoryView({ history, historyLoading, onBack, onLoad, onDelete, onRefresh, supabase }: any) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupTitle, setGroupTitle] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const groups: Record<string, any[]> = {};
  const ungrouped: any[] = [];
  history.forEach((item: any) => {
    if (item.group_id) {
      if (!groups[item.group_id]) groups[item.group_id] = [];
      groups[item.group_id].push(item);
    } else { ungrouped.push(item); }
  });

  async function createGroup() {
    if (!groupTitle.trim() || selected.size === 0) return;
    setSaving(true);
    const groupId = crypto.randomUUID();
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i++) {
      await supabase.from("meeting_drafts").update({ group_id: groupId, group_title: groupTitle.trim(), group_order: i }).eq("id", ids[i]);
    }
    setSelected(new Set()); setGroupTitle(""); setShowGroupForm(false); setSaving(false); onRefresh();
  }

  async function ungroup(groupId: string) {
    if (!confirm("그룹을 해제할까요?")) return;
    await supabase.from("meeting_drafts").update({ group_id: null, group_title: null, group_order: 0 }).eq("group_id", groupId);
    onRefresh();
  }

  async function renameGroup(groupId: string, items: any[]) {
    const newTitle = prompt("새 이름을 입력하세요", items[0]?.group_title ?? "");
    if (!newTitle) return;
    for (const item of items) {
      await supabase.from("meeting_drafts").update({ group_title: newTitle }).eq("id", item.id);
    }
    onRefresh();
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function ItemCard({ item, showCheck = false }: any) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {showCheck && (
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
            style={{ marginTop: 4, cursor: "pointer", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: item.status === "completed" ? "#F0FDF4" : "#F5F3FF", color: item.status === "completed" ? "#16A34A" : "#7C3AED", border: `1px solid ${item.status === "completed" ? "#BBF7D0" : "#DDD6FE"}` }}>
                  {item.status === "completed" ? "완료" : "미완료"}
                </span>
                {item.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{item.project.name}</span>}
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {new Date(item.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {item.audio_path && <span style={{ fontSize: 10, color: "#2563EB" }}>🎙 녹음</span>}
              </div>
              {item.result?.summary && <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{item.result.summary}</p>}
              {(item.result?.tasks?.length ?? 0) > 0 && <span style={{ fontSize: 11, color: "var(--text-3)" }}>업무 {item.result.tasks.length}건</span>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onLoad(item)}
                style={{ padding: "5px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--text-2)", cursor: "pointer" }}>
                불러오기
              </button>
              <button onClick={() => onDelete(item.id)}
                style={{ padding: "5px 10px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 11, color: "#DC2626", cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ fontSize: 12, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>← 돌아가기</button>
          <span style={{ color: "var(--border)" }}>|</span>
          <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>회의 이전 기록</h1>
        </div>
        {selected.size > 0 && !showGroupForm && (
          <button onClick={() => setShowGroupForm(true)}
            style={{ padding: "6px 12px", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#7C3AED", cursor: "pointer" }}>
            📁 {selected.size}개 묶기
          </button>
        )}
      </div>

      {showGroupForm && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED", margin: 0 }}>📁 {selected.size}개 회의록 묶기</p>
          <input value={groupTitle} onChange={e => setGroupTitle(e.target.value)}
            placeholder="그룹 이름 입력 (예: 5월 3분기 계획 회의)"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%", outline: "none" }}
            onKeyDown={e => { if (e.key === "Enter") createGroup(); if (e.key === "Escape") setShowGroupForm(false); }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createGroup} disabled={!groupTitle.trim() || saving}
              style={{ padding: "7px 16px", background: "#7C3AED", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !groupTitle.trim() || saving ? 0.4 : 1 }}>
              {saving ? "저장 중…" : "묶기"}
            </button>
            <button onClick={() => { setShowGroupForm(false); setGroupTitle(""); }}
              style={{ padding: "7px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
              취소
            </button>
          </div>
        </div>
      )}

      {historyLoading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>불러오는 중…</p>
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>저장된 회의록이 없습니다</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.entries(groups).map(([gId, items]) => {
            const title = items[0]?.group_title ?? "묶음 회의록";
            const totalTasks = items.reduce((s, i) => s + (i.result?.tasks?.length ?? 0), 0);
            return (
              <div key={gId} style={{ border: "1px solid #DDD6FE", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#F5F3FF", borderBottom: "1px solid #DDD6FE" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#7C3AED" }}>📁</span>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#7C3AED", margin: 0 }}>{title}</p>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{items.length}개 · 업무 {totalTasks}건</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => renameGroup(gId, items)} style={{ fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>이름 변경</button>
                    <button onClick={() => ungroup(gId)} style={{ fontSize: 11, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer" }}>그룹 해제</button>
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--bg-2)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
              </div>
            );
          })}
          {ungrouped.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ungrouped.length > 1 && (
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 4px" }}>여러 개 선택 후 묶기 가능</p>
              )}
              {ungrouped.map(item => <ItemCard key={item.id} item={item} showCheck={ungrouped.length > 1} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
