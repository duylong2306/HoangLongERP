// @ts-nocheck
// Edge Function: send-push — gửi Web Push cho các thiết bị đã đăng ký, THEO TỪNG DOANH NGHIỆP.
// Toàn bộ logic (xác thực, lọc company_id) nằm ở ../_shared/tenant-core.ts (có test: src/lib/__tests__/edgeTenant.test.ts).
//   • Người gọi là nhân viên đăng nhập ERP: gửi token ĐĂNG NHẬP (không phải khóa anon) — công ty lấy TỪ TOKEN;
//   • Người gọi là máy chủ: dùng khóa service_role và truyền thêm { companyId }.
// Cần các biến môi trường của hàm: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY (SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY do Supabase cấp sẵn).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "https://esm.sh/web-push@3.6.7";
import { handleSendPush } from "../_shared/tenant-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const env = {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SERVICE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
      VAPID_PRIV: Deno.env.get("VAPID_PRIVATE_KEY"),
      VAPID_PUB: Deno.env.get("VAPID_PUBLIC_KEY"),
    };
    if (env.VAPID_PUB && env.VAPID_PRIV) webPush.setVapidDetails("mailto:admin@hoanglonglamdong.vn", env.VAPID_PUB, env.VAPID_PRIV);
    const body = await req.json().catch(() => ({}));
    const r = await handleSendPush(
      { method: req.method, authorization: req.headers.get("authorization"), body },
      env,
      { fetchFn: fetch, webPush },
    );
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
