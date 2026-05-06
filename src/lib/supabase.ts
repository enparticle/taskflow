import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 싱글톤 인스턴스 - 매 렌더링마다 새로 생성하지 않음
let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  if (client) return client;
  client = createSupabaseClient<Database>(
    "https://tvgygdyucadaoqmnsgmp.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Z3lnZHl1Y2FkYW9xbW5zZ21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjA2MzMsImV4cCI6MjA5MzQzNjYzM30.rbMmaPhtqxJv6GUNaUvvtE7C6Cih4VfldlDOsTLvygA"
  );
  return client;
}
