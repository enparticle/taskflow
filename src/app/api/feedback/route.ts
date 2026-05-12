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
- 모호한 조언 ("검토하세요", "고려하세요") 금지
- 수치 그대로 반복 금지`;

function buildPrompt(snapshot: any): string {
  const context = snapshot.context ?? "";
  const isProject = context.startsWith("프로젝트:");
  const isTasks = context.includes("업무 목록") || context.includes("업무");
  const isDashboard = context.includes("대시보드");

  let roleDesc = "조직 운영과 팀 역학에 정통한 시니어 컨설턴트";
  let focusDesc = "표면적 수치가 아닌 구조적 문제와 팀 역학을 진단";
  let extraFields = "";

  if (isProject) {
    roleDesc = "프로젝트 관리 전문가";
    focusDesc = "이 프로젝트의 진행 리스크, 마일스톤 달성 가능성, 팀 내 병목을 진단";
    extraFields = `
  "project_health": "good|at_risk|critical",`;
  } else if (isTasks) {
    roleDesc = "업무 프로세스 전문가";
    focusDesc = "업무 분배, 우선순위 설정, 진행 흐름의 문제를 진단";
  } else if (isDashboard) {
    roleDesc = "조직 운영과 팀 역학에 정통한 시니어 컨설턴트";
    focusDesc = "팀 전체의 구조적 문제와 역학을 진단";
  }

  return `당신은 ${roleDesc}입니다. 아래 데이터를 보고 ${focusDesc}해주세요.

현황 데이터:
${JSON.stringify(snapshot)}
${BASE_RULES}

아래 JSON 형식으로만 응답하세요. 마크다운이나 코드블록 없이 순수 JSON만:
{${extraFields}
  "summary": "핵심 진단 한 문장 (60자이내, 구조적 문제 또는 강점 중심)",
  "items": [
    {
      "level": "danger|warning|info",
      "title": "진단명 (20자이내)",
      "detail": "패턴→원인→리스크 순서로 서술 (120자이내)",
      "action": "이번 주 실행 가능한 구체적 조치 (70자이내)"
    }
  ],
  "overall_risk": "high|medium|low"
}

level은 danger/warning/info 중 하나, overall_risk는 high/medium/low 중 하나.${isProject ? '\nproject_health는 good/at_risk/critical 중 하나 - 마감일, 진행률, 지연, blocked를 종합해서 판단하세요.' : ''}
items는 최대 6개. 가장 중요한 구조적 문제부터 나열하세요.`;
}

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { snapshot } = await req.json();
    const prompt = buildPrompt(snapshot);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
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
