// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAuthedClient } from "@/lib/supabaseServer";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 프로젝트별 마일스톤 카테고리 템플릿 (오늘 대화로 정한 구조)
const MILESTONE_TEMPLATES: Record<string, { categories: string[]; note?: string }> = {
  "enCELL-Pharm 개발": {
    categories: ["하드웨어 — 가압기구", "하드웨어 — 탱크/LCD/히팅패드", "소프트웨어 — 임베디드 + UI", "원료/제조 공정", "외주 협업 관리", "출시/고객 대응"],
  },
  "enCELL-Master 관리 및 개발": {
    categories: ["제작/조립", "품질/소음 검증", "인증/서류", "재고 관리", "고객/AS 대응", "외주 협업"],
  },
  "압력-유량 예측 시스템": {
    categories: ["데이터/전처리", "물리 모델 개발", "보정/ML 모델 개발", "검증/평가", "서비스화", "UI/문서화 + 확장"],
  },
  "연속생산설비구축": {
    categories: ["운영/업그레이드"],
    note: "구축 단계는 이미 완료됨 — 완료 확인만 가볍게 하고, 운영/업그레이드 단계를 중점적으로 물어보세요.",
  },
  "장비개발실 관리": {
    categories: ["정기 청소", "설비/비품 구매", "공간 관리"],
  },
  "실시간 업무 모니터링 시스템 운용 및 관리 1차": {
    categories: ["운용 1차"],
    note: "구축 단계(별도 프로젝트)는 이미 완료됨 — 운용 1차 단계만 물어보세요.",
  },
};

function buildSystemPrompt(projectName: string, members: { name: string; role: string }[]) {
  const template = MILESTONE_TEMPLATES[projectName];
  const categories = template?.categories ?? [];
  const note = template?.note ?? "";
  const memberList = members.map(m => `${m.name}(${m.role === "leader" ? "리더" : m.role === "reviewer" ? "리뷰어" : "멤버"})`).join(", ");

  return `당신은 "${projectName}" 프로젝트의 마일스톤/업무를 정리하는 걸 도와주는 AI입니다.
프로젝트 리더와 대화하면서, 아래 마일스톤 카테고리들을 하나씩 짚어가며 정보를 모으세요.
${note}

이 프로젝트 구성원: ${memberList}

각 마일스톤 카테고리마다 이렇게 물어보세요:
1. 담당자 — 위 구성원 중 누구인지 (여러 명일 수 있음)
2. 마감일 또는 목표 시점 — 구체적 날짜가 없으면 "이번 분기", "다음달 말" 같은 대략적인 것도 괜찮음, AI가 적절한 날짜로 변환
3. 세부 업무 — 이 카테고리 안에서 실제로 해야 할 구체적인 일들을 2~6개 정도. 리더가 편하게 나열하면 됨

카테고리 목록:
${categories.map((c, i) => `${i + 1}. ${c}`).join("\n")}

대화 규칙:
- 한 번에 여러 카테고리를 몰아서 묻지 말고, 하나씩 자연스럽게 진행하세요
- 리더가 "잘 모르겠다", "나중에" 라고 하면 그 카테고리는 담당자/마감일 없이 넘어가고 다음으로 진행하세요
- 담당자는 반드시 위 구성원 목록에 있는 이름 중에서만 매칭하세요(없는 이름이면 다시 확인)
- 모든 카테고리를 다 물어보면 전체 요약을 보여주고 확인 요청("이대로 등록할까요?") 후, 확인되면 아래 JSON으로 응답하세요

확인 완료 시 응답 형식 (반드시 이 마커 사용):
RESULT_JSON
{
  "milestones": [
    {
      "title": "마일스톤 카테고리명",
      "assignee_names": ["이름1", "이름2"],
      "due_date": "YYYY-MM-DD 또는 null",
      "tasks": [
        { "title": "세부 업무명", "priority": "urgent|high|medium|low" }
      ]
    }
  ]
}
END_JSON`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAuthedClient(req);
    const { messages, chatId, projectId, projectName, members } = await req.json();

    const systemPrompt = buildSystemPrompt(projectName, members ?? []);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const assistantMsg = response.content[0].type === "text" ? response.content[0].text : "";

    let result = null;
    if (assistantMsg.includes("RESULT_JSON")) {
      const match = assistantMsg.match(/RESULT_JSON\s*(\{[\s\S]*?\})\s*END_JSON/);
      if (match) {
        try { result = JSON.parse(match[1]); } catch {}
      }
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    let me: any = null;
    if (authUser) {
      const { data } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
      me = data;
    }

    // 확정되면 실제로 마일스톤 + 업무 등록
    if (result?.milestones && me) {
      const { data: memberRows } = await supabase.from("users").select("id, name");
      const nameToId: Record<string, string> = {};
      (memberRows ?? []).forEach((u: any) => { nameToId[u.name] = u.id; });

      for (let i = 0; i < result.milestones.length; i++) {
        const ms = result.milestones[i];
        const assigneeIds = (ms.assignee_names ?? []).map((n: string) => nameToId[n]).filter(Boolean);

        const { data: createdMs } = await supabase.from("milestones").insert({
          title: ms.title,
          project_id: projectId,
          due_date: ms.due_date || null,
          status: "planned",
          sort_order: i,
        }).select("id").single();

        if (createdMs) {
          for (const t of ms.tasks ?? []) {
            await supabase.from("tasks").insert({
              title: t.title,
              project_id: projectId,
              milestone_id: createdMs.id,
              priority: t.priority ?? "medium",
              status: "todo",
              due_date: ms.due_date || null,
              assignee_id: assigneeIds[0] ?? null,
              assignee_ids: assigneeIds,
            });
          }
        }
      }
    }

    // 대화 기록 저장
    const updatedMessages = [...messages, { role: "assistant", content: assistantMsg }];
    let newChatId = chatId;
    if (me) {
      if (chatId) {
        await supabase.from("milestone_chats").update({
          messages: updatedMessages, result,
          status: result ? "completed" : "ongoing",
          updated_at: new Date().toISOString(),
        }).eq("id", chatId);
      } else {
        const { data: created } = await supabase.from("milestone_chats").insert({
          project_id: projectId, user_id: me.id,
          messages: updatedMessages, result,
          status: result ? "completed" : "ongoing",
        }).select("id").single();
        newChatId = created?.id ?? null;
      }
    }

    const displayMsg = assistantMsg.split("RESULT_JSON")[0].trim();
    return NextResponse.json({ message: displayMsg || "마일스톤과 업무가 등록됐어요! ✓", result, chatId: newChatId });
  } catch (err: any) {
    console.error("milestone-chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
