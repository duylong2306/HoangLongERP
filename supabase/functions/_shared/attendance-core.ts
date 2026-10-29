// NHẮC ĐIỂM DANH qua Web Push + tin trong nhóm chat "Điểm danh" (postGroupReminder) — chạy cho TỪNG doanh nghiệp (đa doanh nghiệp). Hàm thuần nhận phụ thuộc qua tham số để test được.
// Đây là NGUỒN DUY NHẤT của nhắc điểm danh: pg_cron gọi hàm Edge này mỗi 5 phút (migration 20261029), hàm tự xét từng công ty
// xem đã đến lúc nhắc chưa. (Hàm SQL cũ trigger_attendance_reminders() chỉ ghi vào bảng notifications mà ứng dụng không đọc,
// lại đánh dấu cả công ty là "đã nhắc" nên chặn luôn đợt nhắc buổi chiều — đã ngừng dùng.)
//
// GIỜ NHẮC LẤY TỪ CẤU HÌNH CA CỦA TỪNG CÔNG TY (shift_config): nhắc đúng lúc MỞ ĐIỂM DANH = giờ vào ca − punch_open_before_minutes
// (mặc định 15 phút, kẹp 5–60), và chỉ nhắc cho tới giờ vào ca. Tin nhắc ghi đúng giờ vào ca / ra ca của công ty đó.
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

export interface ShiftPlan { shift: Shift; inTime: string; outTime: string; openTime: string }

const HM = /^(\d{1,2}):(\d{2})/;
const toMin = (v: unknown): number | null => { const m = typeof v === 'string' ? v.trim().match(HM) : null; return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fmtHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const MIN_LEAD = 5, MAX_LEAD = 60, DEFAULT_LEAD = 15;

/** Số phút mở điểm danh trước giờ vào ca: lấy từ cấu hình, thiếu/0/sai → 15; kẹp trong 5–60 để không nhắc quá sớm / sát giờ */
export function openLeadMinutes(cfg: any): number {
  const n = Number(cfg?.punch_open_before_minutes);
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_LEAD, Math.max(MIN_LEAD, Math.round(n))) : DEFAULT_LEAD;
}

/**
 * Ca nào đang trong "cửa sổ nhắc" lúc `nowMin` (phút trong ngày, giờ VN) theo cấu hình ca của công ty?
 * Cửa sổ = [giờ vào ca − số phút mở điểm danh, giờ vào ca). Thiếu cấu hình → giờ mặc định 07:30 / 13:00.
 */
export function reminderPlan(cfg: any, nowMin: number): ShiftPlan | null {
  const lead = openLeadMinutes(cfg);
  const shifts: { shift: Shift; inM: number; outM: number }[] = [
    { shift: 'morning', inM: toMin(cfg?.morning_in) ?? 450, outM: toMin(cfg?.morning_out) ?? 690 },
    { shift: 'afternoon', inM: toMin(cfg?.afternoon_in) ?? 780, outM: toMin(cfg?.afternoon_out) ?? 1020 },
  ];
  for (const x of shifts) {
    if (nowMin >= x.inM - lead && nowMin < x.inM) return { shift: x.shift, inTime: fmtHm(x.inM), outTime: fmtHm(x.outM), openTime: fmtHm(x.inM - lead) };
  }
  return null;
}

export function vnDateParts(now: Date) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, '0'), mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return { dow: vn.getUTCDay(), ddmm: `${dd}/${mm}`, ddmmyyyy: `${dd}/${mm}/${vn.getUTCFullYear()}`, today: `${vn.getUTCFullYear()}-${mm}-${dd}`, minutes: vn.getUTCHours() * 60 + vn.getUTCMinutes() };
}

/** Nội dung nhắc theo giờ ca THẬT của công ty (không còn viết cứng 07:30 / 13:00) */
export function reminderContent(plan: ShiftPlan) {
  const m = plan.shift === 'morning';
  const ca = m ? 'sáng' : 'chiều';
  return {
    title: `⏰ Điểm danh ca ${ca} · ${plan.inTime}`,
    body: `Đã mở điểm danh. Điểm danh trước ${plan.inTime} để không bị ghi nhận đi muộn.`,
    detail: `Ca ${ca}: ${plan.inTime} – ${plan.outTime}. Mở điểm danh từ ${plan.openTime}.`,
    chat: `⏰ Đã mở điểm danh ca ${ca}. Mời chấm công trước ${plan.inTime}.`,   // tin đăng vào nhóm chat "Điểm danh"
  };
}

export interface AttendanceDeps extends PushDeps { now?: Date }

/** Id cố định của nhóm chat "Điểm danh" (mỗi công ty có 1 nhóm riêng, phân biệt bằng company_id) — giống ATTENDANCE_CONV_ID ở chatStore.ts */
export const ATTENDANCE_CONV_ID = 'conv_attendance';

/**
 * ĐĂNG TIN NHẮC VÀO NHÓM CHAT "ĐIỂM DANH" lúc mở điểm danh — thay cho cách cũ "ai chấm trước thì gửi" (chỉ có tin khi đã có người chấm,
 * thường là lúc đã trễ, và không có tin nếu không ai chấm).
 * Mỗi công ty / ngày / ca đăng ĐÚNG 1 lần: "giành lượt" bằng cách chèn dòng (company_id, date, slot) vào attendance_chat_notified (trùng khóa → 409
 * → đã đăng rồi). Đăng tin lỗi thì trả lượt lại (xóa dòng) để lượt cron 5 phút sau thử lại. Chưa có nhóm (chưa ai đăng nhập tạo nhóm) → bỏ qua.
 * Trả về chuỗi trạng thái để ghi vào kết quả chạy: posted | already | no_group | post_error | claim_error.
 */
async function postGroupReminder(d: AttendanceDeps, companyId: string, plan: ShiftPlan, today: string, now: Date): Promise<string> {
  const convs = await getJson(d, `conversations?select=id,participant_ids,unread_counts&id=eq.${ATTENDANCE_CONV_ID}&company_id=eq.${companyId}`);
  const conv = Array.isArray(convs) ? convs[0] : null;
  if (!conv) return 'no_group';

  const slot = `reminder_${plan.shift}`;
  const claim = await d.fetchFn(`${d.supabaseUrl}/rest/v1/attendance_chat_notified`, {
    method: 'POST', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify({ company_id: companyId, date: today, slot, notified_by: 'cron' }),
  });
  if (!claim.ok) return claim.status === 409 ? 'already' : 'claim_error';

  const createdAt = now.toISOString();
  const content = reminderContent(plan).chat;
  const msg = await d.fetchFn(`${d.supabaseUrl}/rest/v1/chat_messages`, {
    method: 'POST', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: `msg_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`, conversation_id: ATTENDANCE_CONV_ID, company_id: companyId,
      sender_id: 'system', sender_name: 'Hệ Thống', sender_role: 'system', content, created_at: createdAt, read: false, attachments: [], system: true,
    }),
  });
  if (!msg.ok) {   // trả lượt lại để lần chạy sau đăng lại
    await d.fetchFn(`${d.supabaseUrl}/rest/v1/attendance_chat_notified?company_id=eq.${companyId}&date=eq.${today}&slot=eq.${slot}`, { method: 'DELETE', headers: hdr(d.serviceKey) });
    return 'post_error';
  }

  // Cập nhật hội thoại để danh sách chat hiện tin cuối + huy hiệu chưa đọc: mỗi thành viên +1 (người gửi là Hệ Thống, không phải thành viên)
  const counts: Record<string, number> = { ...(conv.unread_counts || {}) };
  for (const uid of (conv.participant_ids || [])) counts[uid] = (Number(counts[uid]) || 0) + 1;
  await d.fetchFn(`${d.supabaseUrl}/rest/v1/conversations?id=eq.${ATTENDANCE_CONV_ID}&company_id=eq.${companyId}`, {
    method: 'PATCH', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify({ last_message_at: createdAt, unread_counts: counts, last_message: { content, senderId: 'system', senderName: 'Hệ Thống', createdAt, deleted: false } }),
  });
  return 'posted';
}

async function getJson(d: AttendanceDeps, path: string): Promise<any> {
  const r = await d.fetchFn(`${d.supabaseUrl}/rest/v1/${path}`, { headers: hdr(d.serviceKey) });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 200));
  return r.json();
}

// Đơn có phải nghỉ phép THẬT (không tính báo cáo / giải trình chấm công)? Giữ đồng bộ với lib/leaveNotice.isRealLeaveType
const isRealLeave = (l: any) => !l.is_attendance_correction && !/^(Báo cáo|Yêu cầu xét duyệt)/i.test(String(l.type || ''));

export async function runAttendanceReminders(d: AttendanceDeps) {
  const now = d.now ?? new Date();
  const p = vnDateParts(now);
  const vnTime = fmtHm(p.minutes);

  // Chỉ doanh nghiệp đang hoạt động: không bị khóa (active) và chưa hết hạn gói — giống chính sách company_live ở cơ sở dữ liệu
  const companies = (await getJson(d, 'companies?select=id,slug,active,expires_at&active=eq.true'))
    .filter((co: any) => !co.expires_at || new Date(co.expires_at).getTime() > now.getTime());

  const perCompany: any[] = [];
  for (const co of companies) {
    const row: any = { company: co.slug };
    try {
      // 1) cấu hình ca CỦA CÔNG TY: ngày nghỉ cuối tuần + giờ vào/ra ca + số phút mở điểm danh (thiếu → mặc định như cũ)
      let cfg: any = null;
      try {
        const rows = await getJson(d, `shift_config?select=weekend_days,morning_in,morning_out,afternoon_in,afternoon_out,punch_open_before_minutes&company_id=eq.${co.id}`);
        cfg = Array.isArray(rows) ? rows[0] || null : null;
      } catch { /* fail-open: dùng mặc định */ }
      const weekend: number[] = Array.isArray(cfg?.weekend_days) && cfg.weekend_days.length ? cfg.weekend_days : [0];
      if (weekend.includes(p.dow)) { row.skipped = 'weekend'; perCompany.push(row); continue; }

      // 2) chưa đến cửa sổ nhắc của ca nào → bỏ qua (cron chạy 5 phút/lần nên hầu hết lượt chạy dừng ở đây, rất nhẹ)
      const plan = reminderPlan(cfg, p.minutes);
      if (!plan) { row.skipped = 'outside_window'; perCompany.push(row); continue; }
      row.shift = plan.shift;

      // 3) ngày lễ của công ty
      let holidays: string[] = [];
      try { holidays = (await getJson(d, `hrm_holidays?select=date&company_id=eq.${co.id}`)).map((h: any) => h.date).filter(Boolean); } catch { /* fail-open */ }
      if (holidays.includes(p.ddmm) || holidays.includes(p.ddmmyyyy)) { row.skipped = 'holiday'; perCompany.push(row); continue; }

      // 3b) đăng tin nhắc vào nhóm chat "Điểm danh" (1 lần / ca / ngày). Lỗi ở bước này không được chặn thông báo đẩy bên dưới
      try { row.chat = await postGroupReminder(d, co.id, plan, p.today, now); } catch (e: any) { row.chat = 'error'; row.chatError = String(e?.message || e).slice(0, 120); }

      // 4) nhân viên đang làm, CHƯA được nhắc CHO CA NÀY hôm nay (dấu "YYYY-MM-DD:ca" — sáng và chiều nhắc độc lập; dấu cũ chỉ có ngày nên không chặn)
      const mark = `${p.today}:${plan.shift}`;
      const emps = await getJson(d, `employees?select=id,name,last_attendance_reminder_sent&status=eq.working&company_id=eq.${co.id}`);
      let need = (emps || []).filter((e: any) => e.last_attendance_reminder_sent !== mark);

      // 5) bỏ người KHÔNG cần nhắc: đã điểm danh vào ca này rồi, hoặc đang nghỉ phép được duyệt hôm nay (cả ngày hoặc đúng ca này)
      try {
        const att = await getJson(d, `attendance_records?select=emp_id,time_in_s,time_in_c&date=eq.${p.today}&company_id=eq.${co.id}`);
        const done = new Set((att || []).filter((a: any) => (plan.shift === 'morning' ? a.time_in_s : a.time_in_c)).map((a: any) => a.emp_id));
        const leaves = await getJson(d, `hrm_leaves?select=emp_id,type,shift,is_attendance_correction,from_date,to_date&status=eq.approved&company_id=eq.${co.id}`);
        const onLeave = new Set((leaves || []).filter((l: any) => isRealLeave(l) && l.from_date <= p.today && p.today <= (l.to_date || l.from_date) && (!l.shift || l.shift === plan.shift)).map((l: any) => l.emp_id));
        need = need.filter((e: any) => !done.has(e.id) && !onLeave.has(e.id));
      } catch { /* fail-open: không lọc được thì nhắc cả những người này, còn hơn bỏ sót */ }
      row.needsReminder = need.length;
      if (!need.length) { perCompany.push(row); continue; }

      // 6) gửi push cho thiết bị của họ (chia lô để URL không quá dài)
      const c = reminderContent(plan);
      const payload = JSON.stringify({
        title: c.title, body: c.body, image: '', tag: `attendance-${plan.shift}-${p.today}`,
        data: { url: '/', type: 'attendance', notificationType: plan.shift, detailedContent: c.detail }, actions: [{ action: 'open', title: 'Điểm danh ngay' }],
      });
      const notified = new Set<string>(); let ok = 0, fail = 0;
      for (const ids of chunk(need.map((e: any) => e.id).filter((id: string) => /^[A-Za-z0-9_.:@-]{1,128}$/.test(id)), 100)) {
        const r = await pushToUsers(d, co.id, ids, payload);
        ok += r.successCount; fail += r.failureCount; r.notifiedUserIds.forEach((u: string) => notified.add(u));
      }
      row.pushSent = ok; row.pushFailed = fail;

      // 7) đánh dấu đã nhắc cho ca này (chỉ trong công ty này) để 5 phút sau không nhắc lại. Người chưa có thiết bị push cũng được đánh dấu
      //    — nếu không, họ bị truy vấn lại mỗi 5 phút cho tới giờ vào ca mà vẫn không có thiết bị nào để gửi.
      for (const ids of chunk(need.map((e: any) => e.id).filter((id: string) => /^[A-Za-z0-9_.:@-]{1,128}$/.test(id)), 100)) {
        await d.fetchFn(`${d.supabaseUrl}/rest/v1/employees?company_id=eq.${co.id}&id=${pgIn(ids)}`,
          { method: 'PATCH', headers: { ...hdr(d.serviceKey), Prefer: 'return=minimal' }, body: JSON.stringify({ last_attendance_reminder_sent: mark }) });
      }
    } catch (err: any) {
      row.error = String(err?.message || err).slice(0, 160);   // lỗi 1 công ty không chặn công ty khác
    }
    perCompany.push(row);
  }
  return { success: true, vietnamTime: vnTime, companies: perCompany };
}
