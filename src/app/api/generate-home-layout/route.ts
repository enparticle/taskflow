// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAuthedClient } from "@/lib/supabaseServer";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ⚠️ 안전장치의 핵심 — AI는 이 목록에 있는 블록만 골라 쓸 수 있음. 새 블록은 여기 추가해야만 등장 가능.
const AVAILABLE_BLOCKS = [
  { key: "today", label: "오늘 할 일", desc: "실제 마감 임박/오늘 처리해야 할 업무 목록" },
  { key: "recent", label: "최근 기록", desc: "오늘 한 일을 입력하는 기록창 + 최근 기록 목록" },
  { key: "summary", label: "주간 요약", desc: "완료/진행중/Blocked 건수 요약" },
  { key: "calendar", label: "캘린더 미리보기", desc: "이번 주 일정" },
];
const VALID_KEYS = AVAILABLE_BLOCKS.map(b => b.key);
const VALID_SIZES = ["compact", "expanded"];

function buildSystemPrompt() {
  return `당신은 이 사람만의 홈 화면을 구성하는 AI입니다. 절대 새로운 블록을 만들어내지 마세요 — 아래 블록 중에서만 골라서 순서·크기·제목을 정하세요.

사용 가능한 블록 (이것만 쓸 수 있음):
${AVAILABLE_BLOCKS.map(b => `- ${b.key}: ${b.label} — ${b.desc}`).join("\n")}

규칙:
- 사용자의 설명을 듣고, 위 블록 중 어떤 걸 쓸지, 순서는 어떻게 할지, 크기(compact=간결하게 축약/expanded=자세히 크게)는 어떻게 할지 정하세요
- 필요 없다고 판단되는 블록은 아예 빼도 됩니다(최소 1개는 있어야 함)
- 각 블록에 그 사람 상황에 맞는 커스텀 제목을 지어주세요(예: "오늘 할 일" 대신 "지금 급한 것부터")
- 왜 이렇게 구성했는지 reply에 1~2문장으로 설명하세요

반드시 아래 JSON 형식으로만 응답하세요(다른 텍스트 없이):
{
  "reply": "이렇게 구성한 이유 1~2문장",
  "layout": [
    { "block": "today", "size": "expanded", "title": "지금 급한 것부터" },
    { "block": "summary", "size": "compact", "title": "이번 주 현황" }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAuthedClient(req);
    const { description } = await req.json();
    if (!description || !description.trim()) {
      return NextResponse.json({ error: "설명을 입력해주세요" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: description }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "레이아웃 생성에 실패했어요, 다시 시도해주세요" }, { status: 500 });
    }

    // ⚠️ 안전장치 — AI 응답을 그대로 믿지 않고, 서버에서 다시 한번 검증/필터링
    const safeLayout = (Array.isArray(parsed.layout) ? parsed.layout : [])
      .filter((b: any) => b && VALID_KEYS.includes(b.block))
      .map((b: any) => ({
        block: b.block,
        size: VALID_SIZES.includes(b.size) ? b.size : "expanded",
        title: typeof b.title === "string" ? b.title.slice(0, 30) : undefined, // 제목 길이 제한
      }))
      .slice(0, 8); // 블록 개수 상한

    if (safeLayout.length === 0) {
      return NextResponse.json({ error: "유효한 레이아웃을 만들지 못했어요, 다시 시도해주세요" }, { status: 500 });
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
      if (me) {
        await supabase.from("user_preferences").upsert({
          user_id: me.id,
          home_layout: safeLayout,
          home_layout_prompt: description,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }

    return NextResponse.json({ reply: parsed.reply ?? "", layout: safeLayout });
  } catch (err: any) {
    console.error("generate-home-layout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
