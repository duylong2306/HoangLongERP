import { getSupabase } from './supabase';
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
  const n: any = {};
  Object.keys(row).forEach(k => {
    n[snakeToCamel(k)] = row[k];
  });
  return n;
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

// Query helper for Supabase
async function querySupabase<T>(tableName: string, fallbackData: T[]): Promise<T[]> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn(`Supabase chưa được cấu hình — không thể truy vấn ${tableName}`);
    return fallbackData;
  }
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`Supabase load error for ${tableName}:`, error.message);
      throw new Error(`Không thể tải dữ liệu ${tableName} từ Supabase: ${error.message}`);
    }
    if (data && data.length > 0) {
      return data.map(rowToCamel) as T[];
    }
    // KHÔNG tự động bơm dữ liệu mẫu khi bảng rỗng — tránh "hồi sinh" dữ liệu
    // người dùng đã cố tình xóa trực tiếp trên Supabase. Bảng rỗng trả về [].
    return [];
  } catch (err) {
    console.error(`Supabase fetch exception for ${tableName}:`, err);
    throw err;
  }
}

// Upsert helper
async function saveSupabase(tableName: string, item: any): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(`Supabase chưa được cấu hình — không thể lưu ${tableName}`);
  }
  try {
    const snakeItem = keysToSnake(item);
    const { error } = await supabase.from(tableName).upsert(snakeItem);
    if (error) {
      console.error(`Supabase save error for ${tableName}:`, error.message);
      throw new Error(`Lưu ${tableName} thất bại: ${error.message}`);
    }
  } catch (err) {
    console.error(`Supabase save exception for ${tableName}:`, err);
    throw err;
  }
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
  } catch (err) {
    console.error(`Supabase delete exception for ${tableName}:`, err);
    throw err;
  }
}

export const dbService = {
  // 1. EMPLOYEES
  employees: {
    async list(): Promise<Employee[]> {
      return querySupabase<Employee>('employees', INITIAL_EMPLOYEES);
    },
    async save(employee: Employee): Promise<void> {
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
      return querySupabase<HrmRoleGroup>('hrm_role_groups', []);
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
        const { data, error } = await sb.from('kanban_columns').select('*').eq('sector', sector).single();
        if (error || !data) return null;
        return { columns: data.columns || [], columnWidth: data.column_width || 280 };
      } catch { return null; }
    },
    async save(sector: string, columns: any[], columnWidth: number): Promise<void> {
      const sb = getSupabase();
      if (!sb) return;
      try {
        const { error } = await sb.from('kanban_columns').upsert({ sector, columns, column_width: columnWidth });
        if (error) console.error('kanbanColumns save error:', error.message);
      } catch (e) { console.error('kanbanColumns save exception:', e); }
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
          .single();
        if (error) {
          console.warn('Supabase load task permissions error:', error.message);
          return null;
        }
        return data?.matrix ?? null;
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

  // 1.11. HRM PERFORMANCE CRITERIA (Tiêu chí đánh giá)
  hrmPerformanceCriteria: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_performance_criteria', []);
    },
    async save(criteria: any): Promise<void> {
      await saveSupabase('hrm_performance_criteria', criteria);
    }
  },

  // 1.12. HRM SALARY SCALES (Thang lương)
  hrmSalaryScales: {
    async list(): Promise<any[]> {
      return querySupabase<any>('hrm_salary_scales', []);
    },
    async save(scale: any): Promise<void> {
      await saveSupabase('hrm_salary_scales', scale);
    }
  },

  // 1.13. TRAVEL NORMS (Định mức công tác)
  travelNorms: {
    async list(): Promise<any[]> {
      return querySupabase<any>('travel_norms', []);
    },
    async save(norm: any): Promise<void> {
      await saveSupabase('travel_norms', norm);
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
          weekendDays: data.weekend_days
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
          weekend_days: config.weekendDays
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
    },
    async delete(id: string): Promise<void> {
      await deleteSupabase('projects', id);
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
          customer_id: quote.customerId,
          project_id: quote.projectId,
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
        const { data, error } = await supabase.from('project_permissions').select('*').eq('id', 'global').single();
        if (error) {
          console.warn('Supabase project_permissions load error:', error.message);
          return null;
        }
        return data;
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
        const { error } = await supabase.from('project_permissions').upsert({ id: 'global', ...matrix });
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
        const { data, error } = await supabase.from('quotation_configs').select('config').eq('sector', sector).single();
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
        console.warn('Supabase chưa cấu hình — không lưu được quotationConfigs');
        return;
      }
      try {
        const { error } = await supabase.from('quotation_configs').upsert({ sector, config });
        if (error) console.warn(`Supabase quotation_configs ${sector} save error:`, error.message);
      } catch (e) {
        console.warn(`Supabase quotation_configs ${sector} save exception:`, e);
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

  // 16. TRAVEL NORMS (Định mức công tác phí)
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

  // 17. ACCOUNTING CUSTOM LIABILITIES (Công nợ tùy chỉnh kế toán)
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

  // 14. ATTENDANCE (Chấm công) — sync với Supabase attendance_records
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
          timeInS: r.time_in_s,
          timeOutS: r.time_out_s,
          timeInC: r.time_in_c,
          timeOutC: r.time_out_c,
          timeInOT: r.time_in_ot,
          timeOutOT: r.time_out_ot,
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
    async save(record: any): Promise<void> {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase chưa được cấu hình — không thể lưu chấm công');
      const row = {
        id: record.id,
        emp_id: record.empId,
        emp_name: record.empName,
        date: record.date,
        time_in_s: record.timeInS,
        time_out_s: record.timeOutS,
        time_in_c: record.timeInC,
        time_out_c: record.timeOutC,
        time_in_ot: record.timeInOT,
        time_out_ot: record.timeOutOT,
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
