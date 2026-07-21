// @ts-nocheck
// supabase/functions/send-push/index.ts
// Edge function gửi Web Push notification (VAPID) đến danh sách user
// Deploy: paste nội dung này vào Supabase Dashboard → Edge Functions → Create
// Secret: Settings → Edge Functions → Secrets → VAPID_PRIVATE_KEY (string)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import webPush from 'https://esm.sh/web-push@3.6.7?target=deno';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

// Configure web-push
webPush.setVapidDetails(
  'mailto:admin@hoanglonglamdong.vn',
  'PLACEHOLDER_PUBLIC_KEY', // Public key not needed for sending, only for client
  VAPID_PRIVATE_KEY
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendPushRequest {
  userIds: string[];
  title?: string;
  body?: string;
  data?: Record<string, string>;
  image?: string;
  tag?: string;
}

// Query push_subscriptions qua PostgREST
async function getSubscriptions(userIds: string[]) {
  const ids = userIds.map((id) => `"${id}"`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=in.(${ids})`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed ${res.status}: ${text}`);
  }
  return await res.json();
}

// Xoá subscription lỗi (gone / invalid)
async function deleteSubscriptions(endpoints: string[]) {
  if (!endpoints.length) return;
  const ids = endpoints.map((e) => `"${e}"`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${ids})`;
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userIds, title, body, data, image, tag }: SendPushRequest = await req.json();

    if (!userIds || !userIds.length) {
      return new Response(JSON.stringify({ error: 'missing userIds' }), { status: 400, headers: corsHeaders });
    }

    const subs = await getSubscriptions(userIds);
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ successCount: 0, failureCount: 0, note: 'no subscriptions' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const payload = JSON.stringify({
      title: title || 'Thông báo mới',
      body: body || '',
      image: image || '',
      data: data || {},
      tag: tag || 'web-push-notification',
      actions: [{ action: 'open', title: 'Mở' }],
    });

    let successCount = 0;
    let failureCount = 0;
    const failedEndpoints: string[] = [];

    // Send to each subscription
    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (err: any) {
        failureCount++;
        // Check if subscription is gone/invalid
        if (err.statusCode === 410 || err.statusCode === 404 || err.message?.includes('subscription') || err.message?.includes('gone')) {
          failedEndpoints.push(sub.endpoint);
        }
        console.error('Web Push send failed:', err.message || err);
      }
    }

    // Xoá subscription lỗi
    if (failedEndpoints.length) await deleteSubscriptions(failedEndpoints);

    return new Response(
      JSON.stringify({
        successCount,
        failureCount,
        removedSubscriptions: failedEndpoints.length,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
