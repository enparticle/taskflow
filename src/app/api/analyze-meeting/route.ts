// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createAuthedClient(req);
    // UTF-8 인코딩 명시적 처리
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const { text, audioText, projectId, meetingMeta } = body;

    // 프로젝트 자동 추론용 — 활성 프로젝트 목록(이름+설명) 조회
    const { data: activeProjects } = await supabase.from("projects").select("name, description").eq("status", "active");
    const projectListText = (activeProjects ?? []).map((p: any) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n");

    // 중복 업무 감지용 — 아직 안 끝난 업무 제목 목록 (프로젝트별)
    const { data: openTasks } = await supabase.from("tasks")
      .select("title, project:projects(name)").not("status", "eq", "done").limit(300);
    const openTaskListText = (openTasks ?? []).map((t: any) => `- [${t.project?.name ?? "미지정"}] ${t.title}`).join("\n");

    const hasBoth = !!(text?.trim() && audioText?.trim());
    const hasAudio = !!audioText?.trim();
    const hasText = !!text?.trim();

    let prompt = "당신은 회의록 분석 전문가입니다. 아래 회의 정보를 분석해서 업무와 결정사항을 추출해주세요.\n\n";

    if (meetingMeta) {
      prompt += `회의 정보:\n`;
      prompt += `- 회의명: ${meetingMeta.title || "미정"}\n`;
      prompt += `- 일시: ${meetingMeta.date || "미정"}\n`;
      prompt += `- 참석자: ${meetingMeta.attendees?.join(", ") || "미정"}\n\n`;
    }

    if (hasText) {
      prompt += `회의록 내용:\n${text}\n\n`;
    }

    if (hasBoth) {
      prompt += `---\n음성 녹음 변환 내용 (위 회의록과 교차 분석해주세요):\n${audioText}\n\n`;
    } else if (hasAudio && !hasText) {
      prompt += `음성 녹음 변환 내용:\n${audioText}\n\n`;
    }

    prompt += `현재 활성 프로젝트 목록:\n${projectListText || "(없음)"}\n\n`;
    prompt += `현재 진행 중인(미완료) 업무 목록 — 중복 등록 방지용:\n${openTaskListText || "(없음)"}\n\n`;

    prompt += `분석 지시사항:\n`;
    if (hasBoth) {
      prompt += `- 회의록과 음성 녹음 두 가지를 교차 분석해서 서로 보완하여 완전한 정보를 추출하세요.\n`;
      prompt += `- 회의록에 담당자가 있고 음성에 마감일이 있으면 합쳐서 하나의 업무로 만드세요.\n`;
    }
    prompt += `- 구체적인 업무 항목을 추출하고 담당자, 마감일, 우선순위를 파악하세요.\n`;
    prompt += `- 결정사항과 이슈를 명확히 구분하세요.\n`;
    prompt += `- 참석자 이름이 언급되면 담당자로 연결하세요.\n`;
    prompt += `- **각 업무마다 위 프로젝트 목록 중 어느 프로젝트에 속하는지 판단해서 project_name에 정확히 그 이름을 넣으세요.** 회의 중 언급된 맥락(장비명, 작업 내용, 프로젝트 설명과의 연관성)으로 판단하세요. 여러 프로젝트에 걸쳐있거나 확신이 안 서면 억지로 끼워맞추지 말고 null로 두세요 — 틀린 프로젝트에 넣는 것보다 미지정이 낫습니다.\n`;
    prompt += `- **위 "진행 중인 업무 목록"에 내용이 겹치는 게 있으면(예: 같은 부품/작업을 계속 언급) 새 업무로 만들지 말고 possible_duplicate_of에 그 기존 업무명을 그대로 적으세요.** 확신 없으면 null로 두세요.\n\n`;

    // 회의록을 올린 사람의 톤/소통 스타일 반영 (summary 문장 스타일에 반영)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
        if (me) {
          const { data: prefs } = await supabase.from("user_preferences")
            .select("ai_tone, communication_profile").eq("user_id", me.id).maybeSingle();
          if (prefs?.ai_tone === "detailed" || prefs?.ai_tone === "detailed_with_summary") {
            prompt += `summary 작성 시: 이 사람은 '자세히' 스타일을 선호하니, summary를 3-4문장으로 조금 더 풀어서 작성하세요.\n`;
          } else if (prefs?.ai_tone === "concise") {
            prompt += `summary 작성 시: 이 사람은 '간결히' 스타일을 선호하니, summary를 2문장 이내로 짧게 작성하세요.\n`;
          }
          if (prefs?.communication_profile) {
            prompt += `이 사용자의 소통 스타일(참고용): ${prefs.communication_profile}\n`;
          }
        }
      }
    } catch {
      // 톤 조회 실패해도 기본 동작은 계속
    }

    prompt += `\n반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이 순수 JSON):\n`;
    prompt += `{
  "summary": "회의 전체 요약 2-3문장",
  "participants": ["참석자1", "참석자2"],
  "decisions": ["결정사항1", "결정사항2"],
  "tasks": [
    {
      "title": "업무명",
      "task_type": "planning|development|design|qa|operation|documentation|meeting|research|customer|other",
      "priority": "urgent|high|medium|low",
      "due_date": "YYYY-MM-DD 또는 null",
      "assignee_name": "담당자 이름 또는 null",
      "project_name": "위 프로젝트 목록에 있는 이름 정확히 그대로, 확신 없으면 null",
      "possible_duplicate_of": "겹치는 기존 업무명 정확히 그대로, 없으면 null",
      "is_blocked": false,
      "blocked_reason": null
    }
  ],
  "issues": ["이슈1", "이슈2"]
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    console.log("RAW RESPONSE:", raw.substring(0, 500));
    
    const clean = raw.replace(/^```[a-z]*\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    console.log("CLEAN:", clean.substring(0, 500));

    let result = null;
    try { 
      result = JSON.parse(clean); 
      console.log("PARSE SUCCESS");
    } catch(e) { 
      console.log("PARSE FAIL:", e.message);
    }
    if (!result) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) { 
        try { result = JSON.parse(match[0]); } catch(e) { console.log("MATCH PARSE FAIL:", e.message); }
      } else {
        console.log("NO JSON MATCH FOUND");
      }
    }
    if (!result) {
      console.log("RETURNING FALLBACK");
      result = { summary: "분석 완료", items: [], tasks: [], decisions: [], issues: [] };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("analyze-meeting error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
