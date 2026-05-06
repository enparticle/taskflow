// @ts-nocheck
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import type { TaskStatus } from "@/types/database";

const statuses: { value: TaskStatus; label: string; color: string }[] = [
  { value: "backlog",  label: "백로그",  color: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
  { value: "todo",     label: "할 일",   color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  { value: "doing",    label: "진행 중", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { value: "blocked",  label: "Blocked", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { value: "review",   label: "리뷰",    color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  { value: "done",     label: "완료",    color: "bg-green-100 text-green-700 hover:bg-green-200" },
];

interface Props {
  taskId: string;
  currentStatus: TaskStatus;
}

export default function StatusChanger({ taskId, currentStatus }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [showBlockedInput, setShowBlockedInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const current = statuses.find((s) => s.value === currentStatus)!;

  async function changeStatus(newStatus: TaskStatus, reason?: string) {
    setLoading(true);

    await supabase
      .from("tasks")
      .update({
        status: newStatus,
        blocked_reason: newStatus === "blocked" ? (reason ?? null) : null,
      })
      .eq("id", taskId);

    setLoading(false);
    setOpen(false);
    setShowBlockedInput(false);
    setBlockedReason("");
    window.location.reload();
  }

  function handleSelect(status: TaskStatus) {
    if (status === "blocked") {
      setShowBlockedInput(true);
      return;
    }
    changeStatus(status);
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${current.color}`}
      >
        {loading ? "..." : current.label} ▾
      </button>

      {open && !showBlockedInput && (
        <div className="absolute left-0 top-7 z-10 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => handleSelect(s.value)}
              className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                s.value === currentStatus ? "bg-gray-50 font-bold" : "hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="block w-full border-t px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      )}

      {showBlockedInput && (
        <div className="absolute left-0 top-7 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-700">Blocked 사유 *</p>
          <textarea
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            placeholder="왜 막혔는지 입력하세요"
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none resize-none"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => changeStatus("blocked", blockedReason)}
              disabled={!blockedReason.trim()}
              className="flex-1 rounded bg-red-600 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              확인
            </button>
            <button
              onClick={() => { setShowBlockedInput(false); setOpen(false); }}
              className="flex-1 rounded border border-gray-300 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
