// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE_RULES = `
遺꾩꽍 湲곗? (諛섎뱶?????쒖꽌濡??ш퀬?섏꽭??:
1. ?⑦꽩 ?몄떇: ?섏튂?먯꽌 諛섎났?섎뒗 ?⑦꽩?대굹 ?댁긽吏뺥썑瑜?李얠쑝?몄슂
2. ?먯씤 異붾줎: 洹??⑦꽩????諛쒖깮?덈뒗吏 援ъ“???먯씤??異붾줎?섏꽭??3. 由ъ뒪???덉륫: ???곹깭媛 吏?띾릺硫??대뼡 臾몄젣媛 ?앷만吏 ?덉륫?섏꽭??4. ?ㅽ뻾 媛?ν븳 議곗튂: ?대쾲 二??덉뿉 ?????덈뒗 援ъ껜???됰룞???쒖떆?섏꽭??5. 洹좏삎: ???섍퀬 ?덈뒗 ?먮룄 諛섎뱶???멸툒?섏꽭??
湲덉??ы빆:
- ?⑥닚 ?ъ떎 ?섏뿴 湲덉?
- 紐⑦샇??議곗뼵 湲덉?
- ?섏튂 洹몃?濡?諛섎났 湲덉?`;

const PROJECT_HEALTH_CRITERIA = `
project_health ?먮떒 湲곗? (snapshot??burndown_divergence_pct 李멸퀬):

[?쒖옉??留덇컧???덈뒗 寃쎌슦 - 踰덈떎??愿대━??湲곗?]
- good(?뺤긽): 愿대━??10% ?대궡, Blocked 2嫄?誘몃쭔
- reviewing(寃???꾩슂): 愿대━??10~20% OR Blocked 2嫄??댁긽
- at_risk(二쇱쓽): 愿대━??20~35% OR Blocked 3嫄??댁긽
- critical(?꾪뿕): 留덇컧 珥덇낵 OR 愿대━??35% 珥덇낵 OR Blocked 5嫄??댁긽

[?쒖옉??留덇컧???녿뒗 寃쎌슦 - 蹂댁닔??湲곗?]
- good(?뺤긽): Blocked 3嫄?誘몃쭔, 吏??7嫄?誘몃쭔?대㈃ 湲곕낯 ?뺤긽
- reviewing(寃???꾩슂): Blocked 3嫄??댁긽 OR 吏??7嫄??댁긽
- at_risk(二쇱쓽): Blocked 5嫄??댁긽 OR 吏??10嫄??댁긽
- critical(?꾪뿕): Blocked 7嫄??댁긽

怨듯넻: suspended(以묐떒)???꾩옱 health媛 suspended???뚮쭔 諛섑솚.
遺꾩꽍 ?댁슜? ?먯쑀濡?쾶 ?묒꽦?섎릺 project_health 媛믪? ??湲곗????곕Ⅴ?몄슂.`;

const SUGGESTION_RULES = `
AI 異붿쿇 ?ы빆 (suggestions):
遺꾩꽍 寃곌낵 援ъ껜?곸씤 蹂寃쎌씠 ?꾩슂?섎㈃ suggestions 諛곗뿴??異붽??섏꽭??
?ъ슜?먭? ?뱀씤?섎㈃ ?먮룞?쇰줈 ?곸슜?⑸땲??

異붿쿇 媛?ν븳 ??ぉ:
- assignee: ?대떦???щ같遺?(task_id + suggested_value: "?ъ슜???대쫫")
- deadline: 留덇컧??議곗젙 (task_id + suggested_value: "YYYY-MM-DD")
- priority: ?곗꽑?쒖쐞 蹂寃?(task_id + suggested_value: "urgent|high|medium|low")
- status: ?곹깭 蹂寃?(task_id + suggested_value: "todo|doing|review|blocked|done|backlog")

異붿쿇 議곌굔:
- 紐낇솗??洹쇨굅媛 ?덉쓣 ?뚮쭔 異붿쿇 (遺덈챸?뺥븯硫?suggestions 鍮꾩썙?먭린)
- ?대떦??異붿쿇 ??諛섎뱶??snapshot??team ?곗씠?곗뿉 ?덈뒗 ?щ엺留?異붿쿇
- 留덇컧?쇱? ?꾩떎?곸씤 ?좎쭨濡?異붿쿇`;

function buildPrompt(snapshot: any): string {
  const context = snapshot.context ?? "";
  const isProject = context.startsWith("?꾨줈?앺듃:");
  const isTasks = context.includes("?낅Т 紐⑸줉") || context.includes("?낅Т");

  let roleDesc = "議곗쭅 ?댁쁺怨?? ??븰???뺥넻???쒕땲??而⑥꽕?댄듃";
  let focusDesc = "?쒕㈃???섏튂媛 ?꾨땶 援ъ“??臾몄젣? ? ??븰??吏꾨떒";

  if (isProject) {
    roleDesc = "?꾨줈?앺듃 愿由??꾨Ц媛";
    focusDesc = "???꾨줈?앺듃??吏꾪뻾 由ъ뒪?? 留덉씪?ㅽ넠 ?ъ꽦 媛?μ꽦, ? ??蹂묐ぉ??吏꾨떒";
  } else if (isTasks) {
    roleDesc = "?낅Т ?꾨줈?몄뒪 ?꾨Ц媛";
    focusDesc = "?낅Т 遺꾨같, ?곗꽑?쒖쐞 ?ㅼ젙, 吏꾪뻾 ?먮쫫??臾몄젣瑜?吏꾨떒";
  }

  const projectHealthField = isProject ? '\n  "project_health": "good|reviewing|at_risk|critical|suspended",' : "";

  return `?뱀떊? ${roleDesc}?낅땲?? ?꾨옒 ?곗씠?곕? 蹂닿퀬 ${focusDesc}?댁＜?몄슂.

?꾪솴 ?곗씠??
${JSON.stringify(snapshot)}
${BASE_RULES}
${isProject ? PROJECT_HEALTH_CRITERIA : ""}
${SUGGESTION_RULES}

?꾨옒 JSON ?뺤떇?쇰줈留??묐떟?섏꽭?? 留덊겕?ㅼ슫?대굹 肄붾뱶釉붾줉 ?놁씠 ?쒖닔 JSON留?
{${projectHealthField}
  "summary": "?듭떖 吏꾨떒 ??臾몄옣 (60?먯씠??",
  "items": [
    {
      "level": "danger|warning|info",
      "title": "吏꾨떒紐?(20?먯씠??",
      "detail": "?⑦꽩 ?먯씤 由ъ뒪???쒖꽌濡??쒖닠 (120?먯씠??",
      "action": "?대쾲 二??ㅽ뻾 媛?ν븳 援ъ껜??議곗튂 (70?먯씠??"
    }
  ],
  "overall_risk": "high|medium|low",
  "suggestions": [
    {
      "type": "assignee|deadline|priority|status",
      "task_id": "?낅Т ID (snapshot??tasks?먯꽌)",
      "task_title": "?낅Т紐?,
      "field": "assignee_id|due_date|priority|status",
      "current_value": "?꾩옱 媛?,
      "suggested_value": "異붿쿇 媛?,
      "reason": "異붿쿇 ?댁쑀 (50?먯씠??"
    }
  ]
}

level? danger/warning/info, overall_risk??high/medium/low.
items??理쒕? 6媛? suggestions??洹쇨굅媛 紐낇솗???뚮쭔, 理쒕? 5媛?`;
}

async function callWithRetry(client: any, params: any, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      if (e?.status === 529 && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { snapshot } = await req.json();
    const prompt = buildPrompt(snapshot);

    const message = await callWithRetry(client, {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      system: "?뱀떊? JSON留?諛섑솚?⑸땲?? ?덈?濡?留덊겕?ㅼ슫, 肄붾뱶釉붾줉, ?ㅻ챸 ?띿뒪?몃? ?ы븿?섏? 留덉꽭?? ?묐떟? 諛섎뱶??{ 濡??쒖옉?섍퀬 } 濡??앸굹???⑸땲??",
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    // 코드블록 제거
    const text = raw.replace(/^```[a-z]*\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    let result = null;
    try { result = JSON.parse(text); } catch {}
    if (!result) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch {} }
    }
    if (!result) {
      // 諛깊떛 肄붾뱶釉붾줉 ?쒓굅 ??JSON 異붿텧
      const stripped = text.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim();
      try { result = JSON.parse(stripped); } catch {}
      if (!result) {
        const match = stripped.match(/\{[\s\S]*\}/);
        if (match) { try { result = JSON.parse(match[0]); } catch {} }
      }
    }
    if (!result) {
      result = {
        summary: "?곗씠??遺꾩꽍 ?꾨즺",
        items: [{ level: "info", title: "遺꾩꽍 寃곌낵", detail: text.slice(0, 100), action: "TaskFlow?먯꽌 ?곸꽭 ?뺤씤" }],
        overall_risk: "medium",
        suggestions: [],
      };
    }

    // suggestions瑜?DB?????    if (result.suggestions?.length > 0 && snapshot.project_id) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        for (const s of result.suggestions) {
          if (!s.task_id || !s.type) continue;
          await supabase.from("ai_suggestions").insert({
            project_id: snapshot.project_id,
            task_id: s.task_id,
            type: s.type,
            field: s.field,
            current_value: s.current_value ? String(s.current_value) : null,
            suggested_value: String(s.suggested_value),
            reason: s.reason,
            status: "pending",
          });
        }
      } catch {}
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

