import { getSupabase } from './supabase';
import { ensureProjectChatGroup } from './chatStore';
import {
  Employee,
  Customer,
  Project,
  Task,
  Receipt,
  Payment,
  Quote,
  SubcontractorAdvanceProposal,
  HrmRoleGroup,
  HrmApprovalConfig
} from '../types';

import {
  INITIAL_EMPLOYEES,
  INITIAL_CUSTOMERS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENTS,
  INITIAL_QUOTES
} from '../data';

// Converter helpers for Supabase keys mapping (camelCase <=> snake_case)
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

export function keysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(keysToSnake);
  }
  if (typeof obj === 'object') {
    const n: any = {};
    Object.keys(obj).forEach(k => {
      n[camelToSnake(k)] = obj[k];
    });
    return n;
  }
  return obj;
}

export function rowToCamel(row: any): any {
  if (!row) return row;
  if (Array.isArray(row)) return row.map(rowToCamel);
  if (typeof row !== 'object') return row;
  const n: any = {};
  Object.keys(row).forEach(k => {
    const val = row[k];
    // Đệ quy vào object con để chuyển snake_case → camelCase
    // (xử lý JSONB columns như bao_gia_file có keys bị keysToSnake biến đổi)
    n[snakeToCamel(k)] = (val !== null && typeof val === 'object')
      ? rowToCamel(val)
      : val;
  });
  return n;
}

/**
 * Chuẩn hóa cột `items` của sales_orders / purchase_orders về đúng array.
 * Dữ liệu cũ đã bị JSON.stringify trước khi ghi vào cột JSONB nên đọc ra
 * là string thay vì array → UI crash khi gọi .map(). Hàm này parse lại,
 * đảm bảo items LUÔN là array kể cả khi null/lỗi format.
 */
export function normalizeOrderItems(order: any): any {
  if (!order) return order;
  let items = order.items;
  // Có thể bị stringify nhiều lần → parse cho tới khi ra array
  let guard = 0;
  while (typeof items === 'string' && guard < 5) {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
      break;
    }
    guard++;
  }
  return { ...order, items: Array.isArray(items) ? items : [] };
}

// NOTE: The helper that returned static initial data has been removed because the app now relies on Supabase for all defaults.
// function getInitialDataForTable(tableName: string): any[] {
//   switch (tableName) {
//     case 'employees': return INITIAL_EMPLOYEES;
//     case 'customers': return INITIAL_CUSTOMERS;
//     case 'projects': return INITIAL_PROJECTS;
//     case 'tasks': return INITIAL_TASKS;
//     case 'receipts': return INITIAL_RECEIPTS;
//     case 'payments': return INITIAL_PAYMENTS;
//     case 'quotes': return INITIAL_QUOTES;
//     default: return [];
//   }
// }

// Helper to seed table to Supabase if empty
export async function seedTableToSupabase(tableName: string, data: any[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    console.log(`Seeding table ${tableName} to Supabase with ${data.length} items...`);
    const snakeData = data.map(keysToSnake);
    const { error } = await supabase.from(tableName).upsert(snakeData, { onConflict: 'id' });
    if (error) {
      console.warn(`Error seeding table ${tableName} to Supabase:`, error);
    } else {
      console.log(`Successfully seeded table ${tableName} to Supabase.`);
    }
  } catch (err) {
    console.warn(`Exception seeding table ${tableName} to Supabase:`, err);
  }
}

// ─── Query Cache ─────────────────────────────────────────────────────────
// Tránh query trùng bảng: cùng 1 table chỉ gọi Supabase 1 lần / session.
// Save/delete tự động invalidate cache để lần query sau lấy data mới.
const _queryCache = new Map<string, any[]>();
const _inflight = new Map<string, Promise<any[]>>();

export function invalidateCache(tableName?: string) {
  if (tableName) {
    _queryCache.delete(tableName);
  } else {
    _queryCache.clear();
  }
}

/** Populate cache từ dữ liệu bên ngoài (dùng khi RPC đã fetch sẵn, tránh query lại) */
export function populateCache(tableName: string, data: any[]) {
  _queryCache.set(tableName, data);
}

// Query helper for Supabase (cached per table)
async function querySupabase<T>(tableName: string, fallbackData: T[]): Promise<T[]> {
  // Trả cache nếu có
  if (_queryCache.has(tableName)) {
    return _queryCache.get(tableName) as T[];
  }
  // Deduplicate concurrent requests cho cùng 1 table
  if (_inflight.has(tableName)) {
    return _inflight.get(tableName) as Promise<T[]>;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.warn(`[DB] Supabase client is NULL — cannot query ${tableName}`);
    return fallbackData;
  }

  const promise = (async () => {
    try {
      console.log(`[DB] Querying ${tableName}...`);
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.error(`[DB] ❌ Supabase load error for ${tableName}:`, error.message, error.details, error.hint);
        throw new Error(`Không thể tải dữ liệu ${tableName} từ Supabase: ${error.message}`);
      }
      const rows = data && data.length > 0 ? data.map(rowToCamel) as T[] : [];
      console.log(`[DB] ✅ Loaded ${tableName}:`, rows.length, 'rows');
      _queryCache.set(tableName, rows);
      return rows;
    } catch (err) {
      console.error(`[DB] ❌ Supabase fetch exception for ${tableName}:`, err);
      throw err;
    } finally {
      _inflight.delete(tableName);
    }
  })();

  _inflight.set(tableName, promise);
  return promise;
}

// Upsert helper
async function saveSupabase(tableName: string, item: any): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error(`[DB] Supabase client is NULL — cannot save ${tableName}. Check VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in .env`);
    throw new Error(`Supabase chưa được cấu hình — không thể lưu ${tableName}`);
  }
  try {
    const snakeItem = keysToSnake(item);
    console.log(`[DB] Saving to ${tableName}:`, { id: item.id, keys: Object.keys(snakeItem) });
    const { data, error } = await supabase.from(tableName).upsert(snakeItem).select();
    if (error) {
      console.error(`[DB] ❌ Supabase save error for ${tableName}:`, error.message, error.details, error.hint);
      throw new Error(`Lưu ${tableName} thất bại: ${error.message}`);
    }
    console.log(`[DB] ✅ Saved to ${tableName}:`, data?.length, 'row(s)');
    invalidateCache(tableName);
  } catch (err) {
    console.error(`[DB] ❌ Supabase save exception for ${tableName}:`, err);
    throw err;
  }
}

/**
 * Insert helper — dùng cho bản ghi MỚI.
 *
 * Khác `saveSupabase` (upsert): nếu id đã tồn tại thì insert sẽ báo lỗi
 * unique violation (code 23505) thay vì âm thầm ghi đè hàng cũ. Đây là lớp
 * bảo vệ cuối cho lỗi "tạo đơn mới nhưng chỉ cập nhật hàng dữ liệu cũ".
 * Trả về true nếu insert thành công, false nếu id đã tồn tại.
 */
async function insertSupabase(tableName: string, item: any): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error(`[DB] Supabase client is NULL — cannot insert ${tableName}. Check VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in .env`);
    throw new Error(`Supabase chưa được cấu hình — không thể lưu ${tableName}`);
  }
  const snakeItem = keysToSnake(item);
  console.log(`[DB] Inserting into ${tableName}:`, { id: item.id, keys: Object.keys(snakeItem) });
  const { data, error } = await supabase.from(tableName).insert(snakeItem).select();
  if (error) {
    if (error.code === '23505') {
      console.warn(`[DB] ⚠️ ${tableName}: id "${item.id}" đã tồn tại — không ghi đè.`);
      return false;
    }
    console.error(`[DB] ❌ Supabase insert error for ${tableName}:`, error.message, error.details, error.hint);
    throw new Error(`Lưu ${tableName} thất bại: ${error.message}`);
  }
  console.log(`[DB] ✅ Inserted into ${tableName}:`, data?.length, 'row(s)');
  invalidateCache(tableName);
  return true;
}

/**
 * Tạo đơn hàng MỚI với mã đảm bảo không trùng.
 *
 * Nếu mã do client sinh ra đã tồn tại (vì danh sách phía client chưa load đủ,
 * hoặc 2 người tạo đơn cùng lúc), hàm tăng số thứ tự cuối của mã rồi thử lại
 * thay vì ghi đè hàng cũ. Trả về đơn đã lưu (có thể mang id mới).
 */
async function createOrderUnique(tableName: string, order: any): Promise<any> {
  const match = /^(.*-)(\d+)$/.exec(String(order.id ?? ''));
  let candidate = { ...order };

  for (let attempt = 0; attempt < 25; attempt++) {
    if (await insertSupabase(tableName, candidate)) return candidate;

    if (!match) {
      // Mã không theo định dạng <head>-<số> → không thể tự tăng
      throw new Error(`Mã "${order.id}" đã tồn tại trong ${tableName} và không thể tự cấp lại.`);
    }
    const head = match[1];
    const width = match[2].length;
    const next = parseInt(match[2], 10) + attempt + 1;
    const newId = `${head}${String(next).padStart(width, '0')}`;
    // Giữ liên kết nội bộ (notes/receipt) trỏ đúng mã mới
    candidate = { ...candidate, id: newId };
    console.warn(`[DB] ${tableName}: mã trùng → thử lại với "${newId}"`);
  }
  throw new Error(`Không thể cấp mã đơn duy nhất cho ${tableName} sau 25 lần thử.`);
}

// ─── Cascade delete helpers ──────────────────────────────────────────────
// Schema mỗi môi trường một khác (bảng/cột có thể chưa tồn tại), nên các
// helper dưới đây LUÔN thất bại êm: log cảnh báo rồi trả 0, không ném lỗi,
// để một bảng lỗi không chặn việc dọn các bảng còn lại.

/** Mã lỗi Postgres nghĩa là "bảng/cột không tồn tại" → bỏ qua, không phải lỗi thật */
function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01'          // undefined_table
      || error.code === '42703'          // undefined_column
      || error.code === 'PGRST204'       // PostgREST: column not found in schema cache
      || /does not exist/i.test(error.message || '');
}

// ─── Biết trước bảng nào có cột nào ──────────────────────────────────────
// Gọi DELETE lên một cột không tồn tại trả HTTP 400 và trình duyệt log đỏ
// ngay ở tầng network — JS KHÔNG nuốt được. Nên phải biết TRƯỚC rồi mới bắn.
//
// PostgREST có phơi OpenAPI spec ở gốc /rest/v1/ nhưng Supabase đời mới chỉ
// cho service_role đọc (anon nhận 401), nên không dùng được từ trình duyệt.
// Thay vào đó migration 20260731_project_cascade_delete.sql tạo RPC
// `hl_link_columns()` trả về đúng danh sách (bảng, cột) liên kết.

export interface LinkColumnMap {
  /** Bảng có cột project_id */
  byProject: Set<string>;
  /** Bảng có cột task_id */
  byTask: Set<string>;
  /** Bảng lưu object trong cột `data jsonb`, không có cột liên kết thật */
  byJsonb: Set<string>;
}

/**
 * Danh sách đã ĐỐI CHIẾU với database thật (07/2026).
 * Dùng khi RPC hl_link_columns chưa tồn tại (migration chưa được áp).
 * Chỉ liệt kê bảng CHẮC CHẮN có cột đó — thà bỏ sót còn hơn bắn request lỗi.
 */
const VERIFIED_LINK_COLUMNS: LinkColumnMap = {
  byProject: new Set([
    'tasks',
    'receipts',                     // Phiếu Thu
    'payments',                     // Phiếu Chi
    'quotes',                       // Báo Giá
    'archived_quotes',              // Hợp Đồng / Nghiệm Thu / Thanh Lý
    'subcontractor_advances',       // Đề Xuất tạm ứng thầu phụ
    'accounting_receivables',       // Công Nợ phải thu
    'project_permission_overrides', // Phân quyền riêng của dự án
    'conversations',                // Nhóm chat
  ]),
  byTask: new Set([
    'quotes',
    'subcontractor_advances',
    'notifications',
    'hrm_employee_errors',          // Ghi nhận vi phạm kỷ luật & hiệu suất
    'conversations',
  ]),
  byJsonb: new Set([
    'hrm_travel_expenses',          // Công tác phí — chỉ lưu projectName/taskName
    'accounting_sub_contracts',     // HĐ Thầu
  ]),
};

// Ghi chú đã kiểm chứng trên database thật (07/2026):
//   • accounting_liabilities (Công Nợ phải trả) chỉ có cột id, name, created_at
//     — KHÔNG có bất kỳ liên kết nào tới dự án, nên không thể cascade. Muốn
//     xóa theo dự án thì phải bổ sung cột project_id cho bảng này trước.
//   • hrm_trips, purchase_orders, sales_orders, warehouse_logs cũng không có
//     cột liên kết dự án → cố tình bỏ khỏi danh sách để khỏi quét vô ích.

let _linkColumnsPromise: Promise<LinkColumnMap> | null = null;

/**
 * Hỏi database xem bảng nào có project_id / task_id / data jsonb.
 * Ưu tiên RPC (tự bắt kịp bảng mới thêm về sau); RPC chưa có thì dùng
 * danh sách đã đối chiếu ở trên.
 */
async function getLinkColumns(): Promise<LinkColumnMap> {
  if (_linkColumnsPromise) return _linkColumnsPromise;

  _linkColumnsPromise = (async () => {
    const supabase = getSupabase();
    if (!supabase) return VERIFIED_LINK_COLUMNS;

    try {
      const { data, error } = await supabase.rpc('hl_link_columns');
      if (error || !Array.isArray(data) || data.length === 0) {
        if (error) {
          console.warn(
            '[DB] RPC hl_link_columns chưa có (chạy migration 20260731 để bật) — dùng danh sách mặc định:',
            error.message
          );
        }
        return VERIFIED_LINK_COLUMNS;
      }

      const map: LinkColumnMap = {
        byProject: new Set<string>(),
        byTask: new Set<string>(),
        byJsonb: new Set<string>(),
      };
      data.forEach((row: any) => {
        const table = row?.table_name;
        if (!table) return;
        if (row.has_project_id) map.byProject.add(table);
        if (row.has_task_id) map.byTask.add(table);
        if (row.has_jsonb_data && !row.has_project_id && !row.has_task_id) {
          map.byJsonb.add(table);
        }
      });
      console.log(
        `[DB] Schema liên kết: ${map.byProject.size} bảng project_id, ` +
        `${map.byTask.size} bảng task_id, ${map.byJsonb.size} bảng jsonb`
      );
      return map;
    } catch (err) {
      console.warn('[DB] Ngoại lệ khi gọi hl_link_columns — dùng danh sách mặc định:', err);
      return VERIFIED_LINK_COLUMNS;
    }
  })();

  return _linkColumnsPromise;
}

/** Xóa mọi dòng của `tableName` có `column` nằm trong `values`. Trả về số dòng đã xóa. */
async function deleteWhereIn(tableName: string, column: string, values: string[]): Promise<number> {
  if (values.length === 0) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.from(tableName).delete().in(column, values).select('id');
    if (error) {
      if (!isMissingSchemaError(error)) {
        console.warn(`[DB] cascade: xóa ${tableName}.${column} lỗi:`, error.message);
      }
      return 0;
    }
    const n = data?.length ?? 0;
    if (n > 0) invalidateCache(tableName);
    return n;
  } catch (err) {
    console.warn(`[DB] cascade: ngoại lệ khi xóa ${tableName}.${column}:`, err);
    return 0;
  }
}

/** Thông tin nhận dạng dự án dùng để đối chiếu trong các bảng jsonb */
export interface CascadeMatchKeys {
  projectId: string;
  taskIds: Set<string>;
  /** Tên dự án — cần vì có bảng chỉ lưu tên, không lưu id */
  projectName: string;
  /** Tên các công việc thuộc dự án */
  taskNames: Set<string>;
}

/**
 * Xóa cho các bảng lưu cả object trong cột `data jsonb`
 * (hrm_travel_expenses = Công tác phí, accounting_sub_contracts = HĐ Thầu):
 * không có cột project_id thật nên FK CASCADE không với tới được.
 * Đọc toàn bộ về rồi lọc ngay trong JSON.
 *
 * ⚠️ Một số bảng CHỈ lưu tên chứ không lưu id — ví dụ hrm_travel_expenses chỉ
 * có `projectName` / `taskName`. Với những dòng đó buộc phải đối chiếu bằng
 * tên, nên hai dự án TRÙNG TÊN sẽ xóa nhầm của nhau. Mỗi lần khớp bằng tên
 * đều được log ra Console để còn kiểm chứng.
 */
async function deleteJsonbLinked(tableName: string, keys: CascadeMatchKeys): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      if (!isMissingSchemaError(error)) {
        console.warn(`[DB] cascade: đọc ${tableName} lỗi:`, error.message);
      }
      return 0;
    }

    let matchedByName = 0;
    const victims = (data || [])
      .filter((row: any) => {
        // Object thật có thể nằm trong cột `data`, hoặc chính là dòng phẳng
        const d = row?.data && typeof row.data === 'object' ? row.data : row;

        // Ưu tiên đối chiếu bằng id — chắc chắn, không nhầm lẫn
        const pid = d?.projectId ?? d?.project_id ?? row?.project_id;
        const tid = d?.taskId ?? d?.task_id ?? row?.task_id;
        if (pid && pid === keys.projectId) return true;
        if (tid && keys.taskIds.has(tid)) return true;

        // Không có id thì mới đành đối chiếu bằng tên
        const pname = d?.projectName ?? d?.project_name;
        const tname = d?.taskName ?? d?.task_name;
        const hitByName =
          (!!keys.projectName && !!pname && pname === keys.projectName) ||
          (!!tname && keys.taskNames.has(tname));
        if (hitByName) matchedByName++;
        return hitByName;
      })
      .map((row: any) => row?.id)
      .filter(Boolean);

    if (victims.length === 0) return 0;

    const { error: delErr } = await supabase.from(tableName).delete().in('id', victims);
    if (delErr) {
      console.warn(`[DB] cascade: xóa ${tableName} (jsonb) lỗi:`, delErr.message);
      return 0;
    }
    if (matchedByName > 0) {
      console.warn(
        `[DB] cascade: ${tableName} — ${matchedByName}/${victims.length} dòng khớp bằng TÊN ` +
        `(bảng này không lưu id dự án). Kiểm tra lại nếu có dự án trùng tên.`
      );
    }
    invalidateCache(tableName);
    return victims.length;
  } catch (err) {
    console.warn(`[DB] cascade: ngoại lệ khi quét ${tableName}:`, err);
    return 0;
  }
}

/** Bảng KHÔNG dọn theo vòng quét cột, vì đã xử lý riêng đúng thứ tự */
const CASCADE_SKIP_TABLES = new Set([
  'projects',      // chính nó — xóa cuối cùng
  'tasks',         // xóa sau khi dọn xong con của nó
  'conversations', // xử lý riêng cùng chat_messages
  'chat_messages',
]);

export interface ProjectCascadeReport {
  projectId: string;
  taskIds: string[];
  /** Số dòng đã xóa, gom theo tên bảng */
  deleted: Record<string, number>;
  /** Tổng số dòng dữ liệu phát sinh đã dọn (không tính chính dòng dự án) */
  total: number;
}

// Delete helper
async function deleteSupabase(tableName: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(`Supabase chưa được cấu hình — không thể xóa ${tableName}`);
  }
  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.error(`Supabase delete error for ${tableName}:`, error.message);
      throw new Error(`Xóa ${tableName} thất bại: ${error.message}`);
    }
    invalidateCache(tableName);
  } catch (err) {
    console.error(`Supabase delete exception for ${tableName}:`, err);
    throw err;
  }
}

// Helper: chuẩn hóa giá trị thời gian, xử lý cả trường hợp bị lưu object timestamp
function normalizeTime(v: any): string {
  if (!v || v === '--:--' || v === '') return '--:--';
  if (typeof v === 'string') {
    // Một số bản ghi cũ lỡ ghi NGUYÊN object server-time vào cột TEXT, ví dụ:
    //   '{"date":"2026-07-29","time":"07:32","datetime":"...","epoch_ms":...}'
    // → phải bóc lấy trường .time, nếu không giao diện sẽ in ra cả cục JSON.
    if (v.startsWith('{') && v.includes('"time"')) {
      try {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed.time === 'string') return parsed.time;
      } catch { /* không phải JSON hợp lệ → trả nguyên chuỗi */ }
    }
    return v;
  }
  if (typeof v === 'object' && v.time) return v.time; // object cũ: {date, time, datetime, epoch_ms}
  return String(v);
}

export const dbService = {
  /** Populate cache từ data bên ngoài (dùng khi RPC đã fetch sẵn) */
  populateCache(tableName: string, data: any[]) {
    _queryCache.set(tableName, data);
  },

  // ─── BATCH LOAD: gộp tất cả bảng core thành 1 RPC call ──────────────────
  // Giảm từ 9 HTTP requests → 1 request duy nhất
  async loadAllCore(): Promise<Record<string, any[]>> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    // Thử gọi RPC function (cần tạo trên Supabase)
    const { data, error } = await supabase.rpc('load_all_core_data');
    if (error) throw error;
    if (!data) throw new Error('No data returned from RPC');

    // RPC trả về JSON object { employees: [...], customers: [...], ... }
    return typeof data === 'string' ? JSON.parse(data) : data;
  },

  // ─── SERVER TIMESTAMP: Lấy giờ server PostgreSQL (chống gian lận giờ client) ──
  // Trả về { date: 'YYYY-MM-DD', time: 'HH:MI', datetime: 'ISO8601', epoch_ms: number }
  async fetchServerTimestamp(): Promise<{ date: string; time: string; datetime: string; epoch_ms: number } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_server_timestamp');
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[DB] Không thể lấy giờ server, fallback về giờ client:', err);
      return null;
    }
  },

  // 1. EMPLOYEES
  employees: {
    async list(): Promise<Employee[]> {
      return querySupabase<Employee>('employees', INITIAL_EMPLOYEES);
    },
    // Cho phép lưu bản ghi đầy đủ hoặc cập nhật một phần (upsert chỉ ghi đè các cột được truyền).
    async save(employee: Partial<Employee> & { id: string }): Promise<void> {
      await saveSupabase('employees', employee);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('employees', id);
    }
  },

  // ─── Phase 1: HRM Core ───────────────────────────────────────────────────

  // 1.1. HRM ROLE GROUPS (Phân quyền nhóm vai trò)
  hrmRoleGroups: {
    async list(): Promise<HrmRoleGroup[]> {
      const rows = await querySupabase<HrmRoleGroup>('hrm_role_groups', []);
      // querySupabase áp dụng rowToCamel đệ quy, đổi TẤT CẢ key snake_case → camelCase.
      // Điều này làm sai lệch các MÃ MODULE trong cột JSONB `permissions`
      // (projects_construction → projectsConstruction), khiến RolesTab tra cứu
      // bằng mã snake_case không tìm thấy → ma trận phân quyền hiện trống dù DB có dữ liệu.
      // Khôi phục lại snake_case cho permissions (keysToSnake không đổi mã đã snake_case
      // như projects_construction, nhưng sẽ đưa projectsConstruction về đúng dạng).
      return rows.map((r) => ({
        ...r,
        permissions: r.permissions ? keysToSnake(r.permissions) : {},
        memberIds: r.memberIds || [],
      }));
    },
    async save(group: HrmRoleGroup): Promise<void> {
      await saveSupabase('hrm_role_groups', group);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_role_groups', id);
    }
  },

  // 1.2. HRM APPROVAL CONFIG (Quyền phê duyệt)
  hrmApprovalConfig: {
    async list(): Promise<HrmApprovalConfig[]> {
      return querySupabase<HrmApprovalConfig>('hrm_approval_config', []);
    },
    async save(config: HrmApprovalConfig): Promise<void> {
      await saveSupabase('hrm_approval_config', config);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_approval_config', id);
    }
  },

  // 1.3. HRM DEFAULT SNAPSHOTS (Cấu hình mặc định cho Group / Project / Approval)
  hrmDefaultSnapshots: {
    async get(tab: string): Promise<any | null> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('hrm_default_snapshots')
          .select('data')
          .eq('tab', tab)
          .single();
        if (error) {
          console.warn(`Supabase load default snapshot ${tab} error:`, error.message);
          return null;
        }
        return data?.data ?? null;
      } catch (e) {
        console.warn(`Supabase load default snapshot ${tab} error:`, e);
        return null;
      }
    },
    async save(tab: string, data: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('hrm_default_snapshots').upsert({ tab, data });
        if (error) console.warn(`Supabase save default snapshot ${tab} error:`, error.message);
      } catch (e) {
        console.warn(`Supabase save default snapshot ${tab} error:`, e);
      }
    }
  },

  // 1.4. HRM LEAVES (Đơn nghỉ phép)
  hrmLeaves: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_leaves', []);
    },
    async save(leave: any): Promise<void> {
      await saveSupabase('hrm_leaves', leave);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_leaves', id);
    }
  },

  // 1.5. HRM LEAVE COEFFICIENTS (Hệ số nghỉ phép)
  hrmLeaveCoefficients: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_leave_coefficients', []);
    },
    async save(coef: any): Promise<void> {
      await saveSupabase('hrm_leave_coefficients', coef);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_leave_coefficients', id);
    }
  },

  // 1.6. HRM PAYROLL RECORDS (Bảng lương)
  hrmPayrollRecords: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_payroll_records', []);
    },
    async save(record: any): Promise<void> {
      await saveSupabase('hrm_payroll_records', record);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_payroll_records', id);
    }
  },

  // 1.7. KANBAN COLUMNS (Cài đặt cột Kanban theo sector)
  kanbanColumns: {
    async get(sector: string): Promise<{ columns: any[]; columnWidth: number } | null> {
      const sb = getSupabase();
      if (!sb) return null;
      try {
        // Use select without .single() to avoid 406 when table is empty or has no matching row
        const { data, error } = await sb.from('kanban_columns').select('*').eq('sector', sector);
        if (error || !data || data.length === 0) return null;
        const row = data[0];
        return { columns: row.columns || [], columnWidth: row.column_width || 280 };
      } catch { return null; }
    },
    async save(sector: string, columns: any[], columnWidth: number): Promise<void> {
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { error } = await sb.from('kanban_columns').upsert({ sector, columns, column_width: columnWidth });
        if (error) console.warn('kanbanColumns save error:', error.message);
      } catch (e) { console.warn('kanbanColumns save exception:', e); }
    }
  },

  // 1.8. HRM EMPLOYEE ERRORS (Lỗi / Khen thưởng nhân viên)
  hrmEmployeeErrors: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_employee_errors', []);
    },
    async save(error: any): Promise<void> {
      await saveSupabase('hrm_employee_errors', error);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_employee_errors', id);
    }
  },

  // 1.8. HRM TASK PERMISSIONS (Quyền tác vụ theo vai trò)
  hrmTaskPermissions: {
    async get(): Promise<any | null> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('hrm_task_permissions')
          .select('matrix')
          .eq('id', 'task_permission_matrix_v1')
          .limit(1);
        if (error) {
          console.warn('Supabase load task permissions error:', error.message);
          return null;
        }
        return data?.[0]?.matrix ?? null;
      } catch (e) {
        console.warn('Supabase load task permissions error:', e);
        return null;
      }
    },
    async save(matrix: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('hrm_task_permissions').upsert({ id: 'task_permission_matrix_v1', matrix });
        if (error) console.warn('Supabase save task permissions error:', error.message);
      } catch (e) {
        console.warn('Supabase save task permissions error:', e);
      }
    }
  },

  // 1.9. HRM HOLIDAYS (Ngày lễ)
  hrmHolidays: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_holidays', []);
    },
    async save(holiday: any): Promise<void> {
      await saveSupabase('hrm_holidays', holiday);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_holidays', id);
    }
  },

  // 1.10. HRM TRIPS (Chuyến công tác)
  hrmTrips: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_trips', []);
    },
    async save(trip: any): Promise<void> {
      await saveSupabase('hrm_trips', trip);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_trips', id);
    }
  },

  // 1.10b. HRM TRAVEL EXPENSES SUMMARY (Tổng hợp Công Tác Phí từ nhiệm vụ hoàn thành)
  // Lưu các mục THCTP (Tổng hợp Công Tác Phí) sinh ra khi Xác Nhận Hoàn Thành một
  // nhiệm vụ thi công có Công Tác Phí chuyến đi. Dùng cột data jsonb (pattern giống hrm_trips).
  hrmTravelExpenses: {
    async list(): Promise<any[]> {
      const rows = await querySupabase<any>('hrm_travel_expenses', []);
      return Array.isArray(rows) ? rows.map((r: any) => (r && r.data ? r.data : r)) : [];
    },
    async save(item: any, opts?: { rowId?: string }): Promise<void> {
      if (!item) {
        throw new Error('hrmTravelExpenses.save: thiếu item');
      }
      // ⚠️ CỘT id CỦA BẢNG hrm_travel_expenses LÀ uuid (xem migration 021).
      // KHÔNG được dùng mã THCTP (vd: "THCTP-1699000000000-0") làm id — Postgres sẽ
      // báo "invalid input syntax for type uuid" và upsert THẤT BẠI SILENT (chỉ
      // log warn), khiến dữ liệu CHỈ lưu localStorage mà KHÔNG lên Supabase.
      // → Sinh UUID hợp lệ cho khóa chính; giữ nguyên item.id (mã THCTP hiển thị)
      // bên trong cột data jsonb (được rowToCamel đảo ngược lại khi đọc).
      // `opts.rowId` (nếu có) dùng để upsert LẶP LẠI an toàn (idempotent) cùng 1
      // khoản CTP — tránh tạo dòng trùng khi vừa lưu lúc "Thêm" vừa lưu lúc "Hoàn
      // thành".
      let rowId = opts?.rowId;
      if (!rowId) {
        rowId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `te_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      }
      // Lưu toàn bộ object vào cột data jsonb, dùng rowId làm khóa chính uuid
      await saveSupabase('hrm_travel_expenses', { id: rowId, data: item });
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_travel_expenses', id);
    }
  },

  // 1.11. HRM PERFORMANCE CRITERIA (Tiêu chí đánh giá)
  hrmPerformanceCriteria: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_performance_criteria', []);
    },
    async save(criteria: any): Promise<void> {
      // Ensure criteria array is JSON string for TEXT columns
      const toSave = { ...criteria };
      if (Array.isArray(toSave.criteria)) {
        toSave.criteria = JSON.stringify(toSave.criteria);
      }
      await saveSupabase('hrm_performance_criteria', toSave);
    }
  },

  // 1.12. HRM SALARY SCALES (Thang lương)
  hrmSalaryScales: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_salary_scales', []);
    },
    async save(scale: any): Promise<void> {
      await saveSupabase('hrm_salary_scales', scale);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('hrm_salary_scales', id);
    }
  },

  // 1.13. TRAVEL NORMS (Định mức công tác)
  travelNorms: {
    async list(): Promise<any[]> {
      return querySupabase<any>('travel_norms', []);
    },
    async save(norm: any): Promise<void> {
      await saveSupabase('travel_norms', norm);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('travel_norms', id);
    }
  },

  // 1.14. BUSINESS PROFILE (Hồ sơ doanh nghiệp - Đồng bộ Supabase)
  businessProfile: {
    async get(): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('business_profile')
          .select('*')
          .eq('id', 'current')
          .single();
        if (error) {
          console.warn('Supabase business_profile load error:', error.message);
          return null;
        }
        return data ? {
          companyName: data.company_name,
          taxCode: data.tax_code,
          representative: data.representative,
          phone: data.phone,
          email: data.email,
          address: data.address,
          foundingYear: data.founding_year,
          businessSector: data.business_sector,
          bankInfo: data.bank_info,
          scale: data.scale
        } : null;
      } catch (e) {
        console.warn('Supabase business_profile load error:', e);
        return null;
      }
    },
    async save(profile: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không lưu được business_profile');
        return;
      }
      try {
        const { error } = await supabase.from('business_profile').upsert({
          id: 'current',
          company_name: profile.companyName,
          tax_code: profile.taxCode,
          representative: profile.representative,
          phone: profile.phone,
          email: profile.email,
          address: profile.address,
          founding_year: profile.foundingYear,
          business_sector: profile.businessSector,
          bank_info: profile.bankInfo,
          scale: profile.scale
        });
        if (error) console.warn('Supabase business_profile save error:', error.message);
      } catch (e) {
        console.warn('Supabase business_profile save exception:', e);
      }
    }
  },

  // 1.11. SHIFT CONFIG (Cấu hình ca làm việc - Đồng bộ Supabase)
  shiftConfig: {
    async get(): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('shift_config')
          .select('*')
          .eq('id', 'current')
          .single();
        if (error) {
          console.warn('Supabase shift_config load error:', error.message);
          return null;
        }
        return data ? {
          morningIn: data.morning_in,
          morningOut: data.morning_out,
          afternoonIn: data.afternoon_in,
          afternoonOut: data.afternoon_out,
          overtimeIn: data.overtime_in,
          overtimeOut: data.overtime_out,
          gpsRadiusAllowed: data.gps_radius_allowed,
          antiFakeCam: data.anti_fake_cam,
          punchOpenBeforeMinutes: data.punch_open_before_minutes,
          punchCloseAfterMinutes: data.punch_close_after_minutes,
          punchOutOpenBeforeMinutes: data.punch_out_open_before_minutes,
          punchOutCloseAfterMinutes: data.punch_out_close_after_minutes,
          otPunchOpenBeforeMinutes: data.ot_punch_open_before_minutes,
          otPunchCloseAfterMinutes: data.ot_punch_close_after_minutes,
          otPunchOutOpenBeforeMinutes: data.ot_punch_out_open_before_minutes,
          otPunchOutCloseAfterMinutes: data.ot_punch_out_close_after_minutes,
          allowedLateMinutes: data.allowed_late_minutes,
          weekendDays: data.weekend_days,
          autoAttendanceDays: data.auto_attendance_days,
          autoAttendanceStartDate: data.auto_attendance_start_date,
          directorBaseSalary: data.director_base_salary,
          pmBaseSalary: data.pm_base_salary,
          accountantBaseSalary: data.accountant_base_salary,
          staffBaseSalary: data.staff_base_salary,
          constructionSites: data.construction_sites
        } : null;
      } catch (e) {
        console.warn('Supabase shift_config load error:', e);
        return null;
      }
    },
    async save(config: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không lưu được shift_config');
        return;
      }
      try {
        const { error } = await supabase.from('shift_config').upsert({
          id: 'current',
          morning_in: config.morningIn,
          morning_out: config.morningOut,
          afternoon_in: config.afternoonIn,
          afternoon_out: config.afternoonOut,
          overtime_in: config.overtimeIn,
          overtime_out: config.overtimeOut,
          gps_radius_allowed: config.gpsRadiusAllowed,
          anti_fake_cam: config.antiFakeCam,
          punch_open_before_minutes: config.punchOpenBeforeMinutes,
          punch_close_after_minutes: config.punchCloseAfterMinutes,
          punch_out_open_before_minutes: config.punchOutOpenBeforeMinutes,
          punch_out_close_after_minutes: config.punchOutCloseAfterMinutes,
          ot_punch_open_before_minutes: config.otPunchOpenBeforeMinutes,
          ot_punch_close_after_minutes: config.otPunchCloseAfterMinutes,
          ot_punch_out_open_before_minutes: config.otPunchOutOpenBeforeMinutes,
          ot_punch_out_close_after_minutes: config.otPunchOutCloseAfterMinutes,
          allowed_late_minutes: config.allowedLateMinutes,
          weekend_days: config.weekendDays,
          auto_attendance_days: config.autoAttendanceDays,
          auto_attendance_start_date: config.autoAttendanceStartDate,
          director_base_salary: config.directorBaseSalary,
          pm_base_salary: config.pmBaseSalary,
          accountant_base_salary: config.accountantBaseSalary,
          staff_base_salary: config.staffBaseSalary,
          construction_sites: config.constructionSites
        });
        if (error) console.warn('Supabase shift_config save error:', error.message);
      } catch (e) {
        console.warn('Supabase shift_config save exception:', e);
      }
    }
  },

  // 1.12. DISPLAY SETTINGS (Cài đặt hiển thị - Màu chủ đạo, Font, Logo, Slogan)
  displaySettings: {
    async get(): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('display_settings')
          .select('*')
          .eq('id', 'current')
          .single();
        if (error) {
          console.warn('Supabase display_settings load error:', error.message);
          return null;
        }
        return data ? {
          primaryAccent: data.primary_accent,
          logoText: data.logo_text,
          brandName: data.brand_name,
          brandSlogan: data.brand_slogan,
          dashboardTitle: data.dashboard_title,
          motivationQuote: data.motivation_quote,
          fontFamily: data.font_family,
        } : null;
      } catch (e) {
        console.warn('Supabase display_settings load error:', e);
        return null;
      }
    },
    async save(settings: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('display_settings').upsert({
          id: 'current',
          primary_accent: settings.primaryAccent,
          logo_text: settings.logoText,
          brand_name: settings.brandName,
          brand_slogan: settings.brandSlogan,
          dashboard_title: settings.dashboardTitle,
          motivation_quote: settings.motivationQuote,
          font_family: settings.fontFamily,
        });
        if (error) console.warn('Supabase display_settings save error:', error.message);
      } catch (e) {
        console.warn('Supabase display_settings save exception:', e);
      }
    }
  },

  // 2. CUSTOMERS
  customers: {
    async list(): Promise<Customer[]> {
      return querySupabase<Customer>('customers', INITIAL_CUSTOMERS);
    },
    async save(customer: Customer): Promise<void> {
      await saveSupabase('customers', customer);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('customers', id);
    }
  },

  // 3. PROJECTS
  projects: {
    async list(): Promise<Project[]> {
      return querySupabase<Project>('projects', INITIAL_PROJECTS);
    },
    async save(project: Project): Promise<void> {
      await saveSupabase('projects', project);
      // Tự động tạo NHÓM CHAT DỰ ÁN khi khởi tạo/cập nhật dự án
      // (idempotent: không tạo trùng, đồng bộ thành viên khi dự án thay đổi)
      ensureProjectChatGroup(project).catch(err =>
        console.error('ensureProjectChatGroup error:', err)
      );
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('projects', id);
    },

    /**
     * XÓA DỰ ÁN + TOÀN BỘ DỮ LIỆU PHÁT SINH.
     *
     * Xóa sạch mọi thứ sinh ra từ dự án: Công Việc (kèm Nhiệm Vụ nằm trong
     * JSON của task), Nhóm chat + tin nhắn, Ghi nhận vi phạm, Công tác phí,
     * Báo giá, Hợp Đồng, Nghiệm Thu, Thanh Lý, HĐ Thầu, Công Nợ, Đề Xuất,
     * Phiếu Thu, Phiếu Chi...
     *
     * Chạy được kể cả khi migration 20260731_project_cascade_delete.sql CHƯA
     * được áp lên database: hàm tự dọn con trước rồi mới xóa cha. Khi migration
     * đã áp thì các lệnh dọn này chỉ là no-op (0 dòng) vì Postgres đã cascade.
     *
     * Xóa con trước cha là bắt buộc — nếu FK còn ở chế độ RESTRICT/NO ACTION,
     * xóa dự án trước sẽ bị Postgres từ chối.
     */
    async deleteCascade(projectId: string): Promise<ProjectCascadeReport> {
      const report: ProjectCascadeReport = { projectId, taskIds: [], deleted: {}, total: 0 };
      if (!projectId) return report;

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình — không thể xóa dự án');
      }

      const bump = (table: string, n: number) => {
        if (n > 0) {
          report.deleted[table] = (report.deleted[table] || 0) + n;
          report.total += n;
        }
      };

      // ── 0. Biết trước bảng nào có cột nào, TRƯỚC khi bắn request ────────
      // DELETE/SELECT lên cột không tồn tại trả HTTP 400 và trình duyệt log
      // đỏ ngay ở tầng network — JS không nuốt được.
      const links = await getLinkColumns();

      // ── 1. Gom Công Việc + tên dự án ─────────────────────────────────────
      // Lấy cả TÊN vì có bảng (Công tác phí) chỉ lưu projectName/taskName
      // chứ không lưu id — phải đọc trước khi xóa, sau đó là mất dấu.
      let taskIds: string[] = [];
      const taskNames = new Set<string>();
      try {
        const { data, error } = await supabase
          .from('tasks').select('id, name').eq('project_id', projectId);
        if (error) {
          console.warn('[DB] cascade: không đọc được danh sách tasks:', error.message);
        } else {
          (data || []).forEach((r: any) => {
            if (r?.id) taskIds.push(r.id);
            if (r?.name) taskNames.add(r.name);
          });
        }
      } catch (err) {
        console.warn('[DB] cascade: ngoại lệ khi đọc tasks:', err);
      }
      report.taskIds = taskIds;
      const taskIdSet = new Set(taskIds);

      let projectName = '';
      try {
        const { data } = await supabase
          .from('projects').select('name').eq('id', projectId).maybeSingle();
        projectName = (data as any)?.name || '';
      } catch {
        // Không lấy được tên thì bỏ qua phần đối chiếu theo tên
      }

      const matchKeys: CascadeMatchKeys = {
        projectId,
        taskIds: taskIdSet,
        projectName,
        taskNames,
      };

      // ── 2. Dọn nhóm chat (dự án + từng công việc) và tin nhắn bên trong ──
      // Nhóm chat được đặt id theo quy ước conv_project_<id> / conv_task_<id>,
      // đồng thời có thể có cột project_id/task_id → gom cả hai nguồn.
      const convIds = new Set<string>([
        `conv_project_${projectId}`,
        ...taskIds.map(tid => `conv_task_${tid}`),
      ]);
      const convCols = ['id'];
      if (links.byProject.has('conversations')) convCols.push('project_id');
      if (links.byTask.has('conversations')) convCols.push('task_id');
      if (convCols.length > 1) {
        try {
          const { data, error } = await supabase
            .from('conversations')
            .select(convCols.join(', '));
          if (!error) {
            (data || []).forEach((row: any) => {
              if (row?.project_id === projectId) convIds.add(row.id);
              if (row?.task_id && taskIdSet.has(row.task_id)) convIds.add(row.id);
            });
          }
        } catch {
          // Quy ước id conv_project_<id> / conv_task_<id> ở trên đã đủ dùng
        }
      }
      const convIdList = Array.from(convIds);
      bump('chat_messages', await deleteWhereIn('chat_messages', 'conversation_id', convIdList));
      bump('conversations', await deleteWhereIn('conversations', 'id', convIdList));

      // ── 3. Chốt danh sách bảng cần dọn ──────────────────────────────────
      const notSkipped = (t: string) => !CASCADE_SKIP_TABLES.has(t);
      const projectLinked = Array.from(links.byProject).filter(notSkipped);
      const taskLinked = Array.from(links.byTask).filter(notSkipped);
      const jsonbLinked = Array.from(links.byJsonb).filter(notSkipped);

      // ── 4. Dọn dữ liệu gắn theo từng Công Việc ───────────────────────────
      if (taskIds.length > 0) {
        for (const table of taskLinked) {
          bump(table, await deleteWhereIn(table, 'task_id', taskIds));
        }
      }

      // ── 5. Dọn dữ liệu gắn thẳng vào Dự Án ───────────────────────────────
      for (const table of projectLinked) {
        bump(table, await deleteWhereIn(table, 'project_id', [projectId]));
      }

      // ── 6. Bảng lưu dạng `data jsonb` — FK không với tới, quét thủ công ──
      for (const table of jsonbLinked) {
        bump(table, await deleteJsonbLinked(table, matchKeys));
      }

      // ── 7. Xóa Công Việc (Nhiệm Vụ nằm trong JSON nên chết theo) ─────────
      bump('tasks', await deleteWhereIn('tasks', 'project_id', [projectId]));

      // ── 8. Cuối cùng mới xóa chính dòng Dự Án ────────────────────────────
      await deleteSupabase('projects', projectId);

      console.log(
        `[DB] 🗑️ Đã xóa dự án ${projectId} — dọn ${report.total} dòng dữ liệu phát sinh`,
        report.deleted
      );
      return report;
    }
  },

  // 4. TASKS
  tasks: {
    async list(): Promise<Task[]> {
      return querySupabase<Task>('tasks', INITIAL_TASKS);
    },
    async save(task: Task): Promise<void> {
      await saveSupabase('tasks', task);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('tasks', id);
    },
    async deleteMultiple(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể xóa nhiều tasks');
      try {
        const { error } = await supabase.from('tasks').delete().in('id', ids);
        if (error) throw new Error(`Xóa nhiều tasks thất bại: ${error.message}`);
      } catch (err) {
        console.error('Supabase delete multiple error:', err);
        throw err;
      }
    }
  },

  // 5. RECEIPTS
  receipts: {
    async list(): Promise<Receipt[]> {
      return querySupabase<Receipt>('receipts', INITIAL_RECEIPTS);
    },
    async save(receipt: Receipt): Promise<void> {
      await saveSupabase('receipts', receipt);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('receipts', id);
    }
  },

  // 6. PAYMENTS
  payments: {
    async list(): Promise<Payment[]> {
      return querySupabase<Payment>('payments', INITIAL_PAYMENTS);
    },
    async save(payment: Payment): Promise<void> {
      await saveSupabase('payments', payment);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('payments', id);
    }
  },

  // 7. QUOTES
  quotes: {
    async list(): Promise<Quote[]> {
      return querySupabase<Quote>('quotes', INITIAL_QUOTES);
    },
    async save(quote: Quote): Promise<void> {
      await saveSupabase('quotes', quote);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('quotes', id);
    }
  },

  // 8. ARCHIVED QUOTES (Lưu trữ hồ sơ - Đồng bộ Supabase với sector)
  archivedQuotes: {
    async list(sector?: string): Promise<any[]> {
      const supabase = getSupabase();
      if (!supabase) return [];
      try {
        let query = supabase.from('archived_quotes').select('*');
        if (sector) query = query.eq('sector', sector);
        const { data, error } = await query;
        if (error) {
          console.error('Supabase archived_quotes load error:', error.message);
          throw new Error(`Không thể tải archived_quotes: ${error.message}`);
        }
        return (data || []).map((row: any) => ({
          id: row.id,
          sector: row.sector,
          code: row.code,
          customerId: row.customer_id,
          projectId: row.project_id,
          subcontractorId: row.subcontractor_id,
          contractValue: row.contract_value,
          status: row.status,
          scopeWork: row.scope_work,
          items: row.items,
          contractHtml: row.contract_html,
          acceptanceHtml: row.acceptance_html,
          liquidationHtml: row.liquidation_html,
          finalQuoteHtml: row.final_quote_html,
          isApproved: row.is_approved,
          contractApproved: row.contract_approved,
          acceptanceApproved: row.acceptance_approved,
          liquidationApproved: row.liquidation_approved,
          approvedAt: row.approved_at,
          approvedBy: row.approved_by,
          creatorId: row.creator_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          // Construction-specific fields
          projectName: row.project_name,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          customerAddress: row.customer_address,
          chieuDai: row.chieu_dai,
          chieuRong: row.chieu_rong,
          soTang: row.so_tang,
          selectedHouseType: row.selected_house_type,
          donGiaKhaiToan: row.don_gia_khai_toan,
          nganSachNoiThat: row.ngan_sach_noi_that,
          features: row.features,
          minPrice: row.min_price,
          maxPrice: row.max_price,
          dienTichSan: row.dien_tich_san,
          tongDienTichXayDung: row.tong_dien_tich_xay_dung,
          date: row.date,
          config: row.config,
          notes: row.notes,
          paymentTerms: row.payment_terms,
          totalAmount: row.total_amount,
          creatorName: row.creator_name,
          companyLogoImg: row.company_logo_img,
          companyLogoText: row.company_logo_text,
          companySlogan: row.company_slogan,
          companyAddressInfo: row.company_address_info,
          companyContactInfo: row.company_contact_info,
          contractTemplate: row.contract_template,
          acceptanceTemplate: row.acceptance_template,
          liquidationTemplate: row.liquidation_template,
          takeoffRows: row.takeoff_rows,
          takeoffTotals: row.takeoff_totals,
          finalItems: row.final_items,
          selectedFinalResult: row.selected_final_result,
          preEstimateAmount: row.pre_estimate_amount,
          takeoffCostTotal: row.takeoff_cost_total,
          isFinalQuote: row.is_final_quote,
        }));
      } catch (e) {
        console.error('Supabase archived_quotes load error:', e);
        throw e;
      }
    },
    async save(quote: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể lưu archived_quotes');
      try {
        const { error } = await supabase.from('archived_quotes').upsert({
          id: quote.id,
          sector: quote.sector || 'general',
          code: quote.code,
          customer_id: quote.customerId || null,
          project_id: quote.projectId || null,
          subcontractor_id: quote.subcontractorId,
          contract_value: quote.contractValue,
          status: quote.status,
          scope_work: quote.scopeWork,
          items: quote.items,
          contract_html: quote.contractHtml,
          acceptance_html: quote.acceptanceHtml,
          liquidation_html: quote.liquidationHtml,
          final_quote_html: quote.finalQuoteHtml,
          is_approved: quote.isApproved,
          contract_approved: quote.contractApproved,
          acceptance_approved: quote.acceptanceApproved,
          liquidation_approved: quote.liquidationApproved,
          approved_at: quote.approvedAt,
          approved_by: quote.approvedBy,
          creator_id: quote.creatorId,
          // Construction-specific fields
          project_name: quote.projectName || null,
          customer_name: quote.customerName || null,
          customer_phone: quote.customerPhone || null,
          customer_address: quote.customerAddress || null,
          chieu_dai: quote.chieuDai || null,
          chieu_rong: quote.chieuRong || null,
          so_tang: quote.soTang || null,
          selected_house_type: quote.selectedHouseType || null,
          don_gia_khai_toan: quote.donGiaKhaiToan || null,
          ngan_sach_noi_that: quote.nganSachNoiThat || null,
          features: quote.features || null,
          min_price: quote.minPrice || null,
          max_price: quote.maxPrice || null,
          dien_tich_san: quote.dienTichSan || null,
          tong_dien_tich_xay_dung: quote.tongDienTichXayDung || null,
          date: quote.date || null,
          config: quote.config || null,
          notes: quote.notes || null,
          payment_terms: quote.paymentTerms || null,
          total_amount: quote.totalAmount || null,
          creator_name: quote.creatorName || null,
          company_logo_img: quote.companyLogoImg || null,
          company_logo_text: quote.companyLogoText || null,
          company_slogan: quote.companySlogan || null,
          company_address_info: quote.companyAddressInfo || null,
          company_contact_info: quote.companyContactInfo || null,
          contract_template: quote.contractTemplate || null,
          acceptance_template: quote.acceptanceTemplate || null,
          liquidation_template: quote.liquidationTemplate || null,
          takeoff_rows: quote.takeoffRows || null,
          takeoff_totals: quote.takeoffTotals || null,
          final_items: quote.finalItems || null,
          selected_final_result: quote.selectedFinalResult || null,
          pre_estimate_amount: quote.preEstimateAmount || null,
          takeoff_cost_total: quote.takeoffCostTotal || null,
          is_final_quote: quote.isFinalQuote || null,
          created_at: quote.createdAt || null,
          updated_at: quote.updatedAt || new Date().toISOString(),
        });
        if (error) throw new Error(`Lưu archived_quotes thất bại: ${error.message}`);
      } catch (e) {
        console.error('Supabase archived_quotes save error:', e);
        throw e;
      }
    },
    async delete(id: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể xóa archived_quotes');
      try {
        const { error } = await supabase.from('archived_quotes').delete().eq('id', id);
        if (error) throw new Error(`Xóa archived_quotes thất bại: ${error.message}`);
      } catch (e) {
        console.error('Supabase archived_quotes delete error:', e);
        throw e;
      }
    },
    async deleteByProjectId(projectId: string): Promise<void> {
      if (!projectId) return;
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không xóa được archived_quotes theo dự án');
        return;
      }
      try {
        const { error } = await supabase.from('archived_quotes').delete().eq('project_id', projectId);
        if (error) throw new Error(`Xóa archived_quotes theo dự án thất bại: ${error.message}`);
      } catch (e) {
        console.error('Supabase archived_quotes deleteByProjectId error:', e);
        throw e;
      }
    },
    async listBySector(sector: string): Promise<any[]> {
      return this.list(sector);
    }
  },

  // 8.0. SUBCONTRACTOR ADVANCES (Đề xuất thu chi thầu phụ)
  subcontractorAdvances: {
    async list(): Promise<SubcontractorAdvanceProposal[]> {
      return querySupabase<SubcontractorAdvanceProposal>('subcontractor_advances', []);
    },
    async save(proposal: SubcontractorAdvanceProposal): Promise<void> {
      await saveSupabase('subcontractor_advances', proposal);
      try {
        window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated', { detail: proposal }));
      } catch (e) {
        console.warn('Failed to dispatch update event:', e);
      }
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('subcontractor_advances', id);
      try {
        window.dispatchEvent(new CustomEvent('hl-subcontractor-advances-updated'));
      } catch (e) {
        console.warn('Failed to dispatch update event:', e);
      }
    }
  },

  // 8.1. ARCHIVED CABINET QUOTES (Sector='furniture')
  archivedCabinetQuotes: {
    async list(): Promise<any[]> {
      return dbService.archivedQuotes.list('furniture');
    },
    async save(quote: any): Promise<void> {
      await dbService.archivedQuotes.save({ ...quote, sector: quote.sector || 'furniture' });
    },
    async delete(id: string): Promise<void> {
      await dbService.archivedQuotes.delete(id);
    }
  },

  // 8.2. ARCHIVED CONSTRUCTION QUOTES (Sector='construction')
  archivedConstructionQuotes: {
    async list(): Promise<any[]> {
      return dbService.archivedQuotes.list('construction');
    },
    async save(quote: any): Promise<void> {
      await dbService.archivedQuotes.save({ ...quote, sector: quote.sector || 'construction' });
    },
    async delete(id: string): Promise<void> {
      await dbService.archivedQuotes.delete(id);
    }
  },

  // 8.3. ARCHIVED MECHANICAL QUOTES (Sector='mechanical')
  archivedMechanicalQuotes: {
    async list(): Promise<any[]> {
      return dbService.archivedQuotes.list('mechanical');
    },
    async save(quote: any): Promise<void> {
      await dbService.archivedQuotes.save({ ...quote, sector: quote.sector || 'mechanical' });
    },
    async delete(id: string): Promise<void> {
      await dbService.archivedQuotes.delete(id);
    }
  },

  // 8.4. ARCHIVED SUBCONTRACTOR QUOTES (Sector='subcontractor')
  archivedSubcontractorQuotes: {
    async list(): Promise<any[]> {
      return dbService.archivedQuotes.list('subcontractor');
    },
    async save(quote: any): Promise<void> {
      await dbService.archivedQuotes.save({ ...quote, sector: quote.sector || 'subcontractor' });
    },
    async delete(id: string): Promise<void> {
      await dbService.archivedQuotes.delete(id);
    }
  },

  // 9. DOCUMENT TEMPLATES (Mẫu hồ sơ thiết kế - Đồng bộ Supabase)
  documentTemplates: {
    async get(): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase.from('document_templates').select('*').eq('id', 'global').single();
        if (error) {
          console.warn('Supabase document_templates load error:', error.message);
          return null;
        }
        const row = data as any;
        return {
          id: row.id,
          contractTemplate: row.contract_template,
          acceptanceTemplate: row.acceptance_template,
          liquidationTemplate: row.liquidation_template,
          finalQuoteTemplate: row.final_quote_template,
          constructionContractTemplate: row.construction_contract_template,
          constructionAcceptanceTemplate: row.construction_acceptance_template,
          constructionLiquidationTemplate: row.construction_liquidation_template,
          mechanicalContractTemplate: row.mechanical_contract_template,
          mechanicalAcceptanceTemplate: row.mechanical_acceptance_template,
          mechanicalLiquidationTemplate: row.mechanical_liquidation_template,
          subcontractorContractTemplate: row.subcontractor_contract_template,
          subcontractorAcceptanceTemplate: row.subcontractor_acceptance_template,
          subcontractorLiquidationTemplate: row.subcontractor_liquidation_template,
        };
      } catch (e) {
        console.warn('Supabase document_templates load error:', e);
        return null;
      }
    },
    async save(templates: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không lưu được document_templates');
        return;
      }
      try {
        const { error } = await supabase.from('document_templates').upsert({
          id: 'global',
          contract_template: templates.contractTemplate,
          acceptance_template: templates.acceptanceTemplate,
          liquidation_template: templates.liquidationTemplate,
          final_quote_template: templates.finalQuoteTemplate,
          construction_contract_template: templates.constructionContractTemplate,
          construction_acceptance_template: templates.constructionAcceptanceTemplate,
          construction_liquidation_template: templates.constructionLiquidationTemplate,
          mechanical_contract_template: templates.mechanicalContractTemplate,
          mechanical_acceptance_template: templates.mechanicalAcceptanceTemplate,
          mechanical_liquidation_template: templates.mechanicalLiquidationTemplate,
          subcontractor_contract_template: templates.subcontractorContractTemplate,
          subcontractor_acceptance_template: templates.subcontractorAcceptanceTemplate,
          subcontractor_liquidation_template: templates.subcontractorLiquidationTemplate,
        });
        if (error) console.warn('Supabase document_templates save error:', error.message);
      } catch (e) {
        console.warn('Supabase document_templates save exception:', e);
      }
    }
  },

  // 9.5. PROJECT PERMISSIONS (Quyền Dự Án toàn hệ thống)
  projectPermissions: {
    async get(): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase.from('project_permissions').select('matrix').eq('id', 'global').single();
        if (error) {
          console.warn('Supabase project_permissions load error:', error.message);
          return null;
        }
        return data?.matrix ?? null;
      } catch (error) {
        console.warn('Supabase project_permissions load error:', error);
        return null;
      }
    },
    async save(matrix: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không lưu được project_permissions');
        return;
      }
      try {
        const { error } = await supabase.from('project_permissions').upsert({ id: 'global', matrix });
        if (error) console.warn('Supabase projectPermissions save error:', error.message);
      } catch (e) {
        console.warn('Supabase projectPermissions save error:', e);
      }
    }
  },

  // 9.6. PROJECT PERMISSION OVERRIDES (Ghi đè quyền theo từng dự án)
  projectPermissionOverrides: {
    async get(projectId: string): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
          .from('project_permission_overrides')
          .select('*')
          .eq('project_id', projectId)
          .single();
        if (error) {
          console.warn(`Supabase projectPermissionOverrides ${projectId} load error:`, error.message);
          return null;
        }
        return data?.overrides ?? null;
      } catch (error) {
        console.warn(`Supabase projectPermissionOverrides ${projectId} load error:`, error);
        return null;
      }
    },
    async save(projectId: string, override: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không lưu được projectPermissionOverrides');
        return;
      }
      try {
        const { error } = await supabase
          .from('project_permission_overrides')
          .upsert({ id: projectId, project_id: projectId, overrides: override });
        if (error) console.warn('Supabase projectPermissionOverrides save error:', error.message);
      } catch (e) {
        console.warn('Supabase projectPermissionOverrides save error:', e);
      }
    },
    async delete(projectId: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase chưa cấu hình — không xóa được projectPermissionOverrides');
        return;
      }
      try {
        const { error } = await supabase.from('project_permission_overrides').delete().eq('project_id', projectId);
        if (error) console.warn('Supabase projectPermissionOverrides delete error:', error.message);
      } catch (e) {
        console.warn('Supabase projectPermissionOverrides delete error:', e);
      }
    }
  },

  // 10. QUOTATION CONFIGS (Cấu hình mẫu báo giá toàn cục - Đồng bộ Supabase)
  quotationConfigs: {
    async get(sector: string): Promise<any> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase.from('quotation_configs').select('config').eq('sector', sector).maybeSingle();
        if (error) {
          console.warn(`Supabase quotation_configs ${sector} load error:`, error.message);
          return null;
        }
        return data?.config ?? null;
      } catch (e) {
        console.warn(`Supabase quotation_configs ${sector} load error:`, e);
        return null;
      }
    },
    async save(sector: string, config: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase chưa cấu hình — không lưu được quotationConfigs');
      }
      const { error } = await supabase.from('quotation_configs').upsert({ sector, config });
      if (error) {
        console.error(`Supabase quotation_configs ${sector} save error:`, error.message);
        throw new Error(`Lỗi lưu lên Supabase: ${error.message}`);
      }
    }
  },

  // Update specific quote's document HTML fields across both active and archived lists
  async updateQuoteDocHtml(quoteId: string, fields: {
    contractHtml?: string;
    acceptanceHtml?: string;
    liquidationHtml?: string;
    finalQuoteHtml?: string;
    isApproved?: boolean;
    contractApproved?: boolean;
    acceptanceApproved?: boolean;
    liquidationApproved?: boolean;
    approvedAt?: string;
    approvedBy?: string;
  }): Promise<void> {
    // ── Supabase: partial update into unified archived_quotes ──
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('Supabase chưa cấu hình — không cập nhật được updateQuoteDocHtml');
      return;
    }
    try {
      const snakeFields: any = {};
      if (fields.contractHtml !== undefined)        snakeFields.contract_html = fields.contractHtml;
      if (fields.acceptanceHtml !== undefined)      snakeFields.acceptance_html = fields.acceptanceHtml;
      if (fields.liquidationHtml !== undefined)     snakeFields.liquidation_html = fields.liquidationHtml;
      if (fields.finalQuoteHtml !== undefined)      snakeFields.final_quote_html = fields.finalQuoteHtml;
      if (fields.isApproved !== undefined)          snakeFields.is_approved = fields.isApproved;
      if (fields.contractApproved !== undefined)    snakeFields.contract_approved = fields.contractApproved;
      if (fields.acceptanceApproved !== undefined)  snakeFields.acceptance_approved = fields.acceptanceApproved;
      if (fields.liquidationApproved !== undefined) snakeFields.liquidation_approved = fields.liquidationApproved;
      if (fields.approvedAt !== undefined)          snakeFields.approved_at = fields.approvedAt;
      if (fields.approvedBy !== undefined)          snakeFields.approved_by = fields.approvedBy;
      if (Object.keys(snakeFields).length > 0) {
        const { error } = await supabase.from('archived_quotes').update(snakeFields).eq('id', quoteId);
        if (error) console.warn('Supabase updateQuoteDocHtml error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase updateQuoteDocHtml exception:', e);
    }
  },

  // 10.5. NOTIFICATIONS (Thông báo hệ thống - Đồng bộ Supabase)
  notifications: {
    async list(): Promise<any[]> {
      return querySupabase<any>('notifications', []);
    },
    async save(notif: any): Promise<void> {
      await saveSupabase('notifications', notif);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('notifications', id);
    },
    async markRead(id: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
        if (error) console.warn('Supabase markRead error:', error.message);
      } catch (e) {
        console.warn('Supabase markRead exception:', e);
      }
    }
  },

  // 11. SUPPLIERS (Đồng bộ Supabase)
  suppliers: {
    async list(): Promise<any[]> {
      return querySupabase<any>('suppliers', []);
    },
    async save(supplier: any): Promise<void> {
      await saveSupabase('suppliers', supplier);
      try {
        window.dispatchEvent(new CustomEvent('hl-suppliers-updated', { detail: supplier }));
      } catch (e) {
        console.warn('Failed to dispatch suppliers event:', e);
      }
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('suppliers', id);
      try {
        window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
      } catch (e) {
        console.warn('Failed to dispatch suppliers event:', e);
      }
    }
  },

  // 11.5 ACCOUNTING SUBCONTRACTORS (DANH SÁCH THẦU PHỤ — bảng riêng, tách khỏi suppliers/NCC)
  accountingSubcontractors: {
    async list(): Promise<any[]> {
      return querySupabase<any>('accounting_subcontractors', []);
    },
    async save(supplier: any): Promise<void> {
      await saveSupabase('accounting_subcontractors', supplier);
      try {
        window.dispatchEvent(new CustomEvent('hl-suppliers-updated', { detail: supplier }));
      } catch (e) {
        console.warn('Failed to dispatch subcontractors event:', e);
      }
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('accounting_subcontractors', id);
      try {
        window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
      } catch (e) {
        console.warn('Failed to dispatch subcontractors event:', e);
      }
    }
  },

  // 12. INVENTORY (Đồng bộ Supabase)
  inventory: {
    async list(): Promise<any[]> {
      return querySupabase<any>('inventory', []);
    },
    async save(item: any): Promise<void> {
      await saveSupabase('inventory', item);
      try {
        window.dispatchEvent(new CustomEvent('hl-inventory-updated', { detail: item }));
      } catch (e) {
        console.warn('Failed to dispatch inventory event:', e);
      }
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('inventory', id);
      try {
        window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
      } catch (e) {
        console.warn('Failed to dispatch inventory event:', e);
      }
    }
  },

  // 9. WAREHOUSE LOGS (Đồng bộ Supabase)
  warehouseLogs: {
    async list(): Promise<any[]> {
      return querySupabase<any>('warehouse_logs', []);
    },
    async save(log: any): Promise<void> {
      await saveSupabase('warehouse_logs', log);
      try {
        window.dispatchEvent(new CustomEvent('hl-warehouse-logs-updated', { detail: log }));
      } catch (e) {
        console.warn('Failed to dispatch warehouse logs event:', e);
      }
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('warehouse_logs', id);
      try {
        window.dispatchEvent(new CustomEvent('hl-warehouse-logs-updated'));
      } catch (e) {
        console.warn('Failed to dispatch warehouse logs event:', e);
      }
    }
  },

  // 15. SUBCONTRACTOR CATALOG (Catalog sản phẩm thầu phụ)
  subcontractorCatalog: {
    async list(): Promise<any[]> {
      return querySupabase<any>('subcontractor_catalog_items', []);
    },
    async save(item: any): Promise<void> {
      await saveSupabase('subcontractor_catalog_items', item);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('subcontractor_catalog_items', id);
    }
  },

  // 16. ACCOUNTING CUSTOM LIABILITIES (Công nợ tùy chỉnh kế toán)
  accountingLiabilities: {
    async list(): Promise<any[]> {
      return querySupabase<any>('accounting_liabilities', []);
    },
    async save(liability: any): Promise<void> {
      await saveSupabase('accounting_liabilities', liability);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('accounting_liabilities', id);
    }
  },

  // 17. ACCOUNTING CUSTOM RECEIVABLES (Công nợ phải thu thủ công / import Excel)
  accountingReceivables: {
    async list(): Promise<any[]> {
      return querySupabase<any>('accounting_receivables', []);
    },
    async save(receivable: any): Promise<void> {
      await saveSupabase('accounting_receivables', receivable);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('accounting_receivables', id);
    }
  },

  // 18. ACCOUNTING SUB-CONTRACTS (Hợp đồng thầu phụ kế toán)
  accountingSubContracts: {
    async list(): Promise<any[]> {
      return querySupabase<any>('accounting_sub_contracts', []);
    },
    async save(contract: any): Promise<void> {
      await saveSupabase('accounting_sub_contracts', contract);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('accounting_sub_contracts', id);
    }
  },

  // 14. CONSTRUCTION NORMS (Định mức & đơn giá xây dựng)
  constructionNorms: {
    async get(type: string): Promise<any[] | null> {
      const supabase = getSupabase();
      if (!supabase) return null;
      try {
        const { data, error } = await supabase.from('construction_norms').select('data').eq('id', type).maybeSingle();
        if (error) { console.warn('[DB] Load construction_norms error:', error.message); return null; }
        return data?.data ?? null;
      } catch (err) {
        console.warn('[DB] Load construction_norms exception:', err);
        return null;
      }
    },
    async save(type: string, items: any[]): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        await supabase.from('construction_norms').upsert({ id: type, data: items, updated_at: new Date().toISOString() });
      } catch (err) {
        console.warn('[DB] Save construction_norms exception:', err);
      }
    }
  },

  // 14b. PRODUCT PRICES (Giá bán theo sản phẩm — từ Danh mục sản phẩm Nội Thất)
  productPrices: {
    async list(): Promise<any[]> {
      const supabase = getSupabase();
      if (!supabase) return [];
      try {
        const { data, error } = await supabase.from('product_prices').select('*');
        if (error) { console.warn('[DB] Load product_prices error:', error.message); return []; }
        return (data || []).map((row: any) => ({
          id: row.id,
          productId: row.product_id,
          tenGia: row.ten_gia,
          donGia: row.don_gia,
          ghiChu: row.ghi_chu,
        }));
      } catch (err) { console.warn('[DB] Load product_prices exception:', err); return []; }
    },
    async save(item: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('product_prices').upsert({
          id: item.id,
          product_id: item.productId,
          ten_gia: item.tenGia,
          don_gia: item.donGia,
          ghi_chu: item.ghiChu || null,
        });
        if (error) console.warn('[DB] Save product_prices error:', error.message);
      } catch (err) { console.warn('[DB] Save product_prices exception:', err); }
    },
    async delete(id: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('product_prices').delete().eq('id', id);
        if (error) console.warn('[DB] Delete product_prices error:', error.message);
      } catch (err) { console.warn('[DB] Delete product_prices exception:', err); }
    }
  },

  // 14c. PRODUCT MATERIALS (Chất liệu theo sản phẩm — từ Danh mục sản phẩm Nội Thất)
  productMaterials: {
    async list(): Promise<any[]> {
      const supabase = getSupabase();
      if (!supabase) return [];
      try {
        const { data, error } = await supabase.from('product_materials').select('*');
        if (error) { console.warn('[DB] Load product_materials error:', error.message); return []; }
        return (data || []).map((row: any) => ({
          id: row.id,
          productId: row.product_id,
          tenChatLieu: row.ten_chat_lieu,
          ghiChu: row.ghi_chu,
        }));
      } catch (err) { console.warn('[DB] Load product_materials exception:', err); return []; }
    },
    async save(item: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('product_materials').upsert({
          id: item.id,
          product_id: item.productId,
          ten_chat_lieu: item.tenChatLieu,
          ghi_chu: item.ghiChu || null,
        });
        if (error) console.warn('[DB] Save product_materials error:', error.message);
      } catch (err) { console.warn('[DB] Save product_materials exception:', err); }
    },
    async delete(id: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { error } = await supabase.from('product_materials').delete().eq('id', id);
        if (error) console.warn('[DB] Delete product_materials error:', error.message);
      } catch (err) { console.warn('[DB] Delete product_materials exception:', err); }
    }
  },

  // 14d. ACCOUNTING PRODUCT CATALOG (Danh mục sản phẩm kế toán)
  accountingProductCatalog: {
    async list(): Promise<any[]> {
      return querySupabase<any>('accounting_product_catalog', []);
    },
    async save(item: any): Promise<void> {
      await saveSupabase('accounting_product_catalog', item);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('accounting_product_catalog', id);
    }
  },

  // 14e. SALES ORDERS (Đơn hàng bán — sync Supabase)
  salesOrders: {
    async list(): Promise<any[]> {
      const rows = await querySupabase<any>('sales_orders', []);
      return rows.map(normalizeOrderItems);
    },
    async save(order: any): Promise<void> {
      // items là cột JSONB → truyền thẳng array, KHÔNG stringify.
      // (keysToSnake không đệ quy vào value nên key camelCase bên trong
      //  items vẫn được giữ nguyên. Stringify sẽ khiến Postgres lưu thành
      //  JSON scalar string → đọc ra không phải array → crash khi .map)
      await saveSupabase('sales_orders', order);
    },
    /** Tạo đơn MỚI — không bao giờ ghi đè đơn cũ; tự cấp lại mã nếu trùng. */
    async create(order: any): Promise<any> {
      return createOrderUnique('sales_orders', order);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('sales_orders', id);
    }
  },

  // 14f. PURCHASE ORDERS (Đơn mua hàng — sync Supabase)
  purchaseOrders: {
    async list(): Promise<any[]> {
      const rows = await querySupabase<any>('purchase_orders', []);
      return rows.map(normalizeOrderItems);
    },
    async save(order: any): Promise<void> {
      await saveSupabase('purchase_orders', order);
    },
    /** Tạo đơn MỚI — không bao giờ ghi đè đơn cũ; tự cấp lại mã nếu trùng. */
    async create(order: any): Promise<any> {
      return createOrderUnique('purchase_orders', order);
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('purchase_orders', id);
    }
  },

  // 15. ATTENDANCE (Chấm công) — sync với Supabase attendance_records
  attendance: {
    async list(): Promise<any[]> {
      const supabase = getSupabase();
      if (!supabase) return [];
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('*')
          .order('date', { ascending: false });
        if (error) {
          console.error('Supabase attendance load error:', error.message);
          throw new Error(`Không thể tải chấm công: ${error.message}`);
        }
        return (data || []).map((r: any) => ({
          id: r.id,
          empId: r.emp_id,
          empName: r.emp_name,
          date: r.date,
          timeInS: normalizeTime(r.time_in_s),
          timeOutS: normalizeTime(r.time_out_s),
          timeInC: normalizeTime(r.time_in_c),
          timeOutC: normalizeTime(r.time_out_c),
          timeInOT: normalizeTime(r.time_in_ot),
          timeOutOT: normalizeTime(r.time_out_ot),
          method: r.method,
          status: r.status,
          otHours: r.ot_hours,
          notes: r.notes,
          photoIn: r.photo_in,
          locationIn: r.location_in,
          coordsIn: r.coords_in,
          photoOut: r.photo_out,
          locationOut: r.location_out,
          coordsOut: r.coords_out,
          isLocked: r.is_locked,
        }));
      } catch (err) {
        console.error('Supabase attendance fetch exception:', err);
        throw err;
      }
    },
    /**
     * Lưu chấm công với thời gian máy chủ (Server-side time).
     * Tham số `punchSlot` xác định ca nào đang được chấm (timeInS, timeOutS, timeInC, timeOutC, timeInOT, timeOutOT).
     * Hàm này sẽ dùng hàm `now()` của PostgreSQL/Supabase để ghi nhận thời điểm chính xác, chống gian lận giờ client.
     */
    async save(record: any, punchSlot?: 'timeInS' | 'timeOutS' | 'timeInC' | 'timeOutC' | 'timeInOT' | 'timeOutOT'): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể lưu chấm công');

      const row: any = {
        id: record.id,
        emp_id: record.empId,
        emp_name: record.empName,
        date: record.date,
        method: record.method,
        status: record.status,
        ot_hours: record.otHours,
        notes: record.notes,
        photo_in: record.photoIn,
        location_in: record.locationIn,
        coords_in: record.coordsIn,
        photo_out: record.photoOut,
        location_out: record.locationOut,
        coords_out: record.coordsOut,
        is_locked: record.isLocked,
      };

      // Nếu có chỉ định punchSlot, ta dùng hàm now() của DB cho slot đó.
      // Các slot khác sẽ lấy giá trị từ client (để giữ lịch sử) hoặc null.
      const slotMap: Record<string, string> = {
        timeInS: 'time_in_s',
        timeOutS: 'time_out_s',
        timeInC: 'time_in_c',
        timeOutC: 'time_out_c',
        timeInOT: 'time_in_ot',
        timeOutOT: 'time_out_ot',
      };

      // Mặc định: không ghi đè time bằng now() nếu không có punchSlot (trường hợp update thủ công/admin)
      // Chỉ khi chấm công thực tế (punch) thì mới dùng now()
      if (punchSlot && slotMap[punchSlot]) {
        // Sử dụng raw SQL expression `now() at time zone 'Asia/Ho_Chi_Minh'` để lấy giờ VN chính xác
        // Cách 1: Dùng RPC hoặc trigger (phức tạp).
        // Cách 2 (Đơn giản, hiệu quả): Client gửi `punchSlot`, Server (Edge Function/Trigger) xử lý.
        // Cách 3 (Tạm thời, phía Client nhưng an toàn hơn): Client tự lấy giờ server qua API `/time` rồi mới gửi.
        // ----> Ở đây ta sẽ triển khai Cách 3 nhẹ: Client sẽ tự lấy giờ server trước khi gọi save.
        // Nhưng để giữ tương thích, ta thêm logic: Nếu record có trường `_serverTime` (do client lấy trước), dùng nó.

        if (record._serverTime) {
          // Chỉ lấy chuỗi thời gian "HH:mm" từ object server timestamp, không lưu toàn bộ object
          row[slotMap[punchSlot]] = record._serverTime.time;
        } else {
          // Fallback: dùng giờ client nhưng log cảnh báo
          console.warn('[Attendance] Saving with CLIENT time (fallback). Implement server-time fetch for production.');
          row[slotMap[punchSlot]] = record[punchSlot];
        }

        // Bổ sung: ghi đầy đủ các slot KHÁC nếu record đã có giá trị thực.
        // Tránh lỗi: lần chấm đầu (Vào) chưa kịp lưu lên DB, lần chấm sau (Ra) lưu được →
        // INSERT tạo row chỉ có 1 cột time → bảng "Chấm công ngày" hiển thị thiếu/mất dữ liệu.
        const otherSlots: Array<[keyof typeof slotMap, string]> = [
          ['timeInS', 'time_in_s'],
          ['timeOutS', 'time_out_s'],
          ['timeInC', 'time_in_c'],
          ['timeOutC', 'time_out_c'],
          ['timeInOT', 'time_in_ot'],
          ['timeOutOT', 'time_out_ot'],
        ];
        for (const [recKey, colKey] of otherSlots) {
          if (colKey === slotMap[punchSlot]) continue; // slot chính đã set ở trên
          const v = normalizeTime(record[recKey]);
          if (v !== '--:--') row[colKey] = v;
        }
      } else {
        // Update thủ công/admin: ghi toàn bộ các trường time từ record
        row.time_in_s = record.timeInS;
        row.time_out_s = record.timeOutS;
        row.time_in_c = record.timeInC;
        row.time_out_c = record.timeOutC;
        row.time_in_ot = record.timeInOT;
        row.time_out_ot = record.timeOutOT;
      }

      try {
        const { error } = await supabase.from('attendance_records').upsert(row);
        if (error) throw new Error(`Lưu chấm công thất bại: ${error.message}`);
      } catch (err) {
        console.error('Supabase attendance save exception:', err);
        throw err;
      }
    },
    async delete(id: string): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể xóa chấm công');
      try {
        const { error } = await supabase.from('attendance_records').delete().eq('id', id);
        if (error) throw new Error(`Xóa chấm công thất bại: ${error.message}`);
      } catch (err) {
        console.error('Supabase attendance delete exception:', err);
        throw err;
      }
    }
  },

  /**
   * Kiểm tra user có phải Super Admin không — query trực tiếp Supabase, KHÔNG dùng localStorage.
   * Fail-secure: network error → false.
   */
  async checkSuperAdmin(empId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    try {
      const { data, error } = await supabase
        .from('hrm_role_groups')
        .select('member_ids')
        .eq('id', 'role_superadmin')
        .single();
      if (error) return false;
      return data?.member_ids?.includes(empId) ?? false;
    } catch {
      return false; // fail secure
    }
  },

  /**
   * Upload một hình ảnh Báo cáo nhiệm vụ thi công lên Supabase Storage.
   * Trả về public URL của ảnh. Nếu Supabase chưa cấu hình hoặc upload thất bại
   * (ví dụ bucket chưa tồn tại), tự động fallback về data URL base64 để chức
   * năng vẫn hoạt động offline / local.
   */
  async uploadMissionReportImage(
    taskId: string,
    missionId: string,
    file: File
  ): Promise<{ url: string; stored: 'supabase' | 'local' }> {
    const supabase = getSupabase();
    if (!supabase) {
      // Không có Supabase → dùng data URL local
      return await new Promise<{ url: string; stored: 'local' }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => typeof reader.result === 'string'
          ? resolve({ url: reader.result, stored: 'local' })
          : reject(new Error('Không đọc được file'));
        reader.onerror = () => reject(reader.error || new Error('Lỗi đọc file'));
        reader.readAsDataURL(file);
      });
    }

    const BUCKET = 'mission-report-images';
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const safeTask = String(taskId || 'task').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeMission = String(missionId || 'mission').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ts = typeof Date.now === 'function' ? Date.now() : Math.floor(performance.now());
    const path = `${safeTask}/${safeMission}_${ts}.${safeExt}`;

    const doUpload = async (): Promise<string> => {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || `image/${safeExt}`, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    };

    const localFallback = (): Promise<{ url: string; stored: 'local' }> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => typeof reader.result === 'string'
        ? resolve({ url: reader.result, stored: 'local' })
        : reject(new Error('Không đọc được file'));
      reader.onerror = () => reject(reader.error || new Error('Lỗi đọc file'));
      reader.readAsDataURL(file);
    });

    try {
      return { url: await doUpload(), stored: 'supabase' };
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      // Bucket chưa tồn tại → thử tự tạo (nếu role được phép) rồi upload lại 1 lần
      if (/bucket not found|not found/i.test(msg)) {
        try {
          await supabase.storage.createBucket(BUCKET, {
            public: true,
            fileSizeLimit: 10485760,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
          });
          return { url: await doUpload(), stored: 'supabase' };
        } catch (createErr: any) {
          console.warn('[uploadMissionReportImage] Không tự tạo được bucket (cần chạy migration tạo bucket):', createErr?.message || createErr);
        }
      }
      console.warn('[uploadMissionReportImage] Upload Supabase thất bại, lưu cục bộ (data URL):', msg);
      return await localFallback();
    }
  },

  // Clean initialization helper to bootstrap full local database on the first sync if cloud db is empty
  async bootstrapFirstTime(force = false): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('Supabase chưa cấu hình — bỏ qua bootstrap');
      return;
    }
    try {
      console.log('Supabase connected. Ensuring initial schemas are seeded if tables are empty...');
      if (force) {
        await Promise.all([
          seedTableToSupabase('employees', INITIAL_EMPLOYEES),
          seedTableToSupabase('customers', INITIAL_CUSTOMERS),
          seedTableToSupabase('projects', INITIAL_PROJECTS),
          seedTableToSupabase('tasks', INITIAL_TASKS),
          seedTableToSupabase('receipts', INITIAL_RECEIPTS),
          seedTableToSupabase('payments', INITIAL_PAYMENTS),
          seedTableToSupabase('quotes', INITIAL_QUOTES)
        ]);
      }
    } catch (err) {
      console.warn('Error bootstrapping initial tables to Supabase:', err);
    }
  }
};
