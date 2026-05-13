// @ts-nocheck
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Step = "input" | "analyzing" | "review" | "done";

export default function MeetingNotePage() {
  const supabase = createClient();
  const router = useRouter();

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

  const timerRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("projects").select("id, name").eq("status", "active")
      .then(({ data }) => setProjects(data ?? []));

    getAuthUser().then(async u => {
      setMyUser(u);
      if (!u) return;
      const { data } = await supabase
        .from("meeting_drafts")
        .select("*")
        .eq("user_id", u.userId)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setDraftId(data.id);
        if (data.input_text) { setText(data.input_text); setRestored(true); }
        if (data.project_id) setSelectedProject(data.project_id);
        if (data.result) { setResult(data.result); setStep("review"); }
        setLastSaved(new Date(data.updated_at));
      }
    });
  }, []);

  // 30초마다 자동 저장
  useEffect(() => {
    if (!text && !result) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 30000);
    return () => clearTimeout(saveTimerRef.current);
  }, [text, result, selectedProject]);

  const autoSave = useCallback(async () => {
    if (!myUser || (!text && !result)) return;
    const payload = {
      user_id: myUser.userId,
      input_text: text || null,
      result: result ?? null,
      project_id: selectedProject || null,
      status: "draft",
      updated_at: new Date().toISOString(),
    };
    if (draftId) {
      await supabase.from("meeting_drafts").update(payload).eq("id", draftId);
    } else {
      const { data } = await supabase.from("meeting_drafts").insert(payload).select().single();
      if (data) setDraftId(data.id);
    }
    setLastSaved(new Date());
  }, [myUser, text, result, selectedProject, draftId]);

  async function completeDraft() {
    if (draftId) {
      await supabase.from("meeting_drafts").update({ status: "completed" }).eq("id", draftId);
      setDraftId(null);
    }
  }

  function fmtTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setFile(new File([blob], "recording.webm", { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch {
      alert("마이크 접근 권한이 필요합니다");
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  }

  async function transcribeFile(f: File): Promise<string> {
    setTranscribing(true);
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await res.json();
    setTranscribing(false);
    if (data.error) throw new Error(data.error);
    return data.text;
  }

  async function analyze() {
    setStep("analyzing");
    try {
      let finalText = text;
      if (inputMode !== "text" && file) {
        finalText = await transcribeFile(file);
        setText(finalText);
      }
      if (!finalText.trim()) throw new Error("내용이 없습니다");

      const res = await fetch("/api/analyze-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText, projectId: selectedProject }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 분석 결과에 selected 기본값 추가
      const resultWithSelected = {
        ...data,
        tasks: (data.tasks ?? []).map((t: any) => ({ ...t, selected: true })),
      };
      setResult(resultWithSelected);
      setStep("review");
    } catch (e: any) {
      alert("분석 실패: " + e.message);
      setStep("input");
    }
  }

  async function applyTasks() {
    if (!result) return;
    setApplying(true);
    for (const task of result.tasks ?? []) {
      if (!task.selected) continue;
      await supabase.from("tasks").insert({
        title: task.title,
        task_type: task.task_type ?? "other",
        priority: task.priority ?? "medium",
        status: task.is_blocked ? "blocked" : "todo",
        blocked_reason: task.is_blocked ? task.blocked_reason : null,
        due_date: task.due_date ?? null,
        assignee_id: task.assignee_id ?? null,
        assignee_ids: task.assignee_ids ?? [],
        project_id: selectedProject || null,
      });
    }
    await completeDraft();
    setStep("done");
    setApplying(false);
  }

  function toggleTask(i: number) {
    setResult((r: any) => ({
      ...r,
      tasks: r.tasks.map((t: any, idx: number) => idx === i ? { ...t, selected: !t.selected } : t),
    }));
  }

  function resetAll() {
    completeDraft();
    setStep("input"); setResult(null); setText(""); setFile(null);
    setDraftId(null); setRestored(false); setLastSaved(null);
  }

  const fieldStyle = {
    background: "#1E2435", border: "1px solid var(--border-2)", color: "#E8F4FF",
    borderRadius: 8, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none",
    colorScheme: "dark" as const,
  };
  const PRIORITY_COLOR: Record<string, string> = { urgent: "#FF4D6A", high: "#F5A623", medium: "#2E86FF", low: "#4A7099" };
  const PRIORITY_LABEL: Record<string, string> = { urgent: "긴급", high: "높음", medium: "보통", low: "낮음" };

  if (step === "done") return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
      <div className="text-5xl">✅</div>
      <div>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-1)" }}>업무가 등록됐습니다!</p>
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          선택한 업무 {result?.tasks?.filter((t: any) => t.selected).length}건이 등록됐습니다
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => router.push("/tasks")}
          className="rounded-xl px-6 py-3 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
          업무 목록 보기 →
        </button>
        <button onClick={resetAll}
          className="rounded-xl px-6 py-3 text-sm"
          style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
          새 회의록 분석
        </button>
      </div>
    </div>
  );

  if (step === "analyzing") return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
      <div className="inline-block w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "#A78BFA", borderTopColor: "transparent" }} />
      <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>
        {transcribing ? "음성을 텍스트로 변환 중…" : "회의 내용을 분석 중…"}
      </p>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>잠시만 기다려주세요</p>
    </div>
  );

  if (step === "review" && result) return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("input")} className="text-xs" style={{ color: "var(--text-3)" }}>← 다시 입력</button>
        <span style={{ color: "var(--border)" }}>|</span>
        <h1 className="text-sm font-bold" style={{ color: "var(--text-1)" }}>분석 결과 확인</h1>
        {lastSaved && <p className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>✓ {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 저장됨</p>}
      </div>

      <div className="rounded-2xl p-4" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: "#A78BFA" }}>회의 요약</p>
        <p className="text-sm" style={{ color: "var(--text-1)" }}>{result.summary}</p>
        {result.participants?.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>참석자: {result.participants.join(", ")}</p>
        )}
      </div>

      {result.decisions?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-3)" }}>결정사항</p>
          {result.decisions.map((d: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: "#00D4A0", fontSize: 12, marginTop: 2 }}>✓</span>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>{d}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
            등록할 업무 ({result.tasks?.filter((t: any) => t.selected).length ?? 0}/{result.tasks?.length ?? 0})
          </p>
          <button onClick={() => setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any) => ({ ...t, selected: true })) }))}
            className="text-xs" style={{ color: "var(--cyan)" }}>모두 선택</button>
        </div>
        {(result.tasks ?? []).map((task: any, i: number) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 cursor-pointer"
            style={{ background: task.selected ? "rgba(46,134,255,0.05)" : "var(--bg-2)", borderBottom: "1px solid var(--border)" }}
            onClick={() => toggleTask(i)}>
            <div className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0"
              style={{ background: task.selected ? "#2E86FF" : "var(--bg-3)", border: `1px solid ${task.selected ? "#2E86FF" : "var(--border-2)"}` }}>
              {task.selected && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{task.title}</p>
                {task.is_blocked && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,77,106,0.12)", color: "#FF4D6A" }}>Blocked</span>}
                <span className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[task.priority] ?? "#4A7099" }}>
                  {PRIORITY_LABEL[task.priority] ?? task.priority}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {task.assignee_name && <span className="text-xs" style={{ color: "var(--text-3)" }}>담당: {task.assignee_name}</span>}
                {task.due_date && <span className="text-xs" style={{ color: "var(--text-3)" }}>마감: {task.due_date}</span>}
                {task.is_blocked && task.blocked_reason && <span className="text-xs" style={{ color: "#FF4D6A" }}>{task.blocked_reason}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.issues?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#F5A623" }}>⚠ 이슈</p>
          {result.issues.map((issue: string, i: number) => (
            <p key={i} className="text-sm" style={{ color: "var(--text-2)" }}>• {issue}</p>
          ))}
        </div>
      )}

      <button onClick={applyTasks} disabled={applying || !result.tasks?.some((t: any) => t.selected)}
        className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #00C2CC, #2E86FF)", color: "#fff" }}>
        {applying ? "등록 중…" : `선택한 업무 ${result.tasks?.filter((t: any) => t.selected).length ?? 0}건 등록하기`}
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: "#F5A623" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>회의록 분석</h1>
        </div>
        {lastSaved && <p className="text-xs" style={{ color: "var(--text-3)" }}>✓ {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 자동 저장됨</p>}
      </div>

      {restored && text && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
          <div>
            <p className="text-xs" style={{ color: "#F5A623" }}>📋 이전에 작성하던 내용이 복원됐습니다</p>
            {lastSaved && <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>마지막 저장: {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>}
          </div>
          <button onClick={resetAll} className="text-xs ml-4" style={{ color: "var(--text-3)" }}>초기화</button>
        </div>
      )}

      <div className="flex gap-2 p-1 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
        {[{ id: "text", label: "✍️ 텍스트 입력" }, { id: "file", label: "📁 파일 업로드" }, { id: "record", label: "🎙️ 녹음" }].map(m => (
          <button key={m.id} onClick={() => setInputMode(m.id as any)}
            className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
            style={{
              background: inputMode === m.id ? "var(--bg-4)" : "transparent",
              color: inputMode === m.id ? "var(--text-1)" : "var(--text-3)",
              border: inputMode === m.id ? "1px solid var(--border-2)" : "1px solid transparent",
            }}>{m.label}</button>
        ))}
      </div>

      <div>
        <label className="text-xs mb-1 block" style={{ color: "var(--text-3)" }}>어떤 프로젝트의 회의인가요?</label>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={fieldStyle}>
          <option value="">프로젝트 없음</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {inputMode === "text" && (
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={"회의록을 붙여넣거나 직접 입력해주세요\n\n예시:\n일시: 2026-05-13\n참석자: 김성훈, 진태우\n\n액션아이템\n- 보고서 작성 / 김성훈 / 5/15\n- 2차 테스트 / 고우성 / 5/20"}
          rows={10} className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
      )}

      {inputMode === "file" && (
        <div>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.mp4,.wav,.m4a,.webm"
            onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          <div className="rounded-xl p-8 text-center cursor-pointer"
            style={{ background: "var(--bg-2)", border: "2px dashed var(--border-2)" }}
            onClick={() => fileRef.current?.click()}>
            {file ? (
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>🎵 {file.name}</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📁</p>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>클릭하여 파일 선택</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>mp3, mp4, wav, m4a, webm 지원 (최대 25MB)</p>
              </div>
            )}
          </div>
        </div>
      )}

      {inputMode === "record" && (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          {!recording && !file && (
            <div>
              <p className="text-2xl mb-3">🎙️</p>
              <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>버튼을 눌러 회의를 녹음하세요</p>
              <button onClick={startRecording}
                className="rounded-xl px-6 py-3 text-sm font-semibold"
                style={{ background: "rgba(255,77,106,0.15)", color: "#FF4D6A", border: "1px solid rgba(255,77,106,0.3)" }}>
                🔴 녹음 시작
              </button>
            </div>
          )}
          {recording && (
            <div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#FF4D6A" }} />
                <p className="text-lg font-bold tabular-nums" style={{ color: "#FF4D6A" }}>{fmtTime(recordTime)}</p>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>녹음 중입니다</p>
              <button onClick={stopRecording}
                className="rounded-xl px-6 py-3 text-sm font-semibold"
                style={{ background: "var(--bg-3)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                ⏹ 녹음 중지
              </button>
            </div>
          )}
          {!recording && file && (
            <div>
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-1)" }}>녹음 완료 ({fmtTime(recordTime)})</p>
              <button onClick={startRecording} className="text-xs mt-2" style={{ color: "var(--text-3)" }}>다시 녹음</button>
            </div>
          )}
        </div>
      )}

      <button onClick={analyze}
        disabled={inputMode === "text" ? !text.trim() : !file}
        className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #F5A623, #FF4D6A)", color: "#fff" }}>
        ✦ AI 분석 시작
      </button>
    </div>
  );
}
