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

function buildSystemPrompt(projectName: string, members: { name: string; role: string }[], projectDescription?: string, existingMilestones?: { title: string; status: string; due_date: string | null }[]) {
  const template = MILESTONE_TEMPLATES[projectName];
  const categories = template?.categories ?? [];
  const note = template?.note ?? "";
  const memberList = members.map(m => `${m.name}(${m.role === "leader" ? "리더" : m.role === "reviewer" ? "리뷰어" : "멤버"})`).join(", ");
  const msList = (existingMilestones ?? []).length > 0
    ? (existingMilestones ?? []).map(m => `- ${m.title} (${m.status}${m.due_date ? ", ~" + m.due_date : ""})`).join("\n")
    : "(아직 없음)";

  return `당신은 "${projectName}" 프로젝트의 마일스톤/업무를 정리하는 걸 도와주는 AI입니다.
오늘 날짜: ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} — "이번달말", "다음주" 같은 상대적 표현은 반드시 이 날짜 기준으로 계산하세요.
프로젝트 설명: ${projectDescription || "(설명 없음)"}
프로젝트 리더와 대화하면서, 아래 마일스톤 카테고리들을 하나씩 짚어가며 정보를 모으세요.
${note}

**이 프로젝트에 이미 등록된 마일스톤 목록(매우 중요, 반드시 확인하세요)**:
${msList}

**마일스톤 명명 규칙 (중요)**: 위 기존 마일스톤이 있다면, 반드시 그 이름 패턴(예: "1단계 · 사용 정착"처럼 번호+단계명 형식)을 그대로 따라서 새 마일스톤 이름을 지으세요. 지금 다루는 카테고리가 기존 마일스톤 중 하나와 내용이 겹친다면, 새로 만들지 말고 그 기존 마일스톤 이름을 그대로 써서 업무만 추가하세요(리더에게 "이거 [기존 마일스톤명]에 들어가는 내용 같은데 맞나요?"라고 확인). 완전히 새로운 내용이면 기존 패턴에 맞춰 다음 번호로 새 이름을 지으세요(예: 기존이 1~3단계면 "4단계 · ...").

**초안 제시 전 확인 (중요)**: 마일스톤 카테고리 이름이 "운용 1차", "구축", "관리"처럼 여러 방향으로 해석될 수 있는 일반적인 이름이면, 프로젝트 설명만으로 뭘 해야 할지 확신이 안 설 수 있습니다. 이럴 때는 바로 초안을 던지지 말고 먼저 가볍게 확인하세요: "이번 [카테고리명]의 핵심 주제나 방향이 있나요?" 이렇게 확인한 답변을 반영해서 초안을 만드세요. 카테고리 이름 자체가 이미 구체적이면(예: "밸브 시스템 구축") 바로 초안을 제시해도 됩니다.

이 프로젝트 구성원: ${memberList}

각 마일스톤 카테고리마다 이렇게 물어보세요:
1. 담당자 — 위 구성원 중 누구인지 (여러 명일 수 있음)
2. 마감일 또는 목표 시점 — 구체적 날짜가 없으면 "이번 분기", "다음달 말" 같은 대략적인 것도 괜찮음, AI가 적절한 날짜로 변환
3. 세부 업무 — 이 카테고리 안에서 실제로 해야 할 구체적인 일들을 2~6개 정도

**세부 업무를 물어볼 때는 절대 "나열해주세요"처럼 빈 질문을 던지지 마세요.** 이게 대화형 인터뷰인 이유는 AI가 먼저 생각해서 초안을 제시하기 때문입니다. 이렇게 진행하세요:
1. 마일스톤 카테고리 이름과 프로젝트 성격(하드웨어 개발/소프트웨어 개발/데이터·ML/인증서류/재고관리/시설운영 등)을 보고, **이 종류의 일에서 보통 나오는 하위 작업들을 먼저 스스로 추론**해서 구체적인 초안을 2~4개 제시하세요.
   - 예: "하드웨어 — 가압기구"라면 → "설계 확정, 부품 발주/외주 견적, 조립, 내구성/누수 테스트 같은 게 있을까요? 지금 어느 단계까지 진행됐어요?"
   - 예: "물리 모델 개발"이라면 → "베이스 모델 설계, 파라미터 튜닝, 검증 데이터셋 준비 같은 걸까요? 지금 어떤 부분이 남았어요?"
   - 예: "인증/서류"라면 → "인증서 양식 작성, 서류 검토·보완, 발급 신청 같은 흐름일까요?"
2. 리더가 이 초안에 "맞아", "이건 아니고", "이것도 추가"처럼 짧게 반응하게 만드세요 — 리더가 처음부터 다 나열하게 시키지 마세요.
3. 리더가 초안과 완전히 다른 이야기를 하면(예: 전혀 다른 작업을 언급) 그걸 우선하고 자연스럽게 반영하세요.
4. 프로젝트 성격을 잘 모르겠으면(카테고리 이름이 애매하면) 그때만 구체적인 질문으로 먼저 상황을 파악한 후 초안을 제시하세요.

**업무 구체화 기준 (중요)**: 업무는 "완료 버튼을 눌렀을 때 명확히 끝났다고 말할 수 있는가"를 기준으로 판단하세요.
- 좋은 예: "PP 소재 매니폴드 검수", "배포 후 피드백 수집" — 언제 끝나는지 명확함
- 안 좋은 예: "시스템 모니터링", "오류 대응", "유지보수" — 끝이 없는 상태/책임 영역이지 완료 가능한 일이 아님
- 리더가 이런 애매한 항목을 말하면, 곧바로 업무로 만들지 말고 되물어보세요. 예: "오류 대응이라고 하셨는데, 지금 구체적으로 예정된 대응 작업이 있나요, 아니면 앞으로 생기면 그때그때 처리하는 느낌인가요?"
  - 지금 구체적인 작업이 없다면: "그럼 이건 지금 미리 업무로 만들지 말고, 실제로 필요해지면 그때 등록하는 게 나을 것 같아요"라고 제안하고 목록에서 빼세요.
  - 구체적인 작업이 있다면(예: "다음 주 배포 전 부하테스트"): 그 구체적인 내용으로 업무를 만드세요.
- "문서화"처럼 대상이 불분명한 것도 마찬가지 — "뭘 문서화하는 거예요?"라고 되물어서 구체화하거나, 불분명하면 빼세요.
- 이 기준을 너무 깐깐하게 적용해서 대화를 늘어지게 하지는 마세요 — 리더가 이미 구체적으로 말한 건 그대로 받아들이고, 애매한 것만 한 번 확인하는 정도로.

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

    const { data: projectRow } = await supabase.from("projects").select("description").eq("id", projectId).maybeSingle();
    const { data: existingMs } = await supabase.from("milestones")
      .select("title, status, due_date").eq("project_id", projectId).neq("status", "cancelled").order("sort_order");
    const systemPrompt = buildSystemPrompt(projectName, members ?? [], projectRow?.description, existingMs ?? []);

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

      // 다음 sort_order 계산용 — 기존 마일스톤 수 뒤에 이어붙임
      const { count: existingCount } = await supabase.from("milestones")
        .select("id", { count: "exact", head: true }).eq("project_id", projectId);
      let nextSortOrder = existingCount ?? 0;

      for (let i = 0; i < result.milestones.length; i++) {
        const ms = result.milestones[i];
        const assigneeIds = (ms.assignee_names ?? []).map((n: string) => nameToId[n]).filter(Boolean);

        // 같은 이름의 마일스톤이 이미 있으면 재사용, 없으면 새로 생성
        const { data: existing } = await supabase.from("milestones")
          .select("id").eq("project_id", projectId).eq("title", ms.title).maybeSingle();

        let msId = existing?.id;
        if (!msId) {
          const { data: createdMs } = await supabase.from("milestones").insert({
            title: ms.title,
            project_id: projectId,
            due_date: ms.due_date || null,
            status: "planned",
            sort_order: nextSortOrder++,
          }).select("id").single();
          msId = createdMs?.id;
        }

        if (msId) {
          for (const t of ms.tasks ?? []) {
            await supabase.from("tasks").insert({
              title: t.title,
              project_id: projectId,
              milestone_id: msId,
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
