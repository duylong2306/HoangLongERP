// @ts-nocheck
// =============================================================================
// Edge Function: send-attendance-reminders — nhắc điểm danh qua Web Push (DỰ PHÒNG), chạy cho TỪNG doanh nghiệp.
// Nguồn chính là hàm SQL trigger_attendance_reminders() (pg_cron). Logic nằm ở ../_shared/attendance-core.ts (có test).
// Chỉ nhận lời gọi bằng khóa service_role (cron/máy chủ) — người dùng ERP và khóa anon công khai bị từ chối.
// =============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "https://esm.sh/web-push@3.6.7";
import { runAttendanceReminders } from "../_shared/attendance-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Missing env vars" });

    // Chỉ khóa service_role mới được kích hoạt nhắc điểm danh (nếu không, ai có khóa anon công khai cũng gọi được)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (token !== SERVICE_KEY) return json(401, { error: "Chỉ máy chủ (service_role) được gọi hàm này." });
    if (!VAPID_PRIV || !VAPID_PUB) return json(500, { error: "Missing VAPID keys" });

    webPush.setVapidDetails("mailto:admin@hoanglonglamdong.vn", VAPID_PUB, VAPID_PRIV);
    const result = await runAttendanceReminders({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, fetchFn: fetch, webPush });
    return json(200, result);
  } catch (err) {
    console.error("Error:", err);
    return json(500, { error: String(err) });
  }
});
