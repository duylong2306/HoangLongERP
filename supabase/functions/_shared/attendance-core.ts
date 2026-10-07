// NHẮC ĐIỂM DANH qua Web Push — chạy cho TỪNG doanh nghiệp (đa doanh nghiệp). Hàm thuần nhận phụ thuộc qua tham số để test được.
// Nguồn chính của nhắc điểm danh là hàm SQL trigger_attendance_reminders() (pg_cron, thông báo trong ứng dụng); hàm Edge này là
// DỰ PHÒNG gửi thông báo đẩy khi ứng dụng đóng. Cả hai dùng chung cột employees.last_attendance_reminder_sent để không nhắc trùng.
//
// So với bản cũ (1 doanh nghiệp):
//   • lặp qua các doanh nghiệp ĐANG HOẠT ĐỘNG (không bị khóa / hết hạn), mỗi doanh nghiệp tự có ngày nghỉ (shift_config theo
//     company_id) và ngày lễ (hrm_holidays theo company_id);
//   • mọi truy vấn / cập nhật / xóa đều lọc company_id (mã nhân viên như emp_admin trùng giữa các công ty);
//   • notifications ghi kèm company_id; lỗi ở 1 công ty không chặn các công ty khác;
//   • đã SỬA lỗi cũ: bản cũ không lấy cột last_attendance_reminder_sent nên "chống nhắc trùng" không bao giờ chạy.
import { pgIn, pushToUsers, type PushDeps } from './tenant-core.ts';

const hdr = (k: string) => ({ apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export type Shift = 'morning' | 'afternoon';

// Cửa sổ nhắc: ca sáng 07:00–07:30, ca chiều 12:30–13:00 (giờ Việt Nam, UTC+7)
export function shiftWindow(now: Date): { shift: Shift | null; vnTime: string } {
  const vnH = (now.getUTCHours() + 7) % 24, vnM = now.getUTCMinutes(), t = vnH * 60 + vnM;
  const shift: Shift | null = t >= 420 && t <= 450 ? 'morning' : t >= 750 && t <= 780 ? 'afternoon' : null;
  return { shift, vnTime: `${String(vnH).padStart(2, '0')}:${String(vnM).padStart(2, '0')}` };
}

export function vnDateParts(now: Date) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, '0'), mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return { dow: vn.getUTCDay(), ddmm: `${dd}/${mm}`, ddmmyyyy: `${dd}/${mm}/${vn.getUTCFullYear()}`, today: `${vn.getUTCFullYear()}-${mm}-${dd}` };
}

export function reminderContent(shift: Shift) {
  const m = shift === 'morning';
  return {
    title: m ? '⏰ Điểm danh Ca Sáng' : '⏰ Điểm danh Ca Chiều',
    body: m ? 'Sắp đến ca làm việc sáng (07:30). Hãy điểm danh vân tay/khuôn mặt ngay!' : 'Sắp đến ca làm việc chiều (13:00). Hãy điểm danh vân tay/khuôn mặt!',
    detail: m
      ? 'Ca làm việc chính thức: Sáng 07:30 - 11:30.\nThời gian bắt đầu điểm danh vào ca: 07:00.\nHãy thực hiện điểm danh để không bị ghi nhận đi muộn.'
      : 'Ca làm việc chính thức: Chiều 13:00 - 17:00.\nThời gian bắt đầu điểm danh vào ca: 12:30.\nHãy thực hiện điểm danh để không bị ghi nhận đi muộn.',
    code: m ? 'CA-SANG' : 'CA-CHIEU',
  };
}

export interface AttendanceDeps extends PushDeps { now?: Date }

async function getJson(d: AttendanceDeps, path: string): Promise<any> {
  const r = await d.fetchFn(`${d.supabaseUrl}/rest/v1/${path}`, { headers: hdr(d.serviceKey) });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 200));
  return r.json();
}

export async function runAttendanceReminders(d: AttendanceDeps) {
  const now = d.now ?? new Date();
  const { shift, vnTime } = shiftWindow(now);
  if (!shift) return { success: false, reason: 'outside_time_window', vietnamTime: vnTime };
  const p = vnDateParts(now), c = reminderContent(shift);

  // Chỉ doanh nghiệp đang hoạt động: không bị khóa (active) và chưa hết hạn gói — giống chính sách company_live ở cơ sở dữ liệu
  const companies = (await getJson(d, 'companies?select=id,slug,active,expires_at&active=eq.true'))
    .filter((co: any) => !co.expires_at || new Date(co.expires_at).getTime() > now.getTime());

  const perCompany: any[] = [];
  for (const co of companies) {
    const row: any = { company: co.slug };
    try {
      // 1) ngày nghỉ cuối tuần theo cấu hình ca CỦA CÔNG TY (mặc định chỉ Chủ nhật, như cũ)
      let weekend: number[] = [0];
      try {
        const cfg = await getJson(d, `shift_config?select=weekend_days&company_id=eq.${co.id}`);
        if (Array.isArray(cfg) && Array.isArray(cfg[0]?.weekend_days) && cfg[0].weekend_days.length) weekend = cfg[0].weekend_days;
      } catch { /* fail-open: dùng mặc định */ }
      if (weekend.includes(p.dow)) { row.skipped = 'weekend'; perCompany.push(row); continue; }
      // 2) ngày lễ của công ty
      let holidays: string[] = [];
      try { holidays = (await getJson(d, `hrm_holidays?select=date&company_id=eq.${co.id}`)).map((h: any) => h.date).filter(Boolean); } catch { /* fail-open */ }
      if (holidays.includes(p.ddmm) || holidays.includes(p.ddmmyyyy)) { row.skipped = 'holiday'; perCompany.push(row); continue; }

      // 3) nhân viên đang làm, CHƯA được nhắc hôm nay
      const emps = await getJson(d, `employees?select=id,name,department,last_attendance_reminder_sent&status=eq.working&company_id=eq.${co.id}`);
      const need = (emps || []).filter((e: any) => e.last_attendance_reminder_sent !== p.today);
      row.needsReminder = need.length;
      if (!need.length) { perCompany.push(row); continue; }

      // 4) gửi push cho thiết bị của họ (chia lô để URL không quá dài)
      const payload = JSON.stringify({
        title: c.title, body: c.body, image: '', tag: `attendance-${shift}-${p.today}`,
        data: { url: '/', type: 'attendance', notificationType: shift, detailedContent: c.detail }, actions: [{ action: 'open', title: 'Điểm danh ngay' }],
      });
      const notified = new Set<string>(); let ok = 0, fail = 0;
      for (const ids of chunk(need.map((e: any) => e.id).filter((id: string) => /^[A-Za-z0-9_.:@-]{1,128}$/.test(id)), 100)) {
        const r = await pushToUsers(d, co.id, ids, payload);
        ok += r.successCount; fail += r.failureCount; r.notifiedUserIds.forEach((u: string) => notified.add(u));
      }
      row.pushSent = ok; row.pushFailed = fail;

      // 5) đánh dấu đã nhắc (chỉ trong công ty này) để không nhắc trùng
      for (const ids of chunk([...notified], 100)) {
        await d.fetchFn(`${d.supabaseUrl}/rest/v1/employees?company_id=eq.${co.id}&id=${pgIn(ids)}`,
          { method: 'PATCH', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' }, body: JSON.stringify({ last_attendance_reminder_sent: p.today }) });
      }
      // 6) thông báo trong ứng dụng (kèm company_id)
      for (const e of need) {
        await d.fetchFn(`${d.supabaseUrl}/rest/v1/notifications`, {
          method: 'POST', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' },
          body: JSON.stringify({
            id: `ATT-${p.today}-${c.code}-${co.id.slice(0, 8)}-${String(e.id).slice(0, 10)}`, company_id: co.id,
            recipient_id: e.id, recipient_name: e.name, department: e.department || 'Phòng Ban', title: c.title, content: c.body,
            detailed_content: c.detail, category: 'attendance', sub_task_code: c.code, sender_name: 'Phòng Hành Chính Nhân Sự',
            sender_avatar: 'NS', sender_id: 'system', read: false, created_at: now.toISOString(),
          }),
        }).catch(() => {});   // trùng id (đã có thông báo từ cron SQL) hoặc lỗi lẻ → bỏ qua, không chặn người khác
      }
    } catch (err: any) {
      row.error = String(err?.message || err).slice(0, 160);   // lỗi 1 công ty không chặn công ty khác
    }
    perCompany.push(row);
  }
  return { success: true, shift, vietnamTime: vnTime, companies: perCompany };
}
