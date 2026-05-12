// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

const BASE_RULES = `
분석 기준 (반드시 이 순서로 사고하세요):
1. 패턴 인식: 수치에서 반복되는 패턴이나 이상징후를 찾으세요
2. 원인 추론: 그 패턴이 왜 발생했는지 구조적 원인을 추론하세요
3. 리스크 예측: 이 상태가 지속되면 어떤 문제가 생길지 예측하세요
4. 실행 가능한 조치: 이번 주 안에 할 수 있는 구체적 행동을 제시하세요
5. 균형: 잘 되고 있는 점도 반드시 언급하세요

금지사항:
- "X건이 있습니다", "확인이 필요합니다" 같은 단순 사실 나열 금지
- 모호한 조언 금지
- 수치 그대로 반복 금지`;

const PROJECT_HEALTH_CRITERIA = `
project_health 판단 기준 (엄격하게 적용):
- critical: 지연 1건 이상 OR blocked 1건 이상 OR (마감 14일 이내 & 진행률 50% 미만) OR 마감 초과
- at_risk: 예상시간 미입력 업무 30% 이상 OR (마감 30일 이내 & 진행률 30% 미만) OR 할일/백로그가 전체의 60% 이상
- good: 위 조건 모두 해당 없음`;

function buildPrompt(snapshot: any): string {
  const context = snapshot.context ?? "";
  const isProject = context.startsWith("프로젝트:");
  const isTasks = context.includes("업무 목록") || context.includes("업무");

  let roleDesc = "조직 운영과 팀 역학에 정통한 시니어 컨설턴트";
  let focusDesc = "표면적 수치가 아닌 구조적 문제와 팀 역학을 진단";

  if (isProject) {
    roleDesc = "프로젝트 관리 전문가";
    focusDesc = "이 프로젝트의 진행 리스크, 마일스톤 달성 가능성, 팀 내 병목을 진단";
  } else if (isTasks) {
    roleDesc = "업무 프로세스 전문가";
    focusDesc = "업무 분배, 우선순위 설정, 진행 흐름의 문제를 진단";
  }

  const projectHealthField = isProject ? '\n  "project_health": "good|at_risk|critical",' : "";
  const projectHealthNote = isProject ? PROJECT_HEALTH_CRITERIA : "";

  return `당신은 ${roleDesc}입니다. 아래 데이터를 보고 ${focusDesc}해주세요.

현황 데이터:
${JSON.stringify(snapshot)}
${BASE_RULES}

아래 JSON 형식으로만 응답하세요. 마크다운이나 코드블록 없이 순수 JSON만:
{${projectHealthField}
  "summary": "핵심 진단 한 문장 (60자이내)",
  "items": [
    {
      "level": "danger|warning|info",
      "title": "진단명 (20자이내)",
      "detail": "패턴 원인 리스크 순서로 서술 (120자이내)",
      "action": "이번 주 실행 가능한 구체적 조치 (70자이내)"
    }
  ],
  "overall_risk": "high|medium|low"
}

level은 danger/warning/info 중 하나, overall_risk는 high/medium/low 중 하나.
items는 최대 6개. 가장 중요한 구조적 문제부터 나열하세요.${projectHealthNote}`;
}

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { snapshot } = await req.json();
    const prompt = buildPrompt(snapshot);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: "당신은 JSON만 반환합니다. 절대로 마크다운, 코드블록, 설명 텍스트를 포함하지 마세요. 응답은 반드시 { 로 시작하고 } 로 끝나야 합니다.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let result = null;
    try { result = JSON.parse(text); } catch {}
    if (!result) {
      const clean = text.replace(/```json|```/g, "").trim();
      try { result = JSON.parse(clean); } catch {}
    }
    if (!result) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch {} }
    }
    if (!result) {
      result = {
        summary: "데이터 분석 완료",
        items: [{ level: "info", title: "분석 결과", detail: text.slice(0, 100), action: "TaskFlow에서 상세 확인" }],
        overall_risk: "medium",
      };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
