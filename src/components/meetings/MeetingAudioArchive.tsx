"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { MEETING_AUDIO_BUCKET } from "@/lib/meetingAudio";

export interface RecordingUpload {
  path: string;
  meetingId: string;
  file: File;
  status: "uploading" | "saved" | "failed";
  error?: string;
}

export function downloadLocalRecording(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MeetingAudioArchive({ meetingId, uploads, retry }: {
  meetingId: string | null;
  uploads: RecordingUpload[];
  retry: (item: RecordingUpload) => void;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<{ name: string; url: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const savedCount = uploads.filter(u => u.status === "saved").length;
  const currentUploads = uploads.filter(u => u.meetingId === meetingId);

  useEffect(() => {
    let cancelled = false;
    setFiles([]); setPlaying(null); setError("");
    if (!meetingId) return;
    setLoading(true);
    (async () => {
      try {
        const all: any[] = [];
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await createClient().storage.from(MEETING_AUDIO_BUCKET)
            .list(meetingId, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw error;
          all.push(...(data ?? []).filter((f: any) => f.id));
          if (!data || data.length < 100) break;
        }
        if (!cancelled) setFiles(all);
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [meetingId, savedCount, refresh]);

  async function openFile(name: string, download: boolean) {
    try {
      setError("");
      const { data, error } = await createClient().storage.from(MEETING_AUDIO_BUCKET)
        .createSignedUrl(`${meetingId}/${name}`, 3600, download ? { download: name } : undefined);
      if (error) throw error;
      if (download) {
        const link = document.createElement("a"); link.href = data.signedUrl;
        link.rel = "noopener"; link.click();
      } else setPlaying({ name, url: data.signedUrl });
    } catch (e: any) { setError(e.message); }
  }

  return <section style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, textAlign: "left" }}>
    <strong style={{ fontSize: 13 }}>회의 녹음 보관함</strong>
    <p style={{ fontSize: 12, color: "var(--text-3)" }}>녹음은 10분마다, 중지 시 비공개로 저장됩니다. 작성자·관리자·리더만 재생할 수 있습니다.</p>
    {currentUploads.filter(u => u.status !== "saved").map(u => <div key={u.path} style={{ marginBottom: 8 }}>
      <span>{u.file.name} · {u.status === "uploading" ? "저장 중…" : "저장 실패"}</span>
      {u.error && <p role="alert">{u.error}</p>}
      {u.status === "failed" && <button onClick={() => retry(u)}>저장 재시도</button>}
      <button onClick={() => downloadLocalRecording(u.file)}>PC에 원본 저장</button>
    </div>)}
    {error && <p role="alert">보관함 오류: {error}</p>}
    {loading && <p>녹음 목록 불러오는 중…</p>}
    {!loading && !error && files.length === 0 && <p style={{ fontSize: 12 }}>서버에 저장된 녹음이 없습니다.</p>}
    {files.map(f => <div key={f.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 12 }}>{f.name} · {(Number(f.metadata?.size ?? 0) / 1024 / 1024).toFixed(1)}MB</span>
      <button onClick={() => openFile(f.name, false)}>재생</button>
      <button onClick={() => openFile(f.name, true)}>다운로드</button>
    </div>)}
    {playing && <div><p>{playing.name}</p><audio key={playing.url} src={playing.url} controls autoPlay onError={() => setError("재생 링크가 만료됐거나 파일을 읽을 수 없습니다. 재생을 다시 눌러 주세요.")} /></div>}
    {meetingId && <button onClick={() => setRefresh(n => n + 1)} style={{ marginTop: 8 }}>목록 새로고침</button>}
  </section>;
}
