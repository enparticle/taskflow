// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAuthedClient } from "@/lib/supabaseServer";

// 사용자가 말로 설명한 화면 분위기를 CSS 변수 값으로만 변환합니다.
// 절대 새 선택자·로직을 만들지 않고, 이미 앱 전체에서 쓰고 있는 CSS 변수(--bg, --text-1 등)의
// "값"만 다시 정하게 해서, 데이터/로직에는 전혀 접근할 수 없는 구조로 안전하게 설계했습니다.
const ALLOWED_VARS = [
  "--bg", "--bg-2", "--bg-3", "--bg-4",
  "--text-1", "--text-2", "--text-3",
  "--border", "--border-2",
  "--cyan", "--cyan-bg",
  "--red", "--red-bg",
  "--green", "--green-bg",
  "--blue", "--blue-bg",
  "--radius", "--radius-lg",
  "--shadow",
  "--font-family",
];

// font-family만 값 안에 위험한 문자(url(), 세미콜론 등)가 없는지 한 번 더 확인
function isSafeFontFamily(value: string): boolean {
  return !/url\(|;|\{|\}/.test(value) && value.length < 200;
}

function sanitizeCss(raw: string): string {
  // "--변수명: 값;" 형태만 추출, 그 외(선택자, 다른 속성 등)는 전부 버림
  const lines = raw.match(/--[\w-]+\s*:\s*[^;{}]+;/g) ?? [];
  const kept = lines.filter(line => {
    const varName = line.split(":")[0].trim();
    if (!ALLOWED_VARS.includes(varName)) return false;
    if (varName === "--font-family") {
      const value = line.split(":").slice(1).join(":").replace(";", "").trim();
      return isSafeFontFamily(value);
    }
    return true;
  });
  if (kept.length === 0) return "";
  return `:root {\n  ${kept.join("\n  ")}\n}`;
}

export async function POST(req: NextRequest) {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { description } = await req.json();

    if (!description || !description.trim()) {
      return NextResponse.json({ error: "설명을 입력해주세요." }, { status: 400 });
    }

    const prompt = `당신은 웹 앱의 다크 테마 색상 팔레트를 만드는 디자이너입니다.
사용자가 원하는 분위기: "${description}"

아래 CSS 변수들의 값을 사용자가 원하는 분위기에 맞게 새로 정해주세요.
⚠️ 중요: 사용자가 "화이트톤", "밝게", "라이트 테마" 같은 걸 원하면 실제로 밝은 배경(--bg가 흰색/아주 연한 회색)에 어두운 글자로 만드세요 — 다크 테마를 기본값으로 우기지 마세요. 반대로 별다른 언급이 없으면 지금 앱의 기본인 다크 테마를 유지하세요.
어느 쪽이든 가독성은 꼭 유지하세요 (배경과 글자색 대비가 충분해야 함):
- --bg, --bg-2, --bg-3, --bg-4: 배경색 4단계 (톤 방향에 맞게 점점 진해지거나 옅어지는 순서로, hex)
- --text-1, --text-2, --text-3: 글자색 3단계 (배경과 대비되는 방향으로, 진한/연한 순)
- --border, --border-2: 테두리색 2단계
- --cyan, --cyan-bg: 포인트색 + 그 배경색(투명도 있는 rgba 권장)
- --red, --red-bg, --green, --green-bg, --blue, --blue-bg: 상태색(경고/성공/정보) + 각 배경색
- --radius: 카드 모서리 둥글기 (예: 각지게 "4px" ~ 아주 둥글게 "24px")
- --radius-lg: 큰 컨테이너용 모서리 둥글기 (--radius보다 살짝 크게)
- --shadow: 카드 그림자 (예: 그림자 없음 "none", 은은하게 "0 2px 8px rgba(0,0,0,0.15)", 강하게 "0 8px 24px rgba(0,0,0,0.35)")
- --font-family: 폰트 (웹 안전 폰트만: "'Pretendard', -apple-system, sans-serif" 기본. 분위기에 따라 "Georgia, serif"처럼 바꿔도 되지만 반드시 흔한 시스템 폰트로만, url()이나 @import 절대 금지)

반드시 아래 형식으로만 응답하세요. 다른 설명 없이 CSS 변수 선언만:
--bg: #0D1B2E;
--bg-2: #131F35;
--bg-3: #1A2A45;
--bg-4: #223655;
--text-1: #E8F0FF;
--text-2: #A8BFDD;
--text-3: #6B84A8;
--border: rgba(255,255,255,0.08);
--border-2: rgba(255,255,255,0.14);
--cyan: #00C2CC;
--cyan-bg: rgba(0,194,204,0.12);
--red: #f87171;
--red-bg: rgba(248,113,113,0.12);
--green: #34d399;
--green-bg: rgba(52,211,153,0.12);
--blue: #60a5fa;
--blue-bg: rgba(96,165,250,0.12);
--radius: 12px;
--radius-lg: 18px;
--shadow: 0 2px 8px rgba(0,0,0,0.15);
--font-family: 'Pretendard', -apple-system, sans-serif;

(위는 어디까지나 다크 테마 예시일 뿐입니다. 사용자가 밝은/화이트 톤을 원했다면 --bg를 흰색이나 아주 연한 회색 계열로, --text-1은 진한 색으로 완전히 뒤집어서 작성하세요. 값의 형식만 참고하고, 실제 색상은 사용자가 원하는 분위기에 맞게 새로 정하세요)`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const cssText = sanitizeCss(raw);

    if (!cssText) {
      return NextResponse.json({ error: "테마 생성에 실패했어요. 다시 시도해주세요." }, { status: 500 });
    }

    // 저장 — 재요청 시 이전 대화 맥락(source_prompt)으로 활용 가능하도록
    const supabase = createAuthedClient(req);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: me } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
      if (me) {
        await supabase.from("user_theme").upsert({
          user_id: me.id,
          css_text: cssText,
          source_prompt: description,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }

    return NextResponse.json({ css: cssText });
  } catch (err: any) {
    console.error("generate-theme error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
