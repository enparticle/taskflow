import { createServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createServerClient();
    const body = await req.json();

    if (body.status === "blocked" && !body.blocked_reason?.trim()) {
      return NextResponse.json({ error: "Blocked 사유를 입력해주세요" }, { status: 400 });
    }

    if (body.status && body.status !== "blocked") {
      body.blocked_reason = null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
