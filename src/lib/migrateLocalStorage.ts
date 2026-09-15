import { dbService } from './dbService';
import { getSupabase } from './supabase';

/**
 * MIGRATION MỘT LẦN: Đọc dữ liệu nghiệp vụ cũ đang nằm trong localStorage
 * (từ trước khi app chuyển sang Supabase làm nguồn duy nhất) và đẩy lên
 * Supabase, sau đó xóa key để app không còn phụ thuộc localStorage.
 *
 * Chỉ chạy một lần, đánh dấu bằng key `hl_erp_migrated_v1`.
 * Các key KHÔNG migrate (giữ lại vì bản chất client-side): auth session,
 * supabase config, UI prefs, draft tạm thời.
 */

const MIGRATION_MARKER = 'hl_erp_migrated_v1';

/** Đọc + parse localStorage an toàn. Trả về null nếu không có / lỗi. */
function readLS<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[Migrate] Parse localStorage "${key}" thất bại:`, e);
    return null;
  }
}

function removeLS(key: string) {
  try { localStorage.removeItem(key); } catch (e) { /* noop */ }
}

/** Migration dữ liệu HR: leaves, leaveCoefficients, holidays, payroll */
async function migrateHrData(): Promise<void> {
  // ── Đơn nghỉ phép ──
  const leaves = readLS<any[]>('hl_hrm_leaves_v3');
  if (Array.isArray(leaves) && leaves.length > 0) {
    const existing = await dbService.hrmLeaves.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((l: any) => l.id));
    const newOnes = leaves.filter((l: any) => l && l.id && !existingIds.has(l.id));
    for (const l of newOnes) {
      await dbService.hrmLeaves.save(l).catch(err => console.warn('[Migrate] save leave thất bại:', err));
    }
    removeLS('hl_hrm_leaves_v3');
  }

  // ── Hệ số nghỉ phép (2 phiên bản key cũ) ──
  const coefs = readLS<any[]>('hl_hrm_leave_coefs_v6') ?? readLS<any[]>('hl_hrm_leave_coefs_v5');
  if (Array.isArray(coefs) && coefs.length > 0) {
    const existing = await dbService.hrmLeaveCoefficients.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((c: any) => c.id));
    for (const c of coefs) {
      if (c && c.id && !existingIds.has(c.id)) {
        await dbService.hrmLeaveCoefficients.save(c).catch(err => console.warn('[Migrate] save coef thất bại:', err));
      }
    }
    removeLS('hl_hrm_leave_coefs_v6');
    removeLS('hl_hrm_leave_coefs_v5');
  }

  // ── Ngày lễ ──
  const holidays = readLS<any[]>('hl_hrm_holidays_v3');
  if (Array.isArray(holidays) && holidays.length > 0) {
    const existing = await dbService.hrmHolidays.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((h: any) => h.id));
    for (const h of holidays) {
      if (h && h.id && !existingIds.has(h.id)) {
        await dbService.hrmHolidays.save(h).catch(err => console.warn('[Migrate] save holiday thất bại:', err));
      }
    }
    removeLS('hl_hrm_holidays_v3');
  }

  // ── Bảng lương ──
  const payroll = readLS<any[]>('hl_hrm_payroll_v3');
  if (Array.isArray(payroll) && payroll.length > 0) {
    const existing = await dbService.hrmPayrollRecords.list().catch(() => [] as any[]);
    const existingKeys = new Set((existing || []).map((p: any) => `${p.empId}_${p.month}`));
    for (const p of payroll) {
      const key = `${p.empId}_${p.month}`;
      if (p && key && !existingKeys.has(key)) {
        await dbService.hrmPayrollRecords.save(p).catch(err => console.warn('[Migrate] save payroll thất bại:', err));
      }
    }
    removeLS('hl_hrm_payroll_v3');
  }
}

/** Migration dữ liệu tài chính/kho: subcontractor advances + các bảng acc_* */
async function migrateFinanceData(): Promise<void> {
  // ── Đề xuất tạm ứng thầu ──
  const advances = readLS<any[]>('hl_subcontractor_advances');
  if (Array.isArray(advances) && advances.length > 0) {
    const existing = await dbService.subcontractorAdvances.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((a: any) => a.id));
    for (const a of advances) {
      if (a && a.id && !existingIds.has(a.id)) {
        await dbService.subcontractorAdvances.save(a).catch(err => console.warn('[Migrate] save advance thất bại:', err));
      }
    }
    removeLS('hl_subcontractor_advances');
  }

  // ── Kho / sản phẩm ──
  const products = readLS<any[]>('hl_acc_products');
  if (Array.isArray(products) && products.length > 0) {
    const existing = await dbService.accountingProductCatalog.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((p: any) => p.id));
    for (const p of products) {
      if (p && p.id && !existingIds.has(p.id)) {
        await dbService.accountingProductCatalog.save(p).catch(err => console.warn('[Migrate] save product thất bại:', err));
      }
    }
    removeLS('hl_acc_products');
  }

  // ── Kho / tồn kho ──
  const inventory = readLS<any[]>('hl_acc_inventory');
  if (Array.isArray(inventory) && inventory.length > 0) {
    const existing = await dbService.inventory.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((i: any) => i.id));
    for (const i of inventory) {
      if (i && i.id && !existingIds.has(i.id)) {
        await dbService.inventory.save(i).catch(err => console.warn('[Migrate] save inventory thất bại:', err));
      }
    }
    removeLS('hl_acc_inventory');
  }

  // ── Nhà cung cấp vật tư (material suppliers) ──
  const materialSuppliers = readLS<any[]>('hl_acc_material_suppliers');
  if (Array.isArray(materialSuppliers) && materialSuppliers.length > 0) {
    const existing = await dbService.suppliers.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((s: any) => s.id));
    for (const s of materialSuppliers) {
      if (s && s.id && !existingIds.has(s.id)) {
        await dbService.suppliers.save(s).catch(err => console.warn('[Migrate] save material supplier thất bại:', err));
      }
    }
    removeLS('hl_acc_material_suppliers');
  }

  // ── Danh sách thầu phụ (accounting subcontractors) - từ localStorage hl_acc_suppliers ──
  const subcontractors = readLS<any[]>('hl_acc_suppliers');
  if (Array.isArray(subcontractors) && subcontractors.length > 0) {
    const existing = await dbService.accountingSubcontractors.list().catch(() => [] as any[]);
    const existingIds = new Set((existing || []).map((s: any) => s.id));
    for (const s of subcontractors) {
      if (s && s.id && !existingIds.has(s.id)) {
        await dbService.accountingSubcontractors.save(s).catch(err => console.warn('[Migrate] save subcontractor thất bại:', err));
      }
    }
    removeLS('hl_acc_suppliers');
  }
}

/** Migration các cache đơn giản mà đã có bảng Supabase tương ứng */
async function migrateCaches(): Promise<void> {
  const simpleMigrations: { key: string; save: (v: any) => Promise<void> }[] = [
    { key: 'hl_hrm_approval_config', save: v => dbService.hrmApprovalConfig.save(v) },
  ];
  for (const m of simpleMigrations) {
    const val = readLS<any>(m.key);
    if (val) {
      await m.save(val).catch(err => console.warn(`[Migrate] save ${m.key} thất bại:`, err));
      removeLS(m.key);
    }
  }
}

/**
 * Điểm vào chính. Chạy sau khi Supabase client sẵn sàng (getSupabase() != null).
 * Idempotent nhờ marker. Không throw — mọi lỗi được bắt để không chặn app.
 */
export async function migrateLegacyData(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATION_MARKER) === 'done') return;
    if (!getSupabase()) {
      console.warn('[Migrate] Supabase chưa sẵn sàng — bỏ qua migration đợt này.');
      return;
    }

    console.log('[Migrate] Bắt đầu migrate dữ liệu cũ từ localStorage → Supabase...');
    await migrateHrData();
    await migrateFinanceData();
    await migrateCaches();

    localStorage.setItem(MIGRATION_MARKER, 'done');
    console.log('[Migrate] Hoàn tất migrate dữ liệu cũ.');
  } catch (e) {
    console.error('[Migrate] Lỗi migrate:', e);
  }
}
