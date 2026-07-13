// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

// API 라우트에서 이 함수로 Supabase 클라이언트를 만들면,
// authFetch로 보낸 요청의 Authorization 헤더(사용자 access token)를 그대로 이용해
// "이 사용자"로 인증된 상태에서 쿼리를 실행함 (RLS가 정상 작동).
// 토큰이 없으면(비로그인 호출 등) anon 역할로 동작 — RLS가 자동으로 막아줌.
export function createAuthedClient(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );
}
