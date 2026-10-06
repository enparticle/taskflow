export const MEETING_AUDIO_BUCKET = "meeting-audio";
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export function recordingPath(meetingId: string, fileId: string, mimeType: string) {
  const extension = mimeType.includes("mp4") ? "m4a" : "webm";
  return `${meetingId}/${fileId}.${extension}`;
}

// Keep the same path for retries. Never overwrite an existing recording.
export async function uploadRecording(client: any, path: string, file: Blob) {
  if (!file.size) throw new Error("빈 녹음파일입니다.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("녹음 조각이 50MB를 초과했습니다. PC에 저장해 보관해 주세요.");
  const bucket = client.storage.from(MEETING_AUDIO_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type.split(";")[0], upsert: false,
  });
  if (!error) return;
  // A previous upload may have succeeded even if its response was lost.
  // Only treat a duplicate-object response as success after reading its metadata.
  if (String(error.statusCode) === "409" || String(error.statusCode) === "400" && /already exists|duplicate/i.test(error.message)) {
    const split = path.lastIndexOf("/");
    const name = path.slice(split + 1);
    const { data, error: readError } = await bucket.list(path.slice(0, split), { search: name });
    if (!readError && data?.some((item: any) => item.name === name && Number(item.metadata?.size) === file.size)) return;
  }
  throw new Error(error.message || "녹음 업로드 실패");
}
