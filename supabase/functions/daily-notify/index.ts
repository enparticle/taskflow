// Supabase Edge Function - 매일 오전 9시 실행
// Supabase Dashboard > Edge Functions > Schedule 에서 설정
// cron: "0 0 * * *" (UTC 0시 = KST 9시)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  try {
    const appUrl = Deno.env.get("APP_URL") ?? "https://taskflow-ecru-rho.vercel.app";
    
    const res = await fetch(`${appUrl}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysAhead: 3 }),
    });

    const data = await res.json();
    console.log("Daily notify result:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily notify error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
