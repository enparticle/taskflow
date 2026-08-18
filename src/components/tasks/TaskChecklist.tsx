// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export default function TaskChecklist({ taskId, assigneeIds }: { taskId: string; assigneeIds?: string[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState("");
  const [myUser, setMyUser] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("task_checklist_items")
      .select("*, checked_by_user:users!task_checklist_items_checked_by_fkey(name), created_by_user:users!task_checklist_items_created_by_fkey(name)")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(data ?? []);
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

  async function addItem() {
    if (!newItem.trim() || !myUser) return;
    setAdding(true);
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;
    await supabase.from("task_checklist_items").insert({
      task_id: taskId, content: newItem.trim(), created_by: myUser.id, sort_order: maxOrder + 1,
    });
    setNewItem("");
    setAdding(false);
    await load();
  }

  async function toggleItem(item: any) {
    const willCheck = !item.is_checked;
    await supabase.from("task_checklist_items").update({
      is_checked: willCheck,
      checked_by: willCheck ? myUser?.id : null,
      checked_at: willCheck ? new Date().toISOString() : null,
    }).eq("id", item.id);
    await load();

    // 다른 공동 담당자들에게 알림 (본인 제외)
    if (willCheck && assigneeIds && assigneeIds.length > 1) {
      const others = assigneeIds.filter(id => id !== myUser?.id);
      for (const uid of others) {
        await createNotification({
          userId: uid, type: "mention",
          title: "체크리스트 항목이 완료됐어요",
          body: `${myUser?.name ?? "누군가"}님이 "${item.content}"를 체크했어요`,
        });
      }
    }
  }

  async function deleteItem(id: string) {
    await supabase.from("task_checklist_items").delete().eq("id", id);
    await load();
  }

  const doneCount = items.filter(i => i.is_checked).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
          체크리스트 {items.length > 0 && `${doneCount}/${items.length}`}
        </p>
        {assigneeIds && assigneeIds.length > 1 && (
          <p className="text-xs" style={{ color: "var(--text-3)" }}>👥 공동 담당 — 누가 체크했는지 표시돼요</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-4)" }}>
          <div style={{ height: "100%", width: `${items.length ? (doneCount / items.length) * 100 : 0}%`, background: "var(--cyan)", transition: "width 0.2s" }} />
        </div>
      )}

      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={item.is_checked} onChange={() => toggleItem(item)}
              style={{ width: 15, height: 15, accentColor: "var(--cyan)", cursor: "pointer", flexShrink: 0 }} />
            <span className="text-xs flex-1" style={{ color: item.is_checked ? "var(--text-3)" : "var(--text-1)", textDecoration: item.is_checked ? "line-through" : "none" }}>
              {item.content}
            </span>
            {item.is_checked && item.checked_by_user?.name && (
              <span className="text-xs" style={{ color: "var(--text-3)", fontSize: 10 }}>{item.checked_by_user.name}</span>
            )}
            {(myUser?.id === item.created_by || myUser?.role === "admin") && (
              <button onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                style={{ color: "var(--red)" }}>✕</button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-center py-2" style={{ color: "var(--text-3)" }}>체크리스트 항목이 없어요</p>
        )}
      </div>

      <div className="flex gap-2 items-center pt-1">
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addItem(); }}
          placeholder="항목 추가 후 Enter"
          className="flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", color: "var(--text-1)" }} />
        <button onClick={addItem} disabled={adding || !newItem.trim()}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ background: "var(--cyan-bg)", color: "var(--cyan)", border: "1px solid var(--cyan)33" }}>
          추가
        </button>
      </div>
    </div>
  );
}
