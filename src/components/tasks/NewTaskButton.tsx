"use client";
import { useState } from "react";
import TaskForm from "./TaskForm";

interface Props {
  onCreated?: () => void;
}

export default function NewTaskButton({ onCreated }: Props) {
  const [open, setOpen] = useState(false);

  function handleCreated() {
    setOpen(false);
    // 페이지 전체 새로고침으로 목록 반영
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        + 새 업무
      </button>
      {open && (
        <TaskForm
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
