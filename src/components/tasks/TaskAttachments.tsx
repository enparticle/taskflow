// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const MAX_FILE_MB = 20;

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(mime: string) {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("zip") || mime.includes("compressed")) return "🗜";
  return "📄";
}

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const supabase = createClient();
  const [files, setFiles] = useState<any[]>([]);
  const [myUser, setMyUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("task_attachments")
      .select("*, uploader:users!task_attachments_uploaded_by_fkey(name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
  }, [taskId]);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: u } = await supabase.from("users").select("*").eq("auth_id", data.user.id).single();
        setMyUser(u);
      }
    });
  }, [taskId, load]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !myUser) return;
    setError("");
    setUploading(true);
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${file.name}"는 ${MAX_FILE_MB}MB를 넘어서 업로드할 수 없어요`);
        continue;
      }
      const path = `${taskId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("task-attachments").upload(path, file);
      if (uploadErr) {
        setError(`"${file.name}" 업로드 실패: ${uploadErr.message}`);
        continue;
      }
      await supabase.from("task_attachments").insert({
        task_id: taskId, file_name: file.name, file_path: path,
        file_size: file.size, mime_type: file.type, uploaded_by: myUser.id,
      });
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  async function downloadFile(file: any) {
    const { data, error: dlErr } = await supabase.storage.from("task-attachments").createSignedUrl(file.file_path, 60);
    if (dlErr || !data) { setError("파일을 불러올 수 없어요"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteFile(file: any) {
    if (!confirm(`"${file.file_name}"를 삭제할까요?`)) return;
    await supabase.storage.from("task-attachments").remove([file.file_path]);
    await supabase.from("task_attachments").delete().eq("id", file.id);
    await load();
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>첨부파일 {files.length > 0 && `${files.length}개`}</p>

      <div className="space-y-1.5">
        {files.map(f => (
          <div key={f.id} className="flex items-center gap-2 group rounded-lg px-2.5 py-2"
            style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 16 }}>{fileIcon(f.mime_type)}</span>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => downloadFile(f)}>
              <p className="text-xs truncate" style={{ color: "var(--text-1)" }}>{f.file_name}</p>
              <p className="text-xs" style={{ color: "var(--text-3)", fontSize: 10 }}>
                {fmtSize(f.file_size)} · {f.uploader?.name ?? "알 수 없음"} · {fmtTime(f.created_at)}
              </p>
            </div>
            <button onClick={() => downloadFile(f)}
              className="text-xs shrink-0" style={{ color: "var(--cyan)" }}>다운로드</button>
            {(myUser?.id === f.uploaded_by || myUser?.role === "admin") && (
              <button onClick={() => deleteFile(f)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0" style={{ color: "var(--red)" }}>✕</button>
            )}
          </div>
        ))}
        {files.length === 0 && !uploading && (
          <p className="text-xs text-center py-2" style={{ color: "var(--text-3)" }}>첨부된 파일이 없어요</p>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center rounded-lg py-3 text-xs cursor-pointer transition-colors"
        style={{
          border: `1.5px dashed ${dragOver ? "var(--cyan)" : "var(--border-2)"}`,
          background: dragOver ? "var(--cyan-bg)" : "var(--bg-3)",
          color: dragOver ? "var(--cyan)" : "var(--text-3)",
        }}>
        {uploading ? "업로드 중…" : `📎 파일을 끌어놓거나 클릭해서 올리기 (최대 ${MAX_FILE_MB}MB)`}
        <input ref={inputRef} type="file" multiple hidden onChange={e => uploadFiles(e.target.files)} />
      </div>
    </div>
  );
}
