// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 TaskFlow 프로젝트 등록을 도와주는 AI 어시스턴트입니다.
사용자가 진행 중인 프로젝트를 자연스럽게 설명하면, 대화를 통해 정보를 수집하고 구조화된 프로젝트를 만들어줍니다.

대화 규칙:
1. 처음에는 "어떤 프로젝트를 진행하고 계신가요? 편하게 설명해주세요" 로 시작
2. 사용자 답변을 듣고 부족한 정보(마감일, 현재 단계, 주요 목표)를 자연스럽게 질문
3. 정보가 충분히 모이면 정리해서 확인 요청
4. 확인되면 JSON 구조로 결과 반환

정보 수집 목표:
- 프로젝트명 (필수)
- 설명/목적 (필수)
- 현재 진행 단계
- 마감일 (없으면 생략)
- 주요 마일스톤 2~4개
- 초기 업무 목록 3~7개

응답 형식:
- 일반 대화: 텍스트로 응답
- 최종 확인 요청 시: 텍스트로 정리 내용 보여주기
- 사용자가 확인하면: 반드시 아래 JSON 블록으로 시작하는 응답

확인 완료 시 응답 형식:
RESULT_JSON
{
  "project": {
    "name": "프로젝트명",
    "description": "설명",
    "start_date": "YYYY-MM-DD or null",
    "end_date": "YYYY-MM-DD or null",
    "status": "active",
    "health": "good"
  },
  "milestones": [
    { "title": "마일스톤명", "status": "planned", "due_date": "YYYY-MM-DD or null" }
  ],
  "tasks": [
    { "title": "업무명", "task_type": "development|planning|research|qa|operation|documentation|meeting|design|other", "priority": "high|medium|low|urgent", "status": "todo|backlog" }
  ]
}
END_JSON`;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { messages, chatId, userId } = await req.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const assistantMsg = response.content[0].type === "text" ? response.content[0].text : "";

    // RESULT_JSON 감지
    let result = null;
    if (assistantMsg.includes("RESULT_JSON")) {
      const match = assistantMsg.match(/RESULT_JSON\s*(\{[\s\S]*?\})\s*END_JSON/);
      if (match) {
        try { result = JSON.parse(match[1]); } catch {}
      }
    }

    // 대화 저장
    const updatedMessages = [...messages, { role: "assistant", content: assistantMsg }];
    if (chatId) {
      await supabase.from("ai_project_chats").update({
        messages: updatedMessages,
        result,
        status: result ? "completed" : "ongoing",
        updated_at: new Date().toISOString(),
      }).eq("id", chatId);
    } else if (userId) {
      const { data } = await supabase.from("ai_project_chats").insert({
        user_id: userId,
        messages: updatedMessages,
        result,
        status: result ? "completed" : "ongoing",
      }).select().single();
      return NextResponse.json({ message: assistantMsg, result, chatId: data?.id });
    }

    return NextResponse.json({ message: assistantMsg, result, chatId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
