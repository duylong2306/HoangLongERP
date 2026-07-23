// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webPush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY || !VAPID_PRIV || !VAPID_PUB) {
      return new Response(
        JSON.stringify({ error: "Missing env vars" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    webPush.setVapidDetails("mailto:admin@hoanglonglamdong.vn", VAPID_PUB, VAPID_PRIV);

    const { userIds, title, body, data, image, tag } = await req.json();

    if (!userIds || !userIds.length) {
      return new Response(
        JSON.stringify({ error: "missing userIds" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Query subscriptions
    const ids = userIds.map((id) => `"${id}"`).join(",");
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=in.(${ids})`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const subs = await subRes.json();

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ successCount: 0, failureCount: 0, note: "no subscriptions" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload = JSON.stringify({
      title: title || "Thong bao moi",
      body: body || "",
      image: image || "",
      data: data || {},
      tag: tag || "web-push-notification",
      actions: [{ action: "open", title: "Mo" }],
    });

    let successCount = 0;
    let failureCount = 0;
    const failedEndpoints = [];

    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        successCount++;
      } catch (err) {
        failureCount++;
        if (err.statusCode === 410 || err.statusCode === 404 || (err.message && err.message.includes("gone"))) {
          failedEndpoints.push(sub.endpoint);
        }
        console.error("Push failed:", err.message || err);
      }
    }

    // Delete invalid subscriptions
    if (failedEndpoints.length > 0) {
      const epIds = failedEndpoints.map((e) => `"${e}"`).join(",");
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${epIds})`, {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }

    return new Response(
      JSON.stringify({ successCount, failureCount, removedSubscriptions: failedEndpoints.length }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
