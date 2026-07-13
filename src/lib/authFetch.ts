// @ts-nocheck
import { createClient } from "@/lib/supabase";

// 로그인 세션 토큰을 자동으로 붙여서 fetch하는 헬퍼.
// 서버 API 라우트가 anon key 대신 "이 사용자"로 Supabase에 접근할 수 있게 해줌.
// RLS가 authenticated 역할 기준으로 판단하므로, 이 헬퍼 없이 호출하면
// 서버에서 익명(anon) 취급되어 RLS에 막힘.
export async function authFetch(url: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}
