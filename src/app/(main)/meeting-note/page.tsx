// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Step = "write" | "analyzing" | "review" | "done";
type View = "main" | "history";

const SECTION_TYPES = [
  { id: "agenda",    label: "📌 안건" },
  { id: "decision",  label: "✅ 결정사항" },
  { id: "issue",     label: "⚠ 이슈" },
  { id: "note",      label: "📝 기타 메모" },
];

const FS = {
  background: "var(--bg-3)", border: "1px solid var(--border)",
  color: "var(--text-1)", borderRadius: 8, padding: "7px 10px",
  fontSize: 13, outline: "none", colorScheme: "light" as const,
};

const PC: Record<string, string> = { urgent: "#DC2626", high: "#D97706", medium: "#2563EB", low: "#A8A8A4" };
const PL: Record<string, string> = { urgent: "긴급", high: "높음", medium: "보통", low: "낮음" };

export default function MeetingNotePage() {
  const supabase = createClient();
  const router = useRouter();
  const [view, setView] = useState<View>("main");
  const [step, setStep] = useState<Step>("write");
  const [myUser, setMyUser] = useState<any>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [result, setResult] = useState<any>(null);
  const [applying, setApplying] = useState(false);

  // 회의록 폼
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [attendees, setAttendees] = useState<{ id?: string; name: string }[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [sections, setSections] = useState([
    { id: "s1", type: "agenda",   items: [""] },
    { id: "s2", type: "decision", items: [""] },
  ]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null);
  const [audioTab, setAudioTab] = useState<"upload" | "record">("upload");
  const timerRef = useRef<any>(null);
  const allTextsRef = useRef<string[]>([]);

  // 데이터
  const [projects, setProjects] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<any>(null);

  function fmtTime(s: number) {
    return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  }

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
          const f = new File([blob], `녹음_${segIdx + 1}.webm`, { type: "audio/webm" });
          segIdx++;
          // 녹음 파일을 audioFiles에 추가
          setAudioFiles(prev => [...prev, f]);
          // 자동 Whisper 변환 (서버 라우트)
          try {
            const form = new FormData();
            form.append("file", f);
            const res = await fetch("/api/transcribe", {
              method: "POST", body: form,
            });
            if (res.ok) {
              const d = await res.json();
              if (d.text) allTextsRef.current.push(d.text);
            }
          } catch {}
        };
        mr.start();
        setMediaRecorder(mr);
        setTimeout(() => { if (mr.state === "recording") { mr.stop(); startSeg(); } }, 10 * 60 * 1000);
      };
      startSeg();
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch {
      alert("마이크 접근 권한이 필요합니다.");
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  }

  useEffect(() => {
    async function init() {
      const u = await getAuthUser();
      setMyUser(u);
      const { data: p } = await supabase.from("projects").select("id, name").eq("status", "active");
      setProjects(p ?? []);
      const { data: m } = await supabase.from("users").select("id, name").eq("is_active", true).neq("role", "viewer").order("name");
      setTeamMembers(m ?? []);
      // 미완료 임시저장 불러오기
      if (u) {
        const { data } = await supabase.from("meeting_drafts").select("*")
          .eq("user_id", u.userId).eq("status", "draft")
          .order("updated_at", { ascending: false }).limit(1).single();
        if (data?.result) {
          setResult(data.result);
          setStep("review");
          setDraftId(data.id);
          setLastSaved(new Date(data.updated_at));
        }
      }
    }
    init();
  }, []);

  async function loadHistory() {
    if (!myUser) return;
    setHistoryLoading(true);
    // admin/leader는 팀 전체, 일반 멤버는 본인 기록
    let q = supabase.from("meeting_drafts")
      .select("*, project:projects(name), author:users!meeting_drafts_user_id_fkey(name)")
      .order("updated_at", { ascending: false }).limit(50);
    if (myUser.role !== "admin" && myUser.role !== "leader") {
      q = q.eq("user_id", myUser.userId);
    }
    const { data } = await q;
    setHistory(data ?? []);
    setHistoryLoading(false);
  }

  useEffect(() => { if (view === "history" && myUser) loadHistory(); }, [view, myUser]);

  // 자동 저장
  async function autoSave(overrideResult?: any) {
    if (!myUser) return;
    const payload = {
      user_id: myUser.userId,
      input_text: buildTextSummary(),
      result: overrideResult ?? result ?? null,
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
  }

  function buildTextSummary() {
    const lines = [
      `회의명: ${title}`,
      `일시: ${meetingDate} ${startTime}${endTime ? " ~ " + endTime : ""}`,
      location ? `장소: ${location}` : "",
      attendees.length > 0 ? `참석자: ${attendees.map(a => a.name).join(", ")}` : "",
      "",
      ...sections.map(s => {
        const label = SECTION_TYPES.find(t => t.id === s.type)?.label ?? s.type;
        const items = s.items.filter(i => i.trim()).map(i => `- ${i}`).join("\n");
        return items ? `${label}\n${items}` : "";
      }).filter(Boolean),
    ].filter(l => l !== undefined);
    return lines.join("\n");
  }

  // 음성 파일 Whisper 변환
  async function transcribeFiles(files: File[]): Promise<string> {
    const texts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setTranscribeProgress(`음성 변환 중 (${i + 1}/${files.length}) — ${files[i].name}`);
      const form = new FormData();
      form.append("file", files[i]);
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST", body: form,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) texts.push(data.text);
          else texts.push(`[${files[i].name} 변환 실패]`);
        } else {
          texts.push(`[${files[i].name} 변환 실패]`);
        }
      } catch { texts.push(`[${files[i].name} 변환 오류]`); }
    }
    setTranscribeProgress("");
    return texts.join("\n\n");
  }

  async function analyze() {
    setStep("analyzing");
    try {
      // 음성 변환
      let audioText = "";
      if (audioFiles.length > 0) {
        setTranscribing(true);
        audioText = await transcribeFiles(audioFiles);
        setTranscribing(false);
      }

      // 회의록 텍스트 구성
      const meetingText = buildTextSummary();

      // AI 분석
      const res = await fetch("/api/analyze-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: meetingText,
          audioText: audioText || undefined,
          projectId: selectedProject,
          meetingMeta: { title, date: meetingDate, attendees: attendees.map(a => a.name) },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const r = {
        ...data,
        tasks: (data.tasks ?? []).map((t: any) => ({ ...t, selected: true, projectId: selectedProject || "" })),
        _meetingTitle: title,
        _meetingDate: meetingDate,
      };
      setResult(r);
      await autoSave(r);
      setStep("review");
    } catch (e: any) {
      alert("분석 실패: " + e.message);
      setStep("write");
    }
  }

  async function applyTasks() {
    if (!result) return;
    setApplying(true);
    const selectedTasks = (result.tasks ?? []).filter((t: any) => t.selected);
    let count = 0;
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
          status: "todo", due_date: task.due_date ?? null,
          assignee_id: task.assignee_id ?? null, assignee_ids: task.assignee_ids ?? [],
        });
        if (!error) count++;
      }
    }
    if (draftId) await supabase.from("meeting_drafts").update({ status: "completed" }).eq("id", draftId);
    setResult((r: any) => ({ ...r, _applied: count }));
    setStep("done");
    setApplying(false);
  }

  function addAttendee(name: string) {
    if (!name.trim()) return;
    if (attendees.some(a => a.name === name)) return;
    setAttendees(prev => [...prev, { name: name.trim() }]);
    setAttendeeInput("");
  }

  function addSection(type: string) {
    setSections(prev => [...prev, { id: `s${Date.now()}`, type, items: [""] }]);
  }

  function updateSectionItem(sectionId: string, idx: number, value: string) {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: s.items.map((item, i) => i === idx ? value : item) }
      : s
    ));
  }

  function addSectionItem(sectionId: string) {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: [...s.items, ""] }
      : s
    ));
  }

  function removeSectionItem(sectionId: string, idx: number) {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: s.items.filter((_, i) => i !== idx) }
      : s
    ));
  }

  function removeSection(sectionId: string) {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }

  function openHistoryItem(h: any) {
    setDraftId(h.id);
    setView("main");

    // input_text에서 기본 정보 파싱
    const text = h.input_text ?? "";
    const lines = text.split(String.fromCharCode(10));

    const titleLine = lines.find((l: string) => l.startsWith("회의명:"));
    const dateLine  = lines.find((l: string) => l.startsWith("일시:"));
    const locLine   = lines.find((l: string) => l.startsWith("장소:"));
    const attLine   = lines.find((l: string) => l.startsWith("참석자:"));

    if (titleLine) setTitle(titleLine.replace("회의명:", "").trim());
    if (locLine)   setLocation(locLine.replace("장소:", "").trim());
    if (h.project_id) setSelectedProject(h.project_id);

    if (dateLine) {
      const dateStr = dateLine.replace("일시:", "").trim();
      const datePart = dateStr.split(" ")[0];
      const timePart = dateStr.split(" ")[1];
      if (datePart) setMeetingDate(datePart);
      if (timePart) setStartTime(timePart);
    }

    if (attLine) {
      const names = attLine.replace("참석자:", "").trim().split(",").map((n: string) => n.trim()).filter(Boolean);
      setAttendees(names.map((name: string) => ({ name })));
    }

    // 섹션 파싱
    const newSections: any[] = [];
    let currentSection: any = null;
    const sectionMarkers: Record<string, string> = {
      "📌 안건": "agenda",
      "✅ 결정사항": "decision",
      "⚠ 이슈": "issue",
      "📝 기타 메모": "note",
    };

    for (const line of lines) {
      const sType = sectionMarkers[line.trim()];
      if (sType) {
        if (currentSection) newSections.push(currentSection);
        currentSection = { id: `s${Date.now()}_${sType}`, type: sType, items: [] };
      } else if (currentSection && line.startsWith("- ")) {
        currentSection.items.push(line.replace(/^- /, "").trim());
      }
    }
    if (currentSection) newSections.push(currentSection);

    if (newSections.length > 0) {
      // 빈 항목 보완
      setSections(newSections.map(s => ({ ...s, items: s.items.length > 0 ? s.items : [""] })));
    } else {
      setSections([{ id: "s1", type: "note", items: [text] }]);
    }

    // 분석 결과가 있으면 result도 세팅
    if (h.result?.summary) {
      setResult({ ...h.result, tasks: (h.result.tasks ?? []).map((t: any) => ({ ...t, selected: true, projectId: t.projectId || h.project_id || "" })) });
    }

    setLastSaved(new Date(h.updated_at));
  }

  function resetAll() {
    setStep("write"); setResult(null); setDraftId(null); setLastSaved(null);
    setTitle(""); setMeetingDate(new Date().toISOString().slice(0, 10));
    setStartTime(""); setEndTime(""); setLocation(""); setSelectedProject("");
    setAttendees([]); setAudioFiles([]);
    setSections([{ id: "s1", type: "agenda", items: [""] }, { id: "s2", type: "decision", items: [""] }]);
  }

  // ─── 완료 화면 ───
  if (step === "done") return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>업무가 등록됐습니다!</p>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>{result?._applied}건이 처리됐습니다</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => router.push("/tasks")}
          style={{ padding: "10px 20px", background: "var(--cyan)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          업무 목록 보기 →
        </button>
        <button onClick={resetAll}
          style={{ padding: "10px 20px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          새 회의록 작성
        </button>
      </div>
    </div>
  );

  // ─── 분석 중 ───
  if (step === "analyzing") return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid var(--cyan)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
        {transcribeProgress || "회의 내용을 AI가 분석 중입니다…"}
      </p>
      {audioFiles.length > 0 && !transcribeProgress && (
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>음성 파일 {audioFiles.length}개 + 회의록을 교차 분석합니다</p>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── 검토 화면 ───
  if (step === "review" && result) return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setStep("write")} style={{ fontSize: 12, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>← 수정하기</button>
        <span style={{ color: "var(--border)" }}>|</span>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>분석 결과 검토</h1>
        {lastSaved && <p style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>🕐 {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 저장됨</p>}
      </div>

      {/* 회의 요약 */}
      <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#7C3AED", marginBottom: 8 }}>
          {result._meetingTitle || "회의"} · {result._meetingDate}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
        {result.participants?.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, marginBottom: 0 }}>참석자: {result.participants.join(", ")}</p>
        )}
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
            등록할 업무 ({result.tasks?.filter((t: any) => t.selected).length ?? 0}/{result.tasks?.length ?? 0})
          </p>
          <button onClick={() => setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any) => ({ ...t, selected: true })) }))}
            style={{ fontSize: 11, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer" }}>
            전체 선택
          </button>
        </div>
        {(result.tasks ?? []).map((task: any, i: number) => (
          <div key={i} style={{ padding: "12px 16px", background: task.selected ? "#EEF3FF" : "var(--bg-2)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div onClick={() => setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any, j: number) => j === i ? { ...t, selected: !t.selected } : t) }))}
                style={{ marginTop: 2, width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: task.selected ? "var(--cyan)" : "var(--bg-3)", border: `1px solid ${task.selected ? "var(--cyan)" : "var(--border)"}` }}>
                {task.selected && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: PC[task.priority] ?? "#A8A8A4" }}>{PL[task.priority] ?? task.priority}</span>
                </div>
                <select value={task.projectId ?? ""} onChange={e => setResult((r: any) => ({ ...r, tasks: r.tasks.map((t: any, j: number) => j === i ? { ...t, projectId: e.target.value } : t) }))}
                  style={{ ...FS, fontSize: 12, marginBottom: 6, width: "100%" }}>
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

      {result.issues?.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#D97706", marginBottom: 8 }}>주요 이슈</p>
          {result.issues.map((issue: string, i: number) => (
            <p key={i} style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 4px" }}>· {issue}</p>
          ))}
        </div>
      )}

      <button onClick={applyTasks} disabled={applying || !result.tasks?.some((t: any) => t.selected)}
        style={{ padding: "12px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: applying || !result.tasks?.some((t: any) => t.selected) ? 0.4 : 1 }}>
        {applying ? "등록 중…" : `선택한 업무 ${result.tasks?.filter((t: any) => t.selected).length ?? 0}건 등록하기`}
      </button>
    </div>
  );

  // ─── 메인: 회의록 작성 ───
  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 18, background: "#D97706", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>회의 기록</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastSaved && <p style={{ fontSize: 11, color: "var(--text-3)" }}>🕐 {lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 자동저장</p>}
          <button onClick={() => setView("history")}
            style={{ padding: "6px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
            📋 이전 기록
          </button>
        </div>
      </div>

      {/* ① 기본 정보 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>📋 기본 정보</p>

        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="회의명 (예: 6월 주간 업무 회의)"
          style={{ ...FS, fontSize: 14, fontWeight: 500 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>날짜</label>
            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={FS} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>시작</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={FS} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>종료</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={FS} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>장소 (선택)</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 2층 회의실" style={FS} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>프로젝트 (선택)</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={FS}>
              <option value="">프로젝트 없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* 참석자 */}
        <div>
          <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 6 }}>참석자</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {attendees.map((a, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: "#EEF3FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                {a.name}
                <button onClick={() => setAttendees(prev => prev.filter((_, j) => j !== i))}
                  style={{ fontSize: 10, color: "#2563EB", background: "transparent", border: "none", cursor: "pointer", opacity: 0.6 }}>✕</button>
              </span>
            ))}
          </div>
          {/* 팀원 선택 */}
          <div style={{ display: "flex", gap: 8 }}>
            <select onChange={e => { if (e.target.value) { addAttendee(e.target.value); e.target.value = ""; } }}
              style={{ ...FS, flex: 1 }} defaultValue="">
              <option value="">팀원 선택...</option>
              {teamMembers.filter(m => !attendees.some(a => a.name === m.name)).map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <input value={attendeeInput} onChange={e => setAttendeeInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addAttendee(attendeeInput); }}
              placeholder="외부 참석자 직접 입력 후 Enter"
              style={{ ...FS, flex: 1 }} />
          </div>
        </div>
      </div>

      {/* ② 회의 내용 섹션 */}
      {sections.map((section, si) => {
        const sType = SECTION_TYPES.find(t => t.id === section.type);
        return (
          <div key={section.id} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{sType?.label ?? section.type}</p>
              <button onClick={() => removeSection(section.id)}
                style={{ fontSize: 11, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕ 섹션 삭제</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.items.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-3)", flexShrink: 0 }}>{idx + 1}.</span>
                  <input value={item}
                    onChange={e => updateSectionItem(section.id, idx, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addSectionItem(section.id); }}
                    placeholder={`${sType?.label ?? ""} 입력 후 Enter로 추가`}
                    style={{ ...FS, flex: 1 }} />
                  {section.items.length > 1 && (
                    <button onClick={() => removeSectionItem(section.id, idx)}
                      style={{ fontSize: 12, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => addSectionItem(section.id)}
                style={{ fontSize: 12, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                + 항목 추가
              </button>
            </div>
          </div>
        );
      })}

      {/* 섹션 추가 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SECTION_TYPES.filter(t => !sections.some(s => s.type === t.id)).map(t => (
          <button key={t.id} onClick={() => addSection(t.id)}
            style={{ padding: "6px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
            + {t.label}
          </button>
        ))}
      </div>

      {/* ③ 음성 녹음 / 파일 업로드 */}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>🎵 음성 (선택)</p>
          {/* 업로드 / 녹음 탭 */}
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
            {[{ id: "upload", label: "파일 업로드" }, { id: "record", label: "🎙 녹음" }].map(t => (
              <button key={t.id} onClick={() => setAudioTab(t.id as any)}
                style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: audioTab === t.id ? "var(--bg-2)" : "transparent", color: audioTab === t.id ? "var(--text-1)" : "var(--text-3)" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 파일 업로드 탭 */}
        {audioTab === "upload" && (
          <>
            <input ref={fileRef} type="file" accept="audio/*,.mp3,.mp4,.wav,.m4a,.webm" multiple
              onChange={e => {
                if (e.target.files) setAudioFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = "";
              }}
              style={{ display: "none" }} />
            {audioFiles.filter(f => !f.name.startsWith("녹음_")).length === 0 ? (
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: "28px 0", textAlign: "center", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--cyan)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}>
                <p style={{ fontSize: 22, margin: "0 0 8px" }}>🎵</p>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 4px", fontWeight: 500 }}>클릭해서 파일 선택</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>mp3, mp4, wav, m4a, webm · 여러 파일 동시 가능</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {audioFiles.filter(f => !f.name.startsWith("녹음_")).map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <span style={{ fontSize: 16 }}>🎵</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => setAudioFiles(prev => prev.filter(x => x !== f))}
                      style={{ fontSize: 12, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  style={{ fontSize: 12, color: "var(--cyan)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                  + 파일 더 추가
                </button>
              </div>
            )}
          </>
        )}

        {/* 녹음 탭 */}
        {audioTab === "record" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            {!recording ? (
              <div>
                <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>10분마다 자동 분할 저장됩니다</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>시간 제한 없이 녹음 가능</p>
                {audioFiles.filter(f => f.name.startsWith("녹음_")).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>녹음된 파일 ({audioFiles.filter(f => f.name.startsWith("녹음_")).length}개)</p>
                    {audioFiles.filter(f => f.name.startsWith("녹음_")).map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 4, textAlign: "left" }}>
                        <span style={{ fontSize: 14 }}>🎙</span>
                        <p style={{ fontSize: 12, color: "var(--text-1)", margin: 0, flex: 1 }}>{f.name}</p>
                        <button onClick={() => setAudioFiles(prev => prev.filter(x => x !== f))}
                          style={{ fontSize: 11, color: "#DC2626", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={startRecording}
                  style={{ padding: "10px 28px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>
                  🔴 녹음 시작
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#DC2626", animation: "pulse 1s infinite" }} />
                  <p style={{ fontSize: 28, fontWeight: 700, color: "#DC2626", fontVariantNumeric: "tabular-nums", margin: 0 }}>{fmtTime(recordTime)}</p>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>녹음 중 · 10분마다 자동 분할</p>
                <button onClick={stopRecording}
                  style={{ padding: "10px 28px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" }}>
                  ⏹ 녹음 중지
                </button>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
              </div>
            )}
          </div>
        )}

        {audioFiles.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12, marginBottom: 0 }}>
            💡 음성 파일은 Whisper로 자동 변환되어 회의록과 교차 분석됩니다
          </p>
        )}
      </div>

      {/* 분석 시작 버튼 */}
      <button onClick={analyze}
        disabled={!title.trim() && sections.every(s => s.items.every(i => !i.trim())) && audioFiles.length === 0}
        style={{ padding: "13px 0", background: "var(--cyan)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !title.trim() && sections.every(s => s.items.every(i => !i.trim())) && audioFiles.length === 0 ? 0.4 : 1 }}>
        ✦ AI 분석 시작 {audioFiles.length > 0 ? `(음성 ${audioFiles.length}개 + 회의록)` : "(회의록 기반)"}
      </button>

      {/* 이전 기록 뷰 */}
      {view === "history" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setView("main")}>
          <div style={{ width: "100%", maxWidth: 720, maxHeight: "80vh", background: "var(--bg-2)", borderRadius: "14px 14px 0 0", padding: 24, overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>이전 기록</h2>
              <button onClick={() => setView("main")} style={{ fontSize: 18, color: "var(--text-3)", background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            {historyLoading ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>불러오는 중…</p>
            ) : history.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>저장된 기록이 없습니다</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map(h => {
                  const isMyRecord = h.user_id === myUser?.userId;
                  const hasResult = h.result && (h.result.summary || h.result.tasks?.length > 0);
                  return (
                    <div key={h.id} style={{ padding: "14px 16px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 배지 행 */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 20, fontWeight: 600, background: h.status === "completed" ? "#F0FDF4" : "#F5F3FF", color: h.status === "completed" ? "#16A34A" : "#7C3AED", border: `1px solid ${h.status === "completed" ? "#BBF7D0" : "#DDD6FE"}` }}>
                              {h.status === "completed" ? "✓ 완료" : "미완료"}
                            </span>
                            {h.author?.name && !isMyRecord && (
                              <span style={{ fontSize: 11, color: "var(--cyan)", fontWeight: 500 }}>👤 {h.author.name}</span>
                            )}
                            {h.project?.name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>📁 {h.project.name}</span>}
                            <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                              {new Date(h.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {/* 요약 */}
                          {h.result?.summary && (
                            <p style={{ fontSize: 12, color: "var(--text-1)", margin: "0 0 4px", fontWeight: 500 }}>{h.result.summary}</p>
                          )}
                          {/* 업무 수 */}
                          {h.result?.tasks?.length > 0 && (
                            <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                              업무 {h.result.tasks.length}건
                              {h.result.decisions?.length > 0 && ` · 결정사항 ${h.result.decisions.length}건`}
                            </p>
                          )}
                          {/* 결과 없으면 텍스트 미리보기 */}
                          {!hasResult && h.input_text && (
                            <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {h.input_text.slice(0, 80)}
                            </p>
                          )}
                        </div>
                        {/* 버튼 */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          {/* 분석 결과가 있으면 결과 보기 */}
                          {hasResult && (
                            <button onClick={() => {
                              setResult({ ...h.result, tasks: (h.result.tasks ?? []).map((t: any) => ({ ...t, selected: true, projectId: t.projectId || h.project_id || "" })) });
                              setDraftId(h.id);
                              setStep("review");
                              setView("main");
                            }}
                              style={{ padding: "6px 12px", background: "#EEF3FF", border: "1px solid #BFDBFE", borderRadius: 7, fontSize: 12, color: "var(--cyan)", fontWeight: 500, cursor: "pointer" }}>
                              결과 보기
                            </button>
                          )}
                          {/* 내용 열기/수정 - 항상 표시 */}
                          <button onClick={() => openHistoryItem(h)}
                            style={{ padding: "6px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                            {isMyRecord ? "수정" : "열기"}
                          </button>
                          {isMyRecord && (
                            <button onClick={async () => { if (!confirm("삭제할까요?")) return; await supabase.from("meeting_drafts").delete().eq("id", h.id); loadHistory(); }}
                              style={{ padding: "6px 10px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 7, fontSize: 11, color: "#DC2626", cursor: "pointer" }}>
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

