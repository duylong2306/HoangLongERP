// @ts-nocheck
// =============================================================================
// Edge Function: send-attendance-reminders
// Tự động gửi thông báo điểm danh qua Web Push theo lịch trình (pg_cron)
// Chạy bởi pg_cron → gọi HTTP → Edge Function xử lý logic
// =============================================================================

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
    // ─── ENV VARS ──────────────────────────────────────────────────────────
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

    // ─── TIMEZONE CHECK (Vietnam = UTC+7) ─────────────────────────────────
    const now = new Date();
    const vietnamHour = (now.getUTCHours() + 7) % 24;
    const vietnamMinutes = now.getUTCMinutes();
    const currentMinutes = vietnamHour * 60 + vietnamMinutes;

    // Ca sáng: 07:00 - 07:30 (420 - 450 phút)
    // Ca chiều: 12:30 - 13:00 (750 - 780 phút)
    const morningStart = 7 * 60;      // 420
    const morningEnd = 7 * 60 + 30;   // 450
    const afternoonStart = 12 * 60 + 30; // 750
    const afternoonEnd = 13 * 60;       // 780

    let shiftType: string | null = null;

    if (currentMinutes >= morningStart && currentMinutes <= morningEnd) {
      shiftType = "morning";
    } else if (currentMinutes >= afternoonStart && currentMinutes <= afternoonEnd) {
      shiftType = "afternoon";
    }

    if (!shiftType) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "outside_time_window",
          vietnamTime: `${String(vietnamHour).padStart(2, "0")}:${String(vietnamMinutes).padStart(2, "0")}`,
          message: "Không nằm trong cửa sổ giờ điểm danh (07:00-07:30 hoặc 12:30-13:00)",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── CHECK HOLIDAYS & WEEKENDS (theo cấu hình shift_config + hrm_holidays) ──
    // Tính ngày/giờ Việt Nam (UTC+7) để xét ngày nghỉ theo múi giờ VN
    const vnNow = new Date(now.getTime() + 7 * 3600 * 1000);
    const vietnamDow = vnNow.getUTCDay(); // 0=Sun ... 6=Sat (theo giờ VN)
    const vnDay = String(vnNow.getUTCDate()).padStart(2, "0");
    const vnMonth = String(vnNow.getUTCMonth() + 1).padStart(2, "0");
    const vnDdMm = `${vnDay}/${vnMonth}`;
    const vnDdMmYyyy = `${vnDay}/${vnMonth}/${vnNow.getUTCFullYear()}`;

    const sbHeaders = {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1) Ngày nghỉ cuối tuần từ cấu hình ca (tab "Cấu hình ca", shift_config.weekend_days)
    //    Fail-open: nếu không lấy được config, mặc định chỉ bỏ qua Chủ nhật (như cũ).
    let weekendDays: number[] = [0];
    try {
      const cfgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shift_config?select=weekend_days&id=eq.current`,
        { headers: sbHeaders }
      );
      if (cfgRes.ok) {
        const cfgRows = await cfgRes.json();
        if (Array.isArray(cfgRows) && cfgRows[0]?.weekend_days) {
          weekendDays = cfgRows[0].weekend_days;
        }
      }
    } catch (err) {
      console.warn("Không đọc được shift_config.weekend_days, dùng mặc định [0]:", err);
    }

    if (Array.isArray(weekendDays) && weekendDays.includes(vietnamDow)) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "rest_day",
          restDayType: "weekend",
          vietnamDate: vnDdMmYyyy,
          message: `Ngày nghỉ cuối tuần (${vnDdMmYyyy}) - không thông báo điểm danh`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2) Ngày lễ từ bảng hrm_holidays (khớp cả DD/MM và DD/MM/YYYY)
    //    Fail-open: nếu không lấy được, không bỏ qua ngày lễ nào.
    let holidayDates: string[] = [];
    try {
      const holRes = await fetch(
        `${SUPABASE_URL}/rest/v1/hrm_holidays?select=date`,
        { headers: sbHeaders }
      );
      if (holRes.ok) {
        const holRows = await holRes.json();
        if (Array.isArray(holRows)) {
          holidayDates = holRows.map((h: any) => h.date).filter(Boolean);
        }
      }
    } catch (err) {
      console.warn("Không đọc được hrm_holidays, bỏ qua kiểm tra ngày lễ:", err);
    }

    if (holidayDates.includes(vnDdMm) || holidayDates.includes(vnDdMmYyyy)) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "rest_day",
          restDayType: "holiday",
          vietnamDate: vnDdMmYyyy,
          message: `Ngày lễ ${vnDdMmYyyy} - không thông báo điểm danh`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── TODAY STRING ──────────────────────────────────────────────────────
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    // ─── QUERY ACTIVE EMPLOYEES WITH PUSH SUBSCRIPTIONS ────────────────────
    // Lấy tất cả nhân viên active (status = 'working') có push subscription
    // và chưa nhận thông báo điểm danh hôm nay
    const queryUrl = `${SUPABASE_URL}/rest/v1/rpc/get_attendance_reminder_recipients`;

    // Fallback: query trực tiếp nếu RPC chưa có
    const employeesUrl = `${SUPABASE_URL}/rest/v1/employees?select=id,name,department,status&status=eq.working`;
    const emplRes = await fetch(employeesUrl, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!emplRes.ok) {
      const errText = await emplRes.text();
      console.error("Failed to fetch employees:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch employees", details: errText }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const employees = await emplRes.json();

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "Không có nhân viên active" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── FILTER: chỉ nhân viên CHƯA nhận thông báo hôm nay ─────────────────
    const needsReminder = employees.filter((emp: any) => {
      return emp.last_attendance_reminder_sent !== todayStr;
    });

    if (needsReminder.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          reason: "all_already_notified",
          message: "Tất cả nhân viên đã nhận thông báo hôm nay",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── QUERY PUSH SUBSCRIPTIONS cho các nhân viên cần nhận ───────────────
    const empIds = needsReminder.map((e: any) => `"${e.id}"`).join(",");
    const subsUrl = `${SUPABASE_URL}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth&user_id=in.(${empIds})`;
    const subsRes = await fetch(subsUrl, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!subsRes.ok) {
      const errText = await subsRes.text();
      console.error("Failed to fetch subscriptions:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions", details: errText }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subscriptions = await subsRes.json();

    if (!subscriptions || subscriptions.length === 0) {
      // Không có subscription → vẫn cập nhật last_sent để không query lại
      await updateLastSent(SUPABASE_URL, SERVICE_KEY, needsReminder.map((e: any) => e.id), todayStr);
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          reason: "no_subscriptions",
          message: "Không có push subscription nào cho nhân viên cần nhận",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── BUILD NOTIFICATION PAYLOAD ────────────────────────────────────────
    const isMorning = shiftType === "morning";
    const title = isMorning ? "⏰ Điểm danh Ca Sáng" : "⏰ Điểm danh Ca Chiều";
    const body = isMorning
      ? "Sắp đến ca làm việc sáng (07:30). Hãy điểm danh vân tay/khuôn mặt ngay!"
      : "Sắp đến ca làm việc chiều (13:00). Hãy điểm danh vân tay/khuôn mặt!";

    const detailedContent = isMorning
      ? "Ca làm việc chính thức: Sáng 07:30 - 11:30.\nThời gian bắt đầu điểm danh vào ca: 07:00.\nHãy thực hiện điểm danh để không bị ghi nhận đi muộn."
      : "Ca làm việc chính thức: Chiều 13:00 - 17:00.\nThời gian bắt đầu điểm danh vào ca: 12:30.\nHãy thực hiện điểm danh để không bị ghi nhận đi muộn.";

    const payload = JSON.stringify({
      title,
      body,
      image: "",
      data: {
        url: "/",
        type: "attendance",
        notificationType: shiftType,
        detailedContent,
      },
      tag: `attendance-${shiftType}-${todayStr}`,
      actions: [{ action: "open", title: "Điểm danh ngay" }],
    });

    // ─── SEND PUSH NOTIFICATIONS ───────────────────────────────────────────
    let successCount = 0;
    let failureCount = 0;
    const failedEndpoints: string[] = [];
    const notifiedUserIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        successCount++;
        if (!notifiedUserIds.includes(sub.user_id)) {
          notifiedUserIds.push(sub.user_id);
        }
      } catch (err) {
        failureCount++;
        const statusCode = err.statusCode || err.status || 0;
        console.error(`Push failed (${statusCode}):`, sub.endpoint.substring(0, 60));
        failedEndpoints.push(sub.endpoint);
      }
    }

    // ─── CLEANUP FAILED SUBSCRIPTIONS ──────────────────────────────────────
    if (failedEndpoints.length > 0) {
      const epIds = failedEndpoints.map((e: string) => `"${e}"`).join(",");
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${epIds})`, {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }

    // ─── UPDATE last_attendance_reminder_sent cho các nhân viên đã gửi ─────
    await updateLastSent(SUPABASE_URL, SERVICE_KEY, notifiedUserIds, todayStr);

    // ─── ALSO WRITE TO notifications TABLE (in-app notification) ───────────
    // Tạo thông báo in-app cho tất cả nhân viên cần nhận (kể cả không có push subscription)
    for (const emp of needsReminder) {
      try {
        const notifId = `ATT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            id: notifId,
            recipient_id: emp.id,
            recipient_name: emp.name,
            department: emp.department || "Phòng Ban",
            title,
            content: body,
            detailed_content: detailedContent,
            category: "attendance",
            sub_task_code: shiftType === "morning" ? "CA-SANG" : "CA-CHIEU",
            sender_name: "Phòng Hành Chính Nhân Sự",
            sender_avatar: "NS",
            sender_id: "system",
            read: false,
            created_at: now.toISOString(),
          }),
        });
      } catch (err) {
        console.warn("Failed to write in-app notification for", emp.id, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        shiftType,
        vietnamTime: `${String(vietnamHour).padStart(2, "0")}:${String(vietnamMinutes).padStart(2, "0")}`,
        totalEmployees: employees.length,
        needsReminder: needsReminder.length,
        subscriptionsFound: subscriptions.length,
        pushSent: successCount,
        pushFailed: failureCount,
        inAppCreated: needsReminder.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

// ─── HELPER: Update last_attendance_reminder_sent ───────────────────────────
async function updateLastSent(
  supabaseUrl: string,
  serviceKey: string,
  userIds: string[],
  todayStr: string
) {
  if (!userIds.length) return;
  try {
    const ids = userIds.map((id: string) => `"${id}"`).join(",");
    await fetch(`${supabaseUrl}/rest/v1/employees?id=in.(${ids})`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_attendance_reminder_sent: todayStr }),
    });
  } catch (err) {
    console.warn("Failed to update last_attendance_reminder_sent:", err);
  }
}
