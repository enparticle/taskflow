import { createServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("tasks update error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
